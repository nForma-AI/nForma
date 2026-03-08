#!/usr/bin/env node
// @requirement MCP-06
// Constant test: stop hook matches tool_use names by prefix via startsWith

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const stopHookPath = path.resolve(__dirname, '../../../hooks/nf-stop.js');

test('MCP-06: nf-stop.js matches tool_use names by prefix using startsWith', () => {
  const content = fs.readFileSync(stopHookPath, 'utf8');

  // The wasSlotCalled function uses startsWith for prefix matching
  assert.match(content, /block\.name\.startsWith\(prefix\)/,
    'nf-stop.js must use startsWith(prefix) for tool_use name matching');

  // wasSlotCalledSuccessfully also uses prefix matching
  assert.match(content, /function\s+wasSlotCalledSuccessfully\s*\(.*prefix\)/,
    'nf-stop.js must define wasSlotCalledSuccessfully with prefix parameter');

  // The prefix format is mcp__<name>__ (built from slot names)
  assert.match(content, /['"]mcp__['"]\s*\+\s*slot\s*\+\s*['"]__['"]/,
    'Prefix must be constructed as mcp__<slot>__');
});
