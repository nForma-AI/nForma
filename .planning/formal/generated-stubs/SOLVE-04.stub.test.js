#!/usr/bin/env node
// @requirement SOLVE-04
// Verifies: R->D gap detection scoped to developer-category docs (docs/dev/),
// and the Alloy model's Requirement sig is defined in solver-doc-layers.als.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const nfSolvePath = path.resolve(__dirname, '../../../bin/nf-solve.cjs');
const alloyModelPath = path.resolve(__dirname, '../../../.planning/formal/alloy/solver-doc-layers.als');

test('SOLVE-04: solver-doc-layers.als defines Requirement sig', () => {
  const content = fs.readFileSync(alloyModelPath, 'utf8');
  assert.match(content, /sig\s+Requirement\s*\{/,
    'Alloy model must define Requirement sig');
});

test('SOLVE-04: solver-doc-layers.als defines DocFile sig with mentions and claims', () => {
  const content = fs.readFileSync(alloyModelPath, 'utf8');
  assert.match(content, /sig\s+DocFile\s*\{/,
    'Alloy model must define DocFile sig');
  assert.match(content, /mentions:\s*set\s+ReqId/,
    'DocFile must have mentions field for literal ID references');
  assert.match(content, /claims:\s*set\s+StructuralClaim/,
    'DocFile must have claims field for D->C structural claims');
});

test('SOLVE-04: nf-solve.cjs exports sweepRtoD for R->D gap detection', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.sweepRtoD === 'function',
    'sweepRtoD must be exported for R->D gap detection');
});

test('SOLVE-04: nf-solve.cjs references doc category for scoping', () => {
  const source = fs.readFileSync(nfSolvePath, 'utf8');
  assert.match(source, /category/,
    'discoverDocFiles must track category for scoping R->D to dev docs');
});

test('SOLVE-04: solver-doc-layers.als models false-positive filtering for structural claims', () => {
  const content = fs.readFileSync(alloyModelPath, 'utf8');
  assert.match(content, /isFalsePositive/,
    'Alloy model must include false-positive filtering for structural claims');
});
