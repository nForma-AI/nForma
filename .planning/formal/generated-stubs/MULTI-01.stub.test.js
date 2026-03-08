#!/usr/bin/env node
// @requirement MULTI-01
// Structural test: User can have multiple claude-* slots (claude-1 through claude-N)
// each running a different model or provider

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_PATH = path.resolve(__dirname, '../../../bin/providers.json');

test('MULTI-01 — providers.json contains multiple claude-N slots', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);

  // Filter claude-* slots
  const claudeSlots = providers.filter(p => /^claude-\d+$/.test(p.name));

  // Must have more than 1 claude slot
  assert.ok(claudeSlots.length > 1,
    `Expected multiple claude-N slots, found ${claudeSlots.length}`);
});

test('MULTI-01 — claude-N slots use different models or providers', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);

  const claudeSlots = providers.filter(p => /^claude-\d+$/.test(p.name));

  // Collect unique (provider, model) pairs
  const combos = new Set(claudeSlots.map(p => `${p.provider}::${p.model}`));

  // At least 2 distinct provider/model combinations
  assert.ok(combos.size > 1,
    `Expected different models/providers across claude slots, found ${combos.size} unique combos`);
});

test('MULTI-01 — claude-N slot names follow sequential numbering pattern', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);

  const claudeSlots = providers.filter(p => /^claude-\d+$/.test(p.name));
  const nums = claudeSlots.map(p => parseInt(p.name.split('-')[1], 10)).sort((a, b) => a - b);

  // Must start at 1 and be sequential
  assert.equal(nums[0], 1, 'claude slots should start at claude-1');
  for (let i = 1; i < nums.length; i++) {
    assert.equal(nums[i], nums[i - 1] + 1,
      `Gap in claude slot numbering at claude-${nums[i]}`);
  }
});
