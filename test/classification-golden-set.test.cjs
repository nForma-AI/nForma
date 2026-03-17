'use strict';
/** @requirement CLASS-01 — validates Haiku classifier golden set infrastructure and key generation */

// Classification accuracy golden set -- validates item format and key generation.
// Actual Haiku accuracy measurement is a MANUAL step:
//   1. Run: node bin/solve-tui.cjs classify --golden-set test/classification-golden-set/
//   2. Compare Haiku verdicts against expected_verdict in golden set files
//   3. Compute precision/recall per category
// This test validates the INFRASTRUCTURE, not the live Haiku evaluation.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { itemKey } = require('../bin/solve-tui.cjs');

const GOLDEN_DIR = path.join(__dirname, 'classification-golden-set');
const CATEGORIES = ['dtoc', 'ctor', 'ttor', 'dtor'];
const goldenSets = {};
for (const cat of CATEGORIES) {
  goldenSets[cat] = JSON.parse(fs.readFileSync(path.join(GOLDEN_DIR, cat + '.json'), 'utf8'));
}

describe('classification golden set', () => {
  it('each category has exactly 25 items', () => {
    for (const cat of CATEGORIES) {
      assert.equal(goldenSets[cat].length, 25, cat + ' must have 25 items');
    }
  });

  it('total golden set is 100 items', () => {
    const total = CATEGORIES.reduce((sum, cat) => sum + goldenSets[cat].length, 0);
    assert.equal(total, 100);
  });

  it('every item has valid expected_verdict', () => {
    for (const cat of CATEGORIES) {
      for (const item of goldenSets[cat]) {
        assert.ok(
          ['genuine', 'fp', 'review'].includes(item.expected_verdict),
          cat + ' item has invalid verdict: ' + item.expected_verdict,
        );
      }
    }
  });

  it('every item has non-empty input object', () => {
    for (const cat of CATEGORIES) {
      for (const item of goldenSets[cat]) {
        assert.equal(typeof item.input, 'object');
        assert.ok(Object.keys(item.input).length > 0, cat + ' item has empty input');
      }
    }
  });

  it('itemKey() produces valid keys for all dtoc items', () => {
    for (const item of goldenSets.dtoc) {
      const key = itemKey('dtoc', item.input);
      assert.match(key, /^[0-9a-f]{16}$/);
    }
  });

  it('itemKey() produces valid keys for all ctor items', () => {
    for (const item of goldenSets.ctor) {
      const key = itemKey('ctor', item.input);
      assert.equal(key, item.input.file);
    }
  });

  it('itemKey() produces valid keys for all ttor items', () => {
    for (const item of goldenSets.ttor) {
      const key = itemKey('ttor', item.input);
      assert.equal(key, item.input.file);
    }
  });

  it('itemKey() produces valid keys for all dtor items', () => {
    for (const item of goldenSets.dtor) {
      const key = itemKey('dtor', item.input);
      assert.match(key, /^[0-9a-f]{16}$/);
    }
  });

  it('itemKey() produces unique keys within each category', () => {
    for (const cat of CATEGORIES) {
      const keys = goldenSets[cat].map(item => itemKey(cat, item.input));
      const keySet = new Set(keys);
      assert.equal(keySet.size, goldenSets[cat].length, cat + ' has duplicate keys');
    }
  });

  it('verdict distribution is documented per category', () => {
    for (const cat of CATEGORIES) {
      const counts = { genuine: 0, fp: 0, review: 0 };
      for (const item of goldenSets[cat]) counts[item.expected_verdict]++;
      assert.ok(counts.genuine >= 1, cat + ' needs at least 1 genuine');
      assert.ok(counts.fp >= 1, cat + ' needs at least 1 fp');
      assert.ok(counts.review >= 1, cat + ' needs at least 1 review');
      console.log(cat + ': genuine=' + counts.genuine + ' fp=' + counts.fp + ' review=' + counts.review);
    }
  });

  it('dtoc items have required fields: doc_file, value, reason', () => {
    for (const item of goldenSets.dtoc) {
      assert.ok(item.input.doc_file, 'dtoc item missing doc_file');
      assert.ok(item.input.value, 'dtoc item missing value');
      assert.ok(item.input.reason, 'dtoc item missing reason');
    }
  });

  it('dtor items have required fields: doc_file, claim_text', () => {
    for (const item of goldenSets.dtor) {
      assert.ok(item.input.doc_file, 'dtor item missing doc_file');
      assert.ok(item.input.claim_text, 'dtor item missing claim_text');
    }
  });

  it('ctor and ttor items have required field: file', () => {
    for (const item of goldenSets.ctor) {
      assert.ok(item.input.file, 'ctor item missing file');
    }
    for (const item of goldenSets.ttor) {
      assert.ok(item.input.file, 'ttor item missing file');
    }
  });
});
