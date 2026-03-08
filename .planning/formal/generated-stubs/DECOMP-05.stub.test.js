#!/usr/bin/env node
// @requirement DECOMP-05
// Structural test: analyze-state-space.cjs identifies cross-model pairs, estimates merged
// state-space, and recommends merge or interface-contract within a 5-minute TLC budget

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/analyze-state-space.cjs');

test('DECOMP-05: analyze-state-space.cjs contains cross-model pair detection', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must have findCandidatePairs function for detecting shared source files / requirement prefixes
  assert.match(content, /function\s+findCandidatePairs/, 'should define findCandidatePairs');

  // Must have extractRequirementPrefixes for detecting shared requirement prefixes
  assert.match(content, /function\s+extractRequirementPrefixes/, 'should define extractRequirementPrefixes');

  // Must detect shared source files between model pairs
  assert.match(content, /shared_source_files/, 'should track shared_source_files');

  // Must detect shared requirement prefixes between model pairs
  assert.match(content, /shared_requirement_prefixes/, 'should track shared_requirement_prefixes');
});

test('DECOMP-05: analyze-state-space.cjs estimates merged state-space', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must have estimateMergedStateSpace function
  assert.match(content, /function\s+estimateMergedStateSpace/, 'should define estimateMergedStateSpace');

  // Merged estimate is product of individual state-spaces
  assert.match(content, /estimated_states\s*\*\s*.*estimated_states/, 'should multiply individual state-spaces');
});

test('DECOMP-05: analyze-state-space.cjs recommends merge or interface-contract', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must have classifyPair function
  assert.match(content, /function\s+classifyPair/, 'should define classifyPair');

  // Must have a merge budget based on 5-minute TLC runtime
  assert.match(content, /max_tlc_seconds:\s*300/, 'should have 5-minute (300s) TLC budget');

  // Must recommend 'merge' when under budget
  assert.match(content, /recommendation.*merge/, 'should recommend merge when within budget');

  // Must recommend 'interface-contract' when over budget
  assert.match(content, /interface-contract/, 'should recommend interface-contract when exceeding budget');
});

test('DECOMP-05: analyzeCrossModel orchestrates the full cross-model analysis', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');

  // Must have analyzeCrossModel function that ties it all together
  assert.match(content, /function\s+analyzeCrossModel/, 'should define analyzeCrossModel');

  // Must produce a summary with merge_recommended and interface_contract_needed counts
  assert.match(content, /merge_recommended/, 'should count merge_recommended');
  assert.match(content, /interface_contract_needed/, 'should count interface_contract_needed');
});
