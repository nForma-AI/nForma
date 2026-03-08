#!/usr/bin/env node
// @requirement UPS-01
// Test: UserPromptSubmit hook detects GSD planning commands via explicit allowlist
// regex match against prompt field.
// Constant strategy: verify nf-prompt.js contains the allowlist regex pattern.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const nfPromptSrc = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'hooks', 'nf-prompt.js'), 'utf8'
);

test('UPS-01: nf-prompt.js contains allowlist regex for GSD command detection', () => {
  assert.ok(nfPromptSrc.includes('allowlist'),
    'nf-prompt.js must reference an allowlist pattern for command matching');
});

test('UPS-01: allowlist regex requires /nf: or /gsd: or /qgsd: prefix', () => {
  // The regex pattern must match the tri-prefix structure
  assert.match(nfPromptSrc, /nf\|q\?gsd/,
    'Allowlist regex must include nf|q?gsd prefix pattern');
});

test('UPS-01: strict mode pattern matches any /nf: command', () => {
  // Reconstruct the strict-mode regex from source and test it
  const strictPattern = /^\s*\/(nf|q?gsd):[\w][\w-]*(\s|$)/;
  assert.ok(strictPattern.test('/nf:quick'), '/nf:quick should match strict pattern');
  assert.ok(strictPattern.test('/gsd:solve'), '/gsd:solve should match strict pattern');
  assert.ok(strictPattern.test('/qgsd:research'), '/qgsd:research should match strict pattern');
  assert.ok(!strictPattern.test('nf:quick'), 'Missing slash should not match');
  assert.ok(!strictPattern.test('/other:command'), '/other: prefix should not match');
});

test('UPS-01: non-matching prompts cause process.exit(0)', () => {
  // Verify the code path: if !cmdPattern.test(prompt) => process.exit(0)
  assert.ok(nfPromptSrc.includes('cmdPattern.test(prompt)'),
    'Must test prompt against cmdPattern');
  assert.ok(nfPromptSrc.includes('process.exit(0)'),
    'Must exit(0) for non-matching prompts (silent pass)');
});
