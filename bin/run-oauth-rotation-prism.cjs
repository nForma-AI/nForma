#!/usr/bin/env node
'use strict';
// bin/run-oauth-rotation-prism.cjs
// Invokes PRISM model checker against formal/prism/oauth-rotation.pm.
// Requirements: PRM-AM-01
//
// Usage:
//   node bin/run-oauth-rotation-prism.cjs                           # all 3 properties
//   node bin/run-oauth-rotation-prism.cjs -pf "P=? [ F s=1 ]"      # explicit property
//   node bin/run-oauth-rotation-prism.cjs -const p_fail=0.15        # override failure rate
//   node bin/run-oauth-rotation-prism.cjs -const p_fail=0.15 -const max_retries=5
//
// Properties (formal/prism/oauth-rotation.props):
//   P=? [ F s=1 ]              — probability of eventual success within max_retries
//   P=? [ F s=0 ]              — probability all attempts fail (complement)
//   R{"rotations"}=? [ F s<=1] — expected number of rotation attempts before outcome
//
// Defaults: p_fail=0.30, max_retries=3
//   Expected P(succeed) ≈ 1 - 0.3^3 = 0.973
//
// Prerequisites:
//   - PRISM 4.x installed; set PRISM_BIN to path of the prism shell script
//     e.g. export PRISM_BIN="$HOME/prism/bin/prism"
//   - Java >=17 (same JRE used by TLA+/Alloy)

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Locate PRISM binary ──────────────────────────────────────────────────────
const prismBin = process.env.PRISM_BIN || 'prism';

if (prismBin !== 'prism' && !fs.existsSync(prismBin)) {
  process.stderr.write(
    '[run-oauth-rotation-prism] PRISM binary not found at: ' + prismBin + '\n' +
    '[run-oauth-rotation-prism] Install PRISM and set PRISM_BIN env var:\n' +
    '[run-oauth-rotation-prism]   export PRISM_BIN="$HOME/prism/bin/prism"\n' +
    '[run-oauth-rotation-prism] Download: https://www.prismmodelchecker.org/download.php\n'
  );
  process.exit(1);
}

// ── Locate model file ────────────────────────────────────────────────────────
const modelPath = path.join(__dirname, '..', 'formal', 'prism', 'oauth-rotation.pm');
if (!fs.existsSync(modelPath)) {
  process.stderr.write(
    '[run-oauth-rotation-prism] Model file not found: ' + modelPath + '\n'
  );
  process.exit(1);
}

// ── Extract max_retries from providers.json (live source of truth) ───────────
// Reads bin/providers.json → gemini-1.oauth_rotation.max_retries.
// Injected as -const max_retries=<N> unless the caller already supplies it.
let liveMaxRetries = null;
const providersPath = path.join(__dirname, 'providers.json');
if (fs.existsSync(providersPath)) {
  try {
    const parsed  = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
    // providers.json has shape { providers: [...] } with each entry having a `name` field
    const list    = Array.isArray(parsed) ? parsed : (parsed.providers || []);
    const gemini1 = list.find(function(p) { return p.name === 'gemini-1' || p.id === 'gemini-1'; }) || {};
    const rot     = gemini1.oauth_rotation || {};
    if (typeof rot.max_retries === 'number') {
      liveMaxRetries = rot.max_retries;
      process.stdout.write(
        '[run-oauth-rotation-prism] max_retries=' + liveMaxRetries +
        ' (from providers.json)\n'
      );
    }
  } catch (_) { /* malformed providers.json — fall through to spec default */ }
}

// ── Build argument list ──────────────────────────────────────────────────────
// Extra args passed to this script are forwarded to PRISM after the model path.
// If formal/prism/oauth-rotation.props exists, pass it as the properties file.
// Otherwise fall back to a single inline property.
const extraArgs  = process.argv.slice(2);
const hasPf      = extraArgs.some(a => a === '-pf' || a === '-prop');
const propsFile  = path.join(__dirname, '..', 'formal', 'prism', 'oauth-rotation.props');
const hasProps   = !hasPf && fs.existsSync(propsFile);
// Inject live max_retries unless the caller already overrides it
const callerOverridesRetries = extraArgs.some(
  (a, i) => a === '-const' && (extraArgs[i + 1] || '').startsWith('max_retries=')
);

const prismArgs = [modelPath];
if (hasProps) {
  prismArgs.push(propsFile);
} else if (!hasPf) {
  prismArgs.push('-pf', 'P=? [ F s=1 ]');
}
if (liveMaxRetries !== null && !callerOverridesRetries) {
  prismArgs.push('-const', 'max_retries=' + liveMaxRetries);
}
prismArgs.push(...extraArgs);

process.stdout.write('[run-oauth-rotation-prism] Binary: ' + prismBin + '\n');
process.stdout.write('[run-oauth-rotation-prism] Model:  ' + modelPath + '\n');
process.stdout.write('[run-oauth-rotation-prism] Args:   ' + prismArgs.slice(1).join(' ') + '\n');

// ── Invoke PRISM ─────────────────────────────────────────────────────────────
const result = spawnSync(prismBin, prismArgs, {
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write('[run-oauth-rotation-prism] Failed to launch PRISM: ' + result.error.message + '\n');
  process.exit(1);
}

process.exit(result.status || 0);
