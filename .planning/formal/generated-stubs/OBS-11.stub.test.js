#!/usr/bin/env node
// @requirement OBS-11
// Structural test: upstream changes are evaluated with SKIP/CANDIDATE/INCOMPATIBLE classification
// before porting. The classifyUpstreamOverlap function enforces this.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const UPSTREAM_PATH = path.join(ROOT, 'bin/observe-handler-upstream.cjs');

test('OBS-11: observe-handler-upstream.cjs exports classifyUpstreamOverlap', () => {
  const mod = require(UPSTREAM_PATH);
  assert.ok(typeof mod.classifyUpstreamOverlap === 'function',
    'classifyUpstreamOverlap must be exported');
});

test('OBS-11: classifyUpstreamOverlap returns SKIP, CANDIDATE, or INCOMPATIBLE', () => {
  const content = fs.readFileSync(UPSTREAM_PATH, 'utf8');
  assert.match(content, /SKIP/, 'must contain SKIP classification');
  assert.match(content, /CANDIDATE/, 'must contain CANDIDATE classification');
  assert.match(content, /INCOMPATIBLE/, 'must contain INCOMPATIBLE classification');
});

test('OBS-11: classification function is invoked for each upstream item before surfacing', () => {
  const content = fs.readFileSync(UPSTREAM_PATH, 'utf8');
  // The handler must call classifyUpstreamOverlap when processing releases and PRs
  const classifyCallCount = (content.match(/classifyUpstreamOverlap\(/g) || []).length;
  // At least 2 calls: one for releases, one for PRs
  assert.ok(classifyCallCount >= 2,
    `classifyUpstreamOverlap must be called at least twice (releases + PRs), found ${classifyCallCount}`);
});

test('OBS-11: upstream items include classification in _upstream metadata', () => {
  const content = fs.readFileSync(UPSTREAM_PATH, 'utf8');
  assert.match(content, /classification:\s*classifyUpstreamOverlap/,
    'upstream items must include classification result in _upstream metadata');
});
