'use strict';

/**
 * Pure data functions for formal verification browsing.
 * No blessed dependency — all functions are testable in isolation.
 * Consumers: bin/nForma.cjs (blessed TUI)
 *
 * Data sources (project-relative paths via basePath):
 *   .planning/formal/model-registry.json     — formal model inventory
 *   .planning/formal/traceability-matrix.json — requirement-property links
 *   .planning/formal/unit-test-coverage.json  — test coverage sidecar
 *   .planning/formal/state-space-report.json  — variable domains & risk
 *   .planning/formal/check-results.ndjson     — verification results
 *   .planning/formal/requirements.json        — requirement definitions
 *   .planning/formal/tla/*.tla                — TLA+ source files
 *   .planning/formal/alloy/*.als              — Alloy source files
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Data loaders (fail-open: return empty on missing/corrupt files)
// ---------------------------------------------------------------------------

function loadJSON(basePath, relPath) {
  const p = path.join(basePath || process.cwd(), relPath);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function loadModelRegistry(basePath) {
  return loadJSON(basePath, '.planning/formal/model-registry.json') || { models: {} };
}

function loadTraceabilityMatrix(basePath) {
  return loadJSON(basePath, '.planning/formal/traceability-matrix.json') || { requirements: {}, properties: {} };
}

function loadUnitTestCoverage(basePath) {
  return loadJSON(basePath, '.planning/formal/unit-test-coverage.json') || { requirements: {} };
}

function loadStateSpaceReport(basePath) {
  return loadJSON(basePath, '.planning/formal/state-space-report.json') || { models: {} };
}

function loadRequirements(basePath) {
  return loadJSON(basePath, '.planning/formal/requirements.json') || { requirements: [] };
}

// ---------------------------------------------------------------------------
// TLA+ / Alloy source parsers (lightweight — extract variables & properties)
// ---------------------------------------------------------------------------

function parseTLAVariables(content) {
  const vars = [];
  const lines = content.split('\n');
  let inVarBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^VARIABLES?\b/.test(line.trim())) {
      inVarBlock = true;
      // Variables may be on same line: VARIABLES a, b, c
      const inline = line.replace(/^VARIABLES?\s*/, '').trim();
      if (inline) {
        for (const v of inline.split(',')) {
          const name = v.trim().replace(/\\.*$/, '').trim();
          if (name) vars.push({ name, comment: extractInlineComment(line) });
        }
      }
      continue;
    }
    if (inVarBlock) {
      if (line.trim() === '' || /^[A-Z]/.test(line.trim()) && !/^\s/.test(line)) {
        // End of variable block (blank line or new definition)
        if (!/^\s/.test(line) && line.trim() !== '') inVarBlock = false;
        continue;
      }
      for (const v of line.split(',')) {
        const name = v.trim().replace(/\\.*$/, '').trim();
        if (name) vars.push({ name, comment: extractInlineComment(line) });
      }
    }
  }
  return vars;
}

function extractInlineComment(line) {
  const match = line.match(/\\[*]\s*(.+)$/);
  return match ? match[1].trim() : null;
}

function parseTLAProperties(content) {
  const props = [];
  const lines = content.split('\n');
  let pendingReqs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Collect @requirement annotations
    const reqMatch = line.match(/@requirement\s+(.+)/);
    if (reqMatch) {
      pendingReqs.push(...reqMatch[1].split(/[,\s]+/).filter(Boolean));
      continue;
    }
    // Property definition: Name ==
    const propMatch = line.match(/^(\w+)\s*==/);
    if (propMatch) {
      const name = propMatch[1];
      // Skip infrastructure definitions
      if (!['vars', 'Init', 'Next', 'Spec', 'Fairness', 'Symmetry'].includes(name)) {
        props.push({
          name,
          requirements: pendingReqs.length > 0 ? [...pendingReqs] : [],
          line: i + 1,
        });
      }
      pendingReqs = [];
    } else if (!line.startsWith('\\*') && !line.startsWith('(*') && line !== '') {
      // Non-comment, non-empty line clears pending annotations
      if (!reqMatch) pendingReqs = [];
    }
  }
  return props;
}

function parseAlloyConstructs(content) {
  const constructs = [];
  const lines = content.split('\n');
  let pendingReqs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const reqMatch = line.match(/@requirement\s+(.+)/);
    if (reqMatch) {
      pendingReqs.push(...reqMatch[1].split(/[,\s]+/).filter(Boolean));
      continue;
    }
    // Alloy construct: sig, fact, assert, pred, fun, check, run
    const cMatch = line.match(/^(sig|fact|assert|pred|fun|check|run)\s+(\w+)/);
    if (cMatch) {
      constructs.push({
        kind: cMatch[1],
        name: cMatch[2],
        requirements: pendingReqs.length > 0 ? [...pendingReqs] : [],
        line: i + 1,
      });
      pendingReqs = [];
    }
  }
  return constructs;
}

function parseAlloySigs(content) {
  const sigs = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const sigMatch = line.match(/^(?:abstract\s+|one\s+|lone\s+)?sig\s+(\w+)(?:\s+extends\s+(\w+))?/);
    if (sigMatch) {
      const fields = [];
      // Parse fields in the sig body
      for (let j = i + 1; j < lines.length; j++) {
        const fl = lines[j].trim();
        if (fl.startsWith('}')) break;
        const fieldMatch = fl.match(/^(\w+)\s*:\s*(.+?)(?:,|$)/);
        if (fieldMatch) {
          fields.push({ name: fieldMatch[1], type: fieldMatch[2].trim().replace(/,\s*$/, '') });
        }
      }
      sigs.push({
        name: sigMatch[1],
        extends: sigMatch[2] || null,
        fields,
        line: i + 1,
      });
    }
  }
  return sigs;
}

// ---------------------------------------------------------------------------
// Aggregation functions
// ---------------------------------------------------------------------------

/**
 * Build a comprehensive model summary from all data sources.
 * Returns array of model objects with parsed details.
 */
function buildModelIndex(basePath) {
  const registry = loadModelRegistry(basePath);
  const stateSpace = loadStateSpaceReport(basePath);
  const matrix = loadTraceabilityMatrix(basePath);
  const base = basePath || process.cwd();

  const models = [];

  for (const [modelPath, entry] of Object.entries(registry.models || {})) {
    const absPath = path.join(base, modelPath);
    const exists = fs.existsSync(absPath);
    const ext = path.extname(modelPath).toLowerCase();
    const formalism = ext === '.tla' ? 'TLA+' : ext === '.als' ? 'Alloy' : ext === '.pm' ? 'PRISM' : 'Unknown';

    let variables = [];
    let properties = [];
    let constructs = [];
    let sigs = [];

    if (exists) {
      const content = fs.readFileSync(absPath, 'utf8');
      if (formalism === 'TLA+') {
        variables = parseTLAVariables(content);
        properties = parseTLAProperties(content);
      } else if (formalism === 'Alloy') {
        constructs = parseAlloyConstructs(content);
        sigs = parseAlloySigs(content);
      }
    }

    // State-space info
    const ssEntry = (stateSpace.models || {})[modelPath] || null;

    // Properties from traceability matrix
    const matrixProps = [];
    for (const [key, prop] of Object.entries(matrix.properties || {})) {
      if (prop.model_file === modelPath) {
        matrixProps.push(prop);
      }
    }

    models.push({
      path: modelPath,
      formalism,
      exists,
      description: entry.description || '',
      version: entry.version || null,
      requirements: entry.requirements || [],
      variables,
      properties,       // TLA+ properties
      constructs,       // Alloy constructs
      sigs,             // Alloy sigs
      stateSpace: ssEntry,
      matrixProperties: matrixProps,
    });
  }

  return models;
}

/**
 * Build a test coverage index: requirement → test cases.
 */
function buildTestIndex(basePath) {
  const utc = loadUnitTestCoverage(basePath);
  const reqs = loadRequirements(basePath);
  const reqMap = {};

  for (const r of (reqs.requirements || [])) {
    reqMap[r.id] = {
      id: r.id,
      text: r.text || '',
      category: r.category || 'Uncategorized',
      status: r.status || 'Unknown',
      covered: false,
      testCases: [],
    };
  }

  for (const [reqId, entry] of Object.entries(utc.requirements || {})) {
    if (!reqMap[reqId]) {
      reqMap[reqId] = { id: reqId, text: '', category: 'Unknown', status: 'Unknown', covered: false, testCases: [] };
    }
    reqMap[reqId].covered = entry.covered || false;
    reqMap[reqId].testCases = (entry.test_cases || []).map(tc => ({
      file: tc.test_file || '',
      name: tc.test_name || '',
    }));
  }

  return reqMap;
}

/**
 * Build a variable index across all models.
 * Returns array of { variable, model, domain, cardinality, bounded, risk }.
 */
function buildVariableIndex(basePath) {
  const models = buildModelIndex(basePath);
  const stateSpace = loadStateSpaceReport(basePath);
  const variables = [];

  for (const model of models) {
    if (model.formalism === 'TLA+') {
      const ssVars = ((stateSpace.models || {})[model.path] || {}).variables || [];
      const ssMap = {};
      for (const sv of ssVars) { ssMap[sv.name] = sv; }

      for (const v of model.variables) {
        const sv = ssMap[v.name] || {};
        variables.push({
          name: v.name,
          model: model.path,
          formalism: 'TLA+',
          comment: v.comment,
          domain: sv.domain || null,
          cardinality: sv.cardinality || null,
          bounded: sv.bounded != null ? sv.bounded : null,
        });
      }
    } else if (model.formalism === 'Alloy') {
      for (const sig of model.sigs) {
        for (const field of sig.fields) {
          variables.push({
            name: `${sig.name}.${field.name}`,
            model: model.path,
            formalism: 'Alloy',
            comment: null,
            domain: field.type,
            cardinality: null,
            bounded: true, // Alloy is always bounded
          });
        }
      }
    }
  }

  return variables;
}

/**
 * Build an interconnection graph: nodes (reqs, models, tests, properties)
 * and edges showing how they link together.
 */
function buildInterconnectionGraph(basePath) {
  const models = buildModelIndex(basePath);
  const testIndex = buildTestIndex(basePath);
  const matrix = loadTraceabilityMatrix(basePath);

  const nodes = { requirements: {}, models: {}, properties: {}, tests: {} };
  const edges = [];

  // Requirements
  for (const [reqId, entry] of Object.entries(testIndex)) {
    nodes.requirements[reqId] = {
      type: 'requirement',
      id: reqId,
      text: entry.text,
      category: entry.category,
      status: entry.status,
    };
  }

  // Models + edges to requirements
  for (const model of models) {
    const shortPath = path.basename(model.path);
    nodes.models[model.path] = {
      type: 'model',
      id: model.path,
      shortName: shortPath,
      formalism: model.formalism,
      varCount: model.variables.length + model.sigs.reduce((n, s) => n + s.fields.length, 0),
      propCount: model.properties.length + model.constructs.length,
      riskLevel: model.stateSpace ? model.stateSpace.risk_level : null,
    };

    for (const reqId of model.requirements) {
      edges.push({ from: reqId, to: model.path, type: 'req-model' });
    }

    // Properties → requirements
    for (const prop of model.properties) {
      const propKey = `${model.path}::${prop.name}`;
      nodes.properties[propKey] = {
        type: 'property',
        id: propKey,
        name: prop.name,
        model: model.path,
      };
      for (const reqId of prop.requirements) {
        edges.push({ from: reqId, to: propKey, type: 'req-property' });
      }
    }
    for (const c of model.constructs) {
      const cKey = `${model.path}::${c.name}`;
      nodes.properties[cKey] = {
        type: 'property',
        id: cKey,
        name: c.name,
        kind: c.kind,
        model: model.path,
      };
      for (const reqId of c.requirements) {
        edges.push({ from: reqId, to: cKey, type: 'req-property' });
      }
    }
  }

  // Tests → requirements
  for (const [reqId, entry] of Object.entries(testIndex)) {
    for (const tc of entry.testCases) {
      const testKey = `${tc.file}::${tc.name}`;
      if (!nodes.tests[testKey]) {
        nodes.tests[testKey] = { type: 'test', id: testKey, file: tc.file, name: tc.name };
      }
      edges.push({ from: reqId, to: testKey, type: 'req-test' });
    }
  }

  return { nodes, edges };
}

/**
 * Build a summary dashboard of the formal verification ecosystem.
 */
function buildFormalSummary(basePath) {
  const models = buildModelIndex(basePath);
  const testIndex = buildTestIndex(basePath);
  const stateSpace = loadStateSpaceReport(basePath);

  const tlaModels = models.filter(m => m.formalism === 'TLA+');
  const alloyModels = models.filter(m => m.formalism === 'Alloy');

  // Count variables
  let totalVars = 0;
  let unboundedVars = 0;
  for (const m of models) {
    if (m.formalism === 'TLA+') totalVars += m.variables.length;
    if (m.formalism === 'Alloy') totalVars += m.sigs.reduce((n, s) => n + s.fields.length, 0);
  }
  const ssModels = Object.values(stateSpace.models || {});
  for (const ss of ssModels) {
    for (const v of (ss.variables || [])) {
      if (!v.bounded) unboundedVars++;
    }
  }

  // Count properties
  let totalProps = 0;
  let annotatedProps = 0;
  for (const m of models) {
    for (const p of m.properties) {
      totalProps++;
      if (p.requirements.length > 0) annotatedProps++;
    }
    for (const c of m.constructs) {
      totalProps++;
      if (c.requirements.length > 0) annotatedProps++;
    }
  }

  // Risk distribution
  const byRisk = { MINIMAL: 0, LOW: 0, MODERATE: 0, HIGH: 0 };
  for (const m of models) {
    if (m.stateSpace && m.stateSpace.risk_level) {
      byRisk[m.stateSpace.risk_level] = (byRisk[m.stateSpace.risk_level] || 0) + 1;
    }
  }

  // Test coverage
  const totalReqs = Object.keys(testIndex).length;
  const coveredReqs = Object.values(testIndex).filter(t => t.covered).length;
  const totalTests = Object.values(testIndex).reduce((n, t) => n + t.testCases.length, 0);

  // All unique requirements across models
  const allModelReqs = new Set();
  for (const m of models) {
    for (const r of m.requirements) allModelReqs.add(r);
  }

  return {
    models: {
      total: models.length,
      tla: tlaModels.length,
      alloy: alloyModels.length,
      other: models.length - tlaModels.length - alloyModels.length,
    },
    variables: {
      total: totalVars,
      unbounded: unboundedVars,
    },
    properties: {
      total: totalProps,
      annotated: annotatedProps,
      unannotated: totalProps - annotatedProps,
    },
    risk: byRisk,
    coverage: {
      totalReqs,
      coveredReqs,
      totalTests,
      modelLinkedReqs: allModelReqs.size,
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loadModelRegistry,
  loadTraceabilityMatrix,
  loadUnitTestCoverage,
  loadStateSpaceReport,
  loadRequirements,
  parseTLAVariables,
  parseTLAProperties,
  parseAlloyConstructs,
  parseAlloySigs,
  buildModelIndex,
  buildTestIndex,
  buildVariableIndex,
  buildInterconnectionGraph,
  buildFormalSummary,
};

module.exports._pure = module.exports;
