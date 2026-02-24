#!/usr/bin/env node
// unified-mcp-server.mjs — config-driven MCP stdio server
// Implements raw JSON-RPC stdio (no SDK dependency)
// Wraps multiple CLI providers as MCP tools, driven by providers.json
//
// Modes:
//   default         — exposes all providers as slot-named tools (unified-1 usage)
//   PROVIDER_SLOT=X — exposes only provider X with its original tool names

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';
import https from 'https';
import http from 'http';
import os from 'os';

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

// ─── PROVIDER_SLOT mode detection ─────────────────────────────────────────────
const SLOT = process.env.PROVIDER_SLOT ?? null;
const slotProvider = SLOT ? providers.find(p => p.name === SLOT) : null;

if (SLOT && !slotProvider) {
  process.stderr.write(`[unified-mcp-server] Unknown PROVIDER_SLOT: ${SLOT}\n`);
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

// ─── Tool definitions ──────────────────────────────────────────────────────────

/** All-providers mode: one tool per provider using provider name as tool name */
function buildAllProviderTools() {
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

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'The prompt or task to send' },
    timeout_ms: { type: 'number', description: 'Timeout in milliseconds' },
  },
  required: ['prompt'],
};

const NO_ARGS_SCHEMA = { type: 'object', properties: {}, required: [] };

/** PROVIDER_SLOT mode: expose original tool names for the given provider */
function buildSlotTools(provider) {
  const tools = [];

  // Universal: ping
  tools.push({
    name: 'ping',
    description: 'Test connectivity by echoing a message back.',
    inputSchema: {
      type: 'object',
      properties: { prompt: { type: 'string', default: '', description: 'Message to echo' } },
      required: [],
    },
  });

  // Universal: identity
  tools.push({
    name: 'identity',
    description: 'Get server identity: name, version, active LLM model, and MCP server name. Used by QGSD to fingerprint the active quorum team.',
    inputSchema: NO_ARGS_SCHEMA,
  });

  if (provider.type === 'subprocess') {
    // Main tool
    tools.push({
      name: provider.mainTool,
      description: provider.description,
      inputSchema: PROMPT_SCHEMA,
    });

    // Help tool
    tools.push({
      name: 'help',
      description: `Display ${provider.mainTool} CLI help and available options.`,
      inputSchema: NO_ARGS_SCHEMA,
    });

    // Extra tools
    for (const extra of provider.extraTools ?? []) {
      tools.push({
        name: extra.name,
        description: extra.description,
        inputSchema: extra.checkUpdate ? NO_ARGS_SCHEMA : PROMPT_SCHEMA,
      });
    }

    // health_check tool for subprocess providers
    if (provider.health_check_args) {
      tools.push({
        name: 'health_check',
        description: 'Test CLI availability by running a lightweight command (e.g. --version). Returns { healthy, latencyMs, type: "subprocess" }.',
        inputSchema: NO_ARGS_SCHEMA,
      });
    }
  } else if (provider.type === 'ccr') {
    // CCR (Claude Code Router) — proxy binary, exposes same interface as subprocess
    tools.push({
      name: 'ask',
      description: provider.description,
      inputSchema: PROMPT_SCHEMA,
    });
    tools.push({
      name: 'help',
      description: 'Display CCR CLI help and available options.',
      inputSchema: NO_ARGS_SCHEMA,
    });
    if (provider.health_check_args) {
      tools.push({
        name: 'health_check',
        description: 'Test CCR binary availability. Returns { healthy, latencyMs, type: "ccr" }.',
        inputSchema: NO_ARGS_SCHEMA,
      });
    }
  } else if (provider.type === 'http') {
    // claude tool
    tools.push({
      name: 'claude',
      description: 'Execute Claude Code CLI in non-interactive mode for AI assistance',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'The coding task, question, or analysis request' },
          timeout_ms: { type: 'number', description: 'Timeout in milliseconds' },
        },
        required: ['prompt'],
      },
    });

    // health_check tool
    tools.push({
      name: 'health_check',
      description: 'Verify the upstream LLM endpoint is reachable by making a minimal API call. Returns { healthy, latencyMs, model } or { healthy: false, error }.',
      inputSchema: NO_ARGS_SCHEMA,
    });
  }

  return tools;
}

function buildTools() {
  if (slotProvider) return buildSlotTools(slotProvider);
  return buildAllProviderTools();
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

/** Run a subprocess with explicit args (used for help, extraTools) */
async function runSubprocessWithArgs(provider, args, timeoutMs = 30000) {
  const env = { ...process.env, ...(provider.env ?? {}) };

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(provider.cli, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      resolve(`[spawn error: ${err.message}]`);
      return;
    }

    child.stdin.end();
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString().slice(0, 4096); });

    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout || stderr || '(no output)');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[spawn error: ${err.message}]`);
    });
  });
}

/** Run npm view opencode version to check for updates */
async function runCheckUpdate() {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('npm', ['view', 'opencode', 'version'], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve(`[error checking update: ${err.message}]`);
      return;
    }

    child.stdin.end();
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => { child.kill('SIGTERM'); }, 30000);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString().slice(0, 1000); });

    child.on('close', () => {
      clearTimeout(timer);
      resolve(stdout.trim() || stderr || '(no output)');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[error: ${err.message}]`);
    });
  });
}

// ─── HTTP provider execution ───────────────────────────────────────────────────
async function runHttpProvider(provider, toolArgs) {
  const prompt = toolArgs.prompt;
  const timeoutMs = toolArgs.timeout_ms ?? provider.timeout_ms ?? 120000;
  const apiKey = process.env[provider.apiKeyEnv] ?? '';

  const body = JSON.stringify({
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  });

  const url = new URL(provider.baseUrl + '/chat/completions');
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve) => {
    let timedOut = false;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed?.choices?.[0]?.message?.content;
          if (content) {
            resolve(content);
          } else {
            resolve(`[HTTP error: unexpected response shape] ${data.slice(0, 500)}`);
          }
        } catch (e) {
          resolve(`[HTTP error: JSON parse failed] ${data.slice(0, 500)}`);
        }
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      resolve(`[TIMED OUT after ${timeoutMs}ms]`);
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      resolve(`[HTTP request error: ${err.message}]`);
    });

    req.on('close', () => clearTimeout(timer));

    req.write(body);
    req.end();
  });
}

/** Slot-mode HTTP execution: reads ANTHROPIC_BASE_URL/KEY/MODEL from env */
async function runSlotHttpProvider(provider, toolArgs) {
  const effectiveProvider = {
    ...provider,
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? provider.baseUrl,
    model: process.env.CLAUDE_DEFAULT_MODEL ?? provider.model,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    timeout_ms: parseInt(process.env.CLAUDE_MCP_TIMEOUT_MS ?? '0') || provider.timeout_ms,
  };
  return runHttpProvider(effectiveProvider, toolArgs);
}

/** health_check: POST minimal request, return { healthy, latencyMs, model } */
async function runHealthCheck(provider) {
  const baseUrl = process.env.ANTHROPIC_BASE_URL ?? provider.baseUrl;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env[provider.apiKeyEnv] ?? '';
  const model = process.env.CLAUDE_DEFAULT_MODEL ?? provider.model;
  const timeoutMs = parseInt(process.env.CLAUDE_MCP_HEALTH_TIMEOUT_MS ?? '30000');

  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 1,
    stream: false,
  });

  const url = new URL(baseUrl + '/chat/completions');
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  const options = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const startTime = Date.now();

  return new Promise((resolve) => {
    let timedOut = false;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        const latencyMs = Date.now() - startTime;
        try {
          const parsed = JSON.parse(data);
          if (parsed?.choices || parsed?.id) {
            resolve({ healthy: true, latencyMs, model });
          } else if (parsed?.error) {
            resolve({ healthy: false, error: parsed.error.message ?? JSON.stringify(parsed.error), latencyMs });
          } else {
            resolve({ healthy: false, error: `Unexpected response: ${data.slice(0, 200)}`, latencyMs });
          }
        } catch (e) {
          resolve({ healthy: false, error: `JSON parse failed: ${data.slice(0, 200)}`, latencyMs });
        }
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      resolve({ healthy: false, error: `Timed out after ${timeoutMs}ms`, latencyMs: timeoutMs });
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      resolve({ healthy: false, error: err.message, latencyMs: Date.now() - startTime });
    });

    req.on('close', () => clearTimeout(timer));

    req.write(body);
    req.end();
  });
}

/** Build identity JSON for slot mode */
function buildIdentityResult(provider) {
  let version = '0.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    version = pkg.version ?? version;
  } catch (_) { /* ignore */ }

  let model;
  if (provider.type === 'http') {
    model = process.env.CLAUDE_DEFAULT_MODEL ?? provider.model;
  } else {
    // Start with static fallback from providers.json, or binary name
    model = provider.model ?? provider.mainTool ?? provider.cli;
    // Attempt dynamic detection via model_detect config
    if (provider.model_detect?.file && provider.model_detect?.pattern) {
      try {
        const detectPath = provider.model_detect.file.replace(/^~/, os.homedir());
        const content = fs.readFileSync(detectPath, 'utf8');
        const match = content.match(new RegExp(provider.model_detect.pattern, 'm'));
        if (match?.[1]) model = match[1];
      } catch (_) { /* fall through to static value */ }
    }
  }

  return JSON.stringify({
    name: 'unified-mcp-server',
    version,
    slot: provider.name,
    type: provider.type,
    model,
    display_provider: provider.display_provider ?? null,
    provider: provider.description,
    install_method: 'qgsd-monorepo',
  });
}

async function runSubprocessHealthCheck(provider) {
  const args = provider.health_check_args ?? ['--version'];
  const startTime = Date.now();
  const output = await runSubprocessWithArgs(provider, args, 10000);
  const latencyMs = Date.now() - startTime;
  const healthy = !output.startsWith('[spawn error') && !output.startsWith('[TIMED');
  return JSON.stringify({ healthy, latencyMs, type: 'subprocess' });
}

// ─── Slot mode tool dispatcher ────────────────────────────────────────────────
async function handleSlotToolCall(toolName, toolArgs) {
  if (toolName === 'ping') {
    const message = toolArgs.prompt ?? 'pong';
    return `${message} (slot: ${slotProvider.name})`;
  }

  if (toolName === 'identity') {
    return buildIdentityResult(slotProvider);
  }

  if (slotProvider.type === 'subprocess') {
    if (toolName === 'help') {
      return runSubprocessWithArgs(slotProvider, slotProvider.helpArgs ?? ['--help']);
    }

    if (toolName === slotProvider.mainTool) {
      return runProvider(slotProvider, toolArgs);
    }

    const extra = (slotProvider.extraTools ?? []).find(e => e.name === toolName);
    if (extra) {
      if (extra.checkUpdate) return runCheckUpdate();
      // Run with extra's own args_template
      return runProvider({ ...slotProvider, args_template: extra.args_template }, toolArgs);
    }

    if (toolName === 'health_check' && slotProvider.health_check_args) {
      return runSubprocessHealthCheck(slotProvider);
    }
  }

  if (slotProvider.type === 'ccr') {
    if (toolName === 'help') {
      return runSubprocessWithArgs(slotProvider, slotProvider.helpArgs ?? ['--help']);
    }
    if (toolName === 'ask') {
      return runProvider(slotProvider, toolArgs);
    }
    if (toolName === 'health_check' && slotProvider.health_check_args) {
      const result = await runSubprocessHealthCheck(slotProvider);
      // Override type field to 'ccr' for clarity
      try {
        const parsed = JSON.parse(result);
        return JSON.stringify({ ...parsed, type: 'ccr' });
      } catch (_) { return result; }
    }
  }

  if (slotProvider.type === 'http') {
    if (toolName === 'claude') {
      return runSlotHttpProvider(slotProvider, toolArgs);
    }
    if (toolName === 'health_check') {
      return JSON.stringify(await runHealthCheck(slotProvider));
    }
  }

  return null; // unknown tool
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

    // ── PROVIDER_SLOT mode dispatch ──────────────────────────────────────────
    if (slotProvider) {
      let output;
      try {
        output = await handleSlotToolCall(toolName, toolArgs);
      } catch (err) {
        sendResult(id, {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        });
        return;
      }

      if (output === null) {
        sendResult(id, {
          content: [{ type: 'text', text: `Unknown tool in slot ${slotProvider.name}: ${toolName}` }],
          isError: true,
        });
      } else {
        sendResult(id, {
          content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output) }],
          isError: false,
        });
      }
      return;
    }

    // ── All-providers mode dispatch ──────────────────────────────────────────
    const provider = toolMap.get(toolName);

    if (!provider) {
      sendResult(id, {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      });
      return;
    }

    try {
      const output = provider.type === 'http'
        ? await runHttpProvider(provider, toolArgs)
        : await runProvider(provider, toolArgs);
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

// ─── Main entry point (async for keytar bootstrap) ────────────────────────────
async function main() {
  // ─── Keytar API key bootstrap ─────────────────────────────────────────────────
  // If running in PROVIDER_SLOT mode, load the slot's API key from keytar at
  // startup (one keychain access per process — no repeated prompts).
  // Falls back to ANTHROPIC_API_KEY already in process.env (backward-compat).
  if (SLOT && !process.env.ANTHROPIC_API_KEY) {
    const keytarAccount = 'ANTHROPIC_API_KEY_' + SLOT.toUpperCase().replace(/-/g, '_');
    try {
      const { default: keytar } = await import('keytar');
      const secret = await keytar.getPassword('qgsd', keytarAccount);
      if (secret) {
        process.env.ANTHROPIC_API_KEY = secret;
        process.stderr.write(`[unified-mcp-server] Loaded API key for slot ${SLOT} from keychain\n`);
      }
    } catch (e) {
      // keytar unavailable or no entry — continue without it
      process.stderr.write(`[unified-mcp-server] keytar unavailable for slot ${SLOT}: ${e.message}\n`);
    }
  }

  // ─── Stdin line reader ────────────────────────────────────────────────────────
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

  const slotLabel = SLOT ? ` [slot: ${SLOT}]` : ' [all-providers]';
  process.stderr.write(`[unified-mcp-server] started${slotLabel}\n`);
}

main();
