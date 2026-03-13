#!/usr/bin/env node
'use strict';

/**
 * compute-per-model-gates.test.cjs — Unit tests for aggregate score computations.
 *
 * Tests computeAggregate() against known fixtures including edge cases.
 * Validates field names and structure match the existing global gate JSON schemas.
 */

const { computeAggregate } = require('./compute-per-model-gates.cjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + message + '\n');
  } else {
    failed++;
    process.stderr.write('  FAIL: ' + message + '\n');
  }
}

function assertClose(actual, expected, tolerance, message) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    passed++;
    process.stdout.write('  PASS: ' + message + ' (' + actual.toFixed(4) + ' ~= ' + expected.toFixed(4) + ')\n');
  } else {
    failed++;
    process.stderr.write('  FAIL: ' + message + ' (got ' + actual + ', expected ~' + expected + ')\n');
  }
}

// ── Fixture 1: Mixed results (3 models: 2 pass A, 3 pass B, 1 passes C) ────

console.log('\n=== Fixture 1: Mixed results (3 models) ===');

const fixture1 = {
  './model-a.tla': { gate_a: true, gate_b: true, gate_c: true },
  './model-b.tla': { gate_a: true, gate_b: true, gate_c: false },
  './model-c.tla': { gate_a: false, gate_b: true, gate_c: false },
};

const agg1 = computeAggregate(fixture1);

// Gate A
assertClose(agg1.gate_a.wiring_evidence_score, 2 / 3, 0.0001, 'Gate A wiring_evidence_score = 2/3');
assert(agg1.gate_a.target === 0.8, 'Gate A target = 0.8');
assert(agg1.gate_a.target_met === false, 'Gate A target_met = false (0.667 < 0.8)');
assert(agg1.gate_a.explained === 2, 'Gate A explained = 2');
assert(agg1.gate_a.total === 3, 'Gate A total = 3');
assert(agg1.gate_a.unexplained_counts.model_gap === 1, 'Gate A model_gap = 1');
assert(agg1.gate_a.unexplained_counts.instrumentation_bug === 0, 'Gate A instrumentation_bug = 0');
assert(agg1.gate_a.unexplained_counts.genuine_violation === 0, 'Gate A genuine_violation = 0');

// Gate B
assertClose(agg1.gate_b.wiring_purpose_score, 1.0, 0.0001, 'Gate B wiring_purpose_score = 1.0');
assert(agg1.gate_b.total_entries === 3, 'Gate B total_entries = 3');
assert(agg1.gate_b.grounded_entries === 3, 'Gate B grounded_entries = 3');
assert(agg1.gate_b.orphaned_entries === 0, 'Gate B orphaned_entries = 0');
assert(agg1.gate_b.target === 1.0, 'Gate B target = 1.0');
assert(agg1.gate_b.target_met === true, 'Gate B target_met = true');

// Gate C
assertClose(agg1.gate_c.wiring_coverage_score, 1 / 3, 0.0001, 'Gate C wiring_coverage_score = 1/3');
assert(agg1.gate_c.total_entries === 3, 'Gate C total_entries = 3');
assert(agg1.gate_c.validated_entries === 1, 'Gate C validated_entries = 1');
assert(agg1.gate_c.unvalidated_entries === 2, 'Gate C unvalidated_entries = 2');
assert(agg1.gate_c.target === 0.8, 'Gate C target = 0.8');
assert(agg1.gate_c.target_met === false, 'Gate C target_met = false (0.333 < 0.8)');

// ── Fixture 2: Edge case — 0 models (empty input) ──────────────────────────

console.log('\n=== Fixture 2: Edge case - 0 models ===');

const agg2 = computeAggregate({});

assert(agg2.gate_a.wiring_evidence_score === 0, 'Empty: Gate A wiring_evidence_score = 0');
assert(agg2.gate_a.total === 0, 'Empty: Gate A total = 0');
assert(agg2.gate_a.explained === 0, 'Empty: Gate A explained = 0');
assert(agg2.gate_a.target_met === false, 'Empty: Gate A target_met = false');
assert(agg2.gate_b.wiring_purpose_score === 0, 'Empty: Gate B wiring_purpose_score = 0');
assert(agg2.gate_b.target_met === false, 'Empty: Gate B target_met = false');
assert(agg2.gate_c.wiring_coverage_score === 0, 'Empty: Gate C wiring_coverage_score = 0');
assert(agg2.gate_c.target_met === false, 'Empty: Gate C target_met = false');

// ── Fixture 3: Edge case — all models pass all gates ────────────────────────

console.log('\n=== Fixture 3: All models pass all gates ===');

const fixture3 = {
  './m1.tla': { gate_a: true, gate_b: true, gate_c: true },
  './m2.tla': { gate_a: true, gate_b: true, gate_c: true },
};

const agg3 = computeAggregate(fixture3);

assert(agg3.gate_a.wiring_evidence_score === 1.0, 'All-pass: Gate A wiring_evidence_score = 1.0');
assert(agg3.gate_a.target_met === true, 'All-pass: Gate A target_met = true');
assert(agg3.gate_a.unexplained_counts.model_gap === 0, 'All-pass: Gate A model_gap = 0');
assert(agg3.gate_b.wiring_purpose_score === 1.0, 'All-pass: Gate B wiring_purpose_score = 1.0');
assert(agg3.gate_b.target_met === true, 'All-pass: Gate B target_met = true');
assert(agg3.gate_b.orphaned_entries === 0, 'All-pass: Gate B orphaned_entries = 0');
assert(agg3.gate_c.wiring_coverage_score === 1.0, 'All-pass: Gate C wiring_coverage_score = 1.0');
assert(agg3.gate_c.target_met === true, 'All-pass: Gate C target_met = true');

// ── Fixture 4: Field name / structure validation ────────────────────────────

console.log('\n=== Fixture 4: Structure validation ===');

// Verify all required fields exist (matching global gate JSON schemas)
const gateAFields = ['wiring_evidence_score', 'target', 'target_met', 'explained', 'total', 'unexplained_counts'];
for (const f of gateAFields) {
  assert(f in agg1.gate_a, 'Gate A has field: ' + f);
}
assert('instrumentation_bug' in agg1.gate_a.unexplained_counts, 'Gate A unexplained_counts has instrumentation_bug');
assert('model_gap' in agg1.gate_a.unexplained_counts, 'Gate A unexplained_counts has model_gap');
assert('genuine_violation' in agg1.gate_a.unexplained_counts, 'Gate A unexplained_counts has genuine_violation');

const gateBFields = ['wiring_purpose_score', 'total_entries', 'grounded_entries', 'orphaned_entries', 'target', 'target_met'];
for (const f of gateBFields) {
  assert(f in agg1.gate_b, 'Gate B has field: ' + f);
}

const gateCFields = ['wiring_coverage_score', 'total_entries', 'validated_entries', 'unvalidated_entries', 'target', 'target_met'];
for (const f of gateCFields) {
  assert(f in agg1.gate_c, 'Gate C has field: ' + f);
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('\n=== Results ===');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Total:  ' + (passed + failed));

process.exit(failed > 0 ? 1 : 0);
