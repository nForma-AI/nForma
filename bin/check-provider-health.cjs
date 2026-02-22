#!/usr/bin/env node
'use strict';

/**
 * check-provider-health.cjs
 *
 * Fast HTTP probe of the underlying LLM providers behind claude-mcp-server.
 * Reads ~/.claude.json → extracts ANTHROPIC_BASE_URL per server → groups by
 * provider → hits GET /models with a short connect timeout.
 *
 * A 200 or 401/403 means the provider is UP (server responded).
 * A timeout or connection error means it's DOWN.
 *
 * No LLM inference is performed — this completes in ~2–3 seconds.
 *
 * Usage:
 *   node bin/check-provider-health.cjs [--timeout-ms N] [--json]
 *
 * Exit codes:
 *   0 = all providers healthy
 *   1 = one or more providers unhealthy
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');

const args       = process.argv.slice(2);
const getArg     = (f) => { const i = args.indexOf(f); return i !== -1 && args[i+1] ? args[i+1] : null; };
const hasFlag    = (f) => args.includes(f);
const TIMEOUT_MS = parseInt(getArg('--timeout-ms') ?? '7000', 10);
const JSON_OUT   = hasFlag('--json');

// ─── Load provider map from ~/.claude.json ────────────────────────────────────
let mcpServers = {};
try {
  const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
  mcpServers = raw.mcpServers ?? {};
} catch (e) {
  console.error('Could not read ~/.claude.json:', e.message);
  process.exit(1);
}

// Build: providerBaseUrl -> { servers: [], apiKey }
const providers = {};
for (const [name, cfg] of Object.entries(mcpServers)) {
  if (!cfg.args?.some(a => a.includes('claude-mcp-server'))) continue;
  const env     = cfg.env ?? {};
  const baseUrl = env.ANTHROPIC_BASE_URL;
  const apiKey  = env.ANTHROPIC_API_KEY;
  const model   = env.CLAUDE_DEFAULT_MODEL ?? '?';
  if (!baseUrl) continue;

  if (!providers[baseUrl]) {
    providers[baseUrl] = { servers: [], apiKey };
  }
  providers[baseUrl].servers.push({ name, model });
}

if (Object.keys(providers).length === 0) {
  console.log('No claude-mcp-server instances with ANTHROPIC_BASE_URL found.');
  process.exit(0);
}

// ─── HTTP probe ───────────────────────────────────────────────────────────────
function probeUrl(baseUrl, apiKey) {
  return new Promise((resolve) => {
    // Hit /models — standard OpenAI-compat endpoint
    // A 401/403 = server up (auth required); 200 = server up (open); timeout = down
    let probeUrl;
    try {
      const u = new URL(baseUrl);
      // Normalize: strip trailing /v1 if present, re-add /v1/models
      const base = u.origin + (u.pathname.replace(/\/$/, ''));
      probeUrl = `${base}/models`;
    } catch {
      return resolve({ healthy: false, statusCode: null, error: `Invalid URL: ${baseUrl}`, latencyMs: 0 });
    }

    const start = Date.now();
    const parsed = new URL(probeUrl);
    const lib = parsed.protocol === 'https:' ? https : http;

    const headers = { 'User-Agent': 'qgsd-health-check/1.0' };
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
        // Consume response body to free socket
        res.resume();
        res.on('end', () => {
          // 200, 401, 403 all mean the server is alive
          const healthy = [200, 401, 403, 404, 422].includes(res.statusCode);
          resolve({ healthy, statusCode: res.statusCode, error: null, latencyMs });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const latencyMs = Date.now() - start;
      resolve({ healthy: false, statusCode: null, error: `Timed out after ${TIMEOUT_MS}ms`, latencyMs });
    });

    req.on('error', (e) => {
      const latencyMs = Date.now() - start;
      resolve({ healthy: false, statusCode: null, error: e.message, latencyMs });
    });

    req.end();
  });
}

// ─── Run probes (sequential to avoid thundering-herd on same provider) ────────
async function main() {
  const results = [];

  for (const [baseUrl, { servers, apiKey }] of Object.entries(providers)) {
    const probe = await probeUrl(baseUrl, apiKey);
    // Extract a friendly provider name from the URL
    let providerName;
    try {
      providerName = new URL(baseUrl).hostname.replace(/^api\./, '').replace(/\.com$|\.ai$|\.xyz$/, '');
    } catch {
      providerName = baseUrl;
    }

    results.push({
      provider:   providerName,
      baseUrl,
      servers:    servers.map(s => s.name),
      models:     servers.map(s => s.model),
      healthy:    probe.healthy,
      statusCode: probe.statusCode,
      latencyMs:  probe.latencyMs,
      error:      probe.error,
    });
  }

  // ── Output ───────────────────────────────────────────────────────────────────
  if (JSON_OUT) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    const green = (s) => `\x1b[32m${s}\x1b[0m`;
    const red   = (s) => `\x1b[31m${s}\x1b[0m`;
    const yellow= (s) => `\x1b[33m${s}\x1b[0m`;
    const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
    const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
    const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;

    console.log(`\n${bold('━━━ LLM PROVIDER HEALTH CHECK ━━━')}`);
    console.log(dim(` Probe: GET /models  |  Timeout: ${TIMEOUT_MS}ms  |  ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC`));
    console.log();

    for (const r of results) {
      const icon    = r.healthy ? green('✓') : red('✗');
      const status  = r.healthy
        ? green(`UP   [${r.statusCode}]`)
        : red(`DOWN [${r.statusCode ?? 'timeout'}]`);
      const lat     = r.latencyMs < 500 ? green(`${r.latencyMs}ms`) : yellow(`${r.latencyMs}ms`);

      console.log(`  ${icon}  ${bold(r.provider.padEnd(14))}  ${status.padEnd(20)}  ${lat}`);
      console.log(`     ${dim(r.baseUrl)}`);

      for (let i = 0; i < r.servers.length; i++) {
        const serverHealthy = r.healthy;
        const dot = serverHealthy ? green('•') : red('•');
        console.log(`     ${dot} ${cyan(r.servers[i].padEnd(22))} ${dim(r.models[i])}`);
      }

      if (r.error) {
        console.log(`     ${red('→')} ${dim(r.error)}`);
      }
      console.log();
    }

    const unhealthy = results.filter(r => !r.healthy);
    if (unhealthy.length > 0) {
      console.log(red(`${unhealthy.length}/${results.length} providers DOWN — skip these MCP servers in quorum:`));
      for (const r of unhealthy) {
        r.servers.forEach(s => console.log(`  • ${s}`));
      }
      console.log();
      console.log(dim('  Tip: run again in a few minutes — AkashML/Fireworks have intermittent outages.'));
    } else {
      console.log(green('  All providers healthy ✓'));
    }
    console.log();
  }

  process.exit(results.some(r => !r.healthy) ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
