#!/usr/bin/env node
'use strict';
// bin/persist-post-fix-verification.cjs
// Persists post_fix_verification results to bug-model-gaps.json
//
// Usage:
//   node bin/persist-post-fix-verification.cjs \
//     --bug-id=abc12345 \
//     --model-path=.planning/formal/tla/MCsafety.cfg \
//     --model-pass=true \
//     --neighbor-pass=false \
//     --neighbor-count=3 \
//     --regressions='[{"model_id":"alloy:quorum-votes","result":"fail"}]' \
//     --passed='[{"model_id":"tla:mcsafety","result":"pass"}]'

const fs   = require('fs');
const path = require('path');

const TAG = '[persist-post-fix-verification]';

function parseArg(argv, name) {
  const arg = argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
}

function parseBool(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null') return null;
  return null;
}

function parseJSON(val, fallback) {
  if (!val) return fallback;
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
}

const argv = process.argv.slice(2);
const rootArg = parseArg(argv, 'project-root');
const root = rootArg ? path.resolve(rootArg) : process.cwd();

const bugId         = parseArg(argv, 'bug-id');
const modelPath     = parseArg(argv, 'model-path');
const modelPass     = parseBool(parseArg(argv, 'model-pass'));
const neighborPass  = parseBool(parseArg(argv, 'neighbor-pass'));
const neighborCount = parseInt(parseArg(argv, 'neighbor-count') || '0', 10);
const regressions   = parseJSON(parseArg(argv, 'regressions'), []);
const passed        = parseJSON(parseArg(argv, 'passed'), []);

if (!bugId && !modelPath) {
  process.stderr.write(TAG + ' Error: --bug-id or --model-path required\n');
  process.exit(1);
}

const gapsPath = path.join(root, '.planning', 'formal', 'bug-model-gaps.json');
let gaps;
try {
  gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'));
} catch (_) {
  gaps = { version: '1.0', entries: [] };
}

// Find or create entry
let entry = gaps.entries.find(e =>
  (bugId && e.bug_id === bugId) ||
  (modelPath && e.model_path === modelPath)
);
if (!entry) {
  entry = {
    bug_id: bugId || 'unknown',
    model_path: modelPath || 'unknown',
    status: 'reproduced',
  };
  gaps.entries.push(entry);
}

entry.post_fix_verification = {
  timestamp: new Date().toISOString(),
  model_pass: modelPass,
  neighbor_models_pass: neighborPass,
  neighbor_count: neighborCount,
  regressions: regressions,
  passed_neighbors: passed,
};

fs.writeFileSync(gapsPath, JSON.stringify(gaps, null, 2));
process.stdout.write(TAG + ' post_fix_verification persisted to bug-model-gaps.json\n');
