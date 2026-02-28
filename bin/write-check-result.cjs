'use strict';

const fs   = require('fs');
const path = require('path');

const VALID_RESULTS    = ['pass', 'fail', 'warn', 'inconclusive'];
const VALID_FORMALISMS = ['tla', 'alloy', 'prism', 'trace', 'redaction'];

/**
 * Path to the NDJSON output file.
 * Use CHECK_RESULTS_PATH env var to redirect in tests (avoids polluting real output).
 */
const NDJSON_PATH = process.env.CHECK_RESULTS_PATH ||
  path.join(__dirname, '..', 'formal', 'check-results.ndjson');

/**
 * Append one normalized check result line to formal/check-results.ndjson.
 *
 * @param {Object} entry
 * @param {string} entry.tool       - Name of the tool/runner (e.g. 'run-tlc')
 * @param {string} entry.formalism  - One of VALID_FORMALISMS
 * @param {string} entry.result     - One of VALID_RESULTS
 * @param {string} entry.check_id   - Unique step identifier (e.g. 'tla:quorum-safety'), required
 * @param {string} entry.surface    - STEPS tool group (e.g. 'tla', 'alloy', 'prism', 'ci'), required
 * @param {string} entry.property   - Human-readable check description, required
 * @param {number} entry.runtime_ms - Wall-clock elapsed milliseconds from tool start to this call, required. Stored as Math.round(runtime_ms) integer.
 * @param {string} entry.summary    - One-line outcome (e.g. 'pass: MCsafety in 1823ms'), required
 * @param {string[]} [entry.triage_tags] - Optional anomaly tags. Defaults to [].
 * @param {object} [entry.observation_window] - Optional stochastic check window metadata (PRISM-critical). Contains { window_start, window_end, n_traces, n_events, window_days }.
 * @param {Object} [entry.metadata] - Optional extra fields (spec, config, etc.)
 * @throws {Error} On validation failure
 */
function writeCheckResult(entry) {
  if (!entry || typeof entry.tool !== 'string' || entry.tool.length === 0) {
    throw new Error('[write-check-result] tool is required and must be a non-empty string');
  }
  if (!VALID_FORMALISMS.includes(entry.formalism)) {
    throw new Error(
      '[write-check-result] formalism must be one of: ' + VALID_FORMALISMS.join(', ') +
      ' (got: ' + entry.formalism + ')'
    );
  }
  if (!VALID_RESULTS.includes(entry.result)) {
    throw new Error(
      '[write-check-result] result must be one of: ' + VALID_RESULTS.join(', ') +
      ' (got: ' + entry.result + ')'
    );
  }

  // v2.1 required field validations
  if (typeof entry.check_id !== 'string' || entry.check_id.length === 0) {
    throw new Error('[write-check-result] check_id is required and must be a non-empty string');
  }
  if (typeof entry.surface !== 'string' || entry.surface.length === 0) {
    throw new Error('[write-check-result] surface is required and must be a non-empty string');
  }
  if (typeof entry.property !== 'string' || entry.property.length === 0) {
    throw new Error('[write-check-result] property is required and must be a non-empty string');
  }
  if (typeof entry.runtime_ms !== 'number') {
    throw new Error('[write-check-result] runtime_ms is required and must be a number');
  }
  if (typeof entry.summary !== 'string' || entry.summary.length === 0) {
    throw new Error('[write-check-result] summary is required and must be a non-empty string');
  }

  const record = {
    tool:       entry.tool,
    formalism:  entry.formalism,
    result:     entry.result,
    timestamp:  new Date().toISOString(),
    check_id:   entry.check_id,
    surface:    entry.surface,
    property:   entry.property,
    runtime_ms: Math.round(entry.runtime_ms),
    summary:    entry.summary,
    triage_tags: entry.triage_tags || [],
    metadata:   entry.metadata || {},
  };

  if (entry.observation_window !== undefined) {
    record.observation_window = entry.observation_window;
  }

  fs.appendFileSync(NDJSON_PATH, JSON.stringify(record) + '\n', 'utf8');
}

module.exports = { writeCheckResult, NDJSON_PATH, VALID_RESULTS, VALID_FORMALISMS };
