#!/usr/bin/env node
// @requirement META-02
// Structural test: OnlyFailedEscalated fact and EscalationOnlyOnFail assertion
// in architecture-registry.als ensure only quorum-failed questions reach user

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('META-02: OnlyFailedEscalated fact defined in architecture-registry.als', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  // Must define the OnlyFailedEscalated fact
  assert.match(content, /fact\s+OnlyFailedEscalated\s*\{/,
    'OnlyFailedEscalated fact must be defined');
  // The fact uses iff (biconditional)
  assert.match(content, /presentedToUser\s*=\s*True\s+iff\s+.*quorumResolved\s*=\s*False/,
    'OnlyFailedEscalated must use iff to enforce bidirectional constraint');
});

test('META-02: EscalationOnlyOnFail assertion checked in architecture-registry.als', () => {
  const alsPath = path.join(ROOT, '.planning', 'formal', 'alloy', 'architecture-registry.als');
  const content = fs.readFileSync(alsPath, 'utf8');
  assert.match(content, /assert\s+EscalationOnlyOnFail\s*\{/,
    'EscalationOnlyOnFail assertion must be defined');
  assert.match(content, /check\s+EscalationOnlyOnFail/,
    'EscalationOnlyOnFail assertion must be checked');
  assert.match(content, /@requirement\s+META-02/,
    'Must be tagged with @requirement META-02');
});
