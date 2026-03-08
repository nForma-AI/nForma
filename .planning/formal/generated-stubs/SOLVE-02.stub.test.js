#!/usr/bin/env node
// @requirement SOLVE-02
// Verifies: parseAlloyDefaults parses newline-separated constraint blocks,
// and formalTestSyncCache is cleared at each solver iteration.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const formalTestSyncPath = path.resolve(__dirname, '../../../bin/formal-test-sync.cjs');
const nfSolvePath = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-02: parseAlloyDefaults parses Alloy Defaults sig constraint block', () => {
  const { parseAlloyDefaults } = require(formalTestSyncPath);
  assert.ok(typeof parseAlloyDefaults === 'function', 'parseAlloyDefaults must be exported');

  const alloyContent = `
module test_model

one sig Defaults {
  fieldA: one Int,
  fieldB: one Int
} {
  fieldA = 3
  fieldB = 42
}
`;
  const result = parseAlloyDefaults(alloyContent);
  assert.strictEqual(result.fieldA, 3, 'should parse integer constant fieldA');
  assert.strictEqual(result.fieldB, 42, 'should parse integer constant fieldB');
});

test('SOLVE-02: parseAlloyDefaults returns empty object when no Defaults sig', () => {
  const { parseAlloyDefaults } = require(formalTestSyncPath);
  const result = parseAlloyDefaults('module empty\nsig Foo {}');
  assert.deepStrictEqual(result, {}, 'should return empty object for missing Defaults');
});

test('SOLVE-02: parseAlloyDefaults skips comments in constraint block', () => {
  const { parseAlloyDefaults } = require(formalTestSyncPath);
  const alloyContent = `
one sig Defaults {
  val: one Int
} {
  -- this is a comment
  val = 7
}
`;
  const result = parseAlloyDefaults(alloyContent);
  assert.strictEqual(result.val, 7, 'should skip comment lines and parse val');
});

test('SOLVE-02: formalTestSyncCache is cleared (set to null) at each solver iteration', () => {
  const source = fs.readFileSync(nfSolvePath, 'utf8');
  // The solver loop must clear the cache before calling computeResidual
  assert.match(source, /formalTestSyncCache\s*=\s*null/,
    'nf-solve.cjs must reset formalTestSyncCache to null in the iteration loop');
});
