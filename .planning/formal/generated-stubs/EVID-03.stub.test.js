#!/usr/bin/env node
// @requirement EVID-03
// Structural test for git-heatmap.cjs — mines git history for numerical
// adjustments, bugfix hotspots, and churn ranking with formal-coverage
// cross-reference. Formal property: Bool from evidence-scope-scan.als.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ghPath = path.resolve(__dirname, '../../../bin/git-heatmap.cjs');

test('EVID-03: git-heatmap.cjs exports required functions', () => {
  const mod = require(ghPath);
  assert.ok(typeof mod.isBugfixCommit === 'function', 'must export isBugfixCommit');
  assert.ok(typeof mod.computePriority === 'function', 'must export computePriority');
  assert.ok(typeof mod.hasFormalCoverage === 'function', 'must export hasFormalCoverage');
  assert.ok(typeof mod.buildCoverageMap === 'function', 'must export buildCoverageMap');
  assert.ok(typeof mod.extractNumericalAdjustments === 'function', 'must export extractNumericalAdjustments');
});

test('EVID-03: git-heatmap.cjs exports churn/numeric analysis helpers', () => {
  const mod = require(ghPath);
  assert.ok(typeof mod.parseDiffNumericLine === 'function', 'must export parseDiffNumericLine');
  assert.ok(typeof mod.parseHunksForNumericChanges === 'function', 'must export parseHunksForNumericChanges');
  assert.ok(typeof mod.computeDriftDirection === 'function', 'must export computeDriftDirection');
});

test('EVID-03: git-heatmap.cjs exports CLI helpers', () => {
  const mod = require(ghPath);
  assert.ok(typeof mod.parseArgs === 'function', 'must export parseArgs');
  assert.ok(typeof mod.validateSince === 'function', 'must export validateSince');
});
