#!/usr/bin/env node
'use strict';

/**
 * gate-a-grounding.cjs — Gate A grounding score computation.
 *
 * Measures alignment between L1 evidence (conformance traces) and L2 semantics
 * (operational model). A trace event is "explained" iff:
 *   1. Its action maps to a known entry in event-vocabulary.json (vocabulary_mapped = true)
 *   2. Its XState transition is EITHER:
 *      a. Validated by fresh actor replay (xstate_valid = true), OR
 *      b. Correctly skipped as a mid-session event under H1 methodology (methodology_skip = true)
 *
 * Unexplained traces are classified into:
 *   - instrumentation_bug: action NOT in vocabulary
 *   - model_gap: action in vocabulary but XState replay fails
 *   - genuine_violation: model_gap event that violates a declared observed invariant
 *
 * Requirements: GATE-01
 *
 * Usage:
 *   node bin/gate-a-grounding.cjs            # print summary to stdout
 *   node bin/gate-a-grounding.cjs --json     # print full results JSON to stdout
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..');
const FORMAL = path.join(ROOT, '.planning', 'formal');
const GATES_DIR = path.join(FORMAL, 'gates');
const OUT_FILE = path.join(GATES_DIR, 'gate-a-grounding.json');

const JSON_FLAG = process.argv.includes('--json');

// Parse --base-ref <sha>
const BASE_REF_IDX = process.argv.indexOf('--base-ref');
const BASE_REF = BASE_REF_IDX !== -1 ? process.argv[BASE_REF_IDX + 1] || null : null;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * H1 methodology skip: mid-session events (phase !== 'IDLE' AND action !== 'quorum_start')
 * cannot be validated with a fresh actor from IDLE.
 */
function isMethodologySkip(event) {
  if (!event) return false;
  if (event.action === 'quorum_start') return false;
  if (event.phase && event.phase !== 'IDLE') return true;
  return false;
}

/**
 * Check if a model_gap event violates an observed invariant.
 * Returns the violated invariant name or null.
 */
function checkGenuineViolation(event, observedInvariants, sessionContext) {
  if (!observedInvariants || observedInvariants.length === 0) return null;

  for (const inv of observedInvariants) {
    const expr = (inv.property_expression || '').toLowerCase();

    // Match invariant property_expression keywords against event action
    if (inv.name === 'quorum_start_precedes_complete' || expr.includes('quorum_start always precedes quorum_complete')) {
      if (event.action === 'quorum_complete' && sessionContext && !sessionContext.seenQuorumStart) {
        return inv.name;
      }
    }

    if (inv.name === 'circuit_break_within_quorum_session' || expr.includes('circuit_break events only occur during active quorum')) {
      if (event.action === 'circuit_break' && sessionContext && !sessionContext.seenQuorumStart) {
        return inv.name;
      }
    }
  }

  return null;
}

// ── Diff-scoped grounding ────────────────────────────────────────────────────

/**
 * Normalize a file path for comparison: strip leading ./ and resolve.
 */
function normalizePath(p) {
  return path.normalize(p).replace(/^\.\//, '').replace(/^\.\\/, '');
}

/**
 * Get the set of instrumentation actions associated with files changed since baseRef.
 * Returns an object { scopedActions: Set, changedFiles: string[] }, or null if fallback to global mode is needed.
 */
function getChangedActions(baseRef) {
  // Step 1: Get changed files from git diff
  let changedFiles;
  try {
    const output = execSync(`git diff --name-only ${baseRef}..HEAD`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    changedFiles = output.split('\n').filter(l => l.trim().length > 0).map(normalizePath);
  } catch (e) {
    process.stderr.write(`WARNING: git diff failed for base-ref '${baseRef}': ${e.message}, falling back to global mode\n`);
    return null;
  }

  if (changedFiles.length === 0) {
    process.stderr.write('WARNING: No changed files found for base-ref, falling back to global mode\n');
    return null;
  }

  // Step 2: Load instrumentation-map.json
  let instrumentationMap;
  const mapPath = path.join(FORMAL, 'evidence', 'instrumentation-map.json');
  try {
    instrumentationMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  } catch (e) {
    process.stderr.write('WARNING: instrumentation-map.json missing or malformed, falling back to global mode\n');
    return null;
  }

  if (!instrumentationMap || !Array.isArray(instrumentationMap.emission_points)) {
    process.stderr.write('WARNING: instrumentation-map.json missing or malformed, falling back to global mode\n');
    return null;
  }

  // Step 3: Build set of actions whose file matches changed files
  const changedSet = new Set(changedFiles);
  const scopedActions = new Set();
  for (const ep of instrumentationMap.emission_points) {
    const normalizedFile = normalizePath(ep.file);
    if (changedSet.has(normalizedFile)) {
      scopedActions.add(ep.action);
    }
  }

  return { scopedActions, changedFiles };
}

// ── Core computation ────────────────────────────────────────────────────────

function computeGateA(conformanceEvents, vocabulary, invariantCatalog, mismatchRegister) {
  const warnings = [];

  // Load mapToXStateEvent
  const { mapToXStateEvent } = require(path.join(__dirname, 'validate-traces.cjs'));

  // Load XState machine
  const machinePath = (() => {
    const repoDist    = path.join(__dirname, '..', 'dist', 'machines', 'nf-workflow.machine.js');
    const installDist = path.join(__dirname, 'dist', 'machines', 'nf-workflow.machine.js');
    return fs.existsSync(repoDist) ? repoDist : installDist;
  })();
  const { createActor, nfWorkflowMachine } = require(machinePath);

  // Extract vocabulary actions set
  const vocabActions = new Set();
  if (vocabulary && vocabulary.vocabulary) {
    for (const key of Object.keys(vocabulary.vocabulary)) {
      vocabActions.add(key);
    }
  }

  // Extract observed invariants for genuine_violation check
  let observedInvariants = [];
  if (invariantCatalog && invariantCatalog.invariants) {
    observedInvariants = invariantCatalog.invariants.filter(i => i.type === 'observed');
  } else {
    warnings.push('invariant-catalog.json not found or invalid, skipping genuine_violation reclassification');
  }

  if (!mismatchRegister) {
    warnings.push('mismatch-register.jsonl not found, skipping mismatch incorporation');
  }

  // Counters
  let explained = 0;
  let xstateValidated = 0;
  let methodologySkips = 0;
  let vocabularyMapped = 0;

  const unexplainedCounts = { instrumentation_bug: 0, model_gap: 0, genuine_violation: 0 };
  const unexplainedActions = { instrumentation_bug: {}, model_gap: {}, genuine_violation: {} };
  const violatedInvariants = {};

  // Simple session context tracking for genuine violation checks
  // We track per-session whether quorum_start has been seen
  let sessionContext = { seenQuorumStart: false };

  for (let i = 0; i < conformanceEvents.length; i++) {
    const event = conformanceEvents[i];

    // Reset session context on IDLE phase events
    if (event.phase === 'IDLE' && event.action === 'quorum_start') {
      sessionContext = { seenQuorumStart: true };
    }

    // Step 1: Is the action in the vocabulary?
    const inVocab = vocabActions.has(event.action);

    if (!inVocab) {
      // NOT in vocabulary -> instrumentation_bug
      unexplainedCounts.instrumentation_bug++;
      unexplainedActions.instrumentation_bug[event.action] = (unexplainedActions.instrumentation_bug[event.action] || 0) + 1;
      continue;
    }

    vocabularyMapped++;

    // Step 2: Map to XState event
    const xstateEvent = mapToXStateEvent(event);
    if (!xstateEvent) {
      // In vocab but no XState mapping -> instrumentation_bug
      unexplainedCounts.instrumentation_bug++;
      unexplainedActions.instrumentation_bug[event.action + ':no_xstate_map'] = (unexplainedActions.instrumentation_bug[event.action + ':no_xstate_map'] || 0) + 1;
      continue;
    }

    // Step 3: H1 methodology skip?
    if (isMethodologySkip(event)) {
      methodologySkips++;
      explained++;
      continue;
    }

    // Step 4: Fresh actor replay
    const actor = createActor(nfWorkflowMachine);
    actor.start();
    const beforeState = actor.getSnapshot().value;
    actor.send(xstateEvent);
    const afterState = actor.getSnapshot().value;
    actor.stop();

    // Check if the transition was accepted (state changed or self-loop is valid)
    // A "valid" transition means the machine processed it without error
    // For fresh-from-IDLE replay, the key test is: did the machine move to a state
    // consistent with the event type?
    const stateStr = typeof afterState === 'string' ? afterState : JSON.stringify(afterState);

    // Consider the transition valid if the machine accepted the event
    // (any state change from IDLE or valid self-loop like CIRCUIT_BREAK)
    const transitionAccepted = (stateStr !== 'IDLE' || xstateEvent.type === 'CIRCUIT_BREAK');

    if (transitionAccepted) {
      xstateValidated++;
      explained++;
    } else {
      // model_gap: in vocab, mapped, but replay fails
      // Check for genuine_violation reclassification
      const violatedInvariant = checkGenuineViolation(event, observedInvariants, sessionContext);
      if (violatedInvariant) {
        unexplainedCounts.genuine_violation++;
        unexplainedActions.genuine_violation[event.action] = (unexplainedActions.genuine_violation[event.action] || 0) + 1;
        violatedInvariants[violatedInvariant] = (violatedInvariants[violatedInvariant] || 0) + 1;
      } else {
        unexplainedCounts.model_gap++;
        unexplainedActions.model_gap[event.action] = (unexplainedActions.model_gap[event.action] || 0) + 1;
      }
    }
  }

  const total = conformanceEvents.length;
  const groundingScore = total > 0 ? explained / total : 0;

  // Build top actions lists for unexplained summary
  const topActions = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ action: k, count: v }));

  return {
    schema_version: '1',
    generated: new Date().toISOString(),
    grounding_score: groundingScore,
    target: 0.80,
    target_met: groundingScore >= 0.80,
    explained,
    total,
    unexplained_counts: unexplainedCounts,
    unexplained_summary: {
      instrumentation_bug: { top_actions: topActions(unexplainedActions.instrumentation_bug), total: unexplainedCounts.instrumentation_bug },
      model_gap: { top_mismatches: topActions(unexplainedActions.model_gap), total: unexplainedCounts.model_gap },
      genuine_violation: { violated_invariants: Object.entries(violatedInvariants).map(([k, v]) => ({ invariant: k, count: v })), total: unexplainedCounts.genuine_violation }
    },
    methodology: {
      explains_definition: 'vocabulary_mapped AND (xstate_valid OR methodology_skip)',
      h1_methodology_skips: methodologySkips,
      xstate_validated: xstateValidated,
      vocabulary_mapped: vocabularyMapped
    },
    warnings
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  // Read conformance events
  const pp = require(path.join(__dirname, 'planning-paths.cjs'));
  const logPath = pp.resolveWithFallback(ROOT, 'conformance-events');
  let conformanceEvents = [];
  if (fs.existsSync(logPath)) {
    const raw = fs.readFileSync(logPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      try { conformanceEvents.push(JSON.parse(line)); } catch (_) { /* skip */ }
    }
  }

  // Read vocabulary
  const vocabPath = path.join(FORMAL, 'evidence', 'event-vocabulary.json');
  let vocabulary = null;
  if (fs.existsSync(vocabPath)) {
    try { vocabulary = JSON.parse(fs.readFileSync(vocabPath, 'utf8')); } catch (_) { /* fail-open */ }
  }

  // Try to read invariant catalog (graceful degradation)
  let invariantCatalog = null;
  const invCatPath = path.join(FORMAL, 'semantics', 'invariant-catalog.json');
  if (fs.existsSync(invCatPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(invCatPath, 'utf8'));
      if (parsed.schema_version && Array.isArray(parsed.invariants)) {
        invariantCatalog = parsed;
      } else {
        process.stderr.write('WARNING: invariant-catalog.json has invalid schema, skipping\n');
      }
    } catch (_) {
      process.stderr.write('WARNING: invariant-catalog.json parse error, skipping\n');
    }
  } else {
    process.stderr.write('WARNING: invariant-catalog.json not found, skipping genuine_violation reclassification\n');
  }

  // Try to read mismatch register (graceful degradation)
  let mismatchRegister = null;
  const mmPath = path.join(FORMAL, 'semantics', 'mismatch-register.jsonl');
  if (fs.existsSync(mmPath)) {
    try {
      const lines = fs.readFileSync(mmPath, 'utf8').trim().split('\n').filter(l => l.trim());
      mismatchRegister = lines.map(l => {
        const parsed = JSON.parse(l);
        if (!parsed.resolution) throw new Error('Missing resolution field');
        return parsed;
      });
    } catch (e) {
      process.stderr.write('WARNING: mismatch-register.jsonl parse error, skipping mismatch incorporation\n');
    }
  } else {
    process.stderr.write('WARNING: mismatch-register.jsonl not found, skipping mismatch incorporation\n');
  }

  // Determine scoping mode
  let scopeInfo = { mode: 'global' };
  let primaryResult;
  let globalResult;

  if (BASE_REF) {
    const changed = getChangedActions(BASE_REF);
    if (changed && changed.scopedActions.size > 0) {
      // Diff-scoped mode
      const scopedEvents = conformanceEvents.filter(e => changed.scopedActions.has(e.action));
      const scopedResult = computeGateA(scopedEvents, vocabulary, invariantCatalog, mismatchRegister);
      globalResult = computeGateA(conformanceEvents, vocabulary, invariantCatalog, mismatchRegister);

      scopeInfo = {
        mode: 'diff',
        base_ref: BASE_REF,
        changed_files: changed.changedFiles,
        scoped_actions: [...changed.scopedActions],
        global_score: globalResult.grounding_score,
        global_explained: globalResult.explained,
        global_total: globalResult.total
      };

      primaryResult = scopedResult;
    } else {
      // Fallback to global mode (getChangedActions returned null or empty scoped actions)
      if (changed && changed.scopedActions.size === 0) {
        process.stderr.write('WARNING: No scoped actions found for changed files, falling back to global mode\n');
      }
      primaryResult = computeGateA(conformanceEvents, vocabulary, invariantCatalog, mismatchRegister);
      globalResult = primaryResult;
    }
  } else {
    primaryResult = computeGateA(conformanceEvents, vocabulary, invariantCatalog, mismatchRegister);
    globalResult = primaryResult;
  }

  // Attach scope to result
  const result = { ...primaryResult, scope: scopeInfo };

  // EARLY WARNING check
  if (result.grounding_score < 0.50) {
    process.stderr.write(`\nEARLY WARNING: grounding_score is ${(result.grounding_score * 100).toFixed(1)}% (< 50%). Re-examine explains definition!\n`);
  }

  // Write output
  fs.mkdirSync(GATES_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n');

  // Emit check result via write-check-result
  try {
    const { writeCheckResult } = require(path.join(__dirname, 'write-check-result.cjs'));
    const startTime = Date.now();
    const scopeLabel = scopeInfo.mode === 'diff' ? ' (scoped)' : '';
    writeCheckResult({
      tool: 'gate-a-grounding',
      formalism: 'trace',
      result: result.target_met ? 'pass' : 'fail',
      check_id: 'gate-a:grounding-score',
      surface: 'trace',
      property: `Gate A grounding score${scopeLabel}: ${(result.grounding_score * 100).toFixed(1)}% (target: 80%)`,
      runtime_ms: Date.now() - startTime,
      summary: `${result.target_met ? 'pass' : 'fail'}: grounding ${(result.grounding_score * 100).toFixed(1)}%, ${result.explained}/${result.total} explained${scopeLabel}`,
      requirement_ids: ['GATE-01'],
      metadata: {
        grounding_score: result.grounding_score,
        target: result.target,
        target_met: result.target_met,
        ...(scopeInfo.mode === 'diff' ? { base_ref: BASE_REF, scoped: true } : {})
      }
    });
  } catch (e) {
    process.stderr.write('WARNING: Could not write check result: ' + e.message + '\n');
  }

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    if (scopeInfo.mode === 'diff') {
      console.log(`Gate A Grounding Score (scoped): ${(result.grounding_score * 100).toFixed(1)}%`);
      console.log(`  Scope: ${scopeInfo.changed_files.length} files changed, ${scopeInfo.scoped_actions.length} actions scoped`);
      console.log(`  Target: >= 80% | Met: ${result.target_met}`);
      console.log(`  Explained: ${result.explained} / ${result.total}`);
      console.log(`  Unexplained: instrumentation_bug=${result.unexplained_counts.instrumentation_bug} model_gap=${result.unexplained_counts.model_gap} genuine_violation=${result.unexplained_counts.genuine_violation}`);
      console.log(`  Methodology: xstate_validated=${result.methodology.xstate_validated} h1_skips=${result.methodology.h1_methodology_skips} vocab_mapped=${result.methodology.vocabulary_mapped}`);
      console.log(`  Global (informational): ${(globalResult.grounding_score * 100).toFixed(1)}% (${globalResult.explained}/${globalResult.total} explained)`);
    } else {
      console.log(`Gate A Grounding Score: ${(result.grounding_score * 100).toFixed(1)}%`);
      console.log(`  Target: >= 80% | Met: ${result.target_met}`);
      console.log(`  Explained: ${result.explained} / ${result.total}`);
      console.log(`  Unexplained: instrumentation_bug=${result.unexplained_counts.instrumentation_bug} model_gap=${result.unexplained_counts.model_gap} genuine_violation=${result.unexplained_counts.genuine_violation}`);
      console.log(`  Methodology: xstate_validated=${result.methodology.xstate_validated} h1_skips=${result.methodology.h1_methodology_skips} vocab_mapped=${result.methodology.vocabulary_mapped}`);
    }
    if (result.warnings.length > 0) {
      console.log(`  Warnings: ${result.warnings.join('; ')}`);
    }
    console.log(`  Output: ${OUT_FILE}`);
  }

  process.exit(0);
}

module.exports = { computeGateA, isMethodologySkip, checkGenuineViolation, getChangedActions, normalizePath };
