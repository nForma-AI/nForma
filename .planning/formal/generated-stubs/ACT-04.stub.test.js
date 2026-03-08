#!/usr/bin/env node
// @requirement ACT-04
// Structural test: resume-work reads current-activity.json and routes to recovery point

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS = path.join(process.env.HOME, '.claude/nf/bin/gsd-tools.cjs');

test('ACT-04: gsd-tools has activity-get command for reading current-activity.json', () => {
  const content = fs.readFileSync(GSD_TOOLS, 'utf8');
  assert.match(content, /cmdActivityGet/, 'must have cmdActivityGet function');
  assert.match(content, /readFileSync\(filePath/, 'cmdActivityGet must read the file');
  // Returns {} if missing — graceful degradation
  assert.match(content, /output\(\{\},\s*raw\)/, 'must return empty object if file missing');
});

test('ACT-04: resume-project workflow reads current-activity.json via activity-get', () => {
  const resumePath = path.join(process.env.HOME, '.claude/nf/workflows/resume-project.md');
  const content = fs.readFileSync(resumePath, 'utf8');
  assert.match(content, /activity-get/, 'resume workflow must call activity-get to read interrupted state');
});

test('ACT-04: TLA+ model defines ResumeWork action for ACT-04', () => {
  const tlaPath = path.join(__dirname, '../tla/QGSDActivityTracking.tla');
  const content = fs.readFileSync(tlaPath, 'utf8');
  assert.match(content, /ResumeWork\s*==/, 'TLA+ model must define ResumeWork action');
  assert.match(content, /@requirement ACT-04/, 'TLA+ model must tag ACT-04 requirement');
  // ResumeWork requires file to exist
  assert.match(content, /fileExists\s*=\s*TRUE/, 'ResumeWork must require file to exist');
});
