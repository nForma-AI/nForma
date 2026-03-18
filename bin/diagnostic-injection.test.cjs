#!/usr/bin/env node
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  formatDiagnosticForPrompt,
  buildModeAPrompt,
  buildModeBPrompt
} = require('./quorum-slot-dispatch.cjs');

// ===== Test Fixtures =====

const mockDiagnostic = {
  mismatch_diff: '## State Divergence Report\n\n**Traces diverge at state 1**\n\n| Field | Trace A | Trace B |\n|-------|---------|----------|\n| x | `1` | `5` |\n',
  correction_proposals: [
    {
      type: 'add_state_variable',
      target: 'x',
      confidence: 0.9,
      reasoning: 'Field x diverges: model produces 1 but bug trace shows 5',
      example: 'VARIABLE x \\in Nat',
      priority: 1,
      effort: 'low'
    },
    {
      type: 'add_invariant',
      target: 'Inv_StateConstraint_1',
      confidence: 0.8,
      reasoning: 'Divergence at state 1: x:1->5',
      example: 'Inv_1 == pc = 1 => x = 5',
      priority: 2,
      effort: 'medium'
    }
  ],
  trace_alignment: {
    model_state_count: 2,
    bug_state_count: 2,
    first_divergence_index: 1,
    diverged_fields: ['x']
  }
};

// ===== Tests =====

test('formatDiagnosticForPrompt produces structured markdown from diagnostic JSON', () => {
  const result = formatDiagnosticForPrompt(mockDiagnostic);

  assert.ok(result.includes('## Model Diagnostic Feedback'), 'should have diagnostic header');
  assert.ok(result.includes('State Divergence Report'), 'should include mismatch diff');
  assert.ok(result.includes('add_state_variable'), 'should mention proposal type');
  assert.ok(result.includes('x'), 'should mention target field');
  assert.ok(result.includes('Model states: 2'), 'should include trace alignment info');
  assert.ok(result.includes('Diverged fields: x'), 'should list diverged fields');
});

test('formatDiagnosticForPrompt returns empty string for null input', () => {
  const result = formatDiagnosticForPrompt(null);
  assert.strictEqual(result, '');
});

test('formatDiagnosticForPrompt returns empty string for undefined input', () => {
  const result = formatDiagnosticForPrompt(undefined);
  assert.strictEqual(result, '');
});

test('formatDiagnosticForPrompt returns empty string for non-object input', () => {
  const result = formatDiagnosticForPrompt('string');
  assert.strictEqual(result, '');
});

test('formatDiagnosticForPrompt returns empty string for incomplete diagnostic structure', () => {
  const incompleteDiagnostic = {
    mismatch_diff: 'some diff',
    // Missing correction_proposals
  };
  const result = formatDiagnosticForPrompt(incompleteDiagnostic);
  assert.strictEqual(result, '');
});

test('buildModeAPrompt includes diagnostic section when review-context is diagnostic JSON', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const prompt = buildModeAPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Review this model refinement',
    reviewContext: diagnosticJson
  });

  assert.ok(prompt.includes('## Model Diagnostic Feedback'), 'should have diagnostic section');
  assert.ok(prompt.includes('add_state_variable'), 'should have proposals');
  assert.ok(!prompt.includes(diagnosticJson), 'should not include raw JSON string (it was nullified)');
});

test('buildModeBPrompt includes diagnostic section when review-context is diagnostic JSON', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const prompt = buildModeBPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Review execution traces',
    traces: 'execution output here',
    reviewContext: diagnosticJson
  });

  assert.ok(prompt.includes('## Model Diagnostic Feedback'), 'should have diagnostic section');
  assert.ok(prompt.includes('add_state_variable'), 'should have proposals');
  assert.ok(!prompt.includes(diagnosticJson), 'should not include raw JSON string (it was nullified)');
});

test('buildModeAPrompt passes through non-JSON review-context normally', () => {
  const plainText = 'This is a plain review comment';

  const prompt = buildModeAPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Review this',
    reviewContext: plainText
  });

  assert.ok(prompt.includes(plainText), 'should include plain text as-is');
  assert.ok(!prompt.includes('## Model Diagnostic Feedback'), 'should not have diagnostic section');
});

test('buildModeBPrompt passes through non-JSON review-context normally', () => {
  const plainText = 'This is a plain review comment';

  const prompt = buildModeBPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Review this',
    traces: 'traces here',
    reviewContext: plainText
  });

  assert.ok(prompt.includes(plainText), 'should include plain text as-is');
  assert.ok(!prompt.includes('## Model Diagnostic Feedback'), 'should not have diagnostic section');
});

test('Diagnostic JSON review-context does not double-render with plain-text review-context', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const promptA = buildModeAPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Test question',
    reviewContext: diagnosticJson
  });

  // Count occurrences of "Model Diagnostic Feedback"
  const count = (promptA.match(/## Model Diagnostic Feedback/g) || []).length;
  assert.strictEqual(count, 1, 'diagnostic section should appear exactly once');

  // Verify raw JSON is not present verbatim
  assert.ok(!promptA.includes(diagnosticJson), 'raw JSON should not appear in prompt');
});

test('buildModeBPrompt diagnostic double-render prevention', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const promptB = buildModeBPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Test question',
    traces: 'traces output',
    reviewContext: diagnosticJson
  });

  const count = (promptB.match(/## Model Diagnostic Feedback/g) || []).length;
  assert.strictEqual(count, 1, 'diagnostic section should appear exactly once');
  assert.ok(!promptB.includes(diagnosticJson), 'raw JSON should not appear in prompt');
});

test('formatDiagnosticForPrompt correctly formats all proposal details', () => {
  const result = formatDiagnosticForPrompt(mockDiagnostic);

  // Check for proposal 1
  assert.ok(result.includes('[add_state_variable]'), 'should mention type 1');
  assert.ok(result.includes('x:'), 'should mention field name');
  assert.ok(result.includes('VARIABLE x \\in Nat'), 'should include example');

  // Check for proposal 2
  assert.ok(result.includes('[add_invariant]'), 'should mention type 2');
  assert.ok(result.includes('Inv_StateConstraint_1'), 'should mention target');
  assert.ok(result.includes('Inv_1 == pc = 1 => x = 5'), 'should include example');
});

test('formatDiagnosticForPrompt handles empty proposals array', () => {
  const diagnostic = {
    mismatch_diff: 'diff text',
    correction_proposals: [],
    trace_alignment: { diverged_fields: [] }
  };

  const result = formatDiagnosticForPrompt(diagnostic);
  assert.ok(result.includes('## Model Diagnostic Feedback'), 'should still format section');
  assert.ok(result.includes('Correction Proposals'), 'should include proposals header');
});

test('buildModeAPrompt diagnostic section is positioned correctly in prompt flow', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const prompt = buildModeAPrompt({
    round: 1,
    repoDir: '/test/repo',
    question: 'Test question',
    artifactPath: 'path/to/file.tla',
    artifactContent: 'model content',
    reviewContext: diagnosticJson
  });

  // Diagnostic should come after artifact but before main question instructions
  const artifactIndex = prompt.indexOf('=== Artifact ===');
  const diagnosticIndex = prompt.indexOf('## Model Diagnostic Feedback');
  const questionIndex = prompt.indexOf('multi-model quorum');

  assert.ok(diagnosticIndex > artifactIndex, 'diagnostic should come after artifact');
  assert.ok(questionIndex > diagnosticIndex, 'quorum instructions should come after diagnostic');
});

test('Round 2+ prompts include diagnostic feedback reminder', () => {
  const diagnosticJson = JSON.stringify(mockDiagnostic);

  const promptRound2 = buildModeAPrompt({
    round: 2,
    repoDir: '/test/repo',
    question: 'Revise your answer',
    reviewContext: diagnosticJson,
    priorPositions: 'Other model said: approve'
  });

  // Should have diagnostic section in Round 2 as well
  assert.ok(promptRound2.includes('## Model Diagnostic Feedback'), 'Round 2 should have diagnostic');
  assert.ok(!promptRound2.includes(diagnosticJson), 'Round 2 JSON should be nullified');
});
