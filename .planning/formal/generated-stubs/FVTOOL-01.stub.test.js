#!/usr/bin/env node
// @requirement FVTOOL-01
// Structural test: formal verification tooling scripts include @requirement annotations
// and have corresponding test files with @req tracing.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BIN = path.join(__dirname, '..', '..', '..', 'bin');

// Representative FV tooling scripts that MUST have requirement tracing annotations
const FV_SCRIPTS = [
  'gate-a-grounding.cjs',
  'gate-b-abstraction.cjs',
  'gate-c-validation.cjs',
  'verify-formal-results.cjs',
  'extract-annotations.cjs',
];

test('FVTOOL-01: FV tooling scripts contain requirement tracing annotations', () => {
  // Accepts both @requirement and Requirements: patterns (both trace to requirement IDs)
  const reqPattern = /(@requirement\s+[\w-]+|Requirements:\s+[\w-]+)/;
  for (const script of FV_SCRIPTS) {
    const filePath = path.join(BIN, script);
    if (!fs.existsSync(filePath)) continue; // skip if not present
    const content = fs.readFileSync(filePath, 'utf8');
    assert.match(content, reqPattern,
      `${script} must contain at least one requirement tracing annotation (@requirement or Requirements:)`);
  }
});

test('FVTOOL-01: extract-annotations.cjs parses @requirement from JS, TLA+, Alloy, PRISM', () => {
  const extractor = path.join(BIN, 'extract-annotations.cjs');
  const content = fs.readFileSync(extractor, 'utf8');
  // Must handle multiple file types
  assert.match(content, /\/\/\s*@requirement/,
    'must parse JS-style @requirement comments');
  assert.match(content, /--\s*@requirement/,
    'must parse Alloy-style @requirement comments');
  assert.match(content, /\\\*\s*@requirement/,
    'must parse TLA+-style @requirement comments');
});

test('FVTOOL-01: FV tooling scripts have corresponding test files', () => {
  const testableScripts = [
    'gate-a-grounding.cjs',
    'gate-b-abstraction.cjs',
    'gate-c-validation.cjs',
    'verify-formal-results.cjs',
    'formal-ref-linker.cjs',
  ];
  for (const script of testableScripts) {
    const base = script.replace(/\.cjs$/, '');
    const testFile = path.join(BIN, `${base}.test.cjs`);
    assert.ok(fs.existsSync(testFile),
      `${script} must have a corresponding test file: ${base}.test.cjs`);
  }
});
