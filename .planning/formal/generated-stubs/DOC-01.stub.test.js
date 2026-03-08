#!/usr/bin/env node
// @requirement DOC-01
// Structural test: README.md capability claims (setup wizard, verification workflow,
// adaptive fan-out, model registry, branch config, CLI commands) SHALL be backed by
// traceable requirements in requirements.json.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const readmePath = path.join(ROOT, 'README.md');
const reqPath = path.join(ROOT, '.planning', 'formal', 'requirements.json');

const readme = fs.readFileSync(readmePath, 'utf8');
const reqData = JSON.parse(fs.readFileSync(reqPath, 'utf8'));
const requirements = Array.isArray(reqData.requirements) ? reqData.requirements : reqData;
const allReqText = requirements.map(r => (r.text || r.requirement_text || '').toLowerCase()).join(' ');
const allReqIds = requirements.map(r => (r.id || '')).join(' ');

test('DOC-01: README mentions quorum/consensus and requirements.json covers it', () => {
  assert.ok(readme.includes('quorum') || readme.includes('consensus'),
    'README must mention quorum or consensus');
  assert.ok(allReqText.includes('quorum') || allReqIds.includes('QUOR'),
    'requirements.json must have quorum-related requirements');
});

test('DOC-01: README mentions formal verification and requirements.json covers it', () => {
  assert.ok(readme.includes('Formal Verification') || readme.includes('formal verification'),
    'README must mention formal verification');
  assert.ok(allReqText.includes('formal') || allReqText.includes('verification') || allReqIds.includes('FV'),
    'requirements.json must have formal verification requirements');
});

test('DOC-01: README mentions CLI commands and requirements.json covers it', () => {
  assert.ok(readme.includes('/nf:'),
    'README must reference /nf: commands');
  assert.ok(allReqText.includes('command') || allReqText.includes('cli') || allReqText.includes('/nf:'),
    'requirements.json must have CLI/command requirements');
});

test('DOC-01: README mentions hooks and requirements.json covers it', () => {
  assert.ok(readme.includes('hook') || readme.includes('Hook'),
    'README must mention hooks');
  assert.ok(allReqText.includes('hook'),
    'requirements.json must have hook-related requirements');
});

test('DOC-01: requirements.json is a non-empty array', () => {
  assert.ok(requirements.length > 0,
    'requirements.json must contain at least one requirement');
});
