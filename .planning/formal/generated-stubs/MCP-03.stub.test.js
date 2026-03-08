#!/usr/bin/env node
// @requirement MCP-03
// Structural test: detected MCP names are written to nf.json as required_models on install

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const installPath = path.resolve(__dirname, '../../../bin/install.js');

test('MCP-03: install.js writes detected names as required_models to nf.json', () => {
  const content = fs.readFileSync(installPath, 'utf8');

  // buildRequiredModelsFromMcp function must exist — it produces the required_models object
  assert.match(content, /function\s+buildRequiredModelsFromMcp\s*\(/,
    'install.js must define buildRequiredModelsFromMcp');

  // The function must populate required_models with tool_prefix from detection
  assert.match(content, /requiredModels\[modelKey\]\s*=\s*\{\s*tool_prefix:/,
    'buildRequiredModelsFromMcp must assign tool_prefix to each detected model');

  // The result must be written to nf.json config as required_models
  assert.match(content, /required_models:\s*detectedModels/,
    'install.js must write required_models to nf.json config');
});
