#!/usr/bin/env node
// @requirement OBS-10
// Assertion test for: NoUtilDuplication
// Formal model: .planning/formal/alloy/observability-handlers.als
// Requirement: All utility functions live in observe-utils.cjs. No handler defines utilities locally.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const REPO_ROOT = '/Users/jonathanborduas/code/QGSD';

test('OBS-10 — NoUtilDuplication: observe-utils.cjs exports all utility functions', () => {
  const utils = require(`${REPO_ROOT}/bin/observe-utils.cjs`);
  const requiredExports = ['parseDuration', 'formatAge', 'classifySeverityFromLabels', 'formatAgeFromMtime'];
  for (const name of requiredExports) {
    assert.equal(typeof utils[name], 'function', `observe-utils.cjs must export ${name} as a function`);
  }
});

test('OBS-10 — NoUtilDuplication: observe-handlers.cjs has no local utility function definitions', () => {
  const source = fs.readFileSync(`${REPO_ROOT}/bin/observe-handlers.cjs`, 'utf8');
  // Check that no function definition lines match utility names
  const utilNames = ['classifySeverityFromLabels', 'formatAgeFromMtime', 'parseDuration', 'formatAge'];
  for (const name of utilNames) {
    const defPattern = new RegExp(`^\\s*function\\s+${name}\\s*\\(`, 'm');
    assert.ok(!defPattern.test(source), `observe-handlers.cjs must NOT define ${name} locally`);
  }
});

test('OBS-10 — NoUtilDuplication: observe-handler-internal.cjs has no local utility function definitions', () => {
  const source = fs.readFileSync(`${REPO_ROOT}/bin/observe-handler-internal.cjs`, 'utf8');
  const utilNames = ['classifySeverityFromLabels', 'formatAgeFromMtime', 'parseDuration', 'formatAge'];
  for (const name of utilNames) {
    const defPattern = new RegExp(`^\\s*function\\s+${name}\\s*\\(`, 'm');
    assert.ok(!defPattern.test(source), `observe-handler-internal.cjs must NOT define ${name} locally`);
  }
});

test('OBS-10 — NoUtilDuplication: observe-handler-internal.cjs imports formatAgeFromMtime from utils', () => {
  const source = fs.readFileSync(`${REPO_ROOT}/bin/observe-handler-internal.cjs`, 'utf8');
  assert.ok(
    source.includes("require('./observe-utils.cjs')"),
    'observe-handler-internal.cjs must import from observe-utils.cjs'
  );
});

test('OBS-10 — NoUtilDuplication: observe-handlers.cjs imports classifySeverityFromLabels from utils', () => {
  const source = fs.readFileSync(`${REPO_ROOT}/bin/observe-handlers.cjs`, 'utf8');
  assert.ok(
    source.includes('classifySeverityFromLabels') && source.includes("require('./observe-utils.cjs')"),
    'observe-handlers.cjs must import classifySeverityFromLabels from observe-utils.cjs'
  );
});

test('OBS-10 — NoUtilDuplication: utility functions produce correct results from canonical module', () => {
  const { parseDuration, formatAge, classifySeverityFromLabels, formatAgeFromMtime } = require(`${REPO_ROOT}/bin/observe-utils.cjs`);

  // parseDuration
  assert.equal(parseDuration('7d'), 7 * 86400000);
  assert.equal(parseDuration('24h'), 24 * 3600000);
  assert.equal(parseDuration(''), 0);

  // classifySeverityFromLabels
  assert.equal(classifySeverityFromLabels([{ name: 'bug' }]), 'bug');
  assert.equal(classifySeverityFromLabels([{ name: 'enhancement' }]), 'enhancement');
  assert.equal(classifySeverityFromLabels([]), 'info');
  assert.equal(classifySeverityFromLabels(null), 'info');

  // formatAgeFromMtime
  assert.equal(formatAgeFromMtime(null), 'unknown');
  assert.equal(formatAgeFromMtime(new Date(Date.now() + 100000)), 'future');
  assert.equal(typeof formatAgeFromMtime(new Date()), 'string');
});
