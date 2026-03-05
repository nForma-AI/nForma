#!/usr/bin/env node
'use strict';

/**
 * migrate-formal-dir.cjs
 *
 * Migrates a legacy .formal/ directory at the project root into the canonical
 * .planning/formal/ location. Projects that adopted formal verification before
 * the layout consolidation may still have root-level .formal/ — this script
 * detects, merges, and optionally removes it.
 *
 * Conflict resolution: .planning/formal/ (canonical) always wins. If a file
 * exists in both locations, the legacy version is skipped.
 *
 * Usage:
 *   node bin/migrate-formal-dir.cjs [--project-root=PATH] [--json] [--remove-legacy]
 *
 * Exit codes:
 *   0 = success (or nothing to migrate)
 *   1 = could not start (invalid ROOT)
 */

const fs   = require('fs');
const path = require('path');

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  return args.some(a => a === `--${name}`);
}

function getOption(name) {
  const prefix = `--${name}=`;
  const arg = args.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const jsonMode     = getFlag('json');
const removeLegacy = getFlag('remove-legacy');
const ROOT         = getOption('project-root') || process.cwd();

const TAG = '[migrate-formal]';

// ─── Logging ─────────────────────────────────────────────────────────────────

const logs = [];

function log(msg) {
  if (!jsonMode) {
    console.log(`${TAG} ${msg}`);
  }
  logs.push(msg);
}

// ─── Validate ROOT ──────────────────────────────────────────────────────────

if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
  if (jsonMode) {
    console.log(JSON.stringify({ error: `Invalid project root: ${ROOT}` }));
  } else {
    console.error(`${TAG} ERROR: Invalid project root: ${ROOT}`);
  }
  process.exit(1);
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const legacyDir  = path.join(ROOT, '.formal');
const canonDir   = path.join(ROOT, '.planning', 'formal');

// ─── Detect ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(legacyDir) || !fs.statSync(legacyDir).isDirectory()) {
  log('No legacy .formal/ found — nothing to migrate');
  if (jsonMode) {
    console.log(JSON.stringify({
      legacy_found: false,
      copied: 0,
      skipped: 0,
      total: 0,
      removed: false,
      files_copied: [],
      files_skipped: []
    }));
  }
  process.exit(0);
}

// ─── Ensure target ──────────────────────────────────────────────────────────

fs.mkdirSync(canonDir, { recursive: true });

// ─── Walk helper ─────────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// ─── Walk and merge ─────────────────────────────────────────────────────────

const allFiles = walkDir(legacyDir);
const filesCopied  = [];
const filesSkipped = [];

for (const srcFile of allFiles) {
  const relPath  = path.relative(legacyDir, srcFile);
  const destFile = path.join(canonDir, relPath);

  try {
    if (fs.existsSync(destFile)) {
      log(`Skipped (already exists in .planning/formal/): ${relPath}`);
      filesSkipped.push(relPath);
    } else {
      // Ensure intermediate directories
      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
      log(`Copied: ${relPath}`);
      filesCopied.push(relPath);
    }
  } catch (err) {
    log(`ERROR copying ${relPath}: ${err.message}`);
    // Fail-open: continue with remaining files
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

const total = allFiles.length;
log(`Migration complete: ${filesCopied.length} copied, ${filesSkipped.length} skipped (conflicts), ${total} total files in legacy .formal/`);

// ─── Optional removal ────────────────────────────────────────────────────────

let removed = false;

if (removeLegacy && total > 0) {
  try {
    fs.rmSync(legacyDir, { recursive: true, force: true });
    log('Removed legacy .formal/ directory');
    removed = true;
  } catch (err) {
    log(`ERROR removing legacy .formal/: ${err.message}`);
  }
} else if (!removeLegacy && total > 0) {
  log('Legacy .formal/ preserved — pass --remove-legacy to remove');
}

// ─── JSON output ─────────────────────────────────────────────────────────────

if (jsonMode) {
  console.log(JSON.stringify({
    legacy_found: true,
    copied: filesCopied.length,
    skipped: filesSkipped.length,
    total,
    removed,
    files_copied: filesCopied,
    files_skipped: filesSkipped
  }));
}

process.exit(0);
