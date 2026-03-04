#!/usr/bin/env node
'use strict';
// bin/run-uppaal.cjs
// Invokes UPPAAL verifyta model checker against .formal/uppaal/quorum-races.xml.
// Requirements: UPPAAL-01, UPPAAL-02, UPPAAL-03
//
// Usage:
//   node bin/run-uppaal.cjs
//   VERIFYTA_BIN=/path/to/verifyta node bin/run-uppaal.cjs
//
// Prerequisites:
//   - UPPAAL 4.x or 5.x; set VERIFYTA_BIN to path of the verifyta binary
//     e.g. export VERIFYTA_BIN="$HOME/uppaal/bin/verifyta"
//   - Download: https://uppaal.org/downloads/
//
// Graceful degradation: if verifyta is not found, exits 0 with result=inconclusive.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');
const { parseNDJSON } = require('./verify-formal-results.cjs');
const { getRequirementIds } = require('./requirement-map.cjs');

const CHECK_ID  = 'uppaal:quorum-races';
const SURFACE   = 'uppaal';
const PROPERTY  = 'Quorum timed race model — minimum inter-slot gap and maximum timeout for consensus';
const TAG       = '[run-uppaal]';

// Default timing fallbacks (override via empirical check-results.ndjson data)
const DEFAULT_MIN_SLOT_MS = 50;
const DEFAULT_MAX_SLOT_MS = 500;
const DEFAULT_TIMEOUT_MS  = 1500;
const DEFAULT_MIN_GAP_MS  = 10;

/**
 * Read empirical timing bounds from check-results.ndjson.
 * Uses tla:* check records' runtime_ms as slot response time proxy.
 * Falls back to defaults if no data.
 * @returns {{ minSlotMs, maxSlotMs, timeoutMs, minGapMs }}
 */
function readTimingBounds() {
  const ndjsonPath = process.env.CHECK_RESULTS_PATH ||
    path.join(__dirname, '..', '.formal', 'check-results.ndjson');
  const records = parseNDJSON(ndjsonPath);
  const slotRuntimes = records
    .filter(r => r.check_id && r.check_id.startsWith('tla:') && typeof r.runtime_ms === 'number' && r.runtime_ms > 0)
    .map(r => r.runtime_ms);

  if (slotRuntimes.length === 0) {
    process.stderr.write(TAG + ' No tla: runtime_ms data found — using defaults\n');
    return {
      minSlotMs: DEFAULT_MIN_SLOT_MS,
      maxSlotMs: DEFAULT_MAX_SLOT_MS,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      minGapMs:  DEFAULT_MIN_GAP_MS,
    };
  }

  const minSlotMs = Math.max(1, Math.min(...slotRuntimes));
  const maxSlotMs = Math.max(...slotRuntimes);
  const timeoutMs = Math.max(maxSlotMs * 3, DEFAULT_TIMEOUT_MS);
  const minGapMs  = Math.max(1, Math.floor(minSlotMs / 5));

  process.stderr.write(
    TAG + ' Timing bounds from NDJSON: ' +
    'min=' + minSlotMs + 'ms, max=' + maxSlotMs + 'ms, timeout=' + timeoutMs + 'ms\n'
  );
  return { minSlotMs, maxSlotMs, timeoutMs, minGapMs };
}

/**
 * Find verifyta binary. Checks VERIFYTA_BIN env, then PATH.
 * Returns null if not found (caller handles graceful degradation).
 */
function locateVerifyta() {
  const envBin = process.env.VERIFYTA_BIN;
  if (envBin) {
    return fs.existsSync(envBin) ? envBin : null;
  }
  // Check local install from install-formal-tools.cjs
  const localPath = path.join(__dirname, '..', '.formal', 'uppaal', 'bin', 'verifyta');
  if (fs.existsSync(localPath)) {
    process.stderr.write(TAG + ' Using local verifyta: ' + localPath + '\n');
    return localPath;
  }
  // Try 'verifyta' on PATH via which
  const which = spawnSync('which', ['verifyta'], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) {
    return which.stdout.trim();
  }
  return null;
}

function main() {
  const startMs = Date.now();
  const modelPath = path.join(__dirname, '..', '.formal', 'uppaal', 'quorum-races.xml');
  const queryPath = path.join(__dirname, '..', '.formal', 'uppaal', 'quorum-races.q');

  // Check model files exist
  if (!fs.existsSync(modelPath) || !fs.existsSync(queryPath)) {
    const missing = [modelPath, queryPath].filter(p => !fs.existsSync(p)).join(', ');
    process.stderr.write(TAG + ' Model files not found: ' + missing + '\n');
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal', result: 'inconclusive',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: Date.now() - startMs,
      summary: 'inconclusive: model files not found — run Plan 03 first',
      triage_tags: ['missing-model'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: { missing },
    });
    process.exit(0);
  }

  // Read empirical timing bounds
  const bounds = readTimingBounds();

  // Locate verifyta
  const verifytaBin = locateVerifyta();
  if (!verifytaBin) {
    process.stderr.write(
      TAG + ' verifyta not found. Install UPPAAL and set VERIFYTA_BIN:\n' +
      TAG + '   export VERIFYTA_BIN="$HOME/uppaal/bin/verifyta"\n' +
      TAG + ' Download: https://uppaal.org/downloads/\n'
    );
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal', result: 'inconclusive',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: Date.now() - startMs,
      summary: 'inconclusive: verifyta not installed — install UPPAAL to run model checker',
      triage_tags: ['no-verifyta'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: {
        min_slot_ms: bounds.minSlotMs,
        max_slot_ms: bounds.maxSlotMs,
        timeout_ms: bounds.timeoutMs,
      },
    });
    process.exit(0);
  }

  // Build verifyta arguments with empirical timing bounds as -C constants
  const args = [
    '-C', 'MIN_SLOT_MS=' + bounds.minSlotMs,
    '-C', 'MAX_SLOT_MS=' + bounds.maxSlotMs,
    '-C', 'TIMEOUT_MS=' + bounds.timeoutMs,
    '-C', 'MIN_GAP_MS=' + bounds.minGapMs,
    modelPath,
    queryPath,
  ];

  process.stderr.write(TAG + ' Running: ' + verifytaBin + ' ' + args.join(' ') + '\n');
  const result = spawnSync(verifytaBin, args, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });

  const runtimeMs = Date.now() - startMs;
  const combinedOutput = (result.stdout || '') + (result.stderr || '');

  // Stream output for visibility
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    process.stderr.write(TAG + ' Launch error: ' + result.error.message + '\n');
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal', result: 'fail',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: runtimeMs,
      summary: 'fail: verifyta launch error — ' + result.error.message,
      triage_tags: ['verifyta-error'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: { bounds },
    });
    process.exit(0);
  }

  // Detect UPPAAL 5.x license requirement (free academic license changed in 5.0)
  if (combinedOutput.includes('License does not cover verifier') ||
      combinedOutput.includes('license key is not set')) {
    process.stderr.write(
      TAG + ' UPPAAL 5.x requires a free academic license key.\n' +
      TAG + '   Register at: https://uppaal.org/academic/ \n' +
      TAG + '   Then set: export UPPAAL_LICENSE_FILE=/path/to/license.key\n'
    );
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal', result: 'inconclusive',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: runtimeMs,
      summary: 'inconclusive: UPPAAL 5.x license required — register at uppaal.org/academic/',
      triage_tags: ['needs-license'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: { bounds },
    });
    process.exit(0);
  }

  // Detect --disable-memory-reduction duplicate option bug (UPPAAL 5.0.0 bug with -C flags)
  if (combinedOutput.includes('--disable-memory-reduction') &&
      combinedOutput.includes('cannot be specified more than once')) {
    process.stderr.write(
      TAG + ' Known UPPAAL 5.0.0 bug: -C flags trigger duplicate --disable-memory-reduction.\n' +
      TAG + ' Workaround: set constants in the XML model directly instead of via -C.\n'
    );
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal', result: 'inconclusive',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: runtimeMs,
      summary: 'inconclusive: UPPAAL 5.0.0 -C flag bug — falling back to XML-embedded constants',
      triage_tags: ['uppaal-bug'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: { bounds },
    });
    // Retry without -C flags — use the XML-embedded default constants
    process.stderr.write(TAG + ' Retrying without -C flags...\n');
    const retryArgs = [modelPath, queryPath];
    const retry = spawnSync(verifytaBin, retryArgs, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
    const retryOutput = (retry.stdout || '') + (retry.stderr || '');
    if (retry.stdout) process.stdout.write(retry.stdout);
    if (retry.stderr) process.stderr.write(retry.stderr);

    // If retry also hits license error, handle that
    if (retryOutput.includes('License does not cover verifier')) {
      process.stderr.write(TAG + ' License required — see above.\n');
      process.exit(0);  // already wrote inconclusive check result
    }

    const retryPassed = retry.status === 0;
    const retryMs = Date.now() - startMs;
    writeCheckResult({
      tool: 'run-uppaal', formalism: 'uppaal',
      result: retryPassed ? 'pass' : 'fail',
      check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
      runtime_ms: retryMs,
      summary: (retryPassed ? 'pass' : 'fail') + ': uppaal:quorum-races in ' + retryMs +
        'ms (XML defaults, -C workaround)',
      triage_tags: retryPassed ? [] : ['race-detected'],
      requirement_ids: getRequirementIds(CHECK_ID),
      metadata: { bounds, exit_status: retry.status, workaround: 'no-C-flags' },
    });
    process.exit(0);
  }

  const passed = result.status === 0;
  writeCheckResult({
    tool: 'run-uppaal', formalism: 'uppaal',
    result: passed ? 'pass' : 'fail',
    check_id: CHECK_ID, surface: SURFACE, property: PROPERTY,
    runtime_ms: runtimeMs,
    summary: (passed ? 'pass' : 'fail') + ': uppaal:quorum-races in ' + runtimeMs + 'ms' +
      ' (min_slot=' + bounds.minSlotMs + 'ms, max_slot=' + bounds.maxSlotMs +
      'ms, timeout=' + bounds.timeoutMs + 'ms)',
    triage_tags: passed ? [] : ['race-detected'],
    requirement_ids: getRequirementIds(CHECK_ID),
    metadata: { bounds, exit_status: result.status },
  });
}

main();
