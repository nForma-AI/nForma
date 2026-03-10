'use strict';
// bin/requirement-map.cjs
// Centralized mapping from check_id (used by run-formal-verify.cjs steps) to requirement IDs.
// Single source of truth for SCHEMA-03: runners import this to populate requirement_ids in NDJSON output.
//
// Maintenance: when adding a new formal check or requirement, update this map.
// The check_id values match those in run-formal-verify.cjs STEPS array and individual runner CHECK_ID_MAP objects.

const CHECK_ID_TO_REQUIREMENTS = {
  // ── TLA+ checks ──────────────────────────────────────
  'tla:quorum-safety':       ['QUORUM-01', 'QUORUM-02', 'QUORUM-03', 'SAFE-01', 'SAFE-02', 'SAFE-03', 'LOOP-01'],
  'tla:quorum-liveness':     ['QUORUM-04', 'RECV-01'],
  'tla:mcp-environment':     ['MCPENV-01', 'MCPENV-02', 'MCPENV-03'],
  'tla:breaker':             ['DETECT-01', 'DETECT-02', 'DETECT-03'],
  'tla:oscillation':         ['DETECT-04', 'DETECT-05', 'DETECT-06'],
  'tla:convergence':         ['ORES-01', 'ORES-02', 'ORES-03', 'ORES-04', 'ORES-05'],
  'tla:solve-convergence':   ['FV-01', 'FV-02', 'FV-03'],
  'tla:deliberation':        ['PLAN-01', 'PLAN-02', 'SAFE-03', 'IMPR-01', 'LOOP-02'],
  'tla:prefilter':           ['PLAN-03', 'PLAN-04', 'PLAN-05', 'PLAN-06', 'LOOP-03'],
  'tla:account-manager':     ['CRED-01', 'CRED-02', 'CRED-03', 'CRED-04', 'CRED-05', 'CRED-06'],
  'tla:stop-hook':           ['STOP-01', 'STOP-02', 'STOP-03', 'STOP-04', 'STOP-05', 'STOP-06', 'STOP-07', 'SPEC-01'],
  'tla:recruiting-safety':   ['SLOT-02', 'SLOT-03', 'SLOT-04'],
  'tla:recruiting-liveness': ['SLOT-05'],
  'tla:tui-navigation':      [],

  // ── Alloy checks ─────────────────────────────────────
  // check_id values match those emitted by individual runner scripts:
  'alloy:quorum-votes':      ['QUORUM-02', 'SAFE-01', 'SAFE-04'],
  'alloy:quorum-composition': ['SPEC-03', 'COMP-01'],
  'alloy:scoreboard':        ['SCBD-01', 'SCBD-02', 'SCBD-03', 'SCBD-04'],
  'alloy:availability':      ['CALIB-01', 'CALIB-02', 'CALIB-03'],
  'alloy:transcript':        ['STOP-08', 'STOP-09', 'STOP-10', 'STOP-11'],
  'alloy:install-scope':     ['INST-01', 'INST-02', 'INST-03', 'INST-04', 'INST-05'],
  'alloy:taxonomy-safety':   ['SCBD-05', 'SCBD-06', 'SCBD-07'],
  'alloy:account-pool':      ['CRED-07', 'CRED-08', 'CRED-09', 'CRED-10', 'CRED-11'],

  // ── PRISM checks ─────────────────────────────────────
  'prism:quorum':           ['PRM-01', 'QUORUM-04', 'LOOP-01'],
  'prism:oauth-rotation':   ['PRM-AM-01', 'CRED-12'],
  'prism:mcp-availability': ['MCPENV-04', 'FAIL-01'],

  // ── UPPAAL checks ────────────────────────────────────
  'uppaal:quorum-races':    ['UPPAAL-01', 'UPPAAL-02', 'UPPAAL-03'],

  // ── CI enforcement checks ────────────────────────────
  'ci:trace-redaction':         ['REDACT-01'],
  'ci:trace-schema-drift':      ['DRIFT-01'],
  'ci:liveness-fairness-lint':  ['LIVE-01', 'LIVE-02'],
};

/**
 * Get requirement IDs for a given check_id.
 * Returns empty array for unknown check_ids (fail-open).
 *
 * @param {string} checkId - The check_id (e.g., 'tla:quorum-safety')
 * @returns {string[]} Array of requirement IDs
 */
function getRequirementIds(checkId) {
  // Return a copy to prevent callers from mutating the shared source-of-truth array.
  const found = CHECK_ID_TO_REQUIREMENTS[checkId];
  return found ? found.slice() : [];
}

module.exports = { CHECK_ID_TO_REQUIREMENTS, getRequirementIds };
