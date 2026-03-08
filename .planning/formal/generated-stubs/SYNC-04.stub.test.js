#!/usr/bin/env node
// @requirement SYNC-04
// Structural test: nForma code lives in separate files (hooks/, bin/) and does not modify GSD source files.
// The source file (run-account-pool-alloy.cjs) is a standalone Alloy runner — verify it exists
// and only requires from bin/ (its own directory), not from GSD core source.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/run-account-pool-alloy.cjs');

test('SYNC-04: run-account-pool-alloy.cjs exists as a separate file', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/run-account-pool-alloy.cjs should exist');
});

test('SYNC-04: run-account-pool-alloy.cjs does not require from GSD core source paths', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify it only requires from relative paths (./), node builtins, or npm packages
  // It should NOT require from gsd-core/ or modify GSD files
  const requireLines = content.match(/require\([^)]+\)/g) || [];
  for (const req of requireLines) {
    // Should not require from gsd source directories
    assert.ok(
      !req.includes('gsd-core/') && !req.includes('core/src/'),
      'Should not require from GSD core source: ' + req
    );
  }
});

test('SYNC-04: run-account-pool-alloy.cjs uses writeCheckResult for output (does not write to GSD files)', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify it uses writeCheckResult (nForma's own output mechanism)
  assert.match(content, /writeCheckResult/, 'Should use writeCheckResult for structured output');
  // Verify it does not use fs.writeFileSync to modify files outside .planning/
  const writeFileCalls = content.match(/fs\.writeFileSync\(/g) || [];
  // run-account-pool-alloy.cjs should have zero direct fs.writeFileSync calls
  // (it delegates to writeCheckResult)
  assert.equal(writeFileCalls.length, 0, 'Should not directly write files — delegates to writeCheckResult');
});
