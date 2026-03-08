#!/usr/bin/env node
// @requirement DISP-04
// Structural test: prompt construction (Mode A/B, Round 1/2+, artifact injection,
// prior_positions, review_context, improvements request) happens deterministically
// in JavaScript (quorum-slot-dispatch.cjs), not via LLM string manipulation.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../bin/quorum-slot-dispatch.cjs');
const content = fs.readFileSync(SOURCE, 'utf8');

test('DISP-04: quorum-slot-dispatch.cjs exports buildModeAPrompt', () => {
  assert.match(content, /function buildModeAPrompt/,
    'buildModeAPrompt must be defined as a JS function');
  assert.match(content, /buildModeAPrompt/,
    'buildModeAPrompt must be exported');
});

test('DISP-04: quorum-slot-dispatch.cjs exports buildModeBPrompt', () => {
  assert.match(content, /function buildModeBPrompt/,
    'buildModeBPrompt must be defined as a JS function');
  assert.match(content, /buildModeBPrompt/,
    'buildModeBPrompt must be exported');
});

test('DISP-04: buildModeAPrompt accepts round, priorPositions, reviewContext, requestImprovements', () => {
  // Verify the function signature includes the required parameters from DISP-04
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*round/,
    'buildModeAPrompt must accept round parameter');
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*priorPositions/,
    'buildModeAPrompt must accept priorPositions parameter');
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*reviewContext/,
    'buildModeAPrompt must accept reviewContext parameter');
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*requestImprovements/,
    'buildModeAPrompt must accept requestImprovements parameter');
});

test('DISP-04: buildModeAPrompt accepts artifactPath and requirements for injection', () => {
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*artifactPath/,
    'buildModeAPrompt must accept artifactPath for artifact injection');
  assert.match(content, /buildModeAPrompt\(\s*\{[^}]*requirements/,
    'buildModeAPrompt must accept requirements for formal context injection');
});

test('DISP-04: prompt functions are exported via module.exports', () => {
  assert.match(content, /module\.exports\s*=\s*\{[^}]*buildModeAPrompt/,
    'buildModeAPrompt must be in module.exports');
  assert.match(content, /module\.exports\s*=\s*\{[^}]*buildModeBPrompt/,
    'buildModeBPrompt must be in module.exports');
});
