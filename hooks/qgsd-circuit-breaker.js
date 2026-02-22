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

// Gets the unified diff between two commits for a specific set of files.
// Returns the raw diff string, or empty string on error (fail-open).
// olderHash is the earlier commit, newerHash is the later commit (forward in time).
function getCommitDiff(gitRoot, olderHash, newerHash, files) {
  const result = spawnSync(
    'git',
    ['diff', olderHash, newerHash, '--', ...files],
    { cwd: gitRoot, encoding: 'utf8', timeout: 5000 }
  );
  if (result.status !== 0 || result.error) return '';
  return result.stdout || '';
}

// Second-pass reversion check: given the hashes (newest-first) belonging to
// run-groups for an oscillating file set key, and the files in that set,
// check whether any consecutive pair shows net deletions (true reversion) or
// all pairs are purely additive (TDD progression).
//
// hashes: all commit hashes (newest-first) in the oscillating run-groups
// files: file paths in the oscillating set
// gitRoot: git repository root
//
// Returns true if real oscillation (net deletions found), false if TDD progression.
// Returns true also if ALL pairs errored out (git unavailable → fall back to original behavior).
function hasReversionInHashes(gitRoot, hashes, files) {
  // hashes are newest-first; consecutive pairs: (hashes[i], hashes[i-1]) where
  // hashes[i] is older (higher index = earlier in time), hashes[i-1] is newer.
  // We diff older → newer: git diff <hashes[i]> <hashes[i-1]>
  let pairsChecked = 0;
  let errorsOnly = true;

  for (let i = hashes.length - 1; i >= 1; i--) {
    const olderHash = hashes[i];
    const newerHash = hashes[i - 1];
    const diff = getCommitDiff(gitRoot, olderHash, newerHash, files);

    if (diff === '') {
      // git error — skip this pair (fail-open for individual pair)
      continue;
    }

    errorsOnly = false;
    pairsChecked++;

    // Parse diff: count net deletions (lines starting with '-' but not '---')
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++')) continue;
      if (line.startsWith('+')) additions++;
      else if (line.startsWith('-')) deletions++;
    }

    // Any net deletions in this pair → real oscillation (content was removed)
    if (deletions > 0) {
      return true;
    }
  }

  // If all pairs errored out → fall back to original behavior (treat as oscillation)
  if (errorsOnly) return true;

  // All pairs were purely additive → TDD progression, not oscillation
  return false;
}

// Detects true oscillation: returns { detected: bool, fileSet: string[] }
//
// Algorithm: collapse consecutive identical file sets into run-groups first,
// then count how many times each file set's group appears in the collapsed
// sequence. This correctly handles patterns like A A A B B A A B B B A A
// (3 A-groups, 2 B-groups → oscillation at depth 3) while ignoring simple
// iterative refinement like A A A (1 A-group → not oscillation).
//
// Second-pass reversion check: when a file set reaches >= depth run-groups,
// diff consecutive pairs to confirm content was actually reverted (net deletions).
// If all pairs are purely additive (TDD progression), do NOT flag as oscillation.
//
// hashes: commit hashes array (newest-first, same order as fileSets)
// gitRoot: git repository root (used for diff-based reversion check)
function detectOscillation(fileSets, depth, hashes, gitRoot) {
  // Step 1: collapse consecutive identical file sets into runs, tracking indices
  const runs = [];
  for (let i = 0; i < fileSets.length; i++) {
    const files = fileSets[i];
    const key = files.slice().sort().join('\0');
    if (runs.length === 0 || runs[runs.length - 1].key !== key) {
      runs.push({ key, files, indices: [i] });
    } else {
      runs[runs.length - 1].indices.push(i);
    }
  }

  // Step 2: count run-group occurrences per file set key, tracking which runs belong to each key
  const keyRuns = new Map(); // key → array of run objects
  for (const run of runs) {
    if (!keyRuns.has(run.key)) keyRuns.set(run.key, []);
    keyRuns.get(run.key).push(run);
  }

  // Step 3: any file set with >= depth run-groups is a candidate for oscillation
  for (const [key, keyRunList] of keyRuns) {
    if (keyRunList.length >= depth) {
      const files = key.split('\0').filter(f => f.length > 0);

      // Second-pass reversion check (if hashes and gitRoot provided)
      if (hashes && gitRoot && hashes.length > 0) {
        // Collect all hashes from the oscillating run-groups (newest-first order preserved)
        const oscillatingHashes = [];
        for (const run of keyRunList) {
          for (const idx of run.indices) {
            if (idx < hashes.length) oscillatingHashes.push(hashes[idx]);
          }
        }
        // Sort by index position (newest-first as they appear in hashes array)
        // The indices are already ordered since we iterate runs in order
        const isRealOscillation = hasReversionInHashes(gitRoot, oscillatingHashes, files);
        if (!isRealOscillation) {
          // All additive → TDD progression, not a real loop
          return { detected: false, fileSet: [] };
        }
      }

      return { detected: true, fileSet: files };
    }
  }
  return { detected: false, fileSet: [] };
}

// Consults Claude Haiku to verify whether detected oscillation is genuine
// (a real bug loop) or iterative refinement (the same files improved repeatedly).
// Returns 'GENUINE', 'REFINEMENT', or null if the API is unavailable.
async function consultHaiku(gitRoot, fileSet, fileSets, model) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const logResult = spawnSync('git', ['log', '--oneline', '-10'], {
    cwd: gitRoot, encoding: 'utf8', timeout: 5000,
  });
  const gitLog = logResult.stdout || '(unavailable)';

  // Collect short diffs for the oscillating commits
  const hashResult = spawnSync('git', ['log', '--format=%H', '-10'], {
    cwd: gitRoot, encoding: 'utf8', timeout: 5000,
  });
  const hashes = (hashResult.stdout || '').trim().split('\n').filter(Boolean);
  const diffs = [];
  for (const hash of hashes.slice(0, 8)) {
    const d = spawnSync('git', ['diff-tree', '-p', '--no-commit-id', '-r', hash], {
      cwd: gitRoot, encoding: 'utf8', timeout: 5000,
    });
    if (d.stdout) diffs.push(`--- ${hash.slice(0, 7)} ---\n${d.stdout.slice(0, 800)}`);
  }

  const prompt =
    `You are a circuit breaker analyzer for a coding agent. A potential oscillation pattern was detected.\n\n` +
    `Oscillating file set: ${fileSet.join(', ')}\n\n` +
    `Recent git log:\n${gitLog}\n\n` +
    `Recent diffs (truncated):\n${diffs.join('\n\n').slice(0, 3000)}\n\n` +
    `Question: Is this GENUINE oscillation (the same bug being introduced and fixed repeatedly, agent stuck in a loop) ` +
    `or REFINEMENT (developer/agent iteratively improving the same files toward a clear goal, e.g. adjusting a banner message, tuning output)?\n\n` +
    `Reply with exactly one word: GENUINE or REFINEMENT`;

  const https = require('https');
  const body = JSON.stringify({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 12000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = ((parsed.content || [])[0] || {}).text || '';
          const verdict = text.trim().toUpperCase();
          resolve(verdict.startsWith('REFINEMENT') ? 'REFINEMENT' : 'GENUINE');
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
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
    'After committing the fix manually, run \'npx qgsd --reset-breaker\' to clear the circuit breaker.',
    'To temporarily disable the circuit breaker for deliberate iterative work, run \'npx qgsd --disable-breaker\'.',
    'Re-enable with \'npx qgsd --enable-breaker\' when done.'
  );

  return lines.join('\n');
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', async () => {
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

      // DISABLE-01: If circuit breaker is disabled, skip all detection and enforcement
      if (state && state.disabled) {
        process.exit(0);
      }

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
      const result = detectOscillation(fileSets, config.circuit_breaker.oscillation_depth, hashes, gitRoot);
      if (!result.detected) {
        process.exit(0);
      }

      // HAIKU-01: Consult Haiku to verify before blocking (if enabled)
      if (config.circuit_breaker.haiku_reviewer) {
        const verdict = await consultHaiku(gitRoot, result.fileSet, fileSets, config.circuit_breaker.haiku_model);
        if (verdict === 'REFINEMENT') {
          // Haiku confirmed this is iterative refinement, not a bug loop — do not block
          process.exit(0);
        }
        // verdict === 'GENUINE' or null (API unavailable) → trust the algorithm and block
      }

      writeState(statePath, result.fileSet, fileSets);
      process.exit(0);
    } catch {
      process.exit(0); // Fail-open on any error
    }
  });
}

if (require.main === module) main();

module.exports = { buildBlockReason };
