#!/usr/bin/env node
// hooks/qgsd-circuit-breaker.js
// PreToolUse hook — oscillation detection, state persistence, and enforcement for circuit breaker.
//
// Reads JSON from stdin (Claude Code PreToolUse event payload), checks for oscillation
// in git history when Bash commands are executed, and persists breaker state across
// invocations. Phase 7: enforcement blocking + config-driven thresholds.
//
// Config-driven defaults via loadConfig(gitRoot): oscillation_depth and commit_window
// State file: .claude/circuit-breaker-state.json (gitignored)

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./config-loader');

// Read-only command regex: git log/diff/diff-tree/status/show/blame, grep, cat, ls, head, tail, find
const READ_ONLY_REGEX = /^\s*(git\s+(log|diff|diff-tree|status|show|blame)|grep|cat\s|ls(\s|$)|head|tail|find)\s*/;

// Returns git root directory or null if not a git repo
function getGitRoot(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0 || result.error) return null;
  return result.stdout.trim() || null;
}

// Reads existing state file, returns object or null
function readState(statePath) {
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null; // Malformed or error
  }
}

// Returns true if command is read-only (should not trigger detection)
function isReadOnly(command) {
  return READ_ONLY_REGEX.test(command);
}

// Gets last N commit hashes via git log
function getCommitHashes(gitRoot, window) {
  const result = spawnSync('git', ['log', `--format=%H`, `-${window}`], {
    cwd: gitRoot,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.status !== 0 || result.error) return [];
  return result.stdout.trim().split('\n').filter(h => h.length > 0);
}

// Gets file sets for each commit hash using diff-tree.
// --root ensures root commits (no parent) also report their files.
function getCommitFileSets(gitRoot, hashes) {
  const sets = [];
  for (const hash of hashes) {
    const result = spawnSync(
      'git',
      ['diff-tree', '--no-commit-id', '-r', '--name-only', '--root', hash],
      { cwd: gitRoot, encoding: 'utf8', timeout: 5000 }
    );
    if (result.status !== 0 || result.error) {
      sets.push([]);
    } else {
      const files = result.stdout.trim().split('\n').filter(f => f.length > 0);
      sets.push(files);
    }
  }
  return sets;
}

// Detects oscillation: returns { detected: bool, fileSet: string[] }
function detectOscillation(fileSets, depth) {
  const count = new Map();
  for (const files of fileSets) {
    const key = files.slice().sort().join('\0'); // Null-byte separator
    count.set(key, (count.get(key) || 0) + 1);
  }
  for (const [key, occurrences] of count) {
    if (occurrences >= depth) {
      return { detected: true, fileSet: key.split('\0').filter(f => f.length > 0) };
    }
  }
  return { detected: false, fileSet: [] };
}

// Writes state file
function writeState(statePath, fileSet, snapshot) {
  try {
    const stateDir = path.dirname(statePath);
    fs.mkdirSync(stateDir, { recursive: true });
    const state = {
      active: true,
      file_set: fileSet,
      activated_at: new Date().toISOString(),
      commit_window_snapshot: snapshot
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[qgsd] WARNING: Could not write circuit breaker state: ${e.message}\n`);
    // Fail-open: do not block execution
  }
}

// Builds the block reason message for the deny decision (ENFC-02/03)
function buildBlockReason(state) {
  const fileList = (state.file_set || []).join(', ') || '(unknown)';
  const snapshot = state.commit_window_snapshot;
  const lines = [
    'CIRCUIT BREAKER ACTIVE',
    '',
    'Oscillating file set detected: ' + fileList,
    '',
  ];

  if (Array.isArray(snapshot) && snapshot.length > 0) {
    lines.push('Commit Graph (most recent first):');
    lines.push('| # | Files Changed |');
    lines.push('|---|---------------|');
    snapshot.forEach((files, index) => {
      const fileStr = Array.isArray(files) && files.length > 0 ? files.join(', ') : '(empty)';
      lines.push(`| ${index + 1} | ${fileStr} |`);
    });
    lines.push('');
  } else {
    lines.push('(commit graph unavailable)');
    lines.push('');
  }

  lines.push(
    'Invoke Oscillation Resolution Mode per R5 in CLAUDE.md — see get-shit-done/workflows/oscillation-resolution-mode.md for the full procedure.',
    '',
    'Allowed read-only operations: git log, git diff, grep, cat, ls, head, tail, find',
    '',
    'After committing the fix manually, run \'npx qgsd --reset-breaker\' to clear the circuit breaker.'
  );

  return lines.join('\n');
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw);
      const command = (input.tool_input && input.tool_input.command) || '';
      const cwd = input.cwd || process.cwd();

      // Get git root
      const gitRoot = getGitRoot(cwd);
      if (!gitRoot) {
        process.exit(0); // DETECT-05: not a git repo
      }

      // Check existing state
      const statePath = path.join(gitRoot, '.claude', 'circuit-breaker-state.json');
      const state = readState(statePath);
      if (state && state.active) {
        // ENFC-01/02/03: Enforce blocking on write commands; allow read-only
        if (!isReadOnly(command)) {
          process.stdout.write(JSON.stringify({
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: buildBlockReason(state),
            }
          }));
        }
        process.exit(0);
      }

      // Check if read-only
      if (isReadOnly(command)) {
        process.exit(0); // DETECT-04: read-only command
      }

      // Load config for detection thresholds
      const config = loadConfig(gitRoot);
      const hashes = getCommitHashes(gitRoot, config.circuit_breaker.commit_window);
      const fileSets = getCommitFileSets(gitRoot, hashes);

      // Detect oscillation
      const result = detectOscillation(fileSets, config.circuit_breaker.oscillation_depth);
      if (result.detected) {
        writeState(statePath, result.fileSet, fileSets);
      }

      process.exit(0);
    } catch {
      process.exit(0); // Fail-open on any error
    }
  });
}

if (require.main === module) main();

module.exports = { buildBlockReason };
