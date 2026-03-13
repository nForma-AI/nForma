'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const BUILD_HOOKS_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const DIST_DIR = path.join(__dirname, '..', 'hooks', 'dist');

describe('fresh clone install: hooks/dist auto-rebuild', () => {
  let tmpDir;
  let distExistedBefore;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-fresh-clone-test-'));

    // Record whether hooks/dist/ existed before we touch it
    distExistedBefore = fs.existsSync(DIST_DIR);

    // Simulate fresh clone: remove hooks/dist/ entirely
    fs.rmSync(DIST_DIR, { recursive: true, force: true });

    // Run install -- this should auto-rebuild hooks/dist/
    execFileSync(process.execPath, [
      INSTALL_SCRIPT, '--claude', '--global', '--config-dir', tmpDir,
    ], {
      stdio: 'pipe',
      timeout: 30000,
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: undefined,
      },
    });
  });

  after(() => {
    try {
      // Always restore hooks/dist/ so other tests are not affected
      execFileSync(process.execPath, [BUILD_HOOKS_SCRIPT], {
        stdio: 'pipe',
        timeout: 15000,
      });
    } finally {
      // Clean up temp dir
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('install succeeds when hooks/dist/ is initially missing', () => {
    // If we got here, the execFileSync in before() did not throw
    assert.ok(true, 'install completed without error');
  });

  test('hooks/dist/ is rebuilt after install', () => {
    assert.ok(
      fs.existsSync(DIST_DIR),
      'hooks/dist/ must exist after install auto-rebuild'
    );
  });

  test('installed hooks directory contains required hooks', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    assert.ok(fs.existsSync(hooksDir), 'hooks/ directory must exist in config dir');
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.js'));
    assert.ok(hookFiles.length > 0, 'hooks/ must contain .js files');
    for (const required of ['nf-stop.js', 'nf-prompt.js', 'nf-circuit-breaker.js']) {
      assert.ok(hookFiles.includes(required), `hooks/ must contain ${required}`);
    }
  });

  test('re-install is idempotent', () => {
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-fresh-clone-idem-'));
    try {
      execFileSync(process.execPath, [
        INSTALL_SCRIPT, '--claude', '--global', '--config-dir', tmpDir2,
      ], {
        stdio: 'pipe',
        timeout: 30000,
        env: {
          ...process.env,
          CLAUDE_CONFIG_DIR: undefined,
        },
      });

      // Compare hook file lists
      const hooks1 = fs.readdirSync(path.join(tmpDir, 'hooks')).sort();
      const hooks2 = fs.readdirSync(path.join(tmpDir2, 'hooks')).sort();
      assert.deepStrictEqual(hooks2, hooks1, 'second install must produce same hooks');
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  test('hooks/dist/ contains files matching HOOKS_TO_COPY count', () => {
    // Read HOOKS_TO_COPY array from build-hooks.js
    const buildScript = fs.readFileSync(BUILD_HOOKS_SCRIPT, 'utf8');
    const matches = buildScript.match(/HOOKS_TO_COPY\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(matches, 'HOOKS_TO_COPY array must be found in build-hooks.js');

    // Count entries that actually exist as source files (build-hooks.js skips missing)
    const entries = matches[1].match(/'([^']+)'/g);
    assert.ok(entries, 'HOOKS_TO_COPY must have quoted entries');
    const hooksSourceDir = path.join(__dirname, '..', 'hooks');
    const existingEntries = entries
      .map(e => e.replace(/'/g, ''))
      .filter(name => fs.existsSync(path.join(hooksSourceDir, name)));
    const expectedCount = existingEntries.length;

    // Count .js and .cjs files in hooks/dist/
    const distFiles = fs.readdirSync(DIST_DIR)
      .filter(f => f.endsWith('.js') || f.endsWith('.cjs'));
    assert.ok(
      distFiles.length >= expectedCount,
      `hooks/dist/ must have at least ${expectedCount} files (existing HOOKS_TO_COPY entries), got ${distFiles.length}`
    );
  });
});
