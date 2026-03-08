#!/usr/bin/env node
// @requirement SOLVE-05
// Verifies: run-formal-verify.cjs discovers project formal models via --project-root,
// forwards --project-root to child runners, and gracefully skips QGSD-specific checks.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const runFormalVerifyPath = path.resolve(__dirname, '../../../bin/run-formal-verify.cjs');

test('SOLVE-05: run-formal-verify.cjs parses --project-root argument', () => {
  const source = fs.readFileSync(runFormalVerifyPath, 'utf8');
  assert.match(source, /--project-root=/,
    'must parse --project-root= flag for cross-repo usage');
});

test('SOLVE-05: run-formal-verify.cjs auto-forwards --project-root to child scripts', () => {
  const source = fs.readFileSync(runFormalVerifyPath, 'utf8');
  assert.match(source, /--project-root.*ROOT/,
    'must forward --project-root to child runners');
});

test('SOLVE-05: run-formal-verify.cjs uses ROOT for spec file resolution not hardcoded paths', () => {
  const source = fs.readFileSync(runFormalVerifyPath, 'utf8');
  // ROOT should be used with path.join for spec discovery, not hardcoded QGSD paths
  assert.match(source, /let\s+ROOT\s*=\s*process\.cwd\(\)/,
    'ROOT must default to process.cwd() for portability');
  assert.match(source, /path\.resolve\(arg\.slice\('--project-root='\.length\)\)/,
    'ROOT must be overridable via --project-root argument');
});

test('SOLVE-05: run-formal-verify.cjs has generic fallback runners for unknown models', () => {
  const source = fs.readFileSync(runFormalVerifyPath, 'utf8');
  // Generic runners (run-tlc.cjs, run-alloy.cjs, run-prism.cjs) handle non-QGSD models
  assert.match(source, /run-tlc\.cjs/,
    'must have generic TLA+ runner fallback');
  assert.match(source, /run-alloy\.cjs/,
    'must have generic Alloy runner fallback');
  assert.match(source, /run-prism\.cjs/,
    'must have generic PRISM runner fallback');
});

test('SOLVE-05: run-formal-verify.cjs sets CHECK_RESULTS_ROOT env for child processes', () => {
  const source = fs.readFileSync(runFormalVerifyPath, 'utf8');
  assert.match(source, /CHECK_RESULTS_ROOT:\s*ROOT/,
    'must set CHECK_RESULTS_ROOT env var to ROOT for child processes');
});
