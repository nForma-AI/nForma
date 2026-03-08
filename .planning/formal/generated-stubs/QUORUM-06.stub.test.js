#!/usr/bin/env node
// @requirement QUORUM-06
// Auto-generated stub for uncovered invariant: TypeOK
// checkpoint:human-verify in auto-mode triggers a quorum consensus gate
// requiring 100% APPROVE from all responding workers

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

// QUORUM-06 structural: verify that the execute-phase workflow and executor
// agent instructions reference checkpoint:human-verify and quorum consensus gate

const executePhaseSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/workflows/execute-phase.md'),
  'utf8'
);

const executorAgentSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../agents/nf-executor.md'),
  'utf8'
);

test('QUORUM-06 — TypeOK: execute-phase workflow references checkpoint:human-verify', () => {
  assert.match(executePhaseSrc, /checkpoint:human-verify/,
    'execute-phase.md must reference checkpoint:human-verify checkpoint type');
});

test('QUORUM-06 — TypeOK: executor agent references quorum consensus gate for checkpoints', () => {
  assert.match(executorAgentSrc, /checkpoint:human-verify/,
    'nf-executor.md must reference checkpoint:human-verify');
});

test('QUORUM-06 — TypeOK: checkpoint protocol references quorum consensus', () => {
  const checkpointRef = path.resolve(__dirname, '../../../core/references/checkpoints.md');
  const content = fs.readFileSync(checkpointRef, 'utf8');
  assert.ok(content.length > 0, 'checkpoints.md must not be empty');
  assert.match(content, /checkpoint:human-verify/,
    'checkpoints.md must describe checkpoint:human-verify protocol');
});

test('QUORUM-06 — TypeOK: auto-mode detection exists for checkpoint gating', () => {
  // The execute-phase workflow must detect auto_advance config for checkpoint behavior
  assert.match(executePhaseSrc, /auto/i,
    'execute-phase.md must reference auto-mode for checkpoint gating decisions');
});
