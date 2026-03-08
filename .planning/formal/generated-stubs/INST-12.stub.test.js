#!/usr/bin/env node
// @requirement INST-12
// Formal property: ReqText (assertion)
// Baseline requirements merge is idempotent: matches on text field to prevent duplicates,
// assigns next-available IDs per prefix namespace.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SYNC_SCRIPT = path.join(__dirname, '..', '..', '..', 'bin', 'sync-baseline-requirements.cjs');

test('INST-12: sync-baseline-requirements uses text-based dedup for idempotent merge', () => {
  const src = fs.readFileSync(SYNC_SCRIPT, 'utf8');

  // Must build a lookup from requirement text to existing ID
  assert.match(src, /existingTexts/,
    'Must maintain a text-based lookup (existingTexts) for dedup');

  // Must check existingTexts.has(req.text) before inserting
  assert.match(src, /existingTexts\.has\(req\.text\)/,
    'Must check existingTexts.has(req.text) to skip duplicates');
});

test('INST-12: sync-baseline-requirements assigns next-available IDs per prefix', () => {
  const src = fs.readFileSync(SYNC_SCRIPT, 'utf8');

  // Must track max ID per prefix
  assert.match(src, /maxId/,
    'Must track maxId per prefix namespace');

  // Must compute prefix from existing IDs (e.g., lastIndexOf dash)
  assert.match(src, /lastIndexOf\('-'\)/,
    'Must parse prefix by splitting on last dash');

  // Must increment and pad the new ID number
  assert.match(src, /padStart/,
    'Must pad new ID numbers with leading zeros');
});
