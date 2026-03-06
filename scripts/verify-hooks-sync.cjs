#!/usr/bin/env node
/**
 * CI guard: verifies that every hook registered by the installer has a
 * corresponding entry in the build-hooks HOOKS_TO_COPY list, and that
 * every require('./...') dependency inside those hooks is also included.
 *
 * Exits non-zero on drift so the test suite catches it early.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INSTALL_JS = path.join(ROOT, 'bin', 'install.js');
const BUILD_HOOKS_JS = path.join(ROOT, 'scripts', 'build-hooks.js');
const HOOKS_DIR = path.join(ROOT, 'hooks');

// --- Extract HOOKS_TO_COPY from build-hooks.js ---
function getHooksToCopy() {
  const src = fs.readFileSync(BUILD_HOOKS_JS, 'utf8');
  const match = src.match(/HOOKS_TO_COPY\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error('Could not parse HOOKS_TO_COPY from build-hooks.js');
  const entries = [];
  for (const m of match[1].matchAll(/'([^']+)'/g)) {
    entries.push(m[1]);
  }
  return new Set(entries);
}

// --- Extract hook filenames registered by the installer via buildHookCommand() ---
function getInstallerHooks() {
  const src = fs.readFileSync(INSTALL_JS, 'utf8');
  const hooks = new Set();
  for (const m of src.matchAll(/buildHookCommand\(\s*\w+\s*,\s*'([^']+)'\s*\)/g)) {
    hooks.add(m[1]);
  }
  return hooks;
}

// --- Extract local require('./...') dependencies from a hook source file ---
function getLocalRequires(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const deps = new Set();
  for (const m of src.matchAll(/require\(\s*'\.\/([^']+)'\s*\)/g)) {
    let dep = m[1];
    // Node resolves require('./config-loader') to './config-loader.js'
    // Normalize to match HOOKS_TO_COPY entries which include extensions
    if (!path.extname(dep)) dep += '.js';
    deps.add(dep);
  }
  return deps;
}

// --- Main ---
const hooksToCopy = getHooksToCopy();
const installerHooks = getInstallerHooks();
const errors = [];

// 1. Every hook registered by the installer must be in HOOKS_TO_COPY
for (const hook of installerHooks) {
  if (!hooksToCopy.has(hook)) {
    errors.push(`MISSING from HOOKS_TO_COPY: '${hook}' (registered in installer via buildHookCommand)`);
  }
}

// 2. Every local require() dependency of copied hooks must also be in HOOKS_TO_COPY
for (const hook of hooksToCopy) {
  const hookPath = path.join(HOOKS_DIR, hook);
  if (!fs.existsSync(hookPath)) {
    errors.push(`HOOKS_TO_COPY entry '${hook}' does not exist at ${hookPath}`);
    continue;
  }
  const deps = getLocalRequires(hookPath);
  for (const dep of deps) {
    if (!hooksToCopy.has(dep)) {
      errors.push(`MISSING from HOOKS_TO_COPY: '${dep}' (required by ${hook})`);
    }
  }
}

if (errors.length > 0) {
  console.error('hooks-sync verification FAILED:\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nFix: update HOOKS_TO_COPY in scripts/build-hooks.js');
  process.exit(1);
} else {
  console.log(`hooks-sync OK: ${hooksToCopy.size} hooks in build list, ${installerHooks.size} registered by installer`);
}
