#!/usr/bin/env node
'use strict';

/**
 * check-assets-stale.cjs
 *
 * Regenerates SVG assets to a temp buffer and compares against committed files.
 * Exits 1 if any asset is stale (regenerated content differs from disk).
 *
 * Used in CI to catch forgotten asset regeneration.
 * Only checks pure-Node generators (no rsvg-convert or VHS needed).
 *
 * Usage:
 *   node bin/check-assets-stale.cjs
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

// Assets to check: each entry runs a generator script and compares one output file
const CHECKS = [
  {
    name: 'terminal.svg',
    script: 'scripts/generate-terminal-svg.js',
    output: 'docs/assets/terminal.svg',
  },
  // Logo SVGs use the same generator — compare both outputs
  {
    name: 'nf-logo-2000.svg',
    script: 'scripts/generate-logo-svg.js',
    output: 'docs/assets/nf-logo-2000.svg',
    // Logo script generates multiple files; we only diff SVGs (PNGs need rsvg-convert)
    skipIfMissing: 'rsvg-convert',
  },
  {
    name: 'nf-logo-2000-transparent.svg',
    script: null, // same script as above, already ran
    output: 'docs/assets/nf-logo-2000-transparent.svg',
    skipIfMissing: 'rsvg-convert',
  },
];

function hasCommand(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

function main() {
  const stale = [];
  const skipped = [];
  const rsvgAvailable = hasCommand('rsvg-convert');

  // Snapshot current file contents before regeneration
  const snapshots = {};
  for (const check of CHECKS) {
    const absPath = path.join(ROOT, check.output);
    if (fs.existsSync(absPath)) {
      snapshots[check.output] = fs.readFileSync(absPath);
    }
  }

  // Run generators
  const scriptsRun = new Set();
  for (const check of CHECKS) {
    if (!check.script) continue;
    if (scriptsRun.has(check.script)) continue;

    // Skip logo if rsvg-convert is missing (script will crash on PNG generation)
    if (check.skipIfMissing && !rsvgAvailable) {
      continue;
    }

    try {
      execFileSync('node', [path.join(ROOT, check.script)], {
        cwd: ROOT,
        stdio: 'pipe',
      });
      scriptsRun.add(check.script);
    } catch (err) {
      console.error(`ERROR: Failed to run ${check.script}: ${err.message}`);
      process.exit(2);
    }
  }

  // Compare regenerated vs snapshot
  for (const check of CHECKS) {
    if (check.skipIfMissing && !rsvgAvailable) {
      skipped.push(check.name);
      continue;
    }

    const absPath = path.join(ROOT, check.output);
    const original = snapshots[check.output];
    const regenerated = fs.existsSync(absPath) ? fs.readFileSync(absPath) : null;

    if (!original && !regenerated) {
      skipped.push(check.name);
      continue;
    }

    if (!original || !regenerated || !original.equals(regenerated)) {
      stale.push(check.name);
    }

    // Restore original to avoid dirtying the working tree
    if (original) {
      fs.writeFileSync(absPath, original);
    }
  }

  // Report
  if (skipped.length > 0) {
    console.log(`⊘ Skipped (missing deps): ${skipped.join(', ')}`);
  }

  if (stale.length > 0) {
    console.error(`\n✗ Stale assets detected:\n`);
    for (const name of stale) {
      console.error(`  - ${name}`);
    }
    console.error(`\nRun: npm run generate-assets (or npm run generate-terminal && npm run generate-logo)`);
    console.error(`Then commit the updated files in docs/assets/\n`);
    process.exit(1);
  }

  console.log(`✓ All ${CHECKS.length - skipped.length} checked assets are up to date`);
}

main();
