#!/usr/bin/env node
'use strict';

/**
 * telemetry-collector.cjs
 *
 * Pure disk I/O telemetry collector for QGSD.
 * Reads existing log sources, aggregates stats, writes .planning/telemetry/report.json.
 *
 * Sources:
 *   1. ~/.claude/debug/*.txt  — MCP tool call timing and failures
 *   2. .planning/quorum-scoreboard.json — quorum availability stats
 *   3. .claude/circuit-breaker-state.json — circuit breaker state
 *
 * NEVER spawns Claude or calls any MCP tool. Handles all missing files gracefully.
 *
 * Usage:
 *   node bin/telemetry-collector.cjs
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const DEBUG_DIR   = path.join(os.homedir(), '.claude', 'debug');
const MAX_FILES   = 100;
const MAX_DAYS    = 7;
const PROJECT_DIR = process.cwd();
const TELEMETRY_DIR = path.join(PROJECT_DIR, '.planning', 'telemetry');

// ─── Regex patterns (reused from review-mcp-logs.cjs) ────────────────────────
const RE_COMPLETE = /MCP server "([^"]+)": Tool '([^']+)' completed successfully in (\d+)ms/;
const RE_FAILED   = /MCP server "([^"]+)": Tool '([^']+)' failed after (\d+)s: (.+)/;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Source 1: MCP debug logs ─────────────────────────────────────────────────
const servers = {}; // serverName -> { totalCalls, successCount, failureCount, durations[], errors[] }

function ensureServer(name) {
  if (!servers[name]) {
    servers[name] = { totalCalls: 0, successCount: 0, failureCount: 0, durations: [], errors: [] };
  }
  return servers[name];
}

let mcpResult = {
  servers: {},
  alwaysFailing: [],
  slowServers: [],
};

try {
  const cutoff = Date.now() - MAX_DAYS * 86400 * 1000;

  let files = [];
  if (fs.existsSync(DEBUG_DIR)) {
    files = fs.readdirSync(DEBUG_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(DEBUG_DIR, f)).mtimeMs }))
      .filter(f => f.mtime >= cutoff)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, MAX_FILES)
      .map(f => path.join(DEBUG_DIR, f.name));
  }

  for (const file of files) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    for (const line of content.split('\n')) {
      let m;

      if ((m = line.match(RE_COMPLETE))) {
        const [, server, , ms] = m;
        const s = ensureServer(server);
        const durationMs = parseInt(ms, 10);
        s.totalCalls++;
        s.successCount++;
        s.durations.push(durationMs);
        // hang if successful call > 60000ms
        if (durationMs > 60000) {
          // count as hang but still a success
        }
      } else if ((m = line.match(RE_FAILED))) {
        const [, server, , sec, reason] = m;
        const s = ensureServer(server);
        const durationMs = parseInt(sec, 10) * 1000;
        s.totalCalls++;
        s.failureCount++;
        s.errors.push(reason.trim().slice(0, 120));
        if (durationMs > 60000) {
          // hang: counted separately
        }
      }
    }
  }

  // Build per-server stats
  for (const [name, data] of Object.entries(servers)) {
    // Count hangs: completed calls with duration > 60000ms
    // We stored durations only for successful calls; failed calls with >60s are also hangs
    const hangCount = data.durations.filter(d => d > 60000).length;

    // Top 3 error reasons by frequency
    const errFreq = {};
    for (const e of data.errors) {
      errFreq[e] = (errFreq[e] || 0) + 1;
    }
    const topErrors = Object.entries(errFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([msg]) => msg);

    const p95Ms = percentile(data.durations, 95);

    mcpResult.servers[name] = {
      totalCalls:   data.totalCalls,
      failureCount: data.failureCount,
      hangCount,
      topErrors,
      p95Ms,
    };
  }

  // alwaysFailing: servers with totalCalls > 0 and successCount === 0
  mcpResult.alwaysFailing = Object.entries(servers)
    .filter(([, s]) => s.totalCalls > 0 && s.successCount === 0)
    .map(([name]) => name);

  // slowServers: p95 > 30000ms and at least 1 success
  mcpResult.slowServers = Object.entries(servers)
    .filter(([, s]) => {
      const p95 = percentile(s.durations, 95);
      return p95 > 30000 && s.successCount > 0;
    })
    .map(([name, s]) => ({ name, p95Ms: percentile(s.durations, 95) }))
    .sort((a, b) => b.p95Ms - a.p95Ms);

} catch (err) {
  // Non-fatal: leave mcpResult with empty defaults
  process.stderr.write('[telemetry-collector] MCP parse error: ' + err.message + '\n');
}

// ─── Source 2: quorum-scoreboard.json ─────────────────────────────────────────
let quorumResult = {
  totalRounds: 0,
  allUnavailableRounds: 0,
  quorumFailureRate: 0,
};

try {
  const scoreboardPath = path.join(PROJECT_DIR, '.planning', 'quorum-scoreboard.json');
  if (fs.existsSync(scoreboardPath)) {
    const sb = JSON.parse(fs.readFileSync(scoreboardPath, 'utf8'));
    if (Array.isArray(sb.rounds)) {
      const total = sb.rounds.length;
      let allUnavail = 0;
      for (const round of sb.rounds) {
        // A round is "all unavailable" if votes is empty or every model is UNAVAILABLE
        if (!round.votes || Object.keys(round.votes).length === 0) {
          allUnavail++;
        } else {
          const vals = Object.values(round.votes);
          if (vals.length > 0 && vals.every(v => v === 'UNAVAILABLE')) {
            allUnavail++;
          }
        }
      }
      quorumResult.totalRounds = total;
      quorumResult.allUnavailableRounds = allUnavail;
      quorumResult.quorumFailureRate = total > 0 ? allUnavail / total : 0;
    }
  }
} catch (err) {
  process.stderr.write('[telemetry-collector] Scoreboard parse error: ' + err.message + '\n');
}

// ─── Source 3: circuit-breaker-state.json ─────────────────────────────────────
let cbResult = {
  active: false,
  triggerCount: 0,
  lastTriggeredAt: null,
};

try {
  const cbPath = path.join(PROJECT_DIR, '.claude', 'circuit-breaker-state.json');
  if (fs.existsSync(cbPath)) {
    const cb = JSON.parse(fs.readFileSync(cbPath, 'utf8'));
    cbResult.active          = Boolean(cb.active);
    cbResult.triggerCount    = typeof cb.triggerCount === 'number' ? cb.triggerCount : 0;
    cbResult.lastTriggeredAt = cb.lastTriggeredAt || null;
  }
} catch (err) {
  process.stderr.write('[telemetry-collector] Circuit breaker parse error: ' + err.message + '\n');
}

// ─── Build report ─────────────────────────────────────────────────────────────
const report = {
  generatedAt: new Date().toISOString(),
  mcp: {
    servers: mcpResult.servers,
    alwaysFailing: mcpResult.alwaysFailing,
    slowServers: mcpResult.slowServers,
  },
  quorum: {
    totalRounds:          quorumResult.totalRounds,
    allUnavailableRounds: quorumResult.allUnavailableRounds,
    quorumFailureRate:    quorumResult.quorumFailureRate,
  },
  circuitBreaker: {
    active:           cbResult.active,
    triggerCount:     cbResult.triggerCount,
    lastTriggeredAt:  cbResult.lastTriggeredAt,
  },
};

// ─── Write output ─────────────────────────────────────────────────────────────
fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
const reportPath = path.join(TELEMETRY_DIR, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log('[telemetry-collector] Report written to ' + reportPath);
