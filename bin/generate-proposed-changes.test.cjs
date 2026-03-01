#!/usr/bin/env node
'use strict';
// bin/generate-proposed-changes.test.cjs
// Tests for bin/generate-proposed-changes.cjs -- PLAN-01
//
// Validates: generateProposedChanges, generateTlaCfg, CLI behavior

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert             = require('node:assert');
const { spawnSync }      = require('child_process');
const fs                 = require('fs');
const path               = require('path');
const os                 = require('os');

const { generateProposedChanges, generateTlaCfg } = require('./generate-proposed-changes.cjs');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpc-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Test 1: generateProposedChanges returns generated: false for plan with no truths

test('generateProposedChanges returns generated: false for plan with no truths', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths: []
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  assert.strictEqual(result.generated, false, 'should not generate when no truths');
  assert.strictEqual(result.reason, 'no truths');
});

// ── Test 2: generateProposedChanges produces proposed-changes.tla with correct INVARIANT/PROPERTY stubs

test('generateProposedChanges produces proposed-changes.tla with correct INVARIANT/PROPERTY stubs', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds 5"
    - "eventually reaches DONE"
    - "state is always valid"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  assert.strictEqual(result.generated, true);
  assert.strictEqual(result.truthCount, 3);

  const specContent = fs.readFileSync(result.specPath, 'utf8');
  assert.ok(specContent.includes('Req01'), 'should contain Req01');
  assert.ok(specContent.includes('Req02'), 'should contain Req02');
  assert.ok(specContent.includes('Req03'), 'should contain Req03');
  assert.ok(specContent.includes('MODULE ProposedChanges'), 'should contain MODULE ProposedChanges');
});

// ── Test 3: generateProposedChanges writes to phaseDir/formal/ subdirectory

test('generateProposedChanges writes to phaseDir/formal/ subdirectory', () => {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', 'v0.21-05-test');
  fs.mkdirSync(phaseDir, { recursive: true });
  const planPath = path.join(phaseDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds 5"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  assert.strictEqual(result.generated, true);

  const expectedPath = path.join(phaseDir, 'formal', 'proposed-changes.tla');
  assert.ok(fs.existsSync(expectedPath), 'proposed-changes.tla should exist in phaseDir/formal/');
  assert.strictEqual(result.specPath, expectedPath);
});

// ── Test 4: generateTlaCfg creates MCProposedChanges.cfg with correct SPECIFICATION and checks

test('generateTlaCfg creates MCProposedChanges.cfg with correct SPECIFICATION and checks', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds 5"
    - "eventually reaches DONE"
    - "state is always valid"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  const { cfgPath } = generateTlaCfg(result.specPath);

  assert.ok(fs.existsSync(cfgPath), 'MCProposedChanges.cfg should exist');

  const cfgContent = fs.readFileSync(cfgPath, 'utf8');
  assert.ok(cfgContent.includes('SPECIFICATION Spec'), 'cfg should contain SPECIFICATION Spec');
  assert.ok(cfgContent.includes('INVARIANT Req01'), 'cfg should contain INVARIANT Req01 (safety truth)');
  assert.ok(cfgContent.includes('PROPERTY Req02'), 'cfg should contain PROPERTY Req02 (liveness truth)');
  assert.ok(cfgContent.includes('INVARIANT Req03'), 'cfg should contain INVARIANT Req03 (safety truth)');
});

// ── Test 5: CLI dry-run mode prints to stdout without writing files

test('CLI dry-run mode prints to stdout without writing files', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds 5"
---

<objective>Test</objective>
`, 'utf8');

  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'generate-proposed-changes.cjs'),
    planPath,
    '--dry-run',
  ], { encoding: 'utf8' });

  assert.ok(result.stdout.includes('DRY-RUN'), 'stdout should contain DRY-RUN');

  const formalDir = path.join(tmpDir, 'formal');
  assert.ok(!fs.existsSync(formalDir), 'formal/ directory should NOT be created in dry-run mode');
});

// ── Test 6: each truth appears as a comment in the generated TLA+ spec

test('each truth appears as a comment in the generated TLA+ spec', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "quorum threshold must be at least 3"
    - "eventually all slots respond"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  const specContent = fs.readFileSync(result.specPath, 'utf8');

  assert.ok(specContent.includes('quorum threshold must be at least 3'), 'first truth should appear in spec');
  assert.ok(specContent.includes('eventually all slots respond'), 'second truth should appear in spec');
});

// ── Test 7: generated spec contains ReqNN-to-Truth index mapping comment block

test('generated spec contains ReqNN-to-Truth index mapping comment block', () => {
  const planPath = path.join(tmpDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds maxSize"
    - "eventually reaches DONE state"
    - "threshold is always positive"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  const specContent = fs.readFileSync(result.specPath, 'utf8');

  assert.ok(specContent.includes('=== ReqNN-to-Truth Mapping ==='), 'should contain mapping header');
  assert.ok(specContent.includes('Req01 -> Truth[0]: "count never exceeds maxSize"'), 'should map Req01 to Truth[0]');
  assert.ok(specContent.includes('Req02 -> Truth[1]: "eventually reaches DONE state"'), 'should map Req02 to Truth[1]');
  assert.ok(specContent.includes('Req03 -> Truth[2]: "threshold is always positive"'), 'should map Req03 to Truth[2]');
});

// ── Test 8: formal/ subdirectory is auto-created via mkdir -p when it does not exist

test('formal/ subdirectory is auto-created via mkdir -p when it does not exist', () => {
  const deepDir = path.join(tmpDir, 'a', 'b', 'c');
  fs.mkdirSync(deepDir, { recursive: true });
  const planPath = path.join(deepDir, 'v0.21-05-01-PLAN.md');
  fs.writeFileSync(planPath, `---
phase: v0.21-05
plan: "01"
must_haves:
  truths:
    - "count never exceeds 5"
---

<objective>Test</objective>
`, 'utf8');

  const result = generateProposedChanges(planPath);
  assert.strictEqual(result.generated, true);

  const expectedPath = path.join(deepDir, 'formal', 'proposed-changes.tla');
  assert.ok(fs.existsSync(expectedPath), 'proposed-changes.tla should exist in deeply nested formal/ dir');
});
