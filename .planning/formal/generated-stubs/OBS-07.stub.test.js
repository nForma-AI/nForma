#!/usr/bin/env node
// @requirement OBS-07
// Behavioral test: analyze-assumptions CLI parses TLA+, Alloy, and PRISM models,
// cross-references against debt ledger and observe handler registry,
// and outputs gap reports with proposed metrics

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modPath = path.resolve(__dirname, '../../../bin/analyze-assumptions.cjs');
const mod = require(modPath);

test('OBS-07: exports all required functions', () => {
  assert.equal(typeof mod.extractTlaAssumptions, 'function');
  assert.equal(typeof mod.extractAlloyAssumptions, 'function');
  assert.equal(typeof mod.extractPrismAssumptions, 'function');
  assert.equal(typeof mod.scanAllFormalModels, 'function');
  assert.equal(typeof mod.crossReference, 'function');
  assert.equal(typeof mod.generateGapReport, 'function');
  assert.equal(typeof mod.buildProposedMetrics, 'function');
});

test('OBS-07: extractTlaAssumptions returns array for valid TLA+ content', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  // Create a temp TLA+ file with an ASSUME statement
  const tmpFile = path.join(os.tmpdir(), `obs07-test-${Date.now()}.tla`);
  fs.writeFileSync(tmpFile, 'ASSUME MaxDeliberation >= 3\n');
  try {
    const results = mod.extractTlaAssumptions(tmpFile);
    assert.ok(Array.isArray(results), 'should return an array');
    assert.ok(results.length > 0, 'should extract at least one assumption');
    assert.equal(results[0].source, 'tla');
    assert.equal(results[0].name, 'MaxDeliberation');
    assert.equal(results[0].type, 'assume');
    assert.equal(results[0].value, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('OBS-07: crossReference returns array', () => {
  // crossReference takes assumptions array and options, returns cross-referenced array
  const result = mod.crossReference([], { root: process.cwd() });
  assert.ok(Array.isArray(result), 'crossReference should return an array');
});

test('OBS-07: generateGapReport produces report with gaps having metric fields', () => {
  // generateGapReport takes cross-referenced assumptions, returns report object
  const report = mod.generateGapReport([{
    source: 'tla',
    file: 'test.tla',
    name: 'TestConst',
    type: 'constant',
    value: 5,
    rawText: 'CONSTANTS TestConst',
    coverage: 'uncovered',
  }]);
  assert.ok(typeof report === 'object', 'should return a report object');
  assert.ok(Array.isArray(report.gaps), 'report should have gaps array');
  assert.ok(report.gaps.length > 0, 'should have at least one gap for uncovered assumption');
  assert.ok('tier' in report.gaps[0], 'gap should have tier classification');
  assert.ok('metric_type' in report.gaps[0], 'gap should have metric_type');
  assert.ok('metric_name' in report.gaps[0], 'gap should have metric_name');
});

test('OBS-07: buildProposedMetrics generates instrumentation snippets', () => {
  assert.equal(typeof mod.buildProposedMetrics, 'function');
  // buildProposedMetrics takes a report object with gaps array
  const report = mod.generateGapReport([{
    source: 'tla',
    file: 'test.tla',
    name: 'TestConst',
    type: 'constant',
    value: 5,
    rawText: 'CONSTANTS TestConst',
    coverage: 'uncovered',
  }]);
  const result = mod.buildProposedMetrics(report, process.cwd());
  assert.ok(typeof result === 'object', 'should return metrics object');
  assert.ok(Array.isArray(result.metrics), 'should have metrics array');
  assert.ok(result.total_proposed >= 0, 'should have total_proposed count');
});
