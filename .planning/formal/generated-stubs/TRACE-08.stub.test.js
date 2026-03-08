#!/usr/bin/env node
// @requirement TRACE-08
// Validates: mapToXStateEvent normalizes event identity via event.action || event.type fallback,
// handles quorum_fallback_t1_required, quorum_block_r3_2, and security_sweep actions,
// and KNOWN_NON_FSM_ACTIONS are counted as valid (not divergent)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const VALIDATE_TRACES_PATH = path.join(ROOT, 'bin', 'validate-traces.cjs');

test('TRACE-08: validate-traces.cjs exports mapToXStateEvent', () => {
  const mod = require(VALIDATE_TRACES_PATH);
  assert.equal(typeof mod.mapToXStateEvent, 'function', 'must export mapToXStateEvent');
});

test('TRACE-08: mapToXStateEvent uses action || type fallback', () => {
  const content = fs.readFileSync(VALIDATE_TRACES_PATH, 'utf8');
  assert.match(content, /event\.action\s*\|\|\s*event\.type/, 'must normalize via event.action || event.type fallback');
});

test('TRACE-08: mapToXStateEvent handles quorum_fallback_t1_required', () => {
  const { mapToXStateEvent } = require(VALIDATE_TRACES_PATH);
  const result = mapToXStateEvent({ action: 'quorum_fallback_t1_required' });
  assert.ok(result !== null, 'quorum_fallback_t1_required must produce a valid event');
  assert.equal(result.type, 'QUORUM_START', 'quorum_fallback_t1_required maps to QUORUM_START');
});

test('TRACE-08: mapToXStateEvent handles quorum_block_r3_2', () => {
  const { mapToXStateEvent } = require(VALIDATE_TRACES_PATH);
  const result = mapToXStateEvent({ action: 'quorum_block_r3_2' });
  assert.ok(result !== null, 'quorum_block_r3_2 must produce a valid event');
  assert.equal(result.type, 'DECIDE', 'quorum_block_r3_2 maps to DECIDE');
});

test('TRACE-08: mapToXStateEvent returns null for security_sweep (non-FSM)', () => {
  const { mapToXStateEvent } = require(VALIDATE_TRACES_PATH);
  const result = mapToXStateEvent({ action: 'security_sweep' });
  assert.equal(result, null, 'security_sweep is not an FSM event, returns null');
});

test('TRACE-08: KNOWN_NON_FSM_ACTIONS includes security_sweep', () => {
  const content = fs.readFileSync(VALIDATE_TRACES_PATH, 'utf8');
  assert.match(content, /KNOWN_NON_FSM_ACTIONS/, 'must define KNOWN_NON_FSM_ACTIONS');
  assert.match(content, /security_sweep/, 'KNOWN_NON_FSM_ACTIONS must include security_sweep');
});
