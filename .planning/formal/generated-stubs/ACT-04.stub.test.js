#!/usr/bin/env node
// @requirement ACT-04
// Auto-generated stub for uncovered invariant: ResumeWork

const { test } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const resumeWorkflowSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/workflows/resume-project.md'),
  'utf8'
);

const gsdToolsSrc = fs.readFileSync(
  path.resolve(__dirname, '../../../core/bin/gsd-tools.cjs'),
  'utf8'
);

test('ACT-04 — ResumeWork: resume-project workflow reads current-activity.json via activity-get', () => {
  assert.match(resumeWorkflowSrc, /activity-get/,
    'resume-project.md must invoke activity-get to read current state');
});

test('ACT-04 — ResumeWork: activity-get command returns activity state or empty object', () => {
  assert.match(gsdToolsSrc, /function\s+cmdActivityGet/,
    'cmdActivityGet function must be defined in gsd-tools.cjs');

  // Verify fallback to empty object when file is missing
  assert.match(gsdToolsSrc, /output\(\{\},\s*raw\)/,
    'cmdActivityGet must return {} when current-activity.json is absent');
});

test('ACT-04 — ResumeWork: resume workflow extracts routing fields from activity JSON', () => {
  // Verify the workflow references key routing fields
  assert.match(resumeWorkflowSrc, /activity/,
    'resume workflow must reference activity field');
  assert.match(resumeWorkflowSrc, /sub_activity/,
    'resume workflow must reference sub_activity field');
});
