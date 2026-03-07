'use strict';
// hooks/nf-console-guard.js
// Stop hook: warns about leftover console.log statements in modified files.
//
// Scans git-modified JS/TS files for console.log statements and emits a
// warning (never a block). Advisory only — does not prevent session stop.
//
// Input (stdin): Claude Code Stop event JSON payload
//
// Output (stderr): advisory warning when console.log found
//   stdout: no output (pass-through) — Stop hooks only accept "approve" or "block"
//
// Fail-open: exits 0 in ALL cases — never blocks the Stop event.

const { spawnSync } = require('child_process');
const fs = require('fs');
const { loadConfig, shouldRunHook } = require('./config-loader');

const JS_TS_RE = /\.(js|ts|cjs|mjs|jsx|tsx)$/;
const CONSOLE_LOG_RE = /^\s*console\.log\b/gm;
const COMMENT_LINE_RE = /^\s*(\/\/|\/?\*)/;
const MAX_FILES = 20;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);

    // Profile guard — exit early if this hook is not active for the current profile
    const config = loadConfig(input.cwd || process.cwd());
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('nf-console-guard', profile)) {
      process.exit(0);
    }

    // Get all modified files (staged + unstaged)
    const stagedResult = spawnSync('git', ['diff', '--cached', '--name-only'], {
      encoding: 'utf8',
      cwd: input.cwd || process.cwd(),
      timeout: 5000,
    });
    const unstagedResult = spawnSync('git', ['diff', '--name-only'], {
      encoding: 'utf8',
      cwd: input.cwd || process.cwd(),
      timeout: 5000,
    });

    // Combine and dedupe
    const allFiles = new Set();
    if (stagedResult.status === 0 && stagedResult.stdout) {
      stagedResult.stdout.trim().split('\n').filter(Boolean).forEach(f => allFiles.add(f));
    }
    if (unstagedResult.status === 0 && unstagedResult.stdout) {
      unstagedResult.stdout.trim().split('\n').filter(Boolean).forEach(f => allFiles.add(f));
    }

    // Filter to JS/TS files only
    const jsFiles = [...allFiles].filter(f => JS_TS_RE.test(f));

    // File-count cap: skip scan if too many files
    if (jsFiles.length === 0 || jsFiles.length > MAX_FILES) {
      process.exit(0);
    }

    // Scan each file for console.log
    const cwd = input.cwd || process.cwd();
    const findings = [];

    for (const file of jsFiles) {
      try {
        const fullPath = require('path').join(cwd, file);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        let count = 0;
        for (const line of lines) {
          // Skip comment lines
          if (COMMENT_LINE_RE.test(line)) continue;
          if (/^\s*console\.log\b/.test(line)) {
            count++;
          }
        }
        if (count > 0) {
          findings.push(`${file} (${count} occurrence${count > 1 ? 's' : ''})`);
        }
      } catch {
        // Skip unreadable files — fail-open
      }
    }

    if (findings.length > 0) {
      process.stderr.write('[nf-console-guard] CONSOLE.LOG WARNING: Found console.log statements in: ' +
        findings.join(', ') +
        '. Consider removing debug logging before shipping.\n');
    }

    process.exit(0);
  } catch (e) {
    // Malformed JSON or unexpected error — fail-open, no output
    process.exit(0);
  }
});
