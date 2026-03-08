'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// NOTE: requiring nf-session-end.js registers stdin handlers and sets a timeout.
// We test only the exported helper functions, not the full hook lifecycle
// (which calls process.exit).

describe('nf-session-end', () => {
  // Lazy-load to avoid stdin handler side effects during test collection
  let mod;
  function loadMod() {
    if (!mod) {
      // Clear require cache so each test gets a fresh module
      const modPath = path.join(__dirname, 'nf-session-end.js');
      delete require.cache[modPath];
      mod = require(modPath);
    }
    return mod;
  }

  describe('findLearningExtractor', () => {
    it('should be exported as a function', () => {
      const m = loadMod();
      assert.strictEqual(typeof m.findLearningExtractor, 'function');
    });

    it('should return a module with extractErrorPatterns and extractCorrections', () => {
      const m = loadMod();
      const extractor = m.findLearningExtractor();
      // In the dev environment, it should find learning-extractor.cjs via ../bin/
      if (extractor) {
        assert.strictEqual(typeof extractor.extractErrorPatterns, 'function');
        assert.strictEqual(typeof extractor.extractCorrections, 'function');
        assert.strictEqual(typeof extractor.readLastLines, 'function');
      }
      // If not found (e.g., running outside dev env), that's also valid (fail-open)
    });
  });

  describe('findMemoryStore', () => {
    it('should be exported as a function', () => {
      const m = loadMod();
      assert.strictEqual(typeof m.findMemoryStore, 'function');
    });

    it('should return a module with appendEntry and isDuplicate', () => {
      const m = loadMod();
      const store = m.findMemoryStore();
      if (store) {
        assert.strictEqual(typeof store.appendEntry, 'function');
        assert.strictEqual(typeof store.isDuplicate, 'function');
      }
    });
  });

  describe('findSkillExtractor', () => {
    it('should be exported as a function', () => {
      const m = loadMod();
      assert.strictEqual(typeof m.findSkillExtractor, 'function');
    });

    it('should return a module with clusterByTags, generateCandidates, and readRecentEntries', () => {
      const m = loadMod();
      const extractor = m.findSkillExtractor();
      // In the dev environment, it should find skill-extractor.cjs via ../bin/
      if (extractor) {
        assert.strictEqual(typeof extractor.clusterByTags, 'function');
        assert.strictEqual(typeof extractor.generateCandidates, 'function');
        assert.strictEqual(typeof extractor.readRecentEntries, 'function');
      }
      // If not found (e.g., running outside dev env), that's also valid (fail-open)
    });
  });

  describe('fail-open behavior', () => {
    it('should export all finder functions even if modules are not installed globally', () => {
      const m = loadMod();
      // All functions must exist regardless of environment
      assert.ok(m.findLearningExtractor);
      assert.ok(m.findMemoryStore);
      assert.ok(m.findSkillExtractor);
    });
  });
});
