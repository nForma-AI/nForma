#!/usr/bin/env node
// @requirement OBS-01
// Structural test: Each quorum round emits structured telemetry
// (slot, round, verdict, latency_ms, provider status) to a per-session log file.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'bin', 'call-quorum-slot.cjs'), 'utf8');

test('OBS-01 — call-quorum-slot.cjs defines recordTelemetry function', () => {
  assert.match(SRC, /function\s+recordTelemetry/, 'must define recordTelemetry function');
});

test('OBS-01 — recordTelemetry accepts structured telemetry fields (slot, round, verdict, latency_ms)', () => {
  // Verify the function signature includes the required parameters
  assert.match(SRC, /recordTelemetry\(slotName,\s*round,\s*verdict,\s*latencyMs/, 'recordTelemetry must accept slot, round, verdict, latencyMs parameters');
  // Verify latency_ms is emitted in the telemetry record
  assert.match(SRC, /latency_ms/, 'telemetry record must include latency_ms field');
});

test('OBS-01 — recordTelemetry is invoked during quorum dispatch', () => {
  // Verify recordTelemetry is actually called (not just defined)
  const callCount = (SRC.match(/recordTelemetry\(/g) || []).length;
  assert.ok(callCount >= 2, 'recordTelemetry must be called at least once beyond its definition');
});
