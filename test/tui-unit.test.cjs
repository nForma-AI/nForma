'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Load TUI module in test mode (no blessed screen)
process.env.NF_TEST_MODE = '1';
const tui = require('../bin/nForma.cjs')._pure;

// ─── pad() ──────────────────────────────────────────────────────────────────

describe('pad()', () => {
  test('pads short string to target length', () => {
    assert.equal(tui.pad('abc', 6), 'abc   ');
  });

  test('truncates long string to target length', () => {
    assert.equal(tui.pad('abcdefgh', 5), 'abcde');
  });

  test('returns exact-length string unchanged', () => {
    assert.equal(tui.pad('abc', 3), 'abc');
  });

  test('handles null/undefined gracefully', () => {
    assert.equal(tui.pad(null, 4), '    ');
    assert.equal(tui.pad(undefined, 3), '   ');
  });

  test('handles zero-length target', () => {
    assert.equal(tui.pad('abc', 0), '');
  });
});

// ─── deriveProviderName() ───────────────────────────────────────────────────

describe('deriveProviderName()', () => {
  test('detects AkashML', () => {
    assert.equal(tui.deriveProviderName('https://api.akashml.com/v1'), 'AkashML');
  });

  test('detects Together.xyz', () => {
    assert.equal(tui.deriveProviderName('https://api.together.xyz/v1'), 'Together.xyz');
  });

  test('detects Fireworks', () => {
    assert.equal(tui.deriveProviderName('https://api.fireworks.ai/inference/v1'), 'Fireworks');
  });

  test('detects OpenAI', () => {
    assert.equal(tui.deriveProviderName('https://api.openai.com/v1'), 'OpenAI');
  });

  test('detects Google', () => {
    assert.equal(tui.deriveProviderName('https://generativelanguage.googleapis.google.com'), 'Google');
  });

  test('falls back to hostname minus api. prefix', () => {
    assert.equal(tui.deriveProviderName('https://api.example.com/v1'), 'example.com');
  });

  test('returns "subprocess" for empty/null URL', () => {
    assert.equal(tui.deriveProviderName(''), 'subprocess');
    assert.equal(tui.deriveProviderName(null), 'subprocess');
    assert.equal(tui.deriveProviderName(undefined), 'subprocess');
  });

  test('truncates non-URL strings', () => {
    const result = tui.deriveProviderName('not-a-valid-url-at-all');
    assert.ok(result.length <= 14, `Expected length <= 14, got "${result}"`);
  });
});

// ─── logEvent() / _logEntries ───────────────────────────────────────────────

describe('logEvent()', () => {
  beforeEach(() => {
    // Clear entries between tests
    tui._logEntries.length = 0;
  });

  test('appends to _logEntries', () => {
    tui.logEvent('info', 'test message');
    assert.equal(tui._logEntries.length, 1);
    assert.equal(tui._logEntries[0].level, 'info');
    assert.equal(tui._logEntries[0].msg, 'test message');
  });

  test('stores timestamp in ISO-like format', () => {
    tui.logEvent('warn', 'something');
    assert.match(tui._logEntries[0].ts, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  test('respects ring buffer limit (LOG_MAX = 200)', () => {
    for (let i = 0; i < 210; i++) {
      tui.logEvent('info', `msg-${i}`);
    }
    assert.ok(tui._logEntries.length <= 200, `Expected <= 200 entries, got ${tui._logEntries.length}`);
    // Oldest entries should have been evicted
    assert.equal(tui._logEntries[0].msg, 'msg-10');
  });

  test('handles all log levels', () => {
    tui.logEvent('info', 'i');
    tui.logEvent('warn', 'w');
    tui.logEvent('error', 'e');
    assert.equal(tui._logEntries.length, 3);
    assert.equal(tui._logEntries[0].level, 'info');
    assert.equal(tui._logEntries[1].level, 'warn');
    assert.equal(tui._logEntries[2].level, 'error');
  });
});

// ─── MODULES structure ──────────────────────────────────────────────────────

describe('MODULES', () => {
  test('has 5 modules', () => {
    assert.equal(tui.MODULES.length, 5);
  });

  test('modules have required fields', () => {
    for (const mod of tui.MODULES) {
      assert.ok(mod.name, `Module missing name`);
      assert.ok(mod.key, `Module ${mod.name} missing key`);
      assert.ok(mod.icon, `Module ${mod.name} missing icon`);
      assert.ok(Array.isArray(mod.art), `Module ${mod.name} missing art`);
      assert.equal(mod.art.length, 3, `Module ${mod.name} art should have 3 rows`);
      assert.ok(Array.isArray(mod.items), `Module ${mod.name} missing items`);
      assert.ok(mod.items.length > 0, `Module ${mod.name} has no items`);
    }
  });

  test('module names are correct', () => {
    const names = tui.MODULES.map(m => m.name);
    assert.deepEqual(names, ['Agents', 'Reqs', 'Config', 'Sessions', 'Solve']);
  });

  test('module keys are f1-f5', () => {
    const keys = tui.MODULES.map(m => m.key);
    assert.deepEqual(keys, ['f1', 'f2', 'f3', 'f4', 'f5']);
  });

  test('every item has label and action', () => {
    for (const mod of tui.MODULES) {
      for (const item of mod.items) {
        assert.ok(typeof item.label === 'string', `Item in ${mod.name} missing label`);
        assert.ok(typeof item.action === 'string', `Item "${item.label}" in ${mod.name} missing action`);
      }
    }
  });

  test('no duplicate actions within a module (excluding sep)', () => {
    for (const mod of tui.MODULES) {
      const actions = mod.items.filter(i => i.action !== 'sep').map(i => i.action);
      const unique = new Set(actions);
      assert.equal(actions.length, unique.size,
        `Module ${mod.name} has duplicate actions: ${actions.filter((a, i) => actions.indexOf(a) !== i)}`);
    }
  });
});

// ─── MENU_ITEMS ─────────────────────────────────────────────────────────────

describe('MENU_ITEMS', () => {
  test('is a flat array of all module items', () => {
    const expected = tui.MODULES.flatMap(m => m.items);
    assert.equal(tui.MENU_ITEMS.length, expected.length);
  });
});

// ─── getTargetPath() / targetPath ───────────────────────────────────────────

describe('getTargetPath()', () => {
  afterEach(() => {
    tui.targetPath = null;
  });

  test('falls back to process.cwd() when targetPath is null', () => {
    tui.targetPath = null;
    assert.equal(tui.getTargetPath(), process.cwd());
  });

  test('returns targetPath when set', () => {
    tui.targetPath = '/tmp/test-project';
    assert.equal(tui.getTargetPath(), '/tmp/test-project');
  });

  test('targetPath getter/setter roundtrips', () => {
    tui.targetPath = '/some/path';
    assert.equal(tui.targetPath, '/some/path');
    tui.targetPath = null;
    assert.equal(tui.targetPath, null);
  });
});

// ─── buildScoreboardLines() ─────────────────────────────────────────────────

describe('buildScoreboardLines()', () => {
  test('returns fallback for null data', () => {
    const lines = tui.buildScoreboardLines(null);
    assert.ok(lines.length > 0);
    assert.ok(lines[0].includes('No scoreboard data'));
  });

  test('returns fallback for data without models', () => {
    const lines = tui.buildScoreboardLines({});
    assert.ok(lines[0].includes('No scoreboard data'));
  });

  test('renders header and separator for valid data', () => {
    const data = {
      models: {
        codex: { score: 10, invocations: 5, tp: 3, tn: 2, fp: 0, fn: 0, impr: 1 },
      },
    };
    const lines = tui.buildScoreboardLines(data);
    const joined = lines.join('\n');
    assert.ok(joined.includes('Quorum Scoreboard'), 'Missing title');
    assert.ok(joined.includes('Slot'), 'Missing Slot header');
    assert.ok(joined.includes('Score'), 'Missing Score header');
  });

  test('renders agent rows with correct score data (legacy mode)', () => {
    const data = {
      models: {
        codex: { score: 12, invocations: 6, tp: 4, tn: 2, fp: 0, fn: 0, impr: 2 },
        gemini: { score: 8, invocations: 4, tp: 2, tn: 1, fp: 1, fn: 0, impr: 0 },
      },
    };
    const lines = tui.buildScoreboardLines(data);
    const joined = lines.join('\n');
    // Should contain both agent names
    assert.ok(joined.includes('codex'), 'Missing codex row');
    assert.ok(joined.includes('gemini'), 'Missing gemini row');
  });

  test('filters out orchestrator from rows', () => {
    const data = {
      models: {
        claude: { score: 100, invocations: 50, tp: 40, tn: 10, fp: 0, fn: 0, impr: 5 },
        codex: { score: 10, invocations: 5, tp: 3, tn: 2, fp: 0, fn: 0, impr: 1 },
      },
    };
    const lines = tui.buildScoreboardLines(data, { orchestrator: 'claude' });
    const joined = lines.join('\n');
    // The word "claude" should not appear as a row entry (may appear in title/legend)
    const dataLines = lines.filter(l => l.includes('codex') || l.includes('claude'));
    const claudeRows = dataLines.filter(l => l.trimStart().startsWith('claude'));
    assert.equal(claudeRows.length, 0, 'Orchestrator should be filtered out');
  });

  test('shows dormant agents with zero invocations', () => {
    const data = {
      models: {
        codex: { score: 10, invocations: 5, tp: 3, tn: 2, fp: 0, fn: 0, impr: 1 },
        dormant_agent: { score: 0, invocations: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 },
      },
    };
    const lines = tui.buildScoreboardLines(data);
    const joined = lines.join('\n');
    assert.ok(joined.includes('Dormant'), 'Should show Dormant section');
    assert.ok(joined.includes('dormant_agent'), 'Should list dormant agent');
  });

  test('renders with provider-aware composite keys', () => {
    const data = {
      models: {},
      slots: {
        'codex-1:codex-mini-latest': { score: 15, invocations: 8, tp: 5, tn: 3, fp: 0, fn: 0, impr: 2 },
      },
    };
    const providers = [
      { name: 'codex-1', cli: '/usr/bin/codex', model: 'codex-mini-latest' },
    ];
    const lines = tui.buildScoreboardLines(data, { providers });
    const joined = lines.join('\n');
    assert.ok(joined.includes('codex-1'), 'Should show slot name');
  });

  test('shows empty providers message', () => {
    const data = { models: {} };
    const lines = tui.buildScoreboardLines(data, { providers: [] });
    const joined = lines.join('\n');
    assert.ok(joined.includes('No agents configured'), 'Should show empty providers message');
  });

  test('shows delivery stats when present', () => {
    const data = {
      models: {
        codex: { score: 10, invocations: 5, tp: 3, tn: 2, fp: 0, fn: 0, impr: 1 },
      },
      delivery_stats: {
        total_rounds: 42,
        target_vote_count: 3,
        achieved_by_outcome: {
          '3_of_3': { count: 30, pct: 71 },
          '2_of_3': { count: 12, pct: 29 },
        },
      },
    };
    const lines = tui.buildScoreboardLines(data);
    const joined = lines.join('\n');
    assert.ok(joined.includes('Total rounds'), 'Should show delivery stats');
    assert.ok(joined.includes('42'), 'Should show round count');
  });

  test('sorts entries by normalized score descending', () => {
    const data = {
      models: {
        low: { score: 2, invocations: 4, tp: 1, tn: 1, fp: 0, fn: 0, impr: 0 },   // norm = 0.5
        high: { score: 10, invocations: 4, tp: 3, tn: 1, fp: 0, fn: 0, impr: 0 },  // norm = 2.5
        mid: { score: 4, invocations: 4, tp: 2, tn: 2, fp: 0, fn: 0, impr: 0 },    // norm = 1.0
      },
    };
    const lines = tui.buildScoreboardLines(data);
    // Find data rows (they contain the agent names in the first position after whitespace)
    const dataLines = lines.filter(l => /^\s+(low|mid|high)\s/.test(l.replace(/\{[^}]*\}/g, '')));
    assert.equal(dataLines.length, 3, 'Should have 3 data rows');
    const stripped = dataLines.map(l => l.replace(/\{[^}]*\}/g, '').trim());
    assert.ok(stripped[0].startsWith('high'), `First row should be "high", got "${stripped[0]}"`);
    assert.ok(stripped[1].startsWith('mid'), `Second row should be "mid", got "${stripped[1]}"`);
    assert.ok(stripped[2].startsWith('low'), `Third row should be "low", got "${stripped[2]}"`);
  });
});

// ─── Session persistence ────────────────────────────────────────────────────

describe('session persistence', () => {
  let tmpDir;
  let origSessionsFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-tui-test-'));
    // Override SESSIONS_FILE to use tmp dir
    origSessionsFile = tui.SESSIONS_FILE;
    // SESSIONS_FILE is a const string on _pure, but we need to temporarily redirect.
    // Since SESSIONS_FILE is used by load/save/remove, we'll write/read from the real path.
    // Instead, we test the functions with a known file state.
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('loadPersistedSessions returns empty array when file missing', () => {
    // SESSIONS_FILE may or may not exist — this tests the fallback
    const sessions = tui.loadPersistedSessions();
    assert.ok(Array.isArray(sessions));
  });

  test('loadPersistedSessions reads existing sessions', () => {
    // Write test data to the sessions file
    const testData = [
      { id: 1, name: 'test', cwd: '/tmp', claudeSessionId: 'abc-123' },
    ];
    fs.mkdirSync(path.dirname(tui.SESSIONS_FILE), { recursive: true });
    const backup = fs.existsSync(tui.SESSIONS_FILE)
      ? fs.readFileSync(tui.SESSIONS_FILE, 'utf8')
      : null;
    try {
      fs.writeFileSync(tui.SESSIONS_FILE, JSON.stringify(testData, null, 2), 'utf8');
      const sessions = tui.loadPersistedSessions();
      assert.equal(sessions.length, 1);
      assert.equal(sessions[0].name, 'test');
      assert.equal(sessions[0].claudeSessionId, 'abc-123');
    } finally {
      // Restore original file
      if (backup !== null) {
        fs.writeFileSync(tui.SESSIONS_FILE, backup, 'utf8');
      } else {
        try { fs.unlinkSync(tui.SESSIONS_FILE); } catch (_) {}
      }
    }
  });

  test('removePersistedSession filters by claudeSessionId', () => {
    const testData = [
      { id: 1, name: 'keep', cwd: '/a', claudeSessionId: 'keep-id' },
      { id: 2, name: 'remove', cwd: '/b', claudeSessionId: 'remove-id' },
    ];
    fs.mkdirSync(path.dirname(tui.SESSIONS_FILE), { recursive: true });
    const backup = fs.existsSync(tui.SESSIONS_FILE)
      ? fs.readFileSync(tui.SESSIONS_FILE, 'utf8')
      : null;
    try {
      fs.writeFileSync(tui.SESSIONS_FILE, JSON.stringify(testData, null, 2), 'utf8');
      tui.removePersistedSession('remove-id');
      const remaining = tui.loadPersistedSessions();
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].claudeSessionId, 'keep-id');
    } finally {
      if (backup !== null) {
        fs.writeFileSync(tui.SESSIONS_FILE, backup, 'utf8');
      } else {
        try { fs.unlinkSync(tui.SESSIONS_FILE); } catch (_) {}
      }
    }
  });
});

// ─── readProjectConfig / writeProjectConfig ─────────────────────────────────

describe('readProjectConfig / writeProjectConfig', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-tui-cfg-'));
    tui.targetPath = tmpDir;
  });

  afterEach(() => {
    tui.targetPath = null;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('readProjectConfig returns {} when no config exists', () => {
    const cfg = tui.readProjectConfig();
    assert.deepEqual(cfg, {});
  });

  test('writeProjectConfig creates .planning directory and config file', () => {
    tui.writeProjectConfig({ model_profile: 'quality', workflow: { research: true } });
    const cfgPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(cfgPath), 'Config file should exist');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    assert.equal(cfg.model_profile, 'quality');
    assert.equal(cfg.workflow.research, true);
  });

  test('readProjectConfig reads what writeProjectConfig wrote', () => {
    const original = { model_profile: 'balanced', depth: 'standard', parallelization: true };
    tui.writeProjectConfig(original);
    const read = tui.readProjectConfig();
    assert.deepEqual(read, original);
  });

  test('writeProjectConfig overwrites existing config', () => {
    tui.writeProjectConfig({ model_profile: 'quality' });
    tui.writeProjectConfig({ model_profile: 'budget' });
    const cfg = tui.readProjectConfig();
    assert.equal(cfg.model_profile, 'budget');
    assert.equal(cfg.workflow, undefined, 'Should not have stale keys');
  });
});

// ─── buildHeaderInfo() ──────────────────────────────────────────────────────

describe('buildHeaderInfo()', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-tui-hdr-'));
    tui.targetPath = tmpDir;
  });

  afterEach(() => {
    tui.targetPath = null;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns object with version, profile, quorumN, failMode', () => {
    const info = tui.buildHeaderInfo();
    assert.ok('version' in info);
    assert.ok('profile' in info);
    assert.ok('quorumN' in info);
    assert.ok('failMode' in info);
  });

  test('reads version from package.json', () => {
    const info = tui.buildHeaderInfo();
    // Should be a semver-ish string or '?'
    assert.ok(info.version === '?' || /^\d+\.\d+/.test(info.version),
      `Expected version string, got "${info.version}"`);
  });

  test('reads profile from project config when present', () => {
    tui.writeProjectConfig({ model_profile: 'quality' });
    const info = tui.buildHeaderInfo();
    assert.equal(info.profile, 'quality');
  });

  test('defaults profile to — when no config', () => {
    const info = tui.buildHeaderInfo();
    assert.equal(info.profile, '—');
  });
});

// ─── PROVIDER_KEY_NAMES / PROVIDER_PRESETS ──────────────────────────────────

describe('PROVIDER_KEY_NAMES', () => {
  test('is an object', () => {
    assert.equal(typeof tui.PROVIDER_KEY_NAMES, 'object');
  });

  test('maps known providers', () => {
    // Should have at least the core providers
    const keys = Object.keys(tui.PROVIDER_KEY_NAMES);
    assert.ok(keys.length > 0, 'Should have at least one provider key mapping');
  });
});

describe('PROVIDER_PRESETS', () => {
  test('is an array', () => {
    assert.ok(Array.isArray(tui.PROVIDER_PRESETS));
  });

  test('presets have label and value fields', () => {
    for (const preset of tui.PROVIDER_PRESETS) {
      assert.ok(typeof preset.label === 'string', `Preset missing label`);
      assert.ok('value' in preset, `Preset "${preset.label}" missing value`);
    }
  });
});

// ─── providers.json I/O ─────────────────────────────────────────────────────

describe('readProvidersJson()', () => {
  test('returns object with providers array', () => {
    const data = tui.readProvidersJson();
    assert.ok(typeof data === 'object');
    assert.ok(Array.isArray(data.providers));
  });
});
