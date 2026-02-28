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
    label: 'Generate TLA+ spec (QGSDQuorum_xstate.tla) + TLC model config from XState machine (xstate-to-tla)',
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
  {
    tool: 'tla', id: 'tla:mcp-environment',
    label: 'TLA+ QGSDMCPEnv — MCMCPEnv (MCPENV-02)',
    type: 'node', script: 'run-tlc.cjs', args: ['MCMCPEnv'],
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

// ── Group runner — executes steps sequentially within a group ─────────────────
async function runGroup(groupSteps) {
  for (const step of groupSteps) {
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
}

// ── runOnce() — executes the full pipeline once ───────────────────────────────
// Returns the count of failed steps (0 = all passed).
// Does NOT call process.exit() — the caller decides (non-watch exits, watch loops).
async function runOnce() {
  // Reset results array so watch-mode re-runs start clean
  results.length = 0;
  // Truncate NDJSON file — fresh run (UNIF-02)
  const ndjsonPath = path.join(__dirname, '..', 'formal', 'check-results.ndjson');
  fs.writeFileSync(ndjsonPath, '', 'utf8');

  process.stdout.write(TAG + ' ' + HR + '\n');
  process.stdout.write(TAG + ' QGSD Formal Verification Suite\n');
  if (only) {
    process.stdout.write(TAG + ' Filter: --only=' + only + '\n');
  }
  process.stdout.write(TAG + ' Steps: ' + steps.length + '\n');
  process.stdout.write(TAG + ' ' + HR + '\n\n');

  const startMs = Date.now();

  // ── Phase 1: Generate (sequential prerequisite) ────────────────────────────
  const generateSteps = steps.filter(s => s.tool === 'generate');
  const toolSteps     = steps.filter(s => s.tool !== 'generate');

  if (generateSteps.length > 0) {
    process.stdout.write(TAG + ' Phase 1: Running generate steps sequentially...\n\n');
    await runGroup(generateSteps);
  }

  // ── Phase 2: Tool groups (concurrent) ─────────────────────────────────────
  if (toolSteps.length > 0) {
    const toolGroupNames = [...new Set(toolSteps.map(s => s.tool))];
    process.stdout.write(TAG + ' Phase 2: Running tool groups concurrently: ' + toolGroupNames.join(', ') + '\n\n');

    await Promise.all(
      toolGroupNames.map(tool => runGroup(toolSteps.filter(s => s.tool === tool)))
    );
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

  const elapsedMs  = Date.now() - startMs;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);
  process.stdout.write(TAG + ' Wall-clock: ' + elapsedSec + 's (' + elapsedMs + 'ms)\n');
  process.stdout.write(TAG + ' ' + HR + '\n');

  // NDJSON-based summary (UNIF-03)
  try {
    const ndjsonLines = fs.readFileSync(ndjsonPath, 'utf8')
      .split('\n').filter(l => l.trim().length > 0);
    const checkResults = ndjsonLines.map(l => JSON.parse(l));
    const ndjsonFailed = checkResults.filter(r => r.result === 'fail').length;
    const ndjsonPassed = checkResults.filter(r => r.result === 'pass').length;
    const ndjsonOther  = checkResults.length - ndjsonFailed - ndjsonPassed;
    process.stdout.write(
      TAG + ' check-results.ndjson: ' + ndjsonPassed + ' pass, ' +
      ndjsonFailed + ' fail' +
      (ndjsonOther > 0 ? ', ' + ndjsonOther + ' warn/inconclusive' : '') + '\n'
    );
  } catch (err) {
    process.stderr.write(TAG + ' Warning: could not read check-results.ndjson: ' + err.message + '\n');
  }

  return failed;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const watchArg = argv.includes('--watch');

if (watchArg) {
  // ── Watch mode ─────────────────────────────────────────────────────────────
  // machineDir uses process.cwd() so tests can point the watcher at a tmpDir
  // by spawning with a custom cwd. __dirname-relative paths would always point
  // to the real repo's src/machines/ regardless of spawn cwd, breaking isolation.
  const machineDir  = path.join(process.cwd(), 'src', 'machines');
  const machineName = 'qgsd-workflow.machine.ts';
  let debounceTimer = null;
  let running       = false;  // concurrent-run guard
  let watcher       = null;

  process.stdout.write(TAG + ' ' + HR + '\n');
  process.stdout.write(TAG + ' Watch mode enabled\n');
  process.stdout.write(TAG + ' Watching: ' + path.join(machineDir, machineName) + '\n');
  process.stdout.write(TAG + ' Press Ctrl+C to stop.\n');
  process.stdout.write(TAG + ' Tip: use --only=generate for faster feedback.\n');
  process.stdout.write(TAG + ' ' + HR + '\n\n');

  // Existence check — fail fast if invoked from wrong directory
  if (!fs.existsSync(machineDir)) {
    process.stderr.write(TAG + ' Error: machine directory not found: ' + machineDir + '\n');
    process.stderr.write(TAG + ' Run --watch from the project root (where src/machines/ exists).\n');
    process.exit(1);
  }

  // Initial run
  runOnce().catch(err => process.stderr.write(TAG + ' Error: ' + err.message + '\n'));

  // Watch parent directory — NOT the file directly.
  // On macOS, watching a file dies after first rename (editor atomic-write pattern).
  watcher = fs.watch(machineDir, (eventType, filename) => {
    if (filename === machineName) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (running) return;
        running = true;
        process.stdout.write('\n' + TAG + ' ' + HR + '\n');
        process.stdout.write(TAG + ' Change detected — re-running verification\n');
        process.stdout.write(TAG + ' ' + new Date().toISOString() + '\n');
        process.stdout.write(TAG + ' ' + HR + '\n\n');
        runOnce()
          .catch(err => process.stderr.write(TAG + ' Error: ' + err.message + '\n'))
          .finally(() => { running = false; });
      }, 300);
    }
  });

  process.on('SIGINT', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (watcher) watcher.close();
    process.stdout.write('\n' + TAG + ' Exiting watch mode.\n');
    process.exit(0);
  });

} else {
  // ── Non-watch mode: original behavior ──────────────────────────────────────
  runOnce().then(failed => {
    if (failed > 0) {
      process.stderr.write(TAG + ' ' + failed + ' step(s) failed.\n');
      process.exit(1);
    }
    process.exit(0);
  });
}
