#!/usr/bin/env node
// @requirement SPEC-06
// Verifies spec-quality-guardrails.als: no tautological assertions,
// bounded TLA+ domains, per-sig Alloy scopes (constant strategy).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ALLOY_SPEC = path.resolve(__dirname, '..', 'alloy', 'spec-quality-guardrails.als');

test('SPEC-06: Alloy spec contains NoTautologicalAssertions fact', () => {
  const content = fs.readFileSync(ALLOY_SPEC, 'utf8');
  assert.match(content, /fact\s+NoTautologicalAssertions/,
    'spec-quality-guardrails.als must define NoTautologicalAssertions fact');
});

test('SPEC-06: Alloy spec contains BoundedTypeOKDomains fact', () => {
  const content = fs.readFileSync(ALLOY_SPEC, 'utf8');
  assert.match(content, /fact\s+BoundedTypeOKDomains/,
    'spec-quality-guardrails.als must define BoundedTypeOKDomains fact');
});

test('SPEC-06: Alloy spec contains PerSigScopes fact', () => {
  const content = fs.readFileSync(ALLOY_SPEC, 'utf8');
  assert.match(content, /fact\s+PerSigScopes/,
    'spec-quality-guardrails.als must define PerSigScopes fact');
});

test('SPEC-06: Alloy check commands use per-sig scopes (not bare "for N")', () => {
  const content = fs.readFileSync(ALLOY_SPEC, 'utf8');
  const checkLines = content.split('\n').filter(l => l.startsWith('check '));
  assert.ok(checkLines.length >= 3, 'Must have at least 3 check commands');
  for (const line of checkLines) {
    assert.match(line, /\bbut\b/,
      `Check command must use per-sig scopes (but clause): ${line}`);
  }
});

test('SPEC-06: Bool sig exists as abstract with True/False extensions', () => {
  const content = fs.readFileSync(ALLOY_SPEC, 'utf8');
  assert.match(content, /abstract\s+sig\s+Bool/,
    'Bool must be abstract sig');
  assert.match(content, /one\s+sig\s+True,\s*False\s+extends\s+Bool/,
    'True and False must extend Bool');
});
