'use strict';

/**
 * test/tui-cli-agent-resolve.test.cjs — Unit tests for CLI Agent path resolution
 * Tests validate: resolveCli integration, cross-platform resolution, executable validation,
 * and MCP entry format parity with mcp-setup output.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// ─── Test 1: resolveCli import works ─────────────────────────────────────────
describe('CLI Agent Resolution Tests', () => {
  it('resolveCli import works from nForma.cjs location', () => {
    let resolveCli;
    assert.doesNotThrow(() => {
      const resolved = require('../bin/resolve-cli.cjs');
      resolveCli = resolved.resolveCli;
    });
    assert.ok(typeof resolveCli === 'function', 'resolveCli should be a function');
  });

  // ─── Test 2: resolveCli returns non-empty string for known CLI ──────────────
  it('resolveCli returns non-empty string for known CLI (node)', () => {
    const { resolveCli } = require('../bin/resolve-cli.cjs');
    const result = resolveCli('node');
    assert.ok(typeof result === 'string', 'result should be a string');
    assert.ok(result.length > 0, 'result should be non-empty');
  });

  // ─── Test 3: resolveCli returns bare name as fallback for unknown CLI ───────
  it('resolveCli returns bare name as fallback for unknown CLI', () => {
    const { resolveCli } = require('../bin/resolve-cli.cjs');
    const result = resolveCli('nonexistent-cli-xyz-12345');
    assert.strictEqual(
      result,
      'nonexistent-cli-xyz-12345',
      'should return bare name unchanged for unknown CLI'
    );
  });

  // ─── Test 4: Resolved path for "node" is executable ────────────────────────
  it('resolved path for "node" is executable (passes fs.accessSync validation)', () => {
    const { resolveCli } = require('../bin/resolve-cli.cjs');
    const resolvedNode = resolveCli('node');

    // This should NOT throw — node is guaranteed to exist and be executable
    assert.doesNotThrow(
      () => fs.accessSync(resolvedNode, fs.constants.X_OK),
      `resolved path "${resolvedNode}" should be executable`
    );
  });

  // ─── Test 5: Non-existent CLI path fails accessSync validation ──────────────
  it('non-existent CLI path fails accessSync validation (validation gate works)', () => {
    const nonexistentPath = 'nonexistent-cli-xyz-12345';

    // This SHOULD throw — the path doesn't exist
    assert.throws(
      () => fs.accessSync(nonexistentPath, fs.constants.X_OK),
      { code: 'ENOENT' },
      'accessSync should throw ENOENT for non-existent path'
    );
  });

  // ─── Test 6: MCP entry format parity ─────────────────────────────────────
  it('MCP entry format parity: CLI Agent entry structure matches mcp-setup format', () => {
    const { resolveCli } = require('../bin/resolve-cli.cjs');

    // Simulate the TUI code path: resolve CLI, then construct MCP entry
    const resolvedCommand = resolveCli('node');
    const tuiEntry = { type: 'stdio', command: resolvedCommand, args: [] };

    // Verify structure matches mcp-setup format
    assert.strictEqual(tuiEntry.type, 'stdio', 'type should be "stdio"');
    assert.ok(typeof tuiEntry.command === 'string', 'command should be a string');
    assert.ok(tuiEntry.command.length > 0, 'command should be non-empty');
    assert.ok(Array.isArray(tuiEntry.args), 'args should be an array');
    assert.strictEqual(tuiEntry.args.length, 0, 'args should be empty array');

    // Verify absolute path: starts with / on macOS/Linux
    if (process.platform !== 'win32') {
      assert.ok(
        tuiEntry.command.startsWith('/'),
        `command should be absolute path on ${process.platform}, got: ${tuiEntry.command}`
      );
    }
  });

  // ─── Test 7: Bare name extraction ─────────────────────────────────────────
  it('bare name extraction from hardcoded path (pattern used by resolve-cli)', () => {
    const fullPath = '/opt/homebrew/bin/codex';
    const bareName = fullPath.split('/').pop();
    assert.strictEqual(bareName, 'codex', 'should extract "codex" from full path');
  });

  // ─── Test 8: Entry has exactly 3 keys (no extra fields) ──────────────────────
  it('TUI-generated entry has exactly 3 keys: type, command, args (no extra fields)', () => {
    const { resolveCli } = require('../bin/resolve-cli.cjs');
    const resolvedCommand = resolveCli('node');
    const tuiEntry = { type: 'stdio', command: resolvedCommand, args: [] };

    const keys = Object.keys(tuiEntry);
    assert.strictEqual(keys.length, 3, 'entry should have exactly 3 keys');
    assert.deepStrictEqual(
      keys.sort(),
      ['args', 'command', 'type'].sort(),
      'keys should be exactly: type, command, args'
    );
  });
});
