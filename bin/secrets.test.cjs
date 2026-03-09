#!/usr/bin/env node
// Test suite for bin/secrets.cjs
// Uses Node.js built-in test runner: node --test bin/secrets.test.cjs
//
// Strategy:
//   - hasKey / index tests: use real temp files.  loadSecretsWithTmpHome patches
//     os.homedir() before require so that the module-level INDEX_PATH constant
//     resolves into a temp directory.
//   - syncToClaudeJson tests: additionally swap require.cache[keytar].exports
//     with a mock object.  os.homedir must remain patched through the async
//     call because syncToClaudeJson re-evaluates os.homedir() at call time.
//   - SERVICE constant: verified directly from the exported module.
//
// Keytar mock approach:
//   `require('keytar')` is first called to populate the require cache, then
//   `require.cache[resolvedKeytarPath].exports` is replaced with a mock object.
//   getKeytar() inside secrets.cjs uses `require('keytar')` lazily, which hits
//   the same cache entry and therefore returns the mock.

'use strict';

const { test, before, after } = require('node:test');
const assert   = require('node:assert/strict');
const fs       = require('fs');
const os       = require('os');
const path     = require('path');

const SECRETS_PATH = path.join(__dirname, 'secrets.cjs');

// Populate the keytar cache entry once so we can swap .exports in tests.
let KEYTAR_PATH = null;
let REAL_KEYTAR_EXPORTS = null;
try {
  KEYTAR_PATH = require.resolve('keytar');
  require('keytar');                                      // populate cache
  if (require.cache[KEYTAR_PATH]) {
    REAL_KEYTAR_EXPORTS = require.cache[KEYTAR_PATH].exports;
  } else {
    KEYTAR_PATH = null; // resolve succeeded but load failed (CI: native addon missing)
  }
} catch (_) {
  KEYTAR_PATH = null; // keytar not installed — Module._load path used instead
}

// ─── Global keytar safety net ─────────────────────────────────────────────────
// Active for the entire test run. Any accidental real-keychain call becomes a
// test error (clear message) rather than a macOS password dialog.
// Individual tests that need specific keytar behaviour call installMockKeytar()
// inside their own try/finally, which temporarily overrides this mock.
const SAFE_KEYTAR_MOCK = {
  setPassword:     async (s, k) => { throw new Error('[test-guard] unexpected keytar.setPassword(' + s + '/' + k + ')'); },
  getPassword:     async (s, k) => { throw new Error('[test-guard] unexpected keytar.getPassword(' + s + '/' + k + ')'); },
  deletePassword:  async (s, k) => { throw new Error('[test-guard] unexpected keytar.deletePassword(' + s + '/' + k + ')'); },
  findCredentials: async (s)    => { throw new Error('[test-guard] unexpected keytar.findCredentials(' + s + ')'); },
};
// Saved restore fn for the Module._load path (when keytar native addon is absent).
let _moduleLoadRestore = null;
before(() => {
  const restore = installMockKeytar(SAFE_KEYTAR_MOCK);
  if (!KEYTAR_PATH) _moduleLoadRestore = restore; // keep only for Module._load teardown
});
// Restore the real keytar explicitly — direct assignment, no closure chain.
after(() => {
  if (KEYTAR_PATH && REAL_KEYTAR_EXPORTS) {
    require.cache[KEYTAR_PATH].exports = REAL_KEYTAR_EXPORTS;
  } else if (_moduleLoadRestore) {
    _moduleLoadRestore();
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir() {
  const dir = path.join(
    os.tmpdir(),
    'nf-secrets-' + Date.now() + '-' + Math.random().toString(36).slice(2)
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Clear secrets.cjs from the require cache so the next require() produces a
 * fresh module instance with module-level constants re-evaluated.
 */
function clearSecretsCache() {
  delete require.cache[require.resolve(SECRETS_PATH)];
}

/**
 * Install mockKeytar by replacing the current keytar cache entry.
 * Saves whatever was there before (may be the global SAFE_KEYTAR_MOCK or a
 * prior test's mock) and restores it on cleanup — not always REAL_KEYTAR_EXPORTS.
 * This means the global safety net is automatically restored after each test.
 */
function installMockKeytar(mockKeytar) {
  if (!KEYTAR_PATH) {
    // keytar not installed — inject via Module._load so the mock is returned
    // even when require('keytar') would normally throw.
    const Module = require('module');
    const orig   = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === 'keytar') return mockKeytar;
      return orig.call(this, request, parent, isMain);
    };
    return () => { Module._load = orig; };
  }
  const prev = require.cache[KEYTAR_PATH].exports; // save current (may be SAFE_KEYTAR_MOCK)
  require.cache[KEYTAR_PATH].exports = mockKeytar;
  return () => { require.cache[KEYTAR_PATH].exports = prev; }; // restore previous, not always REAL
}

/**
 * Patch os.homedir to return tmpDir, clear the secrets module cache, require
 * a fresh copy of secrets.cjs (which captures the patched homedir for its
 * module-level INDEX_PATH), then return the fresh module.
 *
 * IMPORTANT: os.homedir is NOT restored here.  For syncToClaudeJson tests the
 * caller must keep the patch alive through the async call and restore
 * afterwards — syncToClaudeJson re-evaluates os.homedir() at call time.
 * For synchronous hasKey tests it is safe to restore immediately.
 */
function requireSecretsWithTmpHome(tmpDir) {
  clearSecretsCache();
  os.homedir = () => tmpDir;
  return require(SECRETS_PATH);
}

function restoreHomedir(real) {
  os.homedir = real;
}

/**
 * Write the key index JSON into <tmpDir>/.claude/nf-key-index.json.
 * Mirrors what writeIndex() does inside secrets.cjs.
 */
function writeKeyIndex(tmpDir, accounts) {
  const indexPath = path.join(tmpDir, '.claude', 'nf-key-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({ accounts }, null, 2), 'utf8');
}

/**
 * Write a fake ~/.claude.json into tmpDir (so that path.join(homedir, '.claude.json')
 * resolves to <tmpDir>/.claude.json).
 */
function writeClaudeJson(tmpDir, content) {
  const filePath = path.join(tmpDir, '.claude.json');
  if (typeof content === 'string') {
    fs.writeFileSync(filePath, content, 'utf8');
  } else {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  }
}

// ─── SERVICE constant ─────────────────────────────────────────────────────────

test('SERVICE constant equals "nforma"', () => {
  clearSecretsCache();
  const { SERVICE } = require(SECRETS_PATH);
  assert.equal(SERVICE, 'nforma');
  clearSecretsCache();
});

// ─── Module export shape ──────────────────────────────────────────────────────

test('module exports the expected named exports', () => {
  clearSecretsCache();
  const mod = require(SECRETS_PATH);
  const expected = [
    'set', 'get', 'delete', 'list', 'hasKey', 'syncToClaudeJson', 'SERVICE',
    'patchClaudeJsonForKey', 'patchCcrConfigForKey', 'CCR_KEY_MAP',
  ];
  for (const name of expected) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(mod, name),
      `Expected export "${name}" to be present`
    );
  }
  assert.equal(typeof mod.set,                   'function', 'set should be a function');
  assert.equal(typeof mod.get,                   'function', 'get should be a function');
  assert.equal(typeof mod.delete,                'function', 'delete should be a function');
  assert.equal(typeof mod.list,                  'function', 'list should be a function');
  assert.equal(typeof mod.hasKey,                'function', 'hasKey should be a function');
  assert.equal(typeof mod.syncToClaudeJson,      'function', 'syncToClaudeJson should be a function');
  assert.equal(typeof mod.patchClaudeJsonForKey, 'function', 'patchClaudeJsonForKey should be a function');
  assert.equal(typeof mod.patchCcrConfigForKey,  'function', 'patchCcrConfigForKey should be a function');
  assert.equal(typeof mod.CCR_KEY_MAP,           'object',   'CCR_KEY_MAP should be an object');
  assert.equal(typeof mod.SERVICE,               'string',   'SERVICE should be a string');
  clearSecretsCache();
});

// ─── hasKey — index present ───────────────────────────────────────────────────

test('hasKey: returns true when key exists in index', () => {
  const tmpDir = makeTmpDir();
  writeKeyIndex(tmpDir, ['MY_API_KEY', 'ANOTHER_KEY']);

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('MY_API_KEY'),   true,  'MY_API_KEY should be found');
    assert.equal(mod.hasKey('ANOTHER_KEY'),  true,  'ANOTHER_KEY should be found');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false for key not in index', () => {
  const tmpDir = makeTmpDir();
  writeKeyIndex(tmpDir, ['SOME_OTHER_KEY']);

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('NONEXISTENT_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false when index file does not exist', () => {
  const tmpDir = makeTmpDir();
  // Intentionally no index file written

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('ANY_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false when .claude directory does not exist', () => {
  const tmpDir = makeTmpDir();
  // No .claude directory at all

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('ANY_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false when index file contains invalid JSON', () => {
  const tmpDir = makeTmpDir();
  const indexDir = path.join(tmpDir, '.claude');
  fs.mkdirSync(indexDir, { recursive: true });
  fs.writeFileSync(path.join(indexDir, 'nf-key-index.json'), '{ not valid json }', 'utf8');

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('ANY_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false when index accounts array is empty', () => {
  const tmpDir = makeTmpDir();
  writeKeyIndex(tmpDir, []);

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('ANY_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('hasKey: returns false when index JSON has no accounts field', () => {
  const tmpDir = makeTmpDir();
  const indexPath = path.join(tmpDir, '.claude', 'nf-key-index.json');
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, JSON.stringify({ someOtherField: [] }), 'utf8');

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.equal(mod.hasKey('ANY_KEY'), false);
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

// ─── syncToClaudeJson — credentials matched and patched ──────────────────────

test('syncToClaudeJson: patches matching env keys across multiple servers', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'OPENAI_API_KEY', password: 'sk-test-abc123' },
      { account: 'ANTHROPIC_KEY',  password: 'sk-ant-xyz789'  },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'my-server': {
        command: 'node',
        args: ['server.js'],
        env: {
          OPENAI_API_KEY: 'old-openai-value',
          UNRELATED_KEY:  'should-not-change',
        },
      },
      'another-server': {
        command: 'python',
        args: ['run.py'],
        env: {
          ANTHROPIC_KEY: 'old-anthropic-value',
        },
      },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  // Keep os.homedir patched through the async call
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const written = JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8')
  );
  assert.equal(
    written.mcpServers['my-server'].env.OPENAI_API_KEY,
    'sk-test-abc123',
    'OPENAI_API_KEY should be patched with the credential value'
  );
  assert.equal(
    written.mcpServers['my-server'].env.UNRELATED_KEY,
    'should-not-change',
    'UNRELATED_KEY should be left untouched'
  );
  assert.equal(
    written.mcpServers['another-server'].env.ANTHROPIC_KEY,
    'sk-ant-xyz789',
    'ANTHROPIC_KEY in another-server should be patched'
  );
});

// ─── syncToClaudeJson — empty credentials list ───────────────────────────────

test('syncToClaudeJson: does not write claude.json when credentials list is empty', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: { 'my-server': { env: { KEY: 'original' } } },
  });

  const claudeJsonPath = path.join(tmpDir, '.claude.json');
  const mtimeBefore = fs.statSync(claudeJsonPath).mtimeMs;

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const mtimeAfter = fs.statSync(claudeJsonPath).mtimeMs;
  assert.equal(
    mtimeAfter,
    mtimeBefore,
    'claude.json should NOT be rewritten when credentials list is empty'
  );
});

// ─── syncToClaudeJson — no matching env keys ────────────────────────────────

test('syncToClaudeJson: does not write claude.json when no env key matches any credential', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'UNRELATED_SECRET', password: 'val' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'my-server': {
        env: { DIFFERENT_KEY: 'original-value' },
      },
    },
  });

  const claudeJsonPath = path.join(tmpDir, '.claude.json');
  const mtimeBefore = fs.statSync(claudeJsonPath).mtimeMs;

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const mtimeAfter = fs.statSync(claudeJsonPath).mtimeMs;
  assert.equal(
    mtimeAfter,
    mtimeBefore,
    'claude.json should NOT be rewritten when no env keys match credentials'
  );
});

// ─── syncToClaudeJson — claude.json absent ──────────────────────────────────

test('syncToClaudeJson: exits silently when claude.json does not exist', async () => {
  const tmpDir = makeTmpDir();
  // Intentionally no .claude.json written

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'SOME_KEY', password: 'some-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw when claude.json is absent'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  assert.equal(
    fs.existsSync(path.join(tmpDir, '.claude.json')),
    false,
    'claude.json should not be created by syncToClaudeJson'
  );
});

// ─── syncToClaudeJson — invalid JSON ─────────────────────────────────────────

test('syncToClaudeJson: exits silently when claude.json contains invalid JSON', async () => {
  const tmpDir = makeTmpDir();
  const corruptContent = '{ this is not : valid JSON !!!';
  writeClaudeJson(tmpDir, corruptContent);

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'SOME_KEY', password: 'some-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw on invalid JSON'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  // The corrupt file should remain unchanged (not overwritten)
  const still = fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8');
  assert.equal(still, corruptContent, 'corrupt file should not be overwritten');
});

// ─── syncToClaudeJson — mcpServers missing ───────────────────────────────────

test('syncToClaudeJson: exits silently when mcpServers is missing from claude.json', async () => {
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, { someOtherConfig: { key: 'value' } });

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'SOME_KEY', password: 'some-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  const claudeJsonPath  = path.join(tmpDir, '.claude.json');
  const contentBefore   = fs.readFileSync(claudeJsonPath, 'utf8');

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw when mcpServers is absent'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const contentAfter = fs.readFileSync(claudeJsonPath, 'utf8');
  assert.equal(contentAfter, contentBefore, 'claude.json should not be modified when mcpServers absent');
});

// ─── syncToClaudeJson — mcpServers is not an object ─────────────────────────

test('syncToClaudeJson: exits silently when mcpServers is not an object', async () => {
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, { mcpServers: 'not-an-object' });

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'SOME_KEY', password: 'some-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  const claudeJsonPath = path.join(tmpDir, '.claude.json');
  const contentBefore  = fs.readFileSync(claudeJsonPath, 'utf8');

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw when mcpServers is a non-object'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const contentAfter = fs.readFileSync(claudeJsonPath, 'utf8');
  assert.equal(contentAfter, contentBefore, 'claude.json should not be modified');
});

// ─── syncToClaudeJson — servers without env block ────────────────────────────

test('syncToClaudeJson: skips servers without env block, patches servers that have one', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'SOME_KEY', password: 'patched-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'server-no-env': {
        command: 'node',
        args: ['server.js'],
        // No env block
      },
      'server-with-env': {
        command: 'node',
        args: ['other.js'],
        env: { SOME_KEY: 'original' },
      },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const written = JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8')
  );
  assert.ok(
    !written.mcpServers['server-no-env'].env,
    'server without env block should not have env added'
  );
  assert.equal(
    written.mcpServers['server-with-env'].env.SOME_KEY,
    'patched-value',
    'server with matching env key should be patched'
  );
});

// ─── syncToClaudeJson — keytar error ─────────────────────────────────────────

test('syncToClaudeJson: handles keytar error gracefully — writes to stderr, does not throw', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => {
      throw new Error('mock keytar failure');
    },
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: { 'my-server': { env: { KEY: 'original' } } },
  });

  const claudeJsonPath = path.join(tmpDir, '.claude.json');
  const contentBefore  = fs.readFileSync(claudeJsonPath, 'utf8');

  // Capture stderr output
  const stderrChunks = [];
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    stderrChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return origStderrWrite(chunk, ...rest);
  };

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw on keytar failure'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    process.stderr.write = origStderrWrite;
    clearSecretsCache();
  }

  const stderrOutput = stderrChunks.join('');
  assert.ok(
    stderrOutput.includes('[nf-secrets]'),
    'should write a [nf-secrets] diagnostic message to stderr'
  );
  assert.ok(
    stderrOutput.includes('mock keytar failure') || stderrOutput.includes('keytar'),
    'stderr message should mention keytar or the underlying error'
  );

  // claude.json should not have been modified
  const contentAfter = fs.readFileSync(claudeJsonPath, 'utf8');
  assert.equal(contentAfter, contentBefore, 'claude.json should be unchanged after keytar error');
});

// ─── syncToClaudeJson — output format ────────────────────────────────────────

test('syncToClaudeJson: writes valid JSON with 2-space indent after patching', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'API_KEY', password: 'secret-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'test-server': {
        env: { API_KEY: 'old-value' },
      },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const raw    = fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8');
  const parsed = JSON.parse(raw);    // must parse without error

  assert.equal(
    parsed.mcpServers['test-server'].env.API_KEY,
    'secret-value',
    'API_KEY should be patched to secret-value'
  );
  // JSON.stringify with 2-space indent produces lines starting with '  '
  assert.ok(
    raw.includes('\n  '),
    'output JSON should use 2-space indentation'
  );
});

// ─── syncToClaudeJson — multiple credentials, all patched ────────────────────

test('syncToClaudeJson: patches all matching credentials across one server', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'KEY_A', password: 'value-a' },
      { account: 'KEY_B', password: 'value-b' },
      { account: 'KEY_C', password: 'value-c' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'multi-server': {
        env: {
          KEY_A: 'orig-a',
          KEY_B: 'orig-b',
          KEY_C: 'orig-c',
        },
      },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await mod.syncToClaudeJson('nforma');
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }

  const written = JSON.parse(
    fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8')
  );
  assert.equal(written.mcpServers['multi-server'].env.KEY_A, 'value-a');
  assert.equal(written.mcpServers['multi-server'].env.KEY_B, 'value-b');
  assert.equal(written.mcpServers['multi-server'].env.KEY_C, 'value-c');
});

// ─── syncToClaudeJson — credentials with null/undefined password ─────────────

test('syncToClaudeJson: does not throw when credentials contain null or undefined password', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    findCredentials: async (_service) => [
      { account: 'NULL_KEY',      password: null      },
      { account: 'UNDEFINED_KEY', password: undefined },
      { account: 'REAL_KEY',      password: 'real-value' },
    ],
    setPassword:    async () => {},
    getPassword:    async () => null,
    deletePassword: async () => false,
  };

  writeClaudeJson(tmpDir, {
    mcpServers: {
      'my-server': {
        env: {
          NULL_KEY:      'original-null',
          UNDEFINED_KEY: 'original-undefined',
          REAL_KEY:      'original-real',
        },
      },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    await assert.doesNotReject(
      () => mod.syncToClaudeJson('nforma'),
      'syncToClaudeJson should not throw when credentials contain null/undefined passwords'
    );
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }
});

// ─── set/get/delete/list return Promises with mock keytar ─────────────────────

test('set, get, delete, list all return Promises when mock keytar is installed', async () => {
  const tmpDir = makeTmpDir();

  const mockKeytar = {
    setPassword:     async () => {},
    getPassword:     async () => 'mock-password',
    deletePassword:  async () => true,
    findCredentials: async () => [{ account: 'k', password: 'v' }],
  };

  const realHomedir = os.homedir.bind(os);
  const restoreKeytar = installMockKeytar(mockKeytar);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    const setResult    = mod.set('nforma', 'TEST_KEY', 'test-val');
    const getResult    = mod.get('nforma', 'TEST_KEY');
    const deleteResult = mod.delete('nforma', 'TEST_KEY');
    const listResult   = mod.list('nforma');

    assert.ok(typeof setResult.then    === 'function', 'set() should return a Promise');
    assert.ok(typeof getResult.then    === 'function', 'get() should return a Promise');
    assert.ok(typeof deleteResult.then === 'function', 'delete() should return a Promise');
    assert.ok(typeof listResult.then   === 'function', 'list() should return a Promise');

    // Consume promises to prevent unhandled-rejection noise
    await Promise.allSettled([setResult, getResult, deleteResult, listResult]);
  } finally {
    restoreHomedir(realHomedir);
    restoreKeytar();
    clearSecretsCache();
  }
});

// ─── CCR_KEY_MAP ──────────────────────────────────────────────────────────────

test('CCR_KEY_MAP maps the three provider env keys to their CCR provider names', () => {
  clearSecretsCache();
  const { CCR_KEY_MAP } = require(SECRETS_PATH);
  assert.equal(CCR_KEY_MAP['FIREWORKS_API_KEY'], 'fireworks', 'FIREWORKS_API_KEY → fireworks');
  assert.equal(CCR_KEY_MAP['AKASHML_API_KEY'],   'akashml',   'AKASHML_API_KEY → akashml');
  assert.equal(CCR_KEY_MAP['TOGETHER_API_KEY'],  'together',  'TOGETHER_API_KEY → together');
  clearSecretsCache();
});

// ─── patchClaudeJsonForKey ────────────────────────────────────────────────────

test('patchClaudeJsonForKey: patches matching env key and leaves others unchanged', () => {
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, {
    mcpServers: {
      'srv': { env: { FIREWORKS_API_KEY: 'old', OTHER: 'unchanged' } },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchClaudeJsonForKey('FIREWORKS_API_KEY', 'new-val');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  const out = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8'));
  assert.equal(out.mcpServers['srv'].env.FIREWORKS_API_KEY, 'new-val', 'key should be patched');
  assert.equal(out.mcpServers['srv'].env.OTHER, 'unchanged', 'unrelated key should be untouched');
});

test('patchClaudeJsonForKey: patches across multiple servers', () => {
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, {
    mcpServers: {
      'srv-a': { env: { AKASHML_API_KEY: 'old-a', OTHER: 'keep' } },
      'srv-b': { env: { AKASHML_API_KEY: 'old-b' } },
    },
  });

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchClaudeJsonForKey('AKASHML_API_KEY', 'new-akash');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  const out = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8'));
  assert.equal(out.mcpServers['srv-a'].env.AKASHML_API_KEY, 'new-akash');
  assert.equal(out.mcpServers['srv-b'].env.AKASHML_API_KEY, 'new-akash');
  assert.equal(out.mcpServers['srv-a'].env.OTHER, 'keep');
});

test('patchClaudeJsonForKey: does not throw when claude.json absent', () => {
  const tmpDir = makeTmpDir();

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.doesNotThrow(() => mod.patchClaudeJsonForKey('ANY_KEY', 'val'));
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('patchClaudeJsonForKey: no write when key not present in any env block', () => {
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, {
    mcpServers: { 'srv': { env: { OTHER: 'original' } } },
  });

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchClaudeJsonForKey('MISSING_KEY', 'val');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  const out = JSON.parse(fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8'));
  assert.equal(out.mcpServers['srv'].env.OTHER, 'original', 'content should be unchanged');
});

test('patchClaudeJsonForKey: uses atomic write (no partial file on crash)', () => {
  // Verify the patched file is valid JSON (not a torn write)
  const tmpDir = makeTmpDir();
  writeClaudeJson(tmpDir, {
    mcpServers: { 'srv': { env: { TOGETHER_API_KEY: 'old' } } },
  });

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchClaudeJsonForKey('TOGETHER_API_KEY', 'new-together');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  // tmp file should have been cleaned up
  assert.equal(
    fs.existsSync(path.join(tmpDir, '.claude.json.tmp')), false,
    '.claude.json.tmp should not exist after successful write'
  );
  // Output must be valid JSON
  const raw = fs.readFileSync(path.join(tmpDir, '.claude.json'), 'utf8');
  assert.doesNotThrow(() => JSON.parse(raw), 'patched file must be valid JSON');
});

// ─── patchCcrConfigForKey ─────────────────────────────────────────────────────

test('patchCcrConfigForKey: patches matching provider api_key', () => {
  const tmpDir = makeTmpDir();
  const ccrDir = path.join(tmpDir, '.claude-code-router');
  fs.mkdirSync(ccrDir, { recursive: true });
  const configPath = path.join(ccrDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    providers: [
      { name: 'fireworks', api_key: 'old-fw' },
      { name: 'together',  api_key: 'together-key' },
    ],
  }));

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchCcrConfigForKey('FIREWORKS_API_KEY', 'new-fw-key');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  const out = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(out.providers[0].api_key, 'new-fw-key', 'fireworks api_key should be patched');
  assert.equal(out.providers[1].api_key, 'together-key', 'together api_key should be unchanged');
});

test('patchCcrConfigForKey: unknown env key → no-op', () => {
  const tmpDir = makeTmpDir();
  const ccrDir = path.join(tmpDir, '.claude-code-router');
  fs.mkdirSync(ccrDir, { recursive: true });
  const configPath = path.join(ccrDir, 'config.json');
  const original = JSON.stringify({ providers: [{ name: 'fireworks', api_key: 'orig' }] });
  fs.writeFileSync(configPath, original);

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchCcrConfigForKey('ANTHROPIC_KEY', 'some-val'); // not in CCR_KEY_MAP
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  assert.equal(fs.readFileSync(configPath, 'utf8'), original, 'file should be unchanged for unknown key');
});

test('patchCcrConfigForKey: does not throw when config file absent', () => {
  const tmpDir = makeTmpDir();
  // No .claude-code-router directory at all

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    assert.doesNotThrow(() => mod.patchCcrConfigForKey('FIREWORKS_API_KEY', 'fw-key'));
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }
});

test('patchCcrConfigForKey: patches all providers with matching name (case-insensitive)', () => {
  const tmpDir = makeTmpDir();
  const ccrDir = path.join(tmpDir, '.claude-code-router');
  fs.mkdirSync(ccrDir, { recursive: true });
  const configPath = path.join(ccrDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({
    providers: [
      { name: 'Fireworks', api_key: 'old-1' },
      { name: 'FIREWORKS', api_key: 'old-2' },
    ],
  }));

  const realHomedir = os.homedir.bind(os);
  const mod = requireSecretsWithTmpHome(tmpDir);
  try {
    mod.patchCcrConfigForKey('FIREWORKS_API_KEY', 'new-fw');
  } finally {
    restoreHomedir(realHomedir);
    clearSecretsCache();
  }

  const out = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(out.providers[0].api_key, 'new-fw', 'Fireworks (title case) should be patched');
  assert.equal(out.providers[1].api_key, 'new-fw', 'FIREWORKS (upper case) should be patched');
});
