#!/usr/bin/env node
'use strict';

const blessed    = require('blessed');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const { spawnSync } = require('child_process');

// ─── Reuse logic layer from manage-agents-core.cjs ───────────────────────────
const core = require('./manage-agents-core.cjs');
const pure = core._pure;

const { readClaudeJson, writeClaudeJson, getGlobalMcpServers } = core;
const {
  buildDashboardLines, probeAllSlots,
  maskKey, deriveKeytarAccount,
  readQgsdJson, writeQgsdJson,
  buildExportData, validateImportSchema, buildBackupPath,
  buildTimeoutChoices, applyTimeoutUpdate,
  buildPolicyChoices,
} = pure;

const { updateAgents, getUpdateStatuses } = require('./update-agents.cjs');

// ─── File paths ───────────────────────────────────────────────────────────────
const CLAUDE_JSON_PATH   = path.join(os.homedir(), '.claude.json');
const PROVIDERS_JSON     = path.join(__dirname, 'providers.json');
const PROVIDERS_JSON_TMP = PROVIDERS_JSON + '.tmp';

// ─── Constants ────────────────────────────────────────────────────────────────
const PROVIDER_KEY_NAMES = [
  { key: 'AKASHML_API_KEY',   label: 'AkashML API Key'     },
  { key: 'TOGETHER_API_KEY',  label: 'Together.xyz API Key' },
  { key: 'FIREWORKS_API_KEY', label: 'Fireworks API Key'    },
];

const PROVIDER_PRESETS = [
  { label: 'AkashML       (api.akashml.com/v1)',            value: 'https://api.akashml.com/v1'            },
  { label: 'Together.xyz  (api.together.xyz/v1)',           value: 'https://api.together.xyz/v1'           },
  { label: 'Fireworks.ai  (api.fireworks.ai/inference/v1)', value: 'https://api.fireworks.ai/inference/v1' },
  { label: 'Custom URL…',                                   value: '__custom__'                            },
  { label: 'None (subprocess only)',                        value: ''                                      },
];

const MENU_ITEMS = [
  { label: '  List Agents',              action: 'list'          },
  { label: '  Add Agent',               action: 'add'           },
  { label: '  Clone Slot',              action: 'clone'         },
  { label: '  Edit Agent',              action: 'edit'          },
  { label: '  Remove Agent',            action: 'remove'        },
  { label: '  Reorder Agents',          action: 'reorder'       },
  { label: '  Check Agent Health',      action: 'health-single' },
  { label: '  Login / Auth',            action: 'login'         },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Provider Keys',           action: 'provider-keys' },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Batch Rotate Keys',       action: 'batch-rotate'  },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Live Health',             action: 'health'        },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Update Agents',           action: 'update-agents' },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Settings',                action: 'settings'      },
  { label: '  Tune Timeouts',           action: 'tune-timeouts' },
  { label: '  Set Update Policy',       action: 'update-policy' },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Export Roster',           action: 'export'        },
  { label: '  Import Roster',           action: 'import'        },
  { label: ' ─────────────────',        action: 'sep'           },
  { label: '  Exit',                    action: 'exit'          },
];

// ─── Providers.json helpers ───────────────────────────────────────────────────
function readProvidersJson() {
  if (!fs.existsSync(PROVIDERS_JSON)) return { providers: [] };
  return JSON.parse(fs.readFileSync(PROVIDERS_JSON, 'utf8'));
}
function writeProvidersJson(data) {
  fs.writeFileSync(PROVIDERS_JSON_TMP, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(PROVIDERS_JSON_TMP, PROVIDERS_JSON);
}

// ─── Update policy helper ────────────────────────────────────────────────────
function writeUpdatePolicy(slotName, policy) {
  const qgsd = readQgsdJson();
  if (!qgsd.agent_config) qgsd.agent_config = {};
  if (!qgsd.agent_config[slotName]) qgsd.agent_config[slotName] = {};
  qgsd.agent_config[slotName].update_policy = policy;
  writeQgsdJson(qgsd);
}

// ─── Secrets loader (cached — keychain prompted once per process) ─────────────
let _secretsCache = undefined;
function loadSecrets() {
  if (_secretsCache !== undefined) return _secretsCache;
  const candidates = [
    path.join(os.homedir(), '.claude', 'qgsd-bin', 'secrets.cjs'),
    path.join(__dirname, 'secrets.cjs'),
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) { _secretsCache = require(p); return _secretsCache; } } catch (_) {}
  }
  _secretsCache = null;
  return null;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
function pad(str, len) { return String(str || '').slice(0, len).padEnd(len); }

function deriveProviderName(url) {
  if (!url) return 'subprocess';
  if (url.includes('akashml.com'))  return 'AkashML';
  if (url.includes('together.xyz')) return 'Together.xyz';
  if (url.includes('fireworks.ai')) return 'Fireworks';
  if (url.includes('openai.com'))   return 'OpenAI';
  if (url.includes('google'))       return 'Google';
  try { return new URL(url).hostname.replace(/^api\./, ''); } catch (_) { return url.slice(0, 14); }
}

/**
 * detectModel(meta) — read the live model from the CLI's own config file.
 * Used for subscription-based CLI providers (codex, opencode) that store
 * the active model on disk rather than in an env var.
 * Returns null on any error so callers can fall back gracefully.
 */
function detectModel(meta) {
  if (!meta.model_detect) return null;
  try {
    const filePath = meta.model_detect.file.replace(/^~/, os.homedir());
    if (!fs.existsSync(filePath)) return null;
    const content  = fs.readFileSync(filePath, 'utf8');
    const m        = content.match(new RegExp(meta.model_detect.pattern, 'm'));
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
}

function agentRows() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const secrets = loadSecrets();

  // Cross-reference providers.json for display_type and quorum_timeout_ms
  let providerMeta = {};
  try {
    const pdata = readProvidersJson();
    for (const p of (pdata.providers || [])) providerMeta[p.name] = p;
  } catch (_) {}

  let i = 1;
  return Object.entries(servers).filter(([name]) =>
    !name.startsWith('unified-')
  ).map(([name, cfg]) => {
    const env          = cfg.env || {};
    const baseUrl      = env.ANTHROPIC_BASE_URL || '';
    const provSlot     = env.PROVIDER_SLOT || name;
    const meta         = providerMeta[provSlot] || providerMeta[name] || {};
    // MCP-server providers expose model via env; CLI providers via model_detect file or static meta.model
    const model        = env.CLAUDE_DEFAULT_MODEL || env.ANTHROPIC_MODEL
                          || detectModel(meta) || meta.model || '—';
    // MCP providers set CLAUDE_MCP_TIMEOUT_MS; CLI providers declare quorum_timeout_ms in providers.json
    const timeout      = env.CLAUDE_MCP_TIMEOUT_MS
                          ? `${env.CLAUDE_MCP_TIMEOUT_MS}ms`
                          : meta.quorum_timeout_ms ? `${meta.quorum_timeout_ms}ms` : '—';
    const displayType  = meta.display_type || (cfg.command === 'node' ? 'claude-mcp-server' : cfg.command || '?');
    const providerName = deriveProviderName(baseUrl);
    const description  = meta.description || '';

    // Key status: check env + local index (no keychain prompt)
    const account   = 'ANTHROPIC_API_KEY_' + name.toUpperCase().replace(/-/g, '_');
    const hasKey    = !!env.ANTHROPIC_API_KEY || (secrets ? secrets.hasKey(account) : false);

    // OAuth rotation pool info — delegated to the auth driver (no inline CLI-specific logic).
    // extractAccountName() is called even with an empty pool so single-account providers
    // (e.g. gemini with oauth_creds.json but no pool directory yet) still show their identity.
    let poolInfo = null;
    if (meta.oauth_rotation?.enabled && meta.auth?.type) {
      try {
        const { loadDriver } = require('./auth-drivers/index.cjs');
        const driver     = loadDriver(meta.auth.type);
        const accounts   = driver.list(meta);
        const activeEntry = accounts.find(a => a.active);
        const activeName  = activeEntry?.name ?? driver.extractAccountName(meta);
        if (accounts.length || activeName) {
          poolInfo = { size: accounts.length, active: activeName };
        }
      } catch (_) {}
    }

    // Providers without oauth_rotation (e.g. opencode) may declare identity_detect
    // in providers.json — the simple driver reads it via extractAccountName().
    if (!poolInfo && meta.auth?.type && meta.identity_detect) {
      try {
        const { loadDriver } = require('./auth-drivers/index.cjs');
        const identity = loadDriver(meta.auth.type).extractAccountName(meta);
        if (identity) poolInfo = { size: 0, active: identity };
      } catch (_) {}
    }

    // Last failure from quorum-failures.json (best-effort read)
    let lastFailure = null;
    try {
      const failPath = path.join(os.homedir(), '.claude', 'qgsd', 'quorum-failures.json');
      if (fs.existsSync(failPath)) {
        const failures = JSON.parse(fs.readFileSync(failPath, 'utf8'));
        const entry = failures[provSlot] || failures[name];
        if (entry) lastFailure = { count: entry.count || 1, type: entry.error_type || 'UNKNOWN' };
      }
    } catch (_) {}

    return { n: String(i++), name, model, timeout, env, cfg,
             baseUrl, providerName, displayType, hasKey, description,
             poolInfo, lastFailure };
  });
}

// ─── Header info (version, profile, quorum n) ────────────────────────────────
function buildHeaderInfo() {
  let version = '?';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    version = pkg.version || '?';
  } catch (_) {}

  let profile = '—';
  try {
    const cfgPath = path.join(process.cwd(), '.planning', 'config.json');
    if (fs.existsSync(cfgPath))
      profile = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).model_profile || '—';
  } catch (_) {}

  let quorumN = '—';
  let failMode = '—';
  try {
    const qgsd   = readQgsdJson();
    const defN   = qgsd.quorum?.maxSize;
    const byProf = qgsd.quorum?.maxSizeByProfile || {};
    const effN   = byProf[profile] ?? defN;
    if (effN != null) quorumN = String(effN) + (byProf[profile] != null ? '*' : '');
    if (qgsd.fail_mode) failMode = qgsd.fail_mode;
  } catch (_) {}

  // Key agent tiers — from qgsd-core/references/model-profiles.md
  const TIERS = {
    planner:    { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
    executor:   { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
    researcher: { quality: 'opus',   balanced: 'sonnet', budget: 'haiku'  },
    verifier:   { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku'  },
  };
  const p = TIERS.planner[profile] ? profile : 'balanced';
  const models = {
    planner:    TIERS.planner[p],
    executor:   TIERS.executor[p],
    researcher: TIERS.researcher[p],
    verifier:   TIERS.verifier[p],
  };

  return { version, profile, quorumN, failMode, models };
}

// ─── Screen setup ─────────────────────────────────────────────────────────────
const screen = blessed.screen({ smartCSR: true, title: 'QGSD Agent Manager' });

// Raw ANSI codes — identical to install.js, bypasses blessed's hex→ANSI conversion
const _S = '\x1b[38;5;209m'; // salmon  (ANSI 256-color 209, same as install.js)
const _C = '\x1b[36m';       // cyan    (ANSI standard 6)
const _D = '\x1b[38;5;240m'; // dim gray for tagline
const _R = '\x1b[0m';        // reset

const HEADER_CONTENT =
  `${_S}  ██████╗ ${_R}${_C} ██████╗ ███████╗██████╗${_R}\n` +
  `${_S} ██╔═══██╗${_R}${_C}██╔════╝ ██╔════╝██╔══██╗${_R}\n` +
  `${_S} ██║   ██║${_R}${_C}██║  ███╗███████╗██║  ██║${_R}\n` +
  `${_S} ██║▄▄ ██║${_R}${_C}██║   ██║╚════██║██║  ██║${_R}\n` +
  `${_S} ╚██████╔╝${_R}${_C}╚██████╔╝███████║██████╔╝${_R}\n` +
  `${_S}  ╚══▀▀═╝ ${_R}${_C} ╚═════╝ ╚══════╝╚═════╝${_R}\n` +
  `${_D}  Quorum Gets Shit Done  ·  Agent Manager${_R}`;

const header = blessed.box({
  top: 0, left: 0, width: 46, height: 8,
  content: HEADER_CONTENT,
  tags: false,
  style: { bg: '#111111' },
});

function renderHeader() { screen.render(); }

const menuList = blessed.list({
  top: 8, left: 0, width: 26, bottom: 2,
  label: ' {#666666-fg}Menu{/} ', tags: true,
  border: { type: 'line' },
  style: {
    bg: '#111111',
    border: { fg: '#333333' },
    selected: { bg: '#1e3a3a', fg: '#cccccc', bold: true },
    item: { fg: '#888888' },
  },
  keys: true, vi: true, mouse: true, tags: true,
  items: MENU_ITEMS.map(m => m.label),
});

const contentBox = blessed.box({
  top: 8, left: 26, right: 0, bottom: 2,
  label: ' {#666666-fg}Content{/} ', tags: true,
  border: { type: 'line' },
  scrollable: true, alwaysScroll: true, mouse: true,
  scrollbar: { ch: ' ', style: { bg: '#333333' } },
  style: { bg: '#111111', fg: '#aaaaaa', border: { fg: '#333333' } },
});

const STATUS_DEFAULT = ' {#4a9090-fg}[↑↓]{/} Navigate   {#4a9090-fg}[Enter]{/} Select   {#4a9090-fg}[r]{/} Refresh   {#4a9090-fg}[u]{/} Updates   {#4a9090-fg}[q]{/} Quit';

const statusBar = blessed.box({
  bottom: 0, left: 0, width: '100%', height: 3,
  content: STATUS_DEFAULT,
  tags: true,
  border: { type: 'line' },
  style: { fg: '#888888', bg: '#111111', border: { fg: '#333333' } },
});

// ─── Settings pane (two-column display, always visible) ───────────────────────
// Padding is computed from plain text widths so blessed tags don't skew alignment.
function buildSettingsPaneContent() {
  const cfg     = readProjectConfig();
  const qgsd    = readQgsdJson();
  const profile = cfg.model_profile || 'balanced';
  const ov      = cfg.model_overrides || {};
  const defN    = qgsd.quorum?.maxSize ?? 3;
  const byProf  = qgsd.quorum?.maxSizeByProfile || {};
  const effN    = byProf[profile] ?? defN;
  const nStr    = String(effN) + (byProf[profile] != null ? '*' : '');
  const failStr = qgsd.fail_mode || '—';

  const D = '{#444444-fg}', V = '{#888888-fg}', A = '{#4a9090-fg}', Z = '{/}';
  const DIV = ' {#282828-fg}│{/} ';

  // mTag: colored model value; mPlain: plain version for width calculation
  const mPlain = k => ov[k] ? `${ov[k]}*` : (AGENT_TIERS[k]?.[profile] || '—');
  const mTag   = k => ov[k] ? `${A}${ov[k]}${Z}{#555555-fg}*${Z}` : `${V}${AGENT_TIERS[k]?.[profile] || '—'}${Z}`;

  // Build a row: left cell padded to COL_W visible chars, then divider, then right cell
  const COL_W = 27;
  function row(lPlain, lTagged, rTagged = '') {
    const pad = ' '.repeat(Math.max(0, COL_W - lPlain.length));
    return lTagged + pad + DIV + rTagged;
  }

  const agents = ['qgsd-planner', 'qgsd-executor', 'qgsd-phase-researcher', 'qgsd-verifier', 'qgsd-codebase-mapper'];
  const rLabels = ['Planner ', 'Executor', 'Research', 'Verifier', 'Mapper  '];

  const left = [
    [`  Profile   ${profile}`, `  ${D}Profile  ${Z} ${V}${profile}${Z}`],
    [`  Quorum n  ${nStr}`,    `  ${D}Quorum n ${Z} ${V}${nStr}${Z}`],
    [`  Fail mode ${failStr}`, `  ${D}Fail mode${Z} ${V}${failStr}${Z}`],
    [``, ``], [``, ``],
  ];

  return agents.map((key, i) => {
    const [lp, lt] = left[i] || ['', ''];
    return row(lp, lt, `  ${D}${rLabels[i]}${Z} ${mTag(key)}`);
  }).join('\n');
}

const settingsPane = blessed.box({
  top: 0, left: 46, right: 0, height: 8,
  label: ' {#666666-fg}Settings{/} ', tags: true,
  border: { type: 'line' },
  style: { bg: '#111111', fg: '#666666', border: { fg: '#333333' } },
});

function refreshSettingsPane() {
  settingsPane.setContent(buildSettingsPaneContent());
  screen.render();
}

screen.append(header);
screen.append(menuList);
screen.append(contentBox);
screen.append(settingsPane);
screen.append(statusBar);

// ─── Content helpers ─────────────────────────────────────────────────────────
function setContent(label, text) {
  contentBox.setLabel(` {#666666-fg}${label}{/} `);
  contentBox.setContent(text);
  contentBox.scrollTo(0);
  screen.render();
}

// ─── Promisified overlay helpers ─────────────────────────────────────────────
function promptInput(opts) {
  return new Promise((resolve, reject) => {
    const box = blessed.box({
      top: 'center', left: 'center', width: 64, height: 10,
      label: ` {#888888-fg}${opts.title}{/} `, tags: true,
      border: { type: 'line' },
      style: { bg: '#1a1a1a', border: { fg: '#444444' } },
      shadow: true,
    });
    blessed.text({ parent: box, top: 1, left: 2, content: opts.prompt || '', tags: true,
      style: { fg: '#aaaaaa', bg: '#1a1a1a' } });
    const input = blessed.textbox({
      parent: box, top: 3, left: 2, right: 2, height: 1,
      inputOnFocus: true, censor: !!opts.isPassword,
      style: { fg: '#cccccc', bg: '#2e2e2e' },
    });
    if (opts.default) input.setValue(opts.default);
    blessed.text({ parent: box, top: 6, left: 2,
      content: '{#555555-fg}[Enter]{/} confirm   [Esc] cancel', tags: true,
      style: { bg: '#1a1a1a' } });
    screen.append(box);
    input.focus();
    screen.render();
    input.once('submit', (val) => {
      screen.remove(box); menuList.focus(); screen.render();
      resolve(val.trim());
    });
    input.key(['escape'], () => {
      screen.remove(box); menuList.focus(); screen.render();
      reject(new Error('cancelled'));
    });
  });
}

function promptList(opts) {
  return new Promise((resolve, reject) => {
    const height = Math.min((opts.items || []).length + 4, 20);
    const box = blessed.list({
      top: 'center', left: 'center', width: 52, height,
      label: ` {#888888-fg}${opts.title}{/} `, tags: true,
      border: { type: 'line' },
      style: {
        bg: '#1a1a1a',
        border: { fg: '#444444' },
        selected: { bg: '#1e3a3a', fg: '#cccccc', bold: true },
        item: { fg: '#888888' },
      },
      keys: true, vi: true, mouse: true,
      items: (opts.items || []).map(i => '  ' + i.label),
      shadow: true,
    });
    screen.append(box);
    box.focus();
    screen.render();
    box.on('select', (_, idx) => {
      screen.remove(box); menuList.focus(); screen.render();
      resolve(opts.items[idx]);
    });
    box.key(['escape', 'q'], () => {
      screen.remove(box); menuList.focus(); screen.render();
      reject(new Error('cancelled'));
    });
  });
}

function promptCheckbox(opts) {
  return new Promise((resolve, reject) => {
    const items = opts.items || [];
    const selected = new Set();
    const height = Math.min(items.length + 6, 24);

    function makeItemLine(item, i) {
      return `  ${selected.has(i) ? '{green-fg}[✓]{/}' : '[ ]'} ${item.label}`;
    }

    const box = blessed.list({
      top: 'center', left: 'center', width: 58, height,
      label: ` {#888888-fg}${opts.title}{/} `, tags: true,
      border: { type: 'line' },
      style: {
        bg: '#1a1a1a',
        border: { fg: '#444444' },
        selected: { bg: '#1e3a3a', fg: '#cccccc' },
        item: { fg: '#888888' },
      },
      keys: true, vi: true, mouse: true, tags: true,
      items: items.map((item, i) => makeItemLine(item, i)),
      shadow: true,
    });

    box.key(['space'], () => {
      const idx = box.selected;
      if (selected.has(idx)) selected.delete(idx); else selected.add(idx);
      box.setItems(items.map((item, i) => makeItemLine(item, i)));
      box.select(idx);
      screen.render();
    });

    box.key(['enter'], () => {
      screen.remove(box); menuList.focus(); screen.render();
      resolve(items.filter((_, i) => selected.has(i)).map(item => item.value));
    });

    box.key(['escape', 'q'], () => {
      screen.remove(box); menuList.focus(); screen.render();
      reject(new Error('cancelled'));
    });

    screen.append(box);
    box.focus();
    screen.render();
  });
}

// ─── External terminal launcher ───────────────────────────────────────────────
// Writes a temp shell script and opens it in a new Terminal.app window via osascript.
// Returns true if the terminal was opened successfully.
function spawnExternalTerminal(loginCmd) {
  const tmpScript = path.join(os.tmpdir(), 'qgsd-auth-' + Date.now() + '.sh');
  try {
    fs.writeFileSync(tmpScript, [
      '#!/bin/sh',
      loginCmd.map(a => `"${a.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(' '),
      'echo ""',
      'echo "✓ Sign-in complete. You may close this window."',
      'rm -f \'' + tmpScript + '\'',
    ].join('\n'), { mode: 0o755 });
    const r = spawnSync('osascript', ['-e',
      `tell application "Terminal"\n  do script "bash '${tmpScript}'"\n  activate\nend tell`
    ], { stdio: 'ignore' });
    return r.status === 0;
  } catch (_) { return false; }
}

// ─── Login launcher dialog (stays in TUI — opens Terminal for interactive OAuth) ─
// Opens a new terminal window running loginCmd, then either:
//   • auto-resolves when credentialFile mtime changes (file-based providers), or
//   • waits for manual [Enter] confirmation (keychain-based providers like gh).
// Resolves to 'changed' | 'manual' | throws on cancel.
function promptLoginExternal(title, loginCmd, credentialFile = null) {
  const beforeMtime = credentialFile && fs.existsSync(credentialFile)
    ? fs.statSync(credentialFile).mtimeMs : 0;

  const opened = spawnExternalTerminal(loginCmd);

  return new Promise((resolve, reject) => {
    const SPIN   = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinIdx  = 0;
    const hint   = credentialFile
      ? '{gray-fg}Auto-completing when sign-in detected · [Enter] done · [Esc] cancel{/}'
      : '{gray-fg}[Enter] when sign-in is complete · [Esc] cancel{/}';
    const openedLine = opened
      ? '{green-fg}✓ Terminal window opened{/}'
      : '{yellow-fg}⚠ Could not open Terminal — run manually:{/}\n    ' + loginCmd.join(' ');

    const box = blessed.box({
      top: 'center', left: 'center', width: 70, height: 12,
      label: ` {#888888-fg}${title}{/} `, tags: true,
      border: { type: 'line' },
      style: { bg: '#1a1a1a', border: { fg: '#444444' } },
      shadow: true,
      keys: true, mouse: true,
    });

    function render() {
      box.setContent(
        `\n  ${openedLine}\n\n` +
        `  {#4a9090-fg}${SPIN[spinIdx % SPIN.length]}{/} Waiting for sign-in to complete…\n\n` +
        `  ${hint}`
      );
      screen.render();
    }

    screen.append(box);
    box.focus();
    render();

    let timer = null;

    function cleanup() {
      if (timer) clearInterval(timer);
      screen.remove(box); menuList.focus(); screen.render();
    }

    if (credentialFile) {
      timer = setInterval(() => {
        spinIdx++;
        try {
          const mtime = fs.existsSync(credentialFile) ? fs.statSync(credentialFile).mtimeMs : 0;
          if (mtime > beforeMtime) { cleanup(); resolve('changed'); return; }
        } catch (_) {}
        render();
      }, 500);
    } else {
      timer = setInterval(() => { spinIdx++; render(); }, 500);
    }

    box.key(['enter'], () => { cleanup(); resolve('manual'); });
    box.key(['escape', 'q'], () => { cleanup(); reject(new Error('cancelled')); });
  });
}

// ─── Toast notification ───────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const box = blessed.message({
    top: 'center', left: 'center', width: 54, height: 5,
    border: { type: 'line' },
    style: { border: { fg: isError ? 'red' : 'green' } },
    shadow: true,
  });
  screen.append(box);
  box.display(`{${isError ? 'red' : 'green'}-fg}${msg}{/}`, 2, () => {
    screen.remove(box); menuList.focus(); screen.render();
  });
}

// ─── List Agents ─────────────────────────────────────────────────────────────
function renderList() {
  try {
    const rows = agentRows();
    const W    = { n: 3, name: 16, provider: 13, model: 38, key: 8, timeout: 9 };
    const hdr  = `{bold}${pad('#', W.n)}  ${pad('Slot', W.name)}  ${pad('Provider', W.provider)}  ${pad('Model', W.model)}  ${pad('Key', W.key)}  Timeout{/bold}`;
    const sep  = '─'.repeat(W.n + 2 + W.name + 2 + W.provider + 2 + W.model + 2 + W.key + 2 + W.timeout);

    const lines = [hdr, sep];
    for (const r of rows) {
      // Key badge — pad to 8 visual chars after tag close
      // No BASE_URL = subscription/CLI auth, no API key needed
      const isSubAuth = !r.baseUrl;
      const keyBadge = r.hasKey
        ? '{green-fg}✓ set{/}   ' // 5 visible + 3 spaces = 8
        : isSubAuth
          ? '{#4a9090-fg}sub{/}     '  // 3 visible + 5 spaces = 8
          : '{red-fg}✗ unset{/} '; // 7 visible + 1 space = 8

      // Line 1: main info
      lines.push(
        `${pad(r.n, W.n)}  {#4a9090-fg}${pad(r.name, W.name)}{/}  ` +
        `${pad(r.providerName, W.provider)}  ` +
        `${pad(r.model.slice(0, W.model), W.model)}  ` +
        `${keyBadge}` +
        `${r.timeout}`
      );

      // Line 2: secondary details
      const details = [];
      if (r.displayType) details.push(r.displayType);
      if (r.baseUrl)     details.push(r.baseUrl);
      if (r.poolInfo) {
        const acct     = r.poolInfo.active ?? '?';
        const poolSize = r.poolInfo.size > 1 ? `  (${r.poolInfo.size} accts)` : '';
        details.push(`{cyan-fg}◉ ${acct}{/}${poolSize}`);
      }
      if (r.lastFailure) details.push('{red-fg}⚠ ' + r.lastFailure.count + 'x ' + r.lastFailure.type + '{/}');
      lines.push('{gray-fg}     ' + details.join('   ') + '{/}');
      lines.push('');
    }

    setContent(`Agents (${rows.length})`, lines.join('\n'));
  } catch (err) {
    setContent('Agents', `{red-fg}Error: ${err.message}{/}`);
  }
}

// ─── Add Agent ────────────────────────────────────────────────────────────────
async function addAgentFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const existing = Object.keys(servers);

  const slotName = await promptInput({ title: 'Add Agent — Slot name', prompt: 'Slot name (e.g. claude-7):' });
  if (!slotName) { toast('Slot name is required', true); return; }
  if (/\s/.test(slotName)) { toast('No spaces allowed in slot name', true); return; }
  if (existing.includes(slotName)) { toast(`"${slotName}" already exists`, true); return; }

  const typeChoice = await promptList({ title: 'Add Agent — Type', items: [
    { label: 'API Agent     (claude-mcp-server — AkashML, Together, Fireworks…)', value: 'api' },
    { label: 'CLI Agent     (subprocess — codex, gemini, opencode, copilot…)',    value: 'cli' },
  ] });

  if (typeChoice.value === 'cli') {
    // CLI / subprocess agent — command + providers.json metadata
    const command  = await promptInput({ title: 'Add Agent — CLI command', prompt: 'CLI command (e.g. codex, gemini, gh):' });
    if (!command) { toast('Command is required', true); return; }
    const mainTool = await promptInput({ title: 'Add Agent — Main tool', prompt: 'Main tool name (e.g. github_copilot_chat):' });
    const model    = await promptInput({ title: 'Add Agent — Model', prompt: 'Model name (optional):' });
    const timeout  = await promptInput({ title: 'Add Agent — Timeout', prompt: 'quorum_timeout_ms:', default: '30000' });

    data.mcpServers = { ...servers, [slotName]: { type: 'stdio', command, args: [] } };
    writeClaudeJson(data);

    // Write providers.json metadata
    const pdata = readProvidersJson();
    if (!pdata.providers) pdata.providers = [];
    const entry = { name: slotName, type: 'subprocess', display_type: `${command}-cli` };
    if (mainTool) entry.mainTool = mainTool;
    if (model)    entry.model    = model;
    if (timeout)  entry.quorum_timeout_ms = parseInt(timeout, 10);
    pdata.providers.push(entry);
    writeProvidersJson(pdata);

    toast(`✓ Added CLI agent "${slotName}"`);
    renderList();
    return;
  }

  // API / MCP server agent
  const preset  = await promptList({ title: 'Add Agent — Provider', items: PROVIDER_PRESETS });
  let baseUrl   = preset.value;
  if (baseUrl === '__custom__') {
    baseUrl = await promptInput({ title: 'Add Agent — Base URL', prompt: 'ANTHROPIC_BASE_URL:' });
  }

  const model   = await promptInput({ title: 'Add Agent — Model', prompt: 'CLAUDE_DEFAULT_MODEL:', default: 'claude-sonnet-4-6' });
  const apiKey  = await promptInput({ title: 'Add Agent — API Key', prompt: 'ANTHROPIC_API_KEY:', isPassword: true });
  const timeout = await promptInput({ title: 'Add Agent — Timeout', prompt: 'CLAUDE_MCP_TIMEOUT_MS:', default: '30000' });

  const env = {};
  if (baseUrl)  env.ANTHROPIC_BASE_URL   = baseUrl;
  if (model)    env.CLAUDE_DEFAULT_MODEL  = model;
  if (timeout)  env.CLAUDE_MCP_TIMEOUT_MS = timeout;
  env.PROVIDER_SLOT = slotName;

  const secrets = loadSecrets();
  if (apiKey && secrets) {
    await secrets.set('qgsd', deriveKeytarAccount(slotName), apiKey);
  } else if (apiKey) {
    env.ANTHROPIC_API_KEY = apiKey;
  }

  data.mcpServers = { ...servers, [slotName]: { type: 'stdio', command: 'node', args: [], env } };
  writeClaudeJson(data);
  toast(`✓ Added "${slotName}"`);
  renderList();
}

// ─── Clone Slot ───────────────────────────────────────────────────────────────
async function cloneSlotFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents to clone', true); return; }

  const source  = await promptList({ title: 'Clone Slot — Pick source',
    items: slots.map(s => ({ label: `${pad(s, 14)} ${(servers[s].env || {}).CLAUDE_DEFAULT_MODEL || '—'}`, value: s })) });
  const newName = await promptInput({ title: 'Clone Slot — New name', prompt: `New slot name (cloning ${source.value}):` });

  if (!newName || /\s/.test(newName)) { toast('Invalid slot name', true); return; }
  if (slots.includes(newName)) { toast(`"${newName}" already exists`, true); return; }

  const cloned = JSON.parse(JSON.stringify(servers[source.value]));
  if (cloned.env) cloned.env.PROVIDER_SLOT = newName;

  data.mcpServers = { ...servers, [newName]: cloned };
  writeClaudeJson(data);
  toast(`✓ Cloned "${source.value}" → "${newName}"`);
  renderList();
}

// ─── Edit Agent ───────────────────────────────────────────────────────────────
async function editAgentFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents to edit', true); return; }

  // Pre-load providers.json for slot-picker labels (shows real model, not 'node')
  let provData = {};
  try {
    const pd = readProvidersJson();
    for (const p of (pd.providers || [])) provData[p.name] = p;
  } catch (_) {}

  while (true) {                                                // slot loop: ESC → main menu
    let target;
    try {
      target = await promptList({ title: 'Edit Agent — Pick slot',
        items: slots.map(s => {
          const env   = (servers[s].env || {});
          const model = (env.CLAUDE_DEFAULT_MODEL || provData[s]?.model || servers[s].command || '?').slice(0, 30);
          return { label: `${pad(s, 14)} ${model}`, value: s };
        }) });
    } catch (_) { return; }                                     // ESC → main menu

    const slotName = target.value;
    const cfg      = servers[slotName];
    const env      = cfg.env || {};

    // Always load providers.json meta — it's the source of truth for CLI agents
    let pMeta = {};
    try {
      const pd = readProvidersJson();
      pMeta = (pd.providers || []).find(p => p.name === slotName) || {};
    } catch (_) {}

    // CLI agents are declared as type:subprocess in providers.json.
    // cfg.command may be 'node' (unified-server) even for CLI slots.
    const isCli = pMeta.type === 'subprocess' || cfg.command !== 'node';

    while (true) {                                              // field loop: ESC → slot picker
      const fieldItems = isCli ? [
        { label: `CLI Path       ${pMeta.cli || cfg.command || '(not set)'}`, value: 'cliPath'   },
        { label: `Main Tool      ${pMeta.mainTool || '(not set)'}`,           value: 'mainTool'  },
        { label: `Model          ${pMeta.model || '(not set)'}`,              value: 'cliModel'  },
        { label: `Timeout        ${pMeta.quorum_timeout_ms || '(not set)'}`,  value: 'cliTimeout'},
      ] : [
        { label: `Model          ${env.CLAUDE_DEFAULT_MODEL || '(not set)'}`,  value: 'model'    },
        { label: `API Key        ${env.ANTHROPIC_API_KEY ? '(set)' : '(not set)'}`, value: 'apiKey'  },
        { label: `Base URL       ${env.ANTHROPIC_BASE_URL || '(not set)'}`,    value: 'baseUrl'  },
        { label: `Timeout        ${env.CLAUDE_MCP_TIMEOUT_MS || '(not set)'}`, value: 'timeout'  },
        { label: `Provider Slot  ${env.PROVIDER_SLOT || slotName}`,            value: 'provSlot' },
      ];

      let field;
      try {
        field = await promptList({ title: `Edit "${slotName}" — Field`, items: fieldItems });
      } catch (_) { break; }                                    // ESC → back to slot picker

      try {
        if (field.value === 'model') {
          const val = await promptInput({ title: `Edit "${slotName}" — Model`,
            prompt: 'CLAUDE_DEFAULT_MODEL:', default: env.CLAUDE_DEFAULT_MODEL || '' });
          if (val) env.CLAUDE_DEFAULT_MODEL = val; else delete env.CLAUDE_DEFAULT_MODEL;

        } else if (field.value === 'apiKey') {
          const val = await promptInput({ title: `Edit "${slotName}" — API Key`,
            prompt: 'ANTHROPIC_API_KEY (blank = remove):', isPassword: true });
          const secrets = loadSecrets();
          const account = deriveKeytarAccount(slotName);
          if (val && secrets)      { await secrets.set('qgsd', account, val); delete env.ANTHROPIC_API_KEY; }
          else if (val)             { env.ANTHROPIC_API_KEY = val; }
          else if (secrets)         { await secrets.delete('qgsd', account); delete env.ANTHROPIC_API_KEY; }
          else                      { delete env.ANTHROPIC_API_KEY; }

        } else if (field.value === 'baseUrl') {
          let preset;
          try { preset = await promptList({ title: `Edit "${slotName}" — Base URL`, items: PROVIDER_PRESETS }); }
          catch (_) { continue; }                               // ESC at preset picker → re-show field picker
          let baseUrl = preset.value;
          if (baseUrl === '__custom__') {
            baseUrl = await promptInput({ title: `Edit "${slotName}" — Base URL`, prompt: 'ANTHROPIC_BASE_URL:' });
          }
          if (baseUrl) env.ANTHROPIC_BASE_URL = baseUrl; else delete env.ANTHROPIC_BASE_URL;

        } else if (field.value === 'timeout') {
          const val = await promptInput({ title: `Edit "${slotName}" — Timeout`,
            prompt: 'CLAUDE_MCP_TIMEOUT_MS:', default: env.CLAUDE_MCP_TIMEOUT_MS || '30000' });
          if (val) env.CLAUDE_MCP_TIMEOUT_MS = val; else delete env.CLAUDE_MCP_TIMEOUT_MS;

        } else if (field.value === 'provSlot') {
          const val = await promptInput({ title: `Edit "${slotName}" — Provider Slot`,
            prompt: 'PROVIDER_SLOT:', default: env.PROVIDER_SLOT || slotName });
          env.PROVIDER_SLOT = val || slotName;

        } else if (['cliPath', 'mainTool', 'cliModel', 'cliTimeout'].includes(field.value)) {
          const prompts = {
            cliPath:    { label: 'CLI path',           key: 'cli',               cur: pMeta.cli || cfg.command, transform: v => v },
            mainTool:   { label: 'Main tool',          key: 'mainTool',          cur: pMeta.mainTool,           transform: v => v },
            cliModel:   { label: 'Model',              key: 'model',             cur: pMeta.model,              transform: v => v },
            cliTimeout: { label: 'quorum_timeout_ms',  key: 'quorum_timeout_ms', cur: pMeta.quorum_timeout_ms,  transform: v => parseInt(v, 10) },
          };
          const { label, key, cur, transform } = prompts[field.value];
          const val = await promptInput({ title: `Edit "${slotName}" — ${label}`, prompt: `${label}:`, default: String(cur || '') });
          const pd  = readProvidersJson();
          let entry = (pd.providers || []).find(p => p.name === slotName);
          if (!entry) { entry = { name: slotName, type: 'subprocess' }; pd.providers = [...(pd.providers || []), entry]; }
          if (val) entry[key] = transform(val); else delete entry[key];
          writeProvidersJson(pd);
          toast(`✓ Saved "${slotName}"`);
          renderList();
          continue;                                             // re-show field picker after CLI save
        }
      } catch (_) { continue; }                                // ESC during value input → re-show field picker

      cfg.env = env;
      data.mcpServers[slotName] = cfg;
      writeClaudeJson(data);
      toast(`✓ Saved "${slotName}"`);
      renderList();
    }
  }
}

// ─── Remove Agent ─────────────────────────────────────────────────────────────
async function removeAgentFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents to remove', true); return; }

  const target = await promptList({ title: 'Remove Agent',
    items: slots.map(s => {
      const model = ((servers[s].env || {}).CLAUDE_DEFAULT_MODEL || servers[s].command || '?').slice(0, 30);
      return { label: `${pad(s, 14)} ${model}`, value: s };
    }) });

  const confirm = await promptList({ title: `Remove "${target.value}"?`,
    items: [
      { label: 'Cancel (keep it)',                   value: 'cancel'  },
      { label: `⚠  Yes, delete "${target.value}"`,  value: 'confirm' },
    ] });

  if (confirm.value !== 'confirm') { toast('Cancelled'); return; }

  data.mcpServers = Object.fromEntries(Object.entries(servers).filter(([k]) => k !== target.value));
  writeClaudeJson(data);
  toast(`✓ Removed "${target.value}"`);
  renderList();
}

// ─── Reorder Agents ───────────────────────────────────────────────────────────
async function reorderFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents to reorder', true); return; }

  const target = await promptList({ title: 'Reorder — Pick slot to move',
    items: slots.map((s, i) => ({ label: `${String(i + 1).padStart(2)}.  ${s}`, value: s })) });

  const slotName  = target.value;
  const currentIdx = slots.indexOf(slotName);
  const posStr    = await promptInput({ title: `Move "${slotName}"`,
    prompt: `Move to position (1–${slots.length}):`, default: String(currentIdx + 1) });
  const newPos    = parseInt(posStr, 10);

  if (isNaN(newPos) || newPos < 1 || newPos > slots.length) {
    toast(`Position must be 1–${slots.length}`, true); return;
  }

  const entries = Object.entries(servers);
  const [entry] = entries.splice(currentIdx, 1);
  entries.splice(newPos - 1, 0, entry);
  data.mcpServers = Object.fromEntries(entries);
  writeClaudeJson(data);
  toast(`✓ Moved "${slotName}" to position ${newPos}`);
  renderList();
}

// ─── Check Agent Health (single slot) ────────────────────────────────────────
async function checkHealthSingle() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents configured', true); return; }

  const target = await promptList({ title: 'Check Health — Pick slot',
    items: slots.map(s => ({ label: pad(s, 14) + ' ' + ((servers[s].env || {}).CLAUDE_DEFAULT_MODEL || '—'), value: s })) });

  const slotName = target.value;
  const env      = (servers[slotName].env || {});
  setContent('Agent Health', `{gray-fg}Probing ${slotName}…{/}`);

  if (!env.ANTHROPIC_BASE_URL) {
    setContent('Agent Health', `{yellow-fg}${slotName} is a subprocess provider — no HTTP endpoint to probe.{/}`);
    return;
  }

  const secrets = loadSecrets();
  const lines   = [`{bold}${slotName}{/bold}`, '─'.repeat(50)];

  const hMap = await probeAllSlots(servers, [slotName], secrets);
  const p    = hMap[slotName] || {};
  const status = p.healthy
    ? `{green-fg}✓ UP (${p.latencyMs}ms){/}`
    : p.healthy === null
      ? `{gray-fg}— subprocess (no HTTP endpoint){/}`
      : `{red-fg}✗ DOWN [${p.error || 'timeout'}]{/}`;
  lines.push(`  Status:  ${status}`);

  lines.push(`  URL:     ${env.ANTHROPIC_BASE_URL}`);
  lines.push(`  Model:   ${env.CLAUDE_DEFAULT_MODEL || '—'}`);
  setContent('Agent Health', lines.join('\n'));
}

// ─── Auth flow (driver-orchestrated — no CLI-specific logic in the TUI) ───────

async function authFlow(slotName, meta) {
  const { loadDriver } = require('./auth-drivers/index.cjs');
  const authCfg  = meta.auth;
  const loginCmd = authCfg?.login ?? [meta.cli, 'auth', 'login'];

  let driver;
  try { driver = loadDriver(authCfg?.type); }
  catch (err) { toast(err.message, true); return; }

  const addLabel = '+ Add account' + (loginCmd.length ? ' (' + loginCmd.join(' ') + ')' : '');

  // Loop so: after add/switch the list refreshes in place; Esc exits back to slot picker.
  while (true) {
    let accounts;
    try { accounts = driver.list(meta); }
    catch (err) { toast('Could not list accounts: ' + err.message, true); return; }

    const items = accounts.map(a => ({
      label: pad(a.name, 36) + (a.active ? ' {green-fg}(active){/}' : ''), value: a.name, isActive: a.active,
    }));
    items.push({ label: addLabel, value: '__add__', isActive: false });

    let picked;
    try { picked = await promptList({ title: 'Auth — ' + slotName, items }); }
    catch (_) { return; } // Esc → caller (slot-picker loop) re-shows slot list

    // ── Add account ─────────────────────────────────────────────────────────
    if (picked.value === '__add__') {
      const credFile = driver.addCredentialFile(meta);

      // Pool providers (Gemini, Codex): if the credential file already exists,
      // the CLI opens in interactive mode instead of triggering fresh OAuth.
      // Back it up first so the CLI sees no active session.
      let backupCredFile = null;
      if (credFile && fs.existsSync(credFile) && typeof driver.add === 'function') {
        // Auto-save current account to pool before displacing it (best-effort).
        const curName = typeof driver.extractAccountName === 'function'
          ? driver.extractAccountName(meta) : null;
        if (curName) {
          const alreadyInPool = driver.list(meta).some(a => a.name === curName);
          if (!alreadyInPool) {
            try { await driver.add(meta, curName); } catch (_) {}
          }
        }
        // Move active creds aside so CLI triggers fresh OAuth.
        backupCredFile = credFile + '.auth-in-progress';
        try { fs.renameSync(credFile, backupCredFile); }
        catch (_) { backupCredFile = null; }
      }

      try { await promptLoginExternal('Add Account — ' + slotName, loginCmd, credFile); }
      catch (_) {
        // Cancelled — restore the backed-up credentials so the active account still works.
        if (backupCredFile && fs.existsSync(backupCredFile)) {
          try { fs.renameSync(backupCredFile, credFile); } catch (_) {}
        }
        continue; // Esc from spinner → back to account list
      }

      // Login succeeded — old creds are already in the pool; discard backup.
      if (backupCredFile && fs.existsSync(backupCredFile)) {
        try { fs.unlinkSync(backupCredFile); } catch (_) {}
      }

      // Drivers that manage accounts internally (gh-cli) need no capture step
      if (typeof driver.add === 'function' && credFile !== null) {
        let name = driver.extractAccountName(meta);
        if (!name) {
          try { name = await promptInput({ title: 'Add Account — ' + slotName, prompt: 'Account name / alias:' }); }
          catch (_) { continue; } // Esc from name prompt → back to account list
          if (!name) { toast('Name required', true); continue; }
        }
        try {
          await driver.add(meta, name);
          toast('Account "' + name + '" added to pool');
          renderList();
        } catch (err) {
          toast('Add failed: ' + err.message, true);
        }
      } else {
        toast('Signed in — account will appear on next refresh');
      }
      continue; // refresh account list
    }

    // ── Switch account ───────────────────────────────────────────────────────
    if (picked.isActive) { toast(picked.value + ' is already active'); continue; }

    try {
      driver.switch(meta, picked.value);
      toast('Switched ' + slotName + ' → ' + picked.value);
      renderList();
    } catch (err) {
      toast('Switch failed: ' + err.message, true);
    }
    continue; // refresh account list to show updated active state
  }
}

// ─── Login / Auth ─────────────────────────────────────────────────────────────
async function loginAgentFlow() {
  const { loadDriver } = require('./auth-drivers/index.cjs');

  // Loop so: Esc from account list re-shows slot picker; Esc from slot picker exits.
  while (true) {
    const pdata      = readProvidersJson();
    const metaByName = Object.fromEntries((pdata.providers || []).map(p => [p.name, p]));

    const rows  = agentRows();
    const items = rows.map(r => {
      const meta    = metaByName[r.name] || {};
      const authCfg = meta.auth;
      let driverAvailable = false;
      try { if (authCfg?.type) { loadDriver(authCfg.type); driverAvailable = true; } } catch (_) {}
      const hasPool = !!meta.oauth_rotation?.enabled;
      const label   = pad(r.name, 16) + ' ' +
        (authCfg ? authCfg.type : '{gray-fg}(no auth){/}') +
        (hasPool ? ' · pool' : '') +
        (!driverAvailable && authCfg ? ' {red-fg}(no driver){/}' : '');
      return { label, value: r.name, meta, driverAvailable };
    });

    let picked;
    try { picked = await promptList({ title: 'Login / Auth — Pick slot', items }); }
    catch (_) { return; } // Esc → back to main menu

    if (!picked.meta.auth) { toast('No auth configured for this slot', true); continue; }
    if (!picked.driverAvailable) { toast('No driver for type "' + picked.meta.auth.type + '"', true); continue; }

    await authFlow(picked.value, picked.meta);
    // authFlow returned (user pressed Esc from account list) → loop back to slot picker
  }
}

// ─── Provider Keys ────────────────────────────────────────────────────────────
async function renderProviderKeys() {
  const secrets = loadSecrets();
  if (!secrets) { setContent('Provider Keys', '{red-fg}secrets.cjs not found — QGSD not installed.{/}'); return; }
  const lines = ['{bold}Provider Keys (keytar){/bold}', '─'.repeat(40)];
  for (const { key, label } of PROVIDER_KEY_NAMES) {
    // hasKey() reads local JSON index — no keychain prompt
    const display = secrets.hasKey(key) ? '{green-fg}✓ set{/}' : '{gray-fg}(not set){/}';
    lines.push(`  ${pad(label, 22)} ${display}`);
  }
  lines.push('', '{gray-fg}Use Provider Keys → Set to update a key.{/}');
  setContent('Provider Keys', lines.join('\n'));
}

async function providerKeysFlow() {
  setContent('Provider Keys', '{gray-fg}Select an action…{/}');
  const secrets = loadSecrets();
  if (!secrets) { toast('secrets.cjs not found — QGSD not installed', true); return; }

  while (true) {                                                // action loop: ESC → main menu
    let action;
    try {
      action = await promptList({ title: 'Provider Keys',
        items: [
          { label: 'View stored keys',   value: 'view'   },
          { label: 'Set / update a key', value: 'set'    },
          { label: 'Remove a key',       value: 'remove' },
        ] });
    } catch (_) { return; }                                     // ESC → main menu

    if (action.value === 'view') { await renderProviderKeys(); continue; }

    while (true) {                                              // key loop: ESC → action picker
      let picked;
      try {
        picked = await promptList({
          title: action.value === 'set' ? 'Set which key?' : 'Remove which key?',
          items: PROVIDER_KEY_NAMES.map(k => ({ label: k.label, value: k.key })),
        });
      } catch (_) { break; }                                    // ESC → back to action picker

      try {
        if (action.value === 'remove') {
          await secrets.delete('qgsd', picked.value);
          toast(`Removed ${picked.label}`);
          await renderProviderKeys();
          continue;                                             // re-show key picker (remove more)
        }

        const val = await promptInput({ title: `Set ${picked.label}`, prompt: `Value for ${picked.value}:`, isPassword: true });
        if (!val) { toast('Empty value — key not stored', true); continue; }
        await secrets.set('qgsd', picked.value, val);
        toast(`${picked.label} saved to keychain`);
        await renderProviderKeys();
      } catch (_) { continue; }                                // ESC during value input → re-show key picker
    }
  }
}

// ─── Batch Rotate Keys ────────────────────────────────────────────────────────
async function batchRotateFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No agents configured', true); return; }

  const secrets = loadSecrets();
  setContent('Batch Rotate Keys', '{gray-fg}Select slots to rotate (one at a time, pick Done when finished)…{/}');

  const remaining = [...slots];
  const rotated   = [];

  while (remaining.length) {
    const items = [
      ...remaining.map(s => {
        const account = deriveKeytarAccount(s);
        const hasKey  = (secrets && secrets.hasKey(account)) || !!(servers[s].env || {}).ANTHROPIC_API_KEY;
        return { label: `${pad(s, 14)} ${hasKey ? '[key set]' : '[no key]'}`, value: s };
      }),
      { label: '─── Done', value: '__done__' },
    ];

    let picked;
    try { picked = await promptList({ title: 'Batch Rotate — Pick slot', items }); }
    catch (_) { break; }                                        // ESC → exit loop, show summary
    if (picked.value === '__done__') break;

    let newKey;
    try {
      newKey = await promptInput({
        title: `Rotate key for "${picked.value}"`,
        prompt: `New API key for ${picked.value}:`,
        isPassword: true,
      });
    } catch (_) { continue; }                                   // ESC → skip slot, re-show picker
    if (!newKey) { toast('Empty value — skipped', true); continue; }

    const account = deriveKeytarAccount(picked.value);
    if (secrets) {
      await secrets.set('qgsd', account, newKey);
    } else {
      if (!servers[picked.value].env) servers[picked.value].env = {};
      servers[picked.value].env.ANTHROPIC_API_KEY = newKey;
    }

    rotated.push(picked.value);
    remaining.splice(remaining.indexOf(picked.value), 1);
  }

  if (rotated.length) {
    if (!secrets) writeClaudeJson(data);
    toast(`✓ ${rotated.length} slot(s) rotated`);
  } else {
    toast('No keys rotated');
  }
  renderList();
}

// ─── Live Health ──────────────────────────────────────────────────────────────
let healthInterval = null;
async function renderHealth() {
  setContent('Live Health', '{gray-fg}Probing slots…{/}');
  try {
    const data      = readClaudeJson();
    const servers   = getGlobalMcpServers(data);
    const slots     = Object.keys(servers);
    const healthMap = await probeAllSlots(servers, slots, loadSecrets());
    const lines     = buildDashboardLines(slots, servers, healthMap, Date.now());
    setContent('Live Health', lines.join('\n'));
  } catch (err) {
    setContent('Live Health', `{red-fg}Error: ${err.message}{/}`);
  }
}

// ─── Update Agents ────────────────────────────────────────────────────────────
async function updateAgentsFlow() {
  setContent('Update Agents', '{gray-fg}Checking update status…{/}');

  let statuses;
  try {
    statuses = await getUpdateStatuses();
  } catch (err) {
    setContent('Update Agents', `{red-fg}Error: ${err.message}{/}`);
    return;
  }

  // Build CLI metadata map for running updates
  const CLI_META = {
    codex:    { installType: 'npm-global',   pkg: '@openai/codex'      },
    gemini:   { installType: 'npm-global',   pkg: '@google/gemini-cli' },
    opencode: { installType: 'npm-global',   pkg: 'opencode'           },
    copilot:  { installType: 'gh-extension', ext: 'github/gh-copilot'  },
    ccr:      { installType: 'npm-global',   pkg: 'claude-code-router'  },
  };

  const lines = ['{bold}Update Status{/bold}', '─'.repeat(50)];
  const outdated = [];
  for (const [name, info] of statuses) {
    const badge = info.status === 'up-to-date'
      ? '{green-fg}✓ up to date{/}'
      : info.status === 'update-available'
        ? `{yellow-fg}↑ ${info.current || '?'} → ${info.latest || '?'}{/}`
        : '{gray-fg}— unknown{/}';
    lines.push(`  ${pad(name, 14)} ${badge}`);
    if (info.status === 'update-available' && CLI_META[name]) {
      outdated.push({ name, meta: CLI_META[name], latest: info.latest });
    }
  }
  if (!statuses.size) lines.push('  {gray-fg}No managed agents detected.{/}');

  if (outdated.length === 0) {
    lines.push('', '{green-fg}All agents are up to date.{/}');
    setContent('Update Agents', lines.join('\n'));
    return;
  }

  lines.push('');
  setContent('Update Agents', lines.join('\n'));

  // Choice loop: ESC at top level → main menu; ESC at checkbox → back to choice
  let toUpdate;
  while (true) {
    let choice;
    try {
      choice = await promptList({
        title: 'Apply Updates',
        items: [
          { label: `Update all (${outdated.length})`, value: 'all'    },
          { label: 'Select individual',               value: 'select'  },
          { label: 'Skip',                            value: 'skip'    },
        ],
      });
    } catch (_) { return; }                                     // ESC → main menu

    if (choice.value === 'skip') { toast('Skipped.'); return; }

    if (choice.value === 'all') { toUpdate = outdated; break; }

    // 'select' — checkbox; ESC → re-show choice list
    try {
      const picked = await promptCheckbox({
        title: 'Select agents to update',
        items: outdated.map(r => ({
          label: `${r.name}  (→ ${r.latest || '?'})`,
          value: r.name,
        })),
      });
      toUpdate = outdated.filter(r => picked.includes(r.name));
    } catch (_) { continue; }                                   // ESC → re-show choice list
    if (!toUpdate.length) { toast('Nothing selected.'); continue; }
    break;
  }

  // Run updates — capture output, display in contentBox
  const results = [];
  for (const { name, meta } of toUpdate) {
    setContent('Update Agents', `{gray-fg}Updating ${name}…{/}`);
    let cmd, args;
    if (meta.installType === 'npm-global') {
      cmd = 'npm'; args = ['install', '-g', `${meta.pkg}@latest`];
    } else {
      cmd = 'gh'; args = ['extension', 'upgrade', 'copilot'];
    }
    const res = spawnSync(cmd, args, {
      encoding: 'utf8', timeout: 60000,
    });
    const ok = res.status === 0;
    results.push(ok
      ? `{green-fg}✓ ${name} updated{/}`
      : `{red-fg}✗ ${name} failed (exit ${res.status}){/}\n  ${(res.stderr || '').slice(0, 200)}`
    );
  }

  // Refresh badge after updates
  try {
    const fresh = await getUpdateStatuses();
    const remaining = [...fresh.values()].filter(s => s.status === 'update-available').length;
    applyUpdateBadge(remaining);
  } catch (_) {}

  setContent('Update Agents', ['{bold}Update Results{/bold}', '─'.repeat(50), ...results].join('\n'));
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
const AGENT_TIERS = {
  'qgsd-planner':          { quality: 'opus',   balanced: 'opus',   budget: 'sonnet' },
  'qgsd-executor':         { quality: 'opus',   balanced: 'sonnet', budget: 'sonnet' },
  'qgsd-phase-researcher': { quality: 'opus',   balanced: 'sonnet', budget: 'haiku'  },
  'qgsd-verifier':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku'  },
  'qgsd-codebase-mapper':  { quality: 'sonnet', balanced: 'haiku',  budget: 'haiku'  },
};
const AGENT_LABELS = {
  'qgsd-planner':          'Planner',
  'qgsd-executor':         'Executor',
  'qgsd-phase-researcher': 'Researcher',
  'qgsd-verifier':         'Verifier',
  'qgsd-codebase-mapper':  'Mapper',
};

function readProjectConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), '.planning', 'config.json'), 'utf8')); }
  catch (_) { return {}; }
}
function writeProjectConfig(cfg) {
  const p = path.join(process.cwd(), '.planning', 'config.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

// ─── Settings ─────────────────────────────────────────────────────────────────
async function settingsFlow() {
  while (true) {
    const cfg     = readProjectConfig();
    const qgsd    = readQgsdJson();
    const profile = cfg.model_profile || 'balanced';
    const defN    = qgsd.quorum?.maxSize ?? 3;
    const byProf  = qgsd.quorum?.maxSizeByProfile || {};
    const effN    = byProf[profile] ?? defN;
    const nStr    = String(effN) + (byProf[profile] != null ? '*' : '');
    const ovCount = Object.keys(cfg.model_overrides || {}).length;

    let picked;
    try {
      picked = await promptList({ title: 'Settings', items: [
        { label: `  Profile          ${profile}`,              value: 'profile'   },
        { label: `  Quorum n         ${nStr}  →`,              value: 'n'         },
        { label: `  Fail mode        ${qgsd.fail_mode || '—'}`,value: 'fail'      },
        { label: `  Model overrides  ${ovCount ? `${ovCount} active` : 'none'}  →`, value: 'overrides' },
      ]});
    } catch (_) { return; }

    if (picked.value === 'profile') {
      let choice;
      try {
        choice = await promptList({ title: 'Settings — Profile', items: [
          { label: 'quality   Opus for all decision-making',            value: 'quality'  },
          { label: 'balanced  Opus planner · Sonnet workers (default)', value: 'balanced' },
          { label: 'budget    Sonnet workers · Haiku checkers',         value: 'budget'   },
        ]});
      } catch (_) { continue; }
      const c = readProjectConfig();
      c.model_profile = choice.value;
      writeProjectConfig(c);
      refreshSettingsPane();
      toast(`✓ Profile → ${choice.value}`);

    } else if (picked.value === 'n') {
      await quorumNFlow();
      refreshSettingsPane();

    } else if (picked.value === 'fail') {
      let choice;
      try {
        choice = await promptList({ title: 'Settings — Fail Mode', items: [
          { label: 'lenient  Continue with partial quorum (default)', value: 'lenient' },
          { label: 'strict   Block if any required slot fails',       value: 'strict'  },
        ]});
      } catch (_) { continue; }
      const qg = readQgsdJson();
      qg.fail_mode = choice.value;
      writeQgsdJson(qg);
      refreshSettingsPane();
      toast(`✓ Fail mode → ${choice.value}`);

    } else if (picked.value === 'overrides') {
      await modelOverridesFlow();
      refreshSettingsPane();
    }
  }
}

async function modelOverridesFlow() {
  while (true) {
    const cfg      = readProjectConfig();
    const profile  = cfg.model_profile || 'balanced';
    const overrides = cfg.model_overrides || {};
    const items = Object.keys(AGENT_TIERS).map(key => {
      const def = AGENT_TIERS[key][profile];
      const ov  = overrides[key];
      const tag = ov
        ? `{#4a9090-fg}${ov}{/}  {#3d3d3d-fg}(override){/}`
        : `${def}  {#3d3d3d-fg}(${profile} default){/}`;
      return { label: `  ${pad(AGENT_LABELS[key], 14)} ${tag}`, value: key };
    });

    let picked;
    try { picked = await promptList({ title: 'Model Overrides', items }); }
    catch (_) { return; }

    const cfg2    = readProjectConfig();
    const prof2   = cfg2.model_profile || 'balanced';
    const defTier = AGENT_TIERS[picked.value][prof2];
    let choice;
    try {
      choice = await promptList({ title: `Override — ${AGENT_LABELS[picked.value]}`, items: [
        { label: `opus    ${defTier === 'opus'   ? '← profile default' : ''}`, value: 'opus'      },
        { label: `sonnet  ${defTier === 'sonnet' ? '← profile default' : ''}`, value: 'sonnet'    },
        { label: `haiku   ${defTier === 'haiku'  ? '← profile default' : ''}`, value: 'haiku'     },
        { label: `reset   use profile default (${defTier})`,                   value: '__reset__' },
      ]});
    } catch (_) { continue; }

    const c = readProjectConfig();
    if (!c.model_overrides) c.model_overrides = {};
    if (choice.value === '__reset__') {
      delete c.model_overrides[picked.value];
      if (!Object.keys(c.model_overrides).length) delete c.model_overrides;
    } else {
      c.model_overrides[picked.value] = choice.value;
    }
    writeProjectConfig(c);
    refreshSettingsPane();
    const msg = choice.value === '__reset__'
      ? `${AGENT_LABELS[picked.value]} reset to profile default (${defTier})`
      : `${AGENT_LABELS[picked.value]} → ${choice.value}`;
    toast(`✓ ${msg}`);
  }
}

async function quorumNFlow() {
  while (true) {
    const qgsd   = readQgsdJson();
    const defN   = qgsd.quorum?.maxSize ?? 3;
    const byProf = qgsd.quorum?.maxSizeByProfile || {};
    const fmt    = p => byProf[p] != null ? String(byProf[p]) : `${defN} (default)`;

    let picked;
    try {
      picked = await promptList({ title: 'Quorum n', items: [
        { label: `  Default   n=${defN}  (used when no per-profile override)`, value: 'default'  },
        { label: `  Quality   n=${fmt('quality')}`,                             value: 'quality'  },
        { label: `  Balanced  n=${fmt('balanced')}`,                            value: 'balanced' },
        { label: `  Budget    n=${fmt('budget')}`,                              value: 'budget'   },
      ]});
    } catch (_) { return; }

    const current = picked.value === 'default' ? defN : (byProf[picked.value] ?? defN);
    let val;
    try {
      val = await promptInput({
        title:   `Quorum n — ${picked.value}`,
        prompt:  `n  (0 = remove per-profile override, blank = keep current):`,
        default: String(current),
      });
    } catch (_) { continue; }

    if (!val || val.trim() === '' || val.trim() === String(current)) continue;
    const n = parseInt(val.trim(), 10);
    if (isNaN(n) || n < 0) { toast('Invalid — enter a positive number or 0 to remove', true); continue; }

    if (!qgsd.quorum) qgsd.quorum = {};
    if (picked.value === 'default') {
      qgsd.quorum.maxSize = n;
    } else {
      if (!qgsd.quorum.maxSizeByProfile) qgsd.quorum.maxSizeByProfile = {};
      if (n === 0) {
        delete qgsd.quorum.maxSizeByProfile[picked.value];
        if (!Object.keys(qgsd.quorum.maxSizeByProfile).length) delete qgsd.quorum.maxSizeByProfile;
      } else {
        qgsd.quorum.maxSizeByProfile[picked.value] = n;
      }
    }
    writeQgsdJson(qgsd);
    renderHeader();
    refreshSettingsPane();
    toast(`✓ Quorum n (${picked.value}) → ${n === 0 ? 'reset to default' : n}`);
  }
}

// ─── Tune Timeouts ────────────────────────────────────────────────────────────
async function tuneTimeoutsFlow() {
  const data     = readClaudeJson();
  const servers  = getGlobalMcpServers(data);
  const slots    = Object.keys(servers);
  if (!slots.length) { toast('No slots configured', true); return; }

  let providersData;
  try { providersData = readProvidersJson(); } catch { providersData = { providers: [] }; }

  const rows    = buildTimeoutChoices(slots, servers, providersData);
  let changed   = false;

  for (const { slotName, providerSlot, currentMs } of rows) {
    let val;
    try {
      val = await promptInput({
        title:   `Tune Timeout — ${slotName}`,
        prompt:  `Current: ${currentMs != null ? currentMs + ' ms' : '—'}   New timeout (ms, blank = keep):`,
        default: currentMs != null ? String(currentMs) : '',
      });
    } catch (_) { continue; }                                   // ESC → skip slot, move to next
    const trimmed = (val || '').trim();
    if (trimmed && parseInt(trimmed, 10) !== currentMs) {
      const updated = applyTimeoutUpdate(providersData, providerSlot, parseInt(trimmed, 10));
      Object.assign(providersData, updated);
      changed = true;
    }
  }

  if (changed) {
    writeProvidersJson(providersData);
    toast('Timeouts saved — restart Claude Code to apply');
  } else {
    toast('No changes made');
  }
}

// ─── Set Update Policy ────────────────────────────────────────────────────────
async function updatePolicyFlow() {
  const data    = readClaudeJson();
  const servers = getGlobalMcpServers(data);
  const slots   = Object.keys(servers);
  if (!slots.length) { toast('No slots configured', true); return; }

  const qgsd        = readQgsdJson();
  const agentConfig = qgsd.agent_config || {};

  const target = await promptList({ title: 'Update Policy — Pick slot',
    items: slots.map(s => ({
      label: `${pad(s, 14)} policy: ${(agentConfig[s] || {}).update_policy || '—'}`,
      value: s,
    })) });

  const currentPolicy = (agentConfig[target.value] || {}).update_policy || null;
  const policy = await promptList({ title: `Update Policy — ${target.value}`,
    items: buildPolicyChoices(currentPolicy).map(c => ({ label: c.name, value: c.value })) });

  writeUpdatePolicy(target.value, policy.value);
  toast(`✓ ${target.value}: update_policy = ${policy.value}`);
}

// ─── Export Roster ────────────────────────────────────────────────────────────
async function exportFlow() {
  const filePath = await promptInput({ title: 'Export Roster',
    prompt: 'Export file path (e.g. ~/Desktop/roster-backup.json):' });
  if (!filePath) { toast('Path is required', true); return; }

  const resolved = filePath.replace(/^~/, os.homedir());
  const rawData  = readClaudeJson();
  const exported = buildExportData(rawData);
  fs.writeFileSync(resolved, JSON.stringify(exported, null, 2), 'utf8');
  setContent('Export Roster', `{green-fg}✓ Exported to:{/}\n  ${resolved}\n\n{gray-fg}All API key values have been replaced with __redacted__{/}`);
}

// ─── Import Roster ────────────────────────────────────────────────────────────
async function importFlow() {
  const filePath = await promptInput({ title: 'Import Roster', prompt: 'Import file path:' });
  if (!filePath) { toast('Path is required', true); return; }

  const resolved = filePath.replace(/^~/, os.homedir());
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    toast(`Error reading file: ${err.message}`, true); return;
  }

  const errors = validateImportSchema(parsed);
  if (errors.length) {
    setContent('Import Roster', `{red-fg}Validation failed:{/}\n` + errors.map(e => `  - ${e}`).join('\n'));
    return;
  }

  const ts         = new Date().toISOString().replace(/:/g, '-');
  const backupPath = buildBackupPath(CLAUDE_JSON_PATH, ts);
  try { fs.copyFileSync(CLAUDE_JSON_PATH, backupPath); } catch (err) {
    toast(`Backup failed — import aborted: ${err.message}`, true); return;
  }

  // Re-prompt __redacted__ keys
  const secrets = loadSecrets();
  for (const [slotName, cfg] of Object.entries(parsed.mcpServers || {})) {
    if (!cfg.env) continue;
    for (const [envKey, envVal] of Object.entries(cfg.env)) {
      if (envVal === '__redacted__') {
        let val;
        try {
          val = await promptInput({ title: `Import — ${slotName}`,
            prompt: `API key for ${slotName} / ${envKey} (blank = skip):`, isPassword: true });
        } catch (_) { delete cfg.env[envKey]; continue; }       // ESC → skip key, move to next
        if (val) {
          if (secrets) { await secrets.set('qgsd', deriveKeytarAccount(slotName), val); delete cfg.env[envKey]; }
          else          { cfg.env[envKey] = val; }
        } else {
          delete cfg.env[envKey];
        }
      }
    }
  }

  writeClaudeJson(parsed);
  const slotCount = Object.keys(parsed.mcpServers || {}).length;
  setContent('Import Roster', `{green-fg}✓ Import complete: ${slotCount} server(s) applied.{/}\n  Backup at: ${backupPath}`);
  renderList();
}

// ─── Action dispatcher ────────────────────────────────────────────────────────
async function dispatch(action) {
  if (healthInterval) { clearInterval(healthInterval); healthInterval = null; }
  if (action === 'sep')  return;
  if (action === 'exit') { screen.destroy(); process.exit(0); }

  try {
    if      (action === 'list')          renderList();
    else if (action === 'add')           await addAgentFlow();
    else if (action === 'clone')         await cloneSlotFlow();
    else if (action === 'edit')          await editAgentFlow();
    else if (action === 'remove')        await removeAgentFlow();
    else if (action === 'reorder')       await reorderFlow();
    else if (action === 'health-single') await checkHealthSingle();
    else if (action === 'login')         await loginAgentFlow();
    else if (action === 'provider-keys') await providerKeysFlow();
    else if (action === 'batch-rotate')  await batchRotateFlow();
    else if (action === 'health') {
      await renderHealth();
      healthInterval = setInterval(renderHealth, 10_000);
    }
    else if (action === 'update-agents') await updateAgentsFlow();
    else if (action === 'settings')      await settingsFlow();
    else if (action === 'tune-timeouts') await tuneTimeoutsFlow();
    else if (action === 'update-policy') await updatePolicyFlow();
    else if (action === 'export')        await exportFlow();
    else if (action === 'import')        await importFlow();
  } catch (err) {
    if (err.message !== 'cancelled') toast(err.message, true);
    menuList.focus();
  }
}

// ─── Key bindings ─────────────────────────────────────────────────────────────
screen.key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });
screen.key(['r'], () => {
  const item = MENU_ITEMS[menuList.selected];
  if (item) dispatch(item.action);
});
screen.key(['u'], () => dispatch('update-agents'));
menuList.on('select', (_, idx) => {
  const item = MENU_ITEMS[idx];
  if (item) dispatch(item.action);
});

// ─── Background update notice ─────────────────────────────────────────────────
const UPDATE_AGENTS_IDX = MENU_ITEMS.findIndex(m => m.action === 'update-agents');

function applyUpdateBadge(outdatedCount) {
  // Status bar notice
  if (outdatedCount > 0) {
    const n = outdatedCount;
    statusBar.setContent(
      ` {#4a9090-fg}[↑↓]{/} Navigate   {#4a9090-fg}[Enter]{/} Select   {#4a9090-fg}[r]{/} Refresh   {#4a9090-fg}[q]{/} Quit` +
      `   {#888800-fg}⚑ ${n} update${n > 1 ? 's' : ''} available — press [u]{/}`
    );
  } else {
    statusBar.setContent(STATUS_DEFAULT);
  }
  // Menu item badge
  if (UPDATE_AGENTS_IDX >= 0) {
    const base = '  Update Agents';
    menuList.setItem(UPDATE_AGENTS_IDX, outdatedCount > 0
      ? `${base}  {yellow-fg}(${outdatedCount}↑){/}`
      : base
    );
  }
  screen.render();
}

// Fire on startup — non-blocking, never throws
// skipGh=true: avoids spawning `gh` which reads macOS keychain for GitHub auth
(async () => {
  try {
    const statuses = await getUpdateStatuses({ skipGh: true });
    const outdated = [...statuses.values()].filter(s => s.status === 'update-available').length;
    applyUpdateBadge(outdated);
  } catch (_) {}
})();

// ─── Start ────────────────────────────────────────────────────────────────────
if (require.main === module) {
  menuList.focus();
  menuList.select(0);
  renderList();
  refreshSettingsPane();
  screen.render();
}

// ─── Exports (pure functions for testing) ────────────────────────────────────
module.exports._pure = {
  pad,
  readProvidersJson,
  writeProvidersJson,
  writeUpdatePolicy,
  agentRows,
  PROVIDER_KEY_NAMES,
  PROVIDER_PRESETS,
  MENU_ITEMS,
};
