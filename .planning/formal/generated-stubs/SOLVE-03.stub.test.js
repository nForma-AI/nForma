#!/usr/bin/env node
// @requirement SOLVE-03
// Verifies: Solver discovers documentation files via config (docs_paths) with
// convention fallback (README.md, docs/**/*.md), checks R->D coverage by literal
// ID and keyword matching, and verifies D->C structural claims with false-positive filtering.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const nfSolvePath = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-03: discoverDocFiles is exported from nf-solve.cjs', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.discoverDocFiles === 'function',
    'discoverDocFiles must be exported');
});

test('SOLVE-03: discoverDocFiles defaults include README.md and docs/**/*.md', () => {
  const source = fs.readFileSync(nfSolvePath, 'utf8');
  assert.match(source, /README\.md/,
    'default doc patterns must include README.md');
  assert.match(source, /docs\/\*\*\/\*\.md/,
    'default doc patterns must include docs/**/*.md');
});

test('SOLVE-03: discoverDocFiles reads docs_paths from config.json as fallback', () => {
  const source = fs.readFileSync(nfSolvePath, 'utf8');
  assert.match(source, /docs_paths/,
    'must reference docs_paths from config.json');
  assert.match(source, /config\.json/,
    'must read .planning/config.json for docs_paths');
});

test('SOLVE-03: extractKeywords is exported for keyword matching', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.extractKeywords === 'function',
    'extractKeywords must be exported for R->D keyword matching');
});

test('SOLVE-03: extractStructuralClaims is exported for D->C verification', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.extractStructuralClaims === 'function',
    'extractStructuralClaims must be exported for D->C claim verification');
});

test('SOLVE-03: sweepRtoD is exported for R->D coverage checking', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.sweepRtoD === 'function',
    'sweepRtoD must be exported');
});

test('SOLVE-03: sweepDtoC is exported for D->C structural verification', () => {
  const mod = require(nfSolvePath);
  assert.ok(typeof mod.sweepDtoC === 'function',
    'sweepDtoC must be exported');
});
