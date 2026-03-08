#!/usr/bin/env node
// @requirement SIG-02
// Structural test for: generate-petri-net.cjs --roadmap
// Formal model: .planning/formal/alloy/signal-analysis-tools.als
// Requirement: generate-petri-net.cjs --roadmap models phase dependencies as Petri net with critical path analysis

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SIG-02 — structural: generate-petri-net.cjs exports _pure with roadmap functions', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  assert.ok(mod._pure, 'generate-petri-net.cjs must export _pure object');
});

test('SIG-02 — structural: _pure exports parseRoadmapPhases function', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  assert.equal(typeof mod._pure.parseRoadmapPhases, 'function', 'parseRoadmapPhases must be a function');
});

test('SIG-02 — structural: _pure exports buildRoadmapDot function', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  assert.equal(typeof mod._pure.buildRoadmapDot, 'function', 'buildRoadmapDot must be a function');
});

test('SIG-02 — structural: _pure exports computeCriticalPath function', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  assert.equal(typeof mod._pure.computeCriticalPath, 'function', 'computeCriticalPath must be a function');
});

test('SIG-02 — structural: parseRoadmapPhases parses phase headers and dependencies', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  const sample = [
    '### Phase v0.30-01: Dynamic Model Selection',
    '**Depends on**: (none)',
    '### Phase v0.30-02: File-Based State',
    '**Depends on**: v0.30-01',
  ].join('\n');
  const phases = mod._pure.parseRoadmapPhases(sample);
  assert.ok(Array.isArray(phases), 'parseRoadmapPhases must return an array');
  assert.equal(phases.length, 2, 'should parse 2 phases');
  assert.deepStrictEqual(phases[1].dependsOn, ['v0.30-01'], 'phase 2 should depend on v0.30-01');
});

test('SIG-02 — structural: computeCriticalPath returns path and length', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  const phases = [
    { number: 'v0.30-01', name: 'A', dependsOn: [], completed: false },
    { number: 'v0.30-02', name: 'B', dependsOn: ['v0.30-01'], completed: false },
  ];
  const result = mod._pure.computeCriticalPath(phases);
  assert.ok(Array.isArray(result.path), 'criticalPath must have path array');
  assert.equal(typeof result.length, 'number', 'criticalPath must have numeric length');
  assert.equal(result.length, 2, 'critical path through 2 dependent phases should have length 2');
});

test('SIG-02 — structural: buildRoadmapDot produces valid DOT output', () => {
  const mod = require(path.join(ROOT, 'bin', 'generate-petri-net.cjs'));
  const phases = [
    { number: 'v0.30-01', name: 'Test', dependsOn: [], completed: true },
  ];
  const dot = mod._pure.buildRoadmapDot(phases);
  assert.ok(dot.includes('digraph'), 'DOT output must contain digraph declaration');
  assert.ok(dot.includes('roadmap'), 'DOT output must reference roadmap');
});
