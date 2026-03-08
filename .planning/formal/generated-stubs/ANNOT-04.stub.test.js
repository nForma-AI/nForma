#!/usr/bin/env node
// @requirement ANNOT-04
// Behavioral test: extract-annotations.cjs parses @requirement comments and returns structured JSON

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const mod = require(path.resolve(__dirname, '..', '..', '..', 'bin', 'extract-annotations.cjs'));

test('ANNOT-04 — parseTLA extracts @requirement annotations from TLA+ content', () => {
  const tlaContent = [
    '\\* @requirement REQ-01',
    'TypeOK ==',
    '    /\\ x \\in Nat',
    '',
    '\\* @requirement REQ-02',
    'Safety ==',
    '    /\\ x > 0',
  ].join('\n');

  const result = mod.parseTLA(tlaContent);
  assert.ok(Array.isArray(result), 'parseTLA must return an array');
  assert.equal(result.length, 2, 'Should find 2 annotated properties');
  assert.equal(result[0].property, 'TypeOK');
  assert.deepStrictEqual(result[0].requirement_ids, ['REQ-01']);
  assert.equal(result[1].property, 'Safety');
  assert.deepStrictEqual(result[1].requirement_ids, ['REQ-02']);
});

test('ANNOT-04 — parseAlloy extracts @requirement annotations from Alloy content', () => {
  const alloyContent = [
    '-- @requirement COMP-01',
    'assert NoOrphan {',
    '  all c: Component | some c.parent',
    '}',
  ].join('\n');

  const result = mod.parseAlloy(alloyContent);
  assert.ok(Array.isArray(result), 'parseAlloy must return an array');
  assert.equal(result.length, 1);
  assert.equal(result[0].property, 'NoOrphan');
  assert.deepStrictEqual(result[0].requirement_ids, ['COMP-01']);
});

test('ANNOT-04 — parsePRISM extracts @requirement annotations from PRISM .props content', () => {
  const prismContent = [
    '// @requirement AVAIL-01',
    'P=? [ F "done" ]',
    '',
    '// @requirement PERF-01',
    'R{"time"}=? [ F "complete" ]',
  ].join('\n');

  const result = mod.parsePRISM(prismContent);
  assert.ok(Array.isArray(result), 'parsePRISM must return an array');
  assert.equal(result.length, 2);
  assert.deepStrictEqual(result[0].requirement_ids, ['AVAIL-01']);
  assert.deepStrictEqual(result[1].requirement_ids, ['PERF-01']);
});

test('ANNOT-04 — extractAnnotations returns structured map { model_file: [{ property, requirement_ids }] }', () => {
  const result = mod.extractAnnotations();
  assert.equal(typeof result, 'object', 'extractAnnotations must return an object');

  // Verify at least one model file key exists
  const keys = Object.keys(result);
  assert.ok(keys.length > 0, 'extractAnnotations should find at least one model file with annotations');

  // Verify structure of entries
  for (const [file, annotations] of Object.entries(result)) {
    assert.ok(typeof file === 'string', 'Key must be a file path string');
    assert.ok(Array.isArray(annotations), `Value for ${file} must be an array`);
    for (const ann of annotations) {
      assert.ok('property' in ann, `Annotation in ${file} must have property field`);
      assert.ok('requirement_ids' in ann, `Annotation in ${file} must have requirement_ids field`);
      assert.ok(Array.isArray(ann.requirement_ids), `requirement_ids in ${file} must be an array`);
    }
  }
});
