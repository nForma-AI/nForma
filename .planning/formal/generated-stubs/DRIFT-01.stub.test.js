#!/usr/bin/env node
// @requirement DRIFT-01
// Behavioral test: check-trace-schema-drift.cjs detects schema drift and produces correct results

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { checkSchemaDrift, KNOWN_EMITTERS } = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'check-trace-schema-drift.cjs'));

test('DRIFT-01 — CompleteDrift: pass when no schema file changed', () => {
  const result = checkSchemaDrift(['bin/foo.cjs', 'hooks/nf-stop.js']);
  assert.equal(result.status, 'pass');
  assert.equal(result.reason, 'no-schema-change');
});

test('DRIFT-01 — CompleteDrift: fail when schema changed without validator + emitter', () => {
  const result = checkSchemaDrift(['.planning/formal/trace/trace.schema.json']);
  assert.equal(result.status, 'fail');
  assert.equal(result.reason, 'schema-drift-detected');
  assert.equal(result.schema_changed, true);
});

test('DRIFT-01 — CompleteDrift: pass when schema changed atomically with validator and emitter', () => {
  const result = checkSchemaDrift([
    '.planning/formal/trace/trace.schema.json',
    'bin/validate-traces.cjs',
    'hooks/nf-stop.js',
  ]);
  assert.equal(result.status, 'pass');
  assert.equal(result.reason, 'schema-change-atomic');
});

test('DRIFT-01 — CompleteDrift: fail when schema changed with validator only (no emitter)', () => {
  const result = checkSchemaDrift([
    '.planning/formal/trace/trace.schema.json',
    'bin/validate-traces.cjs',
  ]);
  assert.equal(result.status, 'fail');
  assert.equal(result.reason, 'schema-drift-detected');
  assert.equal(result.validator_updated, true);
  assert.equal(result.emitter_updated, false);
});

test('DRIFT-01 — KNOWN_EMITTERS is a non-empty array', () => {
  assert.ok(Array.isArray(KNOWN_EMITTERS));
  assert.ok(KNOWN_EMITTERS.length > 0, 'KNOWN_EMITTERS must list at least one emitter file');
});
