#!/usr/bin/env node
// @requirement DASH-03
// Structural test: dashboard source files contain exit-cleanup logic
// so that Q/Escape exits cleanly with stdin fully restored.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DASH-03 — dashboard sources contain process.exit for clean exit', () => {
  // The dashboards that handle interactive display must call process.exit
  // to ensure clean shutdown (stdin restored, no character-swallowing).
  const dashboardFiles = [
    'bin/token-dashboard.cjs',
    'bin/cross-layer-dashboard.cjs',
  ];

  for (const rel of dashboardFiles) {
    const abs = path.join(ROOT, rel);
    const content = fs.readFileSync(abs, 'utf8');
    assert.match(
      content,
      /process\.exit\(/,
      `${rel} must call process.exit() for clean dashboard exit`
    );
  }
});

test('DASH-03 — manage-agents-core uses readline for interactive input', () => {
  // manage-agents-core.cjs uses readline.createInterface to handle
  // interactive dashboard input, which provides clean stdin restoration.
  const filePath = path.join(ROOT, 'bin', 'manage-agents-core.cjs');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.match(
    content,
    /readline\.createInterface/,
    'manage-agents-core.cjs must use readline.createInterface for clean stdin handling'
  );
});
