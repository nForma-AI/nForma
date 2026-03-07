#!/usr/bin/env node
// hooks/nf-session-start.js
// SessionStart hook — syncs nForma keychain secrets into ~/.claude.json
// on every session start so mcpServers env blocks always reflect current keychain state.
//
// Runs synchronously (hook expects process to exit) — uses async IIFE with catch.

'use strict';

const path = require('path');
const os   = require('os');
const fs   = require('fs');

const { loadConfig, shouldRunHook } = require('./config-loader');

// ─── Stdin accumulation (for hook input JSON containing cwd) ─────────────────
let _stdinRaw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => _stdinRaw += c);

let _stdinReady;
const _stdinPromise = new Promise(resolve => { _stdinReady = resolve; });
process.stdin.on('end', () => _stdinReady());

// Locate secrets.cjs — try installed global path first, then local dev path.
//
// IMPORTANT: install.js copies bin/*.cjs to ~/.claude/nf-bin/ (not ~/.claude/nf/bin/).
// See bin/install.js line ~1679: binDest = path.join(targetDir, 'nf-bin')
// where targetDir = os.homedir() + '/.claude'.
function findSecrets() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'nf-bin', 'secrets.cjs'),  // installed path
    path.join(__dirname, '..', 'bin', 'secrets.cjs'),                 // local dev path
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch (_) {}
  }
  return null;
}

// Locate memory-store.cjs — try installed global path first, then local dev path.
function findMemoryStore() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'nf-bin', 'memory-store.cjs'),
    path.join(__dirname, '..', 'bin', 'memory-store.cjs'),
  ];
  for (const p of candidates) {
    try { return require(p); } catch (_) {}
  }
  return null;
}

// ─── State reminder parser ──────────────────────────────────────────────────

/**
 * Parse STATE.md content for an in-progress phase and return a terse reminder.
 * Returns null if no reminder is needed (complete, not started, or missing fields).
 * @param {string} stateContent - Raw STATE.md content.
 * @returns {string|null}
 */
function parseStateForReminder(stateContent) {
  if (!stateContent || typeof stateContent !== 'string') return null;

  const phaseMatch = stateContent.match(/Phase:\s*(.+)/);
  const statusMatch = stateContent.match(/Status:\s*(.+)/);
  const planMatch = stateContent.match(/Plan:\s*(.+)/);
  const lastMatch = stateContent.match(/Last activity:\s*(.+)/);

  if (!phaseMatch) return null;
  if (!statusMatch) return null;

  const status = statusMatch[1].trim();
  if (status === 'Complete' || status === 'Not started') return null;

  const phase = phaseMatch[1].trim();
  const plan = planMatch ? planMatch[1].trim() : 'unknown plan';
  const lastActivity = lastMatch ? lastMatch[1].trim() : 'unknown';

  return 'SESSION STATE REMINDER: Phase ' + phase + ' -- ' + plan + ' -- ' + status + ' (last: ' + lastActivity + ')';
}

(async () => {
  // Resolve project cwd from hook input JSON
  await _stdinPromise;
  let _hookCwd = process.cwd();
  try { _hookCwd = JSON.parse(_stdinRaw).cwd || process.cwd(); } catch (_) {}

  // Profile guard — exit early if this hook is not active for the current profile
  const config = loadConfig(_hookCwd);
  const profile = config.hook_profile || 'standard';
  if (!shouldRunHook('nf-session-start', profile)) {
    process.exit(0);
  }

  const secrets = findSecrets();
  if (!secrets) {
    // silently skip — nForma may not be installed yet or keytar absent
    process.exit(0);
  }
  try {
    await secrets.syncToClaudeJson(secrets.SERVICE);
  } catch (e) {
    // Non-fatal — write to stderr for debug logs, but never block session start
    process.stderr.write('[nf-session-start] sync error: ' + e.message + '\n');
  }

  // Populate CCR config from keytar (fail-silent — CCR may not be installed)
  try {
    const { execFileSync } = require('child_process');
    const nodeFsRef = require('fs');
    const ccrCandidates = [
      path.join(os.homedir(), '.claude', 'nf-bin', 'ccr-secure-config.cjs'),
      path.join(__dirname, '..', 'bin', 'ccr-secure-config.cjs'),
    ];
    let ccrConfigPath = null;
    for (const p of ccrCandidates) {
      if (nodeFsRef.existsSync(p)) { ccrConfigPath = p; break; }
    }
    if (ccrConfigPath) {
      execFileSync(process.execPath, [ccrConfigPath], { stdio: 'pipe', timeout: 10000 });
    }
  } catch (e) {
    process.stderr.write('[nf-session-start] CCR config error: ' + e.message + '\n');
  }

  // Collect all additionalContext pieces — write once at the end
  const _contextPieces = [];

  // Telemetry surfacing — inject top unsurfaced issue as additionalContext
  // Guard: only active when running inside the nForma dev repo itself
  try {
    const pkgPath = path.join(_hookCwd, 'package.json');
    const isNfRepo = fs.existsSync(pkgPath) &&
      JSON.parse(fs.readFileSync(pkgPath, 'utf8')).name === 'nforma';
    const fixesPath = path.join(_hookCwd, '.planning', 'telemetry', 'pending-fixes.json');
    if (isNfRepo && fs.existsSync(fixesPath)) {
      const fixes = JSON.parse(fs.readFileSync(fixesPath, 'utf8'));
      const issue = (fixes.issues || []).find(i => !i.surfaced && i.priority >= 50);
      if (issue) {
        issue.surfaced = true;
        issue.surfacedAt = new Date().toISOString();
        fs.writeFileSync(fixesPath, JSON.stringify(fixes, null, 2), 'utf8');
        _contextPieces.push('Telemetry alert [priority=' + issue.priority + ']: ' + issue.description + '\nSuggested fix: ' + issue.action);
      }
    }
  } catch (_) {}

  // Session state reminder — inject brief context when work is in progress
  try {
    const statePath = path.join(_hookCwd, '.planning', 'STATE.md');
    if (fs.existsSync(statePath)) {
      const stateContent = fs.readFileSync(statePath, 'utf8');
      const reminder = parseStateForReminder(stateContent);
      if (reminder) {
        _contextPieces.push(reminder);
      }
    }
  } catch (_) {}

  // Memory reminder injection (MEMP-02)
  try {
    const memStore = findMemoryStore();
    if (memStore && memStore.generateSessionReminder) {
      const hasTelemetry = _contextPieces.some(p => p.includes('Telemetry alert'));
      if (hasTelemetry && memStore.countEntries) {
        // Lower priority — shorten to one-liner when telemetry alert is present
        const dCount = memStore.countEntries(_hookCwd, 'decisions');
        const eCount = memStore.countEntries(_hookCwd, 'errors');
        const qCount = memStore.countEntries(_hookCwd, 'quorum');
        if (dCount > 0 || eCount > 0 || qCount > 0) {
          _contextPieces.push('Memory available: ' + dCount + ' decisions, ' + eCount + ' errors, ' + qCount + ' quorum entries. Query: node bin/memory-store.cjs query-decisions --last 5');
        }
      } else {
        const reminder = memStore.generateSessionReminder(_hookCwd);
        if (reminder) {
          _contextPieces.push(reminder);
        }
      }
    }
  } catch (_) {}

  // Write combined additionalContext output (once)
  if (_contextPieces.length > 0) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: _contextPieces.join('\n\n') }
    }));
  }

  // Memory staleness check — warn about outdated MEMORY.md entries
  try {
    const validateMemoryCandidates = [
      path.join(os.homedir(), '.claude', 'nf-bin', 'validate-memory.cjs'),
      path.join(__dirname, '..', 'bin', 'validate-memory.cjs'),
    ];
    let validateMemoryMod = null;
    for (const p of validateMemoryCandidates) {
      try { validateMemoryMod = require(p); break; } catch (_) {}
    }
    if (validateMemoryMod) {
      const { findings } = validateMemoryMod.validateMemory({ cwd: _hookCwd, quiet: true });
      if (findings.length > 0) {
        const summary = findings
          .map(f => '[memory-check] ' + f.message)
          .join('\n');
        process.stderr.write(summary + '\n');
      }
    }
  } catch (_) {}

  process.exit(0);
})();

// Export for unit testing
if (typeof module !== 'undefined') {
  module.exports = module.exports || {};
  module.exports.parseStateForReminder = parseStateForReminder;
  module.exports.findMemoryStore = findMemoryStore;
}
