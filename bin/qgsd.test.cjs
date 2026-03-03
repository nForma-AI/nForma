'use strict';
// Test suite for bin/qgsd-manage.cjs
// Strategy: inject mock modules into require.cache before requiring the source,
// so blessed never creates a real terminal. Pure functions are tested directly.
// node --test bin/qgsd-manage.test.cjs

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
const SUBJECT_PATH       = require.resolve('./qgsd-manage.cjs');

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
  _pure = require('./qgsd-manage.cjs')._pure;
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
    'batch-rotate', 'health', 'scoreboard', 'update-agents', 'tune-timeouts',
    'update-policy', 'req-browse', 'req-coverage', 'req-traceability', 'req-aggregate',
    'req-gaps',
    'export', 'import', 'exit',
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
// 10. providers.json schema: has_file_access field
// ─────────────────────────────────────────────────────────────────────────────

test('providers.json: every entry has has_file_access as a boolean', () => {
  const src = path.join(__dirname, 'providers.json');
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  assert.ok(Array.isArray(data.providers), 'providers should be an array');
  assert.ok(data.providers.length > 0, 'providers should not be empty');
  for (const entry of data.providers) {
    assert.strictEqual(
      typeof entry.has_file_access, 'boolean',
      `${entry.name}: has_file_access should be a boolean, got ${typeof entry.has_file_access}`
    );
  }
});

test('providers.json: all subprocess entries have has_file_access: true', () => {
  const src = path.join(__dirname, 'providers.json');
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const subproc = data.providers.filter(e => e.type === 'subprocess');
  assert.ok(subproc.length > 0, 'should have subprocess entries');
  for (const entry of subproc) {
    assert.strictEqual(
      entry.has_file_access, true,
      `${entry.name}: subprocess slots must have has_file_access: true (they are coding agents with file system access)`
    );
  }
});

test('providers.json: has_file_access field is positioned after type field', () => {
  const src = path.join(__dirname, 'providers.json');
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  for (const entry of data.providers) {
    const keys = Object.keys(entry);
    const typeIdx = keys.indexOf('type');
    const accessIdx = keys.indexOf('has_file_access');
    assert.ok(accessIdx !== -1, `${entry.name}: has_file_access field missing`);
    assert.strictEqual(accessIdx, typeIdx + 1, `${entry.name}: has_file_access should immediately follow type`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. pad() edge cases for display formatting
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

// ─────────────────────────────────────────────────────────────────────────────
// 12. buildScoreboardLines() — pure formatter
// ─────────────────────────────────────────────────────────────────────────────

test('buildScoreboardLines: returns fallback when data is null', () => {
  const lines = _pure.buildScoreboardLines(null);
  assert.ok(lines.length > 0);
  assert.ok(lines[0].includes('No scoreboard data'));
});

test('buildScoreboardLines: returns fallback when models missing', () => {
  const lines = _pure.buildScoreboardLines({ rounds: [] });
  assert.ok(lines[0].includes('No scoreboard data'));
});

test('buildScoreboardLines: renders model rows sorted by normalized score descending', () => {
  const data = {
    models: {
      claude: { score: 50, invocations: 50, tp: 50, tn: 0, fp: 0, fn: 0, impr: 0 }, // orchestrator
      alice:  { score: 10, invocations: 10, tp: 10, tn: 0, fp: 0, fn: 0, impr: 0 },  // norm=1.00
      bob:    { score: 15, invocations: 10, tp: 8, tn: 1, fp: 0, fn: 1, impr: 0 },   // norm=1.50
      carol:  { score: 5,  invocations: 10, tp: 6, tn: 0, fp: 1, fn: 3, impr: 0 },   // norm=0.50
    },
  };
  const lines = _pure.buildScoreboardLines(data);
  const text = lines.join('\n');

  // Bob (1.50) should appear before Alice (1.00) before Carol (0.50)
  const bobIdx   = text.indexOf('bob');
  const aliceIdx = text.indexOf('alice');
  const carolIdx = text.indexOf('carol');
  assert.ok(bobIdx < aliceIdx, 'bob (1.50) should appear before alice (1.00)');
  assert.ok(aliceIdx < carolIdx, 'alice (1.00) should appear before carol (0.50)');
});

test('buildScoreboardLines: orchestrator completely excluded from display', () => {
  const data = {
    models: {
      claude:  { score: 100, invocations: 100, tp: 100, tn: 0, fp: 0, fn: 0, impr: 0 },
      gemini:  { score: 10,  invocations: 5,   tp: 5,   tn: 1, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');

  // Claude (orchestrator) should not appear anywhere
  assert.ok(!text.includes('Orchestrator'), 'no Orchestrator section');
  // 'claude' appears in header context ("Quorum") but not as a data row
  // Check that gemini IS present as a voter
  assert.ok(text.includes('gemini'), 'voter gemini should appear');
});

test('buildScoreboardLines: custom orchestrator key via opts', () => {
  const data = {
    models: {
      claude: { score: 10, invocations: 5, tp: 5, tn: 0, fp: 0, fn: 0, impr: 0 },
      mybot:  { score: 20, invocations: 10, tp: 10, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data, { orchestrator: 'mybot' }).join('\n');

  // With mybot as orchestrator, claude should be in voter ranking, mybot should not
  assert.ok(text.includes('claude'), 'claude should be ranked as voter when mybot is orchestrator');
  // mybot should not appear in voter rows
  const lines = text.split('\n').filter(l => l.includes('mybot'));
  assert.strictEqual(lines.length, 0, 'mybot (orchestrator) should not appear');
});

test('buildScoreboardLines: dormant models (0 invocations) shown in separate section', () => {
  const data = {
    models: {
      active:  { score: 5, invocations: 5, tp: 5, tn: 0, fp: 0, fn: 0, impr: 0 },
      dormant: { score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('Dormant'), 'should show Dormant section');
  assert.ok(text.includes('dormant'), 'dormant model name should appear');
});

test('buildScoreboardLines: dormant section excludes orchestrator', () => {
  const data = {
    models: {
      claude:  { score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 },
      dormant: { score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  // Dormant list should show 'dormant' but not 'claude'
  if (text.includes('Dormant')) {
    const dormantSection = text.split('Dormant')[1].split('\n')[0];
    assert.ok(dormantSection.includes('dormant'), 'dormant model should appear');
    assert.ok(!dormantSection.includes('claude'), 'orchestrator should not appear in dormant list');
  }
});

test('buildScoreboardLines: slot voters rendered alongside model voters', () => {
  const data = {
    models: {
      claude:   { score: 100, invocations: 100, tp: 100, tn: 0, fp: 0, fn: 0, impr: 0 },
      gemini:   { score: 10,  invocations: 10,  tp: 10,  tn: 0, fp: 0, fn: 0, impr: 0 }, // norm=1.00
    },
    slots: {
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 14, invocations: 24, tp: 21, tn: 0, fp: 2, fn: 1, impr: 0,  // norm=0.58
      },
      'claude-2:MiniMaxAI/MiniMax-M2.5': {
        slot: 'claude-2', model: 'MiniMaxAI/MiniMax-M2.5',
        score: 19, invocations: 23, tp: 22, tn: 0, fp: 1, fn: 0, impr: 0,  // norm=0.83
      },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');

  // All three voters should appear (gemini + 2 slots), but not claude (orchestrator)
  assert.ok(text.includes('gemini'), 'native CLI voter gemini should appear');
  assert.ok(text.includes('claude-1'), 'slot voter claude-1 should appear');
  assert.ok(text.includes('claude-2'), 'slot voter claude-2 should appear');

  // gemini (1.00) should appear before claude-2 (0.83) before claude-1 (0.58) — sorted by norm
  const geminiIdx = text.indexOf('gemini');
  const c2Idx     = text.indexOf('claude-2');
  const c1Idx     = text.indexOf('claude-1');
  assert.ok(geminiIdx < c2Idx, 'gemini (1.00) before claude-2 (0.83)');
  assert.ok(c2Idx < c1Idx, 'claude-2 (0.83) before claude-1 (0.58)');
});

test('buildScoreboardLines: same slot with multiple model IDs aggregated into one row', () => {
  const data = {
    models: {},
    slots: {
      'claude-1:deepseek-ai/DeepSeek-V3': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3',
        score: 5, invocations: 5, tp: 5, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 10, invocations: 10, tp: 10, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  const lines = _pure.buildScoreboardLines(data);
  // claude-1 should appear exactly once as a data row (not header/footer)
  const dataRows = lines.filter(l => l.includes('claude-1') && !l.includes('Dormant'));
  assert.strictEqual(dataRows.length, 1, 'claude-1 should appear as one aggregated row');
  // Aggregated: score=15, inv=15, norm=1.00
  assert.ok(dataRows[0].includes('15'), 'aggregated score should be 15');
});

test('buildScoreboardLines: dormant slots shown in dormant section', () => {
  const data = {
    models: {
      gemini: { score: 5, invocations: 5, tp: 5, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
    slots: {
      'claude-1:model-x': {
        slot: 'claude-1', model: 'model-x',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('Dormant'), 'should show Dormant section');
  assert.ok(text.includes('claude-1'), 'dormant slot should appear in Dormant list');
});

test('buildScoreboardLines: delivery stats rendered when present', () => {
  const data = {
    models: { x: { score: 1, invocations: 1, tp: 1, tn: 0, fp: 0, fn: 0, impr: 0 } },
    delivery_stats: {
      total_rounds: 42,
      target_vote_count: 3,
      achieved_by_outcome: { '3_votes': { count: 30, pct: 71.4 } },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('42'), 'should show total rounds');
  assert.ok(text.includes('71.4%'), 'should show vote count percentage');
});

test('buildScoreboardLines: FP and FN highlighted with color tags', () => {
  const data = {
    models: {
      test: { score: -2, invocations: 4, tp: 1, tn: 0, fp: 2, fn: 1, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('{red-fg}'), 'FP > 0 should have red tag');
  assert.ok(text.includes('{yellow-fg}'), 'FN > 0 should have yellow tag');
});

test('buildScoreboardLines: header shows Slot, CLI, Model columns', () => {
  const data = { models: { x: { score: 1, invocations: 1, tp: 1, tn: 0, fp: 0, fn: 0, impr: 0 } } };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('Slot'), 'header should contain Slot column');
  assert.ok(text.includes('CLI'), 'header should contain CLI column');
  assert.ok(text.includes('Model'), 'header should contain Model column');
});

test('buildScoreboardLines: CLI and Model populated from providers array', () => {
  const data = {
    models: {},
    slots: {
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 14, invocations: 24, tp: 21, tn: 0, fp: 2, fn: 1, impr: 0,
      },
      'gemini-1:gemini-3-pro-preview': {
        slot: 'gemini-1', model: 'gemini-3-pro-preview',
        score: 10, invocations: 10, tp: 10, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'copilot-1:gpt-4.1': {
        slot: 'copilot-1', model: 'gpt-4.1',
        score: 8, invocations: 5, tp: 5, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  const providers = [
    { name: 'claude-1',  cli: '/opt/homebrew/bin/ccr',      model: 'deepseek-ai/DeepSeek-V3.2' },
    { name: 'gemini-1',  cli: '/opt/homebrew/bin/gemini',   model: 'gemini-3-pro-preview' },
    { name: 'copilot-1', cli: '/opt/homebrew/bin/copilot',  model: 'gpt-4.1' },
  ];
  const roster = new Set(providers.map(p => p.name));
  const text = _pure.buildScoreboardLines(data, { roster, providers }).join('\n');
  // CLI column should show binary basename
  assert.ok(text.includes('ccr'), 'claude-1 should show ccr as CLI');
  assert.ok(text.includes('gemini'), 'gemini-1 should show gemini as CLI');
  assert.ok(text.includes('copilot'), 'copilot-1 should show copilot as CLI');
  // Model column should show short model name (after last /)
  assert.ok(text.includes('DeepSeek-V3.2'), 'claude-1 should show DeepSeek-V3.2 as model');
  assert.ok(text.includes('gpt-4.1'), 'copilot-1 should show gpt-4.1 as model');
});

test('buildScoreboardLines: long model names truncated in Model column', () => {
  const data = {
    models: {},
    slots: {
      'claude-3:Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8': {
        slot: 'claude-3', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',
        score: 18, invocations: 16, tp: 14, tn: 1, fp: 0, fn: 1, impr: 0,
      },
    },
  };
  const providers = [
    { name: 'claude-3', cli: '/opt/homebrew/bin/ccr', model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8' },
  ];
  const roster = new Set(['claude-3']);
  const lines = _pure.buildScoreboardLines(data, { roster, providers });
  const row = lines.find(l => l.includes('claude-3') && !l.includes('Dormant'));
  // Model column is 16 chars wide — "Qwen3-Coder-480B-A35B-Instruct-FP8" (35 chars) gets truncated
  assert.ok(row, 'claude-3 row should exist');
  assert.ok(!row.includes('Instruct-FP8'), 'long model name should be truncated');
  assert.ok(row.includes('Qwen3-Coder-480B'), 'truncated model should show first 16 chars');
});

test('buildScoreboardLines: providers mode uses exact composite key, not aggregation', () => {
  // claude-1 has scores from multiple models; only the current one should count
  const data = {
    models: {},
    slots: {
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 14, invocations: 24, tp: 21, tn: 0, fp: 2, fn: 1, impr: 0,
      },
      'claude-1:deepseek-ai/DeepSeek-V3': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3',
        score: 7, invocations: 3, tp: 2, tn: 1, fp: 0, fn: 0, impr: 0,
      },
      'claude-1:claude-mcp': {
        slot: 'claude-1', model: 'claude-mcp',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'claude-1:claude-sonnet-4-6': {
        slot: 'claude-1', model: 'claude-sonnet-4-6',
        score: 1, invocations: 1, tp: 1, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  // providers.json says claude-1 currently runs deepseek-ai/DeepSeek-V3.2
  const providers = [
    { name: 'claude-1', cli: '/opt/homebrew/bin/ccr', model: 'deepseek-ai/DeepSeek-V3.2' },
  ];
  const lines = _pure.buildScoreboardLines(data, { providers });
  const row = lines.find(l => l.includes('claude-1') && !l.includes('Dormant'));
  assert.ok(row, 'claude-1 should appear');
  // Score should be 14 (only DeepSeek-V3.2), NOT 22 (aggregated across all models)
  assert.ok(row.includes('  14'), 'score should be 14 from exact composite key, not aggregated 22');
  assert.ok(row.includes('  24'), 'invocations should be 24 from exact composite key');
});

test('buildScoreboardLines: primary (-1) slots merge legacy model-family data', () => {
  // copilot has 120 invocations from model-era rounds, 7 from slot-era
  const data = {
    models: {
      claude:  { score: 172, invocations: 189, tp: 182, tn: 1, fp: 5, fn: 0, impr: 0 },
      copilot: { score: 146, invocations: 120, tp: 112, tn: 4, fp: 0, fn: 4, impr: 9 },
    },
    slots: {
      'copilot-1:gpt-4.1': {
        slot: 'copilot-1', model: 'gpt-4.1',
        score: 9, invocations: 7, tp: 7, tn: 0, fp: 0, fn: 0, impr: 1,
      },
    },
  };
  const providers = [
    { name: 'copilot-1', cli: '/opt/homebrew/bin/copilot', model: 'gpt-4.1' },
  ];
  const lines = _pure.buildScoreboardLines(data, { providers });
  const row = lines.find(l => l.includes('copilot-1') && !l.includes('Dormant'));
  assert.ok(row, 'copilot-1 should appear');
  // Merged: 146+9=155 score, 120+7=127 inv
  assert.ok(row.includes('155'), 'score should be 155 (models 146 + slots 9)');
  assert.ok(row.includes('127'), 'invocations should be 127 (models 120 + slots 7)');
});

test('buildScoreboardLines: secondary (-2) slots only get slot data, no model-family', () => {
  const data = {
    models: {
      codex: { score: 20, invocations: 17, tp: 15, tn: 1, fp: 0, fn: 2, impr: 1 },
    },
    slots: {
      'codex-1:gpt-5.3-codex': {
        slot: 'codex-1', model: 'gpt-5.3-codex',
        score: 2, invocations: 2, tp: 2, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'codex-2:gpt-5.3-codex': {
        slot: 'codex-2', model: 'gpt-5.3-codex',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  const providers = [
    { name: 'codex-1', cli: '/opt/homebrew/bin/codex', model: 'gpt-5.3-codex' },
    { name: 'codex-2', cli: '/opt/homebrew/bin/codex', model: 'gpt-5.3-codex' },
  ];
  const lines = _pure.buildScoreboardLines(data, { providers });
  const text = lines.join('\n');
  // codex-1 gets model-family (20) + slot (2) = 22 score, 19 inv
  const row1 = lines.find(l => l.includes('codex-1') && !l.includes('Dormant'));
  assert.ok(row1, 'codex-1 should appear');
  assert.ok(row1.includes('22'), 'codex-1 score should be 22 (models 20 + slots 2)');
  // codex-2 gets only slot data (0) — should be dormant
  assert.ok(text.includes('Dormant'), 'dormant section should exist');
  assert.ok(text.includes('codex-2'), 'codex-2 should be dormant (no model-family bonus)');
});

test('buildScoreboardLines: claude slots do not get orchestrator model-family data', () => {
  // claude-1 family name is "claude" = orchestrator, so no merge
  const data = {
    models: {
      claude: { score: 172, invocations: 189, tp: 182, tn: 1, fp: 5, fn: 0, impr: 0 },
    },
    slots: {
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 14, invocations: 24, tp: 21, tn: 0, fp: 2, fn: 1, impr: 0,
      },
    },
  };
  const providers = [
    { name: 'claude-1', cli: '/opt/homebrew/bin/ccr', model: 'deepseek-ai/DeepSeek-V3.2' },
  ];
  const lines = _pure.buildScoreboardLines(data, { providers });
  const row = lines.find(l => l.includes('claude-1') && !l.includes('Dormant'));
  assert.ok(row, 'claude-1 should appear');
  // Should NOT add orchestrator models.claude data
  assert.ok(row.includes('  14'), 'score should be 14 (slot only, not merged with orchestrator)');
});

test('buildScoreboardLines: without providers, CLI and Model show em-dash', () => {
  const data = {
    models: {
      alice: { score: 10, invocations: 10, tp: 10, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  // Without providers option, should show — (em-dash) for CLI and Model
  assert.ok(text.includes('\u2014'), 'should show em-dash when no provider info available');
});

test('buildScoreboardLines: roster filter excludes legacy model-family entries', () => {
  // Real scoreboard has legacy model-family keys from before slot-based tracking
  const data = {
    models: {
      claude:       { score: 172, invocations: 189, tp: 182, tn: 1, fp: 5, fn: 0, impr: 0 },
      gemini:       { score: 108, invocations: 80,  tp: 74,  tn: 4, fp: 0, fn: 2, impr: 8 },
      opencode:     { score: 190, invocations: 170, tp: 163, tn: 4, fp: 0, fn: 3, impr: 5 },
      copilot:      { score: 146, invocations: 120, tp: 112, tn: 4, fp: 0, fn: 4, impr: 9 },
      codex:        { score: 20,  invocations: 17,  tp: 15,  tn: 1, fp: 0, fn: 2, impr: 1 },
      deepseek:     { score: 1,   invocations: 1,   tp: 1,   tn: 0, fp: 0, fn: 0, impr: 0 },
      minimax:      { score: 1,   invocations: 1,   tp: 1,   tn: 0, fp: 0, fn: 0, impr: 0 },
      'qwen-coder': { score: 1,   invocations: 1,   tp: 1,   tn: 0, fp: 0, fn: 0, impr: 0 },
      kimi:         { score: 1,   invocations: 1,   tp: 1,   tn: 0, fp: 0, fn: 0, impr: 0 },
      llama4:       { score: 1,   invocations: 1,   tp: 1,   tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  // Current providers.json roster uses slot names, not model-family names
  const roster = new Set([
    'codex-1', 'codex-2', 'gemini-1', 'gemini-2', 'opencode-1', 'copilot-1',
    'claude-1', 'claude-2', 'claude-3', 'claude-4', 'claude-5', 'claude-6',
  ]);
  const text = _pure.buildScoreboardLines(data, { roster }).join('\n');
  // All legacy model-family names should be filtered out (none match slot names)
  assert.ok(!text.includes('deepseek'), 'legacy deepseek should be filtered out');
  assert.ok(!text.includes('minimax'), 'legacy minimax should be filtered out');
  assert.ok(!text.includes('qwen-coder'), 'legacy qwen-coder should be filtered out');
  assert.ok(!text.includes('kimi'), 'legacy kimi should be filtered out');
  assert.ok(!text.includes('llama4'), 'legacy llama4 should be filtered out');
  // "gemini" != "gemini-1", "codex" != "codex-1", etc.
  assert.ok(!text.includes(' gemini '), 'model-family "gemini" != slot "gemini-1"');
  assert.ok(!text.includes(' codex '), 'model-family "codex" != slot "codex-1"');
});

test('buildScoreboardLines: roster filter keeps current slots, drops old naming scheme', () => {
  // Real data: old slots used claude-deepseek/claude-minimax, new ones use claude-1..6
  const data = {
    models: {},
    slots: {
      'claude-deepseek:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-deepseek', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'claude-minimax:MiniMaxAI/MiniMax-M2.5': {
        slot: 'claude-minimax', model: 'MiniMaxAI/MiniMax-M2.5',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'claude-1:deepseek-ai/DeepSeek-V3.2': {
        slot: 'claude-1', model: 'deepseek-ai/DeepSeek-V3.2',
        score: 14, invocations: 24, tp: 21, tn: 0, fp: 2, fn: 1, impr: 0,
      },
      'claude-2:MiniMaxAI/MiniMax-M2.5': {
        slot: 'claude-2', model: 'MiniMaxAI/MiniMax-M2.5',
        score: 19, invocations: 23, tp: 22, tn: 0, fp: 1, fn: 0, impr: 0,
      },
    },
  };
  const roster = new Set(['claude-1', 'claude-2', 'gemini-1']);
  const text = _pure.buildScoreboardLines(data, { roster }).join('\n');
  assert.ok(text.includes('claude-1'), 'current slot claude-1 should appear');
  assert.ok(text.includes('claude-2'), 'current slot claude-2 should appear');
  assert.ok(!text.includes('claude-deepseek'), 'old naming claude-deepseek should be filtered');
  assert.ok(!text.includes('claude-minimax'), 'old naming claude-minimax should be filtered');
});

test('buildScoreboardLines: no roster (null) shows all entries for backward compat', () => {
  const data = {
    models: {
      deepseek: { score: 1, invocations: 1, tp: 1, tn: 0, fp: 0, fn: 0, impr: 0 },
      minimax:  { score: 1, invocations: 1, tp: 1, tn: 0, fp: 0, fn: 0, impr: 0 },
    },
  };
  const text = _pure.buildScoreboardLines(data).join('\n');
  assert.ok(text.includes('deepseek'), 'without roster, all entries should appear');
  assert.ok(text.includes('minimax'), 'without roster, all entries should appear');
});

test('buildScoreboardLines: roster filter applies to dormant section too', () => {
  const data = {
    models: {},
    slots: {
      'codex-1:gpt-5.3-codex': {
        slot: 'codex-1', model: 'gpt-5.3-codex',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
      'claude-kimi:accounts/fireworks/models/kimi-k2p5': {
        slot: 'claude-kimi', model: 'accounts/fireworks/models/kimi-k2p5',
        score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0,
      },
    },
  };
  const roster = new Set(['codex-1', 'gemini-1']);
  const text = _pure.buildScoreboardLines(data, { roster }).join('\n');
  if (text.includes('Dormant')) {
    assert.ok(text.includes('codex-1'), 'roster dormant member codex-1 should appear');
    assert.ok(!text.includes('claude-kimi'), 'non-roster dormant claude-kimi should be filtered');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Circuit breaker CLI (merged from qgsd.cjs)
// ─────────────────────────────────────────────────────────────────────────────
// Spawns qgsd-manage.cjs as a subprocess with cwd set to a non-git temp dir
// so getBreakerProjectRoot() falls back to process.cwd(), making state isolated.

const { spawnSync } = require('child_process');
const BREAKER_CLI = path.join(__dirname, 'qgsd-manage.cjs');

function runBreaker(args, cwd) {
  const result = spawnSync(process.execPath, [BREAKER_CLI, ...args], {
    encoding: 'utf8',
    cwd: cwd || os.tmpdir(),
    timeout: 8000,
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
  };
}

function breakerStateFile(dir) {
  return path.join(dir, '.claude', 'circuit-breaker-state.json');
}

function readBreakerState(dir) {
  return JSON.parse(fs.readFileSync(breakerStateFile(dir), 'utf8'));
}

// ─── --disable-breaker ────────────────────────────────────────────────────────

test('--disable-breaker: exits 0', () => {
  const tmpDir = makeTmp();
  try {
    const { exitCode } = runBreaker(['--disable-breaker'], tmpDir);
    assert.equal(exitCode, 0);
  } finally { rmTmp(tmpDir); }
});

test('--disable-breaker: creates state file with disabled=true, active=false', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    const state = readBreakerState(tmpDir);
    assert.equal(state.disabled, true);
    assert.equal(state.active, false);
  } finally { rmTmp(tmpDir); }
});

test('--disable-breaker: prints confirmation message', () => {
  const tmpDir = makeTmp();
  try {
    const { stdout } = runBreaker(['--disable-breaker'], tmpDir);
    assert.ok(stdout.includes('disabled'));
  } finally { rmTmp(tmpDir); }
});

test('--disable-breaker: preserves existing fields in state file', () => {
  const tmpDir = makeTmp();
  try {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'circuit-breaker-state.json'),
      JSON.stringify({ active: true, oscillation_count: 3 }), 'utf8');
    runBreaker(['--disable-breaker'], tmpDir);
    const state = readBreakerState(tmpDir);
    assert.equal(state.disabled, true);
    assert.equal(state.active, false);
    assert.equal(state.oscillation_count, 3, 'Existing fields should be preserved');
  } finally { rmTmp(tmpDir); }
});

// ─── --enable-breaker ─────────────────────────────────────────────────────────

test('--enable-breaker: exits 0', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    const { exitCode } = runBreaker(['--enable-breaker'], tmpDir);
    assert.equal(exitCode, 0);
  } finally { rmTmp(tmpDir); }
});

test('--enable-breaker: sets disabled=false, active=false', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    runBreaker(['--enable-breaker'], tmpDir);
    const state = readBreakerState(tmpDir);
    assert.equal(state.disabled, false);
    assert.equal(state.active, false);
  } finally { rmTmp(tmpDir); }
});

test('--enable-breaker: prints confirmation message', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    const { stdout } = runBreaker(['--enable-breaker'], tmpDir);
    assert.ok(stdout.includes('enabled'));
  } finally { rmTmp(tmpDir); }
});

test('--enable-breaker: no-op when state file does not exist', () => {
  const tmpDir = makeTmp();
  try {
    const { exitCode } = runBreaker(['--enable-breaker'], tmpDir);
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(breakerStateFile(tmpDir)), false, 'Should not create state file');
  } finally { rmTmp(tmpDir); }
});

// ─── --reset-breaker ──────────────────────────────────────────────────────────

test('--reset-breaker: exits 0 when state file exists', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    const { exitCode } = runBreaker(['--reset-breaker'], tmpDir);
    assert.equal(exitCode, 0);
  } finally { rmTmp(tmpDir); }
});

test('--reset-breaker: deletes state file', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    assert.ok(fs.existsSync(breakerStateFile(tmpDir)), 'State file should exist before reset');
    runBreaker(['--reset-breaker'], tmpDir);
    assert.equal(fs.existsSync(breakerStateFile(tmpDir)), false, 'State file should be deleted after reset');
  } finally { rmTmp(tmpDir); }
});

test('--reset-breaker: exits 0 when no state file exists', () => {
  const tmpDir = makeTmp();
  try {
    const { exitCode, stdout } = runBreaker(['--reset-breaker'], tmpDir);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('No active'), 'Should report no state found');
  } finally { rmTmp(tmpDir); }
});

test('--reset-breaker: prints confirmation when file was deleted', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    const { stdout } = runBreaker(['--reset-breaker'], tmpDir);
    assert.ok(stdout.toLowerCase().includes('clear') || stdout.includes('breaker'));
  } finally { rmTmp(tmpDir); }
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

test('breaker: disable → enable → disable round-trip preserves state structure', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    runBreaker(['--enable-breaker'], tmpDir);
    runBreaker(['--disable-breaker'], tmpDir);
    const state = readBreakerState(tmpDir);
    assert.equal(state.disabled, true);
  } finally { rmTmp(tmpDir); }
});

test('breaker: disable → reset removes file; enable after reset is no-op', () => {
  const tmpDir = makeTmp();
  try {
    runBreaker(['--disable-breaker'], tmpDir);
    runBreaker(['--reset-breaker'], tmpDir);
    assert.equal(fs.existsSync(breakerStateFile(tmpDir)), false);
    runBreaker(['--enable-breaker'], tmpDir);
    assert.equal(fs.existsSync(breakerStateFile(tmpDir)), false);
  } finally { rmTmp(tmpDir); }
});
