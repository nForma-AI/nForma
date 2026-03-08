#!/usr/bin/env node
// @requirement NAV-03
// Structural test: Sessions terminal widget uses pure-JavaScript @xterm/headless
// terminal emulation with child_process.spawn, eliminating native addon dependencies.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('NAV-03 — @xterm/headless is declared as a dependency in package.json', () => {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
  assert.ok(
    allDeps['@xterm/headless'],
    'package.json must list @xterm/headless as a dependency'
  );
});

test('NAV-03 — nForma.cjs imports child_process for spawn-based terminal I/O', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(src, /child_process/, 'nForma.cjs must reference child_process');
  assert.match(src, /spawn/, 'nForma.cjs must use spawn for terminal I/O');
});
