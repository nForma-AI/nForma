#!/usr/bin/env node
'use strict';
// bin/run-formal-verify.cjs
// Master runner: executes ALL formal verification tools and generates ALL formal artifacts.
//
// Coverage:
//   Generate   (2)  — xstate-to-tla.cjs (XState → TLA+, cfg)
//                     generate-formal-specs.cjs (XState → Alloy, PRISM)
//   Petri net  (2)  — generate-petri-net.cjs  + render account-manager DOT → SVG
//   TLA+       (8)  — MCsafety, MCliveness, MCoscillation, MCconvergence,
//                     MCbreaker, MCdeliberation, MCprefilter, MCaccount-manager
//   Alloy      (7)  — quorum-votes, scoreboard-recompute, availability-parsing,
//                     transcript-scan, install-scope, taxonomy-safety, account-pool-structure
//   PRISM      (2)  — quorum, oauth-rotation
//   ─────────────────────────────────────────────────────────────
//   Total:    21 steps
//
// Usage:
//   node bin/run-formal-verify.cjs                    # all 21 steps
//   node bin/run-formal-verify.cjs --only=generate    # source extraction only (2 steps)
//   node bin/run-formal-verify.cjs --only=tla         # TLA+ only  (8 steps)
//   node bin/run-formal-verify.cjs --only=alloy       # Alloy only (7 steps)
//   node bin/run-formal-verify.cjs --only=prism       # PRISM only (2 steps)
//   node bin/run-formal-verify.cjs --only=petri       # Petri only (2 steps)
//
// Behaviour:
//   - Runs steps sequentially; streams child output to stdout/stderr.
//   - Continues on failure; collects pass/fail for every step.
//   - Prints a summary table at the end.
//   - Exits 0 only when every step passes.
//
// Prerequisites: see individual runner scripts in bin/.

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const TAG = '[run-formal-verify]';
const HR  = '═'.repeat(64);
const SEP = '─'.repeat(64);

// ── Step registry ─────────────────────────────────────────────────────────────
//
// type: 'node'     — run  node bin/<script> <args...>
// type: 'wasm-dot' — render formal/petri/<dot> → formal/petri/<svg>
//                    via @hpcc-js/wasm-graphviz (async)
//
const STEPS = [
  // ─ Source extraction — must run first so generated specs are fresh ──────────
  {
    tool: 'generate', id: 'generate:tla-from-xstate',
    label: 'Generate TLA+ spec + TLC model config from XState machine (xstate-to-tla)',
    type: 'node', script: 'xstate-to-tla.cjs',
    args: ['src/machines/qgsd-workflow.machine.ts', '--module=QGSDQuorum', '--config=formal/tla/guards/qgsd-workflow.json'],
  },
  {
    tool: 'generate', id: 'generate:alloy-prism-specs',
    label: 'Generate Alloy + PRISM models from XState machine (generate-formal-specs)',
    type: 'node', script: 'generate-formal-specs.cjs', args: [],
  },

  // ─ Petri net ───────────────────────────────────────────────────────────────
  {
    tool: 'petri', id: 'petri:quorum',
    label: 'Petri quorum — generate DOT + render SVG',
    type: 'node', script: 'generate-petri-net.cjs', args: [],
  },
  {
    tool: 'petri', id: 'petri:account-manager',
    label: 'Petri account-manager — render DOT → SVG',
    type: 'wasm-dot',
    dot: 'account-manager-petri-net.dot',
    svg: 'account-manager-petri-net.svg',
  },

  // ─ TLA+ model checking ─────────────────────────────────────────────────────
  {
    tool: 'tla', id: 'tla:quorum-safety',
    label: 'TLA+ QGSDQuorum — MCsafety',
    type: 'node', script: 'run-tlc.cjs', args: ['MCsafety'],
  },
  {
    tool: 'tla', id: 'tla:quorum-liveness',
    label: 'TLA+ QGSDQuorum — MCliveness',
    type: 'node', script: 'run-tlc.cjs', args: ['MCliveness'],
  },
  {
    tool: 'tla', id: 'tla:oscillation',
    label: 'TLA+ QGSDOscillation — MCoscillation',
    type: 'node', script: 'run-oscillation-tlc.cjs', args: ['MCoscillation'],
  },
  {
    tool: 'tla', id: 'tla:convergence',
    label: 'TLA+ QGSDConvergence — MCconvergence',
    type: 'node', script: 'run-oscillation-tlc.cjs', args: ['MCconvergence'],
  },
  {
    tool: 'tla', id: 'tla:breaker',
    label: 'TLA+ QGSDCircuitBreaker — MCbreaker',
    type: 'node', script: 'run-breaker-tlc.cjs', args: ['MCbreaker'],
  },
  {
    tool: 'tla', id: 'tla:deliberation',
    label: 'TLA+ QGSDDeliberation — MCdeliberation',
    type: 'node', script: 'run-protocol-tlc.cjs', args: ['MCdeliberation'],
  },
  {
    tool: 'tla', id: 'tla:prefilter',
    label: 'TLA+ QGSDPreFilter — MCprefilter',
    type: 'node', script: 'run-protocol-tlc.cjs', args: ['MCprefilter'],
  },
  {
    tool: 'tla', id: 'tla:account-manager',
    label: 'TLA+ QGSDAccountManager — MCaccount-manager',
    type: 'node', script: 'run-account-manager-tlc.cjs', args: [],
  },

  // ─ Alloy structural verification ───────────────────────────────────────────
  {
    tool: 'alloy', id: 'alloy:quorum-votes',
    label: 'Alloy quorum-votes',
    type: 'node', script: 'run-alloy.cjs', args: [],
  },
  {
    tool: 'alloy', id: 'alloy:scoreboard',
    label: 'Alloy scoreboard-recompute',
    type: 'node', script: 'run-audit-alloy.cjs', args: ['--spec=scoreboard-recompute'],
  },
  {
    tool: 'alloy', id: 'alloy:availability',
    label: 'Alloy availability-parsing',
    type: 'node', script: 'run-audit-alloy.cjs', args: ['--spec=availability-parsing'],
  },
  {
    tool: 'alloy', id: 'alloy:transcript',
    label: 'Alloy transcript-scan',
    type: 'node', script: 'run-transcript-alloy.cjs', args: ['--spec=transcript-scan'],
  },
  {
    tool: 'alloy', id: 'alloy:install-scope',
    label: 'Alloy install-scope',
    type: 'node', script: 'run-installer-alloy.cjs', args: ['--spec=install-scope'],
  },
  {
    tool: 'alloy', id: 'alloy:taxonomy-safety',
    label: 'Alloy taxonomy-safety',
    type: 'node', script: 'run-installer-alloy.cjs', args: ['--spec=taxonomy-safety'],
  },
  {
    tool: 'alloy', id: 'alloy:account-pool',
    label: 'Alloy account-pool-structure',
    type: 'node', script: 'run-account-pool-alloy.cjs', args: [],
  },

  // ─ PRISM probabilistic verification ────────────────────────────────────────
  {
    tool: 'prism', id: 'prism:quorum',
    label: 'PRISM quorum rotation probability',
    type: 'node', script: 'run-prism.cjs', args: [],
  },
  {
    tool: 'prism', id: 'prism:oauth-rotation',
    label: 'PRISM oauth-rotation probability',
    type: 'node', script: 'run-oauth-rotation-prism.cjs', args: [],
  },
];

// ── CLI filter ────────────────────────────────────────────────────────────────
const argv    = process.argv.slice(2);
const onlyArg = argv.find(a => a.startsWith('--only='));
const only    = onlyArg ? onlyArg.split('=')[1] : null;

const steps = only
  ? STEPS.filter(s => s.tool === only || s.id === only)
  : STEPS;

if (only && steps.length === 0) {
  process.stderr.write(
    TAG + ' Unknown --only value: ' + only + '\n' +
    TAG + ' Valid values: tla, alloy, prism, petri, or a step id\n'
  );
  process.exit(1);
}

// ── Result tracker ────────────────────────────────────────────────────────────
const results = [];  // { id, label, passed, note }

function record(id, label, passed, note) {
  results.push({ id, label, passed, note: note || '' });
}

// ── Step execution ────────────────────────────────────────────────────────────
function runNodeStep(step) {
  const scriptPath = path.join(__dirname, step.script);
  if (!fs.existsSync(scriptPath)) {
    process.stderr.write(TAG + ' Script not found: ' + scriptPath + '\n');
    return false;
  }
  const result = spawnSync(process.execPath, [scriptPath, ...step.args], {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.error) {
    process.stderr.write(TAG + ' Launch error: ' + result.error.message + '\n');
    return false;
  }
  return result.status === 0;
}

async function runWasmDotStep(step) {
  const petriDir = path.join(__dirname, '..', 'formal', 'petri');
  const dotPath  = path.join(petriDir, step.dot);
  const svgPath  = path.join(petriDir, step.svg);

  if (!fs.existsSync(dotPath)) {
    process.stderr.write(TAG + ' DOT source not found: ' + dotPath + '\n');
    return false;
  }

  const dotContent = fs.readFileSync(dotPath, 'utf8');

  let Graphviz;
  try {
    ({ Graphviz } = await import('@hpcc-js/wasm-graphviz'));
  } catch (_) {
    process.stderr.write(
      TAG + ' @hpcc-js/wasm-graphviz not installed.\n' +
      TAG + ' Run: npm install --save-dev @hpcc-js/wasm-graphviz\n'
    );
    return false;
  }

  try {
    const graphviz = await Graphviz.load();
    const svg      = graphviz.dot(dotContent);
    fs.writeFileSync(svgPath, svg);
    process.stdout.write(TAG + ' SVG written: ' + svgPath + '\n');
    return true;
  } catch (err) {
    process.stderr.write(TAG + ' SVG render failed: ' + err.message + '\n');
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  process.stdout.write(TAG + ' ' + HR + '\n');
  process.stdout.write(TAG + ' QGSD Formal Verification Suite\n');
  if (only) {
    process.stdout.write(TAG + ' Filter: --only=' + only + '\n');
  }
  process.stdout.write(TAG + ' Steps: ' + steps.length + '\n');
  process.stdout.write(TAG + ' ' + HR + '\n\n');

  for (const step of steps) {
    process.stdout.write(TAG + ' ' + SEP + '\n');
    process.stdout.write(TAG + ' [' + step.id + '] ' + step.label + '\n');
    process.stdout.write(TAG + ' ' + SEP + '\n');

    let passed = false;
    if (step.type === 'node') {
      passed = runNodeStep(step);
    } else if (step.type === 'wasm-dot') {
      passed = await runWasmDotStep(step);
    }

    const mark = passed ? '✓' : '✗';
    process.stdout.write('\n' + TAG + ' ' + mark + ' ' + step.id + '\n\n');
    record(step.id, step.label, passed);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  process.stdout.write(TAG + ' ' + HR + '\n');
  process.stdout.write(TAG + ' SUMMARY — ' + passed + '/' + results.length + ' passed\n');
  process.stdout.write(TAG + ' ' + HR + '\n');

  for (const r of results) {
    const mark  = r.passed ? '✓' : '✗';
    const extra = r.note ? '  (' + r.note + ')' : '';
    process.stdout.write(TAG + '  ' + mark + '  ' + r.id.padEnd(30) + r.label + extra + '\n');
  }

  process.stdout.write(TAG + ' ' + HR + '\n');

  if (failed > 0) {
    process.stderr.write(TAG + ' ' + failed + ' step(s) failed.\n');
    process.exit(1);
  }

  process.exit(0);
})();
