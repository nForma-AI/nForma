#!/usr/bin/env node
// @requirement DOC-02
// Structural test: README.md Formal Verification section presents user-facing capabilities
// (what is guaranteed, how to run verification) without exposing internal model names,
// directory trees, or CI pipeline details.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const readmePath = path.join(ROOT, 'README.md');
const readme = fs.readFileSync(readmePath, 'utf8');

// Extract the Formal Verification section (from ## Formal Verification to the next ## heading)
const fvMatch = readme.match(/## Formal Verification\n([\s\S]*?)(?=\n---\n|\n## [^#])/);
const fvSection = fvMatch ? fvMatch[0] : '';

test('DOC-02: Formal Verification section exists in README', () => {
  assert.ok(fvSection.length > 0,
    'README must contain a "## Formal Verification" section');
});

test('DOC-02: FV section explains what is guaranteed (safety/liveness)', () => {
  assert.ok(
    fvSection.includes('safety') || fvSection.includes('invariant') ||
    fvSection.includes('liveness') || fvSection.includes('correctness') ||
    fvSection.includes('verified'),
    'FV section must mention what is verified (safety, invariants, liveness, or correctness)');
});

test('DOC-02: FV section explains how to run verification', () => {
  assert.ok(
    fvSection.includes('run-formal-verify') || fvSection.includes('node bin/'),
    'FV section must include instructions on how to run verification');
});

test('DOC-02: FV section does not expose internal TLA+ model file names', () => {
  // Internal model names like QGSDDispatchPipeline.tla should not be in README
  assert.ok(!fvSection.includes('QGSDDispatchPipeline.tla'),
    'FV section must not expose internal TLA+ model name QGSDDispatchPipeline.tla');
  assert.ok(!fvSection.includes('QGSDPlanningState.tla'),
    'FV section must not expose internal TLA+ model name QGSDPlanningState.tla');
});

test('DOC-02: FV section does not expose internal directory tree paths', () => {
  // Should not reference .planning/formal/ internal paths
  assert.ok(!fvSection.includes('.planning/formal/tla/'),
    'FV section must not expose internal path .planning/formal/tla/');
  assert.ok(!fvSection.includes('.planning/formal/alloy/'),
    'FV section must not expose internal path .planning/formal/alloy/');
  assert.ok(!fvSection.includes('.planning/formal/prism/'),
    'FV section must not expose internal path .planning/formal/prism/');
});

test('DOC-02: FV section does not expose CI pipeline details', () => {
  assert.ok(!fvSection.includes('CI pipeline') && !fvSection.includes('GitHub Actions'),
    'FV section must not expose CI pipeline implementation details');
  assert.ok(!fvSection.includes('.github/workflows'),
    'FV section must not reference workflow files');
});
