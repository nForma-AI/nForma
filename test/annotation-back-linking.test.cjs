// Requirements: CLINK-01, CLINK-02
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

// ── Plan 01: CLINK-02 — Source annotation parsing ──────────────────────────

describe('parseSourceAnnotations (CLINK-02)', () => {
  const { parseSourceAnnotations } = require('../bin/formal-proximity.cjs');

  test('extracts IDs from // @requirement FOO-01 pattern', () => {
    const content = '#!/usr/bin/env node\n// @requirement FOO-01\n// some code\n';
    const ids = parseSourceAnnotations(content);
    assert.ok(ids.has('FOO-01'), 'should extract FOO-01');
    assert.strictEqual(ids.size, 1);
  });

  test('extracts IDs from // Requirements: FOO-01, FOO-02 pattern', () => {
    const content = '#!/usr/bin/env node\n// Requirements: FOO-01, FOO-02\n';
    const ids = parseSourceAnnotations(content);
    assert.ok(ids.has('FOO-01'), 'should extract FOO-01');
    assert.ok(ids.has('FOO-02'), 'should extract FOO-02');
    assert.strictEqual(ids.size, 2);
  });

  test('combines both annotation patterns', () => {
    const content = '// @requirement BAR-01\n// Requirements: BAZ-02\n';
    const ids = parseSourceAnnotations(content);
    assert.ok(ids.has('BAR-01'));
    assert.ok(ids.has('BAZ-02'));
    assert.strictEqual(ids.size, 2);
  });

  test('ignores annotations past line 30', () => {
    const lines = Array(35).fill('// nothing');
    lines[32] = '// @requirement LATE-01';
    const content = lines.join('\n');
    const ids = parseSourceAnnotations(content);
    assert.strictEqual(ids.size, 0, 'should not find annotations past line 30');
  });

  test('returns empty set for file with no annotations', () => {
    const content = '#!/usr/bin/env node\nconst x = 1;\n';
    const ids = parseSourceAnnotations(content);
    assert.strictEqual(ids.size, 0);
  });
});

describe('proximity builder creates declares edges (CLINK-02)', () => {
  const { buildIndex, REVERSE_RELS } = require('../bin/formal-proximity.cjs');

  test('buildIndex produces code_file nodes with declares edges from source annotations', () => {
    const { index } = buildIndex();
    const codeFileNodes = Object.keys(index.nodes).filter(k => k.startsWith('code_file::'));
    const withDeclares = codeFileNodes.filter(k =>
      index.nodes[k].edges.some(e => e.rel === 'declares' && e.source === 'source-annotation')
    );
    assert.ok(withDeclares.length > 0, 'at least one code_file should have declares edges');
  });

  test('REVERSE_RELS produces declared_in reverse for declares edges', () => {
    assert.strictEqual(REVERSE_RELS['declares'], 'declared_in');
    assert.strictEqual(REVERSE_RELS['declared_in'], 'declares');
  });

  test('reverse pass creates declared_in edges on requirement nodes', () => {
    const { index } = buildIndex();
    const reqNodes = Object.keys(index.nodes).filter(k => k.startsWith('requirement::'));
    const withDeclaredIn = reqNodes.filter(k =>
      index.nodes[k].edges.some(e => e.rel === 'declared_in' && e.source === 'source-annotation')
    );
    assert.ok(withDeclaredIn.length > 0, 'at least one requirement should have declared_in edges from source-annotation');
  });
});

// ── Plan 01: CLINK-01 — C->R suppression ───────────────────────────────────

describe('sweepCtoR proximity suppression (CLINK-01)', () => {
  const { SEMANTIC_WEIGHTS } = require('../bin/formal-proximity.cjs');

  test('declares edge weight is >= 0.6 (suppression threshold)', () => {
    assert.ok(SEMANTIC_WEIGHTS['declares'] >= 0.6,
      `declares weight ${SEMANTIC_WEIGHTS['declares']} should be >= 0.6`);
  });

  test('describes edge weight is < 0.6 (not suppressed)', () => {
    assert.ok(SEMANTIC_WEIGHTS['describes'] < 0.6,
      `describes weight ${SEMANTIC_WEIGHTS['describes']} should be < 0.6`);
  });

  test('SUPPRESS_THRESHOLD concept: edges with weight >= 0.6 suppress, others do not', () => {
    const SUPPRESS_THRESHOLD = 0.6;
    const suppressed = Object.entries(SEMANTIC_WEIGHTS)
      .filter(([, w]) => w >= SUPPRESS_THRESHOLD)
      .map(([rel]) => rel);
    const notSuppressed = Object.entries(SEMANTIC_WEIGHTS)
      .filter(([, w]) => w < SUPPRESS_THRESHOLD)
      .map(([rel]) => rel);

    assert.ok(suppressed.includes('declares'), 'declares should be suppressed');
    assert.ok(suppressed.includes('verifies'), 'verifies should be suppressed');
    assert.ok(notSuppressed.includes('describes'), 'describes should not be suppressed');
    assert.ok(notSuppressed.includes('scores'), 'scores should not be suppressed');
  });
});
