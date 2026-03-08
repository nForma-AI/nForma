#!/usr/bin/env node
// @requirement SPEC-03
// Structural test: verify quorum-composition.als defines AllRulesHold assertion
// encoding the 3 composition rules, and run-quorum-composition-alloy.cjs wires it.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('SPEC-03: quorum-composition.als exists and defines AllRulesHold assertion', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'quorum-composition.als');
  assert.ok(fs.existsSync(modelPath), 'quorum-composition.als must exist');
  const content = fs.readFileSync(modelPath, 'utf8');
  assert.match(content, /assert AllRulesHold/, 'model must define AllRulesHold assertion');
});

test('SPEC-03: AllRulesHold encodes no-empty-selection rule', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'quorum-composition.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  // Rule 1: (#c.availableSlots > 0) implies (#c.selectedSlots > 0)
  assert.match(content, /availableSlots.*implies.*selectedSlots/, 'must encode no-empty-selection rule');
});

test('SPEC-03: AllRulesHold encodes high-risk full fan-out rule', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'quorum-composition.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  // Rule 2: (c.riskLevel = High) implies (#c.selectedSlots > 0)
  assert.match(content, /riskLevel\s*=\s*High/, 'must encode high-risk condition');
  assert.match(content, /HighRiskFullFanOut/, 'must have HighRiskFullFanOut fact');
});

test('SPEC-03: AllRulesHold encodes solo-mode single slot rule', () => {
  const modelPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'quorum-composition.als');
  const content = fs.readFileSync(modelPath, 'utf8');
  // Rule 3: (c.soloMode = True) implies (#c.selectedSlots = 1)
  assert.match(content, /soloMode\s*=\s*True/, 'must encode soloMode condition');
  assert.match(content, /SoloModeSingleSlot/, 'must have SoloModeSingleSlot fact');
});

test('SPEC-03: run-quorum-composition-alloy.cjs references SPEC-03', () => {
  const srcPath = path.join(ROOT, 'bin', 'run-quorum-composition-alloy.cjs');
  assert.ok(fs.existsSync(srcPath), 'run-quorum-composition-alloy.cjs must exist');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /SPEC-03/, 'must reference SPEC-03 requirement');
  assert.match(content, /quorum.composition/, 'must reference quorum-composition check ID');
});
