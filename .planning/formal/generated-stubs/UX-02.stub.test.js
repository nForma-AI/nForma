#!/usr/bin/env node
// @requirement UX-02
// Structural test: destructive actions require explicit confirmation or provide undo.
// Verifies that nForma.cjs (the primary CLI with destructive actions) guards
// delete/remove operations behind a confirmation prompt before proceeding.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SOURCE = path.resolve(__dirname, '../../../bin/nForma.cjs');

test('UX-02: nForma.cjs destructive delete action is guarded by confirmation prompt', () => {
  const content = fs.readFileSync(SOURCE, 'utf8');
  // The delete flow must prompt the user with a confirm/cancel choice before proceeding
  assert.match(content, /Remove.*\?/, 'should present a "Remove ...?" confirmation prompt');
  assert.match(content, /confirm/, 'should check for confirmation value before executing delete');
  assert.match(content, /[Cc]ancelled/, 'should handle cancellation path when user declines');
});
