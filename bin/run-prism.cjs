#!/usr/bin/env node
'use strict';
// bin/run-prism.cjs
// Invokes PRISM model checker against formal/prism/quorum.pm.
// Requirements: PRM-01
//
// Usage:
//   node bin/run-prism.cjs                         # default: P=? [ F s=1 ]
//   node bin/run-prism.cjs -pf "P=? [ F s=1 ]"    # explicit property
//   node bin/run-prism.cjs -const tp_rate=0.9274 -const unavail=0.0215
//
// Prerequisites:
//   - PRISM 4.x installed; set PRISM_BIN to path of the prism shell script
//     e.g. export PRISM_BIN="$HOME/prism/bin/prism"
//   - Java >=17 (same JRE used by TLA+/Alloy CI step)
//
// CI: PRISM_BIN is set by the formal-verify workflow step that extracts the
//     Linux binary tarball.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Locate PRISM binary ──────────────────────────────────────────────────────
const prismBin = process.env.PRISM_BIN || 'prism';

// Verify the binary exists (skip check if it's just 'prism' on PATH)
if (prismBin !== 'prism' && !fs.existsSync(prismBin)) {
  process.stderr.write(
    '[run-prism] PRISM binary not found at: ' + prismBin + '\n' +
    '[run-prism] Install PRISM and set PRISM_BIN env var:\n' +
    '[run-prism]   export PRISM_BIN="$HOME/prism/bin/prism"\n' +
    '[run-prism] Download: https://www.prismmodelchecker.org/download.php\n'
  );
  process.exit(1);
}

// ── Locate model file ────────────────────────────────────────────────────────
const modelPath = path.join(__dirname, '..', 'formal', 'prism', 'quorum.pm');
if (!fs.existsSync(modelPath)) {
  process.stderr.write(
    '[run-prism] Model file not found: ' + modelPath + '\n'
  );
  process.exit(1);
}

// ── Build argument list ──────────────────────────────────────────────────────
// Extra args passed to this script are forwarded to PRISM after the model path.
// Default property: P=? [ F s=1 ] — probability of eventually reaching DECIDED.
const extraArgs = process.argv.slice(2);
const hasPf = extraArgs.some(a => a === '-pf' || a === '-prop');
const prismArgs = [modelPath];
if (!hasPf) {
  prismArgs.push('-pf', 'P=? [ F s=1 ]');
}
prismArgs.push(...extraArgs);

process.stdout.write('[run-prism] Binary: ' + prismBin + '\n');
process.stdout.write('[run-prism] Model:  ' + modelPath + '\n');
process.stdout.write('[run-prism] Args:   ' + prismArgs.slice(1).join(' ') + '\n');

// ── Invoke PRISM ─────────────────────────────────────────────────────────────
const result = spawnSync(prismBin, prismArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write('[run-prism] Failed to launch PRISM: ' + result.error.message + '\n');
  process.exit(1);
}

process.exit(result.status || 0);
