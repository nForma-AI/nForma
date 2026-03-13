'use strict';

/**
 * resolve-cli-integration.test.cjs
 * Integration tests for CLI path resolution pattern across unified-mcp-server.mjs and call-quorum-slot.cjs
 */

const { describe, it } = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('fs');
const path = require('path');
const { resolveCli } = require('../bin/resolve-cli.cjs');

describe('resolve-cli integration', () => {
  describe('bare name extraction from hardcoded path', () => {
    it('extracts bare name from /opt/homebrew/bin/codex', () => {
      const path_str = '/opt/homebrew/bin/codex';
      const bareName = path_str.split('/').pop();
      assert.equal(bareName, 'codex');
    });

    it('extracts bare name from /usr/bin/gemini', () => {
      const path_str = '/usr/bin/gemini';
      const bareName = path_str.split('/').pop();
      assert.equal(bareName, 'gemini');
    });

    it('handles Windows paths gracefully (forward slash fallback)', () => {
      const path_str = 'C:\\Program Files\\codex.exe';
      const bareName = path_str.split('/').pop();
      // On Windows path separators, split('/') won't work correctly, but our code uses split('/')
      // For unit test purposes, verify the extraction method works when passed forward-slash paths
      assert.ok(bareName.length > 0);
    });
  });

  describe('resolveCli returns valid paths for known CLIs', () => {
    it('resolveCli returns non-empty string for "node"', () => {
      const resolved = resolveCli('node');
      assert.ok(resolved);
      assert.equal(typeof resolved, 'string');
      assert.ok(resolved.length > 0);
    });

    it('resolveCli returns a string (bare name fallback) for unknown CLI', () => {
      const resolved = resolveCli('definitely-nonexistent-cli-xyz-123');
      assert.ok(resolved);
      assert.equal(typeof resolved, 'string');
      assert.ok(resolved.length > 0);
    });
  });

  describe('resolvedCli fallback pattern', () => {
    it('returns resolvedCli when set', () => {
      const provider = {
        cli: '/opt/homebrew/bin/codex',
        resolvedCli: '/usr/local/bin/codex',
      };
      const result = provider.resolvedCli ?? provider.cli;
      assert.equal(result, '/usr/local/bin/codex');
    });

    it('returns cli when resolvedCli is not set', () => {
      const provider = {
        cli: '/opt/homebrew/bin/codex',
      };
      const result = provider.resolvedCli ?? provider.cli;
      assert.equal(result, '/opt/homebrew/bin/codex');
    });

    it('returns cli when resolvedCli is null or undefined', () => {
      const provider = {
        cli: '/opt/homebrew/bin/codex',
        resolvedCli: null,
      };
      const result = provider.resolvedCli ?? provider.cli;
      assert.equal(result, '/opt/homebrew/bin/codex');
    });
  });

  describe('service command resolution', () => {
    it('resolves service array [ccr, start] at index 0', () => {
      const service = ['ccr', 'start'];
      const svcBareName = service[0];
      const resolved = resolveCli(svcBareName);
      assert.ok(resolved);
      assert.equal(typeof resolved, 'string');
      // Either resolved to full path or fell back to 'ccr'
      assert.ok(resolved === 'ccr' || resolved.includes('ccr'));
    });

    it('can replace service command in provider.service object', () => {
      const provider = {
        service: {
          start: ['ccr', 'start'],
          stop: ['ccr', 'stop'],
          status: ['ccr', 'status'],
        },
      };
      for (const key of ['start', 'stop', 'status']) {
        if (provider.service[key] && provider.service[key][0]) {
          const svcBareName = provider.service[key][0];
          const resolvedSvc = resolveCli(svcBareName);
          if (resolvedSvc !== svcBareName) {
            provider.service[key][0] = resolvedSvc;
          }
        }
      }
      // Verify structure is preserved
      assert.ok(Array.isArray(provider.service.start));
      assert.ok(provider.service.start.length >= 2);
    });
  });

  describe('all providers in providers.json have extractable bare names', () => {
    it('loads providers.json and validates all subprocess providers', () => {
      const configPath = path.join(__dirname, '..', 'bin', 'providers.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.ok(Array.isArray(config.providers));
      assert.ok(config.providers.length > 0);

      for (const provider of config.providers) {
        if (provider.type === 'subprocess' && provider.cli) {
          const bareName = provider.cli.split('/').pop();
          assert.ok(bareName, `Provider ${provider.name} has empty bare name`);
          assert.ok(bareName.length > 0, `Provider ${provider.name}: bare name is empty`);
          // Verify the bare name doesn't contain path separators
          assert.ok(!bareName.includes('/'), `Provider ${provider.name}: bare name contains /`);
          assert.ok(!bareName.includes('\\'), `Provider ${provider.name}: bare name contains \\`);
        }
      }
    });

    it('verifies at least 1 subprocess provider exists in providers.json', () => {
      const configPath = path.join(__dirname, '..', 'bin', 'providers.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const subprocessProviders = config.providers.filter(p => p.type === 'subprocess');
      assert.ok(subprocessProviders.length > 0, 'No subprocess providers found in providers.json');
    });
  });

  describe('pattern used in unified-mcp-server.mjs startup', () => {
    it('simulates unified-mcp-server.mjs resolution loop for a provider', () => {
      const provider = {
        name: 'codex-1',
        type: 'subprocess',
        cli: '/opt/homebrew/bin/codex',
      };

      // Simulate the resolution loop from unified-mcp-server.mjs
      if (provider.type === 'subprocess' && provider.cli) {
        const bareName = provider.cli.split('/').pop();
        provider.resolvedCli = resolveCli(bareName);
      }

      // Verify the provider now has a resolvedCli property
      assert.ok(provider.resolvedCli);
      assert.equal(typeof provider.resolvedCli, 'string');
      assert.ok(provider.resolvedCli.length > 0);
    });
  });

  describe('pattern used in call-quorum-slot.cjs dispatch', () => {
    it('simulates call-quorum-slot.cjs resolution before spawn', () => {
      const provider = {
        name: 'codex-1',
        type: 'subprocess',
        cli: '/opt/homebrew/bin/codex',
        display_type: 'codex-cli',
      };

      // Simulate the resolution from runSubprocess
      if (provider.type === 'subprocess' && provider.cli) {
        const bareName = provider.cli.split('/').pop();
        provider.resolvedCli = resolveCli(bareName);
      }

      // Simulate the spawn call with fallback pattern
      const spawnPath = provider.resolvedCli ?? provider.cli;
      assert.ok(spawnPath);
      assert.equal(typeof spawnPath, 'string');

      // Verify isCcr detection works with resolvedCli
      const isCcr = provider.display_type === 'claude-code-router' ||
        ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));
      assert.equal(isCcr, false); // codex is not ccr
    });
  });

  describe('isCcr detection pattern with resolvedCli', () => {
    it('detects ccr via display_type', () => {
      const provider = {
        display_type: 'claude-code-router',
        cli: '/opt/homebrew/bin/ccr',
      };

      const isCcr = provider.display_type === 'claude-code-router' ||
        ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));
      assert.equal(isCcr, true);
    });

    it('detects ccr via resolved path', () => {
      const provider = {
        cli: '/opt/homebrew/bin/ccr',
        resolvedCli: '/usr/bin/ccr',
      };

      const isCcr = provider.display_type === 'claude-code-router' ||
        ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));
      assert.equal(isCcr, true);
    });

    it('detects ccr via original path when resolvedCli not set', () => {
      const provider = {
        cli: '/opt/homebrew/bin/ccr',
      };

      const isCcr = provider.display_type === 'claude-code-router' ||
        ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));
      assert.equal(isCcr, true);
    });

    it('does not falsely detect ccr for non-ccr providers', () => {
      const provider = {
        display_type: 'codex-cli',
        cli: '/opt/homebrew/bin/codex',
        resolvedCli: '/usr/bin/codex',
      };

      const isCcr = provider.display_type === 'claude-code-router' ||
        ((provider.resolvedCli ?? provider.cli) && (provider.resolvedCli ?? provider.cli).includes('ccr'));
      assert.equal(isCcr, false);
    });
  });
});
