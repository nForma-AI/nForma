#!/usr/bin/env node
// hooks/qgsd-session-start.js
// SessionStart hook — syncs QGSD keychain secrets into ~/.claude.json
// on every session start so mcpServers env blocks always reflect current keychain state.
//
// Runs synchronously (hook expects process to exit) — uses async IIFE with catch.

'use strict';

const path = require('path');
const os = require('os');

// Locate secrets.cjs — try installed global path first, then local dev path.
//
// IMPORTANT: install.js copies bin/*.cjs to ~/.claude/qgsd-bin/ (not ~/.claude/qgsd/bin/).
// See bin/install.js line ~1679: binDest = path.join(targetDir, 'qgsd-bin')
// where targetDir = os.homedir() + '/.claude'.
function findSecrets() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'qgsd-bin', 'secrets.cjs'),  // installed path
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
  const secrets = findSecrets();
  if (!secrets) {
    // silently skip — QGSD may not be installed yet or keytar absent
    process.exit(0);
  }
  try {
    await secrets.syncToClaudeJson(secrets.SERVICE);
  } catch (e) {
    // Non-fatal — write to stderr for debug logs, but never block session start
    process.stderr.write('[qgsd-session-start] sync error: ' + e.message + '\n');
  }
  process.exit(0);
})();
