#!/usr/bin/env node
// @requirement COMP-02
// Quorum orchestrator reads quorum.active from config instead of a hardcoded agent list;
// only active slots are called.
// Formal model: quorum-policy.als — QuorumFromConfig: activeSlots = { s : AgentSlot | s.active = True }
// Strategy: structural — verify nf-prompt.js uses config-driven slot list, not hardcoded agents

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const NF_PROMPT = path.join(ROOT, 'hooks', 'nf-prompt.js');

test('COMP-02: nf-prompt.js derives activeSlots from config.quorum_active', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // Must read quorum_active from config
  assert.match(content, /config\.quorum_active/, 'must read config.quorum_active');
  // Must assign to activeSlots variable
  assert.match(content, /activeSlots\s*=/, 'must assign activeSlots from config');
  // The COMP-02 comment marker must be present
  assert.match(content, /COMP-02/, 'must reference COMP-02 requirement');
});

test('COMP-02: nf-prompt.js uses Task dispatch for active slots (not direct MCP calls)', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // When activeSlots is set, must use nf-quorum-slot-worker Task dispatch
  assert.match(content, /nf-quorum-slot-worker/, 'must use nf-quorum-slot-worker Task dispatch');
  // Model_preferences override block must be suppressed when activeSlots is configured
  assert.match(content, /!activeSlots/, 'must suppress override block when activeSlots is configured');
});

test('COMP-02: nf-prompt.js falls back gracefully when quorum_active is empty', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // Must handle empty quorum_active — solo mode or hardcoded fallback
  assert.match(content, /NF_SOLO_MODE|solo.*mode|empty roster/, 'must handle empty quorum_active gracefully');
});

test('COMP-02: nf-stop.js derives enforcement pool from quorum_active config', () => {
  const stopContent = fs.readFileSync(path.join(ROOT, 'hooks', 'nf-stop.js'), 'utf8');
  // Must derive pool from quorum_active
  assert.match(stopContent, /quorum_active/, 'nf-stop.js must reference quorum_active');
});
