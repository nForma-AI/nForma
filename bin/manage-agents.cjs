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

const CLAUDE_JSON_PATH = path.join(os.homedir(), '.claude.json');
const CLAUDE_JSON_TMP = CLAUDE_JSON_PATH + '.tmp';

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

  // Read orchestrator config from qgsd.json
  let orchestrator = { model: 'claude-sonnet-4-6', provider: 'Anthropic', billing: 'sub' };
  try {
    const qgsdPath = path.join(os.homedir(), '.claude', 'qgsd.json');
    const qgsd = JSON.parse(fs.readFileSync(qgsdPath, 'utf8'));
    if (qgsd.orchestrator) Object.assign(orchestrator, qgsd.orchestrator);
  } catch (_) {}

  // Build providers lookup for PROVIDER_SLOT cross-reference
  let providerMap = {};
  try {
    const pdata = readProvidersJson();
    for (const p of (pdata.providers || [])) providerMap[p.name] = p;
  } catch (_) {}

  // Read auth_type from qgsd.json agent_config
  let agentConfig = {};
  try {
    const qgsdPath = path.join(os.homedir(), '.claude', 'qgsd.json');
    const qgsd = JSON.parse(fs.readFileSync(qgsdPath, 'utf8'));
    agentConfig = qgsd.agent_config || {};
  } catch (_) {}

  const W = { n: 3, slot: 14, model: 38, provider: 26, type: 16, billing: 7 };
  const header = [
    '#'.padEnd(W.n),
    'Slot'.padEnd(W.slot),
    'Model'.padEnd(W.model),
    'Provider'.padEnd(W.provider),
    'Type'.padEnd(W.type),
    'Billing'.padEnd(W.billing),
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

    const row = [
      String(i + 1).padEnd(W.n),
      name.padEnd(W.slot),
      model.slice(0, W.model).padEnd(W.model),
      provider.slice(0, W.provider).padEnd(W.provider),
      connType.padEnd(W.type),
      billing.padEnd(W.billing),
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
      type: 'input',
      name: 'baseUrl',
      message: 'ANTHROPIC_BASE_URL:',
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

  const slotName = answers.slotName.trim();
  const argsArr = answers.args
    ? answers.args.split(',').map((a) => a.trim()).filter(Boolean)
    : [];

  const env = {};
  if (answers.baseUrl.trim()) env.ANTHROPIC_BASE_URL = answers.baseUrl.trim();
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
  if (answers.baseUrl.trim()) {
    process.stdout.write(`\n  Probing provider ${answers.baseUrl.trim()} ...`);
    const probe = await probeProviderUrl(answers.baseUrl.trim(), answers.apiKey.trim());
    if (probe.healthy) {
      process.stdout.write(`\n  \x1b[32m✓ Provider UP (${probe.latencyMs}ms)\x1b[0m\n`);
    } else {
      process.stdout.write(`\n  \x1b[33m⚠ Provider DOWN or unreachable\x1b[0m\n`);
      const { saveAnyway } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'saveAnyway',
          message: 'Save anyway?',
          default: false,
        },
      ]);
      if (!saveAnyway) {
        console.log('  Cancelled.');
        return;
      }
    }
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
    const { baseUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'ANTHROPIC_BASE_URL (blank = remove):',
        default: env.ANTHROPIC_BASE_URL || '',
      },
    ]);
    updates.baseUrl = baseUrl.trim() || '__REMOVE__';

    // Provider pre-flight check when a URL is set/changed
    if (baseUrl.trim() && baseUrl.trim() !== '__REMOVE__') {
      const apiKeyForProbe = keytarKey || env.ANTHROPIC_API_KEY || updates.apiKey || '';
      process.stdout.write(`\n  Probing provider ${baseUrl.trim()} ...`);
      const probe = await probeProviderUrl(baseUrl.trim(), apiKeyForProbe);
      if (probe.healthy) {
        process.stdout.write(`\n  \x1b[32m✓ Provider UP (${probe.latencyMs}ms)\x1b[0m\n\n`);
      } else {
        process.stdout.write(`\n  \x1b[33m⚠ Provider DOWN or unreachable\x1b[0m\n`);
        const { saveAnyway } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'saveAnyway',
            message: 'Save anyway?',
            default: false,
          },
        ]);
        if (!saveAnyway) {
          console.log('  Cancelled.');
          return;
        }
        console.log('');
      }
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
          { name: '3. Edit agent', value: 'edit' },
          { name: '4. Remove agent', value: 'remove' },
          { name: '5. Reorder agents', value: 'reorder' },
          { name: '6. Check agent health', value: 'health' },
          new inquirer.Separator(),
          { name: '7. Add subprocess provider', value: 'add-sub' },
          { name: '8. Edit subprocess provider', value: 'edit-sub' },
          new inquirer.Separator(),
          { name: '0. Exit', value: 'exit' },
        ],
      },
    ]);

    try {
      if (action === 'list') await listAgents();
      else if (action === 'add') await addAgent();
      else if (action === 'edit') await editAgent();
      else if (action === 'remove') await removeAgent();
      else if (action === 'reorder') await reorderAgents();
      else if (action === 'health') await checkAgentHealth();
      else if (action === 'add-sub') await addSubprocessProvider();
      else if (action === 'edit-sub') await editSubprocessProvider();
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
