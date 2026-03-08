#!/usr/bin/env node
// @requirement SYNC-02
// Structural test: quorum_commands list exists in template config for GSD command tracking

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('SYNC-02: templates/nf.json has quorum_commands array', () => {
  const templatePath = path.resolve(__dirname, '../../../templates/nf.json');
  const config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  assert.ok(Array.isArray(config.quorum_commands),
    'Template config must have quorum_commands array');
  assert.ok(config.quorum_commands.length > 0,
    'quorum_commands must contain at least one GSD planning command');
});

test('SYNC-02: quorum_commands includes core GSD planning commands', () => {
  const templatePath = path.resolve(__dirname, '../../../templates/nf.json');
  const config = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  // Core GSD planning commands that must be gated
  const expectedCommands = ['plan-phase', 'new-project', 'new-milestone'];
  for (const cmd of expectedCommands) {
    assert.ok(config.quorum_commands.includes(cmd),
      `quorum_commands must include GSD command: ${cmd}`);
  }
});

test('SYNC-02: CHANGELOG documents quorum_commands update process', () => {
  const changelogPath = path.resolve(__dirname, '../../../CHANGELOG.md');
  const content = fs.readFileSync(changelogPath, 'utf8');
  assert.match(content, /quorum_commands/,
    'CHANGELOG must reference quorum_commands update process');
});
