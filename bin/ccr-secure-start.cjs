#!/usr/bin/env node
// bin/ccr-secure-start.cjs
// Wrapper script for claude-code-router that:
//   1. Populates ~/.claude-code-router/config.json from keytar before starting CCR
//   2. Spawns CCR with the provided args
//   3. Wipes all provider api_key fields from config.json on exit or signal
//
// Usage: node bin/ccr-secure-start.cjs <ccr-binary> [args...]
// Example: node bin/ccr-secure-start.cjs ccr start

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawn } = require('child_process');

const CONFIG_PATH = path.join(os.homedir(), '.claude-code-router', 'config.json');
const SECURE_CONFIG = path.join(__dirname, 'ccr-secure-config.cjs');

// Synchronously wipe all api_key fields in config.json to empty strings.
// Called on exit and on signal to ensure keys are not left on disk.
function wipeKeys() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);
    if (Array.isArray(config.providers)) {
      for (const provider of config.providers) {
        provider.api_key = '';
      }
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (_) {
    // Fail silently — config may not exist or may already be wiped
  }
}

async function main() {
  const ccrBin = process.argv[2];
  const ccrArgs = process.argv.slice(3);

  if (!ccrBin) {
    process.stderr.write('Usage: node ccr-secure-start.cjs <ccr-binary> [args...]\n');
    process.stderr.write('Example: node ccr-secure-start.cjs ccr start\n');
    process.exit(1);
  }

  // Step 1: Populate config.json from keytar
  try {
    execFileSync(process.execPath, [SECURE_CONFIG], { stdio: 'inherit' });
  } catch (e) {
    process.stderr.write('[ccr-secure-start] Failed to populate CCR config: ' + e.message + '\n');
    process.exit(1);
  }

  // Step 2: Spawn CCR
  const child = spawn(ccrBin, ccrArgs, { stdio: 'inherit' });

  // Step 3: Wipe keys on CCR exit
  child.on('exit', (code) => {
    wipeKeys();
    process.exit(code ?? 0);
  });

  // Wipe keys on SIGTERM (e.g. systemd stop, kill)
  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
    wipeKeys();
    process.exit(0);
  });

  // Wipe keys on SIGINT (Ctrl-C)
  process.on('SIGINT', () => {
    child.kill('SIGINT');
    wipeKeys();
    process.exit(0);
  });
}

main().catch((e) => {
  process.stderr.write('[ccr-secure-start] Unexpected error: ' + e.message + '\n');
  process.exit(1);
});
