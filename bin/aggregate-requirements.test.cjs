#!/usr/bin/env node
// bin/aggregate-requirements.test.cjs
// TDD test suite for ENV-01: requirements aggregation

'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  parseRequirements,
  parseTraceability,
  validateEnvelope,
  aggregateRequirements
} = require('./aggregate-requirements.cjs');

// Helper: create temp directory for test files
function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-test-'));
}

// Helper: clean up temp directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Test 1: parseRequirements extracts REQ-ID, text, and category from markdown bullets
test('parseRequirements extracts REQ-ID, text, and category from markdown bullets', function() {
  const markdown = `# Requirements: QGSD v0.22

### Requirements Envelope — ENV

- [ ] **ENV-01**: First requirement text here
- [ ] **ENV-02**: Second requirement text here
`;

  const result = parseRequirements(markdown);

  assert.strictEqual(result.length, 2, 'Should extract 2 requirements');
  assert.strictEqual(result[0].id, 'ENV-01', 'First requirement ID should be ENV-01');
  assert.strictEqual(result[0].text, 'First requirement text here', 'First requirement text should match');
  assert.strictEqual(result[0].category, 'Requirements Envelope', 'Category should be extracted from header');
  assert.strictEqual(result[1].id, 'ENV-02', 'Second requirement ID should be ENV-02');
});

// Test 2: parseRequirements handles backticks and formatting in requirement text
test('parseRequirements handles backticks and formatting in requirement text', function() {
  const markdown = `### Requirements Envelope — ENV

- [ ] **ENV-01**: Requirements are aggregated into \`formal/requirements.json\` with \`claude-haiku-4-5\` validation
`;

  const result = parseRequirements(markdown);

  assert.strictEqual(result.length, 1, 'Should extract 1 requirement');
  assert.ok(result[0].text.includes('formal/requirements.json'), 'Should preserve backticks in text');
  assert.ok(result[0].text.includes('claude-haiku-4-5'), 'Should preserve formatting in text');
});

// Test 3: parseRequirements sorts results by id
test('parseRequirements sorts results by id', function() {
  const markdown = `### Requirements Envelope — ENV

- [ ] **ENV-03**: Third requirement
- [ ] **ENV-01**: First requirement
- [ ] **ENV-02**: Second requirement
`;

  const result = parseRequirements(markdown);

  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].id, 'ENV-01', 'Should be sorted: ENV-01 first');
  assert.strictEqual(result[1].id, 'ENV-02', 'Should be sorted: ENV-02 second');
  assert.strictEqual(result[2].id, 'ENV-03', 'Should be sorted: ENV-03 third');
});

// Test 4: parseRequirements detects completed requirements
test('parseRequirements detects completed requirements', function() {
  const markdown = `### Requirements Envelope — ENV

- [x] **ENV-01**: Completed requirement
- [ ] **ENV-02**: Pending requirement
`;

  const result = parseRequirements(markdown);

  assert.strictEqual(result[0].completed, true, 'ENV-01 should be marked completed');
  assert.strictEqual(result[1].completed, false, 'ENV-02 should be marked pending');
});

// Test 5: parseTraceability extracts phase assignments from table
test('parseTraceability extracts phase assignments from table', function() {
  const markdown = `
| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | v0.22-01 | Pending |
| ENV-02 | v0.22-01 | Complete |
| ENV-03 | v0.22-02 | Pending |
`;

  const result = parseTraceability(markdown);

  assert.strictEqual(result['ENV-01'].phase, 'v0.22-01', 'ENV-01 should be in v0.22-01');
  assert.strictEqual(result['ENV-01'].status, 'Pending', 'ENV-01 status should be Pending');
  assert.strictEqual(result['ENV-02'].status, 'Complete', 'ENV-02 status should be Complete');
  assert.strictEqual(result['ENV-03'].phase, 'v0.22-02', 'ENV-03 should be in v0.22-02');
});

// Test 6: validateEnvelope rejects missing required fields
test('validateEnvelope rejects missing required fields', function() {
  const result = validateEnvelope({});

  assert.strictEqual(result.valid, false, 'Should be invalid');
  assert.ok(result.errors.length > 0, 'Should have errors');
  assert.ok(
    result.errors.some(e => e.includes('schema_version')),
    'Should mention missing schema_version'
  );
});

// Test 7: validateEnvelope accepts valid envelope
test('validateEnvelope accepts valid envelope', function() {
  const envelope = {
    schema_version: '1',
    source: '.planning/REQUIREMENTS.md',
    aggregated_at: '2026-03-01T20:32:24.000Z',
    frozen_at: null,
    content_hash: 'sha256:' + 'a'.repeat(64),
    requirements: [
      {
        id: 'ENV-01',
        text: 'Test requirement',
        category: 'Test',
        phase: 'v0.22-01',
        status: 'Pending',
        provenance: {
          source_file: '.planning/REQUIREMENTS.md',
          milestone: 'v0.22'
        }
      }
    ]
  };

  const result = validateEnvelope(envelope);

  assert.strictEqual(result.valid, true, 'Should be valid');
  assert.strictEqual(result.errors.length, 0, 'Should have no errors');
});

// Test 8: validateEnvelope rejects invalid REQ-ID format
test('validateEnvelope rejects invalid REQ-ID format', function() {
  const envelope = {
    schema_version: '1',
    source: '.planning/REQUIREMENTS.md',
    aggregated_at: '2026-03-01T20:32:24.000Z',
    frozen_at: null,
    content_hash: 'sha256:' + 'a'.repeat(64),
    requirements: [
      {
        id: 'invalid',
        text: 'Test',
        category: 'Test',
        phase: 'v0.22-01',
        status: 'Pending',
        provenance: {
          source_file: '.planning/REQUIREMENTS.md',
          milestone: 'v0.22'
        }
      }
    ]
  };

  const result = validateEnvelope(envelope);

  assert.strictEqual(result.valid, false, 'Should be invalid');
  assert.ok(
    result.errors.some(e => e.includes('id')),
    'Should mention invalid id format'
  );
});

// Test 9: aggregateRequirements produces valid JSON from temp REQUIREMENTS.md
test('aggregateRequirements produces valid JSON from temp REQUIREMENTS.md', function() {
  const tempDir = createTempDir();

  try {
    const tempReqPath = path.join(tempDir, 'REQUIREMENTS.md');
    const tempOutputPath = path.join(tempDir, 'requirements.json');

    const tempMarkdown = `# Requirements: QGSD v0.22

### Requirements Envelope — ENV

- [ ] **ENV-01**: First test requirement
- [ ] **ENV-02**: Second test requirement
- [ ] **ENV-03**: Third test requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | v0.22-01 | Pending |
| ENV-02 | v0.22-01 | Pending |
| ENV-03 | v0.22-02 | Pending |
`;

    fs.writeFileSync(tempReqPath, tempMarkdown, 'utf8');

    const result = aggregateRequirements({
      requirementsPath: tempReqPath,
      outputPath: tempOutputPath,
      deterministic: true
    });

    assert.strictEqual(result.requirementCount, 3, 'Should have 3 requirements');
    assert.ok(fs.existsSync(tempOutputPath), 'Output file should exist');

    const envelope = JSON.parse(fs.readFileSync(tempOutputPath, 'utf8'));
    assert.strictEqual(envelope.requirements.length, 3, 'Envelope should have 3 requirements');
    assert.strictEqual(envelope.schema_version, '1', 'Schema version should be 1');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 10: aggregateRequirements is deterministic -- same input produces identical output
test('aggregateRequirements is deterministic -- same input produces identical output', function() {
  const tempDir = createTempDir();

  try {
    const tempReqPath = path.join(tempDir, 'REQUIREMENTS.md');
    const tempOutputPath1 = path.join(tempDir, 'requirements1.json');
    const tempOutputPath2 = path.join(tempDir, 'requirements2.json');

    const tempMarkdown = `# Requirements: QGSD v0.22

### Requirements Envelope — ENV

- [ ] **ENV-01**: First test requirement
- [ ] **ENV-02**: Second test requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | v0.22-01 | Pending |
| ENV-02 | v0.22-01 | Pending |
`;

    fs.writeFileSync(tempReqPath, tempMarkdown, 'utf8');

    // Run aggregation twice with deterministic flag
    aggregateRequirements({
      requirementsPath: tempReqPath,
      outputPath: tempOutputPath1,
      deterministic: true
    });

    aggregateRequirements({
      requirementsPath: tempReqPath,
      outputPath: tempOutputPath2,
      deterministic: true
    });

    const file1 = fs.readFileSync(tempOutputPath1, 'utf8');
    const file2 = fs.readFileSync(tempOutputPath2, 'utf8');

    assert.strictEqual(file1, file2, 'Outputs should be byte-identical');
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 11: aggregateRequirements refuses to overwrite frozen envelope
test('aggregateRequirements refuses to overwrite frozen envelope', function() {
  const tempDir = createTempDir();

  try {
    const tempReqPath = path.join(tempDir, 'REQUIREMENTS.md');
    const tempOutputPath = path.join(tempDir, 'requirements.json');

    const tempMarkdown = `# Requirements: QGSD v0.22

### Requirements Envelope — ENV

- [ ] **ENV-01**: Test requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | v0.22-01 | Pending |
`;

    fs.writeFileSync(tempReqPath, tempMarkdown, 'utf8');

    // Create a frozen envelope
    const frozenEnvelope = {
      schema_version: '1',
      source: tempReqPath,
      aggregated_at: '2026-03-01T20:32:24.000Z',
      frozen_at: '2026-03-01T21:32:24.000Z',
      content_hash: 'sha256:' + 'a'.repeat(64),
      requirements: []
    };

    fs.writeFileSync(tempOutputPath, JSON.stringify(frozenEnvelope), 'utf8');

    // Try to aggregate over it
    assert.throws(
      function() {
        aggregateRequirements({
          requirementsPath: tempReqPath,
          outputPath: tempOutputPath,
          deterministic: true
        });
      },
      /frozen/i,
      'Should throw error mentioning "frozen"'
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});

// Test 12: content_hash is consistent across runs
test('content_hash is consistent across runs', function() {
  const tempDir = createTempDir();

  try {
    const tempReqPath = path.join(tempDir, 'REQUIREMENTS.md');
    const tempOutputPath1 = path.join(tempDir, 'requirements1.json');
    const tempOutputPath2 = path.join(tempDir, 'requirements2.json');

    const tempMarkdown = `# Requirements: QGSD v0.22

### Requirements Envelope — ENV

- [ ] **ENV-01**: First test requirement
- [ ] **ENV-02**: Second test requirement

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | v0.22-01 | Pending |
| ENV-02 | v0.22-01 | Pending |
`;

    fs.writeFileSync(tempReqPath, tempMarkdown, 'utf8');

    aggregateRequirements({
      requirementsPath: tempReqPath,
      outputPath: tempOutputPath1,
      deterministic: true
    });

    aggregateRequirements({
      requirementsPath: tempReqPath,
      outputPath: tempOutputPath2,
      deterministic: true
    });

    const envelope1 = JSON.parse(fs.readFileSync(tempOutputPath1, 'utf8'));
    const envelope2 = JSON.parse(fs.readFileSync(tempOutputPath2, 'utf8'));

    assert.strictEqual(
      envelope1.content_hash,
      envelope2.content_hash,
      'Content hash should be identical across runs'
    );
  } finally {
    cleanupTempDir(tempDir);
  }
});
