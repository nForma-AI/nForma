'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'bin', 'generate-traceability-matrix.cjs');
const MATRIX_PATH = path.join(__dirname, '..', 'formal', 'traceability-matrix.json');
const REQUIREMENTS_PATH = path.join(__dirname, '..', 'formal', 'requirements.json');
const ANNOTATIONS_SCRIPT = path.join(__dirname, '..', 'bin', 'extract-annotations.cjs');

/**
 * Run generate-traceability-matrix.cjs with given args and return { stdout, stderr, status }.
 */
function run(...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
  });
}

/**
 * Run extract-annotations.cjs and return parsed JSON.
 */
function getAnnotations() {
  const result = spawnSync(process.execPath, [ANNOTATIONS_SCRIPT], {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
    timeout: 30000,
  });
  return JSON.parse(result.stdout);
}

/**
 * Get the matrix by running the generator and reading the output file.
 */
function getMatrix() {
  run(); // generate fresh
  delete require.cache[MATRIX_PATH]; // clear Node require cache
  return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
}

// ── Basic Execution ─────────────────────────────────────────────────────────

describe('basic execution', () => {
  test('exits with code 0', () => {
    const result = run();
    assert.strictEqual(result.status, 0, 'Expected exit code 0, got ' + result.status);
  });

  test('produces formal/traceability-matrix.json', () => {
    run();
    assert.ok(fs.existsSync(MATRIX_PATH), 'traceability-matrix.json should exist after generation');
  });

  test('prints summary to stdout', () => {
    const result = run();
    assert.ok(result.stdout.includes('[generate-traceability-matrix]'), 'stdout should contain TAG prefix');
    assert.ok(result.stdout.includes('Generated formal/traceability-matrix.json'), 'stdout should confirm file generation');
    assert.ok(result.stdout.includes('Requirements:'), 'stdout should include requirements count');
    assert.ok(result.stdout.includes('Properties:'), 'stdout should include properties count');
  });
});

// ── JSON Structure ──────────────────────────────────────────────────────────

describe('JSON structure', () => {
  test('has all required top-level keys', () => {
    const matrix = getMatrix();
    assert.ok(matrix.metadata, 'matrix should have metadata');
    assert.ok(matrix.requirements, 'matrix should have requirements');
    assert.ok(matrix.properties, 'matrix should have properties');
    assert.ok(matrix.coverage_summary, 'matrix should have coverage_summary');
  });
});

// ── Metadata ────────────────────────────────────────────────────────────────

describe('metadata', () => {
  test('generated_at is ISO-8601', () => {
    const matrix = getMatrix();
    const ts = new Date(matrix.metadata.generated_at);
    assert.ok(!isNaN(ts.getTime()), 'generated_at should be a valid ISO-8601 date');
  });

  test('generator_version is 1.0', () => {
    const matrix = getMatrix();
    assert.strictEqual(matrix.metadata.generator_version, '1.0');
  });

  test('data_sources has expected sections', () => {
    const matrix = getMatrix();
    const ds = matrix.metadata.data_sources;
    assert.ok(ds.annotations, 'data_sources should have annotations');
    assert.ok(typeof ds.annotations.file_count === 'number', 'annotations.file_count should be a number');
    assert.ok(typeof ds.annotations.property_count === 'number', 'annotations.property_count should be a number');
    assert.ok(ds.model_registry, 'data_sources should have model_registry');
    assert.ok(typeof ds.model_registry.file_count === 'number', 'model_registry.file_count should be a number');
    assert.ok(typeof ds.model_registry.used_as_fallback === 'number', 'model_registry.used_as_fallback should be a number');
    assert.ok(ds.check_results, 'data_sources should have check_results');
    assert.ok(typeof ds.check_results.entry_count === 'number', 'check_results.entry_count should be a number');
  });
});

// ── Annotation-sourced Properties ───────────────────────────────────────────

describe('annotation-sourced properties', () => {
  test('QGSDStopHook TypeOK has source annotation and STOP-01', () => {
    const matrix = getMatrix();
    const key = 'formal/tla/QGSDStopHook.tla::TypeOK';
    const prop = matrix.properties[key];
    assert.ok(prop, key + ' should exist in properties');
    assert.strictEqual(prop.source, 'annotation');
    assert.deepStrictEqual(prop.requirement_ids, ['STOP-01']);
    assert.strictEqual(prop.model_file, 'formal/tla/QGSDStopHook.tla');
    assert.strictEqual(prop.property_name, 'TypeOK');
  });

  test('known multi-requirement property has all IDs', () => {
    const matrix = getMatrix();
    const key = 'formal/tla/QGSDQuorum.tla::UnanimityMet';
    const prop = matrix.properties[key];
    assert.ok(prop, key + ' should exist');
    assert.ok(prop.requirement_ids.includes('QUORUM-02'), 'should include QUORUM-02');
    assert.ok(prop.requirement_ids.includes('SAFE-01'), 'should include SAFE-01');
    assert.strictEqual(prop.source, 'annotation');
  });

  test('multi-requirement property appears in both requirement entries', () => {
    const matrix = getMatrix();
    const q02 = matrix.requirements['QUORUM-02'];
    const s01 = matrix.requirements['SAFE-01'];
    assert.ok(q02, 'QUORUM-02 should exist in requirements index');
    assert.ok(s01, 'SAFE-01 should exist in requirements index');

    const q02HasProp = q02.properties.some(p =>
      p.model_file === 'formal/tla/QGSDQuorum.tla' && p.property_name === 'UnanimityMet'
    );
    const s01HasProp = s01.properties.some(p =>
      p.model_file === 'formal/tla/QGSDQuorum.tla' && p.property_name === 'UnanimityMet'
    );
    assert.ok(q02HasProp, 'QUORUM-02 should list UnanimityMet');
    assert.ok(s01HasProp, 'SAFE-01 should list UnanimityMet');
  });
});

// ── Bidirectional Consistency ───────────────────────────────────────────────

describe('bidirectional consistency', () => {
  test('every requirement property is in the properties index', () => {
    const matrix = getMatrix();
    for (const [reqId, reqEntry] of Object.entries(matrix.requirements)) {
      for (const prop of reqEntry.properties) {
        const key = prop.model_file + '::' + prop.property_name;
        assert.ok(matrix.properties[key],
          'Requirement ' + reqId + ' references ' + key + ' but it is not in the properties index');
      }
    }
  });

  test('every property requirement ID has a requirements entry', () => {
    const matrix = getMatrix();
    for (const [key, prop] of Object.entries(matrix.properties)) {
      for (const reqId of prop.requirement_ids) {
        assert.ok(matrix.requirements[reqId],
          'Property ' + key + ' references ' + reqId + ' but it is not in the requirements index');
      }
    }
  });
});

// ── Coverage Summary ────────────────────────────────────────────────────────

describe('coverage_summary', () => {
  test('total_requirements matches requirements.json count', () => {
    const matrix = getMatrix();
    const rj = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
    assert.strictEqual(matrix.coverage_summary.total_requirements, rj.requirements.length);
  });

  test('covered_count matches unique requirement IDs in requirements index that are also in requirements.json', () => {
    const matrix = getMatrix();
    const rj = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
    const allIds = new Set(rj.requirements.map(r => r.id));
    const matrixReqIds = Object.keys(matrix.requirements);
    const coveredInReqs = matrixReqIds.filter(id => allIds.has(id));
    assert.strictEqual(matrix.coverage_summary.covered_count, coveredInReqs.length);
  });

  test('coverage_percentage calculation is correct', () => {
    const matrix = getMatrix();
    const cs = matrix.coverage_summary;
    const expected = cs.total_requirements > 0
      ? Math.round((cs.covered_count / cs.total_requirements) * 1000) / 10
      : 0;
    assert.strictEqual(cs.coverage_percentage, expected);
  });

  test('uncovered_requirements is alphabetically sorted', () => {
    const matrix = getMatrix();
    const uncovered = matrix.coverage_summary.uncovered_requirements;
    const sorted = [...uncovered].sort();
    assert.deepStrictEqual(uncovered, sorted, 'uncovered_requirements should be sorted');
  });

  test('orphan_properties is an array', () => {
    const matrix = getMatrix();
    assert.ok(Array.isArray(matrix.coverage_summary.orphan_properties), 'orphan_properties should be an array');
  });

  test('no orphan properties in current annotations', () => {
    const matrix = getMatrix();
    assert.strictEqual(matrix.coverage_summary.orphan_properties.length, 0,
      'Should have 0 orphan properties given v0.25-02 annotations');
  });
});

// ── CLI Flags ───────────────────────────────────────────────────────────────

describe('CLI flags', () => {
  test('--json outputs valid JSON to stdout', () => {
    const result = run('--json');
    assert.strictEqual(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.ok(data.metadata, '--json output should have metadata');
    assert.ok(data.requirements, '--json output should have requirements');
    assert.ok(data.properties, '--json output should have properties');
    assert.ok(data.coverage_summary, '--json output should have coverage_summary');
  });

  test('--quiet suppresses stdout output', () => {
    const result = run('--quiet');
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout.trim(), '', '--quiet should produce no stdout');
  });
});

// ── Property Count Matches Annotations ──────────────────────────────────────

describe('property counts', () => {
  test('annotation property count matches extract-annotations output', () => {
    const matrix = getMatrix();
    const annotations = getAnnotations();
    let totalProps = 0;
    for (const props of Object.values(annotations)) {
      totalProps += props.length;
    }
    assert.strictEqual(matrix.metadata.data_sources.annotations.property_count, totalProps,
      'annotations.property_count should match extract-annotations total');
  });

  test('annotation file count matches extract-annotations output', () => {
    const matrix = getMatrix();
    const annotations = getAnnotations();
    assert.strictEqual(matrix.metadata.data_sources.annotations.file_count, Object.keys(annotations).length,
      'annotations.file_count should match extract-annotations file count');
  });
});

// ── Fallback Detection ──────────────────────────────────────────────────────

describe('fallback detection', () => {
  test('model-registry fallback properties use source model-registry', () => {
    const matrix = getMatrix();
    const fallbackProps = Object.values(matrix.properties).filter(p => p.source === 'model-registry');
    // There should be fallback entries for .pm files not in annotations
    if (fallbackProps.length > 0) {
      for (const prop of fallbackProps) {
        assert.strictEqual(prop.source, 'model-registry');
        assert.strictEqual(prop.property_name, '(model-level)');
      }
    }
    // Verify the fallback count matches metadata
    assert.strictEqual(matrix.metadata.data_sources.model_registry.used_as_fallback, fallbackProps.length);
  });
});
