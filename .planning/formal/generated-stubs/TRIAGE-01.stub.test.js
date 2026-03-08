#!/usr/bin/env node
// @requirement TRIAGE-01
// Test: generate-triage-bundle.cjs reads check-results.ndjson and writes diff-report.md + suspects.md

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  generateSuspects,
  computeDeltas,
  buildCurrentSnapshot,
  formatDiffReport,
  formatSuspectsReport,
} = require('/Users/jonathanborduas/code/QGSD/bin/generate-triage-bundle.cjs');

test('TRIAGE-01: generateSuspects filters fail and tagged results', () => {
  const results = [
    { check_id: 'a', result: 'pass' },
    { check_id: 'b', result: 'fail' },
    { check_id: 'c', result: 'warn', triage_tags: ['drift'] },
    { check_id: 'd', result: 'pass', triage_tags: [] },
    { check_id: 'e', result: 'error' },
  ];
  const suspects = generateSuspects(results);
  // Should include fail, error, and warn-with-tags but NOT pass entries
  const ids = suspects.map(s => s.check_id);
  assert.ok(ids.includes('b'), 'fail result should be a suspect');
  assert.ok(ids.includes('e'), 'error result should be a suspect');
  assert.ok(ids.includes('c'), 'warn with triage_tags should be a suspect');
  assert.ok(!ids.includes('a'), 'pass without tags should not be a suspect');
  assert.ok(!ids.includes('d'), 'pass with empty tags should not be a suspect');
});

test('TRIAGE-01: generateSuspects sorts by priority (fail > error > warn+tags > other)', () => {
  const results = [
    { check_id: 'warn-tagged', result: 'warn', triage_tags: ['x'] },
    { check_id: 'error', result: 'error' },
    { check_id: 'fail', result: 'fail' },
  ];
  const suspects = generateSuspects(results);
  assert.equal(suspects[0].check_id, 'fail');
  assert.equal(suspects[1].check_id, 'error');
  assert.equal(suspects[2].check_id, 'warn-tagged');
});

test('TRIAGE-01: computeDeltas detects transitions, new, removed, unchanged', () => {
  const current = [
    { check_id: 'stable', result: 'pass' },
    { check_id: 'changed', result: 'fail' },
    { check_id: 'brand-new', result: 'pass' },
  ];
  const previous = { stable: 'pass', changed: 'pass', removed: 'fail' };
  const deltas = computeDeltas(current, previous);

  assert.equal(deltas.unchanged, 1, 'stable check is unchanged');
  assert.equal(deltas.transitioned.length, 1, 'changed check transitioned');
  assert.equal(deltas.transitioned[0].check_id, 'changed');
  assert.equal(deltas.transitioned[0].previousResult, 'pass');
  assert.equal(deltas.newChecks.length, 1, 'brand-new is a new check');
  assert.equal(deltas.newChecks[0].check_id, 'brand-new');
  assert.deepEqual(deltas.removedChecks, ['removed']);
});

test('TRIAGE-01: buildCurrentSnapshot creates check_id->result map', () => {
  const results = [
    { check_id: 'a', result: 'pass' },
    { check_id: 'b', result: 'fail' },
  ];
  const snap = buildCurrentSnapshot(results);
  assert.deepEqual(snap, { a: 'pass', b: 'fail' });
});

test('TRIAGE-01: formatDiffReport produces markdown with embedded JSON snapshot', () => {
  const results = [
    { check_id: 'x', result: 'pass' },
    { check_id: 'y', result: 'fail' },
  ];
  const deltas = computeDeltas(results, {});
  const md = formatDiffReport(results, deltas, true);

  assert.ok(md.includes('# Formal Verification Diff Report'), 'has title');
  assert.ok(md.includes('```json'), 'has embedded JSON block');
  assert.ok(md.includes('"x":"pass"') || md.includes('"x": "pass"'), 'snapshot has check x');
});

test('TRIAGE-01: formatSuspectsReport produces markdown listing suspects', () => {
  const suspects = [
    { check_id: 'f1', result: 'fail', property: 'Safety', summary: 'counterexample', triage_tags: [] },
  ];
  const md = formatSuspectsReport(suspects);

  assert.ok(md.includes('# Formal Verification Suspects'), 'has title');
  assert.ok(md.includes('f1'), 'lists suspect check_id');
  assert.ok(md.includes('Critical Failures'), 'has critical failures section');
});
