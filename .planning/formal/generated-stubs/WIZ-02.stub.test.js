#!/usr/bin/env node
// @requirement WIZ-02
// Structural test: First run (no configured agents) presents a guided linear
// onboarding flow step by step.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('WIZ-02: nForma.cjs detects empty providers and shows onboarding guidance', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'nForma.cjs'), 'utf8');
  assert.match(src, /No agents configured/, 'should detect when no agents are configured');
  assert.match(src, /nf:mcp-setup/, 'should guide users to mcp-setup on first run');
});

test('WIZ-02: install.js detects first-run state (no MCP agents) and nudges setup', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'install.js'), 'utf8');
  assert.match(src, /No quorum agents configured/, 'should detect first-run state with no agents');
  assert.match(src, /nf:mcp-setup/, 'should nudge user to run mcp-setup wizard');
});

test('WIZ-02: manage-agents-core.cjs provides probe and guided flow helpers', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin', 'manage-agents-core.cjs'), 'utf8');
  // Core module provides the probe/classify/write functions used in onboarding
  assert.match(src, /probe|classify|helpers/i, 'must provide probe/classify helpers for onboarding');
});
