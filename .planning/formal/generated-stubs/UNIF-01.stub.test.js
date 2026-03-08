#!/usr/bin/env node
// @requirement UNIF-01
// Test: All FV checkers append normalized JSON { tool, check_id, result, detail, ts } to check-results.ndjson

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('UNIF-01: writeCheckResult appends normalized JSON with required fields to NDJSON', () => {
  // Use a temp file to avoid polluting real check-results.ndjson
  const tmpFile = path.join(os.tmpdir(), 'unif-01-test-' + Date.now() + '.ndjson');
  process.env.CHECK_RESULTS_PATH = tmpFile;

  // Re-require to pick up new env var
  delete require.cache[require.resolve('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs')];
  const { writeCheckResult } = require('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs');

  writeCheckResult({
    tool: 'run-tlc',
    formalism: 'tla',
    result: 'pass',
    check_id: 'tla:safety',
    surface: 'tla',
    property: 'Safety invariant',
    runtime_ms: 1500,
    summary: 'pass: MCsafety in 1500ms',
  });

  const content = fs.readFileSync(tmpFile, 'utf8').trim();
  const record = JSON.parse(content);

  assert.equal(record.tool, 'run-tlc');
  assert.equal(record.check_id, 'tla:safety');
  assert.equal(record.result, 'pass');
  assert.equal(typeof record.timestamp, 'string', 'has timestamp');
  assert.equal(record.surface, 'tla');
  assert.equal(record.property, 'Safety invariant');
  assert.equal(record.runtime_ms, 1500);
  assert.equal(record.summary, 'pass: MCsafety in 1500ms');

  // Cleanup
  fs.unlinkSync(tmpFile);
  delete process.env.CHECK_RESULTS_PATH;
});

test('UNIF-01: writeCheckResult rejects entries missing required fields', () => {
  assert.throws(
    () => {
      delete require.cache[require.resolve('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs')];
      const { writeCheckResult } = require('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs');
      writeCheckResult({ tool: '', formalism: 'tla', result: 'pass' });
    },
    /tool is required/,
    'rejects empty tool'
  );
});

test('UNIF-01: writeCheckResult validates result enum', () => {
  assert.throws(
    () => {
      delete require.cache[require.resolve('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs')];
      const { writeCheckResult } = require('/Users/jonathanborduas/code/QGSD/bin/write-check-result.cjs');
      writeCheckResult({ tool: 'x', formalism: 'tla', result: 'invalid-result', check_id: 'a', surface: 'b', property: 'c', runtime_ms: 0, summary: 'd' });
    },
    /result must be one of/,
    'rejects invalid result enum'
  );
});
