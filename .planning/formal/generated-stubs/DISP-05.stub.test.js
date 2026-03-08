#!/usr/bin/env node
// @requirement DISP-05
// Behavioral test: output parsing (verdict, reasoning, citations, improvements extraction
// from raw CLI output) happens in JavaScript with structured YAML output -- the slot worker
// agent returns script output verbatim without LLM post-processing.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/quorum-slot-dispatch.cjs');
const mod = require(SOURCE);

test('DISP-05: parseVerdict extracts APPROVE from Mode B output', () => {
  const raw = 'verdict: APPROVE\nreasoning: looks good';
  const result = mod.parseVerdict(raw, 'B');
  assert.equal(result, 'APPROVE');
});

test('DISP-05: parseVerdict extracts REJECT from Mode B output', () => {
  const raw = 'verdict: REJECT\nreasoning: bad change';
  const result = mod.parseVerdict(raw, 'B');
  assert.equal(result, 'REJECT');
});

test('DISP-05: parseVerdict returns FLAG for missing verdict in Mode B', () => {
  const raw = 'some random text without a verdict line';
  const result = mod.parseVerdict(raw, 'B');
  assert.equal(result, 'FLAG');
});

test('DISP-05: parseVerdict Mode A returns raw output slice', () => {
  const raw = 'This is a Mode A response about the question.';
  const result = mod.parseVerdict(raw, 'A');
  assert.equal(result, raw);
});

test('DISP-05: parseReasoning extracts reasoning line', () => {
  const raw = 'verdict: APPROVE\nreasoning: The change is correct and well-tested.\ncitations: |';
  const result = mod.parseReasoning(raw);
  assert.equal(result, 'The change is correct and well-tested.');
});

test('DISP-05: parseReasoning returns null for missing reasoning', () => {
  const raw = 'verdict: APPROVE';
  const result = mod.parseReasoning(raw);
  assert.equal(result, null);
});

test('DISP-05: parseCitations extracts citation block', () => {
  const raw = 'verdict: APPROVE\nreasoning: ok\ncitations: |\n  file.js:10 - relevant line\n  other.js:5 - another line\nimprovements: |';
  const result = mod.parseCitations(raw);
  assert.ok(result !== null, 'parseCitations must return non-null for valid input');
  assert.ok(result.includes('file.js:10'), 'citation must include file reference');
});

test('DISP-05: parseCitations returns null for empty input', () => {
  const result = mod.parseCitations('');
  assert.equal(result, null);
});

test('DISP-05: parseImprovements extracts improvements block', () => {
  const raw = 'verdict: APPROVE\nreasoning: ok\nimprovements: |\n  - Add error handling\n  - Add tests';
  const result = mod.parseImprovements(raw);
  assert.ok(result !== null, 'parseImprovements must return non-null for valid input');
});

test('DISP-05: all four parse functions are exported', () => {
  assert.equal(typeof mod.parseVerdict, 'function');
  assert.equal(typeof mod.parseReasoning, 'function');
  assert.equal(typeof mod.parseCitations, 'function');
  assert.equal(typeof mod.parseImprovements, 'function');
});
