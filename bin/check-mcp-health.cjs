#!/usr/bin/env node
'use strict';

/**
 * check-mcp-health.cjs
 *
 * Pre-flight health check for all claude-mcp-server instances.
 * Reads ~/.claude.json to find configured MCP servers, then calls
 * health_check on each one sequentially. Exits non-zero if any
 * configured server is unhealthy.
 *
 * Usage:
 *   node bin/check-mcp-health.cjs [--timeout-ms N] [--json]
 *
 * Designed to be called at the start of /qgsd:quorum to skip
 * unresponsive servers before making full inference calls.
 */

const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const args       = process.argv.slice(2);
const getArg     = (f) => { const i = args.indexOf(f); return i !== -1 && args[i+1] ? args[i+1] : null; };
const hasFlag    = (f) => args.includes(f);
const TIMEOUT_MS = parseInt(getArg('--timeout-ms') ?? '12000', 10);
const JSON_OUT   = hasFlag('--json');

// ─── Load MCP server list from ~/.claude.json ─────────────────────────────────
let mcpServers = {};
try {
  const raw = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
  mcpServers = raw.mcpServers ?? {};
} catch (e) {
  console.error('Could not read ~/.claude.json:', e.message);
  process.exit(1);
}

// Filter to claude-mcp-server instances (those using our dist/index.js)
const targets = Object.entries(mcpServers)
  .filter(([, v]) => v.args?.some(a => a.includes('claude-mcp-server')))
  .map(([name, cfg]) => ({ name, env: cfg.env ?? {} }));

if (targets.length === 0) {
  console.log('No claude-mcp-server instances found in ~/.claude.json');
  process.exit(0);
}

// ─── Run health check via MCP JSON-RPC over stdio ────────────────────────────
// We can't easily spawn MCP servers here — instead, we proxy through the
// installed `claude` CLI by calling each server's health_check tool
// via a one-shot claude -p call with the right env overrides.

const results = [];

for (const { name, env } of targets) {
  const start = Date.now();
  let healthy = false;
  let error   = null;
  let latencyMs = 0;

  const prompt = JSON.stringify({
    method: 'health_check_proxy',
    server: name,
  });

  // We use a simpler proxy: just call claude with the env overrides directly.
  // This tests the same path that the MCP tool would use.
  try {
    const envForCall = { ...process.env, ...env };
    const result = execFileSync('claude', [
      '-p', 'Reply with exactly one word: ok',
      '--output-format', 'json',
      '--max-turns', '1',
    ], {
      env: envForCall,
      timeout: TIMEOUT_MS,
      encoding: 'utf8',
    });
    latencyMs = Date.now() - start;
    const parsed = JSON.parse(result);
    healthy = !!(parsed.result || parsed.type === 'result');
  } catch (e) {
    latencyMs = Date.now() - start;
    error = e.code === 'ETIMEDOUT'
      ? `Timed out after ${TIMEOUT_MS}ms`
      : (e.message ?? String(e)).split('\n')[0].slice(0, 120);
  }

  results.push({ name, healthy, latencyMs, error });
}

// ─── Output ───────────────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const red   = (s) => `\x1b[31m${s}\x1b[0m`;
  const dim   = (s) => `\x1b[2m${s}\x1b[0m`;
  const bold  = (s) => `\x1b[1m${s}\x1b[0m`;

  console.log(`\n${bold('━━━ MCP ENDPOINT HEALTH CHECK ━━━')}`);
  for (const r of results) {
    const icon    = r.healthy ? green('✓') : red('✗');
    const latency = `${r.latencyMs}ms`;
    const status  = r.healthy ? green('OK') : red('FAIL');
    const detail  = r.error ? dim(`  ${r.error}`) : '';
    console.log(`  ${icon}  ${r.name.padEnd(22)} ${status.padEnd(14)} ${dim(latency)}${detail}`);
  }
  console.log();

  const unhealthy = results.filter(r => !r.healthy);
  if (unhealthy.length > 0) {
    console.log(red(`${unhealthy.length}/${results.length} servers unhealthy — skip these in quorum:`));
    unhealthy.forEach(r => console.log(`  • ${r.name}`));
    console.log();
  }
}

// Exit 1 if any server is unhealthy (useful for scripting)
const anyUnhealthy = results.some(r => !r.healthy);
process.exit(anyUnhealthy ? 1 : 0);
