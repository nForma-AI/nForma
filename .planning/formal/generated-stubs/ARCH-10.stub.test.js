#!/usr/bin/env node
// @requirement ARCH-10
// Structural test: nForma must not bundle LLM SDKs; check-bundled-sdks.cjs
// enforces this constraint with a FORBIDDEN_SDKS list.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/check-bundled-sdks.cjs');

test('ARCH-10: check-bundled-sdks.cjs exists', () => {
  assert.ok(fs.existsSync(SOURCE), 'bin/check-bundled-sdks.cjs must exist');
});

test('ARCH-10: defines FORBIDDEN_SDKS list', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /FORBIDDEN_SDKS/, 'must define FORBIDDEN_SDKS constant');
});

test('ARCH-10: forbids @anthropic-ai/sdk and openai packages', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /@anthropic-ai\/sdk/, 'must forbid @anthropic-ai/sdk');
  assert.match(content, /openai/, 'must forbid openai');
});

test('ARCH-10: scans for require/import patterns', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /require/, 'must detect require patterns');
  assert.match(content, /import/, 'must detect import patterns');
});
