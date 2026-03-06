#!/usr/bin/env node
'use strict';

/**
 * Run only tests affected by changed source files.
 *
 * Usage:
 *   node bin/test-changed.cjs                   # changes vs HEAD (staged + unstaged)
 *   node bin/test-changed.cjs --since=main       # changes vs main branch
 *   node bin/test-changed.cjs --since=HEAD~3     # changes in last 3 commits
 */

const { execFileSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

// ── Parse args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const sinceFlag = args.find(a => a.startsWith('--since='));
const since = sinceFlag ? sinceFlag.split('=')[1] : null;
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

// ── 1. Get changed files ───────────────────────────────────────────────
function getChangedFiles() {
  const files = new Set();

  if (since) {
    const committed = execFileSync('git', ['diff', '--name-only', `${since}...HEAD`], { cwd: ROOT, encoding: 'utf8' });
    committed.trim().split('\n').filter(Boolean).forEach(f => files.add(f));
  }

  // Always include unstaged + staged changes
  const unstaged = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' });
  const staged = execFileSync('git', ['diff', '--name-only', '--cached'], { cwd: ROOT, encoding: 'utf8' });

  unstaged.trim().split('\n').filter(Boolean).forEach(f => files.add(f));
  staged.trim().split('\n').filter(Boolean).forEach(f => files.add(f));

  return [...files];
}

// ── 2. Map source files → test files ────────────────────────────────────
function mapToTestFiles(changedFiles) {
  const testFiles = new Set();

  for (const file of changedFiles) {
    // Skip non-JS files
    if (!/\.(cjs|mjs|js)$/.test(file)) continue;

    // If the file IS a test file, include it directly
    if (/\.test\.(cjs|mjs|js)$/.test(file)) {
      const abs = path.resolve(ROOT, file);
      if (fs.existsSync(abs)) testFiles.add(abs);
      continue;
    }

    // Map source → test: foo.cjs → foo.test.cjs
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length);
    const testPath = `${base}.test${ext}`;
    const abs = path.resolve(ROOT, testPath);
    if (fs.existsSync(abs)) {
      testFiles.add(abs);
    }

    // Also check .test.cjs variant for .js sources
    if (ext !== '.cjs') {
      const altPath = `${base}.test.cjs`;
      const altAbs = path.resolve(ROOT, altPath);
      if (fs.existsSync(altAbs)) testFiles.add(altAbs);
    }
  }

  return [...testFiles].sort();
}

// ── 3. Run ──────────────────────────────────────────────────────────────
const changed = getChangedFiles();
if (verbose) {
  console.log(`Changed files (since ${since || 'working tree'}):`);
  changed.forEach(f => console.log(`  ${f}`));
  console.log();
}

const tests = mapToTestFiles(changed);

if (tests.length === 0) {
  console.log('No affected test files found.');
  process.exit(0);
}

console.log(`Running ${tests.length} affected test(s):`);
tests.forEach(t => console.log(`  ${path.relative(ROOT, t)}`));
console.log();

if (dryRun) {
  console.log('(dry-run mode — skipping execution)');
  process.exit(0);
}

const child = spawn('node', ['--test', ...tests], {
  cwd: ROOT,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
