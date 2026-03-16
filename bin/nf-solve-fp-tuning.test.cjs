#!/usr/bin/env node
'use strict';

/**
 * nf-solve-fp-tuning.test.cjs -- Unit tests for FPTUNE-01/02/03 functions.
 *
 * Tests computeScannerStats, computeFPRates, applyFPTuning, formatFPRateTable.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { computeScannerStats, computeFPRates, applyFPTuning, formatFPRateTable } = require('./nf-solve.cjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + message + '\n');
  } else {
    failed++;
    process.stderr.write('  FAIL: ' + message + '\n');
  }
}

function assertClose(actual, expected, tolerance, message) {
  const ok = Math.abs(actual - expected) < tolerance;
  if (ok) {
    passed++;
    process.stdout.write('  PASS: ' + message + ' (' + actual.toFixed(4) + ' ~= ' + expected.toFixed(4) + ')\n');
  } else {
    failed++;
    process.stderr.write('  FAIL: ' + message + ' (got ' + actual + ', expected ~' + expected + ')\n');
  }
}

// ── FPTUNE-01: computeScannerStats ──────────────────────────────────────────

console.log('\n=== FPTUNE-01: computeScannerStats ===');

{
  const classifications = {
    ctor: { 'file-a': 'fp', 'file-b': 'genuine', 'file-c': 'fp' },
    ttor: { 'test-a': 'genuine', 'test-b': 'genuine', 'test-c': 'review' },
    dtor: { 'hash-1': 'fp', 'hash-2': 'genuine' },
  };
  const stats = computeScannerStats(classifications);

  assert(stats.ctor.total === 3, 'FPTUNE-01: ctor total = 3');
  assert(stats.ctor.fp === 2, 'FPTUNE-01: ctor fp = 2');
  assert(stats.ctor.genuine === 1, 'FPTUNE-01: ctor genuine = 1');
  assert(stats.ctor.review === 0, 'FPTUNE-01: ctor review = 0');

  assert(stats.ttor.total === 3, 'FPTUNE-01: ttor total = 3');
  assert(stats.ttor.fp === 0, 'FPTUNE-01: ttor fp = 0');
  assert(stats.ttor.genuine === 2, 'FPTUNE-01: ttor genuine = 2');
  assert(stats.ttor.review === 1, 'FPTUNE-01: ttor review = 1');

  assert(stats.dtor.total === 2, 'FPTUNE-01: dtor total = 2');
  assert(stats.dtor.fp === 1, 'FPTUNE-01: dtor fp = 1');
}

{
  const stats = computeScannerStats({});
  assert(Object.keys(stats).length === 0, 'FPTUNE-01: empty classifications -> empty result');
}

// ── FPTUNE-01: computeFPRates ───────────────────────────────────────────────

console.log('\n=== FPTUNE-01: computeFPRates ===');

{
  const history = [
    { session_id: '2026-01-01', scanner_stats: { ctor: { total: 10, fp: 3, genuine: 7, review: 0 } } },
    { session_id: '2026-01-02', scanner_stats: { ctor: { total: 10, fp: 5, genuine: 5, review: 0 } } },
    { session_id: '2026-01-03', scanner_stats: { ctor: { total: 10, fp: 2, genuine: 8, review: 0 } } },
  ];
  const rates = computeFPRates(history);

  assert(rates.ctor.sessions === 3, 'FPTUNE-01: 3 sessions for ctor');
  assert(rates.ctor.total_items === 30, 'FPTUNE-01: total items = 30');
  assert(rates.ctor.total_fp === 10, 'FPTUNE-01: total FP = 10');
  assertClose(rates.ctor.fp_rate, 10 / 30, 0.0001, 'FPTUNE-01: FP rate = 10/30');
}

// Full 10-session window
{
  const history = [];
  for (let i = 0; i < 10; i++) {
    history.push({
      session_id: '2026-01-' + String(i + 1).padStart(2, '0'),
      scanner_stats: { ttor: { total: 5, fp: 4, genuine: 1, review: 0 } },
    });
  }
  const rates = computeFPRates(history);
  assert(rates.ttor.sessions === 10, 'FPTUNE-01: full window has 10 sessions');
  assertClose(rates.ttor.fp_rate, 0.8, 0.0001, 'FPTUNE-01: FP rate = 0.8 over full window');
}

// Empty session history
{
  const rates = computeFPRates([]);
  assert(Object.keys(rates).length === 0, 'FPTUNE-01: empty history -> empty rates');
}

// Scanner appearing in only some sessions
{
  const history = [
    { session_id: '2026-01-01', scanner_stats: { ctor: { total: 10, fp: 5, genuine: 5, review: 0 }, ttor: { total: 5, fp: 1, genuine: 4, review: 0 } } },
    { session_id: '2026-01-02', scanner_stats: { ctor: { total: 10, fp: 3, genuine: 7, review: 0 } } },
    { session_id: '2026-01-03', scanner_stats: { ttor: { total: 5, fp: 2, genuine: 3, review: 0 } } },
  ];
  const rates = computeFPRates(history);
  assert(rates.ctor.sessions === 2, 'FPTUNE-01: ctor appears in 2 sessions');
  assert(rates.ttor.sessions === 2, 'FPTUNE-01: ttor appears in 2 sessions');
}

// ── FPTUNE-02: applyFPTuning ────────────────────────────────────────────────

console.log('\n=== FPTUNE-02: applyFPTuning ===');

// Helper to create temp file
function createTempClassFile(data) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fptune-'));
  const tmpFile = path.join(tmpDir, 'solve-classifications.json');
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
  return { tmpFile, tmpDir };
}

function cleanupTemp(tmpDir) {
  try {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) fs.unlinkSync(path.join(tmpDir, f));
    fs.rmdirSync(tmpDir);
  } catch (_) {}
}

// Scanner with FP rate > 0.6 and 5+ sessions -> threshold raised by 0.1
{
  const { tmpFile, tmpDir } = createTempClassFile({ classifications: {}, tuning: {} });
  const fpRates = { ctor: { sessions: 6, total_items: 60, total_fp: 42, fp_rate: 0.7 } };
  const changes = applyFPTuning(tmpFile, fpRates);
  assert(changes.length === 1, 'FPTUNE-02: one change for high-FP scanner');
  assert(changes[0].scanner === 'ctor', 'FPTUNE-02: change applies to ctor');
  assert(changes[0].from === 0.5, 'FPTUNE-02: from default 0.5');
  assert(changes[0].to === 0.6, 'FPTUNE-02: to 0.6 (+0.1)');
  cleanupTemp(tmpDir);
}

// Scanner with FP rate > 0.6 but only 3 sessions -> threshold unchanged
{
  const { tmpFile, tmpDir } = createTempClassFile({ classifications: {}, tuning: {} });
  const fpRates = { ctor: { sessions: 3, total_items: 30, total_fp: 24, fp_rate: 0.8 } };
  const changes = applyFPTuning(tmpFile, fpRates);
  assert(changes.length === 0, 'FPTUNE-02: no change with only 3 sessions');
  cleanupTemp(tmpDir);
}

// Scanner with FP rate = 0.5 and 5+ sessions -> threshold unchanged
{
  const { tmpFile, tmpDir } = createTempClassFile({ classifications: {}, tuning: {} });
  const fpRates = { ctor: { sessions: 7, total_items: 70, total_fp: 35, fp_rate: 0.5 } };
  const changes = applyFPTuning(tmpFile, fpRates);
  assert(changes.length === 0, 'FPTUNE-02: no change with FP rate = 0.5');
  cleanupTemp(tmpDir);
}

// Multiple tuning cycles -> thresholds stack (0.5 -> 0.6 -> 0.7)
{
  const { tmpFile, tmpDir } = createTempClassFile({ classifications: {}, tuning: {} });
  const fpRates = { ctor: { sessions: 5, total_items: 50, total_fp: 35, fp_rate: 0.7 } };

  const c1 = applyFPTuning(tmpFile, fpRates);
  assert(c1.length === 1 && c1[0].to === 0.6, 'FPTUNE-02: first cycle 0.5 -> 0.6');

  const c2 = applyFPTuning(tmpFile, fpRates);
  assert(c2.length === 1 && c2[0].to === 0.7, 'FPTUNE-02: second cycle 0.6 -> 0.7');

  cleanupTemp(tmpDir);
}

// Threshold capped at 0.9
{
  const { tmpFile, tmpDir } = createTempClassFile({ classifications: {}, tuning: { ctor: 0.9 } });
  const fpRates = { ctor: { sessions: 5, total_items: 50, total_fp: 40, fp_rate: 0.8 } };
  const changes = applyFPTuning(tmpFile, fpRates);
  assert(changes.length === 0, 'FPTUNE-02: no change when already at 0.9 cap');
  cleanupTemp(tmpDir);
}

// ── FPTUNE-03: formatFPRateTable ────────────────────────────────────────────

console.log('\n=== FPTUNE-03: formatFPRateTable ===');

// Table with 2 scanners
{
  const fpRates = {
    ctor: { sessions: 8, total_items: 80, total_fp: 36, fp_rate: 0.45 },
    ttor: { sessions: 10, total_items: 100, total_fp: 72, fp_rate: 0.72 },
  };
  const tuning = { ctor: 0.5, ttor: 0.6 };
  const table = formatFPRateTable(fpRates, tuning);

  assert(table.includes('Per-Scanner FP Rates'), 'FPTUNE-03: table has header');
  assert(table.includes('| Scanner'), 'FPTUNE-03: table has column headers');
  assert(table.includes('ctor'), 'FPTUNE-03: table includes ctor');
  assert(table.includes('ttor'), 'FPTUNE-03: table includes ttor');
}

// Scanner with high FP rate -> TUNED status
{
  const fpRates = { ttor: { sessions: 6, total_items: 60, total_fp: 42, fp_rate: 0.7 } };
  const tuning = { ttor: 0.6 };
  const table = formatFPRateTable(fpRates, tuning);
  assert(table.includes('TUNED'), 'FPTUNE-03: high FP scanner shows TUNED');
}

// Scanner with low FP rate -> OK status
{
  const fpRates = { ctor: { sessions: 8, total_items: 80, total_fp: 16, fp_rate: 0.2 } };
  const tuning = { ctor: 0.5 };
  const table = formatFPRateTable(fpRates, tuning);
  assert(table.includes('OK'), 'FPTUNE-03: low FP scanner shows OK');
}

// Empty fpRates -> table has headers but no data rows
{
  const table = formatFPRateTable({}, {});
  assert(table.includes('Per-Scanner FP Rates'), 'FPTUNE-03: empty table has header');
  assert(table.includes('| Scanner'), 'FPTUNE-03: empty table has column headers');
  // Should only have header rows, no data rows
  const lines = table.split('\n').filter(l => l.startsWith('|'));
  assert(lines.length === 2, 'FPTUNE-03: empty table has only 2 header rows (header + separator)');
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('\n=== Results ===');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Total:  ' + (passed + failed));

process.exit(failed > 0 ? 1 : 0);
