#!/usr/bin/env node
'use strict';
// bin/quorum-composition.test.cjs
// Tests for the Alloy quorum composition model — SPEC-03.
//
// Test 1: formal/alloy/quorum-composition.als exists
// Test 2: quorum-composition.als contains all 3 required facts
// Test 3: Alloy verifies composition rules: no counterexample found (skips if JAR unavailable)
// Test 4: model-registry.json has entry for formal/alloy/quorum-composition.als with update_source=manual

const { test } = require('node:test');
const assert   = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT      = path.join(__dirname, '..');
const ALS_FILE  = path.join(ROOT, 'formal', 'alloy', 'quorum-composition.als');
const JAR_PATH  = path.join(ROOT, 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
const RUNNER    = path.join(__dirname, 'run-quorum-composition-alloy.cjs');
const REGISTRY  = path.join(ROOT, 'formal', 'model-registry.json');

test('formal/alloy/quorum-composition.als exists', () => {
  assert.ok(fs.existsSync(ALS_FILE), 'formal/alloy/quorum-composition.als must exist');
});

test('quorum-composition.als contains all 3 required facts', () => {
  const content = fs.readFileSync(ALS_FILE, 'utf8');
  assert.ok(content.includes('NoEmptySelection'), 'must define fact NoEmptySelection');
  assert.ok(content.includes('HighRiskFullFanOut'), 'must define fact HighRiskFullFanOut');
  assert.ok(content.includes('SoloModeSingleSlot'), 'must define fact SoloModeSingleSlot');
  assert.ok(content.includes('AllRulesHold'), 'must define assert AllRulesHold');
});

test('Alloy verifies composition rules: no counterexample found', (t) => {
  // Skip if Alloy JAR not available (e.g. CI without Java/Alloy)
  if (!fs.existsSync(JAR_PATH)) {
    t.skip('org.alloytools.alloy.dist.jar not found — skipping Alloy verification test');
    return;
  }

  // Also skip if Java is unavailable
  const javaCheck = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (javaCheck.error || javaCheck.status !== 0) {
    t.skip('Java not available — skipping Alloy verification test');
    return;
  }

  const result = spawnSync(process.execPath, [RUNNER], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, CHECK_RESULTS_PATH: '/dev/null' },
    timeout: 120000, // 2 min max for Alloy
  });

  assert.strictEqual(
    result.status,
    0,
    'Alloy must exit 0 (no counterexample). stderr: ' + (result.stderr || '') + ' stdout: ' + (result.stdout || '')
  );
});

test('model-registry.json has entry for formal/alloy/quorum-composition.als with update_source=manual', () => {
  assert.ok(fs.existsSync(REGISTRY), 'formal/model-registry.json must exist');
  const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const entry = (registry.models || {})['formal/alloy/quorum-composition.als'];
  assert.ok(entry, 'model-registry.json must have an entry for formal/alloy/quorum-composition.als');
  assert.strictEqual(entry.update_source, 'manual', 'update_source must be "manual"');
  assert.ok(entry.description && entry.description.includes('SPEC-03'), 'description must reference SPEC-03');
});
