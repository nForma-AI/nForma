#!/usr/bin/env node
'use strict';
// bin/run-account-pool-alloy.cjs
// Invokes Alloy 6 JAR headless for the QGSD account pool structure spec.
// Requirements: ALY-AM-01
//
// Usage:
//   node bin/run-account-pool-alloy.cjs
//
// Checks (defined in formal/alloy/account-pool-structure.als):
//   AddPreservesValidity    — adding to a valid state yields a valid state
//   SwitchPreservesValidity — switching in a valid state yields a valid state
//   RemovePreservesValidity — removing from a valid state yields a valid state
//   SwitchPreservesPool     — switch never modifies pool membership
//   RemoveShrinksPool       — remove reduces pool size by exactly one
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/alloy/org.alloytools.alloy.dist.jar (see VERIFICATION_TOOLS.md for download)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── 1. Locate Java ───────────────────────────────────────────────────────────
const JAVA_HOME = process.env.JAVA_HOME;
let javaExe;

if (JAVA_HOME) {
  javaExe = path.join(JAVA_HOME, 'bin', 'java');
  if (!fs.existsSync(javaExe)) {
    process.stderr.write(
      '[run-account-pool-alloy] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-account-pool-alloy] Unset JAVA_HOME or fix the path.\n'
    );
    process.exit(1);
  }
} else {
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-account-pool-alloy] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-account-pool-alloy] Download: https://adoptium.net/\n'
    );
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-account-pool-alloy] Failed to run: ' + javaExe + ' --version\n');
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
const versionMatch  = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor     = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-account-pool-alloy] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-account-pool-alloy] Download Java 17+: https://adoptium.net/\n'
  );
  process.exit(1);
}

// ── 3. Locate org.alloytools.alloy.dist.jar ──────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-account-pool-alloy] org.alloytools.alloy.dist.jar not found at: ' + jarPath + '\n' +
    '[run-account-pool-alloy] Download Alloy 6.2.0:\n' +
    '  curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \\\n' +
    '       -o formal/alloy/org.alloytools.alloy.dist.jar\n'
  );
  process.exit(1);
}

// ── 4. Locate formal/alloy/account-pool-structure.als ────────────────────────
const alsPath = path.join(__dirname, '..', 'formal', 'alloy', 'account-pool-structure.als');
if (!fs.existsSync(alsPath)) {
  process.stderr.write(
    '[run-account-pool-alloy] account-pool-structure.als not found at: ' + alsPath + '\n' +
    '[run-account-pool-alloy] This file should exist in the repository. Check your git status.\n'
  );
  process.exit(1);
}

// ── 5. Invoke Alloy 6 ────────────────────────────────────────────────────────
process.stdout.write('[run-account-pool-alloy] ALS: ' + alsPath + '\n');
process.stdout.write('[run-account-pool-alloy] JAR: ' + jarPath + '\n');

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
  process.stderr.write('[run-account-pool-alloy] Alloy invocation failed: ' + alloyResult.error.message + '\n');
  process.exit(1);
}

// ── 6. Scan stdout for counterexamples ───────────────────────────────────────
// Alloy 6 exits 0 even when counterexamples are found. Scan stdout to detect them.
const stdout = alloyResult.stdout || '';
const stderr = alloyResult.stderr || '';

if (stdout) { process.stdout.write(stdout); }
if (stderr) { process.stderr.write(stderr); }

if (/Counterexample/i.test(stdout)) {
  process.stderr.write(
    '[run-account-pool-alloy] WARNING: Counterexample found in account-pool-structure.als assertion.\n' +
    '[run-account-pool-alloy] This indicates a structural invariant violation — review formal/alloy/account-pool-structure.als.\n' +
    '[run-account-pool-alloy] Assertions checked: AddPreservesValidity, SwitchPreservesValidity,\n' +
    '[run-account-pool-alloy]   RemovePreservesValidity, SwitchPreservesPool, RemoveShrinksPool\n'
  );
  process.exit(1);
}

if (alloyResult.status !== 0) {
  process.exit(alloyResult.status || 1);
}

process.exit(0);
