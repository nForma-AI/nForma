#!/usr/bin/env node
'use strict';
// bin/xstate-to-tla.test.cjs
// Error-path tests for bin/xstate-to-tla.cjs.
// All tests check error conditions only — no esbuild compilation or file I/O.
// Requirements: INTG-01, INTG-02

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');

const XSTATE_TO_TLA = path.join(__dirname, 'xstate-to-tla.cjs');

test('exits non-zero with usage message when no input file is provided', () => {
  const result = spawnSync(process.execPath, [XSTATE_TO_TLA], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /Usage|machine-file/i);
});

test('exits non-zero with file-not-found error for nonexistent input file', () => {
  const result = spawnSync(process.execPath, [XSTATE_TO_TLA, '/nonexistent/path/machine.ts'], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr, /File not found|not found/i);
});
