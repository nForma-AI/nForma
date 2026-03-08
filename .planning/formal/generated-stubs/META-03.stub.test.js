#!/usr/bin/env node
// @requirement META-03
// Structural test: ResolvedAreAssumptions fact in architecture-registry.als
// ensures auto-resolved questions are presented as assumptions (not escalated)

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('META-03: ResolvedAreAssumptions fact defined in architecture-registry.als', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  // Must define the ResolvedAreAssumptions fact
  assert.match(content, /fact\s+ResolvedAreAssumptions\s*\{/,
    'ResolvedAreAssumptions fact must be defined');
  // Resolved questions must not be presented to user
  assert.match(content, /quorumResolved\s*=\s*True\s+implies\s+.*presentedToUser\s*=\s*False/,
    'ResolvedAreAssumptions must enforce resolved => not presented');
  // Must be tagged
  assert.match(content, /@requirement\s+META-03/,
    'Must be tagged with @requirement META-03');
});

test('META-03: Alloy model contains both resolved and escalated question paths', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  // PlanningQuestion must model both states
  assert.match(content, /quorumResolved/, 'Model must track quorumResolved');
  assert.match(content, /presentedToUser/, 'Model must track presentedToUser');
});
