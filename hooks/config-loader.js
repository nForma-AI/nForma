#!/usr/bin/env node
// hooks/config-loader.js
// Shared two-layer config loader with validation and stderr-only warnings.
//
// Exports: loadConfig(projectDir?), DEFAULT_CONFIG
//
// Load order: DEFAULT_CONFIG → ~/.claude/qgsd.json (global) → .claude/qgsd.json in projectDir (project)
// Merge: shallow spread — project values fully replace global values for any overlapping key.
// Warnings: all written to process.stderr — stdout is never touched (it is the hook decision channel).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  quorum_commands: [
    'plan-phase', 'new-project', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase', 'quick',
  ],
  fail_mode: 'open',
  required_models: {
    codex:    { tool_prefix: 'mcp__codex-cli__',  required: true },
    gemini:   { tool_prefix: 'mcp__gemini-cli__', required: true },
    opencode: { tool_prefix: 'mcp__opencode__',   required: true },
    copilot:  { tool_prefix: 'mcp__copilot-cli__', required: true },
  },
  circuit_breaker: {
    oscillation_depth: 3,          // how many run-groups of same file set to trigger
    commit_window: 6,              // how many commits to look back
    haiku_reviewer: true,          // call Claude Haiku to verify before blocking
    haiku_model: 'claude-haiku-4-5-20251001', // model used for review
  },
};

// Reads and parses a JSON config file.
// Returns the parsed object on success.
// Returns null silently if the file does not exist.
// Returns null with a stderr warning if the file is malformed.
function readConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    process.stderr.write('[qgsd] WARNING: Malformed config at ' + filePath + ': ' + e.message + '\n');
    return null;
  }
}

// Validates config fields in-place.
// Corrects invalid fields to DEFAULT_CONFIG values and emits a stderr warning for each.
// Returns the (possibly corrected) config object.
function validateConfig(config) {
  if (!Array.isArray(config.quorum_commands)) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: quorum_commands must be an array; using defaults\n');
    config.quorum_commands = DEFAULT_CONFIG.quorum_commands;
  }

  if (typeof config.required_models !== 'object' || config.required_models === null) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: required_models must be an object; using defaults\n');
    config.required_models = DEFAULT_CONFIG.required_models;
  }

  if (!['open', 'closed'].includes(config.fail_mode)) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: fail_mode "' + config.fail_mode + '" invalid; defaulting to "open"\n');
    config.fail_mode = 'open';
  }

  // Validate circuit_breaker sub-object
  if (typeof config.circuit_breaker !== 'object' || config.circuit_breaker === null) {
    process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker must be an object; using defaults\n');
    config.circuit_breaker = { ...DEFAULT_CONFIG.circuit_breaker };
  } else {
    // Validate oscillation_depth independently
    if (!Number.isInteger(config.circuit_breaker.oscillation_depth) || config.circuit_breaker.oscillation_depth < 1) {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.oscillation_depth must be a positive integer; defaulting to 3\n');
      config.circuit_breaker.oscillation_depth = 3;
    }
    // Validate commit_window independently
    if (!Number.isInteger(config.circuit_breaker.commit_window) || config.circuit_breaker.commit_window < 1) {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.commit_window must be a positive integer; defaulting to 6\n');
      config.circuit_breaker.commit_window = 6;
    }
    // Fill in missing sub-keys with defaults (handles partial circuit_breaker objects)
    if (config.circuit_breaker.oscillation_depth === undefined) {
      config.circuit_breaker.oscillation_depth = DEFAULT_CONFIG.circuit_breaker.oscillation_depth;
    }
    if (config.circuit_breaker.commit_window === undefined) {
      config.circuit_breaker.commit_window = DEFAULT_CONFIG.circuit_breaker.commit_window;
    }
    if (config.circuit_breaker.haiku_reviewer === undefined) {
      config.circuit_breaker.haiku_reviewer = DEFAULT_CONFIG.circuit_breaker.haiku_reviewer;
    }
    if (config.circuit_breaker.haiku_model === undefined) {
      config.circuit_breaker.haiku_model = DEFAULT_CONFIG.circuit_breaker.haiku_model;
    }
    if (typeof config.circuit_breaker.haiku_reviewer !== 'boolean') {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.haiku_reviewer must be boolean; defaulting to true\n');
      config.circuit_breaker.haiku_reviewer = true;
    }
    if (typeof config.circuit_breaker.haiku_model !== 'string') {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.haiku_model must be a string; using default\n');
      config.circuit_breaker.haiku_model = DEFAULT_CONFIG.circuit_breaker.haiku_model;
    }
  }

  return config;
}

// Loads the two-layer QGSD config.
//
// Layer 1 (global): ~/.claude/qgsd.json
// Layer 2 (project): <projectDir>/.claude/qgsd.json  (defaults to process.cwd())
//
// Merge is shallow: { ...DEFAULT_CONFIG, ...global, ...project }
// If both layers are missing/malformed, returns DEFAULT_CONFIG with a warning.
// All warnings go to stderr — stdout is never touched.
function loadConfig(projectDir) {
  const globalPath = path.join(os.homedir(), '.claude', 'qgsd.json');
  const projectPath = path.join(projectDir || process.cwd(), '.claude', 'qgsd.json');

  const globalObj = readConfigFile(globalPath);
  const projectObj = readConfigFile(projectPath);

  let config;
  if (!globalObj && !projectObj) {
    process.stderr.write('[qgsd] WARNING: No qgsd.json found at ' + globalPath + ' or ' + projectPath + '; using hardcoded defaults\n');
    config = { ...DEFAULT_CONFIG };
  } else {
    config = { ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) };
  }

  validateConfig(config);
  return config;
}

module.exports = { loadConfig, DEFAULT_CONFIG };
