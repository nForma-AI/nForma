#!/usr/bin/env node
// @requirement UPS-04
// Test: Injected context names the exact MCP tools to call and instructs Claude to present
//       model responses before delivering final output
// Strategy: structural — verify nf-prompt.js contains tool call patterns and presentation instruction

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NF_PROMPT = path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'nf-prompt.js');

test('UPS-04: injected instructions name exact MCP tool call pattern (mcp__*)', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // The dynamic step generation uses slotToToolCall which produces mcp__<slot>__<suffix>
  // and the fallback instructions contain literal mcp__ tool references
  assert.match(content, /mcp__/, 'injected context must reference mcp__ tool call pattern');
  // Verify the slot-worker dispatch pattern is present (Task subagent for quorum)
  assert.match(content, /nf-quorum-slot-worker/, 'instructions must name the quorum slot worker dispatch');
});

test('UPS-04: injected instructions include presentation directive (GSD_DECISION token)', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // The instructions require <!-- GSD_DECISION --> token in final output
  assert.match(content, /GSD_DECISION/, 'instructions must include GSD_DECISION presentation token');
  // Instructions mention synthesizing results
  assert.match(content, /[Ss]ynthesize results/, 'instructions must direct Claude to synthesize/present model responses');
});

test('UPS-04: slotToToolCall helper produces correct mcp__ format', () => {
  const { slotToToolCall } = require(path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'config-loader.js'));
  assert.equal(slotToToolCall('codex-1'), 'mcp__codex-1__review');
  assert.equal(slotToToolCall('gemini-1'), 'mcp__gemini-1__gemini');
  assert.equal(slotToToolCall('opencode-1'), 'mcp__opencode-1__opencode');
  assert.equal(slotToToolCall('copilot-1'), 'mcp__copilot-1__ask');
  assert.equal(slotToToolCall('claude-1'), 'mcp__claude-1__claude');
});
