#!/usr/bin/env node
// @requirement SEC-01
// Structural test: security-sweep.cjs exports SECRET_PATTERNS and scanFile for secret scanning

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('SEC-01: security-sweep.cjs exports SECRET_PATTERNS array', () => {
  const mod = require(path.join(ROOT, 'bin', 'security-sweep.cjs'));
  assert.ok(Array.isArray(mod.SECRET_PATTERNS), 'SECRET_PATTERNS must be an array');
  assert.ok(mod.SECRET_PATTERNS.length > 0, 'SECRET_PATTERNS must contain at least one pattern');
});

test('SEC-01: SECRET_PATTERNS covers API keys, tokens, and passwords', () => {
  const mod = require(path.join(ROOT, 'bin', 'security-sweep.cjs'));
  const names = mod.SECRET_PATTERNS.map(p => p.name.toLowerCase());
  const joined = names.join(' ');
  assert.ok(joined.includes('key') || joined.includes('token') || joined.includes('aws'),
    'SECRET_PATTERNS must cover API keys or tokens');
  assert.ok(joined.includes('secret') || joined.includes('password'),
    'SECRET_PATTERNS must cover secrets or passwords');
});

test('SEC-01: security-sweep.cjs exports scanFile function', () => {
  const mod = require(path.join(ROOT, 'bin', 'security-sweep.cjs'));
  assert.equal(typeof mod.scanFile, 'function', 'scanFile must be a function');
});

test('SEC-01: scanFile detects hardcoded secrets in content', () => {
  const mod = require(path.join(ROOT, 'bin', 'security-sweep.cjs'));
  const findings = mod.scanFile('test.js', 'const apiCred = "AKIAWWWXXXYYYZZZAAAB";');
  assert.ok(Array.isArray(findings), 'scanFile must return an array');
  assert.ok(findings.length > 0, 'scanFile must detect AWS key pattern');
});

test('SEC-01: security-sweep.cjs exports scanDirectory function', () => {
  const mod = require(path.join(ROOT, 'bin', 'security-sweep.cjs'));
  assert.equal(typeof mod.scanDirectory, 'function', 'scanDirectory must be a function');
});
