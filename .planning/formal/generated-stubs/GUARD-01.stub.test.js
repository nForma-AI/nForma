#!/usr/bin/env node
// @requirement GUARD-01
// Structural test: The hook system provides three code-quality guardrails:
//   1. PostToolUse hook that auto-formats JS/TS files (nf-post-edit-format.js)
//   2. Stop hook that warns about leftover console.log (nf-console-guard.js)
//   3. Modular .claude/rules/ directory with convention files

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = '/Users/jonathanborduas/code/QGSD';

test('GUARD-01: nf-post-edit-format.js hook exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'nf-post-edit-format.js')));
});

test('GUARD-01: nf-post-edit-format.js references prettier or biome', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-post-edit-format.js'), 'utf8');
  assert.ok(content.includes('prettier') || content.includes('biome'),
    'Expected formatter reference (prettier or biome)');
});

test('GUARD-01: nf-post-edit-format.js is fail-open (exits 0)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-post-edit-format.js'), 'utf8');
  assert.match(content, /process\.exit\(0\)/);
});

test('GUARD-01: nf-console-guard.js hook exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'hooks', 'nf-console-guard.js')));
});

test('GUARD-01: nf-console-guard.js scans for console.log', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-console-guard.js'), 'utf8');
  assert.match(content, /console\.log/);
});

test('GUARD-01: nf-console-guard.js is fail-open (exits 0)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-console-guard.js'), 'utf8');
  assert.match(content, /process\.exit\(0\)/);
});

test('GUARD-01: .claude/rules/ directory exists with convention files', () => {
  const rulesDir = path.join(ROOT, '.claude', 'rules');
  assert.ok(fs.existsSync(rulesDir), '.claude/rules/ directory must exist');
  const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
  assert.ok(files.length >= 1, 'Expected at least one .md convention file in .claude/rules/');
});
