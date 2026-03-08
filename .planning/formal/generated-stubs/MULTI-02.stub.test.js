#!/usr/bin/env node
// @requirement MULTI-02
// Structural test: User can have multiple copilot-N, opencode-N, codex-cli-N,
// and gemini-cli-N slots as separate ~/.claude.json entries

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROVIDERS_PATH = path.resolve(__dirname, '../../../bin/providers.json');

test('MULTI-02 — providers.json contains copilot-N slots', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);
  const slots = providers.filter(p => /^copilot-\d+$/.test(p.name));
  assert.ok(slots.length >= 1,
    `Expected at least one copilot-N slot, found ${slots.length}`);
});

test('MULTI-02 — providers.json contains opencode-N slots', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);
  const slots = providers.filter(p => /^opencode-\d+$/.test(p.name));
  assert.ok(slots.length >= 1,
    `Expected at least one opencode-N slot, found ${slots.length}`);
});

test('MULTI-02 — providers.json contains codex-N slots (codex-cli family)', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);
  // Codex slots use name "codex-N" with display_type "codex-cli"
  const slots = providers.filter(p => /^codex-\d+$/.test(p.name));
  assert.ok(slots.length >= 1,
    `Expected at least one codex-N slot, found ${slots.length}`);
});

test('MULTI-02 — providers.json contains gemini-N slots (gemini-cli family)', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);
  // Gemini slots use name "gemini-N" with display_type "gemini-cli"
  const slots = providers.filter(p => /^gemini-\d+$/.test(p.name));
  assert.ok(slots.length >= 1,
    `Expected at least one gemini-N slot, found ${slots.length}`);
});

test('MULTI-02 — each slot family supports multiple instances (N > 1 for at least codex or gemini)', () => {
  const raw = fs.readFileSync(PROVIDERS_PATH, 'utf8');
  const { providers } = JSON.parse(raw);

  const codexSlots = providers.filter(p => /^codex-\d+$/.test(p.name));
  const geminiSlots = providers.filter(p => /^gemini-\d+$/.test(p.name));

  // At least one family must have multiple slots to prove multi-slot support
  const hasMulti = codexSlots.length > 1 || geminiSlots.length > 1;
  assert.ok(hasMulti,
    `Expected at least one family with multiple slots (codex: ${codexSlots.length}, gemini: ${geminiSlots.length})`);
});
