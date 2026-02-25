#!/usr/bin/env node
'use strict';
// bin/xstate-to-tla.cjs
// Transpiles an XState v5 machine definition (.ts) to TLA+ spec + TLC model config.
//
// Strategy:
//   1. Compile the TypeScript machine file to a temp CJS bundle via esbuild.
//   2. require() the bundle and find the exported XState machine object.
//   3. Walk machine.config to extract states, transitions, guard names, and
//      which context variables each transition assigns.
//   4. Emit formal/tla/<ModuleName>.tla and formal/tla/MC<modulename>.cfg.
//
// Usage:
//   node bin/xstate-to-tla.cjs <machine-file.ts>
//   node bin/xstate-to-tla.cjs src/machines/qgsd-workflow.machine.ts \
//       --module=QGSDQuorum \
//       --config=formal/tla/guards/qgsd-workflow.json
//   node bin/xstate-to-tla.cjs src/machines/account-manager.machine.ts \
//       --module=QGSDAccountManager \
//       --config=formal/tla/guards/account-manager.json \
//       --dry
//
// Config file format (JSON):
//   {
//     "guards": {
//       "minQuorumMet":           "successCount * 2 >= N",
//       "noInfiniteDeliberation": "deliberationRounds < MaxDeliberation"
//     },
//     "vars": {
//       "currentPhase":  "skip",          // omit — redundant with 'state'
//       "maxDeliberation": "const",        // never changes, always UNCHANGED
//       "successCount":  "event",          // value comes from event — add as action param
//       "slotsAvailable": "event",
//       "deliberationRounds": "deliberationRounds + 1"  // literal TLA+ expression
//     }
//   }
//
// Var annotation meanings:
//   "skip"    — omit from VARIABLES, UNCHANGED, and assignments
//   "const"   — never changes in any transition; put in UNCHANGED
//   "event"   — value provided by the triggering event; becomes an action parameter
//   <tla-expr> — literal TLA+ expression to use on the RHS of var' = <expr>
//   (absent)  — generate: var' = var  \* FIXME: provide TLA+ expression
//
// Prerequisites: esbuild (devDependency)

const { buildSync } = require('esbuild');
const fs            = require('fs');
const os            = require('os');
const path          = require('path');

const TAG = '[xstate-to-tla]';

// ── CLI ───────────────────────────────────────────────────────────────────────
const argv      = process.argv.slice(2);
const inputFile = argv.find(a => !a.startsWith('-'));
const moduleArg = (argv.find(a => a.startsWith('--module=')) || '').slice('--module='.length);
const configArg = (argv.find(a => a.startsWith('--config=')) || '').slice('--config='.length);
const outDirArg = (argv.find(a => a.startsWith('--out-dir=')) || '').slice('--out-dir='.length);
const dry       = argv.includes('--dry');

if (!inputFile) {
  process.stderr.write(
    'Usage: node bin/xstate-to-tla.cjs <machine-file.ts>\n' +
    '         [--module=ModuleName]\n' +
    '         [--config=guards-and-vars.json]\n' +
    '         [--out-dir=formal/tla]\n' +
    '         [--dry]\n'
  );
  process.exit(1);
}

const absInput = path.resolve(inputFile);
if (!fs.existsSync(absInput)) {
  process.stderr.write(TAG + ' File not found: ' + absInput + '\n');
  process.exit(1);
}

// ── Load user config ──────────────────────────────────────────────────────────
let userGuards = {};  // guardName → TLA+ expression
let userVars   = {};  // varName   → 'skip' | 'const' | 'event' | tla-expr

if (configArg) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve(configArg), 'utf8'));
    userGuards = raw.guards || {};
    userVars   = raw.vars   || {};
    process.stdout.write(TAG + ' Config: ' + configArg + '\n');
    process.stdout.write(TAG + '   guards: ' + Object.keys(userGuards).join(', ') + '\n');
    process.stdout.write(TAG + '   vars:   ' + Object.keys(userVars).join(', ') + '\n');
  } catch (e) {
    process.stderr.write(TAG + ' Failed to load config: ' + e.message + '\n');
    process.exit(1);
  }
}

// ── Compile TypeScript → temp CJS ────────────────────────────────────────────
const tmpBundle = path.join(os.tmpdir(), 'xstate-to-tla-' + Date.now() + '.cjs');
try {
  buildSync({
    entryPoints: [absInput],
    bundle:      true,
    format:      'cjs',
    outfile:     tmpBundle,
    platform:    'node',
    logLevel:    'silent',
  });
} catch (e) {
  process.stderr.write(TAG + ' esbuild compilation failed: ' + e.message + '\n');
  process.exit(1);
}

// ── Load compiled module ──────────────────────────────────────────────────────
let mod;
try {
  mod = require(tmpBundle);
} catch (e) {
  process.stderr.write(TAG + ' Failed to load compiled module: ' + e.message + '\n');
  fs.unlinkSync(tmpBundle);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpBundle); } catch (_) {}
}

// Find the XState machine export: an object with .config.states
const machine = Object.values(mod).find(v =>
  v && typeof v === 'object' && v.config && v.config.states
);
if (!machine) {
  process.stderr.write(TAG + ' No XState machine export found in: ' + inputFile + '\n');
  process.stderr.write(TAG + ' Exports: ' + Object.keys(mod).join(', ') + '\n');
  process.exit(1);
}

const cfg = machine.config;

// ── Extract machine structure ─────────────────────────────────────────────────
const machineId   = cfg.id || path.basename(inputFile, '.ts').replace('.machine', '');
const initial     = String(cfg.initial);
const ctxDefaults = cfg.context || {};

// Derive module name
const moduleName = moduleArg || machineId
  .split(/[-_\s]+/)
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join('');

// Context variables (excluding 'skip' ones)
const allCtxKeys = Object.keys(ctxDefaults);
const ctxVars    = allCtxKeys.filter(k => userVars[k] !== 'skip');

// State list
const stateNames = Object.keys(cfg.states);
const finalStates = stateNames.filter(s => cfg.states[s].type === 'final');

// ── Parse transitions ─────────────────────────────────────────────────────────
// Returns array of { fromState, event, guard, target, assignedKeys }
function parseTransitions() {
  const result = [];
  for (const stateName of stateNames) {
    const stateDef = cfg.states[stateName];
    if (!stateDef.on) continue;

    for (const [eventName, transVal] of Object.entries(stateDef.on)) {
      const branches = Array.isArray(transVal) ? transVal : [transVal];

      for (const branch of branches) {
        if (!branch) continue;
        const guard  = typeof branch.guard === 'string' ? branch.guard : null;
        const target = branch.target ? String(branch.target) : null;

        // Collect assign keys from actions
        const assignedKeys = [];
        const actions = branch.actions
          ? (Array.isArray(branch.actions) ? branch.actions : [branch.actions])
          : [];
        for (const act of actions) {
          if (act && act.type === 'xstate.assign' && act.assignment) {
            for (const k of Object.keys(act.assignment)) {
              if (!assignedKeys.includes(k)) assignedKeys.push(k);
            }
          }
        }

        result.push({ fromState: stateName, event: eventName, guard, target, assignedKeys });
      }
    }
  }
  return result;
}

const allTransitions = parseTransitions();

// ── Action name derivation ────────────────────────────────────────────────────
function toCamel(s) {
  return s.toLowerCase()
    .split(/[_\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

// Count branches per (fromState, event) pair — for multi-branch disambiguation
const branchCount = {};
for (const t of allTransitions) {
  const k = t.fromState + '::' + t.event;
  branchCount[k] = (branchCount[k] || 0) + 1;
}

// Which events appear in more than one state? → need state prefix to stay unique
const eventStateSet = {};
for (const t of allTransitions) {
  if (!eventStateSet[t.event]) eventStateSet[t.event] = new Set();
  eventStateSet[t.event].add(t.fromState);
}

for (const t of allTransitions) {
  const cc          = toCamel(t.event);
  const multiState  = eventStateSet[t.event].size > 1;
  const statePrefix = multiState ? toCamel(t.fromState) : '';
  const k           = t.fromState + '::' + t.event;
  const multiBranch = branchCount[k] > 1;

  if (multiBranch) {
    t.actionName = statePrefix + cc + 'To' + (t.target || 'Unknown');
  } else {
    t.actionName = statePrefix + cc;
  }
}

// ── TLA+ generation helpers ───────────────────────────────────────────────────
const ts_date = new Date().toISOString().split('T')[0];
const outDir  = outDirArg
  ? path.resolve(outDirArg)
  : path.join(__dirname, '..', 'formal', 'tla');

// Variables that appear in UNCHANGED (excludes state, skip-vars, and vars whose annotation is const/event/expr)
// We need UNCHANGED for: ctxVars that are NOT in assignedKeys for this transition
function genUnchanged(assignedInThisTrans) {
  // 'const' vars + ctxVars not assigned (and not 'event' either — event vars that aren't assigned stay unchanged)
  const unchanged = ctxVars.filter(v => !assignedInThisTrans.includes(v));
  if (unchanged.length === 0) return null;
  if (unchanged.length === 1) return unchanged[0];
  return '<<' + unchanged.join(', ') + '>>';
}

// Generate the TLA+ assignment line for one variable in a transition
function genAssignLine(varName, isParam) {
  if (isParam) return "    /\\ " + varName + "' = " + varName + '  \\* param from event';
  const ann = userVars[varName];
  if (ann && ann !== 'const' && ann !== 'event' && ann !== 'skip') {
    return "    /\\ " + varName + "' = " + ann;
  }
  return "    /\\ " + varName + "' = " + varName + '  \\* FIXME: XState assign for ' + varName;
}

// Generate one TLA+ action block
function genAction(t) {
  const lines = [];
  const cc    = t.actionName;

  // Which assigned vars are "event" type → become parameters
  const params = t.assignedKeys.filter(k => userVars[k] === 'event');
  const nonParamAssigned = t.assignedKeys.filter(k => userVars[k] !== 'event' && userVars[k] !== 'skip');

  const paramStr = params.length > 0 ? '(' + params.join(', ') + ')' : '';

  lines.push('\\* ' + t.fromState + ' -[' + t.event + (t.guard ? ' / ' + t.guard : '') + ']-> ' + (t.target || '?'));
  lines.push(cc + paramStr + ' ==');
  lines.push('    /\\ state = "' + t.fromState + '"');

  // Guard
  if (t.guard) {
    const tlaGuard = userGuards[t.guard];
    if (tlaGuard) {
      lines.push('    /\\ ' + tlaGuard);
    } else {
      lines.push('    /\\ TRUE  \\* FIXME: guard ' + t.guard + ' — add to config guards');
    }
  }

  // State transition
  if (t.target) {
    lines.push("    /\\ state' = \"" + t.target + '"');
  } else {
    lines.push("    /\\ state' = state  \\* FIXME: unknown target");
  }

  // Variable assignments
  for (const v of params) {
    lines.push(genAssignLine(v, true));
  }
  for (const v of nonParamAssigned) {
    lines.push(genAssignLine(v, false));
  }

  // UNCHANGED
  const unch = genUnchanged(t.assignedKeys);
  if (unch) lines.push('    /\\ UNCHANGED ' + unch);

  return lines.join('\n');
}

// Self-loop for final (absorbing) states
function genFinalSelfLoop(stateName) {
  const lines = [
    '\\* ' + stateName + ' is a final (absorbing) state',
    'Stay' + stateName + ' ==',
    '    /\\ state = "' + stateName + '"',
    "    /\\ state' = \"" + stateName + '"',
  ];
  if (ctxVars.length > 0) {
    lines.push('    /\\ UNCHANGED <<' + ctxVars.join(', ') + '>>');
  }
  return lines.join('\n');
}

// All unique action names (for Next and WF)
const actionNames = [];
for (const t of allTransitions) {
  if (!actionNames.includes(t.actionName)) actionNames.push(t.actionName);
}
for (const s of finalStates) {
  const aName = 'Stay' + s;
  if (!actionNames.includes(aName)) actionNames.push(aName);
}

// ── Assemble TLA+ file ────────────────────────────────────────────────────────
const varsTuple = ['state', ...ctxVars].length === 1
  ? 'state'
  : '<<state, ' + ctxVars.join(', ') + '>>';

const lines = [
  '---- MODULE ' + moduleName + ' ----',
  '(*',
  ' * formal/tla/' + moduleName + '.tla',
  ' * GENERATED by bin/xstate-to-tla.cjs',
  ' * Source: ' + path.relative(path.join(__dirname, '..'), absInput),
  ' * Regenerate: node bin/xstate-to-tla.cjs ' + path.relative(path.join(__dirname, '..'), absInput) +
      (configArg ? ' --config=' + configArg : '') +
      ' --module=' + moduleName,
  ' * Generated: ' + ts_date,
  ' *',
  ' * XState machine id: ' + machineId,
  ' * Initial state:     ' + initial,
  ' * States (' + stateNames.length + '):          ' + stateNames.join(', '),
  ' * Final states:      ' + (finalStates.length ? finalStates.join(', ') : '(none)'),
  '*)',
  'EXTENDS Naturals, FiniteSets, TLC',
  '',
  '\\* ── Variables ────────────────────────────────────────────────────────────────',
  'VARIABLES',
  '    state' + (ctxVars.length > 0 ? ',' : '') + '  \\* FSM state',
  ...ctxVars.map((v, i) => {
    const ann  = userVars[v] || '(no annotation)';
    const dflt = ctxDefaults[v];
    return '    ' + v + (i < ctxVars.length - 1 ? ',' : '') +
      '  \\* default: ' + JSON.stringify(dflt) + '  annotation: ' + ann;
  }),
  '',
  'vars == ' + varsTuple,
  '',
  '\\* ── Type invariant ────────────────────────────────────────────────────────────',
  'TypeOK ==',
  '    /\\ state \\in {' + stateNames.map(s => '"' + s + '"').join(', ') + '}',
  ...ctxVars.map(v => {
    const dflt = ctxDefaults[v];
    if (typeof dflt === 'number')  return '    /\\ ' + v + ' \\in Nat  \\* FIXME: tighten bound if needed';
    if (typeof dflt === 'string')  return '    /\\ ' + v + ' \\in STRING';
    if (typeof dflt === 'boolean') return '    /\\ ' + v + ' \\in BOOLEAN';
    return '    /\\ TRUE  \\* FIXME: type for ' + v;
  }),
  '',
  '\\* ── Initial state ─────────────────────────────────────────────────────────────',
  'Init ==',
  '    /\\ state = "' + initial + '"',
  ...ctxVars.map(v => {
    const dflt = ctxDefaults[v];
    if (typeof dflt === 'string')  return '    /\\ ' + v + " = \"" + dflt + '"';
    if (typeof dflt === 'number')  return '    /\\ ' + v + ' = ' + dflt;
    if (typeof dflt === 'boolean') return '    /\\ ' + v + ' = ' + (dflt ? 'TRUE' : 'FALSE');
    return '    /\\ ' + v + ' = 0  \\* FIXME: initial value';
  }),
  '',
  '\\* ── Actions ────────────────────────────────────────────────────────────────────',
];

// Non-final state transitions
for (const stateName of stateNames) {
  if (!finalStates.includes(stateName)) {
    const stateTrans = allTransitions.filter(t => t.fromState === stateName);
    for (const t of stateTrans) {
      lines.push('');
      lines.push(genAction(t));
    }
  }
}

// Final state self-loops
for (const stateName of finalStates) {
  lines.push('');
  lines.push(genFinalSelfLoop(stateName));
}

// Next
lines.push('');
lines.push('\\* ── Next ──────────────────────────────────────────────────────────────────────');
lines.push('Next ==');
for (const t of allTransitions) {
  const params = t.assignedKeys.filter(k => userVars[k] === 'event');
  const paramStr = params.length > 0 ? '(\\E ' + params.map(p => p + ' \\in Nat').join(', ') + ' : ' : '';
  const closeParen = params.length > 0 ? ')' : '';
  if (params.length > 0) {
    lines.push('    \\/ \\E ' + params.map(p => p + ' \\in Nat').join(', ') + ' : ' + t.actionName + '(' + params.join(', ') + ')');
  } else {
    lines.push('    \\/ ' + t.actionName);
  }
}
for (const s of finalStates) {
  lines.push('    \\/ Stay' + s);
}

// Spec
lines.push('');
lines.push('\\* ── Specification ─────────────────────────────────────────────────────────────');
lines.push('Spec == Init /\\ [][Next]_vars');
for (const a of actionNames) {
  lines.push('        /\\ WF_vars(' + a + ')');
}

// Invariant/liveness placeholders
lines.push('');
lines.push('\\* ── Invariants (add domain-specific properties here) ──────────────────────────');
lines.push('\\* TypeOK is the structural baseline. Add semantic invariants below.');
lines.push('');
lines.push('====');
lines.push('');

const tlaContent = lines.join('\n');

// ── Generate .cfg ─────────────────────────────────────────────────────────────
const cfgName = 'MC' + moduleName;
const cfgContent = [
  '\\* formal/tla/' + cfgName + '.cfg',
  '\\* GENERATED by bin/xstate-to-tla.cjs',
  '\\* Regenerate: node bin/xstate-to-tla.cjs ' + path.relative(path.join(__dirname, '..'), absInput) +
      (configArg ? ' --config=' + configArg : '') + ' --module=' + moduleName,
  '\\* Generated: ' + ts_date,
  '',
  'SPECIFICATION Spec',
  'INVARIANT TypeOK',
  'CHECK_DEADLOCK FALSE',
  '',
].join('\n');

// ── Write or dry-run ──────────────────────────────────────────────────────────
const tlaOutPath = path.join(outDir, moduleName + '.tla');
const cfgOutPath = path.join(outDir, cfgName + '.cfg');

if (dry) {
  process.stdout.write('\n--- ' + path.relative(process.cwd(), tlaOutPath) + ' ---\n');
  process.stdout.write(tlaContent);
  process.stdout.write('\n--- ' + path.relative(process.cwd(), cfgOutPath) + ' ---\n');
  process.stdout.write(cfgContent + '\n');
} else {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(tlaOutPath, tlaContent, 'utf8');
  fs.writeFileSync(cfgOutPath, cfgContent, 'utf8');
  process.stdout.write(TAG + ' TLA+: ' + path.relative(process.cwd(), tlaOutPath) + '\n');
  process.stdout.write(TAG + ' CFG:  ' + path.relative(process.cwd(), cfgOutPath) + '\n');
  process.stdout.write(TAG + ' States:  ' + stateNames.join(', ') + '\n');
  process.stdout.write(TAG + ' Actions: ' + actionNames.join(', ') + '\n');

  // Report unresolved guards
  const allGuardNames = [...new Set(allTransitions.filter(t => t.guard).map(t => t.guard))];
  const unresolved = allGuardNames.filter(g => !userGuards[g]);
  if (unresolved.length > 0) {
    process.stdout.write(TAG + ' WARN: guards without TLA+ mapping — search for FIXME:\n');
    for (const g of unresolved) {
      process.stdout.write(TAG + '   ' + g + '\n');
    }
  }
}
