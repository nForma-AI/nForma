#!/usr/bin/env node
// @requirement CONF-02
// Constant/structural test: per-project .claude/nf.json merged with global, project values take precedence

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

test('CONF-02 — ConfigLayer: config-loader.js implements two-layer merge with project precedence', () => {
  const configLoaderPath = '/Users/jonathanborduas/code/QGSD/hooks/config-loader.js';
  const content = fs.readFileSync(configLoaderPath, 'utf8');

  // Must reference both global (~/.claude/nf.json) and project (.claude/nf.json) config paths
  assert.match(content, /globalPath/, 'Should define globalPath for global config');
  assert.match(content, /projectPath/, 'Should define projectPath for project config');

  // Must load from ~/.claude/nf.json (global layer)
  assert.match(content, /\.claude.*nf\.json/, 'Should reference nf.json config file');

  // Must perform shallow merge with project taking precedence (spread order matters)
  // The pattern: { ...DEFAULT_CONFIG, ...global, ...project }
  assert.match(content, /\.\.\.DEFAULT_CONFIG.*\.\.\..*global.*\.\.\..*project/s,
    'Should merge as { ...DEFAULT_CONFIG, ...global, ...project } so project wins');
});

test('CONF-02 — ConfigLayer: loadConfig exports are available', () => {
  const { loadConfig, DEFAULT_CONFIG } = require('/Users/jonathanborduas/code/QGSD/hooks/config-loader.js');
  assert.strictEqual(typeof loadConfig, 'function', 'loadConfig must be a function');
  assert.strictEqual(typeof DEFAULT_CONFIG, 'object', 'DEFAULT_CONFIG must be an object');
});
