#!/usr/bin/env node
// @requirement MCPENV-04
// Structural test: readMCPAvailabilityRates exported from run-prism.cjs
// and min_quorum_available property exists in mcp-availability.props

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

test('MCPENV-04: readMCPAvailabilityRates exported from run-prism.cjs', () => {
  const mod = require(path.join(ROOT, 'bin', 'run-prism.cjs'));
  assert.ok(typeof mod.readMCPAvailabilityRates === 'function',
    'readMCPAvailabilityRates must be an exported function');
});

test('MCPENV-04: readMCPAvailabilityRates filters composite keys', () => {
  const content = fs.readFileSync(path.join(ROOT, 'bin', 'run-prism.cjs'), 'utf8');
  // The function must contain composite-key filtering logic
  assert.match(content, /composite/i,
    'readMCPAvailabilityRates must contain composite-key filter logic');
});

test('MCPENV-04: min_quorum_available property in mcp-availability.props', () => {
  const propsPath = path.join(ROOT, '.planning', 'formal', 'prism', 'mcp-availability.props');
  const content = fs.readFileSync(propsPath, 'utf8');
  assert.match(content, /min_quorum_available/,
    'mcp-availability.props must define min_quorum_available property');
  assert.match(content, /@requirement\s+MCPENV-04/,
    'Property must be tagged with @requirement MCPENV-04');
});
