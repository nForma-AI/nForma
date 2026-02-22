#!/usr/bin/env node
/**
 * lint-isolation.js
 *
 * Guards against QGSD commands referencing the GSD install path.
 * Commands must use ~/.claude/qgsd/ (QGSD's own folder), never ~/.claude/get-shit-done/.
 *
 * Pattern caught: any path containing /get-shit-done/ as a directory segment
 * (e.g. ~/.claude/get-shit-done/workflows/..., ./get-shit-done/bin/...)
 * Package name references like "get-shit-done-cc" do NOT match (no trailing slash).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['commands/qgsd'];

// Matches /get-shit-done/ as a directory segment in a path
const INTERFERENCE_RE = /\/get-shit-done\//g;

const violations = [];

function scan(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, i) => {
        INTERFERENCE_RE.lastIndex = 0;
        if (INTERFERENCE_RE.test(line)) {
          violations.push({ file: path.relative(ROOT, full), line: i + 1, text: line.trim() });
        }
      });
    }
  }
}

for (const dir of SCAN_DIRS) {
  scan(path.join(ROOT, dir));
}

if (violations.length === 0) {
  console.log('✓ lint-isolation: no GSD path interference found');
  process.exit(0);
} else {
  console.error('✗ lint-isolation: QGSD commands must not reference /get-shit-done/ paths\n');
  console.error('  Use ~/.claude/qgsd/ instead of ~/.claude/get-shit-done/\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text}\n`);
  }
  console.error(`  ${violations.length} violation(s) found.`);
  process.exit(1);
}
