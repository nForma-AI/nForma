#!/usr/bin/env node
'use strict';

/**
 * gh-account-rotate.cjs — rotate to the next gh auth account
 *
 * Called by call-quorum-slot.cjs as oauth_rotation.rotate_cmd for copilot-1.
 * Delegates all gh auth status parsing to the gh-cli auth driver (single source of truth).
 *
 * Usage:
 *   node bin/gh-account-rotate.cjs
 */

const { spawnSync }     = require('child_process');
const { parseGhStatus } = require('./auth-drivers/gh-cli.cjs');

const { accounts, active } = parseGhStatus();

if (accounts.length < 2) {
  process.stderr.write('[gh-rotate] Only one gh account — nothing to rotate\n');
  process.exit(0);
}

const idx  = active ? accounts.indexOf(active) : 0;
const next = accounts[(idx + 1) % accounts.length];

process.stderr.write(`[gh-rotate] ${active ?? '?'} → ${next}\n`);

const r = spawnSync('gh', ['auth', 'switch', '--user', next, '--hostname', 'github.com'], {
  stdio: 'inherit',
  encoding: 'utf8',
});

process.exit(r.status ?? 0);
