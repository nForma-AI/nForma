#!/usr/bin/env node
// @requirement ORES-02
// Structural test: Oscillation resolution mode presents oscillation evidence (file set,
// commit graph) to all available quorum models with structural-coupling framing.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('ORES-02: resolution mode references oscillating file set identification', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // The fallback context instructs identifying the oscillating file set
  assert.match(content, /oscillating file set/, 'should reference oscillating file set');
  // Instructs examining commit graph via git log --name-only
  assert.match(content, /git log --oneline --name-only/, 'should instruct examining commit graph');
});

test('ORES-02: resolution mode uses structural coupling framing for quorum', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // Quorum diagnosis with structural coupling framing
  assert.match(content, /quorum/, 'should reference quorum for multi-model review');
  assert.match(content, /structural.coupling/, 'should use structural coupling framing');
});

test('ORES-02: resolution mode presents evidence before requesting action', () => {
  const content = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-prompt.js'), 'utf8');
  // Evidence gathering (git log) comes before solution presentation
  const gitLogIndex = content.indexOf('git log');
  const solutionIndex = content.indexOf('unified solution');
  assert.ok(gitLogIndex > 0, 'should contain git log instruction');
  assert.ok(solutionIndex > 0, 'should contain unified solution step');
  assert.ok(gitLogIndex < solutionIndex, 'evidence gathering (git log) should come before solution presentation');
});
