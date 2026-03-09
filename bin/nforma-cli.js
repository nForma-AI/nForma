#!/usr/bin/env node
'use strict';

/**
 * nforma-cli.js — Unified CLI entry point.
 *
 * Routes subcommands:
 *   nforma              → Installer (if not installed) or TUI (if installed)
 *   nforma install ...  → Installer (bin/install.js)
 *   nforma tui          → TUI (bin/nForma.cjs)
 *   nforma --help       → Show usage
 *   nforma --version    → Show version
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const sub = process.argv[2];

/**
 * Detect whether nForma is installed for any runtime by checking
 * for the nf/ directory in known config locations.
 */
function isInstalled() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'nf'),
    path.join(os.homedir(), '.gemini', 'nf'),
    path.join(os.homedir(), '.config', 'opencode', 'nf'),
  ];
  return candidates.some(dir => fs.existsSync(dir));
}

if (sub === 'install') {
  // Forward remaining args to installer
  process.argv.splice(2, 1); // remove 'install' from argv so install.js sees its own flags
  require('./install.js');
} else if (sub === 'tui') {
  require('./nForma.cjs');
} else if (sub === '--version' || sub === '-v') {
  const pkg = require('../package.json');
  console.log(pkg.version);
} else if (sub === '--help' || sub === '-h') {
  const pkg = require('../package.json');
  console.log(`nforma v${pkg.version} — Quorum Gets Shit Done\n`);
  console.log('Usage:');
  console.log('  nforma                 Auto-detect: installer (first run) or TUI');
  console.log('  nforma install [opts]  Run the installer');
  console.log('  nforma tui             Open the TUI dashboard');
  console.log('  nforma --version       Show version');
  console.log('  nforma --help          Show this help');
} else {
  // Smart routing: installer on first run, TUI if already installed
  if (isInstalled()) {
    require('./nForma.cjs');
  } else {
    require('./install.js');
  }
}
