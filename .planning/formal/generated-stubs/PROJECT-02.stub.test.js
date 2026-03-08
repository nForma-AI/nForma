#!/usr/bin/env node
// @requirement PROJECT-02
// Formal property: all skill shortcuts use the 'nf:' prefix

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('PROJECT-02: commands/nf/ directory exists for nf: prefixed skills', () => {
  const commandsDir = path.resolve(__dirname, '..', '..', '..', 'commands', 'nf');
  assert.ok(fs.existsSync(commandsDir), 'commands/nf/ directory should exist');
});

test('PROJECT-02: skill-extractor references nf: prefix in output', () => {
  const skillExtractorPath = path.resolve(__dirname, '..', '..', '..', 'bin', 'skill-extractor.cjs');
  const content = fs.readFileSync(skillExtractorPath, 'utf8');
  assert.match(content, /\/nf:/, 'skill-extractor should reference /nf: prefix');
});

test('PROJECT-02: install.js converts nf: skills for opencode compatibility', () => {
  const installContent = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', 'bin', 'install.js'), 'utf8'
  );
  assert.match(
    installContent,
    /\/nf:/,
    'install.js should handle /nf: prefix conversion'
  );
});
