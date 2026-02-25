#!/usr/bin/env node
'use strict';
// bin/check-spec-sync.cjs
// Verifies that formal specs stay in sync with the XState machine.
//
// The XState machine (src/machines/qgsd-workflow.machine.ts) is the SOURCE OF TRUTH.
// Formal specs must mirror it — not the other way around.
//
// Checks:
//   1. State names in QGSDQuorum.tla TypeOK match the XState machine states
//   2. MaxDeliberation in MCsafety.cfg and MCliveness.cfg matches the XState context default
//   3. Initial state in QGSDQuorum.tla Init matches the XState initial state
//
// Exit 0 = in sync; Exit 1 = drift detected.
// Usage: node bin/check-spec-sync.cjs

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Load files ───────────────────────────────────────────────────────────────
function load(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    process.stderr.write('[check-spec-sync] File not found: ' + rel + '\n');
    process.exit(1);
  }
  return fs.readFileSync(abs, 'utf8');
}

const machineSrc  = load('src/machines/qgsd-workflow.machine.ts');
const tlaSrc      = load('formal/tla/QGSDQuorum.tla');
const safetyCfg   = load('formal/tla/MCsafety.cfg');
const livenessCfg = load('formal/tla/MCliveness.cfg');

// ── 1. Extract XState facts (source of truth) ─────────────────────────────────
// State names: lines matching `    UPPERCASE_NAME: {` (4-space indent, top-level states)
const xstateStateNames = (machineSrc.match(/^    ([A-Z_]+):\s*\{/gm) || [])
  .map(line => line.trim().split(':')[0]);

// maxDeliberation default value from context initializer
const maxDelibMatch = machineSrc.match(/maxDeliberation:\s*(\d+)/);
const xstateMaxDelib = maxDelibMatch ? parseInt(maxDelibMatch[1], 10) : null;

// Initial state name
const initialMatch = machineSrc.match(/initial:\s*'([A-Z_]+)'/);
const xstateInitial = initialMatch ? initialMatch[1] : null;

// ── 2. Extract TLA+ facts ────────────────────────────────────────────────────
// Phase values in TypeOK: phase \in {"IDLE", "COLLECTING_VOTES", ...}
const typeOkMatch = tlaSrc.match(/phase\s*\\in\s*\{([^}]+)\}/);
const tlaPhaseValues = typeOkMatch
  ? (typeOkMatch[1].match(/"([A-Z_]+)"/g) || []).map(s => s.replace(/"/g, ''))
  : [];

// Initial phase in Init block: find Init ==, then first phase = "..."
const initBlockMatch = tlaSrc.match(/Init\s*==[\s\S]*?phase\s*=\s*"([A-Z_]+)"/);
const tlaInitPhase = initBlockMatch ? initBlockMatch[1] : null;

// ── 3. Extract MaxDeliberation from cfg files ─────────────────────────────────
const safetyMaxDelibMatch   = safetyCfg.match(/MaxDeliberation\s*=\s*(\d+)/);
const livenessMaxDelibMatch  = livenessCfg.match(/MaxDeliberation\s*=\s*(\d+)/);
const safetyMaxDelib   = safetyMaxDelibMatch  ? parseInt(safetyMaxDelibMatch[1], 10)  : null;
const livenessMaxDelib = livenessMaxDelibMatch ? parseInt(livenessMaxDelibMatch[1], 10) : null;

// ── 4. Run checks ────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];

function fail(msg) { errors.push('  FAIL  ' + msg); }
function warn(msg) { warnings.push('  WARN  ' + msg); }
function ok(msg)   { process.stdout.write('  OK    ' + msg + '\n'); }

process.stdout.write('\n[check-spec-sync] Source of truth: src/machines/qgsd-workflow.machine.ts\n\n');

// Check 1: State names
if (xstateStateNames.length === 0) {
  fail('Could not extract state names from XState machine');
} else {
  ok('XState states: ' + xstateStateNames.join(', '));

  if (tlaPhaseValues.length === 0) {
    fail('Could not parse phase values from QGSDQuorum.tla TypeOK');
  } else {
    ok('TLA+ phases:  ' + tlaPhaseValues.join(', '));

    const missing = xstateStateNames.filter(s => !tlaPhaseValues.includes(s));
    const extra   = tlaPhaseValues.filter(s => !xstateStateNames.includes(s));

    if (missing.length > 0) {
      fail('XState states missing from TLA+ TypeOK: ' + missing.join(', '));
    }
    if (extra.length > 0) {
      warn('TLA+ TypeOK has extra phases not in XState (may be intentional): ' + extra.join(', '));
    }
    if (missing.length === 0 && extra.length === 0) {
      ok('State names match exactly');
    }
  }
}

// Check 2: MaxDeliberation
if (xstateMaxDelib === null) {
  fail('Could not extract maxDeliberation from XState context defaults');
} else {
  ok('XState maxDeliberation: ' + xstateMaxDelib);

  if (safetyMaxDelib === null) {
    fail('Could not parse MaxDeliberation from MCsafety.cfg');
  } else if (safetyMaxDelib !== xstateMaxDelib) {
    fail(
      'MCsafety.cfg MaxDeliberation=' + safetyMaxDelib +
      ' does not match XState maxDeliberation=' + xstateMaxDelib
    );
  } else {
    ok('MCsafety.cfg MaxDeliberation=' + safetyMaxDelib + ' matches');
  }

  if (livenessMaxDelib === null) {
    fail('Could not parse MaxDeliberation from MCliveness.cfg');
  } else if (livenessMaxDelib !== xstateMaxDelib) {
    fail(
      'MCliveness.cfg MaxDeliberation=' + livenessMaxDelib +
      ' does not match XState maxDeliberation=' + xstateMaxDelib
    );
  } else {
    ok('MCliveness.cfg MaxDeliberation=' + livenessMaxDelib + ' matches');
  }
}

// Check 3: Initial state
if (xstateInitial === null) {
  fail('Could not extract initial state from XState machine');
} else {
  ok('XState initial state: ' + xstateInitial);

  if (tlaInitPhase === null) {
    fail('Could not parse Init phase from QGSDQuorum.tla');
  } else if (tlaInitPhase !== xstateInitial) {
    fail(
      'TLA+ Init sets phase="' + tlaInitPhase +
      '" but XState initial is "' + xstateInitial + '"'
    );
  } else {
    ok('Initial state matches: "' + xstateInitial + '"');
  }
}

// ── 5. Report ────────────────────────────────────────────────────────────────
if (warnings.length > 0) {
  process.stdout.write('\nWarnings:\n');
  warnings.forEach(w => process.stdout.write(w + '\n'));
}

if (errors.length > 0) {
  process.stdout.write('\nSpec drift detected:\n');
  errors.forEach(e => process.stderr.write(e + '\n'));
  process.stdout.write(
    '\nThe XState machine is the source of truth.\n' +
    'Update the formal specs to match the code, then re-run this check.\n\n'
  );
  process.exit(1);
}

process.stdout.write('\nAll checks passed — formal specs are in sync with the XState machine.\n\n');
