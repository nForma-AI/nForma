#!/usr/bin/env node
'use strict';
// bin/run-formal-verify.test.cjs
// Error-path, integration smoke, and watch-mode tests for bin/run-formal-verify.cjs.
// Error-path and smoke tests: no Java/TLC/Alloy/PRISM invocation.
// Watch-mode tests: spawn + SIGINT, --only=generate only (no Java needed).
// Requirements: INTG-01, INTG-02, DX-01

const { test }      = require('node:test');
const assert        = require('node:assert');
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs   = require('node:fs');
const os   = require('os');

const RUN_FV = path.join(__dirname, 'run-formal-verify.cjs');

test('exits non-zero with descriptive error for unknown --only value', () => {
  const result = spawnSync(process.execPath, [RUN_FV, '--only=bogus-invalid'], { encoding: 'utf8' });
  assert.strictEqual(result.status, 1);
  assert.match(result.stderr || result.stdout, /unknown|invalid|bogus|--only/i);
});

test('syntax smoke: script loads without SyntaxError', () => {
  // Use node --check to parse the file for syntax errors without executing it.
  const result = spawnSync(process.execPath, ['--check', RUN_FV], {
    encoding: 'utf8',
    timeout: 5000,
  });
  // --check exits 0 on valid syntax; stderr contains "SyntaxError" on failure.
  assert.doesNotMatch(result.stderr || '', /SyntaxError/);
  assert.strictEqual(result.status, 0);
});

test('integration smoke: --only=generate filter resolves step list without Java', () => {
  // --only=generate with no Java still passes the argument-parsing stage
  // and enters the step-execution loop. Verify the filter is accepted
  // (it does NOT exit 1 for "Unknown --only value").
  // The step will fail (no generate-formal-specs.cjs execution succeeds without tooling),
  // but the important check is: the unknown-option guard does NOT fire.
  const result = spawnSync(process.execPath, [RUN_FV, '--only=generate'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  // Should NOT match the "Unknown --only value" error path
  assert.doesNotMatch(result.stderr || '', /Unknown --only value/i);
  // Full integration requires Java — note for CI documentation.
  // (exit code may be non-zero when child scripts fail; we only verify the pipeline is callable)
});

test('timing (PERF-02): output includes Wall-clock line and runner completes within 120s', () => {
  // Verify wall-clock timing instrumentation is present and runner does not hang.
  // Uses --only=generate so only the 2 generate steps run (no Java/TLC/Alloy needed).
  const startMs = Date.now();
  const result = spawnSync(process.execPath, [RUN_FV, '--only=generate'], {
    encoding: 'utf8',
    timeout: 120000,  // 120s hard cap — runner must not hang
  });
  const elapsedMs = Date.now() - startMs;

  // Must not be killed by timeout signal
  assert.strictEqual(result.signal, null, 'runner must not be killed by timeout');
  assert.ok(elapsedMs < 120000, 'runner completed in ' + elapsedMs + 'ms (limit: 120000ms)');

  // Output must include the Wall-clock timing line added for PERF-02
  const output = (result.stdout || '') + (result.stderr || '');
  assert.match(output, /Wall-clock/i, 'output must include Wall-clock timing line');
});

test('parallelization smoke (PERF-01): all 8 TLA+ step IDs appear in output with --only=tla', () => {
  // Verify that parallelization does not silently drop steps.
  // With --only=tla, the 8 TLA+ step IDs must all appear in stdout.
  // Steps will fail (no Java) but must be ATTEMPTED — step IDs are printed at header before execution.
  const TLA_STEP_IDS = [
    'tla:quorum-safety',
    'tla:quorum-liveness',
    'tla:oscillation',
    'tla:convergence',
    'tla:breaker',
    'tla:deliberation',
    'tla:prefilter',
    'tla:account-manager',
  ];

  const result = spawnSync(process.execPath, [RUN_FV, '--only=tla'], {
    encoding: 'utf8',
    timeout: 120000,
  });

  const output = (result.stdout || '') + (result.stderr || '');

  for (const stepId of TLA_STEP_IDS) {
    assert.ok(
      output.includes(stepId),
      'Expected step ID "' + stepId + '" to appear in output — step may have been silently dropped'
    );
  }
});

// ── Watch mode integration tests (DX-01) ─────────────────────────────────────
// Require --only=generate so no Java/TLC/Alloy/PRISM is needed.
// All tests spawn with cwd: tmpDir (machine file copied there) so the
// watcher uses tmpDir/src/machines/ and does not affect the real repo.

test('watch mode (DX-01): --watch flag starts process and does not exit immediately', { timeout: 30000 }, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfv-watch-start-'));
  try {
    const machinesDir = path.join(tmpDir, 'src', 'machines');
    fs.mkdirSync(machinesDir, { recursive: true });
    fs.copyFileSync(
      path.resolve(__dirname, '..', 'src', 'machines', 'qgsd-workflow.machine.ts'),
      path.join(machinesDir, 'qgsd-workflow.machine.ts')
    );

    const child = spawn(process.execPath, [RUN_FV, '--watch', '--only=generate'], {
      cwd:   tmpDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env:   { ...process.env },
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    // Wait for watch startup message AND first SUMMARY (initial run complete).
    // Sending SIGINT while spawnSync is blocking inside runOnce() can produce
    // signal-based termination instead of our process.exit(0) handler.
    // Waiting for SUMMARY ensures the initial run finished and we are back
    // in the fs.watch event loop before we send SIGINT.
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('timeout waiting for watch startup + initial run: ' + output)), 20000
      );
      const check = setInterval(() => {
        if (output.includes('Watch mode enabled') && output.includes('SUMMARY')) {
          clearInterval(check); clearTimeout(deadline); resolve();
        }
      }, 100);
    });

    child.kill('SIGINT');
    const exitCode = await new Promise(resolve => child.on('close', code => resolve(code)));

    assert.ok(
      output.includes('Watch mode enabled') || output.includes('Watching:'),
      'must print watch startup message — got: ' + output.slice(0, 200)
    );
    assert.strictEqual(exitCode, 0, 'must exit 0 on SIGINT');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('watch mode (DX-01): re-runs verification when machine file changes', { timeout: 30000 }, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfv-watch-change-'));
  try {
    const machinesDir = path.join(tmpDir, 'src', 'machines');
    fs.mkdirSync(machinesDir, { recursive: true });
    const machinePath = path.join(machinesDir, 'qgsd-workflow.machine.ts');
    fs.copyFileSync(
      path.resolve(__dirname, '..', 'src', 'machines', 'qgsd-workflow.machine.ts'),
      machinePath
    );

    const child = spawn(process.execPath, [RUN_FV, '--watch', '--only=generate'], {
      cwd:   tmpDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env:   { ...process.env },
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    // Wait for initial run to complete (SUMMARY appears when first run finishes)
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('timeout waiting for initial run: ' + output)), 20000
      );
      const check = setInterval(() => {
        if (output.includes('SUMMARY')) { clearInterval(check); clearTimeout(deadline); resolve(); }
      }, 100);
    });

    // Touch machine file to trigger change detection
    const before = output.length;
    fs.writeFileSync(machinePath, fs.readFileSync(machinePath, 'utf8') + '\n// watch-trigger-test');

    // Wait for 'Change detected' message
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('timeout waiting for change detection: ' + output.slice(before))), 10000
      );
      const check = setInterval(() => {
        if (output.length > before && output.includes('Change detected')) {
          clearInterval(check); clearTimeout(deadline); resolve();
        }
      }, 100);
    });

    child.kill('SIGINT');
    await new Promise(resolve => child.on('close', resolve));

    assert.match(output, /Change detected/i, 'must print "Change detected" after file write');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('watch mode (DX-01): exits cleanly on SIGINT with exit code 0', { timeout: 30000 }, async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfv-watch-sigint-'));
  try {
    const machinesDir = path.join(tmpDir, 'src', 'machines');
    fs.mkdirSync(machinesDir, { recursive: true });
    fs.copyFileSync(
      path.resolve(__dirname, '..', 'src', 'machines', 'qgsd-workflow.machine.ts'),
      path.join(machinesDir, 'qgsd-workflow.machine.ts')
    );

    const child = spawn(process.execPath, [RUN_FV, '--watch', '--only=generate'], {
      cwd:   tmpDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env:   { ...process.env },
    });

    let output = '';
    child.stdout.on('data', d => { output += d.toString(); });
    child.stderr.on('data', d => { output += d.toString(); });

    // Wait for watch startup AND first SUMMARY (initial run complete).
    // Same timing rationale as the startup test: SIGINT sent after the initial
    // runOnce() finishes so we are back in the fs.watch event loop.
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('timeout waiting for watch startup + initial run: ' + output)), 20000
      );
      const check = setInterval(() => {
        if (output.includes('Watch mode enabled') && output.includes('SUMMARY')) {
          clearInterval(check); clearTimeout(deadline); resolve();
        }
      }, 100);
    });

    child.kill('SIGINT');
    const { code, signal } = await new Promise(resolve =>
      child.on('close', (code, signal) => resolve({ code, signal }))
    );

    assert.strictEqual(code, 0,
      'must exit with code 0 on SIGINT (got code: ' + code + ', signal: ' + signal + ')');
    assert.match(output, /Exiting watch mode/i,
      'must print "Exiting watch mode" on SIGINT — got: ' + output.slice(-200));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
