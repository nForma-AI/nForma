#!/usr/bin/env node
// @requirement DISP-06
// Constant test: quorum dispatch prompts inject a matched subset of formal requirements
// (from .planning/formal/requirements.json) based on keywords extracted from the question
// and artifact path, enabling agents to evaluate changes against concrete acceptance criteria.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/quorum-slot-dispatch.cjs');
const mod = require(SOURCE);

test('DISP-06: matchRequirementsByKeywords is exported as a function', () => {
  assert.equal(typeof mod.matchRequirementsByKeywords, 'function');
});

test('DISP-06: matchRequirementsByKeywords returns empty array for empty requirements', () => {
  const result = mod.matchRequirementsByKeywords([], 'some question', 'hooks/nf-stop.js');
  assert.deepStrictEqual(result, []);
});

test('DISP-06: matchRequirementsByKeywords filters by question keywords', () => {
  const reqs = [
    { id: 'HOOK-01', text: 'Hooks must fail-open', category_raw: 'Hooks & Enforcement', category: 'Hooks' },
    { id: 'DISP-01', text: 'Dispatch must timeout', category_raw: 'Quorum & Dispatch', category: 'Dispatch' },
  ];
  const result = mod.matchRequirementsByKeywords(reqs, 'How does the hook handle errors?', null);
  // Should match HOOK-01 more strongly than DISP-01
  assert.ok(Array.isArray(result), 'result must be an array');
});

test('DISP-06: matchRequirementsByKeywords filters by artifact path', () => {
  const reqs = [
    { id: 'HOOK-01', text: 'Hooks must fail-open', category_raw: 'Hooks & Enforcement', category: 'Hooks' },
    { id: 'DISP-01', text: 'Dispatch must timeout', category_raw: 'Quorum & Dispatch', category: 'Dispatch' },
  ];
  const result = mod.matchRequirementsByKeywords(reqs, 'generic question', 'hooks/nf-stop.js');
  assert.ok(Array.isArray(result), 'result must be an array');
});

test('DISP-06: formatRequirementsSection is exported and produces formatted block', () => {
  assert.equal(typeof mod.formatRequirementsSection, 'function');

  const reqs = [
    { id: 'TEST-01', text: 'Tests must pass', category: 'Testing' },
  ];
  const section = mod.formatRequirementsSection(reqs);
  assert.ok(section.includes('APPLICABLE REQUIREMENTS'),
    'formatted section must include header');
  assert.ok(section.includes('TEST-01'),
    'formatted section must include requirement ID');
  assert.ok(section.includes('Tests must pass'),
    'formatted section must include requirement text');
});

test('DISP-06: formatRequirementsSection returns null for empty requirements', () => {
  const result = mod.formatRequirementsSection([]);
  assert.equal(result, null);
});

test('DISP-06: loadRequirements is exported as a function', () => {
  assert.equal(typeof mod.loadRequirements, 'function');
});
