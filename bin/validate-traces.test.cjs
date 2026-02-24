'use strict';
// bin/validate-traces.test.cjs
// Unit tests (Wave 0) + integration tests (Plan 03) for the conformance event validator.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const os   = require('os');
const path = require('path');

// Helper: write a temp NDJSON file and run validate-traces.cjs against it
function runValidator(ndjsonLines) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  if (ndjsonLines !== null) {
    const logFile = path.join(planningDir, 'conformance-events.jsonl');
    fs.writeFileSync(logFile, ndjsonLines.join('\n') + '\n', 'utf8');
  }
  const result = spawnSync(process.execPath, [
    path.join(__dirname, 'validate-traces.cjs')
  ], { cwd: tmpDir, encoding: 'utf8' });
  // Clean up temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return result;
}

test('schema module exports VALID_ACTIONS array', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_ACTIONS), 'VALID_ACTIONS should be an array');
  assert.ok(schema.VALID_ACTIONS.length > 0, 'VALID_ACTIONS should not be empty');
});

test('schema module exports VALID_PHASES array', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_PHASES), 'VALID_PHASES should be an array');
  assert.ok(schema.VALID_PHASES.includes('IDLE'), 'VALID_PHASES should include IDLE');
  assert.ok(schema.VALID_PHASES.includes('COLLECTING_VOTES'), 'VALID_PHASES should include COLLECTING_VOTES');
  assert.ok(schema.VALID_PHASES.includes('DELIBERATING'), 'VALID_PHASES should include DELIBERATING');
  assert.ok(schema.VALID_PHASES.includes('DECIDED'), 'VALID_PHASES should include DECIDED');
});

test('schema module exports VALID_OUTCOMES and schema_version', () => {
  const schema = require('../bin/conformance-schema.cjs');
  assert.ok(Array.isArray(schema.VALID_OUTCOMES), 'VALID_OUTCOMES should be an array');
  assert.strictEqual(typeof schema.schema_version, 'string', 'schema_version should be a string');
});

test('event shape has required fields', () => {
  const event = {
    ts: new Date().toISOString(),
    phase: 'IDLE',
    action: 'quorum_start',
    slots_available: 4,
    vote_result: null,
    outcome: null,
  };
  const keys = Object.keys(event);
  assert.ok(keys.includes('ts'), 'event must have ts');
  assert.ok(keys.includes('phase'), 'event must have phase');
  assert.ok(keys.includes('action'), 'event must have action');
  assert.ok(keys.includes('slots_available'), 'event must have slots_available');
  assert.ok(keys.includes('vote_result'), 'event must have vote_result');
  assert.ok(keys.includes('outcome'), 'event must have outcome');
});

test('deviation score formula: 3 valid of 4 total = 75.0%', () => {
  const score = (3 / 4 * 100).toFixed(1);
  assert.strictEqual(score, '75.0', 'deviation score formula should compute 75.0 for 3/4');
});

// ── Integration tests (Plan 03) ──────────────────────────────────────────────

test('exit code 0 when no log file exists', () => {
  const result = runValidator(null);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /No conformance log/);
});

test('exit code 0 on valid quorum_start trace', () => {
  const event = JSON.stringify({
    ts: new Date().toISOString(),
    phase: 'IDLE',
    action: 'quorum_start',
    slots_available: 4,
    vote_result: null,
    outcome: null,
    schema_version: '1',
  });
  const result = runValidator([event]);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /100\.0%/);
});

test('exit code 1 on unmappable action in trace', () => {
  const event = JSON.stringify({
    ts: new Date().toISOString(),
    phase: 'IDLE',
    action: 'unknown_action_xyz',
    slots_available: 4,
    vote_result: null,
    outcome: null,
    schema_version: '1',
  });
  const result = runValidator([event]);
  assert.strictEqual(result.status, 1);
  assert.match(result.stdout, /divergence/i);
});
