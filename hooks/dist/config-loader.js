#!/usr/bin/env node
// hooks/config-loader.js
// Shared two-layer config loader with validation and stderr-only warnings.
//
// Exports: loadConfig(projectDir?), DEFAULT_CONFIG
//
// Load order: DEFAULT_CONFIG → ~/.claude/nf.json (global) → .claude/nf.json in projectDir (project)
// Merge: shallow spread — project values fully replace global values for any overlapping key.
// Warnings: all written to process.stderr — stdout is never touched (it is the hook decision channel).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Maps the family name of a slot (trailing -N stripped) to the MCP tool suffix to call.
// Used by both nf-prompt.js (step generation) and nf-stop.js (evidence detection).
const SLOT_TOOL_SUFFIX = {
  'codex-cli': 'review',
  'codex':     'review',
  'gemini-cli':'gemini',
  'gemini':    'gemini',
  'opencode':  'opencode',
  'copilot-cli':'ask',
  'copilot':   'ask',
  'claude':    'claude',
  'unified':   'claude',
};

// Returns the recommended tool call name for a slot (e.g. "codex-1" → "mcp__codex-1__review").
function slotToToolCall(slotName) {
  const family = slotName.replace(/-\d+$/, '');
  const suffix = SLOT_TOOL_SUFFIX[family] || 'claude';
  return 'mcp__' + slotName + '__' + suffix;
}

const HOOK_PROFILE_MAP = {
  minimal: new Set([
    'nf-circuit-breaker',
    'nf-precompact',
  ]),
  standard: new Set([
    'nf-circuit-breaker',
    'nf-precompact',
    'nf-prompt',
    'nf-stop',
    'gsd-context-monitor',
    'nf-spec-regen',
    'nf-token-collector',
    'nf-slot-correlator',
    'nf-session-start',
    'nf-statusline',
  ]),
  strict: new Set([
    'nf-circuit-breaker',
    'nf-precompact',
    'nf-prompt',
    'nf-stop',
    'gsd-context-monitor',
    'nf-spec-regen',
    'nf-token-collector',
    'nf-slot-correlator',
    'nf-session-start',
    'nf-statusline',
  ]),
};

function shouldRunHook(hookBasename, profile) {
  const validProfile = HOOK_PROFILE_MAP[profile] ? profile : 'standard';
  return HOOK_PROFILE_MAP[validProfile].has(hookBasename);
}

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
    copilot:  { tool_prefix: 'mcp__copilot-cli__',  required: true },
  },
  // quorum: pool-based enforcement (supersedes required_models when quorum_active is set).
  // minSize — minimum number of agents that must be called (from the available pool).
  //   Default 4 preserves backward compat with the 4-model required_models check.
  // preferSub — sort sub (subscription) agents before api agents in pool and prompt steps.
  quorum: {
    minSize: 4,
    preferSub: false,
  },
  // agent_config: per-slot metadata.
  //   auth_type: "sub" (subscription, flat-fee) | "api" (pay-per-token)
  agent_config: {},
  circuit_breaker: {
    oscillation_depth: 3,          // how many run-groups of same file set to trigger
    commit_window: 6,              // how many commits to look back
    haiku_reviewer: true,          // call Claude Haiku to verify before blocking
    haiku_model: 'claude-haiku-4-5-20251001', // model used for review
  },
  model_preferences: {},  // { "<mcp-server-name>": "<model-id>" }
  // context_monitor: PostToolUse hook thresholds for context window warnings.
  // warn_pct — inject WARNING when context used % >= this value (default 70)
  // critical_pct — inject CRITICAL when context used % >= this value (default 90)
  context_monitor: {
    warn_pct: 70,
    critical_pct: 90,
  },
  // quorum_active: array of slot names that participate in quorum.
  // [] = all discovered slots participate (fail-open, backward compatible with pre-Phase-40 installs).
  // A non-empty array is an explicit allowlist.
  // NOTE: loadConfig() uses shallow spread { ...DEFAULT_CONFIG, ...global, ...project } —
  // if project config sets quorum_active, it entirely replaces the global value.
  quorum_active: [],
  // model_tier_planner: model tier for planner agents (gsd-planner, gsd-roadmapper).
  // model_tier_worker: model tier for worker agents (researcher, checker, executor, etc.).
  // Valid values: 'haiku' | 'sonnet' | 'opus'. Flat keys required — nested objects lost in shallow merge.
  model_tier_planner: 'opus',
  model_tier_worker: 'haiku',
  // task_envelope_enabled: master switch for task-envelope.json sidecar writes.
  // Flat key required — nested objects lost in shallow merge.
  task_envelope_enabled: true,
  hook_profile: 'standard',
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
    process.stderr.write('[nf] WARNING: Malformed config at ' + filePath + ': ' + e.message + '\n');
    return null;
  }
}

// Validates config fields in-place.
// Corrects invalid fields to DEFAULT_CONFIG values and emits a stderr warning for each.
// Returns the (possibly corrected) config object.
function validateConfig(config) {
  if (!Array.isArray(config.quorum_commands)) {
    process.stderr.write('[nf] WARNING: nf.json: quorum_commands must be an array; using defaults\n');
    config.quorum_commands = DEFAULT_CONFIG.quorum_commands;
  }

  if (typeof config.required_models !== 'object' || config.required_models === null) {
    process.stderr.write('[nf] WARNING: nf.json: required_models must be an object; using defaults\n');
    config.required_models = DEFAULT_CONFIG.required_models;
  }

  if (!['open', 'closed'].includes(config.fail_mode)) {
    process.stderr.write('[nf] WARNING: nf.json: fail_mode "' + config.fail_mode + '" invalid; defaulting to "open"\n');
    config.fail_mode = 'open';
  }

  // Validate circuit_breaker sub-object
  if (typeof config.circuit_breaker !== 'object' || config.circuit_breaker === null) {
    process.stderr.write('[nf] WARNING: nf.json: circuit_breaker must be an object; using defaults\n');
    config.circuit_breaker = { ...DEFAULT_CONFIG.circuit_breaker };
  } else {
    // Validate oscillation_depth independently
    if (!Number.isInteger(config.circuit_breaker.oscillation_depth) || config.circuit_breaker.oscillation_depth < 1) {
      process.stderr.write('[nf] WARNING: nf.json: circuit_breaker.oscillation_depth must be a positive integer; defaulting to 3\n');
      config.circuit_breaker.oscillation_depth = 3;
    }
    // Validate commit_window independently
    if (!Number.isInteger(config.circuit_breaker.commit_window) || config.circuit_breaker.commit_window < 1) {
      process.stderr.write('[nf] WARNING: nf.json: circuit_breaker.commit_window must be a positive integer; defaulting to 6\n');
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
      process.stderr.write('[nf] WARNING: nf.json: circuit_breaker.haiku_reviewer must be boolean; defaulting to true\n');
      config.circuit_breaker.haiku_reviewer = true;
    }
    if (typeof config.circuit_breaker.haiku_model !== 'string') {
      process.stderr.write('[nf] WARNING: nf.json: circuit_breaker.haiku_model must be a string; using default\n');
      config.circuit_breaker.haiku_model = DEFAULT_CONFIG.circuit_breaker.haiku_model;
    }
  }

  // Validate quorum_active
  if (!Array.isArray(config.quorum_active)) {
    process.stderr.write('[nf] WARNING: nf.json: quorum_active must be an array; using []\n');
    config.quorum_active = [];
  } else {
    config.quorum_active = config.quorum_active.filter(
      s => typeof s === 'string' && s.trim().length > 0
    );
  }

  // Validate quorum object
  if (typeof config.quorum !== 'object' || config.quorum === null) {
    config.quorum = { ...DEFAULT_CONFIG.quorum };
  } else {
    if (!Number.isInteger(config.quorum.minSize) || config.quorum.minSize < 1) {
      process.stderr.write('[nf] WARNING: nf.json: quorum.minSize must be a positive integer; defaulting to 4\n');
      config.quorum.minSize = DEFAULT_CONFIG.quorum.minSize;
    }
    if (typeof config.quorum.preferSub !== 'boolean') {
      config.quorum.preferSub = DEFAULT_CONFIG.quorum.preferSub;
    }
  }

  // Validate agent_config
  if (typeof config.agent_config !== 'object' || config.agent_config === null || Array.isArray(config.agent_config)) {
    process.stderr.write('[nf] WARNING: nf.json: agent_config must be an object; using {}\n');
    config.agent_config = {};
  } else {
    for (const [slot, meta] of Object.entries(config.agent_config)) {
      if (typeof meta !== 'object' || meta === null) {
        process.stderr.write('[nf] WARNING: nf.json: agent_config.' + slot + ' must be an object; removing\n');
        delete config.agent_config[slot];
      } else if (meta.auth_type && !['sub', 'api'].includes(meta.auth_type)) {
        process.stderr.write('[nf] WARNING: nf.json: agent_config.' + slot + '.auth_type must be "sub" or "api"; defaulting to "api"\n');
        meta.auth_type = 'api';
      }
    }
  }

  // Validate model_preferences
  if (typeof config.model_preferences !== 'object' || config.model_preferences === null || Array.isArray(config.model_preferences)) {
    process.stderr.write('[nf] WARNING: nf.json: model_preferences must be an object; using {}\n');
    config.model_preferences = {};
  } else {
    // Remove invalid entries (non-string values) with a warning
    for (const [key, val] of Object.entries(config.model_preferences)) {
      if (typeof val !== 'string' || val.trim() === '') {
        process.stderr.write('[nf] WARNING: nf.json: model_preferences.' + key + ' must be a non-empty string; removing\n');
        delete config.model_preferences[key];
      }
    }
  }

  // Validate context_monitor sub-object
  if (typeof config.context_monitor !== 'object' || config.context_monitor === null) {
    process.stderr.write('[nf] WARNING: nf.json: context_monitor must be an object; using defaults\n');
    config.context_monitor = { ...DEFAULT_CONFIG.context_monitor };
  } else {
    if (!Number.isInteger(config.context_monitor.warn_pct) ||
        config.context_monitor.warn_pct < 1 || config.context_monitor.warn_pct > 99) {
      process.stderr.write('[nf] WARNING: nf.json: context_monitor.warn_pct must be an integer 1-99; defaulting to 70\n');
      config.context_monitor.warn_pct = DEFAULT_CONFIG.context_monitor.warn_pct;
    }
    if (!Number.isInteger(config.context_monitor.critical_pct) ||
        config.context_monitor.critical_pct < 1 || config.context_monitor.critical_pct > 100) {
      process.stderr.write('[nf] WARNING: nf.json: context_monitor.critical_pct must be an integer 1-100; defaulting to 90\n');
      config.context_monitor.critical_pct = DEFAULT_CONFIG.context_monitor.critical_pct;
    }
    if (config.context_monitor.warn_pct >= config.context_monitor.critical_pct) {
      process.stderr.write('[nf] WARNING: nf.json: context_monitor.warn_pct must be less than critical_pct; resetting to defaults\n');
      config.context_monitor.warn_pct = DEFAULT_CONFIG.context_monitor.warn_pct;
      config.context_monitor.critical_pct = DEFAULT_CONFIG.context_monitor.critical_pct;
    }
    // Fill missing sub-keys with defaults
    if (config.context_monitor.warn_pct === undefined) {
      config.context_monitor.warn_pct = DEFAULT_CONFIG.context_monitor.warn_pct;
    }
    if (config.context_monitor.critical_pct === undefined) {
      config.context_monitor.critical_pct = DEFAULT_CONFIG.context_monitor.critical_pct;
    }
  }

  // Validate model_tier_planner and model_tier_worker
  const VALID_TIERS = ['haiku', 'sonnet', 'opus'];
  if (config.model_tier_planner !== undefined) {
    if (typeof config.model_tier_planner !== 'string' || !VALID_TIERS.includes(config.model_tier_planner)) {
      process.stderr.write('[nf] WARNING: nf.json: model_tier_planner must be "haiku", "sonnet", or "opus"; removing\n');
      delete config.model_tier_planner;
    }
  }
  if (config.model_tier_worker !== undefined) {
    if (typeof config.model_tier_worker !== 'string' || !VALID_TIERS.includes(config.model_tier_worker)) {
      process.stderr.write('[nf] WARNING: nf.json: model_tier_worker must be "haiku", "sonnet", or "opus"; removing\n');
      delete config.model_tier_worker;
    }
  }

  // Validate task_envelope_enabled
  if (config.task_envelope_enabled !== undefined) {
    if (typeof config.task_envelope_enabled !== 'boolean') {
      process.stderr.write('[nf] WARNING: nf.json: task_envelope_enabled must be a boolean; using default true\n');
      config.task_envelope_enabled = true;
    }
  }

  // Validate hook_profile
  const VALID_PROFILES = ['minimal', 'standard', 'strict'];
  if (config.hook_profile !== undefined) {
    if (typeof config.hook_profile !== 'string' || !VALID_PROFILES.includes(config.hook_profile)) {
      process.stderr.write('[nf] WARNING: nf.json: hook_profile must be "minimal", "standard", or "strict"; defaulting to "standard"\n');
      config.hook_profile = 'standard';
    }
  }

  return config;
}

// Loads the two-layer nForma config.
//
// Layer 1 (global): ~/.claude/nf.json
// Layer 2 (project): <projectDir>/.claude/nf.json  (defaults to process.cwd())
//
// Merge is shallow: { ...DEFAULT_CONFIG, ...global, ...project }
// If both layers are missing/malformed, returns DEFAULT_CONFIG with a warning.
// All warnings go to stderr — stdout is never touched.
function loadConfig(projectDir) {
  const globalPath = path.join(os.homedir(), '.claude', 'nf.json');
  const projectPath = path.join(projectDir || process.cwd(), '.claude', 'nf.json');

  const globalObj = readConfigFile(globalPath);
  const projectObj = readConfigFile(projectPath);

  let config;
  if (!globalObj && !projectObj) {
    process.stderr.write('[nf] WARNING: No nf.json found at ' + globalPath + ' or ' + projectPath + '; using hardcoded defaults\n');
    config = { ...DEFAULT_CONFIG };
  } else {
    config = { ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) };
  }

  validateConfig(config);
  return config;
}

module.exports = { loadConfig, DEFAULT_CONFIG, SLOT_TOOL_SUFFIX, slotToToolCall, shouldRunHook, HOOK_PROFILE_MAP };
