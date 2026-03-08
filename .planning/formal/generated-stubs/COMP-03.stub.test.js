#!/usr/bin/env node
// @requirement COMP-03
// Structural test: check-provider-health.cjs derives agent list from quorum_active, not hardcoded arrays

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('COMP-03 — check-provider-health.cjs reads quorum_active from nf.json config', () => {
  const content = fs.readFileSync('/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs', 'utf8');

  // Must load quorum_active from nf.json config file
  assert.match(content, /quorum_active/, 'Should reference quorum_active config key');
  assert.match(content, /nf\.json/, 'Should read from nf.json config file');

  // Must filter mcpServers by quorum_active (dynamic, not hardcoded)
  assert.match(content, /quorumActive/, 'Should use quorumActive variable for filtering');
  assert.match(content, /activeMcpServers/, 'Should derive activeMcpServers from quorum_active');

  // Must NOT hardcode specific agent/slot names for the active list
  // The pattern: filter mcpServers entries by quorumActive array
  assert.match(content, /\.filter/, 'Should filter servers dynamically using quorum_active');
});
