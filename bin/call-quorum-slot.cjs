#!/usr/bin/env node
'use strict';

/**
 * call-quorum-slot.cjs — bash-callable quorum slot dispatcher
 *
 * Usage:
 *   echo "<prompt>" | node call-quorum-slot.cjs --slot <name> [--timeout <ms>] [--cwd <dir>]
 *   node call-quorum-slot.cjs --slot <name> [--timeout <ms>] [--cwd <dir>] <<'EOF'
 *   <multi-line prompt>
 *   EOF
 *
 * --cwd <dir>  Set the working directory for spawned CLI processes (defaults to process.cwd()).
 *              Pass the project repo path so CLIs auto-detect the correct git context.
 *
 * Reads providers.json, dispatches to the slot's CLI (subprocess) or HTTP provider,
 * prints the response text to stdout.
 *
 * Used by qgsd-quorum-orchestrator (sub-agent) which cannot access MCP tools.
 *
 * Exit codes: 0 = success, 1 = error (message on stderr)
 */

const { spawn } = require('child_process');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');

// ─── Failure log ───────────────────────────────────────────────────────────────
function findProjectRoot() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function writeFailureLog(slotName, errorMsg, stderrText) {
  try {
    const logPath = path.join(findProjectRoot(), '.planning', 'quorum-failures.json');

    // Classify error type
    let error_type;
    if (/usage:|unknown flag|unknown option|invalid flag|unrecognized/i.test(errorMsg)) {
      error_type = 'CLI_SYNTAX';
    } else if (/TIMEOUT/i.test(errorMsg)) {
      error_type = 'TIMEOUT';
    } else if (/401|403|unauthorized|forbidden/i.test(errorMsg)) {
      error_type = 'AUTH';
    } else {
      error_type = 'UNKNOWN';
    }

    // Extract pattern: first 200 chars of stderrText or errorMsg, strip ANSI codes
    const rawPattern = (stderrText && stderrText.length > 0) ? stderrText : errorMsg;
    const pattern = rawPattern.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 200);

    // Read existing log
    let records = [];
    if (fs.existsSync(logPath)) {
      try {
        records = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        if (!Array.isArray(records)) records = [];
      } catch (_) { records = []; }
    }

    // Update or insert record
    const existing = records.find(r => r.slot === slotName && r.error_type === error_type);
    if (existing) {
      existing.count++;
      existing.last_seen = new Date().toISOString();
    } else {
      records.push({ slot: slotName, error_type, pattern, count: 1, last_seen: new Date().toISOString() });
    }

    fs.writeFileSync(logPath, JSON.stringify(records, null, 2), 'utf8');
  } catch (_) { /* failure logging must never interrupt the primary flow */ }
}

// ─── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (f) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : null; };

const slot      = getArg('--slot');
const timeoutMs = parseInt(getArg('--timeout') ?? '30000', 10);
const spawnCwd  = getArg('--cwd') ?? process.cwd();

if (!slot) {
  process.stderr.write('Usage: echo "<prompt>" | node call-quorum-slot.cjs --slot <name> [--timeout <ms>] [--cwd <dir>]\n');
  process.exit(1);
}

// ─── Find providers.json ───────────────────────────────────────────────────────
function findProviders() {
  const searchPaths = [
    path.join(__dirname, 'providers.json'),                             // same dir (qgsd-bin)
    path.join(os.homedir(), '.claude', 'qgsd-bin', 'providers.json'),  // installed fallback
  ];

  // Also derive path from unified-1 MCP server config in ~/.claude.json
  try {
    const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    const u1args = claudeJson?.mcpServers?.['unified-1']?.args ?? [];
    const serverScript = u1args.find(a => typeof a === 'string' && a.endsWith('unified-mcp-server.mjs'));
    if (serverScript) {
      searchPaths.unshift(path.join(path.dirname(serverScript), 'providers.json'));
    }
  } catch (_) { /* no claude.json — fine */ }

  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8')).providers;
      }
    } catch (_) { /* try next */ }
  }
  return null;
}

// ─── Read stdin ────────────────────────────────────────────────────────────────
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    // If stdin is a TTY (no pipe), resolve immediately with empty string
    if (process.stdin.isTTY) resolve('');
  });
}

// ─── Subprocess dispatch ───────────────────────────────────────────────────────
function runSubprocess(provider, prompt, timeoutMs) {
  const args = provider.args_template.map(a => (a === '{prompt}' ? prompt : a));
  const env  = { ...process.env, ...(provider.env ?? {}) };

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(provider.cli, args, { env, cwd: spawnCwd, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      reject(new Error(`[spawn error: ${err.message}]`));
      return;
    }

    child.stdin.end(); // non-interactive

    let stdout    = '';
    let stderr    = '';
    let timedOut  = false;
    const MAX_BUF = 10 * 1024 * 1024;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => { try { if (!child.killed) child.kill('SIGKILL'); } catch (_) {} }, 5000);
    }, timeoutMs);

    child.stdout.on('data', d => {
      if (stdout.length < MAX_BUF) stdout += d.toString().slice(0, MAX_BUF - stdout.length);
    });
    child.stderr.on('data', d => { stderr += d.toString().slice(0, 4096); });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`TIMEOUT after ${timeoutMs}ms`));
        return;
      }
      const output = stdout || stderr || '(no output)';
      resolve(code !== 0 ? `${output}\n[exit code ${code}]` : output);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`[spawn error: ${err.message}]`));
    });
  });
}

// ─── OAuth account rotation ────────────────────────────────────────────────────
function matchesRotationPattern(text, patterns) {
  const lower = (text ?? '').toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

function spawnRotateCmd(cmdArray) {
  return new Promise((resolve) => {
    const [bin, ...args] = cmdArray;
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('close', (code) => {
      if (code !== 0) process.stderr.write(`[oauth-rotation] ${bin} exited ${code}\n`);
      resolve(); // non-fatal — always attempt retry
    });
    child.on('error', (err) => {
      process.stderr.write(`[oauth-rotation] ${bin} error: ${err.message}\n`);
      resolve(); // non-fatal
    });
  });
}

async function runSubprocessWithRotation(provider, prompt, timeoutMs) {
  const rot      = provider.oauth_rotation;
  const max      = rot.max_retries ?? 3;
  const patterns = rot.retry_on_patterns ?? ['quota', 'resource_exhausted', 'unauthorized', '401', '403'];
  let lastErr    = null;

  for (let attempt = 0; attempt <= max; attempt++) {
    if (attempt > 0) {
      process.stderr.write(`[oauth-rotation] attempt ${attempt}/${max} — rotating OAuth account\n`);
      await spawnRotateCmd(rot.rotate_cmd);
    }
    try {
      const out = await runSubprocess(provider, prompt, timeoutMs);
      if (matchesRotationPattern(out, patterns) && attempt < max) {
        lastErr = new Error('quota/auth pattern in output');
        continue;
      }
      return out;
    } catch (err) {
      if (matchesRotationPattern(err.message, patterns) && attempt < max) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('[oauth-rotation] all attempts exhausted');
}

// ─── Read per-slot env from ~/.claude.json (for HTTP PROVIDER_SLOT pattern) ───
function loadSlotEnv(slotName) {
  try {
    const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    return claudeJson?.mcpServers?.[slotName]?.env ?? {};
  } catch (_) { return {}; }
}

// ─── HTTP dispatch ─────────────────────────────────────────────────────────────
function runHttp(provider, prompt, timeoutMs) {
  // HTTP slots use PROVIDER_SLOT mode: API keys live in ~/.claude.json server env,
  // not in process.env. Load them from there, falling back to process.env.
  const slotEnv = loadSlotEnv(provider.name);
  const apiKey  = slotEnv['ANTHROPIC_API_KEY']
               ?? process.env[provider.apiKeyEnv]
               ?? process.env['ANTHROPIC_API_KEY']
               ?? '';
  const baseUrl = slotEnv['ANTHROPIC_BASE_URL'] ?? provider.baseUrl;
  const model   = slotEnv['CLAUDE_DEFAULT_MODEL'] ?? provider.model;

  const body   = JSON.stringify({
    model:    model,
    messages: [{ role: 'user', content: prompt }],
    stream:   false,
  });

  const url       = new URL(`${baseUrl}/chat/completions`);
  const isHttps   = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  const options   = {
    hostname: url.hostname,
    port:     url.port || (isHttps ? 443 : 80),
    path:     url.pathname + url.search,
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Authorization':  `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    let timedOut = false;

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (timedOut) return;
        clearTimeout(timer);
        try {
          const parsed  = JSON.parse(data);
          const content = parsed?.choices?.[0]?.message?.content;
          if (content) {
            resolve(content);
          } else {
            reject(new Error(`[HTTP error: unexpected response] ${data.slice(0, 500)}`));
          }
        } catch (e) {
          reject(new Error(`[HTTP error: JSON parse failed] ${data.slice(0, 500)}`));
        }
      });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      reject(new Error(`TIMEOUT after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) reject(new Error(`[HTTP request error: ${err.message}]`));
    });

    req.write(body);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const providers = findProviders();
  if (!providers) {
    process.stderr.write('[call-quorum-slot] Could not find providers.json\n');
    process.exit(1);
  }

  const provider = providers.find(p => p.name === slot);
  if (!provider) {
    const names = providers.map(p => p.name).join(', ');
    process.stderr.write(`[call-quorum-slot] Unknown slot: "${slot}". Available: ${names}\n`);
    process.exit(1);
  }

  const prompt = await readStdin();
  if (!prompt) {
    process.stderr.write('[call-quorum-slot] No prompt received on stdin\n');
    process.exit(1);
  }

  const effectiveTimeout = timeoutMs || provider.quorum_timeout_ms || provider.timeout_ms || 30000;

  try {
    let result;
    if (provider.type === 'subprocess') {
      result = provider.oauth_rotation?.enabled
        ? await runSubprocessWithRotation(provider, prompt, effectiveTimeout)
        : await runSubprocess(provider, prompt, effectiveTimeout);
    } else if (provider.type === 'http') {
      result = await runHttp(provider, prompt, effectiveTimeout);
    } else {
      process.stderr.write(`[call-quorum-slot] Unknown provider type: ${provider.type}\n`);
      writeFailureLog(slot, `Unknown provider type: ${provider.type}`, '');
      process.exit(1);
    }

    process.stdout.write(result);
    if (!result.endsWith('\n')) process.stdout.write('\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write(`[call-quorum-slot] ${err.message}\n`);
    writeFailureLog(slot, err.message, '');
    process.exit(1);
  }
}

main().catch(err => {
  process.stderr.write(`[call-quorum-slot] Fatal: ${err.message}\n`);
  process.exit(1);
});
