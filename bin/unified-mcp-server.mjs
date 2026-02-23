#!/usr/bin/env node
// unified-mcp-server.mjs — config-driven MCP stdio server
// Implements raw JSON-RPC stdio (no SDK dependency)
// Wraps multiple CLI providers as MCP tools, driven by providers.json

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load providers config ─────────────────────────────────────────────────────
const configPath = process.env.UNIFIED_PROVIDERS_CONFIG
  ?? join(__dirname, 'providers.json');
let providers;
try {
  providers = JSON.parse(fs.readFileSync(configPath, 'utf8')).providers;
} catch (e) {
  process.stderr.write(`[unified-mcp-server] Failed to load config: ${e.message}\n`);
  process.exit(1);
}

// ─── MCP response helpers ──────────────────────────────────────────────────────
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

// ─── Build tool definitions from providers ─────────────────────────────────────
function buildTools() {
  return providers.map(p => ({
    name: p.name,
    description: p.description,
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt or task to send to the provider CLI',
        },
        timeout_ms: {
          type: 'number',
          description: `Timeout in milliseconds (default: ${p.timeout_ms ?? 300000})`,
        },
      },
      required: ['prompt'],
    },
  }));
}

// ─── Subprocess execution ──────────────────────────────────────────────────────
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

async function runProvider(provider, toolArgs) {
  const prompt = toolArgs.prompt;
  const timeoutMs = toolArgs.timeout_ms ?? provider.timeout_ms ?? 300000;

  // Substitute {prompt} placeholder in args_template
  const args = provider.args_template.map(a =>
    a === '{prompt}' ? prompt : a
  );

  const env = { ...process.env, ...(provider.env ?? {}) };

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(provider.cli, args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve(`[spawn error: ${err.message}]`);
      return;
    }

    child.stdin.end(); // providers are non-interactive; close stdin immediately

    let stdout = '';
    let stderr = '';
    let truncated = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        try { if (!child.killed) child.kill('SIGKILL'); } catch (_) { /* ignore */ }
      }, 5000);
    }, timeoutMs);

    child.stdout.on('data', d => {
      if (!truncated) {
        const chunk = d.toString();
        if (stdout.length + chunk.length > MAX_BUFFER) {
          stdout += chunk.slice(0, MAX_BUFFER - stdout.length);
          truncated = true;
        } else {
          stdout += chunk;
        }
      }
    });

    child.stderr.on('data', d => {
      stderr += d.toString().slice(0, 4096); // keep stderr brief
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const output = stdout || stderr || '(no output)';
      const suffix = timedOut
        ? `\n\n[TIMED OUT after ${timeoutMs}ms]`
        : truncated ? '\n\n[OUTPUT TRUNCATED at 10MB]' : '';
      const exitNote = (code !== 0 && !timedOut) ? `\n\n[exit code ${code}]` : '';
      resolve(output + suffix + exitNote);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[spawn error: ${err.message}]`);
    });
  });
}

// ─── Request handlers ──────────────────────────────────────────────────────────
const toolMap = new Map(providers.map(p => [p.name, p]));

async function handleRequest(req) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    sendResult(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'unified-mcp-server', version: '1.0.0' },
      capabilities: { tools: {} },
    });
    return;
  }

  if (method === 'notifications/initialized') {
    return; // no response for notifications
  }

  if (method === 'tools/list') {
    sendResult(id, { tools: buildTools() });
    return;
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments ?? {};
    const provider = toolMap.get(toolName);

    if (!provider) {
      sendResult(id, {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      });
      return;
    }

    try {
      const output = await runProvider(provider, toolArgs);
      sendResult(id, {
        content: [{ type: 'text', text: output }],
        isError: false,
      });
    } catch (err) {
      sendResult(id, {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      });
    }
    return;
  }

  // Unknown method — return method not found error
  if (id !== undefined && id !== null) {
    sendError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Stdin line reader ─────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch (e) {
    sendError(null, -32700, 'Parse error');
    return;
  }
  await handleRequest(req);
});

rl.on('close', () => process.exit(0));

process.stderr.write('[unified-mcp-server] started\n');
