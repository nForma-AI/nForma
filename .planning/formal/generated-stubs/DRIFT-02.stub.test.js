#!/usr/bin/env node
// @requirement DRIFT-02
// Structural test: Schema drift check runs as CI step in run-formal-verify.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DRIFT-02 — CompleteDrift: run-formal-verify.cjs includes ci:trace-schema-drift step', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  assert.match(content, /ci:trace-schema-drift/, 'must reference ci:trace-schema-drift check id');
  assert.match(content, /check-trace-schema-drift\.cjs/, 'must reference the drift check script');
});

test('DRIFT-02 — CompleteDrift: check-trace-schema-drift.cjs exists and exports checkSchemaDrift', () => {
  const mod = require(path.join(ROOT, 'bin', 'check-trace-schema-drift.cjs'));
  assert.equal(typeof mod.checkSchemaDrift, 'function', 'must export checkSchemaDrift function');
});

test('DRIFT-02 — CompleteDrift: run-formal-verify.cjs registers drift check as type=node CI step', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-formal-verify.cjs'), 'utf8');
  // The step must be a node-type entry with the correct script
  assert.match(content, /tool:\s*'ci'/, 'drift step must have tool: ci');
  assert.match(content, /type:\s*'node'/, 'drift step must be type: node');
  assert.match(content, /script:\s*'check-trace-schema-drift\.cjs'/, 'drift step must specify correct script');
});
