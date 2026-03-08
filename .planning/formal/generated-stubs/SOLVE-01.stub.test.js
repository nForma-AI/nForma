#!/usr/bin/env node
// @requirement SOLVE-01
// Test: /nf:solve sweeps all layer transitions and computes residual vectors

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOLVE_PATH = path.resolve(__dirname, '../../../bin/nf-solve.cjs');

test('SOLVE-01: nf-solve.cjs exists and is loadable', () => {
  assert.ok(fs.existsSync(SOLVE_PATH), 'bin/nf-solve.cjs should exist');
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.ok(content.length > 0, 'nf-solve.cjs should not be empty');
});

test('SOLVE-01: nf-solve.cjs implements all required layer transitions', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  // The 7 core forward transitions documented in SOLVE-01
  const requiredTransitions = [
    'sweepRtoF',  // Requirements -> Formal
    'sweepFtoT',  // Formal -> Tests
    'sweepCtoF',  // Code -> Formal
    'sweepTtoC',  // Tests -> Code
    'sweepFtoC',  // Formal -> Code
    'sweepRtoD',  // Requirements -> Docs
    'sweepDtoC',  // Docs -> Code
  ];
  for (const fn of requiredTransitions) {
    assert.match(content, new RegExp(`function\\s+${fn}\\s*\\(`),
      `nf-solve.cjs should define ${fn}() for layer transition`);
  }
});

test('SOLVE-01: nf-solve.cjs supports --report-only mode', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.match(content, /report.only|reportOnly/i,
    'nf-solve.cjs should support --report-only flag');
});

test('SOLVE-01: nf-solve.cjs supports iteration-based convergence', () => {
  const content = fs.readFileSync(SOLVE_PATH, 'utf8');
  assert.match(content, /max.iterations|maxIterations|DEFAULT_MAX_ITERATIONS/i,
    'nf-solve.cjs should support iteration-based convergence');
});
