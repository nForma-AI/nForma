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
 * Used by nf-quorum-orchestrator (sub-agent) which cannot access MCP tools.
 *
 * Exit codes: 0 = success, 1 = error (message on stderr)
 */

const { spawn } = require('child_process');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const { resolveCli } = require('./resolve-cli.cjs');

// ─── Utilities ──────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Token sentinel for CLI slots (OBSV-04) ───────────────────────────────────
function appendTokenSentinel(slotName) {
  try {
    const record = JSON.stringify({
      ts:                          new Date().toISOString(),
      session_id:                  null,
      agent_id:                    null,
      slot:                        slotName,
      input_tokens:                null,
      output_tokens:               null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens:     null,
    });
    const pp = require('./planning-paths.cjs');
    const logPath = pp.resolve(findProjectRoot(), 'token-usage');
    fs.appendFileSync(logPath, record + '\n', 'utf8');
  } catch (_) {} // observational — never fails
}

// ─── Telemetry logging for quorum slot dispatch (OBS-01) ─────────────────────
function recordTelemetry(slotName, round, verdict, latencyMs, provider, providerStatus, retryCount, errorType) {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID || 'session-' + Date.now();
    const record = JSON.stringify({
      ts: new Date().toISOString(),
      session_id: sessionId,
      round: parseInt(round, 10) || 0,
      slot: slotName,
      verdict: verdict,
      latency_ms: latencyMs,
      provider: provider,
      provider_status: providerStatus,
      retry_count: retryCount,
      error_type: errorType,
    });
    const pp = require('./planning-paths.cjs');
    const logPath = pp.resolve(findProjectRoot(), 'quorum-rounds', { sessionId });
    fs.appendFileSync(logPath, record + '\n', 'utf8');
  } catch (_) {
    // Fail-open: telemetry errors never block or crash the dispatch
    // Log to stderr for observability, but do not rethrow
    process.stderr.write('[call-quorum-slot] telemetry error (non-fatal): recordTelemetry failed\n');
  }
}

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

function classifyErrorType(msg) {
  if (/usage:|unknown flag|unknown option|invalid flag|unrecognized/i.test(msg)) return 'CLI_SYNTAX';
  if (/TIMEOUT/i.test(msg)) return 'TIMEOUT';
  if (/402|quota|rate.?limit|resource.?exhausted/i.test(msg)) return 'QUOTA';
  if (/401|403|unauthorized|forbidden/i.test(msg)) return 'AUTH';
  if (/service not running|service.?down|not.?started/i.test(msg)) return 'SERVICE_DOWN';
  if (/spawn error/i.test(msg)) return 'SPAWN_ERROR';
  return 'UNKNOWN';
}

function writeFailureLog(slotName, errorMsg, stderrText) {
  try {
    const pp = require('./planning-paths.cjs');
    const logPath = pp.resolve(findProjectRoot(), 'quorum-failures');

    const error_type = classifyErrorType(errorMsg);

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

    // Garbage-collect stale records (older than 60 minutes) to prevent unbounded growth
    const gcCutoff = Date.now() - 60 * 60 * 1000;
    records = records.filter(r => new Date(r.last_seen).getTime() > gcCutoff);

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

// ─── Success recovery: clear failure records when a slot succeeds ────────────
// When a slot successfully completes inference, remove its failure records so
// the next quorum run doesn't skip it. This gives immediate recovery instead
// of waiting for the 30-minute TTL to expire.
function clearFailureOnSuccess(slotName) {
  try {
    const pp = require('./planning-paths.cjs');
    const logPath = pp.resolve(findProjectRoot(), 'quorum-failures');
    if (!fs.existsSync(logPath)) return;
    let records = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    if (!Array.isArray(records)) return;
    const before = records.length;
    records = records.filter(r => r.slot !== slotName);
    if (records.length < before) {
      fs.writeFileSync(logPath, JSON.stringify(records, null, 2), 'utf8');
    }
  } catch (_) { /* recovery logging must never interrupt the primary flow */ }
}

// ─── Retry with exponential backoff (FAIL-01) ───────────────────────────────
function isRetryable(error) {
  const msg = (error && error.message) ? error.message : String(error);

  // Non-retryable errors: fail immediately
  if (/spawn error/i.test(msg)) {
    return false;
  }
  if (/usage:|unknown flag|unknown option|invalid flag|unrecognized/i.test(msg)) {
    return false;
  }

  // Retryable errors: TIMEOUT and network errors
  if (/TIMEOUT/i.test(msg)) {
    return true;
  }
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(msg)) {
    return true;
  }

  // Fail-open: unknown errors are retryable
  return true;
}

async function retryWithBackoff(fn, slotName, maxRetries = 2, delays = [1000, 3000]) {
  let retryAttempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retryCount: retryAttempts };
    } catch (err) {
      const isLastAttempt = attempt >= maxRetries;
      const isNonRetryable = !isRetryable(err);

      // Fail immediately if non-retryable or no more retries
      if (isNonRetryable || isLastAttempt) {
        throw err;
      }

      // Log retry attempt and sleep before next attempt
      const delayMs = delays[attempt] ?? 3000; // default to 3s if delay not specified
      retryAttempts++;
      process.stderr.write(`[call-quorum-slot] retry ${attempt + 1}/${maxRetries} for slot ${slotName} after ${delayMs}ms\n`);
      await sleep(delayMs);
    }
  }
}

// ─── Args ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (f) => { const i = argv.indexOf(f); return i !== -1 && argv[i + 1] ? argv[i + 1] : null; };

const slot      = getArg('--slot');
const _timeoutArg = getArg('--timeout');
// Treat 0 / negative / NaN as "not set" — fall through to provider.quorum_timeout_ms.
// Zero can be passed when the quorum orchestrator LLM fails to compute SLOT_TIMEOUTS,
// causing the process to be killed in ~1 ms and logged as "TIMEOUT after 0ms".
let timeoutMs = _timeoutArg !== null ? parseInt(_timeoutArg, 10) : null;
if (timeoutMs !== null && (isNaN(timeoutMs) || timeoutMs <= 0)) timeoutMs = null;
const roundNum  = getArg('--round');
const spawnCwd  = getArg('--cwd') ?? process.cwd();
const allowedTools = getArg('--allowed-tools'); // EXEC-01: e.g. "Read,Grep,Glob" for review-only slots

if (!slot && require.main === module) {
  process.stderr.write('Usage: echo "<prompt>" | node call-quorum-slot.cjs --slot <name> [--timeout <ms>] [--cwd <dir>]\n');
  process.exit(1);
}

// ─── Find providers.json ───────────────────────────────────────────────────────
function findProviders() {
  const searchPaths = [
    path.join(__dirname, 'providers.json'),                             // same dir (nf-bin)
    path.join(os.homedir(), '.claude', 'nf-bin', 'providers.json'),  // installed fallback
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

// ─── SHELL-ESCAPE-01: Args builder (extracted for testability) ────────────────
function buildSpawnArgs(provider, prompt, allowedToolsFlag) {
  const isCcr = provider.display_type === 'claude-code-router' ||
    ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));

  let args;
  let useStdinPrompt = false;
  if (isCcr) {
    // Strip -p and {prompt} from args — prompt will be piped via stdin
    // to avoid shell interpretation of backticks/$ by ccr's internal shell:true
    args = provider.args_template.filter((a, i, arr) => {
      if (a === '{prompt}') return false;
      if (a === '-p' && arr[i + 1] === '{prompt}') return false;
      return true;
    });
    useStdinPrompt = true;
  } else {
    args = provider.args_template.map(a => (a === '{prompt}' ? prompt : a));
  }

  // EXEC-01: Inject --allowedTools for ccr-based slots when review-only
  if (allowedToolsFlag && isCcr) {
    const dspIdx = args.indexOf('--dangerously-skip-permissions');
    if (dspIdx !== -1) {
      args.splice(dspIdx, 0, '--allowedTools', allowedToolsFlag);
    } else {
      args.push('--allowedTools', allowedToolsFlag);
    }
  }

  return { args, useStdinPrompt, isCcr };
}

// ─── Subprocess dispatch ───────────────────────────────────────────────────────
function runSubprocess(provider, prompt, timeoutMs, allowedToolsFlag) {
  const { args, useStdinPrompt, isCcr } = buildSpawnArgs(provider, prompt, allowedToolsFlag);

  // XPLAT-01: resolve CLI path at dispatch time (once per invocation)
  if (provider.type === 'subprocess' && provider.cli) {
    const bareName = provider.cli.split('/').pop();
    provider.resolvedCli = resolveCli(bareName);
  }

  const env  = { ...process.env, ...(provider.env ?? {}) };

  return new Promise((resolve, reject) => {
    let child;
    try {
      // detached: true creates a new process group — required to kill all descendants
      // (ccr → Claude Code → node, opencode → LLM subprocess, etc.)
      child = spawn(provider.resolvedCli ?? provider.cli, args, { env, cwd: spawnCwd, stdio: ['pipe', 'pipe', 'pipe'], detached: true });
    } catch (err) {
      reject(new Error(`[spawn error: ${err.message}]`));
      return;
    }

    // SHELL-ESCAPE-01: For ccr slots, pipe prompt via stdin to avoid shell interpretation.
    // For all other slots, close stdin immediately (non-interactive).
    if (useStdinPrompt) {
      child.stdin.write(prompt);
      child.stdin.end();
    } else {
      child.stdin.end(); // non-interactive
    }

    let stdout    = '';
    let stderr    = '';
    let timedOut  = false;
    const MAX_BUF = 10 * 1024 * 1024;

    // Kill entire process group, then destroy streams to force 'close' even if
    // grandchildren keep the pipes open (the common case with ccr/opencode).
    const killGroup = () => {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (_) { try { child.kill('SIGTERM'); } catch (_) {} }
      setTimeout(() => {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (_) { try { child.kill('SIGKILL'); } catch (_) {} }
        try { child.stdout.destroy(); } catch (_) {}
        try { child.stderr.destroy(); } catch (_) {}
      }, 2000);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
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

async function runSubprocessWithRotation(provider, prompt, timeoutMs, allowedToolsFlag) {
  const rot      = provider.oauth_rotation;
  const max      = rot.max_retries ?? 3;
  const patterns = rot.retry_on_patterns ?? ['quota', 'resource_exhausted', 'unauthorized', '401', '403'];
  let lastErr    = null;
  let totalRetryCount = 0;

  for (let attempt = 0; attempt <= max; attempt++) {
    if (attempt > 0) {
      process.stderr.write(`[oauth-rotation] attempt ${attempt}/${max} — rotating OAuth account\n`);
      await spawnRotateCmd(rot.rotate_cmd);
    }
    try {
      // Wrap inner call with retry-with-backoff (each oauth attempt gets retry protection)
      const retryResult = await retryWithBackoff(() => runSubprocess(provider, prompt, timeoutMs, allowedToolsFlag), provider.name);
      const out = retryResult.result;
      totalRetryCount = attempt + retryResult.retryCount;
      if (matchesRotationPattern(out, patterns) && attempt < max) {
        lastErr = new Error('quota/auth pattern in output');
        continue;
      }
      return { result: out, retryCount: totalRetryCount };
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

  if (providers.length === 0) {
    process.stderr.write('[call-quorum-slot] No providers configured in providers.json — cannot dispatch slot\n');
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

  // timeoutMs is null when --timeout not passed → fall through to provider.quorum_timeout_ms.
  // provider.timeout_ms (300s) is intentionally last — it's the full session timeout, not quorum.
  // When both are set, take the minimum so provider.quorum_timeout_ms always acts as a hard cap.
  // LTCY-01: latency_budget_ms is the user-configured hard ceiling and always wins when present.
  const latencyBudget = provider.latency_budget_ms ?? null;
  const providerCap = provider.quorum_timeout_ms ?? null;
  let effectiveTimeout;
  if (latencyBudget !== null && latencyBudget > 0) {
    // LTCY-01: latency_budget_ms is the user-configured hard ceiling
    effectiveTimeout = latencyBudget;
    process.stderr.write(`[call-quorum-slot] Using latency_budget_ms=${latencyBudget} for slot ${slot}\n`);
  } else if (timeoutMs !== null && providerCap !== null) {
    effectiveTimeout = Math.min(timeoutMs, providerCap);
  } else {
    effectiveTimeout = timeoutMs ?? providerCap ?? provider.timeout_ms ?? 30000;
  }

  const startMs = Date.now();

  try {
    let result;
    let retryCount = 0;

    if (provider.type === 'subprocess') {
      if (provider.oauth_rotation?.enabled) {
        const retryResult = await runSubprocessWithRotation(provider, prompt, effectiveTimeout, allowedTools);
        result = retryResult.result;
        retryCount = retryResult.retryCount;
      } else {
        const retryResult = await retryWithBackoff(() => runSubprocess(provider, prompt, effectiveTimeout, allowedTools), slot);
        result = retryResult.result;
        retryCount = retryResult.retryCount;
      }
    } else if (provider.type === 'http') {
      const retryResult = await retryWithBackoff(() => runHttp(provider, prompt, effectiveTimeout), slot);
      result = retryResult.result;
      retryCount = retryResult.retryCount;
    } else {
      process.stderr.write(`[call-quorum-slot] Unknown provider type: ${provider.type}\n`);
      writeFailureLog(slot, `Unknown provider type: ${provider.type}`, '');
      appendTokenSentinel(slot);
      const latencyMs = Date.now() - startMs;
      recordTelemetry(slot, roundNum, 'FLAG', latencyMs, provider.provider || provider.name, 'unavailable', 0, 'UNKNOWN_TYPE');
      process.exit(1);
    }

    // Detect non-zero exit code in resolved output (subprocess failures that didn't throw).
    // Pattern: "...\n[exit code N]" appended by runSubprocess on non-zero exit.
    const exitCodeMatch = result.match(/\[exit code (\d+)\]\s*$/);
    if (exitCodeMatch && exitCodeMatch[1] !== '0') {
      const latencyMs = Date.now() - startMs;
      const providerName = provider.provider || provider.name;
      const errorType = classifyErrorType(result);
      recordTelemetry(slot, roundNum, 'FLAG', latencyMs, providerName, 'unavailable', retryCount, errorType);
      writeFailureLog(slot, result, '');
      // Still output the result so quorum-slot-dispatch can parse it
      process.stdout.write(result);
      if (!result.endsWith('\n')) process.stdout.write('\n');
      appendTokenSentinel(slot);
      process.exit(1);
    }

    // Extract verdict from result using regex
    const verdict = (/APPROVE|BLOCK|FLAG/.exec(result) || [])[0] || 'UNKNOWN';
    const latencyMs = Date.now() - startMs;
    const providerName = provider.provider || provider.name;

    recordTelemetry(slot, roundNum, verdict, latencyMs, providerName, 'available', retryCount, null);

    // Slot succeeded — clear any failure records so next quorum run doesn't skip it
    clearFailureOnSuccess(slot);

    process.stdout.write(result);
    if (!result.endsWith('\n')) process.stdout.write('\n');
    appendTokenSentinel(slot);
    process.exit(0);
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const providerName = provider.provider || provider.name;

    const errorType = classifyErrorType(err.message);

    recordTelemetry(slot, roundNum, 'FLAG', latencyMs, providerName, 'unavailable', 0, errorType);

    process.stderr.write(`[call-quorum-slot] ${err.message}\n`);
    writeFailureLog(slot, err.message, '');
    appendTokenSentinel(slot);
    process.exit(1);
  }
}

// Guard main() so require() from tests doesn't trigger process.exit()
if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[call-quorum-slot] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}

// ─── Test exports (SHELL-ESCAPE-01) ──────────────────────────────────────────
module.exports = { buildSpawnArgs };
