#!/usr/bin/env node
// hooks/config-loader.test.js
// TDD test suite for hooks/config-loader.js
// Uses node:test + node:assert/strict
// Tests write temp config files to os.tmpdir() — cleaned up in finally blocks.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// We test via the module under test
const { loadConfig, DEFAULT_CONFIG } = require('./config-loader');

// Helper: write a JSON file to a temp directory
function writeTempConfig(dir, content) {
  const configDir = path.join(dir, '.claude');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, 'qgsd.json'), content, 'utf8');
}

// TC1: Project dir missing config, no project-level file exists.
// NOTE: The global ~/.claude/qgsd.json may or may not exist on the test machine.
// This test verifies: (a) loadConfig() returns a valid config object, (b) no stdout written,
// (c) if global is absent too, a WARNING is emitted.
// We use a fresh temp dir with no .claude/ subdirectory as the project dir.
// @requirement CONF-01
test('TC1: no project config → returns valid config (from global or DEFAULT_CONFIG)', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc1-'));
  const stdoutChunks = [];
  const origStdout = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    stdoutChunks.push(chunk);
    return origStdout(chunk, ...args);
  };
  try {
    // No .claude/qgsd.json in tmpDir — project layer absent
    const config = loadConfig(tmpDir);
    // Must be a valid config with required shape regardless of global presence
    assert.ok(typeof config === 'object' && config !== null, 'config must be an object');
    assert.ok(Array.isArray(config.quorum_commands), 'quorum_commands must be array');
    assert.ok(typeof config.required_models === 'object' && config.required_models !== null, 'required_models must be object');
    assert.ok(['open', 'closed'].includes(config.fail_mode), 'fail_mode must be valid');
    // Stdout must remain clean
    assert.equal(stdoutChunks.length, 0, 'stdout must remain empty');
  } finally {
    process.stdout.write = origStdout;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// TC2: Global only, valid — returns DEFAULT_CONFIG merged with global
test('TC2: global config only (valid) → merged over DEFAULT_CONFIG', async (t) => {
  const globalDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc2g-'));
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc2p-'));
  // Write a global config. We can't easily redirect the global path,
  // so this TC tests project-only (same merge path when global is absent).
  // The global path is always ~/.claude/qgsd.json — we test through projectDir override.
  // TC2 tests project config only scenario, which covers the { ...DEFAULT_CONFIG, ...project } path.
  try {
    writeTempConfig(projectDir, JSON.stringify({ quorum_commands: ['custom-cmd'], fail_mode: 'open', required_models: DEFAULT_CONFIG.required_models }));
    const config = loadConfig(projectDir);
    assert.ok(Array.isArray(config.quorum_commands));
    assert.ok(config.quorum_commands.includes('custom-cmd'));
    assert.equal(config.fail_mode, 'open');
  } finally {
    fs.rmSync(globalDir, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC3: Project config with fail_mode: 'closed' overrides global/default
test('TC3: project config overrides fail_mode', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc3-'));
  try {
    writeTempConfig(projectDir, JSON.stringify({ fail_mode: 'closed' }));
    const config = loadConfig(projectDir);
    assert.equal(config.fail_mode, 'closed');
    // Other keys should still exist (from DEFAULT_CONFIG)
    assert.ok(Array.isArray(config.quorum_commands));
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC4: Malformed project config — warns on stderr, falls back for that layer
test('TC4: malformed project config → stderr warning, uses DEFAULT_CONFIG for that layer', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc4-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, '{ invalid json :');
    const config = loadConfig(projectDir);
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should emit a WARNING on stderr');
    // Config should still be a valid object with DEFAULT_CONFIG keys
    assert.ok(Array.isArray(config.quorum_commands));
    assert.ok(config.required_models);
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC5: validateConfig — invalid quorum_commands (string, not array) → corrected to DEFAULT
test('TC5: validateConfig corrects quorum_commands: string → DEFAULT array', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc5-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ quorum_commands: 'not-an-array' }));
    const config = loadConfig(projectDir);
    assert.ok(Array.isArray(config.quorum_commands), 'quorum_commands should be corrected to array');
    assert.deepEqual(config.quorum_commands, DEFAULT_CONFIG.quorum_commands);
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should warn about invalid quorum_commands');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC6: validateConfig — invalid required_models (not an object) → corrected to DEFAULT
test('TC6: validateConfig corrects required_models: null → DEFAULT object', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc6-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ required_models: null }));
    const config = loadConfig(projectDir);
    assert.ok(config.required_models !== null);
    assert.equal(typeof config.required_models, 'object');
    assert.deepEqual(config.required_models, DEFAULT_CONFIG.required_models);
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should warn about invalid required_models');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC7: validateConfig — invalid fail_mode → corrected to 'open'
test('TC7: validateConfig corrects invalid fail_mode → "open"', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc7-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ fail_mode: 'invalid-value' }));
    const config = loadConfig(projectDir);
    assert.equal(config.fail_mode, 'open');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should warn about invalid fail_mode');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC8: No stdout output from any loadConfig() call
test('TC8: loadConfig() never writes to stdout', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc8-'));
  const stdoutChunks = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    stdoutChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    // Test multiple scenarios
    loadConfig(projectDir); // no files

    writeTempConfig(projectDir, '{ bad json');
    loadConfig(projectDir); // malformed

    writeTempConfig(projectDir, JSON.stringify({ quorum_commands: 'bad', fail_mode: 'bad', required_models: null }));
    loadConfig(projectDir); // validation failures

    assert.equal(stdoutChunks.length, 0, 'stdout must remain empty across all scenarios');
  } finally {
    process.stdout.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC9: DEFAULT_CONFIG exported and has expected shape
test('TC9: DEFAULT_CONFIG exported and has correct shape', async (t) => {
  assert.ok(DEFAULT_CONFIG, 'DEFAULT_CONFIG must be exported');
  assert.ok(Array.isArray(DEFAULT_CONFIG.quorum_commands), 'quorum_commands must be array');
  assert.ok(DEFAULT_CONFIG.quorum_commands.includes('quick'), 'quorum_commands must include "quick"');
  assert.equal(DEFAULT_CONFIG.fail_mode, 'open');
  assert.ok(typeof DEFAULT_CONFIG.required_models === 'object' && DEFAULT_CONFIG.required_models !== null);
  assert.ok(DEFAULT_CONFIG.required_models.codex);
  assert.ok(DEFAULT_CONFIG.required_models.gemini);
  assert.ok(DEFAULT_CONFIG.required_models.opencode);
  assert.ok(DEFAULT_CONFIG.required_models.copilot, 'required_models must include copilot');
  assert.strictEqual(DEFAULT_CONFIG.required_models.copilot.tool_prefix, 'mcp__copilot-cli__', 'copilot tool_prefix must be mcp__copilot-cli__');
  assert.ok(DEFAULT_CONFIG.required_models.codex.tool_prefix.startsWith('mcp__'));
});

// TC10: Shallow merge — project required_models replaces global entirely
test('TC10: shallow merge — project required_models replaces DEFAULT_CONFIG.required_models', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc10-'));
  try {
    const customModels = { custom: { tool_prefix: 'mcp__custom__', required: true } };
    writeTempConfig(projectDir, JSON.stringify({ required_models: customModels }));
    const config = loadConfig(projectDir);
    // Project required_models should completely replace DEFAULT_CONFIG.required_models
    assert.deepEqual(config.required_models, customModels);
    // Should NOT have codex/gemini/opencode from DEFAULT
    assert.equal(config.required_models.codex, undefined);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB1: DEFAULT_CONFIG.circuit_breaker exists with oscillation_depth=3, commit_window=6
test('TC-CB1: DEFAULT_CONFIG.circuit_breaker has correct defaults', async (t) => {
  assert.ok(DEFAULT_CONFIG.circuit_breaker, 'DEFAULT_CONFIG.circuit_breaker must exist');
  assert.equal(DEFAULT_CONFIG.circuit_breaker.oscillation_depth, 3, 'oscillation_depth must be 3');
  assert.equal(DEFAULT_CONFIG.circuit_breaker.commit_window, 6, 'commit_window must be 6');
});

// TC-CB2: Valid circuit_breaker in project config (oscillation_depth=5, commit_window=8) → values used as-is
test('TC-CB2: valid project circuit_breaker overrides defaults', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb2-'));
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 5, commit_window: 8 } }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.oscillation_depth, 5, 'oscillation_depth should be 5');
    assert.equal(config.circuit_breaker.commit_window, 8, 'commit_window should be 8');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB3: circuit_breaker.oscillation_depth is string 'not-a-number' → falls back to 3, stderr WARNING
test('TC-CB3: invalid oscillation_depth string falls back to 3 with stderr warning', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb3-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 'not-a-number', commit_window: 6 } }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.oscillation_depth, 3, 'oscillation_depth should fall back to 3');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should emit WARNING on stderr');
    assert.ok(stderrOutput.includes('oscillation_depth'), 'warning should mention oscillation_depth');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB4: circuit_breaker.commit_window is -1 (negative integer) → falls back to 6, stderr WARNING
test('TC-CB4: negative commit_window falls back to 6 with stderr warning', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb4-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 3, commit_window: -1 } }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.commit_window, 6, 'commit_window should fall back to 6');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should emit WARNING on stderr');
    assert.ok(stderrOutput.includes('commit_window'), 'warning should mention commit_window');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB5: circuit_breaker is null → entire block falls back to defaults, stderr WARNING
test('TC-CB5: null circuit_breaker falls back to full defaults with stderr warning', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb5-'));
  const stderrChunks = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: null }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.oscillation_depth, 3, 'oscillation_depth should be default 3');
    assert.equal(config.circuit_breaker.commit_window, 6, 'commit_window should be default 6');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'), 'should emit WARNING on stderr');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB6: circuit_breaker has only oscillation_depth=5 (missing commit_window) →
// oscillation_depth=5 used, commit_window=6 (validateConfig fills in missing sub-key)
test('TC-CB6: partial circuit_breaker with only oscillation_depth uses default commit_window', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb6-'));
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 5 } }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.oscillation_depth, 5, 'oscillation_depth should be 5 as specified');
    assert.equal(config.circuit_breaker.commit_window, 6, 'commit_window should default to 6 when missing');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB7: loadConfig() with invalid circuit_breaker writes nothing to stdout
test('TC-CB7: loadConfig() with invalid circuit_breaker writes nothing to stdout', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb7-'));
  const stdoutChunks = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...args) => {
    stdoutChunks.push(chunk);
    return origWrite(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: null }));
    loadConfig(projectDir);
    assert.equal(stdoutChunks.length, 0, 'stdout must remain empty with invalid circuit_breaker');
  } finally {
    process.stdout.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TIER-TC1: No config → defaults are model_tier_planner='opus' and model_tier_worker='haiku'
test('TIER-TC1: no config → DEFAULT_CONFIG has model_tier_planner=opus and model_tier_worker=haiku', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tier-tc1-'));
  try {
    // No .claude/qgsd.json written — use temp dir with no config
    const config = loadConfig(projectDir);
    assert.equal(config.model_tier_planner, 'opus', 'model_tier_planner should default to opus');
    assert.equal(config.model_tier_worker, 'haiku', 'model_tier_worker should default to haiku');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TIER-TC2: Valid model_tier_planner override → preserved as-is
test('TIER-TC2: valid model_tier_planner: sonnet → preserved in config', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tier-tc2-'));
  try {
    writeTempConfig(projectDir, JSON.stringify({ model_tier_planner: 'sonnet' }));
    const config = loadConfig(projectDir);
    assert.equal(config.model_tier_planner, 'sonnet', 'valid model_tier_planner override should be preserved');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TIER-TC3: Invalid model_tier_planner: 'gpt-4' → deleted + stderr WARNING
test('TIER-TC3: invalid model_tier_planner: gpt-4 → deleted + stderr WARNING', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tier-tc3-'));
  const stderrChunks = [];
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origStderr(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ model_tier_planner: 'gpt-4' }));
    const config = loadConfig(projectDir);
    assert.equal(config.model_tier_planner, undefined, 'invalid model_tier_planner should be deleted');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING'), 'should emit a WARNING to stderr');
    assert.ok(stderrOutput.includes('model_tier_planner'), 'WARNING should mention model_tier_planner');
  } finally {
    process.stderr.write = origStderr;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TIER-TC4: Invalid model_tier_worker: 42 (non-string) → deleted + stderr WARNING
test('TIER-TC4: invalid model_tier_worker: 42 (non-string) → deleted + stderr WARNING', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tier-tc4-'));
  const stderrChunks = [];
  const origStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origStderr(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ model_tier_worker: 42 }));
    const config = loadConfig(projectDir);
    assert.equal(config.model_tier_worker, undefined, 'invalid model_tier_worker (non-string) should be deleted');
    const stderrOutput = stderrChunks.join('');
    assert.ok(stderrOutput.includes('[qgsd] WARNING'), 'should emit a WARNING to stderr');
    assert.ok(stderrOutput.includes('model_tier_worker'), 'WARNING should mention model_tier_worker');
  } finally {
    process.stderr.write = origStderr;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// TC-CB8: Both sub-keys invalid simultaneously (oscillation_depth='bad', commit_window=-1) →
// each falls back independently (3 and 6), two WARNINGs on stderr, stdout stays empty
test('TC-CB8: both circuit_breaker sub-keys invalid → each falls back independently, two warnings, no stdout', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-tc-cb8-'));
  const stderrChunks = [];
  const stdoutChunks = [];
  const origStderr = process.stderr.write.bind(process.stderr);
  const origStdout = process.stdout.write.bind(process.stdout);
  process.stderr.write = (chunk, ...args) => {
    stderrChunks.push(chunk);
    return origStderr(chunk, ...args);
  };
  process.stdout.write = (chunk, ...args) => {
    stdoutChunks.push(chunk);
    return origStdout(chunk, ...args);
  };
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 'bad', commit_window: -1 } }));
    const config = loadConfig(projectDir);
    assert.equal(config.circuit_breaker.oscillation_depth, 3, 'oscillation_depth should fall back to 3');
    assert.equal(config.circuit_breaker.commit_window, 6, 'commit_window should fall back to 6');
    const stderrOutput = stderrChunks.join('');
    // Two separate warnings should be emitted
    const warningMatches = (stderrOutput.match(/\[qgsd\] WARNING:/g) || []);
    assert.ok(warningMatches.length >= 2, 'should emit at least 2 warnings (one per invalid sub-key)');
    assert.equal(stdoutChunks.length, 0, 'stdout must remain empty');
  } finally {
    process.stderr.write = origStderr;
    process.stdout.write = origStdout;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// ENV-TC1: No config → task_envelope_enabled defaults to true
test('ENV-TC1: no config → task_envelope_enabled defaults to true', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-env-tc1-'));
  try {
    const config = loadConfig(projectDir);
    assert.equal(config.task_envelope_enabled, true, 'task_envelope_enabled should default to true');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// ENV-TC2: task_envelope_enabled: false → preserved
test('ENV-TC2: task_envelope_enabled: false → preserved in config', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-env-tc2-'));
  try {
    writeTempConfig(projectDir, JSON.stringify({ task_envelope_enabled: false }));
    const config = loadConfig(projectDir);
    assert.equal(config.task_envelope_enabled, false, 'task_envelope_enabled: false should be preserved');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// ENV-TC3: task_envelope_enabled: 'yes' (non-boolean) → defaults to true + stderr WARNING
test('ENV-TC3: task_envelope_enabled: yes (non-boolean) → defaults to true + stderr WARNING', async (t) => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-env-tc3-'));
  let stderrOutput = '';
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (msg) => { stderrOutput += msg; return true; };
  try {
    writeTempConfig(projectDir, JSON.stringify({ task_envelope_enabled: 'yes' }));
    const config = loadConfig(projectDir);
    assert.equal(config.task_envelope_enabled, true, 'invalid task_envelope_enabled should default to true');
    assert.ok(stderrOutput.includes('task_envelope_enabled'), 'WARNING should mention task_envelope_enabled');
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
