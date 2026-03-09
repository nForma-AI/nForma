'use strict';

/**
 * Maps requirement categories to 8 high-level principles.
 *
 * Resolution order (getCategoryPrinciple):
 *   1. rawCategory is itself a consolidated group key in GROUP_TO_PRINCIPLES
 *   2. rawCategory maps via category-groups.json to a group, then group -> principle
 *   3. rawCategory is in UNMAPPED_FALLBACKS
 *   4. Fallback: "Planning Discipline"
 */

const path = require('path');
const fs   = require('fs');

// ─── 8 Principles ────────────────────────────────────────────────────────────

const PRINCIPLES = [
  'Protocol Integrity',
  'Quorum Governance',
  'Formal Rigor',
  'Operational Visibility',
  'Agent Ecosystem',
  'Configuration Safety',
  'Installation Reliability',
  'Planning Discipline',
];

// ─── Consolidated group -> Principle ─────────────────────────────────────────

const GROUP_TO_PRINCIPLES = {
  'Hooks & Enforcement':       'Protocol Integrity',
  'Quorum & Dispatch':         'Quorum Governance',
  'Formal Verification':       'Formal Rigor',
  'Observability & Diagnostics': 'Operational Visibility',
  'MCP & Agents':              'Agent Ecosystem',
  'Configuration':             'Configuration Safety',
  'Installer & CLI':           'Installation Reliability',
  'Planning & Tracking':       'Planning Discipline',
  'Testing & Quality':         'Formal Rigor',
};

// ─── Unmapped raw categories -> Principle ────────────────────────────────────

const UNMAPPED_FALLBACKS = {
  'Agent Behavior':                'Agent Ecosystem',
  'CI/CD':                         'Installation Reliability',
  'Credentials & Account Management': 'Configuration Safety',
  'Observability & Triage':        'Operational Visibility',
  'Documentation':                 'Planning Discipline',
  'Code Quality Guardrails':       'Formal Rigor',
  'Installation & Toolchain':      'Installation Reliability',
  'TUI Navigation':                'Operational Visibility',
  'Architecture Constraints':      'Protocol Integrity',
  'Project Identity':              'Installation Reliability',
  'Reliability':                   'Protocol Integrity',
  'Security':                      'Configuration Safety',
  'Traceability & Verification':   'Formal Rigor',
  'solve':                         'Formal Rigor',
  'Solver Orchestration':          'Formal Rigor',
  'Solver-Discovered':             'Formal Rigor',
  'Conformance & Traces':          'Formal Rigor',
  'UX Heuristics':                 'Operational Visibility',
  'Project Initialization':        'Installation Reliability',
};

// ─── Load category-groups.json (raw category -> consolidated group) ─────────

let _categoryGroups = null;

function loadCategoryGroups() {
  if (_categoryGroups) return _categoryGroups;
  const p = path.join(process.cwd(), '.planning', 'formal', 'category-groups.json');
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Filter out _comment key
    _categoryGroups = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === '_comment') continue;
      _categoryGroups[k] = v;
    }
    return _categoryGroups;
  } catch (_) {
    _categoryGroups = {};
    return _categoryGroups;
  }
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Resolve a raw category string to one of the 8 principles.
 * @param {string} rawCategory
 * @returns {string} principle name
 */
function getCategoryPrinciple(rawCategory) {
  if (!rawCategory) return 'Planning Discipline';

  // (a) rawCategory is itself a consolidated group key
  if (GROUP_TO_PRINCIPLES[rawCategory]) {
    return GROUP_TO_PRINCIPLES[rawCategory];
  }

  // (b) Look up in category-groups.json -> group -> principle
  const groups = loadCategoryGroups();
  const group = groups[rawCategory];
  if (group && GROUP_TO_PRINCIPLES[group]) {
    return GROUP_TO_PRINCIPLES[group];
  }

  // (c) Unmapped fallbacks
  if (UNMAPPED_FALLBACKS[rawCategory]) {
    return UNMAPPED_FALLBACKS[rawCategory];
  }

  // (d) Catch-all
  return 'Planning Discipline';
}

module.exports = {
  PRINCIPLES,
  GROUP_TO_PRINCIPLES,
  UNMAPPED_FALLBACKS,
  getCategoryPrinciple,
};
