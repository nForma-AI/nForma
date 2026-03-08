#!/usr/bin/env node
// @requirement SENS-01
// Constant test: run-sensitivity-sweep.cjs defines SWEEP_PARAMS with >= 2 parameters, >= 3 values each

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SENS-01: run-sensitivity-sweep.cjs exists', () => {
  const filePath = path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs');
  assert.ok(fs.existsSync(filePath), 'run-sensitivity-sweep.cjs must exist');
});

test('SENS-01: SWEEP_PARAMS defines at least 2 parameters', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs'), 'utf8');
  // Count parameter entries in SWEEP_PARAMS array by matching name: fields
  const nameMatches = content.match(/name:\s*'/g);
  assert.ok(nameMatches && nameMatches.length >= 2,
    'SWEEP_PARAMS must define at least 2 parameters (found ' + (nameMatches ? nameMatches.length : 0) + ')');
});

test('SENS-01: each SWEEP_PARAMS parameter has >= 3 values', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs'), 'utf8');
  // Extract values arrays from SWEEP_PARAMS
  const valuesMatches = content.match(/values:\s*\[([^\]]+)\]/g);
  assert.ok(valuesMatches && valuesMatches.length >= 2,
    'Must have values arrays for each parameter');
  for (const m of valuesMatches) {
    const inner = m.match(/\[([^\]]+)\]/)[1];
    const count = inner.split(',').filter(s => s.trim().length > 0).length;
    assert.ok(count >= 3,
      'Each parameter must have >= 3 sweep values, found ' + count + ' in: ' + m);
  }
});

test('SENS-01: sweep outputs to sensitivity-report.ndjson', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs'), 'utf8');
  assert.match(content, /sensitivity-report\.ndjson/,
    'Must write results to sensitivity-report.ndjson');
});

test('SENS-01: sweep records include delta annotation (outcome transitions)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs'), 'utf8');
  assert.match(content, /delta/,
    'Must record delta (pass->fail, stable transitions) in output');
  assert.match(content, /baseline/,
    'Must track baseline result for delta computation');
});
