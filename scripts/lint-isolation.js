#!/usr/bin/env node
/**
 * lint-isolation.js
 *
 * Guards against non-portable paths in nForma skill files.
 *
 * Rules:
 * 1. GSD interference: no /get-shit-done/ directory segments (use ~/.claude/nf/)
 * 2. Portable require: no require('./bin/...') — use $HOME/.claude/nf-bin/ with CWD fallback
 * 3. Portable dispatch: no bare "commands/nf/" in Agent prompts — use $HOME/.claude/commands/nf/
 *
 * These patterns break when nForma is used in repos other than the QGSD source repo,
 * because ./bin/ and commands/nf/ only exist locally in the source checkout.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['commands/nf'];

// --- Rule definitions ---
const RULES = [
  {
    id: 'gsd-interference',
    re: /\/get-shit-done\//g,
    message: 'Must not reference /get-shit-done/ paths — use ~/.claude/nf/',
  },
  {
    id: 'portable-require',
    // require('./bin/...') without a preceding fallback resolution pattern
    // Matches: require('./bin/foo.cjs') but NOT require(stPath) or require(installed)
    re: /require\('\.\/(bin\/[^']+)'\)/g,
    message: "Non-portable require('./bin/...') — use $HOME/.claude/nf-bin/ with CWD fallback",
  },
  {
    id: 'portable-dispatch',
    // "Read and follow commands/nf/" without $HOME or ~ prefix in Agent prompts
    // Matches: Read and follow commands/nf/solve-diagnose.md
    // Does NOT match: $HOME/.claude/commands/nf/ or ~/.claude/commands/nf/
    re: /(?:Read and follow|read and follow)\s+commands\/nf\//g,
    message: 'Non-portable Agent dispatch — use $HOME/.claude/commands/nf/ with CWD fallback',
  },
];

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
        for (const rule of RULES) {
          rule.re.lastIndex = 0;
          if (rule.re.test(line)) {
            violations.push({
              rule: rule.id,
              message: rule.message,
              file: path.relative(ROOT, full),
              line: i + 1,
              text: line.trim(),
            });
          }
        }
      });
    }
  }
}

for (const dir of SCAN_DIRS) {
  scan(path.join(ROOT, dir));
}

if (violations.length === 0) {
  console.log('✓ lint-isolation: all portable-path checks passed');
  process.exit(0);
} else {
  console.error(`✗ lint-isolation: ${violations.length} violation(s) found\n`);
  // Group by rule
  const byRule = {};
  for (const v of violations) {
    (byRule[v.rule] ||= []).push(v);
  }
  for (const [rule, items] of Object.entries(byRule)) {
    console.error(`  [${rule}] ${items[0].message}`);
    for (const v of items) {
      console.error(`    ${v.file}:${v.line}`);
      console.error(`      ${v.text}`);
    }
    console.error('');
  }
  process.exit(1);
}
