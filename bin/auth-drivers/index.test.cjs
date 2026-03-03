'use strict';
// Tests for bin/auth-drivers/index.cjs
// node --test bin/auth-drivers/index.test.cjs

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const POOL_PATH  = require.resolve('./pool.cjs');
const { loadDriver } = require('./index.cjs');

// ─── 1. Known drivers load and satisfy the interface ─────────────────────────

for (const type of ['pool', 'gh-cli', 'simple']) {
  test(`loadDriver('${type}') returns all 4 required methods`, () => {
    const driver = loadDriver(type);
    assert.ok(driver, 'driver is not null');
    for (const m of ['list', 'switch', 'addCredentialFile', 'extractAccountName']) {
      assert.strictEqual(typeof driver[m], 'function',
        `${type} driver missing method: ${m}()`);
    }
  });
}

// ─── 2. null / undefined → null (no auth configured) ─────────────────────────

test('loadDriver(null) returns null', () => {
  assert.strictEqual(loadDriver(null), null);
});

test('loadDriver(undefined) returns null', () => {
  assert.strictEqual(loadDriver(undefined), null);
});

// ─── 3. Unknown type → clear MODULE_NOT_FOUND error ──────────────────────────

test('loadDriver with unknown type throws with driver name in message', () => {
  assert.throws(
    () => loadDriver('no-such-driver'),
    (err) => {
      assert.ok(err.message.includes('no-such-driver'), `got: ${err.message}`);
      return true;
    }
  );
});

// ─── 4. Driver missing a method → interface error ────────────────────────────

test('loadDriver with incomplete driver throws interface error naming the missing method', () => {
  const savedPool = require.cache[POOL_PATH];

  // Replace pool driver temporarily with one missing 'switch'
  require.cache[POOL_PATH] = {
    id: POOL_PATH, filename: POOL_PATH, loaded: true,
    exports: {
      list:               () => [],
      // switch intentionally absent
      addCredentialFile:  () => null,
      extractAccountName: () => null,
    },
  };

  try {
    assert.throws(
      () => loadDriver('pool'),
      (err) => {
        assert.ok(err.message.includes('switch'), `expected "switch" in: ${err.message}`);
        return true;
      }
    );
  } finally {
    if (savedPool) require.cache[POOL_PATH] = savedPool;
    else delete require.cache[POOL_PATH];
  }
});
