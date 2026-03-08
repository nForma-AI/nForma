#!/usr/bin/env node
// @requirement GUARD-01
// Structural test: hook system provides three code-quality guardrails:
// 1. PostToolUse hook for auto-format (fail-open)
// 2. Stop hook that warns about leftover console.log (non-blocking)
// 3. Modular .claude/rules/ directory with convention files

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('GUARD-01: nf-console-guard.js Stop hook exists and warns about console.log', () => {
  const hookPath = path.join(ROOT, 'hooks', 'nf-console-guard.js');
  assert.ok(fs.existsSync(hookPath),
    'hooks/nf-console-guard.js must exist');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.match(content, /console\.log/,
    'must detect console.log statements');
  assert.match(content, /warn|advisory/i,
    'must produce warnings (not blocks)');
  assert.match(content, /process\.exit\(0\)/,
    'must exit 0 (fail-open, never blocks)');
});

test('GUARD-01: nf-console-guard.js is also in hooks/dist/', () => {
  const distPath = path.join(ROOT, 'hooks', 'dist', 'nf-console-guard.js');
  assert.ok(fs.existsSync(distPath),
    'hooks/dist/nf-console-guard.js must exist for install sync');
});

test('GUARD-01: .claude/rules/ directory has project convention files', () => {
  const rulesDir = path.join(ROOT, '.claude', 'rules');
  assert.ok(fs.existsSync(rulesDir),
    '.claude/rules/ directory must exist');
  const files = fs.readdirSync(rulesDir);
  assert.ok(files.length > 0,
    '.claude/rules/ must contain at least one convention file');
  // Verify at least one .md file for conventions
  const mdFiles = files.filter(f => f.endsWith('.md'));
  assert.ok(mdFiles.length > 0,
    '.claude/rules/ must contain .md convention files');
});

test('GUARD-01: hooks use fail-open pattern (try/catch + exit 0)', () => {
  const hookPath = path.join(ROOT, 'hooks', 'nf-console-guard.js');
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.match(content, /try\s*\{/,
    'must use try/catch for fail-open');
  assert.match(content, /catch/,
    'must have catch block');
});
