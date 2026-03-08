#!/usr/bin/env node
// @requirement VERIFY-01
// Behavioral test: verify-formal-results.cjs parses check-results.ndjson and
// produces a Formal Verification section digest for VERIFICATION.md.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const mod = require(path.resolve(__dirname, '../../../bin/verify-formal-results.cjs'));

test('VERIFY-01: parseNDJSON returns parsed objects from valid NDJSON content', () => {
  // parseNDJSON requires a file path; create a temp file to test
  const fs = require('fs');
  const os = require('os');
  const tmpFile = path.join(os.tmpdir(), 'verify-01-test.ndjson');
  const lines = [
    JSON.stringify({ formalism: 'tla', result: 'pass', name: 'Safety' }),
    JSON.stringify({ formalism: 'alloy', result: 'fail', name: 'Liveness' }),
  ];
  fs.writeFileSync(tmpFile, lines.join('\n'), 'utf8');

  const results = mod.parseNDJSON(tmpFile);
  assert.equal(results.length, 2, 'should parse two NDJSON lines');
  assert.equal(results[0].formalism, 'tla');
  assert.equal(results[1].result, 'fail');

  fs.unlinkSync(tmpFile);
});

test('VERIFY-01: parseNDJSON returns empty array for missing file (fail-open)', () => {
  const results = mod.parseNDJSON('/nonexistent/path/check-results.ndjson');
  assert.deepStrictEqual(results, [], 'missing file should return empty array');
});

test('VERIFY-01: groupByFormalism + generateFVSection produce VERIFICATION.md digest', () => {
  const results = [
    { formalism: 'tla', result: 'pass' },
    { formalism: 'tla', result: 'pass' },
    { formalism: 'alloy', result: 'fail' },
    { formalism: 'ci', result: 'warn' },
  ];
  const grouped = mod.groupByFormalism(results);
  assert.equal(grouped.tla.pass, 2);
  assert.equal(grouped.alloy.fail, 1);
  assert.equal(grouped.ci.warn, 1);

  const section = mod.generateFVSection(grouped, 'run-formal-verify', '2026-01-01T00:00:00Z');
  assert.match(section, /## Formal Verification/, 'section starts with ## Formal Verification heading');
  assert.match(section, /TLA Results/, 'includes TLA subsection');
  assert.match(section, /ALLOY Results/, 'includes Alloy subsection');
  assert.match(section, /Overall Status.*fail/, 'overall status reflects worst result');
});
