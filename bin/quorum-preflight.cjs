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
 *   node quorum-preflight.cjs --all                   # → JSON with health, available_slots, unavailable_slots (probe on by default)
 *   node quorum-preflight.cjs --all --no-probe        # → JSON { quorum_active, max_quorum_size, team } (skip health probes)
 *
 * All modes read from ~/.claude/nf.json (global) merged with $CWD/.claude/nf.json (project).
 * --team and --all also read providers.json (same search logic as call-quorum-slot.cjs).
 *
 * --probe flag (with --all only): runs two-layer parallel health probes:
 *   Layer 1: Binary probe — spawns CLI binary with health_check_args (3s timeout)
 *   Layer 2: Upstream API probe — GET /models for ccr-backed slots (5s timeout, TTL cache)
 *
 * Exit code: always 0. Output: JSON to stdout.
 */

const fs              = require('fs');
const path            = require('path');
const os              = require('os');
const { spawn }       = require('child_process');
const https           = require('https');
const http            = require('http');

// Probe is ON by default for --all; --no-probe to skip, --probe still accepted for compat
const NO_PROBE = process.argv.includes('--no-probe');
const PROBE = !NO_PROBE;

// ─── TTL cache constants (shared with check-provider-health.cjs) ────────────
const CACHE_FILE  = path.join(os.homedir(), '.claude', 'nf-provider-cache.json');
const TTL_UP_MS   = 180000; // 3 minutes
const TTL_DOWN_MS = 300000; // 5 minutes

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
    team[p.name] = { model: p.model, display_provider: p.display_provider || p.provider };
  }
  return team;
}

// ─── URL normalization for dedup ────────────────────────────────────────────
function normalizeBaseUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    u.hostname = u.hostname.toLowerCase();
    // Remove default ports
    if ((u.protocol === 'https:' && u.port === '443') ||
        (u.protocol === 'http:'  && u.port === '80')) {
      u.port = '';
    }
    // Strip trailing slash from pathname
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    if (u.pathname === '/') u.pathname = '';
    return u.origin + u.pathname;
  } catch {
    return urlStr;
  }
}

// ─── Cache helpers (shared pattern with check-provider-health.cjs) ──────────
function loadCache() {
  try {
    const raw = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.entries === 'object') return parsed;
  } catch (_) {}
  return { entries: {} };
}

function saveCache(cache) {
  try {
    const dir = path.dirname(CACHE_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write('[cache] Write failed: ' + e.message + '\n');
  }
}

function getCachedResult(cache, baseUrl) {
  const entry = cache.entries[baseUrl];
  if (!entry) return null;
  const ttl = entry.healthy ? TTL_UP_MS : TTL_DOWN_MS;
  const age = Date.now() - entry.cachedAt;
  if (age < ttl) return { ...entry, remainingMs: ttl - age };
  return null; // stale
}

// ─── Layer 1: Binary probe ──────────────────────────────────────────────────
function probeBinary(cli, healthCheckArgs) {
  return new Promise((resolve) => {
    const timeout = 3000;
    try {
      const proc = spawn(cli, healthCheckArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout,
      });

      let resolved = false;
      const done = (ok, reason) => {
        if (resolved) return;
        resolved = true;
        resolve({ ok, reason });
      };

      proc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          done(false, `binary not found: ${cli}`);
        } else {
          done(false, `spawn error: ${err.message}`);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          done(true, 'exit 0');
        } else if (code === null) {
          done(false, `timeout after ${timeout}ms`);
        } else {
          done(false, `exit ${code}`);
        }
      });
    } catch (err) {
      resolve({ ok: false, reason: `spawn failed: ${err.message}` });
    }
  });
}

// ─── Layer 2: Upstream API probe (HTTP) ─────────────────────────────────────
function probeUpstreamApi(baseUrl, apiKey) {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 5000;
    let probeTarget;
    try {
      const u = new URL(baseUrl);
      const base = u.origin + u.pathname.replace(/\/$/, '');
      probeTarget = `${base}/models`;
    } catch {
      return resolve({ ok: false, reason: `invalid URL: ${baseUrl}`, latencyMs: 0 });
    }

    const start = Date.now();
    const parsed = new URL(probeTarget);
    const lib = parsed.protocol === 'https:' ? https : http;

    const headers = { 'User-Agent': 'nf-health-check/1.0' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers,
        timeout:  TIMEOUT_MS,
      },
      (res) => {
        const latencyMs = Date.now() - start;
        res.resume();
        res.on('end', () => {
          const healthy = [200, 401, 403, 404, 422].includes(res.statusCode);
          resolve({
            ok: healthy,
            reason: healthy ? `HTTP ${res.statusCode}` : `HTTP ${res.statusCode} (unhealthy)`,
            latencyMs,
            statusCode: res.statusCode,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const latencyMs = Date.now() - start;
      resolve({ ok: false, reason: `timeout after ${TIMEOUT_MS}ms`, latencyMs });
    });

    req.on('error', (e) => {
      const latencyMs = Date.now() - start;
      resolve({ ok: false, reason: e.message, latencyMs });
    });

    req.end();
  });
}

// ─── Two-layer parallel health probe ────────────────────────────────────────
async function probeHealth(providers) {
  // Load ~/.claude.json for MCP server env (ccr slots need ANTHROPIC_BASE_URL)
  let mcpServers = {};
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    mcpServers = raw.mcpServers ?? {};
  } catch (e) {
    process.stderr.write(`[probe] Warning: could not read ~/.claude.json: ${e.message}\n`);
    // All ccr slots will get layer2 skipped
  }

  const cache = loadCache();
  const health = {};

  // Group ccr slots by normalized base URL for dedup
  const urlToSlots = new Map(); // normalizedUrl -> { baseUrl, apiKey, slots[] }

  await Promise.all(providers.map(async (p) => {
    const isCcr = p.display_type === 'claude-code-router';

    // Layer 1: binary probe (all slots)
    const layer1Promise = probeBinary(p.cli, p.health_check_args || []);

    // Layer 2: upstream API probe (ccr slots only)
    let layer2Promise;
    if (!isCcr) {
      layer2Promise = Promise.resolve({ ok: true, skipped: true, reason: 'no upstream API' });
    } else {
      // Extract ANTHROPIC_BASE_URL from mcpServers env
      const mcpEntry = mcpServers[p.name];
      const env = mcpEntry?.env ?? {};
      const baseUrl = env.ANTHROPIC_BASE_URL;
      const apiKey = env.ANTHROPIC_API_KEY;

      if (!baseUrl) {
        layer2Promise = Promise.resolve({ ok: true, skipped: true, reason: 'ANTHROPIC_BASE_URL not configured' });
      } else {
        const normalizedUrl = normalizeBaseUrl(baseUrl);
        // Check cache first
        const cached = getCachedResult(cache, normalizedUrl);
        if (cached) {
          const remaining = Math.round(cached.remainingMs / 1000);
          layer2Promise = Promise.resolve({
            ok: cached.healthy,
            reason: cached.healthy ? `HTTP ${cached.statusCode}` : (cached.error || 'cached DOWN'),
            latencyMs: cached.latencyMs,
            cacheAge: `cached`,
          });
        } else {
          // Run live probe
          layer2Promise = probeUpstreamApi(baseUrl, apiKey).then((result) => {
            // Write to cache
            cache.entries[normalizedUrl] = {
              healthy:    result.ok,
              statusCode: result.statusCode ?? null,
              error:      result.ok ? null : result.reason,
              latencyMs:  result.latencyMs,
              cachedAt:   Date.now(),
            };
            saveCache(cache);
            return { ...result, cacheAge: 'fresh' };
          });
        }
      }
    }

    // Run both layers in parallel
    const [layer1, layer2] = await Promise.all([layer1Promise, layer2Promise]);

    health[p.name] = {
      healthy: layer1.ok && layer2.ok,
      layer1: { ok: layer1.ok, reason: layer1.reason },
      layer2: {
        ok: layer2.ok,
        reason: layer2.reason,
        ...(layer2.skipped ? { skipped: true } : {}),
        ...(layer2.latencyMs !== undefined ? { latencyMs: layer2.latencyMs } : {}),
        ...(layer2.cacheAge ? { cacheAge: layer2.cacheAge } : {}),
      },
    };
  }));

  return health;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
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

    const output = { quorum_active: active, max_quorum_size: maxSize, team };

    if (PROBE) {
      // Filter providers to only active ones
      const activeProviders = active.length > 0
        ? providers.filter(p => active.includes(p.name))
        : providers;

      const health = await probeHealth(activeProviders);

      output.health = health;
      output.available_slots = [];
      output.unavailable_slots = [];

      for (const [name, h] of Object.entries(health)) {
        if (h.healthy) {
          output.available_slots.push(name);
        } else {
          const reason = !h.layer1.ok
            ? `layer1: ${h.layer1.reason}`
            : `layer2: ${h.layer2.reason}`;
          output.unavailable_slots.push({ name, reason });
        }
      }
    }

    console.log(JSON.stringify(output));
  } else {
    console.error(`Unknown mode: ${mode}`);
    console.error('Usage: node quorum-preflight.cjs [--quorum-active|--max-quorum-size|--team|--all] [--probe]');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
