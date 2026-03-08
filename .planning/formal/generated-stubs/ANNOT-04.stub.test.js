#!/usr/bin/env node
// @requirement ANNOT-04
// Verifies extract-annotations.cjs parses @requirement comments and returns structured JSON

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseTLA, parseAlloy, parsePRISM, extractAnnotations } = require('../../../bin/extract-annotations.cjs');

test('ANNOT-04: parseTLA extracts @requirement annotations from TLA+ content', () => {
  const content = [
    '\\* @requirement REQ-01',
    'TypeOK ==',
    '    /\\ x \\in Nat',
    '',
    '\\* @requirement REQ-02',
    'Safety ==',
    '    x > 0',
  ].join('\n');

  const result = parseTLA(content);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].property, 'TypeOK');
  assert.deepStrictEqual(result[0].requirement_ids, ['REQ-01']);
  assert.strictEqual(result[1].property, 'Safety');
  assert.deepStrictEqual(result[1].requirement_ids, ['REQ-02']);
});

test('ANNOT-04: parseAlloy extracts @requirement annotations from Alloy content', () => {
  const content = [
    '-- @requirement ALLOY-01',
    'assert NoOrphan {',
    '    all x: Node | some x.parent',
    '}',
  ].join('\n');

  const result = parseAlloy(content);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].property, 'NoOrphan');
  assert.deepStrictEqual(result[0].requirement_ids, ['ALLOY-01']);
});

test('ANNOT-04: parsePRISM extracts @requirement annotations from PRISM .props content', () => {
  const content = [
    '// @requirement PRISM-01',
    'P=? [ F "done" ]',
    '',
    '// @requirement PRISM-02',
    'R{"time"}=? [ F "done" ]',
  ].join('\n');

  const result = parsePRISM(content);
  assert.strictEqual(result.length, 2);
  assert.deepStrictEqual(result[0].requirement_ids, ['PRISM-01']);
  assert.deepStrictEqual(result[1].requirement_ids, ['PRISM-02']);
});

test('ANNOT-04: extractAnnotations returns structured map { model_file: [{ property, requirement_ids }] }', () => {
  const result = extractAnnotations();
  assert.ok(typeof result === 'object' && result !== null, 'result must be an object');

  // Must have at least one model file key
  const keys = Object.keys(result);
  assert.ok(keys.length > 0, 'extractAnnotations must return at least one model file');

  // Each value must be an array of { property, requirement_ids }
  for (const [file, annotations] of Object.entries(result)) {
    assert.ok(Array.isArray(annotations), `${file}: annotations must be an array`);
    for (const ann of annotations) {
      assert.ok(typeof ann.property === 'string', `${file}: property must be a string`);
      assert.ok(Array.isArray(ann.requirement_ids), `${file}: requirement_ids must be an array`);
      assert.ok(ann.requirement_ids.length > 0, `${file}: requirement_ids must not be empty`);
    }
  }
});
