#!/usr/bin/env node
// @requirement UPS-03
// Test: UserPromptSubmit hook injects quorum instructions via additionalContext (not systemMessage)
// Strategy: structural — verify nf-prompt.js uses additionalContext for quorum injection

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const NF_PROMPT = path.resolve(__dirname, '..', '..', '..', 'hooks', 'dist', 'nf-prompt.js');

test('UPS-03: nf-prompt.js injects quorum via hookSpecificOutput.additionalContext', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // Must use additionalContext for quorum injection
  assert.match(content, /additionalContext:\s*instructions/, 'quorum instructions must be injected via additionalContext');
  assert.match(content, /hookSpecificOutput/, 'must use hookSpecificOutput object');
});

test('UPS-03: nf-prompt.js does not use systemMessage for quorum injection', () => {
  const content = fs.readFileSync(NF_PROMPT, 'utf8');
  // The source should not set systemMessage for quorum (it may mention it in comments)
  // Check that no JSON output assigns systemMessage
  const lines = content.split('\n');
  const codeLines = lines.filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
  const codeContent = codeLines.join('\n');
  // systemMessage should not appear as a key in the JSON output objects
  assert.ok(!codeContent.includes('systemMessage:'), 'quorum injection must not use systemMessage key in output');
});
