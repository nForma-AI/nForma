#!/usr/bin/env node
'use strict';
// bin/run-oscillation-tlc.cjs
// Invokes TLC model checker for QGSD oscillation and convergence TLA+ specifications.
// Requirements: GAP-1, GAP-5
//
// Usage:
//   node bin/run-oscillation-tlc.cjs MCoscillation   # oscillation detection (liveness, -workers 1)
//   node bin/run-oscillation-tlc.cjs MCconvergence   # state persistence (liveness, -workers 1)
//   node bin/run-oscillation-tlc.cjs --config=MCoscillation
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/tla/tla2tools.jar (see formal/tla/README.md for download command)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const { writeCheckResult } = require('./write-check-result.cjs');

// ── Parse --config argument ──────────────────────────────────────────────────
const args       = process.argv.slice(2);
const configArg  = args.find(a => a.startsWith('--config=')) || null;
const configName = configArg
  ? configArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'MCoscillation');

const VALID_CONFIGS = ['MCoscillation', 'MCconvergence'];
if (!VALID_CONFIGS.includes(configName)) {
  process.stderr.write(
    '[run-oscillation-tlc] Unknown config: ' + configName +
    '. Valid: ' + VALID_CONFIGS.join(', ') + '\n'
  );
  try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-oscillation-tlc] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-oscillation-tlc] Unset JAVA_HOME or fix the path.\n'
    );
    try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-oscillation-tlc] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-oscillation-tlc] Download: https://adoptium.net/\n'
    );
    try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-oscillation-tlc] Failed to run: ' + javaExe + ' --version\n');
  try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
// Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-oscillation-tlc] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-oscillation-tlc] Download Java 17+: https://adoptium.net/\n'
  );
  try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 3. Locate tla2tools.jar ──────────────────────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'tla', 'tla2tools.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-oscillation-tlc] tla2tools.jar not found at: ' + jarPath + '\n' +
    '[run-oscillation-tlc] Download v1.8.0:\n' +
    '  curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \\\n' +
    '       -o formal/tla/tla2tools.jar\n'
  );
  try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

// ── 4. Resolve spec and config paths ─────────────────────────────────────────
const specFileName = configName === 'MCoscillation'
  ? 'QGSDOscillation.tla'
  : 'QGSDConvergence.tla';
const specPath = path.join(__dirname, '..', 'formal', 'tla', specFileName);
const cfgPath  = path.join(__dirname, '..', 'formal', 'tla', configName + '.cfg');

// Both MCoscillation and MCconvergence declare PROPERTY (liveness) clauses in their .cfg files.
// TLC has a known multi-worker liveness checking bug (v1.8.0) — always use -workers 1.
// MCconvergence.cfg declares PROPERTY ConvergenceEventuallyResolves; 'auto' workers is NOT safe.
const workers = '1';

// ── 5. Invoke TLC ────────────────────────────────────────────────────────────
process.stdout.write('[run-oscillation-tlc] Config: ' + configName + '  Workers: ' + workers + '\n');
process.stdout.write('[run-oscillation-tlc] Spec:   ' + specPath + '\n');
process.stdout.write('[run-oscillation-tlc] Cfg:    ' + cfgPath + '\n');

const tlcResult = spawnSync(javaExe, [
  '-jar', jarPath,
  '-config', cfgPath,
  '-workers', workers,
  specPath,
], { encoding: 'utf8', stdio: 'inherit' });

if (tlcResult.error) {
  process.stderr.write('[run-oscillation-tlc] TLC invocation failed: ' + tlcResult.error.message + '\n');
  try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(1);
}

const passed = (tlcResult.status || 0) === 0;
try { writeCheckResult({ tool: 'run-oscillation-tlc', formalism: 'tla', result: passed ? 'pass' : 'fail', metadata: { config: configName } }); } catch (e) { process.stderr.write('[run-oscillation-tlc] Warning: failed to write check result: ' + e.message + '\n'); }
process.exit(tlcResult.status || 0);
