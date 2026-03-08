#!/usr/bin/env node
// @requirement REN-03
// Structural: no hardcoded get-shit-done/ path strings in key files

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// REN-03: All hardcoded `get-shit-done/` path strings removed from gsd-tools.cjs,
// workflow files, agent files, and template files.
// Structural strategy: scan each target file for the forbidden path pattern.

test('REN-03: core/bin/gsd-tools.cjs has no get-shit-done/ path strings', () => {
  const content = fs.readFileSync(path.join(ROOT, 'core/bin/gsd-tools.cjs'), 'utf8');
  assert.doesNotMatch(content, /get-shit-done\/(?!.*migration|.*warn|.*OLD_HOOK|.*comment)/,
    'gsd-tools.cjs must not contain hardcoded get-shit-done/ paths (excluding migration comments)');
});

test('REN-03: workflow files have no get-shit-done/ path strings', () => {
  const workflowDir = path.join(ROOT, 'core/workflows');
  if (!fs.existsSync(workflowDir)) return; // skip if dir missing
  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.md') || f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    assert.doesNotMatch(content, /['"`].*get-shit-done\/.*['"`]/,
      `workflow/${file} must not contain hardcoded get-shit-done/ path strings`);
  }
});

test('REN-03: template files have no get-shit-done/ path strings', () => {
  const templateDir = path.join(ROOT, 'core/templates');
  if (!fs.existsSync(templateDir)) return; // skip if dir missing
  const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.md') || f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(templateDir, file), 'utf8');
    assert.doesNotMatch(content, /['"`].*get-shit-done\/.*['"`]/,
      `template/${file} must not contain hardcoded get-shit-done/ path strings`);
  }
});

test('REN-03: bin/install.js uses get-shit-done/ only in migration context', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin/install.js'), 'utf8');
  // The only allowed occurrence is in the migration warning comment/logic
  const lines = content.split('\n');
  const gsdLines = lines.filter(l => l.includes('get-shit-done/'));
  for (const line of gsdLines) {
    assert.ok(
      /[Mm]igrat|[Ww]arn|OLD_HOOK|old|pre-v/.test(line),
      `install.js references get-shit-done/ outside migration context: ${line.trim()}`
    );
  }
});
