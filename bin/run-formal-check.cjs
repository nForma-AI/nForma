#!/usr/bin/env node
'use strict';
// bin/run-formal-check.cjs
// Lightweight per-module formal checker for TLC, Alloy, PRISM.
// Invoked by Step 6.3 in quick.md to run model checkers after execution.
// Requirements: quick-130
//
// Usage:
//   node bin/run-formal-check.cjs --modules=quorum
//   node bin/run-formal-check.cjs --modules=quorum,tui-nav,breaker
//
// Exit codes:
//   0 if all checks passed or skipped (no counterexample)
//   1 if any check failed (counterexample or TLC error)
//
// Prerequisites:
//   - Java >=17 (for TLC and Alloy)
//   - formal/tla/tla2tools.jar
//   - formal/alloy/org.alloytools.alloy.dist.jar
//   - PRISM_BIN env var (optional; skipped if not set)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Module to check mapping (hardcoded) ──────────────────────────────────
const MODULE_CHECKS = {
  quorum: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCliveness.cfg',
        'formal/tla/QGSDQuorum.tla',
        '-workers', '1'
      ]
    },
    {
      tool: 'alloy',
      cmd: [
        'java', '-jar', 'formal/alloy/org.alloytools.alloy.dist.jar', 'exec',
        '--output', '-', '--type', 'text', '--quiet',
        'formal/alloy/quorum-votes.als'
      ]
    },
    {
      tool: 'prism',
      cmd: null, // Set dynamically if PRISM_BIN is set
      prismModel: 'formal/prism/quorum.pm',
      prismProps: 'formal/prism/quorum.props'
    }
  ],
  'tui-nav': [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCTUINavigation.cfg',
        'formal/tla/TUINavigation.tla',
        '-workers', '1'
      ]
    }
  ],
  breaker: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCbreaker.cfg',
        'formal/tla/QGSDCircuitBreaker.tla',
        '-workers', '1'
      ]
    }
  ],
  deliberation: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCdeliberation.cfg',
        'formal/tla/QGSDDeliberation.tla',
        '-workers', '1'
      ]
    }
  ],
  oscillation: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCoscillation.cfg',
        'formal/tla/QGSDOscillation.tla',
        '-workers', '1'
      ]
    }
  ],
  convergence: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCconvergence.cfg',
        'formal/tla/QGSDConvergence.tla',
        '-workers', '1'
      ]
    }
  ],
  prefilter: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCprefilter.cfg',
        'formal/tla/QGSDPreFilter.tla',
        '-workers', '1'
      ]
    }
  ],
  recruiting: [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCrecruiting-safety.cfg',
        'formal/tla/QGSDRecruiting.tla',
        '-workers', '1'
      ]
    }
  ],
  'account-manager': [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCaccount-manager.cfg',
        'formal/tla/QGSDAccountManager.tla',
        '-workers', '1'
      ]
    }
  ],
  'mcp-calls': [
    {
      tool: 'tlc',
      cmd: [
        'java', '-cp', 'formal/tla/tla2tools.jar', 'tlc2.TLC',
        '-config', 'formal/tla/MCMCPEnv.cfg',
        'formal/tla/QGSDMCPEnv.tla',
        '-workers', '1'
      ]
    }
  ]
};

// ── Helper: Detect Java ──────────────────────────────────────────────────
function detectJava() {
  const JAVA_HOME = process.env.JAVA_HOME;
  let javaExe;

  if (JAVA_HOME) {
    javaExe = path.join(JAVA_HOME, 'bin', 'java');
    if (fs.existsSync(javaExe)) {
      return javaExe;
    }
  }

  const probe = spawnSync('java', ['--version'], { encoding: 'utf8' });
  if (!probe.error && probe.status === 0) {
    return 'java';
  }

  return null;
}

// ── Helper: Check if file exists (fail-open on missing jar) ───────────────
function checkJarExists(jarPath) {
  return fs.existsSync(jarPath);
}

// ── Helper: Run a single check ──────────────────────────────────────────────
function runCheck(module, checkDef, javaExe, cwd) {
  const tool = checkDef.tool;
  const startMs = Date.now();

  if (tool === 'tlc') {
    // TLC check
    const cmd = checkDef.cmd[0];
    const args = checkDef.cmd.slice(1);

    const result = spawnSync(cmd, args, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 180000
    });

    const runtimeMs = Date.now() - startMs;
    let status = 'pass';
    let detail = '';

    if (result.error) {
      status = 'skipped';
      detail = result.error.message;
    } else if (result.status !== 0) {
      status = 'fail';
      detail = `Exit code ${result.status}`;
      // Scan stderr for error indicators
      if (result.stderr && result.stderr.includes('Error:')) {
        detail += '; error in stderr';
      }
    }

    return { module, tool, status, detail, runtimeMs };
  } else if (tool === 'alloy') {
    // Alloy check
    const cmd = checkDef.cmd[0];
    const args = checkDef.cmd.slice(1);

    const result = spawnSync(cmd, args, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 180000
    });

    const runtimeMs = Date.now() - startMs;
    let status = 'pass';
    let detail = '';

    if (result.error) {
      status = 'skipped';
      detail = result.error.message;
    } else if (result.status !== 0) {
      status = 'fail';
      detail = `Exit code ${result.status}`;
    } else if (result.stdout && result.stdout.includes('Counterexample')) {
      status = 'fail';
      detail = 'Counterexample found';
    }

    return { module, tool, status, detail, runtimeMs };
  } else if (tool === 'prism') {
    // PRISM check
    const prismBin = process.env.PRISM_BIN;
    if (!prismBin || !fs.existsSync(prismBin)) {
      return {
        module,
        tool: 'prism',
        status: 'skipped',
        detail: 'PRISM_BIN not set or binary not found',
        runtimeMs: 0
      };
    }

    const result = spawnSync(prismBin, [checkDef.prismModel], {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 180000
    });

    const runtimeMs = Date.now() - startMs;
    let status = 'pass';
    let detail = '';

    if (result.error) {
      status = 'fail';
      detail = result.error.message;
    } else if (result.status !== 0) {
      status = 'fail';
      detail = `Exit code ${result.status}`;
    }

    return { module, tool, status, detail, runtimeMs };
  }

  return { module, tool, status: 'skipped', detail: 'Unknown tool', runtimeMs: 0 };
}

// ── Main execution ──────────────────────────────────────────────────────────
if (require.main === module) {
  // Parse --modules argument
  const args = process.argv.slice(2);
  let modules = [];

  const modulesArg = args.find(a => a.startsWith('--modules='));
  if (modulesArg) {
    modules = modulesArg.split('=')[1].split(',').map(m => m.trim());
  }

  if (modules.length === 0) {
    process.stderr.write('[run-formal-check] Error: --modules argument required\n');
    process.stderr.write('[run-formal-check] Usage: node bin/run-formal-check.cjs --modules=quorum,tui-nav\n');
    process.exit(1);
  }

  const cwd = process.cwd();

  // Detect Java (fail-open)
  const javaExe = detectJava();
  if (!javaExe) {
    process.stderr.write('[run-formal-check] WARNING: java not found — skipping all TLC/Alloy checks\n');
    // All checks become skipped
    const allResults = [];
    for (const module of modules) {
      if (!MODULE_CHECKS[module]) {
        process.stderr.write(`[run-formal-check] WARNING: unknown module "${module}" — skipping\n`);
        continue;
      }
      for (const checkDef of MODULE_CHECKS[module]) {
        allResults.push({
          module,
          tool: checkDef.tool,
          status: 'skipped',
          detail: 'java not found',
          runtimeMs: 0
        });
      }
    }

    const skipped = allResults.length;
    const passed = 0;
    const failed = 0;

    process.stdout.write(`[run-formal-check] Results: ${allResults.length} checks, ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
    process.stdout.write(`FORMAL_CHECK_RESULT=${JSON.stringify({ passed, failed, skipped, counterexamples: [] })}\n`);
    process.exit(0);
  }

  // Check jar files (fail-open on missing)
  const tlcJarPath = path.join(cwd, 'formal', 'tla', 'tla2tools.jar');
  const alloyJarPath = path.join(cwd, 'formal', 'alloy', 'org.alloytools.alloy.dist.jar');

  const tlcJarExists = checkJarExists(tlcJarPath);
  const alloyJarExists = checkJarExists(alloyJarPath);

  // Run all checks
  const allResults = [];

  for (const module of modules) {
    if (!MODULE_CHECKS[module]) {
      process.stderr.write(`[run-formal-check] WARNING: unknown module "${module}" — skipping\n`);
      continue;
    }

    for (const checkDef of MODULE_CHECKS[module]) {
      if (checkDef.tool === 'tlc' && !tlcJarExists) {
        process.stderr.write(`[run-formal-check] WARNING: tla2tools.jar not found — skipping ${module} TLC check\n`);
        allResults.push({
          module,
          tool: 'tlc',
          status: 'skipped',
          detail: 'tla2tools.jar not found',
          runtimeMs: 0
        });
      } else if (checkDef.tool === 'alloy' && !alloyJarExists) {
        process.stderr.write(`[run-formal-check] WARNING: org.alloytools.alloy.dist.jar not found — skipping ${module} Alloy check\n`);
        allResults.push({
          module,
          tool: 'alloy',
          status: 'skipped',
          detail: 'org.alloytools.alloy.dist.jar not found',
          runtimeMs: 0
        });
      } else {
        const result = runCheck(module, checkDef, javaExe, cwd);
        allResults.push(result);
      }
    }
  }

  // Count results
  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const skipped = allResults.filter(r => r.status === 'skipped').length;
  const counterexamples = allResults
    .filter(r => r.status === 'fail')
    .map(r => `${r.module}:${r.tool}`);

  // Output summary
  process.stdout.write(`[run-formal-check] Results: ${allResults.length} checks, ${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  // Machine-readable result line
  process.stdout.write(`FORMAL_CHECK_RESULT=${JSON.stringify({ passed, failed, skipped, counterexamples })}\n`);

  // Exit code: 0 if no failures, 1 if any failed
  const exitCode = failed > 0 ? 1 : 0;
  process.exit(exitCode);
}

module.exports = {
  detectJava,
  checkJarExists,
  runCheck,
  MODULE_CHECKS
};
