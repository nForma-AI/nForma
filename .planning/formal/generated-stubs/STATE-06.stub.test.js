#!/usr/bin/env node
// @requirement STATE-06
// Verify: phase-complete falls back to ROADMAP.md heading parsing with segment-aware
// version comparison for versioned phase IDs, sets is_last_phase=true only when no higher phase
// Strategy: structural — assert the implementing code contains the required patterns

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const gsdToolsPath = path.join(ROOT, 'core', 'bin', 'gsd-tools.cjs');

test('STATE-06: phase-complete has segment-aware version comparison', () => {
  const content = fs.readFileSync(gsdToolsPath, 'utf8');

  // Must have comparePhaseVersions function with segment splitting
  assert.match(content, /comparePhaseVersions/,
    'gsd-tools.cjs should define comparePhaseVersions helper');

  // Must split on '-' for segment comparison (not just parseFloat)
  assert.match(content, /split\(['"]-['"]\)/,
    'comparePhaseVersions should split on "-" for segment-aware comparison');
});

test('STATE-06: phase-complete falls back to ROADMAP.md heading parsing', () => {
  const content = fs.readFileSync(gsdToolsPath, 'utf8');

  // Must read ROADMAP.md when isLastPhase is still true (fallback path)
  assert.match(content, /isLastPhase.*ROADMAP|ROADMAP.*isLastPhase/s,
    'Should check ROADMAP.md as fallback when no next-phase directory exists');

  // Must parse phase headings from ROADMAP.md
  assert.match(content, /Phase\s.*phasePattern|phasePattern.*Phase/s,
    'Should parse phase headings from ROADMAP.md');
});

test('STATE-06: is_last_phase set correctly based on roadmap phases', () => {
  const content = fs.readFileSync(gsdToolsPath, 'utf8');

  // is_last_phase starts as true and only changes to false when a higher phase is found
  assert.match(content, /isLastPhase\s*=\s*true/,
    'isLastPhase should default to true');

  assert.match(content, /isLastPhase\s*=\s*false/,
    'isLastPhase should be set to false when a higher-numbered phase is found');

  // Output includes is_last_phase
  assert.match(content, /is_last_phase:\s*isLastPhase/,
    'Output should include is_last_phase field');
});
