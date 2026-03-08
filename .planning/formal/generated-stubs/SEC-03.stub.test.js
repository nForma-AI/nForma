#!/usr/bin/env node
// @requirement SEC-03
// Structural test: hooks validate/sanitize external input (JSON.parse with try/catch) at system boundaries

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SEC-03: nf-stop.js validates stdin JSON input with try/catch boundary', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-stop.js'), 'utf8');
  assert.match(content, /JSON\.parse/,
    'nf-stop.js must parse JSON input');
  assert.match(content, /try\s*\{/,
    'nf-stop.js must wrap input processing in try/catch for fail-open');
});

test('SEC-03: nf-prompt.js validates stdin JSON input with try/catch boundary', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  assert.match(content, /JSON\.parse/,
    'nf-prompt.js must parse JSON input');
  assert.match(content, /try\s*\{/,
    'nf-prompt.js must wrap input processing in try/catch for fail-open');
});

test('SEC-03: nf-stop.js uses typeof checks for input validation', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-stop.js'), 'utf8');
  assert.match(content, /typeof\s+\w+\s*===\s*'string'/,
    'nf-stop.js must validate string types before processing');
});

test('SEC-03: hooks use fail-open pattern (process.exit(0) in catch)', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-stop.js'), 'utf8');
  assert.match(content, /process\.exit\(0\)/,
    'nf-stop.js must exit 0 on error (fail-open)');
});

test('SEC-03: check-trace-redaction.cjs validates input at boundary', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'check-trace-redaction.cjs'), 'utf8');
  assert.match(content, /parseRedactionPolicy|forbidden_keys|forbidden_patterns/,
    'check-trace-redaction.cjs must validate redaction policy input');
});
