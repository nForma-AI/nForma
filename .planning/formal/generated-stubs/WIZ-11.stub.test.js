#!/usr/bin/env node
// @requirement WIZ-11
// Structural test: settings.md provides guided project manager hub with state-aware dashboard
// Formal property: SettingsHub (Alloy settings-hub.als)
// SettingsHub has: hasDashboard=True, showsMilestone=True, showsProgress=True, showsPhase=True
// assert DashboardAlwaysPresent { SettingsHub.hasDashboard = True }

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = path.resolve(__dirname, '../../../commands/nf/settings.md');

test('WIZ-11: settings.md exists and is readable', () => {
  assert.ok(fs.existsSync(SOURCE), 'commands/nf/settings.md must exist');
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.ok(content.length > 0, 'settings.md must not be empty');
});

test('WIZ-11: settings.md provides state-aware dashboard', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /dashboard/i, 'must reference dashboard');
  assert.match(content, /state[- ]aware/i, 'must be state-aware');
});

test('WIZ-11: settings.md dashboard shows milestone, progress, and phase', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /milestone/i, 'must show milestone');
  assert.match(content, /progress/i, 'must show progress');
  assert.match(content, /phase/i, 'must show phase');
});

test('WIZ-11: settings.md has categorized main menu with required categories', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  const categories = ['Continue Working', 'Project Management', 'Configuration', 'Quick Task'];
  for (const cat of categories) {
    assert.match(content, new RegExp(cat, 'i'),
      `must include menu category: ${cat}`);
  }
});

test('WIZ-11: settings.md is a valid nf: command', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  assert.match(content, /name:\s*nf:settings/, 'must declare as nf:settings command');
});
