#!/usr/bin/env node
// hooks/qgsd-circuit-breaker.js
// PreToolUse hook — oscillation detection, state persistence, and notification for circuit breaker.
//
// Reads JSON from stdin (Claude Code PreToolUse event payload), checks for oscillation
// in git history when Bash commands are executed, and persists breaker state across
// invocations. Non-blocking: all tool calls are allowed through; oscillation is reported
// as a priority warning via the hook output so Claude sees it without being hard-blocked.
//
// Config-driven defaults via loadConfig(gitRoot): oscillation_depth and commit_window
// State file: .claude/circuit-breaker-state.json (gitignored)

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./config-loader');
const { schema_version } = require('./conformance-schema.cjs');

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

// Returns true if command is read-only (skip detection on read-only commands)
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
// determines whether the pattern is true oscillation or TDD progression.
//
// Algorithm: sum net change (additions - deletions) across all consecutive pairs.
// - Positive total net change → file grew overall → TDD progression (not oscillation).
// - Zero or negative total net change → file didn't grow → true oscillation.
//
// This correctly handles TDD patterns where a line like `module.exports` is modified
// (1 deletion, 1 addition per commit) alongside net-new lines — the net change remains
// positive because new functions are added each time.
//
// For true oscillation (same content toggled back and forth), each pair is symmetric
// (same number added as removed) so the total net change is zero.
//
// hashes: all commit hashes (newest-first) in the oscillating run-groups
// files: file paths in the oscillating set
// gitRoot: git repository root
//
// Returns true if real oscillation (net change <= 0), false if TDD progression (net change > 0).
// Returns true also if ALL pairs errored out (git unavailable → fall back to original behavior).
function hasReversionInHashes(gitRoot, hashes, files) {
  // hashes are newest-first; consecutive pairs: (hashes[i], hashes[i-1]) where
  // hashes[i] is older (higher index = earlier in time), hashes[i-1] is newer.
  // We diff older → newer: git diff <hashes[i]> <hashes[i-1]>
  let totalNetChange = 0;
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

    // Parse diff: count additions and deletions (excluding file header lines)
    const lines = diff.split('\n');
    let additions = 0;
    let deletions = 0;
    for (const line of lines) {
      if (line.startsWith('---') || line.startsWith('+++')) continue;
      if (line.startsWith('+')) additions++;
      else if (line.startsWith('-')) deletions++;
    }

    totalNetChange += (additions - deletions);
  }

  // If all pairs errored out → fall back to original behavior (treat as oscillation)
  if (errorsOnly) return true;

  // Positive net change → file grew overall → TDD progression, not oscillation
  // Zero or negative net change → file didn't grow → real oscillation
  return totalNetChange <= 0;
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

// Appends a false-negative entry to .claude/circuit-breaker-false-negatives.json
// for audit trail when Haiku classifies detected oscillation as REFINEMENT.
// Fail-open: any error is logged to stderr but does not block the tool call.
function appendFalseNegative(statePath, fileSet) {
  try {
    const fnLogPath = statePath.replace('circuit-breaker-state.json', 'circuit-breaker-false-negatives.json');
    let existing = [];
    if (fs.existsSync(fnLogPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(fnLogPath, 'utf8'));
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }
    }
    existing.push({
      detected_at: new Date().toISOString(),
      file_set: fileSet,
      reviewer: 'haiku',
      verdict: 'REFINEMENT',
    });
    fs.writeFileSync(fnLogPath, JSON.stringify(existing, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[qgsd] WARNING: Could not write false-negative log: ${e.message}\n`);
    // Fail-open: do not block execution
  }
}

// Returns path to oscillation log file for the given git root
function getOscillationLogPath(gitRoot) {
  return path.join(gitRoot, '.planning', 'oscillation-log.json');
}

// Reads oscillation log, returns {} on missing or parse error
function readOscillationLog(logPath) {
  if (!fs.existsSync(logPath)) return {};
  try { return JSON.parse(fs.readFileSync(logPath, 'utf8')); }
  catch { return {}; }
}

// Writes oscillation log, fails open with stderr warning
function writeOscillationLog(logPath, log) {
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[qgsd] WARNING: Could not write oscillation log: ${e.message}\n`);
  }
}

// SHA-1 of sorted file list, 12 hex chars
function makeFileSetHash(files) {
  return crypto.createHash('sha1')
    .update(files.slice().sort().join('\0'))
    .digest('hex').slice(0, 12);
}

// SHA-1 of run-group sequence (same collapse as detectOscillation step 1), 12 hex chars
function makePatternHash(fileSets) {
  const runKeys = [];
  for (const files of fileSets) {
    const key = files.slice().sort().join('\0');
    if (runKeys.length === 0 || runKeys[runKeys.length - 1] !== key) {
      runKeys.push(key);
    }
  }
  return crypto.createHash('sha1')
    .update(runKeys.join('|'))
    .digest('hex').slice(0, 12);
}

// Appends a structured conformance event to .planning/conformance-events.jsonl.
// Uses appendFileSync (atomic for writes < POSIX PIPE_BUF = 4096 bytes).
// Always wrapped in try/catch — hooks are fail-open; never crashes on logging failure.
// NEVER writes to stdout — stdout is the Claude Code hook decision channel.
function appendConformanceEvent(event) {
  try {
    const logPath = path.join(process.cwd(), '.planning', 'conformance-events.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf8');
  } catch (err) {
    process.stderr.write('[qgsd] conformance log write failed: ' + err.message + '\n');
  }
}

// Builds the deny reason block for when the circuit breaker is active.
// Returns a message explaining the block and how to resolve it.
function buildBlockReason(state) {
  const fileList = (state.file_set || []).join(', ') || '(unknown)';
  const snapshot = state.commit_window_snapshot;
  const lines = [
    'CIRCUIT BREAKER ACTIVE',
    '',
    'Oscillating file set: ' + fileList,
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
    'Read-only operations are still allowed (e.g. git log --oneline to review the commit history).',
    'You must manually commit a root-cause fix before write operations are unblocked.',
    '',
    "After committing the fix, run 'npx qgsd --reset-breaker' to clear the circuit breaker state.",
  );
  return lines.join('\n');
}

// Builds the priority warning notice for the allow decision
// Returns a message Claude will see in the hook output (non-blocking notification)
function buildWarningNotice(state) {
  const fileList = (state.file_set || []).join(', ') || '(unknown)';
  const snapshot = state.commit_window_snapshot;
  const lines = [
    'OSCILLATION DETECTED — PRIORITY NOTICE',
    '',
    'Oscillating file set: ' + fileList,
    '',
    'Fix the oscillation in the listed files before continuing.',
    'Run git log to see the pattern. Do NOT make more commits to these files until the root cause is resolved.',
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
  }

  lines.push(
    'Invoke Oscillation Resolution Mode per R5 in CLAUDE.md — see get-shit-done/workflows/oscillation-resolution-mode.md for the full procedure.',
    '',
    'After committing the fix, run \'npx qgsd --reset-breaker\' to clear the circuit breaker state.',
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
      const cwd = input.cwd || process.cwd();

      const hookEvent = input.hook_event_name || input.hookEventName || 'PreToolUse';
      const toolName = input.tool_name || input.toolName || '';

      // Get git root — shared by both handlers
      const gitRoot = getGitRoot(cwd);
      if (!gitRoot) {
        process.exit(0); // DETECT-05: not a git repo
      }

      const config = loadConfig(gitRoot);
      const logPath = getOscillationLogPath(gitRoot);

      // ── PostToolUse: Haiku convergence check ─────────────────────────────
      if (hookEvent === 'PostToolUse' && toolName === 'Bash') {
        const log = readOscillationLog(logPath);
        const activeKeys = Object.keys(log).filter(k => !log[k].resolvedAt);
        if (activeKeys.length === 0) process.exit(0);

        const toolOutput = (input.tool_response &&
          (input.tool_response.output || input.tool_response.stdout)) || '';
        const lastCommitResult = spawnSync('git', ['log', '--oneline', '-1'], {
          cwd: gitRoot, encoding: 'utf8', timeout: 5000,
        });
        const lastCommit = (lastCommitResult.stdout || '').trim();

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) process.exit(0);

        const activeEntry = log[activeKeys[0]];
        const haikuPrompt =
          `You are a circuit breaker monitor. An oscillation was detected on files: ${activeEntry.files.join(', ')}.\n\n` +
          `A Bash command just completed. Output (truncated):\n${toolOutput.slice(0, 2000)}\n\n` +
          `Last git commit: ${lastCommit}\n\n` +
          `Does this output indicate the oscillation has been resolved (e.g. tests passing, fix committed)?\n` +
          `Reply with exactly one word: YES or NO`;

        const requestBody = JSON.stringify({
          model: config.circuit_breaker.haiku_model,
          max_tokens: 10,
          messages: [{ role: 'user', content: haikuPrompt }],
        });

        const nodeScript = `
const https = require('https');
const body = process.env.HAIKU_BODY;
const apiKey = process.env.ANTHROPIC_API_KEY;
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
  let d = '';
  res.on('data', c => { d += c; });
  res.on('end', () => {
    try {
      const p = JSON.parse(d);
      process.stdout.write(((p.content||[])[0]||{}).text||'NO');
    } catch { process.stdout.write('NO'); }
  });
});
req.on('error', () => process.stdout.write('NO'));
req.on('timeout', () => { req.destroy(); process.stdout.write('NO'); });
req.write(body);
req.end();
`;

        try {
          const spawnResult = spawnSync('node', ['-e', nodeScript], {
            env: { ...process.env, HAIKU_BODY: requestBody },
            encoding: 'utf8',
            timeout: 15000,
          });
          const verdict = (spawnResult.stdout || '').trim().toUpperCase();

          if (verdict.startsWith('YES')) {
            const resolvedHashResult = spawnSync('git', ['log', '--format=%H', '-1'], {
              cwd: gitRoot, encoding: 'utf8', timeout: 5000,
            });
            const resolvedCommit = (resolvedHashResult.stdout || '').trim() || null;
            const now = new Date().toISOString();
            for (const k of activeKeys) {
              log[k].resolvedAt = now;
              log[k].resolvedByCommit = resolvedCommit;
              log[k].haikuRationale = `Haiku YES on Bash output; last commit: ${lastCommit}`;
            }
            writeOscillationLog(logPath, log);
            // Clear state file so PreToolUse stops warning
            const statePath = path.join(gitRoot, '.claude', 'circuit-breaker-state.json');
            try { if (fs.existsSync(statePath)) fs.rmSync(statePath); } catch {}
            process.stderr.write(`[qgsd] INFO: Oscillation resolved by Haiku — circuit breaker cleared.\n`);
          }
        } catch (e) {
          process.stderr.write(`[qgsd] WARNING: PostToolUse Haiku check failed: ${e.message}\n`);
        }
        process.exit(0);
      }

      // ── PreToolUse: oscillation detection + notification ─────────────────
      const command = (input.tool_input && input.tool_input.command) || '';

      // Check existing state
      const statePath = path.join(gitRoot, '.claude', 'circuit-breaker-state.json');
      const state = readState(statePath);

      // DISABLE-01: If circuit breaker is disabled, skip all detection and notification
      if (state && state.disabled) {
        process.exit(0);
      }

      // DETECT-04: Skip detection for read-only commands (BEFORE active state check)
      if (isReadOnly(command)) {
        process.exit(0);
      }

      if (state && state.active) {
        // Check if already resolved in log
        const fileSetHash = makeFileSetHash(state.file_set || []);
        const logKey = `${fileSetHash}:legacy`;
        const log = readOscillationLog(logPath);
        if (log[logKey] && log[logKey].resolvedAt) {
          process.exit(0); // Already resolved
        }
        // Breaker already active — emit deny decision
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: buildBlockReason(state),
          }
        }));
        process.exit(0);
      }

      const hashes = getCommitHashes(gitRoot, config.circuit_breaker.commit_window);
      const fileSets = getCommitFileSets(gitRoot, hashes);

      // Detect oscillation
      const result = detectOscillation(fileSets, config.circuit_breaker.oscillation_depth, hashes, gitRoot);
      if (!result.detected) {
        process.exit(0);
      }

      // HAIKU-01: Consult Haiku to verify before notifying (if enabled)
      if (config.circuit_breaker.haiku_reviewer) {
        const verdict = await consultHaiku(gitRoot, result.fileSet, fileSets, config.circuit_breaker.haiku_model);
        if (verdict === 'REFINEMENT') {
          // Haiku confirmed this is iterative refinement, not a bug loop — do not notify.
          // Log false-negative for auditability (stderr + persistent file).
          process.stderr.write(`[qgsd] INFO: circuit breaker false-negative — Haiku classified oscillation as REFINEMENT (files: ${result.fileSet.join(', ')}). Allowing tool call to proceed.\n`);
          appendFalseNegative(statePath, result.fileSet);
          process.exit(0);
        }
        // verdict === 'GENUINE' or null (API unavailable) → trust the algorithm and notify
      }

      // Log-based suppression: if this exact oscillation was already resolved, skip
      const fileSetHash = makeFileSetHash(result.fileSet);
      const patternHash = makePatternHash(fileSets);
      const logKey = `${fileSetHash}:${patternHash}`;
      const oscLog = readOscillationLog(logPath);
      if (oscLog[logKey] && oscLog[logKey].resolvedAt) {
        // Already resolved — suppress warning entirely
        process.exit(0);
      }
      // Upsert log entry
      oscLog[logKey] = {
        files: result.fileSet.slice().sort(),
        pattern: fileSets.map(s => s.slice().sort().join(',')).join(' | '),
        firstSeen: (oscLog[logKey] && oscLog[logKey].firstSeen) ? oscLog[logKey].firstSeen : new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        resolvedAt: null,
        resolvedByCommit: null,
        haikuRationale: null,
        manualResetAt: (oscLog[logKey] && oscLog[logKey].manualResetAt) ? oscLog[logKey].manualResetAt : null,
      };
      writeOscillationLog(logPath, oscLog);

      // Write state so qgsd-prompt.js picks it up on next user message
      writeState(statePath, result.fileSet, fileSets);

      appendConformanceEvent({
        ts:              new Date().toISOString(),
        phase:           'IDLE',
        action:          'circuit_break',
        slots_available: 0,
        vote_result:     null,
        outcome:         'BLOCK',
        schema_version,
      });

      // State written — exit silently on first detection (warning emitted on next call via active state path)
      process.exit(0);
    } catch {
      process.exit(0); // Fail-open on any error
    }
  });
}

if (require.main === module) main();

module.exports = { buildWarningNotice, buildBlockReason };
