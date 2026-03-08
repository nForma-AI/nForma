#!/usr/bin/env node
// @requirement DOC-03
// Structural test: nForma.cjs provides --screenshot CLI mode and
// bin/generate-tui-assets.cjs converts ANSI output to Tokyo Night SVG via npm run assets:tui

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('DOC-03 — nForma.cjs contains --screenshot CLI mode', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /--screenshot/, 'nForma.cjs must support --screenshot flag');
  assert.match(content, /cliArgs\.includes\('--screenshot'\)/, 'nForma.cjs must check for --screenshot in cliArgs');
});

test('DOC-03 — generate-tui-assets.cjs exports ansiToSvg for SVG conversion', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-tui-assets.cjs'));
  assert.equal(typeof mod.ansiToSvg, 'function', 'generate-tui-assets.cjs must export ansiToSvg');
  assert.equal(typeof mod.stripAnsi, 'function', 'generate-tui-assets.cjs must export stripAnsi');
});

test('DOC-03 — package.json defines assets:tui script pointing to generate-tui-assets.cjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['assets:tui'], 'package.json must have assets:tui script');
  assert.match(pkg.scripts['assets:tui'], /generate-tui-assets/, 'assets:tui script must reference generate-tui-assets');
});
