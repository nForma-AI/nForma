#!/usr/bin/env node
'use strict';
// bin/run-account-manager-tlc.cjs
// Invokes TLC model checker for the QGSD account manager TLA+ specification.
// Source spec: formal/tla/QGSDAccountManager.tla
// Source impl: bin/account-manager.cjs
//
// Checks:
//   TypeOK              — all variables conform to declared types
//   ActiveIsPoolMember  — active account (when set) must be in the pool
//   NoActiveWhenEmpty   — empty pool implies no active account
//   IdleNoPending       — in IDLE state, no pending operation
//   OpMatchesState      — pending_op.type matches current FSM state
//   IdleReachable       — IDLE is eventually reachable from any state (liveness)
//
// Usage:
//   node bin/run-account-manager-tlc.cjs                    # default: MCaccount-manager
//   node bin/run-account-manager-tlc.cjs MCaccount-manager
//   node bin/run-account-manager-tlc.cjs --config=MCaccount-manager
//
// Prerequisites:
//   - Java >=17 (https://adoptium.net/)
//   - formal/tla/tla2tools.jar (see formal/tla/README.md for download command)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Parse --config argument ──────────────────────────────────────────────────
const args       = process.argv.slice(2);
const configArg  = args.find(a => a.startsWith('--config=')) || null;
const configName = configArg
  ? configArg.split('=')[1]
  : (args.find(a => !a.startsWith('-')) || 'MCaccount-manager');

const VALID_CONFIGS = ['MCaccount-manager'];
if (!VALID_CONFIGS.includes(configName)) {
  process.stderr.write(
    '[run-account-manager-tlc] Unknown config: ' + configName +
    '. Valid: ' + VALID_CONFIGS.join(', ') + '\n'
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
      '[run-account-manager-tlc] JAVA_HOME is set but java binary not found at: ' + javaExe + '\n' +
      '[run-account-manager-tlc] Unset JAVA_HOME or fix the path.\n'
    );
    process.exit(1);
  }
} else {
  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    process.stderr.write(
      '[run-account-manager-tlc] Java not found. Install Java >=17 and set JAVA_HOME.\n' +
      '[run-account-manager-tlc] Download: https://adoptium.net/\n'
    );
    process.exit(1);
  }
  javaExe = 'java';
}

// ── 2. Check Java version >=17 ───────────────────────────────────────────────
const versionResult = spawnSync(javaExe, ['--version'], { encoding: 'utf8' });
if (versionResult.error || versionResult.status !== 0) {
  process.stderr.write('[run-account-manager-tlc] Failed to run: ' + javaExe + ' --version\n');
  process.exit(1);
}
const versionOutput = versionResult.stdout + versionResult.stderr;
const versionMatch  = versionOutput.match(/(?:openjdk\s+|java version\s+[""]?)(\d+)/i);
const javaMajor     = versionMatch ? parseInt(versionMatch[1], 10) : 0;
if (javaMajor < 17) {
  process.stderr.write(
    '[run-account-manager-tlc] Java >=17 required. Found: ' + versionOutput.split('\n')[0] + '\n' +
    '[run-account-manager-tlc] Download Java 17+: https://adoptium.net/\n'
  );
  process.exit(1);
}

// ── 3. Locate tla2tools.jar ──────────────────────────────────────────────────
const jarPath = path.join(__dirname, '..', 'formal', 'tla', 'tla2tools.jar');
if (!fs.existsSync(jarPath)) {
  process.stderr.write(
    '[run-account-manager-tlc] tla2tools.jar not found at: ' + jarPath + '\n' +
    '[run-account-manager-tlc] Download v1.8.0:\n' +
    '  curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \\\n' +
    '       -o formal/tla/tla2tools.jar\n'
  );
  process.exit(1);
}

// ── 4. Invoke TLC ────────────────────────────────────────────────────────────
const specPath = path.join(__dirname, '..', 'formal', 'tla', 'QGSDAccountManager.tla');
const cfgPath  = path.join(__dirname, '..', 'formal', 'tla', configName + '.cfg');
// Use workers=1 for liveness (IdleReachable) — avoids multi-worker liveness bugs in TLC
const workers  = '1';

process.stdout.write('[run-account-manager-tlc] Config: ' + configName + '  Workers: ' + workers + '\n');
process.stdout.write('[run-account-manager-tlc] Spec:   ' + specPath + '\n');
process.stdout.write('[run-account-manager-tlc] Cfg:    ' + cfgPath + '\n');

const tlcResult = spawnSync(javaExe, [
  '-jar', jarPath,
  '-config', cfgPath,
  '-workers', workers,
  specPath,
], { encoding: 'utf8', stdio: 'inherit' });

if (tlcResult.error) {
  process.stderr.write('[run-account-manager-tlc] TLC invocation failed: ' + tlcResult.error.message + '\n');
  process.exit(1);
}

process.exit(tlcResult.status || 0);
