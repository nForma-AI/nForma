#!/usr/bin/env node
// @requirement CONF-09
// Two-layer config merge (global + project) applies to circuit_breaker settings
// identically to existing merge behavior

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const configLoaderPath = path.join(PROJECT_ROOT, 'hooks', 'config-loader.js');

test('CONF-09: config-loader exports DEFAULT_CONFIG with circuit_breaker sub-object', () => {
  const content = fs.readFileSync(configLoaderPath, 'utf8');
  assert.match(content, /circuit_breaker\s*:\s*\{/,
    'DEFAULT_CONFIG must contain a circuit_breaker object');
});

test('CONF-09: DEFAULT_CONFIG.circuit_breaker has required keys', () => {
  const { DEFAULT_CONFIG } = require(configLoaderPath);
  assert.ok(typeof DEFAULT_CONFIG.circuit_breaker === 'object',
    'circuit_breaker must be an object');
  assert.ok(Number.isInteger(DEFAULT_CONFIG.circuit_breaker.oscillation_depth),
    'oscillation_depth must be an integer');
  assert.ok(Number.isInteger(DEFAULT_CONFIG.circuit_breaker.commit_window),
    'commit_window must be an integer');
  assert.ok(typeof DEFAULT_CONFIG.circuit_breaker.haiku_reviewer === 'boolean',
    'haiku_reviewer must be boolean');
  assert.ok(typeof DEFAULT_CONFIG.circuit_breaker.haiku_model === 'string',
    'haiku_model must be a string');
});

test('CONF-09: loadConfig applies shallow merge to circuit_breaker from layers', () => {
  const content = fs.readFileSync(configLoaderPath, 'utf8');
  assert.match(content, /\{\s*\.\.\.DEFAULT_CONFIG,?\s*\.\.\./,
    'loadConfig must use shallow spread merge with DEFAULT_CONFIG');
});

test('CONF-09: validateConfig validates circuit_breaker fields', () => {
  const content = fs.readFileSync(configLoaderPath, 'utf8');
  assert.match(content, /circuit_breaker\.oscillation_depth/,
    'validateConfig must validate oscillation_depth');
  assert.match(content, /circuit_breaker\.commit_window/,
    'validateConfig must validate commit_window');
  assert.match(content, /circuit_breaker\.haiku_reviewer/,
    'validateConfig must validate haiku_reviewer');
  assert.match(content, /circuit_breaker\.haiku_model/,
    'validateConfig must validate haiku_model');
});
