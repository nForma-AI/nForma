#!/usr/bin/env node
'use strict';

/**
 * quorum-preflight.cjs — extract quorum config and team identity from nf.json + providers.json
 *
 * Replaces three inline `node -e` snippets in quorum.md that caused shell-escaping
 * failures (LLMs escaping `!` as `\!` inside node -e strings).
 *
 * Usage:
 *   node quorum-preflight.cjs --quorum-active       # → JSON array of active slot names
 *   node quorum-preflight.cjs --max-quorum-size      # → integer (default 3)
 *   node quorum-preflight.cjs --team                  # → JSON { slotName: { model } }
 *   node quorum-preflight.cjs --all                   # → JSON { quorum_active, max_quorum_size, team }
 *
 * All modes read from ~/.claude/nf.json (global) merged with $CWD/.claude/nf.json (project).
 * --team and --all also read providers.json (same search logic as call-quorum-slot.cjs).
 *
 * Exit code: always 0. Output: JSON to stdout.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ─── Read merged nf.json config ─────────────────────────────────────────────
function readConfig() {
  const globalCfg = path.join(os.homedir(), '.claude', 'nf.json');
  const projCfg   = path.join(process.cwd(), '.claude', 'nf.json');
  let cfg = {};
  for (const f of [globalCfg, projCfg]) {
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (_) {}
  }
  return cfg;
}

// ─── Find providers.json (mirrors call-quorum-slot.cjs / probe-quorum-slots.cjs) ──
function findProviders() {
  const searchPaths = [
    path.join(__dirname, 'providers.json'),
    path.join(os.homedir(), '.claude', 'nf-bin', 'providers.json'),
  ];
  try {
    const claudeJson = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    const u1args = claudeJson?.mcpServers?.['unified-1']?.args ?? [];
    const serverScript = u1args.find(a => typeof a === 'string' && a.endsWith('unified-mcp-server.mjs'));
    if (serverScript) searchPaths.unshift(path.join(path.dirname(serverScript), 'providers.json'));
  } catch (_) {}
  for (const p of searchPaths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')).providers;
    } catch (_) {}
  }
  return [];
}

// ─── Build team JSON from providers + config ────────────────────────────────
function buildTeam(providers, active) {
  const team = {};
  for (const p of providers) {
    if (active.length > 0 && !active.includes(p.name)) continue;
    team[p.name] = { model: p.model };
  }
  return team;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const mode = process.argv[2] || '--all';
const cfg  = readConfig();

if (mode === '--quorum-active') {
  console.log(JSON.stringify(cfg.quorum_active || []));
} else if (mode === '--max-quorum-size') {
  console.log(cfg.max_quorum_size ?? 3);
} else if (mode === '--team') {
  const providers = findProviders();
  const active    = cfg.quorum_active || [];
  console.log(JSON.stringify(buildTeam(providers, active)));
} else if (mode === '--all') {
  const providers    = findProviders();
  const active       = cfg.quorum_active || [];
  const team         = buildTeam(providers, active);
  const maxSize      = cfg.max_quorum_size ?? 3;
  console.log(JSON.stringify({ quorum_active: active, max_quorum_size: maxSize, team }));
} else {
  console.error(`Unknown mode: ${mode}`);
  console.error('Usage: node quorum-preflight.cjs [--quorum-active|--max-quorum-size|--team|--all]');
  process.exit(1);
}
