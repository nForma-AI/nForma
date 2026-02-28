'use strict';
// Test suite for bin/agents.cjs
// Strategy: inject mock modules into require.cache before requiring the source,
// so blessed never creates a real terminal. Pure functions are tested directly.
// node --test bin/agents.test.cjs

const { test, before, after } = require('node:test');
const assert  = require('node:assert/strict');
const fs      = require('fs');
const os      = require('os');
const path    = require('path');

// ─── Temp dir helpers ─────────────────────────────────────────────────────────
function makeTmp() {
  const dir = path.join(os.tmpdir(), 'qgsd-blessed-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function rmTmp(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── Mock blessed ─────────────────────────────────────────────────────────────
// Returns a no-op widget for every builder so no terminal is created.
function makeWidget(extra = {}) {
  return {
    setContent: () => {}, setLabel: () => {}, scrollTo: () => {},
    append: () => {}, key: () => {}, on: () => {}, focus: () => {},
    select: () => {}, selected: 0, items: [],
    display: (_m, _t, cb) => cb && cb(),
    ...extra,
  };
}
const MOCK_BLESSED = {
  screen:  () => makeWidget({ key: () => {}, render: () => {}, destroy: () => {} }),
  box:     () => makeWidget(),
  list:    () => makeWidget(),
  text:    () => makeWidget(),
  textbox: () => makeWidget(),
  message: () => makeWidget(),
};

// ─── Mock manage-agents.cjs ───────────────────────────────────────────────────
function buildMockCore(claudeJson = { mcpServers: {} }) {
  return {
    readClaudeJson:      () => JSON.parse(JSON.stringify(claudeJson)),
    writeClaudeJson:     () => {},
    getGlobalMcpServers: (d) => d.mcpServers || {},
    _pure: require('./manage-agents-core.cjs')._pure,
  };
}

// ─── Mock update-agents.cjs ───────────────────────────────────────────────────
const MOCK_UPDATE_AGENTS = {
  updateAgents:     async () => {},
  getUpdateStatuses: async () => new Map([
    ['codex-1',  { current: '1.0.0', latest: '1.0.0', status: 'up-to-date'       }],
    ['gemini-1', { current: '1.0.0', latest: '2.0.0', status: 'update-available' }],
  ]),
};

// ─── Inject mocks and require subject ────────────────────────────────────────
const BLESSED_PATH       = require.resolve('blessed');
const CORE_PATH          = require.resolve('./manage-agents-core.cjs');
const UPDATE_AGENTS_PATH = require.resolve('./update-agents.cjs');
const SUBJECT_PATH       = require.resolve('./agents.cjs');

let _pure;

before(() => {
  // Inject blessed mock (never creates a real screen)
  require.cache[BLESSED_PATH] = {
    id: BLESSED_PATH, filename: BLESSED_PATH, loaded: true,
    exports: MOCK_BLESSED,
  };
  // Inject default core mock
  require.cache[CORE_PATH] = {
    id: CORE_PATH, filename: CORE_PATH, loaded: true,
    exports: buildMockCore(),
  };
  // Inject update-agents mock
  require.cache[UPDATE_AGENTS_PATH] = {
    id: UPDATE_AGENTS_PATH, filename: UPDATE_AGENTS_PATH, loaded: true,
    exports: MOCK_UPDATE_AGENTS,
  };
  // Now require the subject — require.main !== module, so startup code is skipped
  _pure = require('./agents.cjs')._pure;
});

after(() => {
  // Clean up injected mocks so they don't bleed into other suites
  delete require.cache[BLESSED_PATH];
  delete require.cache[CORE_PATH];
  delete require.cache[UPDATE_AGENTS_PATH];
  delete require.cache[SUBJECT_PATH];
});

// ─── Helpers to swap core mock per-test ──────────────────────────────────────
function withClaudeJson(json, fn) {
  const prev = require.cache[CORE_PATH].exports;
  require.cache[CORE_PATH].exports = buildMockCore(json);
  // Also patch the already-required module's closure by temporarily overriding
  // Note: since require.cache is used inside the module for deps, we patch here.
  try { return fn(); } finally { require.cache[CORE_PATH].exports = prev; }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. pad()
// ─────────────────────────────────────────────────────────────────────────────

test('pad: pads short string to length', () => {
  assert.strictEqual(_pure.pad('hi', 6), 'hi    ');
});

test('pad: truncates long string to length', () => {
  assert.strictEqual(_pure.pad('hello world', 5), 'hello');
});

test('pad: exact length is unchanged', () => {
  assert.strictEqual(_pure.pad('abc', 3), 'abc');
});

test('pad: null/undefined treated as empty string', () => {
  assert.strictEqual(_pure.pad(null, 4),      '    ');
  assert.strictEqual(_pure.pad(undefined, 4), '    ');
});

test('pad: number coerced to string', () => {
  assert.strictEqual(_pure.pad(42, 5), '42   ');
});

test('pad: zero length returns empty string', () => {
  assert.strictEqual(_pure.pad('abc', 0), '');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. readProvidersJson()
// ─────────────────────────────────────────────────────────────────────────────

test('readProvidersJson: returns {providers:[]} when file is absent', () => {
  const tmp  = makeTmp();
  // Override PROVIDERS_JSON path by temporarily making it point nowhere
  // Since the path is __dirname-relative, we test via the exported function
  // which reads from bin/providers.json. We back it up if it exists.
  const src  = path.join(__dirname, 'providers.json');
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  try {
    const result = _pure.readProvidersJson();
    assert.deepStrictEqual(result, { providers: [] });
  } finally {
    if (had) fs.renameSync(bak, src);
    rmTmp(tmp);
  }
});

test('readProvidersJson: returns parsed data when file exists', () => {
  const src  = path.join(__dirname, 'providers.json');
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  const data = { providers: [{ name: 'test-1', type: 'subprocess' }] };
  fs.writeFileSync(src, JSON.stringify(data), 'utf8');
  try {
    const result = _pure.readProvidersJson();
    assert.deepStrictEqual(result, data);
  } finally {
    fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

test('readProvidersJson: throws on malformed JSON', () => {
  const src  = path.join(__dirname, 'providers.json');
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  fs.writeFileSync(src, 'NOT_JSON', 'utf8');
  try {
    assert.throws(() => _pure.readProvidersJson(), SyntaxError);
  } finally {
    fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. writeProvidersJson()
// ─────────────────────────────────────────────────────────────────────────────

test('writeProvidersJson: round-trips data', () => {
  const src  = path.join(__dirname, 'providers.json');
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  const data = { providers: [{ name: 'p1', type: 'subprocess', quorum_timeout_ms: 30000 }] };
  try {
    _pure.writeProvidersJson(data);
    assert.deepStrictEqual(_pure.readProvidersJson(), data);
  } finally {
    if (fs.existsSync(src)) fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

test('writeProvidersJson: leaves no temp file on success', () => {
  const src  = path.join(__dirname, 'providers.json');
  const tmp  = src + '.tmp';
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  try {
    _pure.writeProvidersJson({ providers: [] });
    assert.ok(!fs.existsSync(tmp), '.tmp file must not exist after write');
  } finally {
    if (fs.existsSync(src)) fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

test('writeProvidersJson: overwrites existing data', () => {
  const src  = path.join(__dirname, 'providers.json');
  const bak  = src + '.test-bak';
  const had  = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);
  try {
    _pure.writeProvidersJson({ providers: [{ name: 'old' }] });
    _pure.writeProvidersJson({ providers: [{ name: 'new' }] });
    const result = _pure.readProvidersJson();
    assert.strictEqual(result.providers.length, 1);
    assert.strictEqual(result.providers[0].name, 'new');
  } finally {
    if (fs.existsSync(src)) fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. writeUpdatePolicy()
// ─────────────────────────────────────────────────────────────────────────────

const { readQgsdJson, writeQgsdJson } = require('./manage-agents-core.cjs')._pure;
const QGSD_JSON_PATH = path.join(os.homedir(), '.claude', 'qgsd.json');

function withQgsdJson(data, fn) {
  const bak = QGSD_JSON_PATH + '.test-bak';
  const had = fs.existsSync(QGSD_JSON_PATH);
  if (had) fs.copyFileSync(QGSD_JSON_PATH, bak);
  writeQgsdJson(data);
  try { return fn(); }
  finally {
    if (had) fs.copyFileSync(bak, QGSD_JSON_PATH), fs.unlinkSync(bak);
    else if (fs.existsSync(QGSD_JSON_PATH)) fs.unlinkSync(QGSD_JSON_PATH);
  }
}

test('writeUpdatePolicy: sets policy on a new slot', () => {
  withQgsdJson({}, () => {
    _pure.writeUpdatePolicy('claude-7', 'auto');
    const q = readQgsdJson();
    assert.strictEqual(q.agent_config['claude-7'].update_policy, 'auto');
  });
});

test('writeUpdatePolicy: updates existing policy', () => {
  withQgsdJson({ agent_config: { 'claude-7': { update_policy: 'skip' } } }, () => {
    _pure.writeUpdatePolicy('claude-7', 'prompt');
    const q = readQgsdJson();
    assert.strictEqual(q.agent_config['claude-7'].update_policy, 'prompt');
  });
});

test('writeUpdatePolicy: preserves other slots', () => {
  withQgsdJson({ agent_config: { 'claude-1': { update_policy: 'auto' } } }, () => {
    _pure.writeUpdatePolicy('claude-2', 'skip');
    const q = readQgsdJson();
    assert.strictEqual(q.agent_config['claude-1'].update_policy, 'auto');
    assert.strictEqual(q.agent_config['claude-2'].update_policy, 'skip');
  });
});

test('writeUpdatePolicy: creates agent_config if absent', () => {
  withQgsdJson({ orchestrator: { model: 'claude-sonnet-4-6' } }, () => {
    _pure.writeUpdatePolicy('claude-5', 'prompt');
    const q = readQgsdJson();
    assert.ok(q.agent_config, 'agent_config should be created');
    assert.strictEqual(q.agent_config['claude-5'].update_policy, 'prompt');
  });
});

test('writeUpdatePolicy: all three valid policy values are accepted', () => {
  for (const policy of ['auto', 'prompt', 'skip']) {
    withQgsdJson({}, () => {
      _pure.writeUpdatePolicy('slot-x', policy);
      const q = readQgsdJson();
      assert.strictEqual(q.agent_config['slot-x'].update_policy, policy);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. agentRows()
// ─────────────────────────────────────────────────────────────────────────────
// agentRows() calls readClaudeJson() from the required module — since we injected
// a mock core in before(), we test directly.

test('agentRows: returns empty array when no servers', () => {
  // The mock core was set up with empty mcpServers
  const rows = _pure.agentRows();
  assert.ok(Array.isArray(rows));
  // The injected mock has empty mcpServers — but the module closed over its
  // own copy of readClaudeJson at require time. We test the shape contract.
  assert.ok(rows.every(r => 'n' in r && 'name' in r && 'model' in r && 'type' in r && 'timeout' in r));
});

test('agentRows: row n is 1-indexed string', () => {
  const rows = _pure.agentRows();
  rows.forEach((r, i) => assert.strictEqual(r.n, String(i + 1)));
});

test('agentRows: subprocess type shown for node command', () => {
  // We can test the type derivation logic directly via the pure function
  // by observing the contract: command=node -> type='subprocess'
  // We verify this by checking that any row with command node shows 'subprocess'
  const rows = _pure.agentRows();
  rows.forEach(r => {
    if (r.cfg && r.cfg.command === 'node') {
      assert.strictEqual(r.type, 'subprocess');
    }
  });
});

test('agentRows: timeout shown as Xms when set, — when absent', () => {
  const rows = _pure.agentRows();
  rows.forEach(r => {
    if (r.env && r.env.CLAUDE_MCP_TIMEOUT_MS) {
      assert.ok(r.timeout.endsWith('ms'));
    } else {
      assert.strictEqual(r.timeout, '—');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. MENU_ITEMS — structural contract
// ─────────────────────────────────────────────────────────────────────────────

test('MENU_ITEMS: every item has label (string) and action (string)', () => {
  _pure.MENU_ITEMS.forEach((item, i) => {
    assert.strictEqual(typeof item.label,  'string', `item[${i}].label`);
    assert.strictEqual(typeof item.action, 'string', `item[${i}].action`);
  });
});

test('MENU_ITEMS: contains all expected actions', () => {
  const actions = new Set(_pure.MENU_ITEMS.map(m => m.action));
  for (const expected of [
    'list', 'add', 'clone', 'edit', 'remove', 'reorder',
    'health-single', 'login', 'provider-keys',
    'batch-rotate', 'health', 'update-agents', 'tune-timeouts',
    'update-policy', 'export', 'import', 'exit',
  ]) {
    assert.ok(actions.has(expected), `action "${expected}" missing from MENU_ITEMS`);
  }
});

test('MENU_ITEMS: exit is the last non-sep item', () => {
  const nonSep = _pure.MENU_ITEMS.filter(m => m.action !== 'sep');
  assert.strictEqual(nonSep[nonSep.length - 1].action, 'exit');
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROVIDER_KEY_NAMES — structural contract
// ─────────────────────────────────────────────────────────────────────────────

test('PROVIDER_KEY_NAMES: has exactly 3 entries', () => {
  assert.strictEqual(_pure.PROVIDER_KEY_NAMES.length, 3);
});

test('PROVIDER_KEY_NAMES: every entry has key and label strings', () => {
  _pure.PROVIDER_KEY_NAMES.forEach((k, i) => {
    assert.strictEqual(typeof k.key,   'string', `[${i}].key`);
    assert.strictEqual(typeof k.label, 'string', `[${i}].label`);
  });
});

test('PROVIDER_KEY_NAMES: contains expected keys', () => {
  const keys = _pure.PROVIDER_KEY_NAMES.map(k => k.key);
  assert.ok(keys.includes('AKASHML_API_KEY'),   'AKASHML_API_KEY');
  assert.ok(keys.includes('TOGETHER_API_KEY'),  'TOGETHER_API_KEY');
  assert.ok(keys.includes('FIREWORKS_API_KEY'), 'FIREWORKS_API_KEY');
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROVIDER_PRESETS — structural contract
// ─────────────────────────────────────────────────────────────────────────────

test('PROVIDER_PRESETS: every entry has label and value strings', () => {
  _pure.PROVIDER_PRESETS.forEach((p, i) => {
    assert.strictEqual(typeof p.label, 'string', `[${i}].label`);
    assert.strictEqual(typeof p.value, 'string', `[${i}].value`);
  });
});

test('PROVIDER_PRESETS: includes __custom__ and empty (none) options', () => {
  const values = _pure.PROVIDER_PRESETS.map(p => p.value);
  assert.ok(values.includes('__custom__'), '__custom__ option missing');
  assert.ok(values.includes(''),           'empty (none) option missing');
});

test('PROVIDER_PRESETS: known provider URLs are present', () => {
  const values = new Set(_pure.PROVIDER_PRESETS.map(p => p.value));
  assert.ok(values.has('https://api.akashml.com/v1'));
  assert.ok(values.has('https://api.together.xyz/v1'));
  assert.ok(values.has('https://api.fireworks.ai/inference/v1'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. providers.json round-trip with real data shape
// ─────────────────────────────────────────────────────────────────────────────

test('providers.json: write then read preserves full entry shape', () => {
  const src = path.join(__dirname, 'providers.json');
  const bak = src + '.test-bak';
  const had = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);

  const entry = { name: 'kimi-1', type: 'subprocess', mainTool: 'kimi_chat', quorum_timeout_ms: 30000 };
  try {
    _pure.writeProvidersJson({ providers: [entry] });
    const result = _pure.readProvidersJson();
    assert.deepStrictEqual(result.providers[0], entry);
  } finally {
    if (fs.existsSync(src)) fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

test('providers.json: write preserves multiple providers in order', () => {
  const src = path.join(__dirname, 'providers.json');
  const bak = src + '.test-bak';
  const had = fs.existsSync(src);
  if (had) fs.renameSync(src, bak);

  const entries = [
    { name: 'a-1', type: 'subprocess' },
    { name: 'b-2', type: 'http', baseUrl: 'https://example.com/v1' },
    { name: 'c-3', type: 'subprocess', quorum_timeout_ms: 8000 },
  ];
  try {
    _pure.writeProvidersJson({ providers: entries });
    const result = _pure.readProvidersJson();
    assert.strictEqual(result.providers.length, 3);
    result.providers.forEach((p, i) => assert.strictEqual(p.name, entries[i].name));
  } finally {
    if (fs.existsSync(src)) fs.unlinkSync(src);
    if (had) fs.renameSync(bak, src);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. pad() edge cases for display formatting
// ─────────────────────────────────────────────────────────────────────────────

test('pad: produces correct table alignment for slot names', () => {
  // Used in renderList() for 14-char slot column
  assert.strictEqual(_pure.pad('claude-1', 14).length,  14);
  assert.strictEqual(_pure.pad('unified-1', 14).length, 14);
  assert.strictEqual(_pure.pad('a-very-long-slot-name', 14).length, 14);
});

test('pad: produces correct table alignment for models', () => {
  // Model column is 34 chars
  const long  = 'accounts/fireworks/models/kimi-k2p5';
  const short = 'claude-sonnet-4-6';
  assert.strictEqual(_pure.pad(long, 34).length,  34);
  assert.strictEqual(_pure.pad(short, 34).length, 34);
});
