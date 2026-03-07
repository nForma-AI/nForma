#!/usr/bin/env node
// @requirement STATE-05
// Constant test: execute-plan Route C chains into /nf:audit-milestone
// when all phases are complete, instead of suggesting /nf:complete-milestone directly

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PLAN_PATH = path.join(
  '/Users/jonathanborduas/code/QGSD',
  'core', 'workflows', 'execute-plan.md'
);

test('STATE-05: execute-plan.md exists', () => {
  assert.ok(fs.existsSync(EXECUTE_PLAN_PATH));
});

test('STATE-05: Route C references audit-milestone (not complete-milestone directly)', () => {
  const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf8');
  // Route C section must chain into audit-milestone
  assert.match(content, /Route C/i, 'Must define Route C');
  assert.match(content, /audit-milestone/, 'Route C must reference audit-milestone');
});

test('STATE-05: Route C invokes /nf:audit-milestone command', () => {
  const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf8');
  assert.match(content, /\/nf:audit-milestone/, 'Must invoke /nf:audit-milestone slash command');
});

test('STATE-05: Route C triggers on summaries = plans and current = highest phase', () => {
  const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf8');
  // The routing table condition for Route C
  assert.match(content, /summaries\s*=\s*plans.*current\s*=\s*highest/,
    'Route C condition: summaries = plans, current = highest phase');
});
