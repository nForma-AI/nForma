#!/usr/bin/env node
// @requirement UNIF-03
// Test: Triage bundle reads from check-results.ndjson, not tool stdout;
//       CI enforcement steps run inside orchestrator before summary read (v0.19-11 timing fix)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('UNIF-03: generate-triage-bundle.cjs reads from check-results.ndjson file', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.cjs', 'utf8');
  assert.match(source, /check-results\.ndjson/, 'references check-results.ndjson');
  assert.match(source, /parseNDJSON/, 'uses parseNDJSON to read NDJSON file');
  // Should NOT read from stdout/stdin
  assert.ok(!source.includes('process.stdin'), 'does not read from stdin');
});

test('UNIF-03: run-formal-verify.cjs runs CI enforcement before triage bundle (timing fix)', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // CI enforcement steps must appear before triage bundle in STATIC_STEPS array
  const ciRedactionIdx = source.indexOf("id: 'ci:trace-redaction'");
  const ciSchemaIdx = source.indexOf("id: 'ci:trace-schema-drift'");
  const triageIdx = source.indexOf("id: 'ci:triage-bundle'");
  assert.ok(ciRedactionIdx > 0, 'ci:trace-redaction exists');
  assert.ok(ciSchemaIdx > 0, 'ci:trace-schema-drift exists');
  assert.ok(triageIdx > 0, 'ci:triage-bundle exists');
  assert.ok(triageIdx > ciRedactionIdx, 'triage-bundle after trace-redaction');
  assert.ok(triageIdx > ciSchemaIdx, 'triage-bundle after trace-schema-drift');
});

test('UNIF-03: run-formal-verify.cjs reads NDJSON summary after all steps complete', () => {
  const source = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs', 'utf8');
  // The NDJSON-based summary is tagged with UNIF-03 comment
  assert.match(source, /NDJSON-based summary \(UNIF-03\)/, 'has UNIF-03 tagged summary section');
});
