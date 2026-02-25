#!/usr/bin/env node
'use strict';
// bin/run-audit-alloy.cjs
// Invokes Alloy 6 JAR headless for QGSD audit trail specs (GAP-3, GAP-9).
// Requirements: GAP-3, GAP-9
//
// Usage:
//   node bin/run-audit-alloy.cjs [--spec=<name>]
//
// Valid spec names:
//   scoreboard-recompute  (default) — GAP-3: recomputation idempotency invariants
//   availability-parsing             — GAP-9: date arithmetic invariants
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── 0. Parse --spec argument ──────────────────────────────────────────────────
const VALID_SPECS = ['scoreboard-recompute', 'availability-parsing'];
const args    = process.argv.slice(2);
const specArg = args.find(a => a.startsWith('--spec=')) || null;
const specName = specArg
  ? specArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'scoreboard-recompute');

if (!VALID_SPECS.includes(specName)) {
  process.stderr.write(
    '[run-audit-alloy] Unknown spec: ' + specName +
    '. Valid: ' + VALID_SPECS.join(', ') + '\n'
  );
  process.exit(1);
}

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-audit-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-audit-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    process.exit(1);
  }
} else {
  // Fall back to PATH lookup
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-audit-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-audit-alloy] Download: https://adoptium.net/\n'
    );
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-audit-alloy] Failed to run: ' + javaExe + ' --version\n');
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
// Java version string varies: "openjdk 17.0.1 ..." or "java version \"17.0.1\""
const versionMatch = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor    = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-audit-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-audit-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-audit-alloy] org.alloytools.alloy.dist.jar not found at: ' + jarPath + '\n' +
    '[run-audit-alloy] Download Alloy 6.2.0:\n' +
    '  curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \\\n' +
    '       -o formal/alloy/org.alloytools.alloy.dist.jar\n'
  );
  process.exit(1);
}

// ── 4. Locate .als file ───────────────────────────────────────────────────────
const alsPath = path.join(__dirname, '..', 'formal', 'alloy', specName + '.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-audit-alloy] ' + specName + '.als not found at: ' + alsPath + '\n' +
    '[run-audit-alloy] This file should exist in the repository. Check your git status.\n'
  );
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-audit-alloy] spec: ' + specName + '\n');
process.stdout.write('[run-audit-alloy] ALS:  ' + alsPath + '\n');
process.stdout.write('[run-audit-alloy] JAR:  ' + jarPath + '\n');

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
  process.stderr.write('[run-audit-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
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
    '[run-audit-alloy] WARNING: Counterexample found in ' + specName + '.als assertion.\n' +
    '[run-audit-alloy] This indicates a spec violation — review formal/alloy/' + specName + '.als.\n'
  );
  process.exit(1);
}

if (alloyResult.status !== 0) {
  process.exit(alloyResult.status || 1);
}

process.exit(0);
