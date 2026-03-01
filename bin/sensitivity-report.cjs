#!/usr/bin/env node
'use strict';
// bin/sensitivity-report.cjs
// Reads formal/sensitivity-report.ndjson, ranks parameters by outcome-flip count,
// and generates formal/sensitivity-report.md with annotated code paths, test cases,
// and monitoring metrics.
// Requirements: SENS-03

const fs   = require('fs');
const path = require('path');

const TAG = '[sensitivity-report]';

const REPORT_NDJSON_PATH = process.env.SENSITIVITY_REPORT_PATH ||
  path.join(__dirname, '..', 'formal', 'sensitivity-report.ndjson');

const REPORT_MD_PATH = process.env.SENSITIVITY_MD_PATH ||
  path.join(__dirname, '..', 'formal', 'sensitivity-report.md');

// ── Hardcoded annotations (code paths known from codebase analysis) ──────────
// Maps parameter name → { codePath, testCases[], monitoring[] }

const PARAM_ANNOTATIONS = {
  MaxSize: {
    codePath: 'hooks/qgsd-prompt.js FAN_OUT_COUNT; formal/tla/MCsafety.cfg MaxSize',
    testCases: [
      'Test quorum at N=2 boundary: set FAN_OUT_COUNT=2 in providers.json and run quorum round',
      'Test quorum at N=1 (no quorum): verify workflow rejects insufficient available slots',
    ],
    monitoring: [
      'Track FAN_OUT_COUNT per planning session in quorum-scoreboard.json',
      'Alert if available slot count drops below MaxSize threshold for 2+ consecutive sessions',
    ],
  },
  tp_rate: {
    codePath: 'bin/export-prism-constants.cjs TP_PRIOR=0.85; formal/prism/quorum.pm tp_rate const',
    testCases: [
      'Test quorum with 2/4 slots returning APPROVE (tp_rate≈0.5) — verify inconclusive behavior',
      'Test quorum with all slots UNAVAILABLE — verify graceful degradation exits 0',
    ],
    monitoring: [
      'Track per-slot APPROVE rate in quorum-scoreboard.json rounds array',
      'Alert if any slot tp_rate falls below 0.6 for 5+ consecutive quorum rounds',
    ],
  },
  MaxDeliberation: {
    codePath: 'formal/tla/MCsafety.cfg MaxDeliberation=7; src/machines/qgsd-workflow.machine.ts MaxDeliberation guard',
    testCases: [
      'Test quorum workflow with max deliberation rounds reached — verify DECIDED fallback',
      'Test rapid-fire slot responses (all within 1 deliberation round)',
    ],
    monitoring: [
      'Track deliberation round count per quorum session in quorum-scoreboard.json',
      'Alert if any session reaches MaxDeliberation-1 rounds (approaching timeout)',
    ],
  },
  unavail: {
    codePath: 'bin/export-prism-constants.cjs UNAVAIL_PRIOR=0.15; formal/prism/quorum.pm unavail const',
    testCases: [
      'Test quorum with 2/4 slots UNAVAILABLE — verify 2-of-2 quorum still reaches DECIDED',
      'Test quorum with 3/4 slots UNAVAILABLE — verify graceful INCONCLUSIVE result',
    ],
    monitoring: [
      'Track per-slot UNAVAIL rate in quorum-scoreboard.json',
      'Alert if aggregate unavail rate exceeds 0.3 (less than MIN_QUORUM slots reliably available)',
    ],
  },
};

// ── NDJSON parser (fail-open) ─────────────────────────────────────────────────

function parseNDJSON(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return [];
  }
  const records = [];
  for (const line of content.trim().split('\n')) {
    if (!line.trim()) continue;
    try { records.push(JSON.parse(line)); } catch (_) {}
  }
  return records;
}

// ── Report generation ─────────────────────────────────────────────────────────

function generateReport(records) {
  const now = new Date().toISOString();
  const lines = [
    '# Sensitivity Report — QGSD v0.20',
    '',
    'Generated: ' + now,
    'Source: formal/sensitivity-report.ndjson (' + records.length + ' records)',
    '',
  ];

  if (records.length === 0) {
    lines.push('## No Data Available');
    lines.push('');
    lines.push('Run `node bin/run-sensitivity-sweep.cjs` to generate sweep data.');
    return lines.join('\n');
  }

  // Group by parameter and count outcome flips
  const paramData = {};
  for (const r of records) {
    const p = r.metadata && r.metadata.parameter;
    if (!p) continue;
    if (!paramData[p]) {
      paramData[p] = {
        description: r.property || ('Sweep of ' + p),
        records: [],
        flips: [],
        stable: [],
        inconclusive: [],
      };
    }
    paramData[p].records.push(r);
    const delta = r.metadata && r.metadata.delta;
    if (delta && delta.startsWith('flip-to-')) {
      paramData[p].flips.push({ value: r.metadata.value, result: r.result });
    } else if (delta === 'stable') {
      paramData[p].stable.push(r.metadata.value);
    } else {
      paramData[p].inconclusive.push(r.metadata.value);
    }
  }

  // Rank parameters by flip count (descending)
  const ranked = Object.entries(paramData)
    .sort((a, b) => b[1].flips.length - a[1].flips.length);

  const hasAnyFlips = ranked.some(([, d]) => d.flips.length > 0);

  if (!hasAnyFlips) {
    lines.push('## No Outcome Flips Detected');
    lines.push('');
    lines.push(
      'All sweep results were inconclusive (tools not installed) or stable. ' +
      'Install TLC and PRISM to run a live sensitivity sweep.'
    );
    lines.push('');
    lines.push('### Parameter Summary');
    lines.push('');
    for (const [param, data] of ranked) {
      lines.push('- **' + param + '**: ' + data.records.length + ' records — ' +
        (data.inconclusive.length > 0
          ? 'all inconclusive (tools not installed)'
          : 'all stable'));
    }
    return lines.join('\n');
  }

  lines.push('## High-Sensitivity Parameters (ranked by outcome-flip count)');
  lines.push('');

  let rank = 1;
  for (const [param, data] of ranked) {
    const ann = PARAM_ANNOTATIONS[param] || {
      codePath: '(unknown — add to PARAM_ANNOTATIONS in sensitivity-report.cjs)',
      testCases: ['Review ' + param + ' at boundary values'],
      monitoring: ['Track ' + param + ' over time'],
    };

    const flipSummary = data.flips.length > 0
      ? data.flips.map(f => f.value + '→' + f.result).join(', ')
      : 'none';

    lines.push('### ' + rank + '. ' + param + ' — ' + data.flips.length + ' flip(s)');
    lines.push('**Description:** ' + data.description);
    lines.push('**Flip values:** ' + (data.flips.length > 0 ? flipSummary : 'none detected'));
    if (data.inconclusive.length > 0) {
      lines.push('**Inconclusive at:** ' + data.inconclusive.join(', ') + ' (tools not installed)');
    }
    lines.push('**Code path:** `' + ann.codePath + '`');
    lines.push('');
    lines.push('**Recommended test cases:**');
    for (const tc of ann.testCases) {
      lines.push('- ' + tc);
    }
    lines.push('');
    lines.push('**Recommended monitoring:**');
    for (const m of ann.monitoring) {
      lines.push('- ' + m);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    rank++;
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const records = parseNDJSON(REPORT_NDJSON_PATH);

  if (records.length === 0) {
    process.stderr.write(
      TAG + ' No records found in: ' + REPORT_NDJSON_PATH + '\n' +
      TAG + ' Run `node bin/run-sensitivity-sweep.cjs` first.\n'
    );
  } else {
    process.stderr.write(TAG + ' Loaded ' + records.length + ' records from: ' + REPORT_NDJSON_PATH + '\n');
  }

  const markdown = generateReport(records);

  fs.mkdirSync(path.dirname(REPORT_MD_PATH), { recursive: true });
  fs.writeFileSync(REPORT_MD_PATH, markdown + '\n', 'utf8');

  process.stderr.write(TAG + ' Report written to: ' + REPORT_MD_PATH + '\n');
}

main();
