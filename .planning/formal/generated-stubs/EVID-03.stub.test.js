#!/usr/bin/env node
// @requirement EVID-03
// Structural test: bin/git-heatmap.cjs exports functions for mining git history
// (numerical adjustments, bugfix hotspots, churn ranking, formal-coverage cross-ref)

const { test } = require('node:test');
const assert = require('node:assert/strict');

const mod = require('/Users/jonathanborduas/code/QGSD/bin/git-heatmap.cjs');

test('EVID-03: git-heatmap exports extractNumericalAdjustments', () => {
  assert.equal(typeof mod.extractNumericalAdjustments, 'function');
});

test('EVID-03: git-heatmap exports extractBugfixHotspots', () => {
  assert.equal(typeof mod.extractBugfixHotspots, 'function');
});

test('EVID-03: git-heatmap exports extractChurnRanking', () => {
  assert.equal(typeof mod.extractChurnRanking, 'function');
});

test('EVID-03: git-heatmap exports computePriority (multiplicative scoring)', () => {
  assert.equal(typeof mod.computePriority, 'function');
});

test('EVID-03: git-heatmap exports hasFormalCoverage (cross-reference)', () => {
  assert.equal(typeof mod.hasFormalCoverage, 'function');
});

test('EVID-03: git-heatmap exports buildUncoveredHotZones', () => {
  assert.equal(typeof mod.buildUncoveredHotZones, 'function');
});

test('EVID-03: git-heatmap exports SINCE_PATTERN for input validation', () => {
  assert.ok(mod.SINCE_PATTERN instanceof RegExp);
});
