#!/usr/bin/env node
// @requirement OBS-16
// Structural test: The observe handler surfaces nf:health diagnostic codes (E*/W*/I*)
// as observe issues with severity-mapped routing, gated to the QGSD source repo via
// core/bin/gsd-tools.cjs existence check.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('OBS-16: observe-handler-internal.cjs gates health diagnostics via gsd-tools.cjs existence', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-internal.cjs'), 'utf8');
  // Checks for core/bin/gsd-tools.cjs existence
  assert.match(content, /gsd-tools\.cjs/, 'should reference gsd-tools.cjs path');
  assert.match(content, /existsSync\(gsdToolsPath\)/, 'should gate on gsd-tools.cjs existence');
});

test('OBS-16: maps errors to severity error', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-internal.cjs'), 'utf8');
  assert.match(content, /severity:\s*'error'/, 'should map errors to severity error');
  assert.match(content, /healthData\.errors/, 'should read errors from health data');
});

test('OBS-16: maps warnings to severity warning with conditional routing', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-internal.cjs'), 'utf8');
  assert.match(content, /severity:\s*'warning'/, 'should map warnings to severity warning');
  assert.match(content, /healthData\.warnings/, 'should read warnings from health data');
  // Repairable warnings route to /nf:health --repair
  assert.match(content, /nf:health --repair/, 'repairable warnings should route to /nf:health --repair');
});

test('OBS-16: maps info to severity info', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-internal.cjs'), 'utf8');
  assert.match(content, /severity:\s*'info'/, 'should map info to severity info');
  assert.match(content, /healthData\.info/, 'should read info from health data');
});

test('OBS-16: health diagnostic issues include diagnostic code in id', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'observe-handler-internal.cjs'), 'utf8');
  // Issue id includes the diagnostic code (e.code, w.code, i.code)
  assert.match(content, /internal-health-\$\{e\.code\}/, 'error issue id should include e.code');
  assert.match(content, /internal-health-\$\{w\.code\}/, 'warning issue id should include w.code');
  assert.match(content, /internal-health-\$\{i\.code\}/, 'info issue id should include i.code');
});
