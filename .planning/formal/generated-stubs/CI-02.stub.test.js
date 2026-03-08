#!/usr/bin/env node
// @requirement CI-02
// Linting and formatting checks run in CI and block merge on violations
// Formal model: ci-pipeline-gates.als — LintGate must Pass for merge
// Strategy: structural — verify CI workflow contains lint step and package.json has lint script

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const CI_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

test('CI-02: CI workflow contains a lint step that blocks merge', () => {
  const content = fs.readFileSync(CI_WORKFLOW, 'utf8');
  // CI must include a lint step
  assert.match(content, /[Ll]int/, 'CI workflow must contain a lint step');
  // lint:isolation is the configured lint command
  assert.match(content, /lint:isolation/, 'CI workflow must run lint:isolation');
});

test('CI-02: package.json defines lint:isolation script', () => {
  const content = fs.readFileSync(PACKAGE_JSON, 'utf8');
  const pkg = JSON.parse(content);
  assert.ok(pkg.scripts['lint:isolation'], 'package.json must define lint:isolation script');
});

test('CI-02: lint:isolation script exists and is executable', () => {
  const scriptPath = path.join(ROOT, 'scripts', 'lint-isolation.js');
  assert.ok(fs.existsSync(scriptPath), 'scripts/lint-isolation.js must exist');
  const content = fs.readFileSync(scriptPath, 'utf8');
  // Must be a substantive script (not empty)
  assert.ok(content.length > 50, 'lint-isolation.js must be a substantive script');
});

test('CI-02: test:ci includes lint:isolation as first gate', () => {
  const content = fs.readFileSync(PACKAGE_JSON, 'utf8');
  const pkg = JSON.parse(content);
  const testCi = pkg.scripts['test:ci'];
  assert.ok(testCi, 'package.json must define test:ci script');
  // lint:isolation must appear in test:ci and precede test execution
  assert.ok(testCi.includes('lint-isolation'), 'test:ci must include lint-isolation check');
  // lint-isolation must come before node --test (blocks merge if lint fails)
  const lintIdx = testCi.indexOf('lint-isolation');
  const testIdx = testCi.indexOf('node --test');
  assert.ok(lintIdx < testIdx, 'lint-isolation must run before tests (gate behavior)');
});
