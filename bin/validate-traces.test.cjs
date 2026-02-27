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

// ── Confidence Tier Tests (v0.19-04-02 RED phase) ────────────────────────────

test('validate-traces exports computeConfidenceTier and CONFIDENCE_THRESHOLDS', () => {
  const m = require('../bin/validate-traces.cjs');
  assert.strictEqual(typeof m.computeConfidenceTier, 'function', 'computeConfidenceTier should be a function');
  assert.ok(m.CONFIDENCE_THRESHOLDS, 'CONFIDENCE_THRESHOLDS should be exported');
});

test('computeConfidenceTier boundary: (0, 0) => low', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(0, 0), 'low');
});

test('computeConfidenceTier boundary: (49, 2) => low', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(49, 2), 'low');
});

test('computeConfidenceTier boundary: (50, 3) => low (below medium threshold)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(50, 3), 'low');
});

test('computeConfidenceTier boundary: (499, 13) => low (just below medium)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(499, 13), 'low');
});

test('computeConfidenceTier boundary: (500, 14) => medium (exact medium boundary)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(500, 14), 'medium');
});

test('computeConfidenceTier boundary: (501, 15) => medium', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(501, 15), 'medium');
});

test('computeConfidenceTier boundary: (5000, 30) => medium (rounds OK but days < 90)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(5000, 30), 'medium');
});

test('computeConfidenceTier boundary: (9999, 89) => medium (just below high)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(9999, 89), 'medium');
});

test('computeConfidenceTier boundary: (10000, 90) => high (exact high boundary)', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(10000, 90), 'high');
});

test('computeConfidenceTier boundary: (50000, 365) => high', () => {
  const { computeConfidenceTier } = require('../bin/validate-traces.cjs');
  assert.strictEqual(computeConfidenceTier(50000, 365), 'high');
});

test('CONFIDENCE_THRESHOLDS.medium.min_rounds === 500 and high.min_rounds === 10000', () => {
  const { CONFIDENCE_THRESHOLDS } = require('../bin/validate-traces.cjs');
  assert.strictEqual(CONFIDENCE_THRESHOLDS.medium.min_rounds, 500);
  assert.strictEqual(CONFIDENCE_THRESHOLDS.medium.min_days, 14);
  assert.strictEqual(CONFIDENCE_THRESHOLDS.high.min_rounds, 10000);
  assert.strictEqual(CONFIDENCE_THRESHOLDS.high.min_days, 90);
});

test('integration: divergence object contains confidence field for unmappable_action', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-vtrace-conf-test-'));
  const ndjsonPath = path.join(tmpDir, 'check-results.ndjson');
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  const badEvent = JSON.stringify({
    ts: new Date().toISOString(),
    phase: 'IDLE',
    action: 'unknown_action_xyz',
    slots_available: 4,
    vote_result: null,
    outcome: null,
    schema_version: '1',
  });
  fs.writeFileSync(path.join(planningDir, 'conformance-events.jsonl'), badEvent + '\n', 'utf8');

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, 'validate-traces.cjs')],
    { cwd: tmpDir, encoding: 'utf8', env: { ...process.env, CHECK_RESULTS_PATH: ndjsonPath } }
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });

  assert.strictEqual(result.status, 1);
  // The stdout should include the divergence with a confidence field
  assert.match(result.stdout, /confidence/i, 'divergence output should include confidence field');
});

// -- MCP field validation (MCPENV-03) ----------------------------------------
// Wave 0 failing tests. These MUST be in RED state before Plan 03 implements
// validateMCPMetadata in validate-traces.cjs.
// Ref: .planning/phases/v0.19-05-mcp-environment-model/v0.19-05-01-PLAN.md

test("validate-traces emits error for mcp_call missing request_id", { todo: "not yet implemented - RED state, turns GREEN in Plan 03" }, () => {
  const tmpDir = fs.mkdtempSync(require("os").tmpdir() + "/qgsd-mcp-");
  const planningDir = require("path").join(tmpDir, ".planning");
  fs.mkdirSync(planningDir, { recursive: true });
  const event = JSON.stringify({ action: "mcp_call", peer: "codex-1", mcp_outcome: "success", attempt: 1 });
  fs.writeFileSync(require("path").join(planningDir, "conformance-events.jsonl"), event + "
", "utf8");
  const result = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "validate-traces.cjs")], { cwd: tmpDir, encoding: "utf8" });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.fail("not yet implemented - validateMCPMetadata does not exist in validate-traces.cjs");
});

test("validate-traces accepts mcp_call with all required fields", { todo: "not yet implemented - RED state, turns GREEN in Plan 03" }, () => {
  const tmpDir = fs.mkdtempSync(require("os").tmpdir() + "/qgsd-mcp-");
  const planningDir = require("path").join(tmpDir, ".planning");
  fs.mkdirSync(planningDir, { recursive: true });
  const event = JSON.stringify({ action: "mcp_call", request_id: "round1:codex-1:1", peer: "codex-1", mcp_outcome: "success", attempt: 1 });
  fs.writeFileSync(require("path").join(planningDir, "conformance-events.jsonl"), event + "
", "utf8");
  const result = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "validate-traces.cjs")], { cwd: tmpDir, encoding: "utf8" });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.fail("not yet implemented - validateMCPMetadata does not exist in validate-traces.cjs");
});

test("validate-traces ignores MCP metadata fields for non-mcp_call actions", { todo: "not yet implemented - RED state, turns GREEN in Plan 03" }, () => {
  const tmpDir = fs.mkdtempSync(require("os").tmpdir() + "/qgsd-mcp-");
  const planningDir = require("path").join(tmpDir, ".planning");
  fs.mkdirSync(planningDir, { recursive: true });
  const event = JSON.stringify({ action: "quorum_start", slots_available: 4 });
  fs.writeFileSync(require("path").join(planningDir, "conformance-events.jsonl"), event + "
", "utf8");
  const result = require("child_process").spawnSync(process.execPath, [require("path").join(__dirname, "validate-traces.cjs")], { cwd: tmpDir, encoding: "utf8" });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.fail("not yet implemented - validateMCPMetadata does not exist in validate-traces.cjs");
});
