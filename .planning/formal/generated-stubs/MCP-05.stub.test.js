#!/usr/bin/env node
// @requirement MCP-05
// Structural test: user can manually edit nf.json to override detected names

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installPath = path.resolve(__dirname, '../../../bin/install.js');

test('MCP-05: install.js preserves existing nf.json user config on reinstall', () => {
  const content = fs.readFileSync(installPath, 'utf8');

  // On reinstall, existing config is read and preserved (not overwritten)
  assert.match(content, /nf\.json already exists.*user config preserved/,
    'install.js must skip overwriting nf.json when it already exists');

  // The existingConfig is read from disk — user edits are honored
  assert.match(content, /existingConfig\s*=\s*JSON\.parse\(fs\.readFileSync\(nfConfigPath/,
    'install.js must read existing nf.json config from disk');

  // required_models from existing config is used (not regenerated)
  assert.match(content, /existingConfig\.required_models/,
    'install.js must reference required_models from existing user config');
});
