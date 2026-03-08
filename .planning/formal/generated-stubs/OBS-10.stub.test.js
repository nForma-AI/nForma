#!/usr/bin/env node
// @requirement OBS-10
// Structural test: observe utility functions (formatAge, parseDuration, classifySeverity)
// are defined in a single canonical module and imported by all handlers.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const UTILS_PATH = path.join(ROOT, 'bin/observe-utils.cjs');

test('OBS-10: observe-utils.cjs exports formatAge, parseDuration, classifySeverityFromLabels', () => {
  const mod = require(UTILS_PATH);
  assert.ok(typeof mod.formatAge === 'function', 'formatAge must be exported as a function');
  assert.ok(typeof mod.parseDuration === 'function', 'parseDuration must be exported as a function');
  assert.ok(typeof mod.classifySeverityFromLabels === 'function', 'classifySeverityFromLabels must be exported as a function');
});

test('OBS-10: canonical definitions are only in observe-utils.cjs', () => {
  const content = fs.readFileSync(UTILS_PATH, 'utf8');
  assert.match(content, /function parseDuration/, 'parseDuration must be defined in observe-utils.cjs');
  assert.match(content, /function formatAge/, 'formatAge must be defined in observe-utils.cjs');
  assert.match(content, /function classifySeverityFromLabels/, 'classifySeverityFromLabels must be defined in observe-utils.cjs');
});

test('OBS-10: all handlers that use utility functions import from observe-utils.cjs', () => {
  const handlerFiles = [
    'bin/observe-handlers.cjs',
    'bin/observe-handler-grafana.cjs',
    'bin/observe-handler-logstash.cjs',
    'bin/observe-handler-prometheus.cjs',
    'bin/observe-handler-upstream.cjs',
    'bin/observe-handler-internal.cjs',
  ];

  for (const file of handlerFiles) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // If the handler uses formatAge, parseDuration, or classifySeverity it must import from observe-utils
    const usesUtils = /formatAge|parseDuration|classifySeverity|formatAgeFromMtime/.test(content);
    if (usesUtils) {
      assert.match(
        content,
        /require\(['"]\.\/observe-utils\.cjs['"]\)/,
        `${file} uses utility functions but does not import from observe-utils.cjs`
      );
    }
  }
});

test('OBS-10: no handler duplicates utility function definitions', () => {
  const handlerFiles = [
    'bin/observe-handlers.cjs',
    'bin/observe-handler-grafana.cjs',
    'bin/observe-handler-logstash.cjs',
    'bin/observe-handler-prometheus.cjs',
    'bin/observe-handler-upstream.cjs',
    'bin/observe-handler-internal.cjs',
    'bin/observe-handler-deps.cjs',
  ];

  for (const file of handlerFiles) {
    const filePath = path.join(ROOT, file);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(
      !content.includes('function parseDuration'),
      `${file} must not duplicate parseDuration — import from observe-utils.cjs`
    );
    assert.ok(
      !content.includes('function formatAge'),
      `${file} must not duplicate formatAge — import from observe-utils.cjs`
    );
  }
});
