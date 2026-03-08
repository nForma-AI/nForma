#!/usr/bin/env node
// @requirement SPEC-01
// Structural test: verify NFStopHook.tla defines SafetyInvariant1 and
// run-stop-hook-tlc.cjs references the correct TLA+ config.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');

test('SPEC-01: NFStopHook.tla exists and defines SafetyInvariant1', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'NFStopHook.tla');
  assert.ok(fs.existsSync(tlaPath), 'NFStopHook.tla must exist');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /SafetyInvariant1\s*==/, 'must define SafetyInvariant1');
});

test('SPEC-01: NFStopHook.tla SafetyInvariant1 encodes BLOCK => hasCommand', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'NFStopHook.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  // SafetyInvariant1 == decision = "BLOCK" => hasCommand
  assert.match(content, /decision\s*=\s*"BLOCK"\s*=>\s*hasCommand/, 'SafetyInvariant1 must encode BLOCK => hasCommand');
});

test('SPEC-01: NFStopHook.tla defines all three safety invariants', () => {
  const tlaPath = path.join(ROOT, '.planning', 'formal', 'tla', 'NFStopHook.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /SafetyInvariant1/, 'must define SafetyInvariant1');
  assert.match(content, /SafetyInvariant2/, 'must define SafetyInvariant2');
  assert.match(content, /SafetyInvariant3/, 'must define SafetyInvariant3');
});

test('SPEC-01: run-stop-hook-tlc.cjs exists and references MCStopHook config', () => {
  const srcPath = path.join(ROOT, 'bin', 'run-stop-hook-tlc.cjs');
  assert.ok(fs.existsSync(srcPath), 'run-stop-hook-tlc.cjs must exist');
  const content = fs.readFileSync(srcPath, 'utf8');
  assert.match(content, /MCStopHook/, 'must reference MCStopHook config');
  assert.match(content, /SPEC-01/, 'must reference SPEC-01 requirement');
});
