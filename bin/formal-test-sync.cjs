#!/usr/bin/env node
'use strict';
// bin/formal-test-sync.cjs
// Orchestrator: cross-references formal model invariants with unit test coverage.
// Validates formal constants against runtime config, generates test stubs, updates traceability matrix.
//
// Usage:
//   node bin/formal-test-sync.cjs                      # full sync (coverage + constants + stubs + sidecar)
//   node bin/formal-test-sync.cjs --report-only        # read-only (no stub generation, no sidecar write)
//   node bin/formal-test-sync.cjs --dry-run            # show what would be generated (no writes)
//   node bin/formal-test-sync.cjs --json               # JSON output instead of human-readable
//   node bin/formal-test-sync.cjs --stubs-dir=<path>   # override default stubs directory
//
// Requirements: QUICK-139

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = '[formal-test-sync]';
const ROOT = path.resolve(__dirname, '..');

const EXTRACT_ANNOTATIONS_SCRIPT = path.join(__dirname, 'extract-annotations.cjs');
const CONSTANTS_MAPPING_PATH = path.join(ROOT, '.formal', 'constants-mapping.json');
const REQUIREMENTS_PATH = path.join(ROOT, '.formal', 'requirements.json');
const CONFIG_LOADER_PATH = path.join(ROOT, 'hooks', 'config-loader.js');
const REPORT_OUTPUT_PATH = path.join(ROOT, '.formal', 'formal-test-sync-report.json');
const SIDECAR_OUTPUT_PATH = path.join(ROOT, '.formal', 'unit-test-coverage.json');

// ── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const reportOnly = args.includes('--report-only');
const dryRun = args.includes('--dry-run');
const jsonMode = args.includes('--json');
let stubsDir = path.join(ROOT, 'hooks', 'generated-stubs');

for (const arg of args) {
  if (arg.startsWith('--stubs-dir=')) {
    stubsDir = arg.slice('--stubs-dir='.length);
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────────

/**
 * Load formal annotations from extract-annotations.cjs (without test files).
 * Returns { model_file: [{ property, requirement_ids }] } or {} on failure.
 */
function loadFormalAnnotations() {
  try {
    const result = spawnSync(process.execPath, [EXTRACT_ANNOTATIONS_SCRIPT], {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 30000,
    });
    if (result.status !== 0) {
      process.stderr.write(TAG + ' warn: extract-annotations.cjs failed\n');
      return {};
    }
    return JSON.parse(result.stdout);
  } catch (err) {
    process.stderr.write(TAG + ' warn: extract-annotations.cjs error: ' + err.message + '\n');
    return {};
  }
}

/**
 * Load test annotations from extract-annotations.cjs with --include-tests.
 * Filters to only test: prefixed keys and strips the prefix.
 * Returns { "hooks/config-loader.test.js": [{ test_name, requirement_ids }], ... }
 */
function loadTestAnnotations() {
  try {
    const result = spawnSync(process.execPath, [EXTRACT_ANNOTATIONS_SCRIPT, '--include-tests'], {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 30000,
    });
    if (result.status !== 0) {
      process.stderr.write(TAG + ' warn: extract-annotations --include-tests failed\n');
      return {};
    }
    const allAnnotations = JSON.parse(result.stdout);
    const testAnnotations = {};
    for (const [key, value] of Object.entries(allAnnotations)) {
      if (key.startsWith('test:')) {
        testAnnotations[key.slice('test:'.length)] = value;
      }
    }
    return testAnnotations;
  } catch (err) {
    process.stderr.write(TAG + ' warn: extract-annotations --include-tests error: ' + err.message + '\n');
    return {};
  }
}

/**
 * Load requirements from .formal/requirements.json.
 * Returns array of { id, ... } or [] on failure (fail-open).
 */
function loadRequirements() {
  if (!fs.existsSync(REQUIREMENTS_PATH)) {
    process.stderr.write(TAG + ' warn: requirements.json not found\n');
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
    return data.requirements || [];
  } catch (err) {
    process.stderr.write(TAG + ' warn: requirements.json parse error: ' + err.message + '\n');
    return [];
  }
}

/**
 * Load constants mapping from .formal/constants-mapping.json.
 * Returns array of { constant, source, config_path, formal_value, ... } or [] on failure.
 */
function loadConstantsMapping() {
  if (!fs.existsSync(CONSTANTS_MAPPING_PATH)) {
    process.stderr.write(TAG + ' warn: constants-mapping.json not found\n');
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONSTANTS_MAPPING_PATH, 'utf8'));
    return data.mappings || [];
  } catch (err) {
    process.stderr.write(TAG + ' warn: constants-mapping.json parse error: ' + err.message + '\n');
    return [];
  }
}

/**
 * Load DEFAULT_CONFIG from hooks/config-loader.js.
 * Returns the config object or {} on failure.
 */
function loadDefaultConfig() {
  try {
    const { DEFAULT_CONFIG } = require(CONFIG_LOADER_PATH);
    return DEFAULT_CONFIG || {};
  } catch (err) {
    process.stderr.write(TAG + ' warn: could not load DEFAULT_CONFIG: ' + err.message + '\n');
    return {};
  }
}

// ── Constants Parsing ────────────────────────────────────────────────────────

/**
 * Parse TLA+ .cfg file and extract CONSTANTS block values.
 * Pattern: key = value pairs after CONSTANTS keyword until next section keyword.
 */
function parseTLACfgConstants(content) {
  const lines = content.split('\n');
  const result = {};
  let inConstants = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect CONSTANTS section start
    if (/^CONSTANTS\s*$/.test(trimmed)) {
      inConstants = true;
      continue;
    }

    // Detect section keywords that end CONSTANTS block
    if (inConstants && /^(SPECIFICATION|INVARIANT|PROPERTY|SYMMETRY|CHECK_DEADLOCK)\s*/.test(trimmed)) {
      inConstants = false;
      continue;
    }

    if (inConstants && trimmed.length > 0 && !trimmed.startsWith('\\')) {
      // Match key = value pattern
      const match = trimmed.match(/^\s*(\w+)\s*=\s*(.+)$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        // Try to parse as number
        if (/^\d+$/.test(value)) {
          result[key] = parseInt(value, 10);
        } else {
          result[key] = value;
        }
      }
    }
  }

  return result;
}

/**
 * Parse Alloy file and extract Defaults sig field values.
 * Pattern: one sig Defaults { ... } { ... }
 */
function parseAlloyDefaults(content) {
  const result = {};
  // Find Defaults sig constraint block: { defaultX = value, ... }
  const match = content.match(/one\s+sig\s+Defaults\s*\{[^}]*\}\s*\{([^}]*)\}/);
  if (!match) return result;

  const constraintBlock = match[1];
  // Parse field = value pairs (split on newlines, not commas)
  const pairs = constraintBlock.split('\n')
    .filter(line => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith('--') && !t.startsWith('//');
    });
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const kv = trimmed.match(/^\s*(\w+)\s*=\s*(\S+)\s*$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim();
      // Try to parse as number
      if (/^\d+$/.test(val)) {
        result[key] = parseInt(val, 10);
      } else {
        result[key] = val;
      }
    }
  }

  return result;
}

/**
 * Resolve dot-notation path (e.g., "circuit_breaker.oscillation_depth") against a config object.
 */
function resolveConfigPath(dotPath, config) {
  const parts = dotPath.split('.');
  let current = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Validate formal constants against config defaults.
 * Returns array of { constant, source, formal_value, config_value, config_path, match, intentional_divergence }.
 */
function validateConstants(mappings) {
  const config = loadDefaultConfig();
  const results = [];

  for (const mapping of mappings) {
    const { constant, source, config_path, formal_value, transform, intentional_divergence } = mapping;

    // Skip model-only constants
    if (config_path === null) {
      results.push({
        constant,
        source,
        formal_value,
        config_value: null,
        config_path: null,
        match: null, // N/A
        intentional_divergence: false,
        detail: 'model-only, no runtime config',
      });
      continue;
    }

    // Read source file and parse constants
    const sourcePath = path.join(ROOT, source);
    if (!fs.existsSync(sourcePath)) {
      results.push({
        constant,
        source,
        formal_value,
        config_value: null,
        config_path,
        match: false,
        intentional_divergence: intentional_divergence || false,
        detail: 'source file not found',
      });
      continue;
    }

    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    let parsedConstants;
    if (source.endsWith('.cfg')) {
      parsedConstants = parseTLACfgConstants(sourceContent);
    } else if (source.endsWith('.als')) {
      parsedConstants = parseAlloyDefaults(sourceContent);
    } else {
      results.push({
        constant,
        source,
        formal_value,
        config_value: null,
        config_path,
        match: false,
        intentional_divergence: intentional_divergence || false,
        detail: 'unsupported source file type',
      });
      continue;
    }

    // Look up the constant in parsed values
    const parsedValue = parsedConstants[constant];
    if (parsedValue === undefined) {
      results.push({
        constant,
        source,
        formal_value,
        config_value: null,
        config_path,
        match: false,
        intentional_divergence: intentional_divergence || false,
        detail: 'constant not found in source file',
      });
      continue;
    }

    // Resolve config path to get runtime value
    let configValue = resolveConfigPath(config_path, config);

    // Apply transform if specified
    let transformedFormalValue = formal_value;
    if (transform) {
      const [from, to] = transform.split(' -> ').map(s => s.trim());
      if (from === String(formal_value)) {
        transformedFormalValue = JSON.parse(to);
      }
    }

    const match = transformedFormalValue === configValue;

    results.push({
      constant,
      source,
      formal_value,
      config_value: configValue,
      config_path,
      match,
      intentional_divergence: intentional_divergence || false,
    });
  }

  return results;
}

// ── Coverage Analysis ────────────────────────────────────────────────────────

/**
 * Build a coverage report: for each requirement, track formal and test coverage.
 * Returns { covered: [...], uncovered: [...], gaps: [...], stats: { ... } }.
 */
function buildCoverageReport(formalAnnotations, testAnnotations, requirements) {
  // Build requirement maps
  const formalCoverageMap = new Map(); // reqId -> Set of { model_file, property }
  const testCoverageMap = new Map(); // reqId -> Set of { test_file, test_name }

  // Process formal annotations
  for (const [modelFile, props] of Object.entries(formalAnnotations)) {
    for (const { property, requirement_ids } of props) {
      for (const reqId of requirement_ids) {
        if (!formalCoverageMap.has(reqId)) {
          formalCoverageMap.set(reqId, []);
        }
        formalCoverageMap.get(reqId).push({ 'model_file': modelFile, property });
      }
    }
  }

  // Process test annotations
  for (const [testFile, tests] of Object.entries(testAnnotations)) {
    for (const { test_name, requirement_ids } of tests) {
      for (const reqId of requirement_ids) {
        if (!testCoverageMap.has(reqId)) {
          testCoverageMap.set(reqId, []);
        }
        testCoverageMap.get(reqId).push({ 'test_file': testFile, test_name });
      }
    }
  }

  const covered = [];
  const uncovered = [];
  const gaps = []; // formal coverage but no test

  for (const req of requirements) {
    const reqId = req.id;
    const hasFormal = formalCoverageMap.has(reqId);
    const hasTest = testCoverageMap.has(reqId);

    const entry = {
      requirement_id: reqId,
      has_formal: hasFormal,
      has_test: hasTest,
      formal_properties: hasFormal ? formalCoverageMap.get(reqId) : [],
      test_cases: hasTest ? testCoverageMap.get(reqId) : [],
    };

    if (hasFormal && hasTest) {
      covered.push(entry);
    } else if (!hasFormal && !hasTest) {
      uncovered.push(entry);
    } else if (hasFormal && !hasTest) {
      entry.gap = true;
      gaps.push(entry);
    }
  }

  const totalReqs = requirements.length;
  const formalCovered = formalCoverageMap.size;
  const testCovered = testCoverageMap.size;
  const bothCovered = covered.length;
  const gapCount = gaps.length;

  return {
    covered,
    uncovered,
    gaps,
    stats: {
      total: totalReqs,
      formal_covered: formalCovered,
      test_covered: testCovered,
      both_covered: bothCovered,
      gap_count: gapCount,
    },
  };
}

// ── Stub Generation ──────────────────────────────────────────────────────────

/**
 * Generate test stub files for uncovered invariants (gaps).
 * Each stub is a skeleton test file with a TODO comment and assert.fail().
 */
function generateStubs(gaps, formalAnnotations) {
  const stubs = [];

  for (const gap of gaps) {
    const { requirement_id, formal_properties } = gap;
    const property = formal_properties.length > 0 ? formal_properties[0].property : 'unknown';

    const stubFileName = requirement_id + '.stub.test.js';
    const stubFilePath = path.join(stubsDir, stubFileName);

    if (!dryRun) {
      // Create stubs directory if it doesn't exist
      if (!fs.existsSync(stubsDir)) {
        fs.mkdirSync(stubsDir, { recursive: true });
      }

      // Write stub file
      const stubContent = `#!/usr/bin/env node
// @requirement ${requirement_id}
// Auto-generated stub for uncovered invariant: ${property}

const { test } = require('node:test');
const assert = require('node:assert/strict');

test('TODO: implement test for ${requirement_id} — ${property}', () => {
  assert.fail('TODO: implement test for ${requirement_id} — ${property}');
});
`;
      fs.writeFileSync(stubFilePath, stubContent, 'utf8');
    }

    stubs.push({
      requirement_id,
      stub_file: stubFilePath,
      property,
    });
  }

  return stubs;
}

// ── Output Writers ───────────────────────────────────────────────────────────

/**
 * Write formal-test-sync report to .formal/formal-test-sync-report.json.
 */
function writeReport(coverageReport, constantsValidation) {
  const report = {
    generated_at: new Date().toISOString(),
    coverage_gaps: coverageReport,
    constants_validation: constantsValidation,
  };

  fs.writeFileSync(REPORT_OUTPUT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

/**
 * Write unit-test-coverage sidecar to .formal/unit-test-coverage.json.
 * Consumed by traceability matrix generator.
 */
function writeSidecar(coverageReport) {
  const requirements = {};

  // Populate from covered requirements
  for (const req of coverageReport.covered) {
    requirements[req.requirement_id] = {
      covered: true,
      test_cases: req.test_cases,
    };
  }

  // Add gap requirements (formal but no test)
  for (const req of coverageReport.gaps) {
    requirements[req.requirement_id] = {
      covered: false,
      test_cases: req.test_cases,
    };
  }

  // Add uncovered requirements (no formal, no test)
  for (const req of coverageReport.uncovered) {
    requirements[req.requirement_id] = {
      covered: false,
      test_cases: req.test_cases,
    };
  }

  const sidecar = {
    generated_at: new Date().toISOString(),
    requirements,
  };

  fs.writeFileSync(SIDECAR_OUTPUT_PATH, JSON.stringify(sidecar, null, 2) + '\n', 'utf8');
}

/**
 * Print human-readable summary to stdout.
 */
function printSummary(coverageReport, constantsValidation, stubs) {
  const TAG_SUMMARY = '[formal-test-sync]';

  process.stdout.write(TAG_SUMMARY + ' Generated formal-test-sync report\n');
  process.stdout.write(TAG_SUMMARY + '   Coverage gaps: ' + coverageReport.stats.gap_count + ' requirements with formal but no test\n');
  process.stdout.write(TAG_SUMMARY + '   Both covered: ' + coverageReport.stats.both_covered + ' requirements with formal AND test\n');
  process.stdout.write(TAG_SUMMARY + '   Formal covered: ' + coverageReport.stats.formal_covered + ' / ' + coverageReport.stats.total + '\n');
  process.stdout.write(TAG_SUMMARY + '   Test covered: ' + coverageReport.stats.test_covered + ' / ' + coverageReport.stats.total + '\n');

  // Constants validation summary
  const mismatches = constantsValidation.filter(c => !c.match && c.config_path !== null);
  const mismatched = mismatches.filter(c => !c.intentional_divergence);
  const intentional = mismatches.filter(c => c.intentional_divergence);

  process.stdout.write(TAG_SUMMARY + '   Constants mismatches: ' + mismatched.length + ' (unexpected), ' + intentional.length + ' (intentional)\n');

  if (stubs.length > 0) {
    process.stdout.write(TAG_SUMMARY + '   Test stubs generated: ' + stubs.length + ' in ' + stubsDir + '\n');
  }

  if (!reportOnly) {
    process.stdout.write(TAG_SUMMARY + '   Report: ' + REPORT_OUTPUT_PATH + '\n');
    process.stdout.write(TAG_SUMMARY + '   Sidecar: ' + SIDECAR_OUTPUT_PATH + '\n');
  }
}

// ── Main Flow ────────────────────────────────────────────────────────────────

function main() {
  const formalAnnotations = loadFormalAnnotations();
  const testAnnotations = loadTestAnnotations();
  const requirements = loadRequirements();
  const mappings = loadConstantsMapping();

  const coverageReport = buildCoverageReport(formalAnnotations, testAnnotations, requirements);
  const constantsValidation = validateConstants(mappings);

  let stubs = [];
  if (!reportOnly) {
    stubs = generateStubs(coverageReport.gaps, formalAnnotations);
    writeSidecar(coverageReport);
    writeReport(coverageReport, constantsValidation);
  }

  if (jsonMode) {
    const output = {
      coverage_gaps: coverageReport,
      constants_validation: constantsValidation,
      stubs: stubs,
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  } else {
    printSummary(coverageReport, constantsValidation, stubs);
  }
}

// ── Exports (for testing) ────────────────────────────────────────────────────

module.exports = { parseAlloyDefaults };

// ── Entry point ──────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
