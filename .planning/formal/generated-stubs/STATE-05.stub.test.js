#!/usr/bin/env node
// @requirement STATE-05
// Verify: execute-plan Route C chains into /nf:audit-milestone (not /nf:complete-milestone directly)
// Strategy: constant — assert workflow file contains the expected routing pattern

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const executePlanPath = path.join(ROOT, 'core', 'workflows', 'execute-plan.md');

test('STATE-05: Route C chains into audit-milestone, not complete-milestone directly', () => {
  const content = fs.readFileSync(executePlanPath, 'utf8');

  // Route C must reference audit-milestone
  assert.match(content, /Route C.*milestone done/i,
    'execute-plan.md should define Route C as milestone-done route');

  // Route C expanded section must chain into audit-milestone
  assert.match(content, /audit-milestone/,
    'Route C should chain into audit-milestone');

  // The yolo path invokes audit-milestone --auto
  assert.match(content, /SlashCommand\("\/nf:audit-milestone/,
    'Yolo mode should invoke /nf:audit-milestone via SlashCommand');

  // The interactive path suggests audit-milestone
  assert.match(content, /`\/nf:audit-milestone/,
    'Interactive mode should suggest /nf:audit-milestone');

  // Route C should NOT suggest complete-milestone directly (it goes through audit first)
  // Extract only the Route C section to check this
  const routeCStart = content.indexOf('Route C expanded');
  assert.ok(routeCStart !== -1, 'Route C expanded section should exist');
  const routeCSection = content.slice(routeCStart, routeCStart + 2000);
  assert.ok(!routeCSection.includes('/nf:complete-milestone'),
    'Route C should not reference complete-milestone directly — audit-milestone comes first');
});
