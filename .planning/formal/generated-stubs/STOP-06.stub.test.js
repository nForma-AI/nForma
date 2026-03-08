#!/usr/bin/env node
// @requirement STOP-06
// Test: Stop hook verifies quorum only when a configured planning command was issued in current turn
// Strategy: structural — verify hasQuorumCommand guard exists and gates quorum enforcement

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '..', '..', '..', 'hooks', 'nf-stop.js');

test('STOP-06: nf-stop.js only enforces quorum when planning command is in current turn', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // Verify hasQuorumCommand function is defined
  assert.match(content, /function\s+hasQuorumCommand\s*\(/,
    'nf-stop.js must define hasQuorumCommand function');
  // Verify hasQuorumCommand is called as a guard with early exit
  assert.match(content, /if\s*\(\s*!hasQuorumCommand\s*\([\s\S]{0,80}\)\s*\)\s*\{[\s\S]{0,80}process\.exit\(0\)/,
    'nf-stop.js must exit(0) when no quorum command found in current turn');
  // Verify buildCommandPattern is used (config-driven command matching)
  assert.match(content, /function\s+buildCommandPattern\s*\(/,
    'nf-stop.js must define buildCommandPattern for configurable command matching');
});
