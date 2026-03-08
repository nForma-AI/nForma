#!/usr/bin/env node
// @requirement COMP-04
// Structural test: install.js auto-populates quorum_active from discovered slots in ~/.claude.json

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('COMP-04 — install.js has buildActiveSlots() that reads mcpServers from ~/.claude.json', () => {
  const content = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/install.js', 'utf8');

  // Must have buildActiveSlots function that discovers slots from ~/.claude.json
  assert.match(content, /buildActiveSlots/, 'Should define buildActiveSlots function');
  assert.match(content, /\.claude\.json/, 'Should read from ~/.claude.json');
  assert.match(content, /mcpServers/, 'Should extract slot names from mcpServers');

  // Must write quorum_active to nf.json during install
  assert.match(content, /quorum_active.*buildActiveSlots/, 'Should set quorum_active from buildActiveSlots');

  // Must backfill quorum_active if absent or empty on reinstall
  assert.match(content, /Backfill.*quorum_active|quorum_active.*length\s*===\s*0/, 'Should backfill quorum_active if empty');
});
