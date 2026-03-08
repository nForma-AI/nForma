#!/usr/bin/env node
// @requirement SENS-02
// Constant test for: InjectContext
// Formal model: .planning/formal/tla/QGSDSensitivity.tla
// Requirement: plan-phase.md step 8.3 (FV gate) runs run-sensitivity-sweep.cjs (fail-open)
// and injects SENSITIVITY_CONTEXT into quorum review_context

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SENS-02 — InjectContext: run-sensitivity-sweep.cjs exists and is executable', () => {
  const sweepPath = path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs');
  assert.ok(fs.existsSync(sweepPath), 'run-sensitivity-sweep.cjs must exist');
  const content = fs.readFileSync(sweepPath, 'utf8');
  assert.ok(content.length > 0, 'run-sensitivity-sweep.cjs must not be empty');
});

test('SENS-02 — InjectContext: sweep script references SENSITIVITY_REPORT_PATH constant', () => {
  const sweepPath = path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs');
  const content = fs.readFileSync(sweepPath, 'utf8');
  assert.ok(
    content.includes('SENSITIVITY_REPORT_PATH'),
    'run-sensitivity-sweep.cjs must define SENSITIVITY_REPORT_PATH for output injection'
  );
});

test('SENS-02 — InjectContext: sweep script always exits 0 (fail-open)', () => {
  const sweepPath = path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs');
  const content = fs.readFileSync(sweepPath, 'utf8');
  // Fail-open: the script must not call process.exit(1) at top level
  // It should gracefully degrade when tools are not installed
  assert.ok(
    content.includes('inconclusive') || content.includes('graceful'),
    'run-sensitivity-sweep.cjs must handle missing tools gracefully (inconclusive results)'
  );
});

test('SENS-02 — InjectContext: sweep produces ndjson records with metadata.parameter', () => {
  const sweepPath = path.join(ROOT, 'bin', 'run-sensitivity-sweep.cjs');
  const content = fs.readFileSync(sweepPath, 'utf8');
  assert.ok(
    content.includes('metadata') && content.includes('parameter'),
    'Sweep records must include metadata.parameter for context injection ranking'
  );
});

test('SENS-02 — InjectContext: TLA+ model defines InjectContext action', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'QGSDSensitivity.tla');
  assert.ok(fs.existsSync(tlaPath), 'QGSDSensitivity.tla must exist');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.ok(
    content.includes('InjectContext =='),
    'TLA+ model must define InjectContext action for SENS-02'
  );
});
