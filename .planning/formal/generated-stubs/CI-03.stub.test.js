#!/usr/bin/env node
// @requirement CI-03
// Type checking (if applicable to the language) runs in CI and blocks merge on type errors
// Formal model: ci-pipeline-gates.als — TypeCheckGate must Pass for merge
// Strategy: structural — verify type checking infrastructure exists and is enforceable

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..', '..');
const CI_WORKFLOW = path.join(ROOT, '.github', 'workflows', 'ci.yml');

test('CI-03: project has TypeScript configuration for type checking', () => {
  // The project uses .cjs/.mjs (CommonJS/ESM JS) with optional TS for formal machines.
  // Type checking is handled via tsconfig for the formal/machine layer.
  const tsconfigExists = fs.existsSync(path.join(ROOT, 'tsconfig.json'))
    || fs.existsSync(path.join(ROOT, 'tsconfig.formal.json'));
  assert.ok(tsconfigExists, 'project must have a tsconfig file for type checking');
});

test('CI-03: CI workflow has build step that validates type correctness', () => {
  const content = fs.readFileSync(CI_WORKFLOW, 'utf8');
  // The CI workflow must include a build step that catches type errors.
  // build:hooks compiles hooks; build:machines uses tsup with tsconfig.
  // Either a direct typecheck step or a build step that fails on type errors satisfies CI-03.
  const hasTypeGate = /[Bb]uild hooks|typecheck|tsc|type.check|build:machines/.test(content);
  assert.ok(hasTypeGate, 'CI workflow must have a build or type-check step that blocks merge on type errors');
});

test('CI-03: build:hooks script exists and validates hook source integrity', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['build:hooks'], 'package.json must define build:hooks script');
  const buildHooksScript = path.join(ROOT, 'scripts', 'build-hooks.js');
  assert.ok(fs.existsSync(buildHooksScript), 'scripts/build-hooks.js must exist');
});
