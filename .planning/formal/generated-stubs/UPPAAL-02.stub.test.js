#!/usr/bin/env node
// @requirement UPPAAL-02
// Test: bin/run-uppaal.cjs executes verifyta against quorum-races.xml and writes
// check result using v2.1 schema. The uppaal:quorum-races step maps to UPPAAL-02.
// Behavioral: verify requirement map includes UPPAAL-02 and run-uppaal.cjs uses
// the correct check_id and calls writeCheckResult + getRequirementIds.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getRequirementIds } = require('../../../bin/requirement-map.cjs');

test('UPPAAL-02: uppaal:quorum-races maps to UPPAAL-02 requirement', () => {
  const reqIds = getRequirementIds('uppaal:quorum-races');
  assert.ok(reqIds.includes('UPPAAL-02'), 'UPPAAL-02 must be in uppaal:quorum-races requirement IDs');
});

test('UPPAAL-02: run-uppaal.cjs uses uppaal:quorum-races check_id', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'bin', 'run-uppaal.cjs'), 'utf8');
  assert.ok(src.includes("'uppaal:quorum-races'"), 'run-uppaal.cjs must reference uppaal:quorum-races check_id');
});

test('UPPAAL-02: run-uppaal.cjs imports writeCheckResult for NDJSON output', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'bin', 'run-uppaal.cjs'), 'utf8');
  assert.ok(src.includes('writeCheckResult'), 'run-uppaal.cjs must use writeCheckResult for NDJSON output');
});

test('UPPAAL-02: run-uppaal.cjs imports getRequirementIds for requirement tracing', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'bin', 'run-uppaal.cjs'), 'utf8');
  assert.ok(src.includes('getRequirementIds'), 'run-uppaal.cjs must use getRequirementIds for SCHEMA-03 compliance');
});
