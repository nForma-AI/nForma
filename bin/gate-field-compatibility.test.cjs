#!/usr/bin/env node
'use strict';

/**
 * gate-field-compatibility.test.cjs — Tests for gate score field backward compatibility.
 *
 * Validates that the fallback read pattern (wiring_*_score || legacy_score || 0)
 * works correctly for both old (schema v1) and new (schema v2) gate JSON formats.
 * Requirements: NAME-01, NAME-02, NAME-04
 */

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + message + '\n');
  } else {
    failed++;
    process.stdout.write('  FAIL: ' + message + '\n');
  }
}

function assertClose(actual, expected, epsilon, message) {
  if (Math.abs(actual - expected) <= epsilon) {
    passed++;
    process.stdout.write('  PASS: ' + message + '\n');
  } else {
    failed++;
    process.stdout.write('  FAIL: ' + message + ' (got ' + actual + ', expected ' + expected + ')\n');
  }
}

/**
 * Fallback read helper — mirrors the pattern used in all consumer scripts.
 */
const readGateScore = (data, gate) => {
  if (gate === 'a') return data.wiring_evidence_score || data.grounding_score || 0;
  if (gate === 'b') return data.wiring_purpose_score || data.gate_b_score || 0;
  if (gate === 'c') return data.wiring_coverage_score || data.gate_c_score || 0;
  return 0;
};

const FIXTURES_DIR = path.join(__dirname, '..', 'test', 'fixtures');

// ── Test 1: Gate A old format — grounding_score fallback ──────────────────────

console.log('\n=== Test 1: Gate A — legacy grounding_score fallback ===');

const gateAOld = { schema_version: '1', grounding_score: 0.80 };
const scoreA1 = readGateScore(gateAOld, 'a');
assertClose(scoreA1, 0.80, 0.0001, 'Gate A: reads grounding_score when wiring_evidence_score absent');

// ── Test 2: Gate A new format — wiring_evidence_score preferred ───────────────

console.log('\n=== Test 2: Gate A — wiring_evidence_score preferred ===');

const gateANew = { schema_version: '2', wiring_evidence_score: 0.95 };
const scoreA2 = readGateScore(gateANew, 'a');
assertClose(scoreA2, 0.95, 0.0001, 'Gate A: reads wiring_evidence_score when present');

// ── Test 3: Gate B old format — gate_b_score fallback ────────────────────────

console.log('\n=== Test 3: Gate B — legacy gate_b_score fallback ===');

const gateBOld = { schema_version: '1', gate_b_score: 0.70 };
const scoreB1 = readGateScore(gateBOld, 'b');
assertClose(scoreB1, 0.70, 0.0001, 'Gate B: reads gate_b_score when wiring_purpose_score absent');

// ── Test 4: Gate B new format — wiring_purpose_score preferred ───────────────

console.log('\n=== Test 4: Gate B — wiring_purpose_score preferred ===');

const gateBNew = { schema_version: '2', wiring_purpose_score: 0.98 };
const scoreB2 = readGateScore(gateBNew, 'b');
assertClose(scoreB2, 0.98, 0.0001, 'Gate B: reads wiring_purpose_score when present');

// ── Test 5: Gate C old format — gate_c_score fallback ────────────────────────

console.log('\n=== Test 5: Gate C — legacy gate_c_score fallback ===');

const gateCOld = { schema_version: '1', gate_c_score: 0.65 };
const scoreC1 = readGateScore(gateCOld, 'c');
assertClose(scoreC1, 0.65, 0.0001, 'Gate C: reads gate_c_score when wiring_coverage_score absent');

// ── Test 6: Gate C new format — wiring_coverage_score preferred ──────────────

console.log('\n=== Test 6: Gate C — wiring_coverage_score preferred ===');

const gateCNew = { schema_version: '2', wiring_coverage_score: 0.80 };
const scoreC2 = readGateScore(gateCNew, 'c');
assertClose(scoreC2, 0.80, 0.0001, 'Gate C: reads wiring_coverage_score when present');

// ── Test 7: All 6 fixture files parse without errors ─────────────────────────

console.log('\n=== Test 7: Fixture files parse without errors ===');

const fixtureFiles = [
  'gate-a-old-format.json',
  'gate-a-new-format.json',
  'gate-b-old-format.json',
  'gate-b-new-format.json',
  'gate-c-old-format.json',
  'gate-c-new-format.json',
];

for (const filename of fixtureFiles) {
  try {
    const data = require(path.join(FIXTURES_DIR, filename));
    assert(typeof data === 'object' && data !== null, 'Fixture parses as object: ' + filename);
  } catch (e) {
    assert(false, 'Fixture parses without error: ' + filename + ' (' + e.message + ')');
  }
}

// ── Test 8: When both old and new fields present, new field wins ──────────────

console.log('\n=== Test 8: New field wins when both fields present ===');

const gateBothA = { schema_version: '2', wiring_evidence_score: 0.95, grounding_score: 0.50 };
const scoreA3 = readGateScore(gateBothA, 'a');
assertClose(scoreA3, 0.95, 0.0001, 'Gate A: wiring_evidence_score wins over grounding_score when both present');

const gateBothB = { schema_version: '2', wiring_purpose_score: 0.98, gate_b_score: 0.60 };
const scoreB3 = readGateScore(gateBothB, 'b');
assertClose(scoreB3, 0.98, 0.0001, 'Gate B: wiring_purpose_score wins over gate_b_score when both present');

const gateBothC = { schema_version: '2', wiring_coverage_score: 0.80, gate_c_score: 0.40 };
const scoreC3 = readGateScore(gateBothC, 'c');
assertClose(scoreC3, 0.80, 0.0001, 'Gate C: wiring_coverage_score wins over gate_c_score when both present');

// ── Test 9: Fixture content validation ───────────────────────────────────────

console.log('\n=== Test 9: Fixture content validation ===');

const gateAOldFixture = require(path.join(FIXTURES_DIR, 'gate-a-old-format.json'));
assertClose(readGateScore(gateAOldFixture, 'a'), 0.95, 0.0001, 'gate-a-old-format.json: grounding_score = 0.95 via fallback');

const gateANewFixture = require(path.join(FIXTURES_DIR, 'gate-a-new-format.json'));
assertClose(readGateScore(gateANewFixture, 'a'), 0.95, 0.0001, 'gate-a-new-format.json: wiring_evidence_score = 0.95');

const gateBOldFixture = require(path.join(FIXTURES_DIR, 'gate-b-old-format.json'));
assertClose(readGateScore(gateBOldFixture, 'b'), 0.98, 0.0001, 'gate-b-old-format.json: gate_b_score = 0.98 via fallback');

const gateBNewFixture = require(path.join(FIXTURES_DIR, 'gate-b-new-format.json'));
assertClose(readGateScore(gateBNewFixture, 'b'), 0.98, 0.0001, 'gate-b-new-format.json: wiring_purpose_score = 0.98');

const gateCOldFixture = require(path.join(FIXTURES_DIR, 'gate-c-old-format.json'));
assertClose(readGateScore(gateCOldFixture, 'c'), 0.80, 0.0001, 'gate-c-old-format.json: gate_c_score = 0.80 via fallback');

const gateCNewFixture = require(path.join(FIXTURES_DIR, 'gate-c-new-format.json'));
assertClose(readGateScore(gateCNewFixture, 'c'), 0.80, 0.0001, 'gate-c-new-format.json: wiring_coverage_score = 0.80');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n=== Results ===');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Total:  ' + (passed + failed));

process.exit(failed > 0 ? 1 : 0);
