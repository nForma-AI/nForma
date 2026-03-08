#!/usr/bin/env node
// @requirement CRED-12
// Structural test: CRED-12 — P=? [ F s=1 ]
// Verifies credential management modules have requirement annotations and test tracing

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('CRED-12: requirement-map.cjs maps prism:oauth-rotation to include CRED-12', () => {
  const mod = require(path.join(ROOT, 'bin', 'requirement-map.cjs'));
  const ids = mod.CHECK_ID_TO_REQUIREMENTS['prism:oauth-rotation'];
  assert.ok(Array.isArray(ids), 'prism:oauth-rotation mapping should exist');
  assert.ok(ids.includes('CRED-12'), 'CRED-12 should be in prism:oauth-rotation mapping');
});

test('CRED-12: nForma.cjs has @requirement CRED annotation for traceability', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(content, /CRED-01/, 'nForma.cjs should have CRED requirement annotation');
});

test('CRED-12: formal oauth-rotation.props model file exists', () => {
  const propsPath = path.join(ROOT, '.planning', 'formal', 'prism', 'oauth-rotation.props');
  assert.ok(fs.existsSync(propsPath), 'oauth-rotation.props should exist in formal/prism/');
});
