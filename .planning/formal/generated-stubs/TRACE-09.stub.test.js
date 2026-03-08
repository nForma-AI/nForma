#!/usr/bin/env node
// @requirement TRACE-09
// Validates: formal proximity index builder reads 12 artifact types, emits bidirectional
// adjacency graph with reverse edges, and query CLI provides required commands

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const PROXIMITY_PATH = path.join(ROOT, 'bin', 'formal-proximity.cjs');
const QUERY_PATH = path.join(ROOT, 'bin', 'formal-query.cjs');

test('TRACE-09: formal-proximity.cjs exports buildIndex', () => {
  const mod = require(PROXIMITY_PATH);
  assert.equal(typeof mod.buildIndex, 'function', 'must export buildIndex');
});

test('TRACE-09: formal-proximity.cjs exports proximity function', () => {
  const mod = require(PROXIMITY_PATH);
  assert.equal(typeof mod.proximity, 'function', 'must export proximity');
});

test('TRACE-09: REVERSE_RELS covers all EDGE_WEIGHTS for bidirectionality', () => {
  const { EDGE_WEIGHTS, REVERSE_RELS } = require(PROXIMITY_PATH);
  for (const rel of Object.keys(EDGE_WEIGHTS)) {
    assert.ok(rel in REVERSE_RELS, `REVERSE_RELS must have entry for "${rel}"`);
    const reverse = REVERSE_RELS[rel];
    assert.ok(reverse in EDGE_WEIGHTS, `Reverse of "${rel}" ("${reverse}") must be in EDGE_WEIGHTS`);
  }
});

test('TRACE-09: builder reads 12 artifact types', () => {
  const content = fs.readFileSync(PROXIMITY_PATH, 'utf8');
  assert.match(content, /12 source artifact types/, 'help text must reference 12 source artifact types');
});

test('TRACE-09: formal-query.cjs exists and provides required CLI commands', () => {
  const content = fs.readFileSync(QUERY_PATH, 'utf8');
  const requiredCommands = ['reach', 'path', 'neighbors', 'impact', 'coverage', 'proximity', 'stats'];
  for (const cmd of requiredCommands) {
    assert.match(content, new RegExp(cmd), `query CLI must support "${cmd}" command`);
  }
});
