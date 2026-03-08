#!/usr/bin/env node
// @requirement LOOP-02
// Test: PostToolUse hook nf-spec-regen.js auto-regenerates TLA+/Alloy specs on XState machine changes
// Formal property: TotalRoundsBounded (NFDeliberation.tla) — structural verification

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const HOOK_PATH = path.join(PROJECT_ROOT, 'hooks', 'nf-spec-regen.js');

test('LOOP-02: nf-spec-regen.js hook file exists', () => {
  assert.ok(fs.existsSync(HOOK_PATH), 'hooks/nf-spec-regen.js must exist');
});

test('LOOP-02: nf-spec-regen.js triggers on nf-workflow.machine.ts writes', () => {
  const content = fs.readFileSync(HOOK_PATH, 'utf8');
  assert.match(content, /nf-workflow\.machine\.ts/, 'hook must match nf-workflow.machine.ts file writes');
});

test('LOOP-02: nf-spec-regen.js invokes generate-formal-specs.cjs', () => {
  const content = fs.readFileSync(HOOK_PATH, 'utf8');
  assert.match(content, /generate-formal-specs\.cjs/, 'hook must call generate-formal-specs.cjs to regenerate specs');
});

test('LOOP-02: nf-spec-regen.js invokes xstate-to-tla.cjs for TLA+ regeneration', () => {
  const content = fs.readFileSync(HOOK_PATH, 'utf8');
  assert.match(content, /xstate-to-tla\.cjs/, 'hook must call xstate-to-tla.cjs for TLA+ spec regeneration');
});

test('LOOP-02: nf-spec-regen.js uses fail-open pattern (exits 0)', () => {
  const content = fs.readFileSync(HOOK_PATH, 'utf8');
  assert.match(content, /process\.exit\(0\)/, 'hook must use fail-open pattern with exit(0)');
});

test('LOOP-02: TotalRoundsBounded invariant defined in NFDeliberation.tla', () => {
  const tlaPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'tla', 'NFDeliberation.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /TotalRoundsBounded\s*==/, 'TotalRoundsBounded invariant must be defined in NFDeliberation.tla');
  assert.match(content, /@requirement LOOP-02/, 'TotalRoundsBounded must be tagged with @requirement LOOP-02');
});
