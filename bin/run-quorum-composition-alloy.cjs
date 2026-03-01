#!/usr/bin/env node
'use strict';
// bin/run-quorum-composition-alloy.cjs
// Invokes Alloy 6 JAR headless for the QGSD quorum composition model.
// Requirements: SPEC-03
//
// Usage:
//   node bin/run-quorum-composition-alloy.cjs
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');

const CHECK_ID = 'alloy:quorum-composition';
const PROPERTY = 'Quorum composition rules — no empty selection, high-risk full fan-out, solo mode single slot';

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-quorum-composition-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-quorum-composition-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (Java not found)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-quorum-composition-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-quorum-composition-alloy] Download: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (Java not found)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-quorum-composition-alloy] Failed to run: ' + javaExe + ' --version\n');
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (version check failed)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-quorum-composition-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-quorum-composition-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (Java < 17)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-quorum-composition-alloy] org.alloytools.alloy.dist.jar not found at: ' + jarPath + '\n' +
    '[run-quorum-composition-alloy] Download Alloy 6.2.0:\n' +
    '  curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \\\n' +
    '       -o formal/alloy/org.alloytools.alloy.dist.jar\n'
  );
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (JAR not found)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Locate formal/alloy/quorum-composition.als ────────────────────────────
const alsPath = path.join(__dirname, '..', 'formal', 'alloy', 'quorum-composition.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-quorum-composition-alloy] quorum-composition.als not found at: ' + alsPath + '\n' +
    '[run-quorum-composition-alloy] This file should exist in the repository. Check your git status.\n'
  );
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: 0, summary: 'fail: ' + CHECK_ID + ' (ALS not found)', triage_tags: [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-quorum-composition-alloy] ALS: ' + alsPath + '\n');
process.stdout.write('[run-quorum-composition-alloy] JAR: ' + jarPath + '\n');

const _startMs = Date.now();

// Use stdio: 'pipe' so we can scan stdout for counterexamples (Alloy exits 0 even on CEX)
const alloyResult = spawnSync(javaExe, [
  '-jar', jarPath,
  'exec',
  '--output', '-',
  '--type', 'text',
  '--quiet',
  alsPath,
], { encoding: 'utf8', stdio: 'pipe' });

if (alloyResult.error) {
  process.stderr.write('[run-quorum-composition-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: _runtimeMs, summary: 'fail: ' + CHECK_ID + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 6. Scan stdout for counterexamples ───────────────────────────────────────
// Alloy 6 exits 0 even when counterexamples are found. Scan stdout to detect them.
const stdout = alloyResult.stdout || '';
const stderr = alloyResult.stderr || '';

// Write stdout to process.stdout (mirrors stdio: 'inherit' output)
if (stdout) { process.stdout.write(stdout); }
if (stderr) { process.stderr.write(stderr); }

if (/Counterexample/i.test(stdout)) {
  process.stderr.write(
    '[run-quorum-composition-alloy] WARNING: Counterexample found in quorum-composition.als assertions\n' +
    '[run-quorum-composition-alloy] (NoEmptySelection / HighRiskFullFanOut / SoloModeSingleSlot / AllRulesHold).\n' +
    '[run-quorum-composition-alloy] This indicates a spec violation — review quorum-composition.als.\n'
  );
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: _runtimeMs, summary: 'fail: ' + CHECK_ID + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

if (alloyResult.status !== 0) {
  const _runtimeMs = Date.now() - _startMs;
  try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'fail', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: _runtimeMs, summary: 'fail: ' + CHECK_ID + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(alloyResult.status || 1);
}

const _runtimeMs = Date.now() - _startMs;
try { writeCheckResult({ tool: 'run-quorum-composition-alloy', formalism: 'alloy', result: 'pass', check_id: CHECK_ID, surface: 'alloy', property: PROPERTY, runtime_ms: _runtimeMs, summary: 'pass: ' + CHECK_ID + ' in ' + _runtimeMs + 'ms', triage_tags: _runtimeMs > 60000 ? ['timeout-risk'] : [], metadata: {} }); } catch (e) { process.stderr.write('[run-quorum-composition-alloy] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(0);
