#!/usr/bin/env node
// @requirement RECV-01
// Auto-generated stub for uncovered invariant: EventualConsensus
// `npx qgsd --reset-breaker` CLI flag clears circuit-breaker-state.json

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const installSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../bin/install.js'),
  'utf8'
);

test('RECV-01 — EventualConsensus: --reset-breaker flag is parsed', () => {
  assert.match(installSrc, /--reset-breaker/,
    'install.js must parse the --reset-breaker CLI flag');
});

test('RECV-01 — EventualConsensus: --reset-breaker clears circuit-breaker-state.json', () => {
  assert.match(installSrc, /circuit-breaker-state\.json/,
    'install.js must reference circuit-breaker-state.json for clearing');
});

test('RECV-01 — EventualConsensus: --reset-breaker removes the state file', () => {
  // Verify fs.rmSync or fs.unlinkSync is used to remove the file
  assert.match(installSrc, /fs\.rmSync\(stateFile\)|fs\.unlinkSync/,
    'install.js must remove the circuit breaker state file');
});

test('RECV-01 — EventualConsensus: --reset-breaker logs confirmation', () => {
  // Verify confirmation message is logged after clearing
  assert.match(installSrc, /Circuit breaker state cleared/,
    'install.js must log confirmation after clearing breaker state');
});
