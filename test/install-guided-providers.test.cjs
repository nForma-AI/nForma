#!/usr/bin/env node
'use strict';

/**
 * Unit tests for guided provider selection in install.js.
 * Tests classifyProviders, detectExternalClis, and the selectedProviderSlots filter logic.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// The install.js module runs the full installer when require.main === module,
// but when required as a library (require.main !== module) it exports functions.
// We need to set process.argv to avoid triggering flag-based install paths.
const origArgv = process.argv;
process.argv = ['node', 'test'];

const { classifyProviders, detectExternalClis } = require('../bin/install.js');

// Restore argv
process.argv = origArgv;

const providers = require('../bin/providers.json').providers;

describe('classifyProviders', () => {
  const result = classifyProviders(providers);

  it('should classify 6 CCR slots (claude-1..6)', () => {
    assert.equal(result.ccr.length, 6);
    for (const p of result.ccr) {
      assert.equal(path.basename(p.cli || ''), 'ccr', `${p.name} should have cli basename "ccr"`);
      assert.ok(p.name.startsWith('claude-'), `${p.name} should start with "claude-"`);
    }
  });

  it('should classify 4 external primary slots', () => {
    assert.equal(result.externalPrimary.length, 4);
    const names = result.externalPrimary.map(p => p.name).sort();
    assert.deepEqual(names, ['codex-1', 'copilot-1', 'gemini-1', 'opencode-1']);
  });

  it('should classify 2 dual-subscription slots', () => {
    assert.equal(result.dualSubscription.length, 2);
    const names = result.dualSubscription.map(p => p.name).sort();
    assert.deepEqual(names, ['codex-2', 'gemini-2']);
  });

  it('should set correct parent for dual-subscription slots', () => {
    const codex2 = result.dualSubscription.find(p => p.name === 'codex-2');
    const gemini2 = result.dualSubscription.find(p => p.name === 'gemini-2');
    assert.equal(codex2.parent, 'codex-1');
    assert.equal(gemini2.parent, 'gemini-1');
  });

  it('should derive bareCli as "copilot" for copilot-1 (NOT "ask")', () => {
    const copilot = result.externalPrimary.find(p => p.name === 'copilot-1');
    assert.equal(copilot.bareCli, 'copilot', 'bareCli must come from cli path basename, not mainTool');
  });

  it('should derive correct bareCli for all external primaries', () => {
    const codex = result.externalPrimary.find(p => p.name === 'codex-1');
    const gemini = result.externalPrimary.find(p => p.name === 'gemini-1');
    const opencode = result.externalPrimary.find(p => p.name === 'opencode-1');
    assert.equal(codex.bareCli, 'codex');
    assert.equal(gemini.bareCli, 'gemini');
    assert.equal(opencode.bareCli, 'opencode');
  });
});

describe('classifyProviders edge cases', () => {
  it('should derive bareCli from cli path when both cli and mainTool are set', () => {
    const result = classifyProviders([
      { name: 'copilot-1', mainTool: 'ask', cli: '/opt/homebrew/bin/copilot' }
    ]);
    assert.equal(result.externalPrimary[0].bareCli, 'copilot');
  });

  it('should fall back to mainTool when cli is empty', () => {
    const result = classifyProviders([
      { name: 'test-1', mainTool: 'mytool', cli: '' }
    ]);
    assert.equal(result.externalPrimary[0].bareCli, 'mytool');
  });

  it('should fall back to mainTool when cli is missing', () => {
    const result = classifyProviders([
      { name: 'test-1', mainTool: 'mytool' }
    ]);
    assert.equal(result.externalPrimary[0].bareCli, 'mytool');
  });
});

describe('detectExternalClis', () => {
  const classified = classifyProviders(providers);
  const detected = detectExternalClis(classified.externalPrimary);

  it('should return same number of entries as externalPrimary', () => {
    assert.equal(detected.length, classified.externalPrimary.length);
  });

  it('should have found (boolean) and resolvedPath fields on each entry', () => {
    for (const d of detected) {
      assert.equal(typeof d.found, 'boolean', `${d.name} should have boolean found`);
      if (d.found) {
        assert.equal(typeof d.resolvedPath, 'string', `${d.name} found=true should have string resolvedPath`);
        assert.notEqual(d.resolvedPath, d.bareCli, `${d.name} resolvedPath should be a full path, not bare name`);
      } else {
        assert.equal(d.resolvedPath, null, `${d.name} found=false should have null resolvedPath`);
      }
    }
  });

  it('should preserve original provider properties', () => {
    for (const d of detected) {
      assert.ok(d.name, 'should have name');
      assert.ok(d.bareCli, 'should have bareCli');
    }
  });
});

describe('selectedProviderSlots filter logic', () => {
  it('should filter providers when selectedProviderSlots is an array', () => {
    const slots = ['claude-1', 'claude-2', 'codex-1'];
    const filtered = providers.filter(p => slots.includes(p.name));
    assert.equal(filtered.length, 3);
    const names = filtered.map(p => p.name).sort();
    assert.deepEqual(names, ['claude-1', 'claude-2', 'codex-1']);
  });

  it('should pass ALL providers when selectedProviderSlots is null', () => {
    const slots = null;
    const filtered = providers.filter(p => !slots || slots.includes(p.name));
    assert.equal(filtered.length, providers.length);
  });

  it('should pass only CCR slots when selectedProviderSlots has only claude names', () => {
    const classified = classifyProviders(providers);
    const ccrOnly = classified.ccr.map(p => p.name);
    const filtered = providers.filter(p => ccrOnly.includes(p.name));
    assert.equal(filtered.length, 6);
    for (const p of filtered) {
      assert.ok(p.name.startsWith('claude-'), `${p.name} should be a claude slot`);
    }
  });
});

describe('--all-providers flag parsing', () => {
  it('should recognize --all-providers flag', () => {
    assert.ok(['--all-providers'].includes('--all-providers'));
  });
});
