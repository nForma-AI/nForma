#!/usr/bin/env node
// @requirement SIG-03
// Structural test for: prism-priority.cjs
// Formal model: .planning/formal/alloy/signal-analysis-tools.als
// Requirement: prism-priority.cjs ranks roadmap items by PRISM failure probability

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SIG-03 — structural: prism-priority.cjs exports readPrismResults function', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  assert.equal(typeof mod.readPrismResults, 'function', 'readPrismResults must be a function');
});

test('SIG-03 — structural: prism-priority.cjs exports rankFailureModes function', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  assert.equal(typeof mod.rankFailureModes, 'function', 'rankFailureModes must be a function');
});

test('SIG-03 — structural: prism-priority.cjs exports formatPrioritySignal function', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  assert.equal(typeof mod.formatPrioritySignal, 'function', 'formatPrioritySignal must be a function');
});

test('SIG-03 — structural: readPrismResults returns empty array for missing file', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  const results = mod.readPrismResults('/non/existent/path.ndjson');
  assert.ok(Array.isArray(results), 'readPrismResults must return an array');
  assert.equal(results.length, 0, 'missing file should yield empty array');
});

test('SIG-03 — structural: rankFailureModes ranks by P(failure) x impact descending', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  const input = [
    { check_id: 'prism:quorum', result: 'fail', summary: 'high impact', timestamp: '2026-01-01', metadata: {} },
    { check_id: 'prism:mcp-availability', result: 'warn', summary: 'medium impact', timestamp: '2026-01-01', metadata: {} },
  ];
  const ranked = mod.rankFailureModes(input);
  assert.ok(Array.isArray(ranked), 'rankFailureModes must return an array');
  assert.ok(ranked.length > 0, 'should produce ranked results from failure entries');
  assert.ok(ranked[0].priority >= ranked[ranked.length - 1].priority, 'results must be sorted descending by priority');
});

test('SIG-03 — structural: formatPrioritySignal returns null for empty input', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  const signal = mod.formatPrioritySignal([]);
  assert.equal(signal, null, 'formatPrioritySignal must return null for empty ranked modes');
});

test('SIG-03 — structural: formatPrioritySignal produces formatted text block', () => {
  const mod = require(path.join(ROOT, 'bin', 'prism-priority.cjs'));
  const ranked = [
    { check_id: 'test:check', priority: 10.0, p_failure: 1.0, impact: 10, summary: 'test failure' },
  ];
  const signal = mod.formatPrioritySignal(ranked);
  assert.ok(typeof signal === 'string', 'formatPrioritySignal must return a string');
  assert.ok(signal.includes('PRISM Priority Signal'), 'signal must include header');
  assert.ok(signal.includes('test:check'), 'signal must include check_id');
});
