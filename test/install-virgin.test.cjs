'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const PKG = require('../package.json');

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively count files with the given extension under dir.
 */
function countFiles(dir, ext) {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(full, ext);
    } else if (entry.name.endsWith(ext)) {
      count++;
    }
  }
  return count;
}

/**
 * Return file content or null if path doesn't exist.
 */
function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Count all files recursively under dir (any extension).
 */
function countAllFiles(dir) {
  let count = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countAllFiles(full);
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Run the installer for a given runtime into a temp directory.
 */
function runInstall(tmpDir, runtime) {
  return execFileSync(process.execPath, [
    INSTALL_SCRIPT,
    `--${runtime}`,
    '--global',
    '--config-dir', tmpDir,
  ], {
    stdio: 'pipe',
    timeout: 30000,
    env: {
      ...process.env,
      // Prevent any env var overrides from affecting test
      CLAUDE_CONFIG_DIR: undefined,
      GEMINI_CONFIG_DIR: undefined,
      OPENCODE_CONFIG_DIR: undefined,
      OPENCODE_CONFIG: undefined,
      XDG_CONFIG_HOME: undefined,
    },
  });
}

// ── Claude Runtime ──────────────────────────────────────────────────────────

describe('virgin install: claude', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-install-test-'));
    runInstall(tmpDir, 'claude');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── File layout ───────────────────────────────────────────────────────

  test('nf/ directory contains .md workflow files', () => {
    const nfDir = path.join(tmpDir, 'nf');
    assert.ok(fs.existsSync(nfDir), 'nf/ directory must exist');
    assert.ok(countFiles(nfDir, '.md') > 0, 'nf/ must contain .md files');
  });

  test('nf/VERSION contains package version', () => {
    const content = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));
    assert.ok(content, 'VERSION file must exist');
    assert.equal(content.trim(), PKG.version);
  });

  test('nf-bin/ directory contains .cjs scripts', () => {
    const binDir = path.join(tmpDir, 'nf-bin');
    assert.ok(fs.existsSync(binDir), 'nf-bin/ directory must exist');
    assert.ok(countFiles(binDir, '.cjs') > 0, 'nf-bin/ must contain .cjs files');
  });

  test('hooks/ directory contains required .js hook files', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    assert.ok(fs.existsSync(hooksDir), 'hooks/ directory must exist');
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.js'));
    assert.ok(hookFiles.length > 0, 'hooks/ must contain .js files');
    // Required hooks
    for (const required of ['nf-stop.js', 'nf-prompt.js', 'nf-circuit-breaker.js']) {
      assert.ok(hookFiles.includes(required), `hooks/ must contain ${required}`);
    }
  });

  test('agents/ directory contains .md agent files', () => {
    const agentsDir = path.join(tmpDir, 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents/ directory must exist');
    assert.ok(countFiles(agentsDir, '.md') > 0, 'agents/ must contain .md files');
  });

  test('nf.json exists and is valid JSON', () => {
    const content = readIfExists(path.join(tmpDir, 'nf.json'));
    assert.ok(content, 'nf.json must exist');
    const parsed = JSON.parse(content);
    assert.equal(typeof parsed, 'object');
  });

  test('settings.json exists and has hooks configured', () => {
    const content = readIfExists(path.join(tmpDir, 'settings.json'));
    assert.ok(content, 'settings.json must exist');
    const parsed = JSON.parse(content);
    assert.ok(parsed.hooks, 'settings.json must have hooks key');
  });

  test('package.json exists with CommonJS type', () => {
    const content = readIfExists(path.join(tmpDir, 'package.json'));
    assert.ok(content, 'package.json must exist');
    const parsed = JSON.parse(content);
    assert.equal(parsed.type, 'commonjs');
  });

  test('commands/nf/ directory exists with .md files', () => {
    const commandsDir = path.join(tmpDir, 'commands', 'nf');
    assert.ok(fs.existsSync(commandsDir), 'commands/nf/ must exist');
    assert.ok(countFiles(commandsDir, '.md') > 0, 'commands/nf/ must contain .md files');
  });

  // ── Content adaptation ────────────────────────────────────────────────

  test('config-loader contains .claude path references', () => {
    const content = readIfExists(path.join(tmpDir, 'hooks', 'config-loader.js'));
    assert.ok(content, 'config-loader.js must be readable');
    assert.ok(content.includes("'.claude'"), "Claude config-loader must reference '.claude'");
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  test('re-install produces identical layout (OverridesPreserved)', () => {
    const countBefore = countAllFiles(tmpDir);
    const versionBefore = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    // Run install again into same dir
    runInstall(tmpDir, 'claude');

    const countAfter = countAllFiles(tmpDir);
    const versionAfter = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    assert.equal(countBefore, countAfter, 'File count must be identical after re-install');
    assert.equal(versionBefore, versionAfter, 'VERSION must be identical after re-install');
  });
});

// ── OpenCode Runtime ────────────────────────────────────────────────────────

describe('virgin install: opencode', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-install-test-'));
    runInstall(tmpDir, 'opencode');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── File layout ───────────────────────────────────────────────────────

  test('nf/ directory contains .md workflow files', () => {
    const nfDir = path.join(tmpDir, 'nf');
    assert.ok(fs.existsSync(nfDir), 'nf/ directory must exist');
    assert.ok(countFiles(nfDir, '.md') > 0, 'nf/ must contain .md files');
  });

  test('nf/VERSION contains package version', () => {
    const content = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));
    assert.ok(content, 'VERSION file must exist');
    assert.equal(content.trim(), PKG.version);
  });

  test('nf-bin/ directory contains .cjs scripts', () => {
    const binDir = path.join(tmpDir, 'nf-bin');
    assert.ok(fs.existsSync(binDir), 'nf-bin/ directory must exist');
    assert.ok(countFiles(binDir, '.cjs') > 0, 'nf-bin/ must contain .cjs files');
  });

  test('hooks/ directory contains required .js hook files', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    assert.ok(fs.existsSync(hooksDir), 'hooks/ directory must exist');
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.js'));
    assert.ok(hookFiles.length > 0, 'hooks/ must contain .js files');
    for (const required of ['nf-stop.js', 'nf-prompt.js', 'nf-circuit-breaker.js']) {
      assert.ok(hookFiles.includes(required), `hooks/ must contain ${required}`);
    }
  });

  test('agents/ directory contains .md agent files', () => {
    const agentsDir = path.join(tmpDir, 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents/ directory must exist');
    assert.ok(countFiles(agentsDir, '.md') > 0, 'agents/ must contain .md files');
  });

  test('package.json exists with CommonJS type', () => {
    const content = readIfExists(path.join(tmpDir, 'package.json'));
    assert.ok(content, 'package.json must exist');
    const parsed = JSON.parse(content);
    assert.equal(parsed.type, 'commonjs');
  });

  test('command/ directory exists with nf-*.md files (flat structure)', () => {
    const commandDir = path.join(tmpDir, 'command');
    assert.ok(fs.existsSync(commandDir), 'command/ must exist for OpenCode');
    const nfFiles = fs.readdirSync(commandDir).filter(f => f.startsWith('nf-') && f.endsWith('.md'));
    assert.ok(nfFiles.length > 0, 'command/ must contain nf-*.md files');
  });

  // ── Content adaptation ────────────────────────────────────────────────

  test('config-loader contains opencode config path references', () => {
    const content = readIfExists(path.join(tmpDir, 'hooks', 'config-loader.js'));
    assert.ok(content, 'config-loader.js must be readable');
    assert.ok(
      content.includes("'.config', 'opencode'"),
      "OpenCode config-loader must reference '.config', 'opencode'"
    );
  });

  test('command files use /nf- prefix (OpenCode flat structure)', () => {
    const commandDir = path.join(tmpDir, 'command');
    const files = fs.readdirSync(commandDir).filter(f => f.startsWith('nf-') && f.endsWith('.md'));
    assert.ok(files.length > 0, 'Need at least one command file to test');
    // Verify /nf: has been converted to /nf- in content
    let foundSlashConversion = false;
    for (const file of files) {
      const content = fs.readFileSync(path.join(commandDir, file), 'utf8');
      if (content.includes('/nf-')) foundSlashConversion = true;
      // Must NOT have /nf: references (should be converted to /nf-)
      assert.ok(!content.includes('/nf:'), `${file} must not contain /nf: references (should be /nf-)`);
    }
    assert.ok(foundSlashConversion, 'At least one command file must contain /nf- references');
  });

  test('agent files use OpenCode tool name conversions', () => {
    const agentsDir = path.join(tmpDir, 'agents');
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
    assert.ok(files.length > 0, 'Need at least one agent file to test');
    // Verify /nf: has been converted to /nf- and path prefix uses tmpDir
    let foundPathPrefix = false;
    for (const file of files) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      // Must NOT have /nf: references (should be converted to /nf-)
      assert.ok(!content.includes('/nf:'), `Agent ${file} must not contain /nf: references`);
      // Path prefix should use tmpDir (from --config-dir)
      if (content.includes(tmpDir)) foundPathPrefix = true;
    }
    assert.ok(foundPathPrefix, 'At least one agent file must use --config-dir path prefix');
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  test('re-install produces identical layout (OverridesPreserved)', () => {
    const countBefore = countAllFiles(tmpDir);
    const versionBefore = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    runInstall(tmpDir, 'opencode');

    const countAfter = countAllFiles(tmpDir);
    const versionAfter = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    assert.equal(countBefore, countAfter, 'File count must be identical after re-install');
    assert.equal(versionBefore, versionAfter, 'VERSION must be identical after re-install');
  });
});

// ── Gemini Runtime ──────────────────────────────────────────────────────────

describe('virgin install: gemini', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-install-test-'));
    runInstall(tmpDir, 'gemini');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── File layout ───────────────────────────────────────────────────────

  test('nf/ directory contains .md workflow files', () => {
    const nfDir = path.join(tmpDir, 'nf');
    assert.ok(fs.existsSync(nfDir), 'nf/ directory must exist');
    assert.ok(countFiles(nfDir, '.md') > 0, 'nf/ must contain .md files');
  });

  test('nf/VERSION contains package version', () => {
    const content = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));
    assert.ok(content, 'VERSION file must exist');
    assert.equal(content.trim(), PKG.version);
  });

  test('nf-bin/ directory contains .cjs scripts', () => {
    const binDir = path.join(tmpDir, 'nf-bin');
    assert.ok(fs.existsSync(binDir), 'nf-bin/ directory must exist');
    assert.ok(countFiles(binDir, '.cjs') > 0, 'nf-bin/ must contain .cjs files');
  });

  test('hooks/ directory contains required .js hook files', () => {
    const hooksDir = path.join(tmpDir, 'hooks');
    assert.ok(fs.existsSync(hooksDir), 'hooks/ directory must exist');
    const hookFiles = fs.readdirSync(hooksDir).filter(f => f.endsWith('.js'));
    assert.ok(hookFiles.length > 0, 'hooks/ must contain .js files');
    for (const required of ['nf-stop.js', 'nf-prompt.js', 'nf-circuit-breaker.js']) {
      assert.ok(hookFiles.includes(required), `hooks/ must contain ${required}`);
    }
  });

  test('agents/ directory contains .md agent files', () => {
    const agentsDir = path.join(tmpDir, 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents/ directory must exist');
    assert.ok(countFiles(agentsDir, '.md') > 0, 'agents/ must contain .md files');
  });

  test('settings.json exists and has hooks configured', () => {
    const content = readIfExists(path.join(tmpDir, 'settings.json'));
    assert.ok(content, 'settings.json must exist');
    const parsed = JSON.parse(content);
    assert.ok(parsed.hooks, 'settings.json must have hooks key');
  });

  test('package.json exists with CommonJS type', () => {
    const content = readIfExists(path.join(tmpDir, 'package.json'));
    assert.ok(content, 'package.json must exist');
    const parsed = JSON.parse(content);
    assert.equal(parsed.type, 'commonjs');
  });

  test('commands/nf/ directory exists with .toml command files', () => {
    const commandsDir = path.join(tmpDir, 'commands', 'nf');
    assert.ok(fs.existsSync(commandsDir), 'commands/nf/ must exist');
    assert.ok(countFiles(commandsDir, '.toml') > 0, 'commands/nf/ must contain .toml files (Gemini TOML format)');
  });

  // ── Content adaptation ────────────────────────────────────────────────

  test('config-loader contains .gemini path references', () => {
    const content = readIfExists(path.join(tmpDir, 'hooks', 'config-loader.js'));
    assert.ok(content, 'config-loader.js must be readable');
    assert.ok(content.includes("'.gemini'"), "Gemini config-loader must reference '.gemini'");
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  test('re-install produces identical layout (OverridesPreserved)', () => {
    const countBefore = countAllFiles(tmpDir);
    const versionBefore = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    runInstall(tmpDir, 'gemini');

    const countAfter = countAllFiles(tmpDir);
    const versionAfter = readIfExists(path.join(tmpDir, 'nf', 'VERSION'));

    assert.equal(countBefore, countAfter, 'File count must be identical after re-install');
    assert.equal(versionBefore, versionAfter, 'VERSION must be identical after re-install');
  });
});
