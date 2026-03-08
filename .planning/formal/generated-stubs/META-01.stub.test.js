#!/usr/bin/env node
// @requirement META-01
// Structural test: QuorumFirst fact in architecture-registry.als ensures
// planning questions are auto-resolved via quorum before escalating to user

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('META-01: QuorumFirst fact defined in architecture-registry.als', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  // Must define the QuorumFirst fact
  assert.match(content, /fact\s+QuorumFirst\s*\{/,
    'QuorumFirst fact must be defined');
  // The fact must constrain presentedToUser => quorumResolved = False
  assert.match(content, /presentedToUser\s*=\s*True\s+implies\s+.*quorumResolved\s*=\s*False/,
    'QuorumFirst must enforce quorum-first resolution');
  // Must be tagged
  assert.match(content, /@requirement\s+META-01/,
    'QuorumFirst must be tagged with @requirement META-01');
});

test('META-01: PlanningQuestion sig has quorumResolved field', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  assert.match(content, /sig\s+PlanningQuestion\s*\{[^}]*quorumResolved/s,
    'PlanningQuestion sig must have quorumResolved field');
});
