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
        const ctx = 'Telemetry alert [priority=' + issue.priority + ']: ' + issue.description + '\nSuggested fix: ' + issue.action;
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx }
        }));
      }
    }
  } catch (_) {}

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
