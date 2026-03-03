'use strict';
// Tests for bin/auth-drivers/pool.cjs
// node --test bin/auth-drivers/pool.test.cjs

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const ACM_PATH  = require.resolve('../account-manager.cjs');
const POOL_PATH = require.resolve('./pool.cjs');

// Build a full mock acm with controllable return values.
function makeAcm(overrides = {}) {
  return {
    getCredsDir:          (_p) => '/fake/creds',
    listPool:             (_d) => ['alice', 'bob'],
    readActivePtr:        (_d) => 'alice',
    getActiveFile:        (_p) => '/fake/active.json',
    extractEmailFromCreds: (_f) => 'alice@example.com',
    AccountManagerFSM:    class {},
    cmdSwitch:            () => {},
    cmdAdd:               async () => {},
    ...overrides,
  };
}

// Inject mockAcm, delete pool from cache (forces fresh load), run fn, restore.
// Works for both sync and async fn — the module-level `acm` ref is captured
// at require() time, so restoring the cache entry after load is safe.
function withMockAcm(mockAcm, fn) {
  const savedAcm  = require.cache[ACM_PATH];
  const savedPool = require.cache[POOL_PATH];

  require.cache[ACM_PATH] = {
    id: ACM_PATH, filename: ACM_PATH, loaded: true,
    exports: mockAcm,
  };
  delete require.cache[POOL_PATH];

  let result;
  try {
    result = fn(require('./pool.cjs'));
  } finally {
    if (savedAcm)  require.cache[ACM_PATH]  = savedAcm;
    else           delete require.cache[ACM_PATH];
    if (savedPool) require.cache[POOL_PATH] = savedPool;
    else           delete require.cache[POOL_PATH];
  }
  return result; // may be a Promise — test() handles async
}

// ─── 1. list() ────────────────────────────────────────────────────────────────

test('list returns pool entries with correct active flag', () => {
  withMockAcm(makeAcm({
    listPool:      () => ['alice', 'bob', 'charlie'],
    readActivePtr: () => 'bob',
  }), (pool) => {
    const accounts = pool.list({});
    assert.deepStrictEqual(accounts, [
      { name: 'alice',   active: false },
      { name: 'bob',     active: true  },
      { name: 'charlie', active: false },
    ]);
  });
});

test('list returns empty array when pool directory is empty', () => {
  withMockAcm(makeAcm({
    listPool:      () => [],
    readActivePtr: () => null,
  }), (pool) => {
    assert.deepStrictEqual(pool.list({}), []);
  });
});

test('list marks no entry active when active pointer does not match any name', () => {
  withMockAcm(makeAcm({
    listPool:      () => ['alice', 'bob'],
    readActivePtr: () => 'charlie', // not in pool
  }), (pool) => {
    const accounts = pool.list({});
    assert.ok(accounts.every(a => !a.active), 'no entry should be active');
  });
});

// ─── 2. switch() ──────────────────────────────────────────────────────────────

test('switch creates an FSM and passes provider + name to cmdSwitch', () => {
  let fsmInstance = null;
  let switchArgs  = null;

  withMockAcm(makeAcm({
    AccountManagerFSM: class { constructor() { fsmInstance = this; } },
    cmdSwitch: (fsm, provider, name) => { switchArgs = { fsm, provider, name }; },
  }), (pool) => {
    const provider = { name: 'gemini-1' };
    pool.switch(provider, 'bob');

    assert.ok(fsmInstance !== null, 'FSM should have been instantiated');
    assert.strictEqual(switchArgs.fsm,      fsmInstance);
    assert.strictEqual(switchArgs.provider, provider);
    assert.strictEqual(switchArgs.name,     'bob');
  });
});

// ─── 3. addCredentialFile() ───────────────────────────────────────────────────

test('addCredentialFile returns the active_file path from acm.getActiveFile', () => {
  const expected = '/home/user/.gemini/oauth_creds.json';

  withMockAcm(makeAcm({
    getActiveFile: () => expected,
  }), (pool) => {
    assert.strictEqual(pool.addCredentialFile({}), expected);
  });
});

// ─── 4. extractAccountName() ──────────────────────────────────────────────────

test('extractAccountName returns email decoded from JWT (Gemini case)', () => {
  withMockAcm(makeAcm({
    extractEmailFromCreds: () => 'alice@gmail.com',
  }), (pool) => {
    assert.strictEqual(pool.extractAccountName({}), 'alice@gmail.com');
  });
});

test('extractAccountName returns null when no id_token present (Codex case)', () => {
  withMockAcm(makeAcm({
    extractEmailFromCreds: () => null,
  }), (pool) => {
    assert.strictEqual(pool.extractAccountName({}), null);
  });
});

// ─── 5. add() ─────────────────────────────────────────────────────────────────

test('add creates an FSM and calls cmdAdd with false interactive flag', async () => {
  let addArgs = null;

  // Manually manage cache so the async promise can complete after finally runs.
  const savedAcm  = require.cache[ACM_PATH];
  const savedPool = require.cache[POOL_PATH];

  const mockAcm = makeAcm({
    AccountManagerFSM: class {},
    cmdAdd: async (fsm, provider, name, flag) => { addArgs = { fsm, provider, name, flag }; },
  });

  require.cache[ACM_PATH] = {
    id: ACM_PATH, filename: ACM_PATH, loaded: true,
    exports: mockAcm,
  };
  delete require.cache[POOL_PATH];

  const pool     = require('./pool.cjs');
  const provider = { name: 'gemini-1' };

  try {
    await pool.add(provider, 'alice');
  } finally {
    if (savedAcm)  require.cache[ACM_PATH]  = savedAcm;
    else           delete require.cache[ACM_PATH];
    if (savedPool) require.cache[POOL_PATH] = savedPool;
    else           delete require.cache[POOL_PATH];
  }

  assert.ok(addArgs !== null, 'cmdAdd should have been called');
  assert.strictEqual(addArgs.provider, provider);
  assert.strictEqual(addArgs.name,     'alice');
  assert.strictEqual(addArgs.flag,     false, 'interactive flag must be false');
});
