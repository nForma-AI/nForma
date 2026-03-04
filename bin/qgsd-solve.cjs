#!/usr/bin/env node
'use strict';
// bin/qgsd-solve.cjs
// Consistency solver orchestrator: sweeps Requirements->Formal->Tests->Code,
// computes a residual vector per layer transition, and auto-closes gaps.
//
// Layer transitions:
//   R->F: Requirements without formal model coverage
//   F->T: Formal invariants without test backing
//   C->F: Code constants diverging from formal specs
//   T->C: Failing unit tests
//   F->C: Failing formal verification checks
//
// Usage:
//   node bin/qgsd-solve.cjs                  # full sync, up to 3 iterations
//   node bin/qgsd-solve.cjs --report-only    # single sweep, no mutations
//   node bin/qgsd-solve.cjs --max-iterations=1
//   node bin/qgsd-solve.cjs --json           # machine-readable output
//   node bin/qgsd-solve.cjs --verbose        # pipe child stderr to parent stderr
//
// Requirements: QUICK-140

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = '[qgsd-solve]';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_MAX_ITERATIONS = 3;

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const jsonMode = args.includes('--json');
const verboseMode = args.includes('--verbose');

let maxIterations = DEFAULT_MAX_ITERATIONS;
for (const arg of args) {
  if (arg.startsWith('--max-iterations=')) {
    const val = parseInt(arg.slice('--max-iterations='.length), 10);
    if (!isNaN(val) && val >= 1 && val <= 10) {
      maxIterations = val;
    }
  }
}

// ── Helper: spawnTool ────────────────────────────────────────────────────────

/**
 * Spawns a child process with error handling and optional stderr piping.
 * Returns { ok: boolean, stdout: string, stderr: string }.
 */
function spawnTool(script, args, opts = {}) {
  const scriptPath = path.join(ROOT, script);
  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: opts.timeout || 120000,
    stdio: verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe',
  };

  try {
    const result = spawnSync(process.execPath, [scriptPath, ...args], spawnOpts);
    if (result.error) {
      return {
        ok: false,
        stdout: '',
        stderr: result.error.message,
      };
    }
    return {
      ok: result.status === 0,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    };
  } catch (err) {
    return {
      ok: false,
      stdout: '',
      stderr: err.message,
    };
  }
}

// ── Layer transition sweeps ──────────────────────────────────────────────────

/**
 * R->F: Requirements to Formal coverage.
 * Returns { residual: N, detail: {...} }
 */
function sweepRtoF() {
  const result = spawnTool('bin/generate-traceability-matrix.cjs', [
    '--json',
    '--quiet',
  ]);

  if (!result.ok) {
    return {
      residual: -1,
      detail: {
        error: result.stderr || 'generate-traceability-matrix.cjs failed',
      },
    };
  }

  try {
    const matrix = JSON.parse(result.stdout);
    const coverage = matrix.coverage_summary || {};
    const uncovered = coverage.uncovered_requirements || [];
    const total = coverage.total_requirements || 0;
    const covered = coverage.covered_requirements || 0;
    const percentage = total > 0 ? ((covered / total) * 100).toFixed(1) : 0;

    return {
      residual: uncovered.length,
      detail: {
        uncovered_requirements: uncovered,
        total: total,
        covered: covered,
        percentage: percentage,
      },
    };
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to parse traceability matrix: ' + err.message },
    };
  }
}

/**
 * Cache for formal-test-sync.cjs --json --report-only result.
 */
let formalTestSyncCache = null;

/**
 * Helper to load and cache formal-test-sync result.
 */
function loadFormalTestSync() {
  if (formalTestSyncCache) return formalTestSyncCache;

  const result = spawnTool('bin/formal-test-sync.cjs', [
    '--json',
    '--report-only',
  ]);

  if (!result.ok) {
    formalTestSyncCache = null;
    return null;
  }

  try {
    formalTestSyncCache = JSON.parse(result.stdout);
    return formalTestSyncCache;
  } catch (err) {
    formalTestSyncCache = null;
    return null;
  }
}

/**
 * F->T: Formal to Tests coverage.
 * Returns { residual: N, detail: {...} }
 */
function sweepFtoT() {
  const syncData = loadFormalTestSync();

  if (!syncData) {
    return {
      residual: -1,
      detail: { error: 'formal-test-sync.cjs failed' },
    };
  }

  const gaps = syncData.coverage_gaps || {};
  const stats = gaps.stats || {};
  const gapCount = stats.gap_count || 0;
  const gapsList = gaps.gaps || [];

  return {
    residual: gapCount,
    detail: {
      gap_count: gapCount,
      formal_covered: stats.formal_covered || 0,
      test_covered: stats.test_covered || 0,
      gaps: gapsList.map((g) => g.requirement_id || g),
    },
  };
}

/**
 * C->F: Code constants to Formal constants.
 * Returns { residual: N, detail: {...} }
 */
function sweepCtoF() {
  const syncData = loadFormalTestSync();

  if (!syncData) {
    return {
      residual: -1,
      detail: { error: 'formal-test-sync.cjs failed' },
    };
  }

  const validation = syncData.constants_validation || [];
  const mismatches = validation.filter((entry) => {
    return (
      entry.match === false &&
      entry.intentional_divergence !== true &&
      entry.config_path !== null
    );
  });

  return {
    residual: mismatches.length,
    detail: {
      mismatches: mismatches.map((m) => ({
        constant: m.constant,
        source: m.source,
        formal_value: m.formal_value,
        config_value: m.config_value,
      })),
    },
  };
}

/**
 * T->C: Tests to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepTtoC() {
  const spawnOpts = {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 120000,
    stdio: verboseMode ? ['pipe', 'pipe', 'inherit'] : 'pipe',
  };

  let result;
  try {
    result = spawnSync(process.execPath, ['--test'], spawnOpts);
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to spawn node --test: ' + err.message },
    };
  }

  const output = (result.stdout || '') + (result.stderr || '');

  // Parse TAP output for test summary.
  // Look for lines like: "# tests N" and "# fail M"
  let totalTests = 0;
  let failCount = 0;

  const testsMatch = output.match(/^#\s+tests\s+(\d+)/m);
  if (testsMatch) totalTests = parseInt(testsMatch[1], 10);

  const failMatch = output.match(/^#\s+fail\s+(\d+)/m);
  if (failMatch) failCount = parseInt(failMatch[1], 10);

  // Fallback: count "not ok" lines if summary not found
  if (failCount === 0 && totalTests === 0) {
    const notOkMatches = output.match(/^not ok\s+\d+/gm) || [];
    failCount = notOkMatches.length;
    const okMatches = output.match(/^ok\s+\d+/gm) || [];
    totalTests = notOkMatches.length + okMatches.length;
  }

  return {
    residual: failCount,
    detail: {
      total_tests: totalTests,
      passed: Math.max(0, totalTests - failCount),
      failed: failCount,
    },
  };
}

/**
 * F->C: Formal verification to Code.
 * Returns { residual: N, detail: {...} }
 */
function sweepFtoC() {
  const verifyScript = path.join(ROOT, 'bin', 'run-formal-verify.cjs');

  if (!fs.existsSync(verifyScript)) {
    return {
      residual: 0,
      detail: { skipped: true, reason: 'run-formal-verify.cjs not found' },
    };
  }

  // In report-only mode, read stale check results without re-running
  if (reportOnly) {
    const checkResultsPath = path.join(ROOT, '.formal', 'check-results.ndjson');
    if (!fs.existsSync(checkResultsPath)) {
      return {
        residual: 0,
        detail: { skipped: true, reason: 'check-results.ndjson not found', stale: true },
      };
    }

    try {
      const lines = fs.readFileSync(checkResultsPath, 'utf8').split('\n');
      let failedCount = 0;
      let inconclusiveCount = 0;
      let totalCount = 0;
      const failures = [];
      const inconclusive = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        totalCount++;
        try {
          const entry = JSON.parse(line);
          if (entry.result === 'fail') {
            failedCount++;
            failures.push({
              check_id: entry.check_id || entry.id || '?',
              summary: entry.summary || '',
              requirement_ids: entry.requirement_ids || [],
            });
          } else if (entry.result === 'inconclusive') {
            inconclusiveCount++;
            inconclusive.push({
              check_id: entry.check_id || entry.id || '?',
              summary: entry.summary || '',
            });
          }
        } catch (e) {
          // skip malformed lines
        }
      }

      return {
        residual: failedCount,
        detail: {
          total_checks: totalCount,
          passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
          failed: failedCount,
          inconclusive: inconclusiveCount,
          failures: failures,
          inconclusive_checks: inconclusive,
          stale: true,
        },
      };
    } catch (err) {
      return {
        residual: -1,
        detail: { error: 'Failed to read check-results.ndjson: ' + err.message },
      };
    }
  }

  // Full run (mutating, expensive)
  const result = spawnTool('bin/run-formal-verify.cjs', [], {
    timeout: 300000,
  });

  if (!result.ok) {
    return {
      residual: -1,
      detail: { error: result.stderr || 'run-formal-verify.cjs failed' },
    };
  }

  // Parse .formal/check-results.ndjson
  const checkResultsPath = path.join(ROOT, '.formal', 'check-results.ndjson');

  if (!fs.existsSync(checkResultsPath)) {
    return {
      residual: 0,
      detail: { note: 'No check-results.ndjson generated' },
    };
  }

  try {
    const lines = fs.readFileSync(checkResultsPath, 'utf8').split('\n');
    let failedCount = 0;
    let inconclusiveCount = 0;
    let totalCount = 0;
    const failures = [];
    const inconclusiveChecks = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      totalCount++;
      try {
        const entry = JSON.parse(line);
        if (entry.result === 'fail') {
          failedCount++;
          failures.push({
            check_id: entry.check_id || entry.id || '?',
            summary: entry.summary || '',
            requirement_ids: entry.requirement_ids || [],
          });
        } else if (entry.result === 'inconclusive') {
          inconclusiveCount++;
          inconclusiveChecks.push({
            check_id: entry.check_id || entry.id || '?',
            summary: entry.summary || '',
          });
        }
      } catch (e) {
        // skip malformed lines
      }
    }

    return {
      residual: failedCount,
      detail: {
        total_checks: totalCount,
        passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
        failed: failedCount,
        inconclusive: inconclusiveCount,
        failures: failures,
        inconclusive_checks: inconclusiveChecks,
      },
    };
  } catch (err) {
    return {
      residual: -1,
      detail: { error: 'Failed to parse check-results.ndjson: ' + err.message },
    };
  }
}

// ── Residual computation ─────────────────────────────────────────────────────

/**
 * Computes residual vector for all 5 layer transitions.
 * Returns residual object with r_to_f, f_to_t, c_to_f, t_to_c, f_to_c.
 */
function computeResidual() {
  const r_to_f = sweepRtoF();
  const f_to_t = sweepFtoT();
  const c_to_f = sweepCtoF();
  const t_to_c = sweepTtoC();
  const f_to_c = sweepFtoC();

  const total =
    (r_to_f.residual >= 0 ? r_to_f.residual : 0) +
    (f_to_t.residual >= 0 ? f_to_t.residual : 0) +
    (c_to_f.residual >= 0 ? c_to_f.residual : 0) +
    (t_to_c.residual >= 0 ? t_to_c.residual : 0) +
    (f_to_c.residual >= 0 ? f_to_c.residual : 0);

  return {
    r_to_f,
    f_to_t,
    c_to_f,
    t_to_c,
    f_to_c,
    total,
    timestamp: new Date().toISOString(),
  };
}

// ── Auto-close ───────────────────────────────────────────────────────────────

/**
 * Attempts to fix gaps found by the sweep.
 * Returns { actions_taken: [...], stubs_generated: N }
 */
function autoClose(residual) {
  const actions = [];

  // F->T gaps: generate test stubs
  if (residual.f_to_t.residual > 0) {
    const result = spawnTool('bin/formal-test-sync.cjs', []);
    if (result.ok) {
      actions.push(
        'Generated test stubs for ' +
          residual.f_to_t.residual +
          ' uncovered invariants'
      );
    } else {
      actions.push(
        'Could not auto-generate test stubs for ' +
          residual.f_to_t.residual +
          ' invariants (formal-test-sync.cjs failed)'
      );
    }
  }

  // C->F mismatches: log but do not auto-fix
  if (residual.c_to_f.residual > 0) {
    actions.push(
      'Cannot auto-fix ' +
        residual.c_to_f.residual +
        ' constant mismatch(es) — manual review required'
    );
  }

  // T->C failures: log but do not auto-fix
  if (residual.t_to_c.residual > 0) {
    actions.push(
      residual.t_to_c.residual + ' test failure(s) — manual fix required'
    );
  }

  // R->F gaps: log but do not auto-fix
  if (residual.r_to_f.residual > 0) {
    actions.push(
      residual.r_to_f.residual +
        ' requirement(s) lack formal model coverage — manual modeling required'
    );
  }

  // F->C failures: log but do not auto-fix
  if (residual.f_to_c.residual > 0) {
    actions.push(
      residual.f_to_c.residual +
        ' formal verification failure(s) — manual fix required'
    );
  }

  return {
    actions_taken: actions,
    stubs_generated: residual.f_to_t.residual > 0 ? 1 : 0,
  };
}

// ── Health indicator ─────────────────────────────────────────────────────────

/**
 * Returns health string for a residual value.
 */
function healthIndicator(residual) {
  if (residual === -1) return '?  UNKNOWN';
  if (residual === 0) return 'OK GREEN';
  if (residual >= 1 && residual <= 3) return '!! YELLOW';
  return 'XX RED';
}

// ── Report formatting ────────────────────────────────────────────────────────

/**
 * Formats human-readable report.
 */
function formatReport(iterations, finalResidual, converged) {
  const lines = [];

  lines.push('[qgsd-solve] Consistency Solver Report');
  lines.push('');
  lines.push(
    'Iterations: ' +
      iterations.length +
      '/' +
      maxIterations +
      ' (converged: ' +
      (converged ? 'yes' : 'no') +
      ')'
  );
  lines.push('');

  // Residual vector table
  lines.push('Layer Transition             Residual  Health');
  lines.push('─────────────────────────────────────────────');

  const rows = [
    {
      label: 'R -> F (Req->Formal)',
      residual: finalResidual.r_to_f.residual,
    },
    {
      label: 'F -> T (Formal->Test)',
      residual: finalResidual.f_to_t.residual,
    },
    {
      label: 'C -> F (Code->Formal)',
      residual: finalResidual.c_to_f.residual,
    },
    {
      label: 'T -> C (Test->Code)',
      residual: finalResidual.t_to_c.residual,
    },
    {
      label: 'F -> C (Formal->Code)',
      residual: finalResidual.f_to_c.residual,
    },
  ];

  for (const row of rows) {
    const res =
      row.residual >= 0 ? row.residual : '?';
    const health = healthIndicator(row.residual);
    const line = row.label.padEnd(28) + String(res).padStart(4) + '    ' + health;
    lines.push(line);
  }

  lines.push('─────────────────────────────────────────────');
  lines.push('Total residual:          ' + finalResidual.total);
  lines.push('');

  // Per-layer detail sections (only non-zero)
  if (finalResidual.r_to_f.residual > 0) {
    lines.push('## R -> F (Requirements -> Formal)');
    const detail = finalResidual.r_to_f.detail;
    if (detail.uncovered_requirements && detail.uncovered_requirements.length > 0) {
      lines.push('Uncovered requirements:');
      for (const req of detail.uncovered_requirements) {
        lines.push('  - ' + req);
      }
    }
    lines.push('');
  }

  if (finalResidual.f_to_t.residual > 0) {
    lines.push('## F -> T (Formal -> Tests)');
    const detail = finalResidual.f_to_t.detail;
    lines.push('Gap count: ' + detail.gap_count);
    if (detail.gaps && detail.gaps.length > 0) {
      lines.push('Requirements with gaps:');
      for (const gap of detail.gaps.slice(0, 10)) {
        lines.push('  - ' + gap);
      }
      if (detail.gaps.length > 10) {
        lines.push('  ... and ' + (detail.gaps.length - 10) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.c_to_f.residual > 0) {
    lines.push('## C -> F (Code Constants -> Formal)');
    const detail = finalResidual.c_to_f.detail;
    if (detail.mismatches && detail.mismatches.length > 0) {
      lines.push('Mismatches:');
      for (const m of detail.mismatches.slice(0, 5)) {
        lines.push(
          '  - ' +
            m.constant +
            ': formal=' +
            m.formal_value +
            ', config=' +
            m.config_value
        );
      }
      if (detail.mismatches.length > 5) {
        lines.push('  ... and ' + (detail.mismatches.length - 5) + ' more');
      }
    }
    lines.push('');
  }

  if (finalResidual.t_to_c.residual > 0) {
    lines.push('## T -> C (Tests -> Code)');
    const detail = finalResidual.t_to_c.detail;
    lines.push(
      'Failed tests: ' +
        detail.failed +
        ' / ' +
        detail.total_tests
    );
    lines.push('');
  }

  if (finalResidual.f_to_c.residual > 0 || (finalResidual.f_to_c.detail && finalResidual.f_to_c.detail.inconclusive > 0)) {
    lines.push('## F -> C (Formal -> Code)');
    const detail = finalResidual.f_to_c.detail;
    const parts = [];
    if (detail.passed > 0) parts.push(detail.passed + ' pass');
    if (detail.failed > 0) parts.push(detail.failed + ' fail');
    if (detail.inconclusive > 0) parts.push(detail.inconclusive + ' inconclusive');
    lines.push('Checks: ' + parts.join(', ') + ' (of ' + detail.total_checks + ' total)');
    if (detail.failures && detail.failures.length > 0) {
      lines.push('');
      lines.push('Failures:');
      for (const fail of detail.failures) {
        const f = typeof fail === 'string' ? { check_id: fail, summary: '' } : fail;
        lines.push('  ✗ ' + f.check_id + (f.summary ? ' — ' + f.summary : ''));
        if (f.requirement_ids && f.requirement_ids.length > 0) {
          lines.push('    reqs: ' + f.requirement_ids.join(', '));
        }
      }
    }
    if (detail.inconclusive_checks && detail.inconclusive_checks.length > 0) {
      lines.push('');
      lines.push('Inconclusive:');
      for (const w of detail.inconclusive_checks) {
        lines.push('  ⚠ ' + w.check_id + (w.summary ? ' — ' + w.summary : ''));
      }
    }
    if (detail.stale) {
      lines.push('');
      lines.push('Note: results may be stale (from cached check-results.ndjson)');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats JSON output.
 */
function formatJSON(iterations, finalResidual, converged) {
  const health = {};
  for (const key of ['r_to_f', 'f_to_t', 'c_to_f', 't_to_c', 'f_to_c']) {
    const res = finalResidual[key].residual;
    health[key] = healthIndicator(res).split(/\s+/)[1]; // Extract GREEN/YELLOW/RED/UNKNOWN
  }

  return {
    solver_version: '1.0',
    generated_at: new Date().toISOString(),
    iteration_count: iterations.length,
    max_iterations: maxIterations,
    converged: converged,
    residual_vector: finalResidual,
    iterations: iterations.map((it) => ({
      iteration: it.iteration,
      residual: it.residual,
      actions: it.actions || [],
    })),
    health: health,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const iterations = [];
  let converged = false;
  let prevTotal = null;

  for (let i = 1; i <= maxIterations; i++) {
    process.stderr.write(TAG + ' Iteration ' + i + '/' + maxIterations + '\n');

    // Clear formal-test-sync cache so computeResidual() sees fresh data after autoClose() mutations
    formalTestSyncCache = null;

    const residual = computeResidual();
    const actions = [];
    iterations.push({ iteration: i, residual: residual, actions: actions });

    // Check convergence: total residual unchanged from previous iteration
    if (prevTotal !== null && residual.total === prevTotal) {
      converged = true;
      process.stderr.write(
        TAG +
          ' Converged at iteration ' +
          i +
          ' (residual stable at ' +
          residual.total +
          ')\n'
      );
      break;
    }

    // Check if already at zero
    if (residual.total === 0) {
      converged = true;
      process.stderr.write(TAG + ' All layers clean — residual is 0\n');
      break;
    }

    // Auto-close if not report-only and not last iteration
    if (!reportOnly) {
      const closeResult = autoClose(residual);
      iterations[iterations.length - 1].actions = closeResult.actions_taken;
    } else {
      break; // report-only = single sweep, no loop
    }

    prevTotal = residual.total;
  }

  const finalResidual = iterations[iterations.length - 1].residual;

  if (jsonMode) {
    process.stdout.write(
      JSON.stringify(formatJSON(iterations, finalResidual, converged), null, 2) +
        '\n'
    );
  } else {
    process.stdout.write(formatReport(iterations, finalResidual, converged));
  }

  // Exit with non-zero if residual > 0 (signals gaps remain)
  process.exit(finalResidual.total > 0 ? 1 : 0);
}

// ── Exports (for testing) ────────────────────────────────────────────────────

module.exports = {
  sweep: computeResidual,
  computeResidual,
  autoClose,
  formatReport,
  formatJSON,
  healthIndicator,
};

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
