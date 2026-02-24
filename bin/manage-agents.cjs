#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { spawnSync } = require('child_process');
const inquirer = require('inquirer');
const { resolveCli } = require('./resolve-cli.cjs');
const { updateAgents, getUpdateStatuses } = require('./update-agents.cjs');

const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');
const CLAUDE_JSON_TMP = CLAUDE_JSON_PATH + '.tmp';
const QGSD_JSON_PATH = path.join(os.homedir(), '.claude', 'qgsd.json');
const CCR_CONFIG_PATH = path.join(os.homedir(), '.claude-code-router', 'config.json');

// Provider preset library — hardcoded table (user-extensible presets deferred to v0.11+)
// Source: MEMORY.md Provider Map (2026-02-22)
const PROVIDER_PRESETS = [
  { name: 'AkashML',       value: 'https://api.akashml.com/v1',             label: 'AkashML       (api.akashml.com/v1)' },
  { name: 'Together.xyz',  value: 'https://api.together.xyz/v1',            label: 'Together.xyz  (api.together.xyz/v1)' },
  { name: 'Fireworks.ai',  value: 'https://api.fireworks.ai/inference/v1',  label: 'Fireworks.ai  (api.fireworks.ai/inference/v1)' },
];

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function readClaudeJson() {
  if (!fs.existsSync(CLAUDE_JSON_PATH)) {
    throw new Error(`~/.claude.json not found at ${CLAUDE_JSON_PATH}`);
  }
  try {
    return JSON.parse(fs.readFileSync(CLAUDE_JSON_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`~/.claude.json: ${err.message}`);
  }
}

function writeClaudeJson(data) {
  fs.writeFileSync(CLAUDE_JSON_TMP, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(CLAUDE_JSON_TMP, CLAUDE_JSON_PATH);
}

function getGlobalMcpServers(data) {
  return data.mcpServers || {};
}

// Fetch model list from a provider's /models endpoint (5s timeout, fail-silent)
function fetchProviderModels(baseUrl, apiKey) {
  return new Promise((resolve) => {
    if (!baseUrl) return resolve(null);
    let url;
    try {
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      url = new URL(base + '/models');
    } catch {
      return resolve(null);
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': apiKey ? `Bearer ${apiKey}` : '',
          'Accept': 'application/json',
        },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const list = (parsed.data || parsed.models || [])
              .map((m) => (typeof m === 'string' ? m : m.id))
              .filter(Boolean)
              .sort();
            resolve(list.length ? list : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Probe a provider URL — returns { healthy, latencyMs, statusCode, error }
// Counts HTTP 200/401/403/404/422 as healthy (provider is reachable).
function probeProviderUrl(baseUrl, apiKey) {
  return new Promise((resolve) => {
    if (!baseUrl) return resolve({ healthy: false, latencyMs: 0, statusCode: null, error: 'No URL provided' });
    let url;
    try {
      const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      url = new URL(base + '/models');
    } catch {
      return resolve({ healthy: false, latencyMs: 0, statusCode: null, error: `Invalid URL: ${baseUrl}` });
    }
    const lib = url.protocol === 'https:' ? https : http;
    const start = Date.now();
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': apiKey ? `Bearer ${apiKey}` : '',
          'Accept': 'application/json',
          'User-Agent': 'qgsd-manage-agents/1.0',
        },
        timeout: 7000,
      },
      (res) => {
        const latencyMs = Date.now() - start;
        res.resume();
        res.on('end', () => {
          const healthy = [200, 401, 403, 404, 422].includes(res.statusCode);
          resolve({ healthy, latencyMs, statusCode: res.statusCode, error: null });
        });
      }
    );
    req.on('error', (e) => {
      resolve({ healthy: false, latencyMs: Date.now() - start, statusCode: null, error: e.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ healthy: false, latencyMs: Date.now() - start, statusCode: null, error: 'Timed out after 7000ms' });
    });
    req.end();
  });
}

/**
 * Classify a probeProviderUrl() result into a key validity verdict.
 * probeResult: { healthy: bool, latencyMs: int, statusCode: int|null, error: string|null }
 * Returns: 'ok' | 'invalid' | 'unreachable'
 *
 * Classification table:
 *   healthy=false (or null input)   -> 'unreachable'  (provider DOWN; key validity unknown)
 *   healthy=true, statusCode=401    -> 'invalid'       (provider UP; key rejected)
 *   healthy=true, statusCode!=401   -> 'ok'            (provider UP; key not rejected)
 *
 * Edge case: healthy=true, statusCode=null -> 'ok' (null !== 401 fallthrough).
 * probeProviderUrl only marks healthy=true for [200,401,403,404,422], so this path
 * is theoretically unreachable from production — documented here as an explicit choice.
 *
 * NOTE: 'unreachable' results must NOT be written to key_status in qgsd.json.
 * Preserving the existing key_status on network failure is a design invariant.
 * Pure function — no side effects, no file I/O.
 */
function classifyProbeResult(probeResult) {
  if (!probeResult || !probeResult.healthy) {
    return 'unreachable';
  }
  if (probeResult.statusCode === 401) {
    return 'invalid';
  }
  return 'ok';
}

/**
 * Write key validity status to qgsd.json under agent_config[slotName].key_status.
 * slotName: string — the MCP server slot name (e.g. 'claude-1')
 * status: 'ok' | 'invalid' — classification from classifyProbeResult()
 * filePath: optional — override path for testability (matches readQgsdJson/writeQgsdJson pattern)
 *
 * IMPORTANT: Only call for 'ok' or 'invalid' classifications.
 * Do NOT call for 'unreachable' — preserving the existing key_status on network failure
 * is a design invariant. The caller (checkAgentHealth) is responsible for this guard.
 *
 * Writes: { status: 'ok'|'invalid', checkedAt: '<ISO timestamp>' }
 * Uses read-mutate-write pattern with readQgsdJson/writeQgsdJson (atomic tmp-rename).
 */
function writeKeyStatus(slotName, status, filePath) {
  const qgsd = readQgsdJson(filePath);
  if (!qgsd.agent_config) qgsd.agent_config = {};
  if (!qgsd.agent_config[slotName]) qgsd.agent_config[slotName] = {};
  qgsd.agent_config[slotName].key_status = {
    status,
    checkedAt: new Date().toISOString(),
  };
  writeQgsdJson(qgsd, filePath);
}

/**
 * Format a Date.now() timestamp as HH:MM:SS.
 * Returns '—' if ts is null/undefined/falsy.
 * Pure function — no side effects.
 */
function formatTimestamp(ts) {
  if (!ts) return '\u2014';
  return new Date(ts).toTimeString().slice(0, 8);
}

/**
 * Build the full dashboard display as an array of strings.
 * Pure function — no process.stdout.write, no side effects.
 *
 * slots: string[]             — ordered list of slot names
 * mcpServers: object          — ~/.claude.json mcpServers map
 * healthMap: object           — { [slotName]: probeResult }
 * lastUpdated: number | null  — Date.now() of last refresh, or null
 *
 * Each probeResult: { healthy: bool|null, latencyMs: number, statusCode: number, error: string }
 * Sentinel: { healthy: null, error: 'subprocess' } for subprocess providers
 */
function buildDashboardLines(slots, mcpServers, healthMap, lastUpdated) {
  const lines = [];
  lines.push('  QGSD Live Health Dashboard');
  lines.push('  ' + '\u2500'.repeat(60));
  lines.push('');

  for (const slotName of slots) {
    const cfg = mcpServers[slotName] || {};
    const env = cfg.env || {};
    const model = env.CLAUDE_DEFAULT_MODEL || '\u2014';
    const provider = env.ANTHROPIC_BASE_URL
      ? env.ANTHROPIC_BASE_URL
          .replace(/^https?:\/\//, '')
          .replace(/\/v\d+\/?$/, '')
          .replace(/\/.*$/, '')
      : (cfg.command || '\u2014');

    const probe = healthMap[slotName];
    let status;
    if (!probe) {
      status = '\x1b[90m\u2014\x1b[0m';
    } else if (probe.error === 'subprocess') {
      status = '\x1b[90msubprocess\x1b[0m';
    } else if (probe.healthy) {
      status = '\x1b[32m\u2713 UP (' + probe.latencyMs + 'ms)\x1b[0m';
    } else {
      status = '\x1b[31m\u2717 DOWN\x1b[0m';
    }
    lines.push(
      '  ' +
      slotName.padEnd(14) + ' ' +
      provider.slice(0, 24).padEnd(24) + ' ' +
      model.slice(0, 30).padEnd(30) + ' ' +
      status
    );
  }

  lines.push('');

  const stale = lastUpdated && Date.now() - lastUpdated > 60_000;
  const ts = formatTimestamp(lastUpdated);
  lines.push(
    '  Last updated: ' + ts +
    (stale ? '  \x1b[33m[stale]\x1b[0m' : '')
  );
  lines.push('  [space/r] refresh   [q/Esc] exit');
  return lines;
}

/**
 * Probe a provider URL and loop until healthy or user cancels.
 * Returns true if the probe succeeds, false if the user cancels.
 * On false: caller MUST return immediately — do not write slot.
 */
async function probeWithRetryOrCancel(baseUrl, apiKey) {
  while (true) {
    process.stdout.write(`\n  Probing ${baseUrl} ...`);
    const probe = await probeProviderUrl(baseUrl, apiKey);
    if (probe.healthy) {
      process.stdout.write(`\n  \x1b[32m✓ Provider UP (${probe.latencyMs}ms)\x1b[0m\n`);
      return true;
    }
    process.stdout.write(
      `\n  \x1b[31m✗ Provider DOWN: ${probe.error || probe.statusCode || 'timeout'}\x1b[0m\n`
    );
    const { retryAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'retryAction',
        message: 'Provider probe failed:',
        choices: [
          { name: 'Retry probe', value: 'retry' },
          { name: 'Cancel — do not write slot', value: 'cancel' },
        ],
      },
    ]);
    if (retryAction === 'cancel') {
      console.log('\n  Cancelled.\n');
      return false;
    }
    // retryAction === 'retry' → loop continues
  }
}

// Return a likely upgrade model ID, or null if current is already latest
function detectUpgrade(current, available) {
  if (!current || !available) return null;
  // Match: optional-namespace/Name-VX.Y  or  Name-VX-Y
  const vRe = /^(.*?)[-./]?v?(\d+(?:[._]\d+)?)$/i;
  const cm = current.match(vRe);
  if (!cm) return null;
  const [, cBase, cVer] = cm;
  const cV = parseFloat(cVer.replace('_', '.'));
  let best = null;
  let bestV = cV;
  const prefixLen = Math.max(4, Math.floor(cBase.length * 0.6));
  for (const m of available) {
    const mm = m.match(vRe);
    if (!mm) continue;
    const [, mBase, mVer] = mm;
    if (!mBase.toLowerCase().startsWith(cBase.toLowerCase().slice(0, prefixLen))) continue;
    const mV = parseFloat(mVer.replace('_', '.'));
    if (mV > bestV) { bestV = mV; best = m; }
  }
  return best;
}

// Masked API key for display
function maskKey(key) {
  if (!key) return '(not set)';
  if (key.length <= 12) return '***';
  return key.slice(0, 8) + '...' + key.slice(-4);
}

// Short provider hostname for display
function shortProvider(cfg) {
  if (cfg.env && cfg.env.ANTHROPIC_BASE_URL) {
    return cfg.env.ANTHROPIC_BASE_URL
      .replace(/^https?:\/\//, '')
      .replace(/\/v\d+\/?$/, '')
      .replace(/\/.*$/, '');
  }
  if (cfg.command === 'npx') return 'npx';
  return cfg.command || '—';
}

// ---------------------------------------------------------------------------
// List agents
// ---------------------------------------------------------------------------

async function listAgents() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const entries = Object.entries(mcpServers);

  if (entries.length === 0) {
    console.log('\n  (no agents configured)\n');
    return;
  }

  // Fetch update statuses in parallel (defensive: never throws)
  let updateStatuses = new Map();
  try {
    updateStatuses = await getUpdateStatuses();
  } catch (_) {}

  // Read qgsd.json once for orchestrator config and agent_config
  const qgsd = readQgsdJson();
  let orchestrator = { model: 'claude-sonnet-4-6', provider: 'Anthropic', billing: 'sub' };
  if (qgsd.orchestrator) Object.assign(orchestrator, qgsd.orchestrator);
  let agentConfig = qgsd.agent_config || {};

  // Load quorum scoreboard (DISP-01) — existsSync guard: absent file → null
  let scoreboardData = null;
  const sbPath = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
  if (fs.existsSync(sbPath)) {
    try {
      scoreboardData = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
    } catch (_) {}
  }

  // Load CCR config (DISP-02) — readCcrConfigSafe handles absent file → null
  const ccrConfig = readCcrConfigSafe();

  // Build providers lookup for PROVIDER_SLOT cross-reference
  let providerMap = {};
  try {
    const pdata = readProvidersJson();
    for (const p of (pdata.providers || [])) providerMap[p.name] = p;
  } catch (_) {}

  const W = { n: 3, slot: 14, model: 38, provider: 26, type: 16, billing: 7, upd: 3, wl: 8, ccr: 12 };
  const header = [
    '#'.padEnd(W.n),
    'Slot'.padEnd(W.slot),
    'Model'.padEnd(W.model),
    'Provider'.padEnd(W.provider),
    'Type'.padEnd(W.type),
    'Billing'.padEnd(W.billing),
    'Upd'.padEnd(W.upd),
    'W/L'.padEnd(W.wl),
    'CCR'.padEnd(W.ccr),
    'Timeout',
  ].join('  ');

  console.log('\n  ' + '\x1b[1m' + header + '\x1b[0m');
  console.log('  ' + '─'.repeat(header.length));

  // Slot 0: top-level orchestrator (this Claude Code session)
  const orchRow = [
    '★'.padEnd(W.n),
    'orchestrator'.padEnd(W.slot),
    orchestrator.model.slice(0, W.model).padEnd(W.model),
    orchestrator.provider.slice(0, W.provider).padEnd(W.provider),
    'claude-code-cli'.padEnd(W.type),
    orchestrator.billing.padEnd(W.billing),
    ' — '.padEnd(W.upd),
    '—'.padEnd(W.wl),
    '—'.padEnd(W.ccr),
    '— (active)',
  ].join('  ');
  console.log('  \x1b[1m' + orchRow + '\x1b[0m');
  console.log('  ' + '·'.repeat(header.length));

  entries.forEach(([name, cfg], i) => {
    // Cross-reference providers.json via PROVIDER_SLOT
    const slot = cfg.env && cfg.env.PROVIDER_SLOT;
    const p = slot ? providerMap[slot] : null;

    let model, provider, timeout, connType;

    if (p) {
      model = p.model || p.mainTool || '—';
      provider = p.display_provider || p.name;
      timeout = p.timeout_ms ? (p.timeout_ms / 1000) + 's' : '—';
      if (p.display_type) {
        connType = p.display_type;
      } else if (p.type === 'subprocess') {
        connType = p.cli ? path.basename(p.cli) : (p.mainTool || 'cli');
      } else if (p.type === 'ccr') {
        connType = 'ccr';
      } else {
        connType = 'http';
      }
    } else {
      // Skip the unified all-providers fan-out server — no per-agent info to show
      if (cfg.args && cfg.args.some(a => String(a).includes('unified-mcp-server'))) return;
      // Fallback for old-style entries
      model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || `(${cfg.command || '?'})`;
      provider = shortProvider(cfg);
      timeout = (cfg.env && cfg.env.CLAUDE_MCP_TIMEOUT_MS)
        ? cfg.env.CLAUDE_MCP_TIMEOUT_MS + 'ms'
        : '—';
      connType = cfg.command || '—';
    }

    const authType = (agentConfig[name] && agentConfig[name].auth_type) || '—';
    const billing = authType === 'sub' ? 'sub'
                  : authType === 'api' ? 'api'
                  : authType === 'ccr' ? 'ccr'
                  : '—';

    // Upd column: look up binary name via provider's cli field
    let updCell = '\x1b[2m?\x1b[0m';
    if (p && p.cli) {
      const binName = path.basename(p.cli);
      const upd = updateStatuses.get(binName);
      if (upd) {
        if (upd.status === 'up-to-date')       updCell = '\x1b[2m\u2713\x1b[0m';
        else if (upd.status === 'update-available') updCell = '\x1b[33m\u2191\x1b[0m';
        else                                   updCell = '\x1b[2m?\x1b[0m';
      }
    }

    // W/L column (DISP-01)
    const family = slotToFamily(name);
    const wlCell = getWlDisplay(family, scoreboardData);

    // CCR column (DISP-02) — derive model for this slot
    const slotModel = p ? (p.model || p.mainTool) : (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || null;
    const ccrProvider = getCcrProviderForSlot(slotModel, ccrConfig);
    const ccrCell = ccrProvider || '—';

    // Key-invalid badge (DISP-03) — inline annotation on Slot column
    // badge shows whenever key_status.status === 'invalid' (key was configured at probe time)
    const hasKeyFn = (_) => true;  // if key_status.invalid exists, a key was configured
    const keyBadge = getKeyInvalidBadge(name, agentConfig, hasKeyFn);

    const slotDisplay = (name + keyBadge).padEnd(W.slot);

    const row = [
      String(i + 1).padEnd(W.n),
      slotDisplay,
      model.slice(0, W.model).padEnd(W.model),
      provider.slice(0, W.provider).padEnd(W.provider),
      connType.padEnd(W.type),
      billing.padEnd(W.billing),
      updCell,
      wlCell.padEnd(W.wl),
      ccrCell.slice(0, W.ccr).padEnd(W.ccr),
      timeout,
    ].join('  ');

    console.log('  ' + row);
  });

  console.log('');
}

// ---------------------------------------------------------------------------
// Add agent
// ---------------------------------------------------------------------------

async function addAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const existingSlots = Object.keys(mcpServers);

  // Load secrets module for keytar-based key storage
  let secretsLib = null;
  try { secretsLib = require('./secrets.cjs'); } catch (_) {}

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'slotName',
      message: 'Slot name (e.g. claude-7):',
      validate(val) {
        if (!val || !val.trim()) return 'Required';
        if (/\s/.test(val)) return 'No spaces allowed';
        if (existingSlots.includes(val.trim())) return `"${val.trim()}" already exists`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'command',
      message: 'Command:',
      default: 'node',
    },
    {
      type: 'input',
      name: 'args',
      message: 'Args (comma-separated):',
      default: '',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'ANTHROPIC_API_KEY:',
      mask: '*',
      default: '',
    },
    {
      type: 'input',
      name: 'model',
      message: 'CLAUDE_DEFAULT_MODEL:',
      default: '',
    },
    {
      type: 'input',
      name: 'timeoutMs',
      message: 'CLAUDE_MCP_TIMEOUT_MS:',
      default: '30000',
    },
    {
      type: 'input',
      name: 'providerSlot',
      message: 'PROVIDER_SLOT (default = slot name):',
      default: (a) => a.slotName || '',
    },
  ]);

  // ── Provider preset selector ───────────────────────────────────────────────
  const { presetChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'presetChoice',
      message: 'Provider (select preset or Custom to type URL manually):',
      choices: buildPresetChoices(),
    },
  ]);

  let baseUrl = '';
  if (presetChoice === '__custom__') {
    const { customUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customUrl',
        message: 'ANTHROPIC_BASE_URL:',
        default: '',
      },
    ]);
    baseUrl = customUrl.trim();
  } else {
    baseUrl = presetChoice; // preset value IS the base URL
  }

  const slotName = answers.slotName.trim();
  const argsArr = answers.args
    ? answers.args.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const env = {};
  if (baseUrl) env.ANTHROPIC_BASE_URL = baseUrl;
  // Key stored in keytar only — not written to ~/.claude.json
  if (answers.apiKey.trim() && secretsLib) {
    const keytarAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
    await secretsLib.set('qgsd', keytarAccount, answers.apiKey.trim());
  } else if (answers.apiKey.trim()) {
    // Fallback: write to env if keytar unavailable (graceful degradation)
    env.ANTHROPIC_API_KEY = answers.apiKey.trim();
  }
  if (answers.model.trim()) env.CLAUDE_DEFAULT_MODEL = answers.model.trim();
  if (answers.timeoutMs.trim()) env.CLAUDE_MCP_TIMEOUT_MS = answers.timeoutMs.trim();
  env.PROVIDER_SLOT = answers.providerSlot.trim() || slotName;

  // ── Provider pre-flight check ──────────────────────────────────────────────
  if (baseUrl) {
    const probeOk = await probeWithRetryOrCancel(baseUrl, answers.apiKey.trim());
    if (!probeOk) return;
  }

  data.mcpServers = Object.assign({}, mcpServers, {
    [slotName]: { type: 'stdio', command: answers.command.trim() || 'node', args: argsArr, env },
  });
  writeClaudeJson(data);

  console.log(`\n  \x1b[32m✓ Added "${slotName}"\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Edit agent  (guided: summary card + checkbox + smart model picker)
// ---------------------------------------------------------------------------

async function editAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to edit.\n');
    return;
  }

  // Load secrets module for index-based key existence checks (no keychain prompt)
  let secretsLib = null;
  try { secretsLib = require('./secrets.cjs'); } catch (_) {}

  let agentCfg = {};
  try {
    const qgsdPath = path.join(os.homedir(), '.claude', 'qgsd.json');
    const q = JSON.parse(fs.readFileSync(qgsdPath, 'utf8'));
    agentCfg = q.agent_config || {};
  } catch (_) {}

  // Build provider lookup for model name
  let providerMap = {};
  try { const pd = readProvidersJson(); (pd.providers||[]).forEach(p => { providerMap[p.name]=p; }); } catch(_) {}

  // Agent selector — show model + key status inline
  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select agent to edit:',
      choices: slots.map((name) => {
        const cfg = mcpServers[name];
        const slot = cfg.env && cfg.env.PROVIDER_SLOT;
        const p = slot ? providerMap[slot] : null;
        const model = p ? (p.model || p.mainTool || '—') : ((cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?');
        const authType = agentCfg[name] && agentCfg[name].auth_type;
        let keyStatus;
        if (authType === 'sub') {
          keyStatus = '\x1b[36m[sub]\x1b[0m';
        } else {
          // Derive keytar account: ANTHROPIC_API_KEY_<SLOT_UPPER>
          const account = 'ANTHROPIC_API_KEY_' + name.toUpperCase().replace(/-/g, '_');
          keyStatus = (secretsLib && secretsLib.hasKey(account))
            ? '\x1b[32m[key ✓]\x1b[0m'
            : '\x1b[90m[no key]\x1b[0m';
        }
        return {
          name: `${name.padEnd(14)} ${model.slice(0, 36).padEnd(36)} ${keyStatus}`,
          value: name,
          short: name,
        };
      }),
    },
  ]);

  const existing = mcpServers[slotName];
  const env = existing.env || {};

  // Load key from keytar for display (key is no longer in env block)
  const keytarAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
  let keytarKey = null;
  if (secretsLib) {
    try { keytarKey = await secretsLib.get('qgsd', keytarAccount); } catch (_) {}
  }
  // Use for display: prefer keytar value, fallback to env (legacy)
  const displayKey = keytarKey || env.ANTHROPIC_API_KEY || null;

  // ── Summary card ─────────────────────────────────────────────────────────
  const W = 52;
  const row = (label, value) => {
    const v = String(value || '—').slice(0, W - label.length - 4);
    return `  │  \x1b[90m${label}\x1b[0m  ${v}`;
  };

  console.log(`\n  ┌${'─'.repeat(W + 2)}┐`);
  console.log(`  │  \x1b[1m${slotName}\x1b[0m${' '.repeat(W - slotName.length)}  │`);
  console.log(`  ├${'─'.repeat(W + 2)}┤`);
  console.log(row('Model  ', env.CLAUDE_DEFAULT_MODEL));
  console.log(row('URL    ', env.ANTHROPIC_BASE_URL));
  console.log(row('Key    ', maskKey(displayKey)));
  console.log(row('Timeout', env.CLAUDE_MCP_TIMEOUT_MS ? env.CLAUDE_MCP_TIMEOUT_MS + ' ms' : '—'));
  console.log(row('Slot   ', env.PROVIDER_SLOT));
  console.log(row('Cmd    ', [existing.command, ...(existing.args || [])].join(' ')));

  // ── Performance intel from MCP logs ───────────────────────────────────────
  const reviewLogsPath = path.join(__dirname, 'review-mcp-logs.cjs');
  let perfRow = null;
  try {
    const res = spawnSync('node', [reviewLogsPath, '--json', '--tool', slotName], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if (res.status === 0 && res.stdout) {
      const logData = JSON.parse(res.stdout);
      const stats = logData.serverStats && logData.serverStats[slotName];
      if (stats && stats.totalCalls > 0) {
        const p95s = stats.p95Ms ? (stats.p95Ms / 1000).toFixed(1) + 's' : '—';
        const maxS = stats.maxMs ? (stats.maxMs / 1000).toFixed(1) + 's' : '—';
        const failures = `${stats.failureCount}/${stats.totalCalls}`;
        const suggested = stats.p95Ms
          ? Math.max(15000, Math.ceil(stats.p95Ms * 1.5 / 5000) * 5000)
          : null;
        const suggestedStr = suggested ? `${suggested}ms` : '—';
        perfRow = `p95: ${p95s}  max: ${maxS}  failures: ${failures}  suggested timeout: ${suggestedStr}`;
      }
    }
  } catch (_) {}

  if (perfRow) {
    console.log(row('Perf   ', perfRow));
  }
  console.log(`  └${'─'.repeat(W + 2)}┘\n`);

  // ── Choose what to edit ───────────────────────────────────────────────────
  const { fields } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'fields',
      message: 'What do you want to change?  (space = toggle, enter = confirm)',
      choices: [
        { name: `Model          ${env.CLAUDE_DEFAULT_MODEL ? '\x1b[90m' + env.CLAUDE_DEFAULT_MODEL.slice(0, 32) + '\x1b[0m' : '\x1b[90m(not set)\x1b[0m'}`, value: 'model' },
        { name: `API Key        ${displayKey ? '\x1b[90m' + maskKey(displayKey) + '\x1b[0m' : '\x1b[90m(not set)\x1b[0m'}`, value: 'apiKey' },
        { name: `Base URL       ${env.ANTHROPIC_BASE_URL ? '\x1b[90m' + env.ANTHROPIC_BASE_URL.slice(0, 30) + '\x1b[0m' : '\x1b[90m(not set)\x1b[0m'}`, value: 'baseUrl' },
        { name: `Timeout        ${env.CLAUDE_MCP_TIMEOUT_MS ? '\x1b[90m' + env.CLAUDE_MCP_TIMEOUT_MS + ' ms\x1b[0m' : '\x1b[90m—\x1b[0m'}`, value: 'timeout' },
        { name: `Provider Slot  \x1b[90m${env.PROVIDER_SLOT || slotName}\x1b[0m`, value: 'providerSlot' },
        { name: `Command + Args \x1b[90m${[existing.command, ...(existing.args || [])].join(' ').slice(0, 30)}\x1b[0m`, value: 'command' },
      ],
    },
  ]);

  if (fields.length === 0) {
    console.log('\n  Nothing selected — no changes made.\n');
    return;
  }

  const updates = {};

  // ── Model (with provider fetch + upgrade detection) ───────────────────────
  if (fields.includes('model')) {
    let modelChoices = [
      { name: `Keep current  \x1b[90m${env.CLAUDE_DEFAULT_MODEL || '(none)'}\x1b[0m`, value: '__keep__' },
      new inquirer.Separator('─────────────────────────────────────'),
      { name: 'Enter manually', value: '__manual__' },
    ];

    if (env.ANTHROPIC_BASE_URL) {
      process.stdout.write(`\n  Fetching models from ${shortProvider(existing)}...`);
      const available = await fetchProviderModels(env.ANTHROPIC_BASE_URL, env.ANTHROPIC_API_KEY);

      if (available && available.length) {
        const upgrade = detectUpgrade(env.CLAUDE_DEFAULT_MODEL, available);
        const current = env.CLAUDE_DEFAULT_MODEL;

        if (upgrade) {
          process.stdout.write(` \x1b[33m⬆  upgrade available: ${upgrade}\x1b[0m\n\n`);
        } else {
          process.stdout.write(` \x1b[32m✓  ${available.length} models\x1b[0m\n\n`);
        }

        const fetched = available.map((m) => {
          let label = m;
          if (m === current) label += '  \x1b[90m← current\x1b[0m';
          else if (m === upgrade) label += '  \x1b[33m⬆ upgrade\x1b[0m';
          return { name: label, value: m, short: m };
        });

        modelChoices = [
          { name: `Keep current  \x1b[90m${current || '(none)'}\x1b[0m`, value: '__keep__' },
          new inquirer.Separator(`── ${available.length} models from provider ──`),
          ...fetched,
          new inquirer.Separator('─────────────────────────────────────'),
          { name: 'Enter manually', value: '__manual__' },
        ];
      } else {
        process.stdout.write(' \x1b[90m(unreachable)\x1b[0m\n\n');
      }
    }

    const { modelChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'modelChoice',
        message: 'Select model:',
        choices: modelChoices,
        default: '__keep__',
        pageSize: 20,
      },
    ]);

    if (modelChoice === '__manual__') {
      const { modelManual } = await inquirer.prompt([
        {
          type: 'input',
          name: 'modelManual',
          message: 'Model ID:',
          default: env.CLAUDE_DEFAULT_MODEL || '',
        },
      ]);
      if (modelManual.trim()) updates.model = modelManual.trim();
    } else if (modelChoice !== '__keep__') {
      updates.model = modelChoice;
    }
  }

  // ── API key ───────────────────────────────────────────────────────────────
  if (fields.includes('apiKey')) {
    const hasKey = !!(displayKey || (secretsLib && secretsLib.hasKey(keytarAccount)));
    const { keyAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'keyAction',
        message: hasKey
          ? `API Key — currently set (${maskKey(displayKey)}):`
          : 'API Key — not currently set:',
        choices: [
          { name: hasKey ? 'Keep existing' : 'Leave unset', value: 'keep' },
          { name: 'Set new key', value: 'set' },
          ...(hasKey ? [{ name: 'Remove key', value: 'remove' }] : []),
        ],
      },
    ]);

    if (keyAction === 'set') {
      const { newKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'newKey',
          message: 'New API key:',
          mask: '*',
          validate: (v) => (v && v.trim() ? true : 'Cannot be empty'),
        },
      ]);
      updates.apiKey = newKey.trim();
    } else if (keyAction === 'remove') {
      updates.apiKey = '__REMOVE__';
    }
  }

  // ── Base URL ──────────────────────────────────────────────────────────────
  if (fields.includes('baseUrl')) {
    const currentUrl = env.ANTHROPIC_BASE_URL || '';
    const defaultPreset = findPresetForUrl(currentUrl);

    const { presetChoice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'presetChoice',
        message: 'Provider (select preset, Custom to type URL, or blank to remove):',
        choices: [
          { name: '(remove base URL)', value: '__remove__', short: 'Remove' },
          new inquirer.Separator(),
          ...buildPresetChoices(),
        ],
        default: defaultPreset === '__custom__' ? '__custom__' : defaultPreset,
      },
    ]);

    let newBaseUrl;
    if (presetChoice === '__remove__') {
      newBaseUrl = '';
      updates.baseUrl = '__REMOVE__';
    } else if (presetChoice === '__custom__') {
      const { customUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customUrl',
          message: 'ANTHROPIC_BASE_URL (blank = remove):',
          default: currentUrl,
        },
      ]);
      newBaseUrl = customUrl.trim();
      updates.baseUrl = newBaseUrl || '__REMOVE__';
    } else {
      newBaseUrl = presetChoice;
      updates.baseUrl = newBaseUrl;
    }

    // Provider pre-flight check when a URL is set/changed
    if (newBaseUrl && newBaseUrl !== '__REMOVE__') {
      const apiKeyForProbe = keytarKey || env.ANTHROPIC_API_KEY || updates.apiKey || '';
      const probeOk = await probeWithRetryOrCancel(newBaseUrl, apiKeyForProbe);
      if (!probeOk) return;
      console.log('');
    }
  }

  // ── Timeout ───────────────────────────────────────────────────────────────
  if (fields.includes('timeout')) {
    const { timeoutMs } = await inquirer.prompt([
      {
        type: 'input',
        name: 'timeoutMs',
        message: 'CLAUDE_MCP_TIMEOUT_MS (ms, blank = remove):',
        default: env.CLAUDE_MCP_TIMEOUT_MS || '30000',
        validate: (v) => !v || !isNaN(parseInt(v)) ? true : 'Must be a number',
      },
    ]);
    updates.timeout = timeoutMs.trim() || '__REMOVE__';
  }

  // ── Provider slot ─────────────────────────────────────────────────────────
  if (fields.includes('providerSlot')) {
    const { providerSlot } = await inquirer.prompt([
      {
        type: 'input',
        name: 'providerSlot',
        message: 'PROVIDER_SLOT:',
        default: env.PROVIDER_SLOT || slotName,
      },
    ]);
    updates.providerSlot = providerSlot.trim() || slotName;
  }

  // ── Command + args ────────────────────────────────────────────────────────
  if (fields.includes('command')) {
    const cmdAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'command',
        message: 'Command:',
        default: existing.command || 'node',
      },
      {
        type: 'input',
        name: 'args',
        message: 'Args (comma-separated):',
        default: (existing.args || []).join(', '),
      },
    ]);
    updates.command = cmdAnswers.command.trim() || 'node';
    updates.args = cmdAnswers.args
      ? cmdAnswers.args.split(',').map((a) => a.trim()).filter(Boolean)
      : [];
  }

  // ── Apply updates ─────────────────────────────────────────────────────────
  const newEnv = Object.assign({}, env);

  if ('model' in updates) newEnv.CLAUDE_DEFAULT_MODEL = updates.model;

  if ('apiKey' in updates) {
    if (updates.apiKey === '__REMOVE__') {
      delete newEnv.ANTHROPIC_API_KEY;  // clean up legacy plaintext entry
      if (secretsLib) secretsLib.delete('qgsd', keytarAccount).catch(() => {});
    } else {
      // Store in keytar only — remove plaintext from ~/.claude.json
      delete newEnv.ANTHROPIC_API_KEY;
      if (secretsLib) {
        await secretsLib.set('qgsd', keytarAccount, updates.apiKey);
      } else {
        // Fallback: write plaintext if keytar unavailable
        newEnv.ANTHROPIC_API_KEY = updates.apiKey;
      }
    }
  }

  if ('baseUrl' in updates) {
    if (updates.baseUrl === '__REMOVE__') delete newEnv.ANTHROPIC_BASE_URL;
    else newEnv.ANTHROPIC_BASE_URL = updates.baseUrl;
  }

  if ('timeout' in updates) {
    if (updates.timeout === '__REMOVE__') delete newEnv.CLAUDE_MCP_TIMEOUT_MS;
    else newEnv.CLAUDE_MCP_TIMEOUT_MS = updates.timeout;
  }

  if ('providerSlot' in updates) newEnv.PROVIDER_SLOT = updates.providerSlot;

  const updatedEntry = {
    type: existing.type || 'stdio',
    command: 'command' in updates ? updates.command : existing.command,
    args: 'args' in updates ? updates.args : (existing.args || []),
    env: newEnv,
  };

  data.mcpServers = Object.fromEntries(
    Object.entries(mcpServers).map(([k, v]) => [k, k === slotName ? updatedEntry : v])
  );
  writeClaudeJson(data);

  console.log(`\n  \x1b[32m✓ Updated "${slotName}"\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Remove agent
// ---------------------------------------------------------------------------

async function removeAgent() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to remove.\n');
    return;
  }

  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select agent to remove:',
      choices: slots.map((name) => {
        const cfg = mcpServers[name];
        const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
        return { name: `${name.padEnd(14)} ${model}`, value: name, short: name };
      }),
    },
  ]);

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `\x1b[31mRemove "${slotName}"? This cannot be undone.\x1b[0m`,
      default: false,
    },
  ]);

  if (!confirmed) {
    console.log('\n  Cancelled.\n');
    return;
  }

  data.mcpServers = Object.fromEntries(
    Object.entries(mcpServers).filter(([k]) => k !== slotName)
  );
  writeClaudeJson(data);
  console.log(`\n  \x1b[32m✓ Removed "${slotName}"\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Reorder agents
// ---------------------------------------------------------------------------

async function reorderAgents() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to reorder.\n');
    return;
  }

  console.log('\n  Current order:\n');
  slots.forEach((name, i) => {
    const cfg = mcpServers[name];
    const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
    console.log(`    \x1b[90m${String(i + 1).padStart(2)}.\x1b[0m ${name.padEnd(14)} ${model}`);
  });
  console.log('');

  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select slot to move:',
      choices: slots,
    },
  ]);

  const currentIdx = slots.indexOf(slotName);

  const { newPos } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newPos',
      message: `Move to position (1–${slots.length}):`,
      default: String(currentIdx + 1),
      validate(val) {
        const n = parseInt(val, 10);
        return !isNaN(n) && n >= 1 && n <= slots.length ? true : `Enter 1–${slots.length}`;
      },
    },
  ]);

  const entries = Object.entries(mcpServers);
  const idx = entries.findIndex(([k]) => k === slotName);
  const [entry] = entries.splice(idx, 1);
  entries.splice(parseInt(newPos, 10) - 1, 0, entry);
  data.mcpServers = Object.fromEntries(entries);
  writeClaudeJson(data);

  console.log('\n  \x1b[32m✓ New order:\x1b[0m\n');
  Object.keys(data.mcpServers).forEach((name, i) => {
    const cfg = data.mcpServers[name];
    const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
    console.log(`    \x1b[90m${String(i + 1).padStart(2)}.\x1b[0m ${name.padEnd(14)} ${model}`);
  });
  console.log('');
}

// ---------------------------------------------------------------------------
// Check agent health
// ---------------------------------------------------------------------------

async function checkAgentHealth() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents configured.\n');
    return;
  }

  // Load secrets module for index-based key existence checks (no keychain prompt)
  let secretsLib = null;
  try { secretsLib = require('./secrets.cjs'); } catch (_) {}

  const { slotName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'slotName',
      message: 'Select agent to check:',
      choices: slots.map((name) => {
        const cfg = mcpServers[name];
        const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
        const account = 'ANTHROPIC_API_KEY_' + name.toUpperCase().replace(/-/g, '_');
        const hasKey = !!(cfg.env && cfg.env.ANTHROPIC_API_KEY) || (secretsLib && secretsLib.hasKey(account));
        return {
          name: `${name.padEnd(14)} ${model.slice(0, 36).padEnd(36)} ${hasKey ? '\x1b[32m[key ✓]\x1b[0m' : '\x1b[90m[no key]\x1b[0m'}`,
          value: name,
          short: name,
        };
      }),
    },
  ]);

  const cfg = mcpServers[slotName];
  const env = cfg.env || {};

  if (!env.ANTHROPIC_BASE_URL) {
    console.log(`\n  ${slotName} is a subprocess provider — no HTTP endpoint to probe.\n`);
    return;
  }

  // Resolve API key from keytar, fall back to env (legacy plaintext)
  const healthAccount = 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
  let healthApiKey = env.ANTHROPIC_API_KEY || '';
  if (secretsLib) {
    try {
      const keyed = await secretsLib.get('qgsd', healthAccount);
      if (keyed) healthApiKey = keyed;
    } catch (_) {}
  }

  process.stdout.write(`\n  Probing ${env.ANTHROPIC_BASE_URL} ...`);
  const probe = await probeProviderUrl(env.ANTHROPIC_BASE_URL, healthApiKey);
  const classification = classifyProbeResult(probe);
  if (classification !== 'unreachable') {
    writeKeyStatus(slotName, classification);
  }
  const statusLine = probe.healthy
    ? `\x1b[32m✓ UP (${probe.latencyMs}ms) [${probe.statusCode}]\x1b[0m`
    : `\x1b[31m✗ DOWN [${probe.error || probe.statusCode || 'timeout'}]\x1b[0m`;

  console.log(`\n`);
  console.log(`  Agent:    ${slotName}`);
  console.log(`  Status:   ${statusLine}`);
  console.log(`  URL:      ${env.ANTHROPIC_BASE_URL}`);
  console.log(`  Model:    ${env.CLAUDE_DEFAULT_MODEL || '—'}`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Batch key rotation
// ---------------------------------------------------------------------------

async function batchRotateKeys() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents configured.\n');
    return;
  }

  let secretsLib = null;
  try { secretsLib = require('./secrets.cjs'); } catch (_) {}

  // Step 1: Multi-select slot picker (checkbox — already used in editAgent())
  const { selectedSlots } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'selectedSlots',
      message: 'Select slots to rotate keys for:',
      choices: slots.map((name) => {
        const cfg = mcpServers[name];
        const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
        const account = deriveKeytarAccount(name);
        const hasKey = (secretsLib && secretsLib.hasKey(account)) ||
                       !!(cfg.env && cfg.env.ANTHROPIC_API_KEY);
        return {
          name: `${name.padEnd(14)} ${model.slice(0, 36).padEnd(36)} ${hasKey ? '[key set]' : '[no key]'}`,
          value: name,
          short: name,
        };
      }),
    },
  ]);

  if (selectedSlots.length === 0) {
    console.log('\n  Nothing selected.\n');
    return;
  }

  // Step 2: Sequential for...of rotation loop — NEVER Promise.all
  // Invariant: writeClaudeJson() is called ONCE after the loop, not inside it.
  // Invariant: writeKeyStatus() is NOT called here — key_status is only updated during health probes.
  for (const slotName of selectedSlots) {
    const { newKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'newKey',
        message: `New API key for ${slotName}:`,
        mask: '*',
        validate: (v) => (v && v.trim() ? true : 'Cannot be empty'),
      },
    ]);

    const account = deriveKeytarAccount(slotName);
    if (secretsLib) {
      await secretsLib.set('qgsd', account, newKey.trim());
    } else {
      // Plaintext fallback: accumulate in data.mcpServers — applied in single writeClaudeJson below
      if (!mcpServers[slotName].env) mcpServers[slotName].env = {};
      mcpServers[slotName].env.ANTHROPIC_API_KEY = newKey.trim();
    }

    // Per-slot confirmation BEFORE next prompt (success criteria requirement)
    console.log(`  ${slotName}: key updated`);
  }

  // Step 3: Single writeClaudeJson() after ALL slots processed
  // For keytar path: data.mcpServers is unchanged (keys in keychain only)
  // For plaintext fallback: data.mcpServers.env.ANTHROPIC_API_KEY was mutated above
  writeClaudeJson(data);
  console.log(`\n  \x1b[32m✓ ${selectedSlots.length} slot(s) updated\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Subprocess provider helpers (providers.json)
// ---------------------------------------------------------------------------

const PROVIDERS_JSON_PATH = path.join(__dirname, 'providers.json');
const PROVIDERS_JSON_TMP = PROVIDERS_JSON_PATH + '.tmp';

function readProvidersJson() {
  if (!fs.existsSync(PROVIDERS_JSON_PATH)) {
    return { providers: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(PROVIDERS_JSON_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`providers.json: ${err.message}`);
  }
}

function writeProvidersJson(data) {
  fs.writeFileSync(PROVIDERS_JSON_TMP, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(PROVIDERS_JSON_TMP, PROVIDERS_JSON_PATH);
}

// ---------------------------------------------------------------------------
// Add subprocess provider
// ---------------------------------------------------------------------------

async function addSubprocessProvider() {
  const data = readProvidersJson();
  const providers = data.providers || [];
  const existingNames = providers.map((p) => p.name);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Provider name (e.g. codex-3):',
      validate(val) {
        if (!val || !val.trim()) return 'Required';
        if (/\s/.test(val)) return 'No spaces allowed';
        if (existingNames.includes(val.trim())) return `"${val.trim()}" already exists`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'cli',
      message: 'CLI name or full path (e.g. codex):',
      validate(val) {
        if (!val || !val.trim()) return 'Required';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: '',
    },
    {
      type: 'input',
      name: 'mainTool',
      message: 'Main tool name (e.g. codex):',
      default: (a) => a.name ? a.name.replace(/-\d+$/, '') : '',
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model ID:',
      default: '',
    },
    {
      type: 'input',
      name: 'args_template',
      message: 'Args template (comma-separated, use {prompt} placeholder):',
      default: 'exec,{prompt}',
    },
    {
      type: 'input',
      name: 'timeout_ms',
      message: 'Timeout (ms):',
      default: '300000',
      validate: (v) => !v || !isNaN(parseInt(v)) ? true : 'Must be a number',
    },
    {
      type: 'input',
      name: 'quorum_timeout_ms',
      message: 'Quorum timeout (ms):',
      default: '30000',
      validate: (v) => !v || !isNaN(parseInt(v)) ? true : 'Must be a number',
    },
  ]);

  const cliRaw = answers.cli.trim();
  let resolvedCli = cliRaw;

  // Auto-resolve bare names (no path separator)
  if (!cliRaw.includes('/')) {
    resolvedCli = resolveCli(cliRaw);
    if (resolvedCli !== cliRaw) {
      console.log(`  Resolved: ${resolvedCli}`);
    } else {
      console.log(`  Could not resolve "${cliRaw}" — will use as-is (bare name fallback)`);
    }
  }

  const argsTemplate = answers.args_template
    ? answers.args_template.split(',').map((a) => a.trim()).filter(Boolean)
    : ['exec', '{prompt}'];

  const entry = {
    name: answers.name.trim(),
    type: 'subprocess',
    description: answers.description.trim() || `Execute ${answers.mainTool || answers.name} CLI non-interactively`,
    mainTool: answers.mainTool.trim() || answers.name.trim().replace(/-\d+$/, ''),
    model: answers.model.trim() || '',
    cli: resolvedCli,
    args_template: argsTemplate,
    helpArgs: ['--help'],
    health_check_args: ['--version'],
    extraTools: [],
    timeout_ms: parseInt(answers.timeout_ms, 10) || 300000,
    quorum_timeout_ms: parseInt(answers.quorum_timeout_ms, 10) || 30000,
    env: {},
  };

  providers.push(entry);
  data.providers = providers;
  writeProvidersJson(data);

  console.log(`\n  \x1b[32m✓ Added subprocess provider "${entry.name}" with cli: ${resolvedCli}\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Edit subprocess provider
// ---------------------------------------------------------------------------

async function editSubprocessProvider() {
  const data = readProvidersJson();
  const providers = data.providers || [];
  const subProviders = providers.filter((p) => p.type === 'subprocess');

  if (subProviders.length === 0) {
    console.log('\n  No subprocess providers found in providers.json.\n');
    return;
  }

  const { providerName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'providerName',
      message: 'Select subprocess provider to edit:',
      choices: subProviders.map((p) => ({
        name: `${p.name.padEnd(16)} ${(p.model || '—').slice(0, 36).padEnd(36)} cli: ${p.cli || '—'}`,
        value: p.name,
        short: p.name,
      })),
    },
  ]);

  const existing = providers.find((p) => p.name === providerName);
  if (!existing) {
    console.log('\n  Provider not found.\n');
    return;
  }

  // Summary card
  const W = 60;
  console.log(`\n  ┌${'─'.repeat(W + 2)}┐`);
  console.log(`  │  \x1b[1m${providerName}\x1b[0m${' '.repeat(Math.max(0, W - providerName.length))}  │`);
  console.log(`  ├${'─'.repeat(W + 2)}┤`);
  const rowFn = (label, value) => {
    const v = String(value || '—').slice(0, W - label.length - 4);
    return `  │  \x1b[90m${label}\x1b[0m  ${v}`;
  };
  console.log(rowFn('CLI    ', existing.cli));
  console.log(rowFn('Model  ', existing.model));
  console.log(rowFn('Args   ', (existing.args_template || []).join(' ')));
  console.log(rowFn('Timeout', existing.timeout_ms ? existing.timeout_ms + 'ms' : '—'));
  console.log(`  └${'─'.repeat(W + 2)}┘\n`);

  const { fields } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'fields',
      message: 'What do you want to change?  (space = toggle, enter = confirm)',
      choices: [
        { name: `CLI            \x1b[90m${existing.cli || '(not set)'}\x1b[0m`, value: 'cli' },
        { name: `Model          \x1b[90m${existing.model || '(not set)'}\x1b[0m`, value: 'model' },
        { name: `Description    \x1b[90m${(existing.description || '').slice(0, 40)}\x1b[0m`, value: 'description' },
        { name: `Args template  \x1b[90m${(existing.args_template || []).join(',')}\x1b[0m`, value: 'args_template' },
        { name: `Timeout        \x1b[90m${existing.timeout_ms || 300000}ms\x1b[0m`, value: 'timeout_ms' },
        { name: `Quorum timeout \x1b[90m${existing.quorum_timeout_ms || 30000}ms\x1b[0m`, value: 'quorum_timeout_ms' },
      ],
    },
  ]);

  if (fields.length === 0) {
    console.log('\n  Nothing selected — no changes made.\n');
    return;
  }

  const updates = {};

  if (fields.includes('cli')) {
    const { cliVal } = await inquirer.prompt([
      {
        type: 'input',
        name: 'cliVal',
        message: 'CLI name or full path:',
        default: existing.cli || '',
      },
    ]);
    const cliRaw = cliVal.trim();
    if (cliRaw && !cliRaw.includes('/')) {
      const resolved = resolveCli(cliRaw);
      if (resolved !== cliRaw) {
        console.log(`  Resolved: ${resolved}`);
      }
      updates.cli = resolved;
    } else {
      updates.cli = cliRaw || existing.cli;
    }
  }

  if (fields.includes('model')) {
    const { model } = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: 'Model ID:',
        default: existing.model || '',
      },
    ]);
    updates.model = model.trim();
  }

  if (fields.includes('description')) {
    const { description } = await inquirer.prompt([
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: existing.description || '',
      },
    ]);
    updates.description = description.trim();
  }

  if (fields.includes('args_template')) {
    const { args_template } = await inquirer.prompt([
      {
        type: 'input',
        name: 'args_template',
        message: 'Args template (comma-separated):',
        default: (existing.args_template || []).join(','),
      },
    ]);
    updates.args_template = args_template
      ? args_template.split(',').map((a) => a.trim()).filter(Boolean)
      : existing.args_template;
  }

  if (fields.includes('timeout_ms')) {
    const { timeout_ms } = await inquirer.prompt([
      {
        type: 'input',
        name: 'timeout_ms',
        message: 'Timeout (ms):',
        default: String(existing.timeout_ms || 300000),
        validate: (v) => !isNaN(parseInt(v)) ? true : 'Must be a number',
      },
    ]);
    updates.timeout_ms = parseInt(timeout_ms, 10);
  }

  if (fields.includes('quorum_timeout_ms')) {
    const { quorum_timeout_ms } = await inquirer.prompt([
      {
        type: 'input',
        name: 'quorum_timeout_ms',
        message: 'Quorum timeout (ms):',
        default: String(existing.quorum_timeout_ms || 30000),
        validate: (v) => !isNaN(parseInt(v)) ? true : 'Must be a number',
      },
    ]);
    updates.quorum_timeout_ms = parseInt(quorum_timeout_ms, 10);
  }

  // Apply updates
  const updated = Object.assign({}, existing, updates);
  const updatedProviders = providers.map((p) => p.name === providerName ? updated : p);
  data.providers = updatedProviders;
  writeProvidersJson(data);

  console.log(`\n  \x1b[32m✓ Updated "${providerName}"\x1b[0m\n`);
}

// ---------------------------------------------------------------------------
// Manage CCR provider keys
// ---------------------------------------------------------------------------

const CCR_KEY_NAMES = [
  { key: 'AKASHML_API_KEY',   label: 'AkashML API Key'     },
  { key: 'TOGETHER_API_KEY',  label: 'Together.xyz API Key' },
  { key: 'FIREWORKS_API_KEY', label: 'Fireworks API Key'    },
];

async function manageCcrProviders() {
  // Lazy-load secretsLib
  let secretsLib = null;
  const secretsCandidates = [
    path.join(os.homedir(), '.claude', 'qgsd-bin', 'secrets.cjs'),
    path.join(__dirname, 'secrets.cjs'),
  ];
  for (const p of secretsCandidates) {
    try {
      if (fs.existsSync(p)) {
        secretsLib = require(p);
        break;
      }
    } catch (_) {}
  }
  if (!secretsLib) {
    console.error('\n  \x1b[31mError: secrets.cjs not found — QGSD may not be installed.\x1b[0m\n');
    return;
  }

  const { subAction } = await inquirer.prompt([
    {
      type: 'list',
      name: 'subAction',
      message: 'Manage CCR Provider Keys',
      choices: [
        { name: 'Set / update a key', value: 'set' },
        { name: 'View stored keys (masked)', value: 'view' },
        { name: 'Remove a key', value: 'remove' },
        new inquirer.Separator(),
        { name: 'Back', value: 'back' },
      ],
    },
  ]);

  if (subAction === 'back') return;

  if (subAction === 'view') {
    console.log('\n  CCR Provider Keys:\n');
    for (const { key, label } of CCR_KEY_NAMES) {
      const value = await secretsLib.get('qgsd', key);
      let display;
      if (value && value.length > 10) {
        display = value.slice(0, 6) + '...' + value.slice(-4);
      } else if (value) {
        display = value.slice(0, 2) + '...' + value.slice(-2);
      } else {
        display = '\x1b[2m(not set)\x1b[0m';
      }
      console.log('  ' + label + ': ' + display);
    }
    console.log('');
    return;
  }

  // 'set' or 'remove' — pick which key
  const { selectedKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedKey',
      message: subAction === 'set' ? 'Which key to set?' : 'Which key to remove?',
      choices: CCR_KEY_NAMES.map((k) => ({ name: k.label, value: k.key })),
    },
  ]);

  if (subAction === 'set') {
    const { keyValue } = await inquirer.prompt([
      {
        type: 'password',
        name: 'keyValue',
        message: 'Enter value for ' + selectedKey + ':',
        mask: '*',
      },
    ]);
    const trimmed = keyValue.trim();
    if (!trimmed) {
      console.log('\n  \x1b[33m⚠ Empty value — key not stored.\x1b[0m\n');
      return;
    }
    await secretsLib.set('qgsd', selectedKey, trimmed);
    console.log('\n  \x1b[32m✓ ' + selectedKey + ' stored in keytar.\x1b[0m\n');
  } else if (subAction === 'remove') {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Remove ' + selectedKey + ' from keytar?',
        default: false,
      },
    ]);
    if (confirmed) {
      await secretsLib.delete('qgsd', selectedKey);
      console.log('\n  \x1b[33m✓ ' + selectedKey + ' removed.\x1b[0m\n');
    } else {
      console.log('\n  Cancelled.\n');
    }
  }
}

// ---------------------------------------------------------------------------
// Clone slot
// ---------------------------------------------------------------------------

async function cloneSlot() {
  const data = readClaudeJson();
  const mcpServers = getGlobalMcpServers(data);
  const slots = Object.keys(mcpServers);

  if (slots.length === 0) {
    console.log('\n  No agents to clone.\n');
    return;
  }

  let secretsLib = null;
  try { secretsLib = require('./secrets.cjs'); } catch (_) {}

  // Step 1: Select source slot
  const { sourceSlot } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sourceSlot',
      message: 'Select slot to clone:',
      choices: slots.map((name) => {
        const cfg = mcpServers[name];
        const model = (cfg.env && cfg.env.CLAUDE_DEFAULT_MODEL) || cfg.command || '?';
        const url = (cfg.env && cfg.env.ANTHROPIC_BASE_URL) || '\u2014';
        const shortUrl = url.replace(/^https?:\/\//, '').slice(0, 30);
        return { name: `${name.padEnd(14)} ${model.slice(0, 28).padEnd(28)} (${shortUrl})`, value: name, short: name };
      }),
    },
  ]);

  // Step 2: New slot name (unique, no spaces)
  const { newSlotName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'newSlotName',
      message: 'New slot name:',
      validate(val) {
        if (!val || !val.trim()) return 'Required';
        if (/\s/.test(val)) return 'No spaces allowed';
        if (slots.includes(val.trim())) return `"${val.trim()}" already exists`;
        return true;
      },
    },
  ]);

  const newName = newSlotName.trim();
  const sourceCfg = mcpServers[sourceSlot];

  // Step 3: Build new entry using pure function (ANTHROPIC_API_KEY excluded)
  const newEntry = buildCloneEntry(sourceCfg, newName);

  // Step 4: Optional API key for new slot (keytar-isolated — never reads source key)
  const { setKey } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setKey',
      message: `Set an API key for the new slot "${newName}"?`,
      default: false,
    },
  ]);

  if (setKey) {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `API key for ${newName}:`,
        mask: '*',
        validate: (v) => (v && v.trim() ? true : 'Cannot be empty'),
      },
    ]);
    const newAccount = deriveKeytarAccount(newName);
    if (secretsLib) {
      await secretsLib.set('qgsd', newAccount, apiKey.trim());
    } else {
      // Fallback: plaintext if keytar unavailable
      newEntry.env.ANTHROPIC_API_KEY = apiKey.trim();
    }
  }
  // If setKey === false: slot has no key — shows [no key] in listAgents()

  // Step 5: Write new slot
  data.mcpServers = Object.assign({}, mcpServers, { [newName]: newEntry });
  writeClaudeJson(data);

  if (setKey) {
    console.log(`\n  \x1b[32m✓ Cloned "${sourceSlot}" → "${newName}" (key set)\x1b[0m\n`);
  } else {
    console.log(`\n  \x1b[32m✓ Cloned "${sourceSlot}" → "${newName}" \x1b[90m[no key]\x1b[0m\n`);
  }
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------

async function mainMenu() {
  let running = true;
  while (running) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'QGSD Agent Manager — ~/.claude.json mcpServers',
        choices: [
          { name: '1. List agents', value: 'list' },
          { name: '2. Add agent', value: 'add' },
          { name: '3. Clone slot', value: 'clone' },
          { name: '4. Edit agent', value: 'edit' },
          { name: '5. Remove agent', value: 'remove' },
          { name: '6. Reorder agents', value: 'reorder' },
          { name: '7. Check agent health', value: 'health' },
          new inquirer.Separator(),
          { name: '8. Add subprocess provider', value: 'add-sub' },
          { name: '9. Edit subprocess provider', value: 'edit-sub' },
          new inquirer.Separator(),
          { name: '10. Manage CCR provider keys', value: 'ccr-keys' },
          new inquirer.Separator(),
          { name: '11. Batch rotate keys', value: 'batch-rotate' },
          new inquirer.Separator(),
          { name: '12. Update coding agents', value: 'update-agents' },
          new inquirer.Separator(),
          { name: '0. Exit', value: 'exit' },
        ],
      },
    ]);

    try {
      if (action === 'list') await listAgents();
      else if (action === 'add') await addAgent();
      else if (action === 'clone') await cloneSlot();
      else if (action === 'edit') await editAgent();
      else if (action === 'remove') await removeAgent();
      else if (action === 'reorder') await reorderAgents();
      else if (action === 'health') await checkAgentHealth();
      else if (action === 'add-sub') await addSubprocessProvider();
      else if (action === 'edit-sub') await editSubprocessProvider();
      else if (action === 'ccr-keys') await manageCcrProviders();
      else if (action === 'batch-rotate') await batchRotateKeys();
      else if (action === 'update-agents') await updateAgents();
      else if (action === 'exit') { running = false; console.log('\n  Goodbye!\n'); }
    } catch (err) {
      console.error(`\n  \x1b[31mError: ${err.message}\x1b[0m\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  mainMenu().catch((err) => {
    console.error('\x1b[31mFatal:\x1b[0m', err.message);
    process.exit(1);
  });
}

module.exports = { readClaudeJson, writeClaudeJson, getGlobalMcpServers, mainMenu };

// ---------------------------------------------------------------------------
// Pure functions (exported via _pure for testing)
// ---------------------------------------------------------------------------

/**
 * Derive the keytar account string for a given slot name.
 * e.g. 'claude-7' -> 'ANTHROPIC_API_KEY_CLAUDE_7'
 */
function deriveKeytarAccount(slotName) {
  return 'ANTHROPIC_API_KEY_' + slotName.toUpperCase().replace(/-/g, '_');
}

/**
 * Build the ANSI-tagged key-status display for a slot.
 * authType: 'sub' | 'api' | 'ccr' | undefined/null
 * slotName: string
 * secretsLib: object with hasKey(account) -> boolean, or null
 */
function buildKeyStatus(authType, slotName, secretsLib) {
  if (authType === 'sub') return '\x1b[36m[sub]\x1b[0m';
  const account = deriveKeytarAccount(slotName);
  if (secretsLib && secretsLib.hasKey(account)) return '\x1b[32m[key \u2713]\x1b[0m';
  return '\x1b[90m[no key]\x1b[0m';
}

/**
 * Build the padded display string for an agent choice in the selector.
 * name: string slot name
 * cfg: mcp server config object (may have env.PROVIDER_SLOT, env.CLAUDE_DEFAULT_MODEL, command)
 * providerMap: object mapping slot -> provider entry (may have model, mainTool)
 * agentCfg: object mapping slot -> { auth_type } (from qgsd.json agent_config)
 * secretsLib: object with hasKey(account) -> boolean, or null
 */
function buildAgentChoiceLabel(name, cfg, providerMap, agentCfg, secretsLib) {
  cfg = cfg || {};
  const env = cfg.env || {};
  providerMap = providerMap || {};
  agentCfg = agentCfg || {};

  const slot = env.PROVIDER_SLOT;
  const p = slot ? providerMap[slot] : null;
  let model;
  if (p) {
    model = p.model || p.mainTool || '\u2014';
  } else {
    model = env.CLAUDE_DEFAULT_MODEL || cfg.command || '?';
  }

  const authType = agentCfg[name] && agentCfg[name].auth_type;
  const keyStatus = buildKeyStatus(authType, name, secretsLib);

  return `${name.padEnd(14)} ${model.slice(0, 36).padEnd(36)} ${keyStatus}`;
}

/**
 * Apply API key update to newEnv, firing keytar calls as fire-and-forget.
 * updates: object that may contain apiKey key
 * keytarAccount: string (keytar account for this slot)
 * newEnv: plain object (mutated in-place)
 * secretsLib: object with set/delete methods, or null
 * Returns: newEnv
 */
function applyKeyUpdate(updates, keytarAccount, newEnv, secretsLib) {
  if (!('apiKey' in updates)) return newEnv;
  if (updates.apiKey === '__REMOVE__') {
    delete newEnv.ANTHROPIC_API_KEY;
    if (secretsLib) secretsLib.delete('qgsd', keytarAccount);
  } else {
    delete newEnv.ANTHROPIC_API_KEY;
    if (secretsLib) {
      secretsLib.set('qgsd', keytarAccount, updates.apiKey);
    } else {
      newEnv.ANTHROPIC_API_KEY = updates.apiKey;
    }
  }
  return newEnv;
}

/**
 * Apply CCR provider key set/remove via secretsLib.
 * subAction: 'set' | 'remove'
 * selectedKey: string (e.g. 'AKASHML_API_KEY')
 * keyValue: string (used only for 'set')
 * secretsLib: object with set/delete methods
 * Returns Promise<{action, key}> or Promise<null>
 */
async function applyCcrProviderUpdate(subAction, selectedKey, keyValue, secretsLib) {
  if (subAction === 'set') {
    await secretsLib.set('qgsd', selectedKey, keyValue);
    return { action: 'set', key: selectedKey };
  }
  if (subAction === 'remove') {
    await secretsLib.delete('qgsd', selectedKey);
    return { action: 'remove', key: selectedKey };
  }
  return null;
}

/**
 * Read ~/.claude/qgsd.json safely. Returns {} on absent or invalid JSON.
 * filePath: optional override for testability (defaults to QGSD_JSON_PATH)
 */
function readQgsdJson(filePath) {
  const p = filePath || QGSD_JSON_PATH;
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return {};
  }
}

/**
 * Write data to ~/.claude/qgsd.json atomically via tmp-rename.
 * filePath: optional override for testability (defaults to QGSD_JSON_PATH)
 */
function writeQgsdJson(data, filePath) {
  const p = filePath || QGSD_JSON_PATH;
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

/**
 * Extract the family name from a slot name by stripping the trailing numeric suffix.
 * e.g. 'claude-3' -> 'claude', 'gemini-1' -> 'gemini', 'no-suffix' -> 'no-suffix'
 */
function slotToFamily(slotName) {
  return slotName.replace(/-\d+$/, '');
}

/**
 * Format the win/loss display from scoreboard data.
 * family: string (e.g. 'claude', 'gemini')
 * scoreboardData: object with .models[family].{tp, fn}, or null
 * Returns '—' when data is absent, 'NNW/NNL' when present.
 */
function getWlDisplay(family, scoreboardData) {
  if (!scoreboardData) return '\u2014';
  const entry = scoreboardData.models && scoreboardData.models[family];
  if (!entry) return '\u2014';
  return String(entry.tp || 0) + 'W/' + String(entry.fn || 0) + 'L';
}

/**
 * Read the Claude Code Router config file safely.
 * ccrConfigPath: optional override for testability (defaults to CCR_CONFIG_PATH)
 * Returns parsed object on success, null on absent or invalid JSON.
 */
function readCcrConfigSafe(ccrConfigPath) {
  const p = ccrConfigPath || CCR_CONFIG_PATH;
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

/**
 * Find the CCR provider name for a given model.
 * model: string (e.g. 'claude-sonnet-4-6'), or null
 * ccrConfig: parsed CCR config object with .providers[], or null
 * Returns provider name string, or null if not found.
 */
function getCcrProviderForSlot(model, ccrConfig) {
  if (!ccrConfig || !model) return null;
  for (const provider of (ccrConfig.providers || [])) {
    if ((provider.models || []).includes(model)) {
      return provider.name;
    }
  }
  return null;
}

/**
 * Return ' [key invalid]' badge if the slot has an invalid key configured.
 * slotName: string
 * agentConfig: object mapping slotName -> { key_status: { status } }
 * hasKeyFn: function(slotName) -> boolean (dependency-injected for testability)
 * Returns ' [key invalid]' or ''.
 */
function getKeyInvalidBadge(slotName, agentConfig, hasKeyFn) {
  const slotCfg = agentConfig && agentConfig[slotName];
  if (!slotCfg) return '';
  const ks = slotCfg.key_status;
  if (!ks || ks.status !== 'invalid') return '';
  if (!hasKeyFn || !hasKeyFn(slotName)) return '';
  return ' [key invalid]';
}

/**
 * Build inquirer list choices for the provider preset selector.
 * Returns choice array: 3 preset entries + Separator + Custom option.
 * Pure function — no side effects.
 */
function buildPresetChoices() {
  return [
    ...PROVIDER_PRESETS.map((p) => ({
      name: p.label,
      value: p.value,
      short: p.name,
    })),
    new inquirer.Separator(),
    { name: 'Custom (enter URL manually)', value: '__custom__', short: 'Custom' },
  ];
}

/**
 * Reverse lookup: given a base URL, return the matching preset value or '__custom__'.
 * url: string | null | undefined
 * Returns the preset value string (same as the URL) if found, otherwise '__custom__'.
 * Pure function — no side effects.
 */
function findPresetForUrl(url) {
  if (!url) return '__custom__';
  const found = PROVIDER_PRESETS.find((p) => p.value === url);
  return found ? found.value : '__custom__';
}

/**
 * Build a new MCP server entry for a cloned slot.
 * sourceCfg: the source slot's config object (type, command, args, env)
 * newName: the new slot name (string)
 * Returns a new config entry with provider/model fields copied and ANTHROPIC_API_KEY excluded.
 * PROVIDER_SLOT is explicitly set to newName. Pure function — no side effects.
 */
function buildCloneEntry(sourceCfg, newName) {
  const sourceEnv = (sourceCfg && sourceCfg.env) || {};
  const newEnv = {};
  if (sourceEnv.ANTHROPIC_BASE_URL)    newEnv.ANTHROPIC_BASE_URL    = sourceEnv.ANTHROPIC_BASE_URL;
  if (sourceEnv.CLAUDE_DEFAULT_MODEL)  newEnv.CLAUDE_DEFAULT_MODEL  = sourceEnv.CLAUDE_DEFAULT_MODEL;
  if (sourceEnv.CLAUDE_MCP_TIMEOUT_MS) newEnv.CLAUDE_MCP_TIMEOUT_MS = sourceEnv.CLAUDE_MCP_TIMEOUT_MS;
  newEnv.PROVIDER_SLOT = newName;
  // ANTHROPIC_API_KEY intentionally excluded — keytar isolation
  return {
    type: (sourceCfg && sourceCfg.type) || 'stdio',
    command: (sourceCfg && sourceCfg.command) || 'node',
    args: (sourceCfg && sourceCfg.args) ? [...sourceCfg.args] : [],
    env: newEnv,
  };
}

module.exports._pure = {
  deriveKeytarAccount,
  maskKey,
  buildKeyStatus,
  buildAgentChoiceLabel,
  applyKeyUpdate,
  applyCcrProviderUpdate,
  readQgsdJson,
  writeQgsdJson,
  slotToFamily,
  getWlDisplay,
  readCcrConfigSafe,
  getCcrProviderForSlot,
  getKeyInvalidBadge,
  buildPresetChoices,
  findPresetForUrl,
  buildCloneEntry,
  classifyProbeResult,
  writeKeyStatus,
  formatTimestamp,
  buildDashboardLines,
};
