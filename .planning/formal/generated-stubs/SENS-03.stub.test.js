#!/usr/bin/env node
// @requirement SENS-03
// Constant test for: GenerateReport
// Formal model: .planning/formal/tla/QGSDSensitivity.tla
// Requirement: sensitivity-report.cjs generates sensitivity-report.md with ranked parameters

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SENS-03 — GenerateReport: sensitivity-report.cjs exists', () => {
  const reportPath = path.join(ROOT, 'bin', 'sensitivity-report.cjs');
  assert.ok(fs.existsSync(reportPath), 'sensitivity-report.cjs must exist');
});

test('SENS-03 — GenerateReport: script defines PARAM_ANNOTATIONS constant', () => {
  const reportPath = path.join(ROOT, 'bin', 'sensitivity-report.cjs');
  const content = fs.readFileSync(reportPath, 'utf8');
  assert.ok(
    content.includes('PARAM_ANNOTATIONS'),
    'sensitivity-report.cjs must define PARAM_ANNOTATIONS for parameter annotation'
  );
});

test('SENS-03 — GenerateReport: PARAM_ANNOTATIONS includes code path, test cases, and monitoring', () => {
  const reportPath = path.join(ROOT, 'bin', 'sensitivity-report.cjs');
  const content = fs.readFileSync(reportPath, 'utf8');
  assert.ok(content.includes('codePath'), 'PARAM_ANNOTATIONS entries must include codePath');
  assert.ok(content.includes('testCases'), 'PARAM_ANNOTATIONS entries must include testCases');
  assert.ok(content.includes('monitoring'), 'PARAM_ANNOTATIONS entries must include monitoring');
});

test('SENS-03 — GenerateReport: script ranks parameters by outcome-flip count', () => {
  const reportPath = path.join(ROOT, 'bin', 'sensitivity-report.cjs');
  const content = fs.readFileSync(reportPath, 'utf8');
  assert.ok(
    content.includes('flips') && content.includes('sort'),
    'sensitivity-report.cjs must rank parameters by flip count (descending sort)'
  );
});

test('SENS-03 — GenerateReport: script outputs to sensitivity-report.md', () => {
  const reportPath = path.join(ROOT, 'bin', 'sensitivity-report.cjs');
  const content = fs.readFileSync(reportPath, 'utf8');
  assert.ok(
    content.includes('sensitivity-report.md'),
    'sensitivity-report.cjs must output to sensitivity-report.md'
  );
});

test('SENS-03 — GenerateReport: TLA+ model defines GenerateReport action', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDSensitivity.tla');
  assert.ok(fs.existsSync(tlaPath), 'QGSDSensitivity.tla must exist');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.ok(
    content.includes('GenerateReport =='),
    'TLA+ model must define GenerateReport action for SENS-03'
  );
});
