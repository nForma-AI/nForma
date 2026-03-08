#!/usr/bin/env node
// @requirement LOOP-01
// Test: PRISM always uses current scoreboard rates via export-prism-constants pre-step calibration
// Strategy: constant — verify run-prism.cjs invokes export-prism-constants.cjs as a pre-step

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const runPrismPath = path.resolve(__dirname, '../../../bin/run-prism.cjs');
const runPrismSource = fs.readFileSync(runPrismPath, 'utf8');

test('LOOP-01: run-prism.cjs references export-prism-constants.cjs as pre-step', () => {
  assert.match(runPrismSource, /export-prism-constants\.cjs/,
    'run-prism.cjs must reference export-prism-constants.cjs for pre-step calibration');
});

test('LOOP-01: run-prism.cjs spawns export-prism-constants.cjs before PRISM execution', () => {
  // Verify it uses spawnSync to run the export script
  assert.match(runPrismSource, /spawnSync\s*\(\s*process\.execPath\s*,\s*\[\s*exportConstantsPath\s*\]/,
    'Must use spawnSync to execute export-prism-constants.cjs');
});

test('LOOP-01: export-prism-constants.cjs exists as a standalone calibration script', () => {
  const exportPath = path.resolve(__dirname, '../../../bin/export-prism-constants.cjs');
  assert.ok(fs.existsSync(exportPath),
    'export-prism-constants.cjs must exist at bin/export-prism-constants.cjs');
});

test('LOOP-01: export-prism-constants.cjs exports computeSlotRates via _pure for rate calculation', () => {
  const exportMod = require(path.resolve(__dirname, '../../../bin/export-prism-constants.cjs'));
  assert.equal(typeof exportMod._pure.computeSlotRates, 'function',
    'export-prism-constants.cjs must export computeSlotRates via _pure');
});
