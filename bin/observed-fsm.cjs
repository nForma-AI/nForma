#!/usr/bin/env node
'use strict';
// bin/observed-fsm.cjs
// Derives an observed-behavior FSM from trace replay using dual-mode:
//   Mode A: per-event isolation (fresh actor per event)
//   Mode B: per-session running actor (session-grouped replay)
// Produces observed-fsm.json with transitions, model comparison, and coverage metrics.
// Requirements: SEM-04

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all transitions from an XState machine config.
 * Returns array of { from, event, to } objects.
 */
function extractModelTransitions(config, parentName) {
  const transitions = [];
  const states = config.states || {};

  for (const [stateName, stateConfig] of Object.entries(states)) {
    const fullName = parentName ? parentName + '.' + stateName : stateName;
    const on = stateConfig.on || {};

    for (const [eventType, targets] of Object.entries(on)) {
      // Targets can be arrays (guarded), strings, or objects
      const targetList = Array.isArray(targets) ? targets : [targets];
      for (const t of targetList) {
        const targetState = typeof t === 'string' ? t : (t.target || fullName);
        transitions.push({ from: fullName, event: eventType, to: targetState });
      }
    }

    // Recurse into nested states
    if (stateConfig.states) {
      transitions.push(...extractModelTransitions(stateConfig, fullName));
    }
  }

  return transitions;
}

/**
 * Normalize an XState snapshot value to a flat string.
 * Handles nested state objects like { COLLECTING_VOTES: "active" } -> "COLLECTING_VOTES"
 */
function normalizeState(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1) return keys[0];
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Build adjacency map from per-event isolation replay (Mode A).
 * Each event gets a fresh actor from IDLE.
 * Returns { adjacencyMap, stats }.
 */
function replayPerEvent(events, mapToXStateEvent, createActor, machine) {
  const adjacencyMap = {};
  let mapped = 0;
  let unmapped = 0;
  let totalTransitions = 0;

  for (const event of events) {
    const xstateEvent = mapToXStateEvent(event);
    if (!xstateEvent) {
      unmapped++;
      continue;
    }
    mapped++;

    const actor = createActor(machine);
    actor.start();
    const beforeState = normalizeState(actor.getSnapshot().value);
    actor.send(xstateEvent);
    const afterState = normalizeState(actor.getSnapshot().value);
    actor.stop();

    // Record transition
    if (!adjacencyMap[beforeState]) adjacencyMap[beforeState] = {};
    if (!adjacencyMap[beforeState][xstateEvent.type]) {
      adjacencyMap[beforeState][xstateEvent.type] = { to_state: afterState, count: 0, source: 'per_event' };
    }
    adjacencyMap[beforeState][xstateEvent.type].count++;
    totalTransitions++;
  }

  return { adjacencyMap, mapped, unmapped, totalTransitions };
}

/**
 * Build adjacency map from per-session replay (Mode B).
 * Groups events by session_id/round_id and replays sequentially.
 * Returns { adjacencyMap, sessionsReplayed, totalTransitions }.
 */
function replayPerSession(events, mapToXStateEvent, createActor, machine) {
  const adjacencyMap = {};
  let sessionsReplayed = 0;
  let totalTransitions = 0;

  // Group events by session -- use timestamp-based windowing since events lack session_id
  // Window: events within 2 seconds of each other form a session
  const sessions = [];
  let currentSession = [];
  let lastTs = null;

  for (const event of events) {
    const ts = event.ts ? new Date(event.ts).getTime() : 0;
    if (lastTs !== null && (ts - lastTs) > 2000) {
      if (currentSession.length > 0) sessions.push(currentSession);
      currentSession = [];
    }
    currentSession.push(event);
    lastTs = ts;
  }
  if (currentSession.length > 0) sessions.push(currentSession);

  for (const session of sessions) {
    const mappableEvents = session.map(e => ({ original: e, xstate: mapToXStateEvent(e) })).filter(e => e.xstate);
    if (mappableEvents.length < 2) continue; // need at least 2 events for a session chain

    sessionsReplayed++;
    const actor = createActor(machine);
    actor.start();

    for (const { xstate } of mappableEvents) {
      const beforeState = normalizeState(actor.getSnapshot().value);
      actor.send(xstate);
      const afterState = normalizeState(actor.getSnapshot().value);

      if (!adjacencyMap[beforeState]) adjacencyMap[beforeState] = {};
      if (!adjacencyMap[beforeState][xstate.type]) {
        adjacencyMap[beforeState][xstate.type] = { to_state: afterState, count: 0, source: 'per_session' };
      }
      adjacencyMap[beforeState][xstate.type].count++;
      totalTransitions++;
    }
    actor.stop();
  }

  return { adjacencyMap, sessionsReplayed, totalTransitions };
}

/**
 * Merge two adjacency maps. Per-event is authoritative for counts.
 * Per-session adds transitions not visible from IDLE starts.
 */
function mergeAdjacencyMaps(perEventMap, perSessionMap) {
  const merged = JSON.parse(JSON.stringify(perEventMap));

  for (const [fromState, events] of Object.entries(perSessionMap)) {
    if (!merged[fromState]) merged[fromState] = {};
    for (const [eventType, transition] of Object.entries(events)) {
      if (merged[fromState][eventType]) {
        // Both modes saw this transition
        merged[fromState][eventType].source = 'both';
      } else {
        // Only per-session saw this -- add it
        merged[fromState][eventType] = { ...transition, source: 'per_session' };
      }
    }
  }

  return merged;
}

/**
 * Compare observed transitions against hand-written model.
 * Returns { missing_in_observed, missing_in_model, matching }.
 */
function compareWithModel(observedMap, modelTransitions) {
  const missing_in_observed = [];
  const missing_in_model = [];
  const matching = [];

  // Check model transitions against observed
  for (const mt of modelTransitions) {
    const observed = observedMap[mt.from] && observedMap[mt.from][mt.event];
    if (observed) {
      matching.push({ from: mt.from, event: mt.event, to: mt.to });
    } else {
      missing_in_observed.push({ from: mt.from, event: mt.event, to: mt.to });
    }
  }

  // Check observed transitions against model
  const modelSet = new Set(modelTransitions.map(t => t.from + '|' + t.event));
  for (const [fromState, events] of Object.entries(observedMap)) {
    for (const [eventType, transition] of Object.entries(events)) {
      const key = fromState + '|' + eventType;
      if (!modelSet.has(key)) {
        missing_in_model.push({ from: fromState, event: eventType, to: transition.to_state, source: transition.source });
      }
    }
  }

  return { missing_in_observed, missing_in_model, matching };
}

/**
 * Build the full observed FSM from conformance events.
 * Returns the complete observed-fsm.json structure.
 */
function buildObservedFSM(conformanceEvents, vocabulary) {
  const { mapToXStateEvent } = require(path.join(__dirname, 'validate-traces.cjs'));

  const machinePath = (() => {
    const repoDist    = path.join(__dirname, '..', 'dist', 'machines', 'nf-workflow.machine.js');
    const installDist = path.join(__dirname, 'dist', 'machines', 'nf-workflow.machine.js');
    return fs.existsSync(repoDist) ? repoDist : installDist;
  })();
  const { createActor, nfWorkflowMachine } = require(machinePath);

  // Mode A: per-event isolation
  const perEventResult = replayPerEvent(conformanceEvents, mapToXStateEvent, createActor, nfWorkflowMachine);

  // Mode B: per-session replay
  const perSessionResult = replayPerSession(conformanceEvents, mapToXStateEvent, createActor, nfWorkflowMachine);

  // Merge adjacency maps
  const mergedTransitions = mergeAdjacencyMaps(perEventResult.adjacencyMap, perSessionResult.adjacencyMap);

  // Collect observed states
  const statesObserved = new Set();
  for (const [fromState, events] of Object.entries(mergedTransitions)) {
    statesObserved.add(fromState);
    for (const transition of Object.values(events)) {
      statesObserved.add(transition.to_state);
    }
  }

  // Extract model transitions and compare
  const modelTransitions = extractModelTransitions(nfWorkflowMachine.config, '');
  const comparison = compareWithModel(mergedTransitions, modelTransitions);

  // Coverage metrics
  const totalModelTransitions = modelTransitions.length;
  const matchingCount = comparison.matching.length;
  const modelCoverage = totalModelTransitions > 0 ? matchingCount / totalModelTransitions : 0;

  // Vocabulary coverage: what % of conformance events map to known vocabulary actions
  const totalEvents = conformanceEvents.length;
  const mappedEvents = perEventResult.mapped;
  const unmappedEvents = perEventResult.unmapped;
  const vocabularyCoverage = totalEvents > 0 ? mappedEvents / totalEvents : 0;

  return {
    schema_version: '1',
    generated: new Date().toISOString(),
    observed_transitions: mergedTransitions,
    states_observed: [...statesObserved].sort(),
    model_comparison: comparison,
    coverage: {
      model_coverage: Math.round(modelCoverage * 1000) / 1000,
      vocabulary_coverage: Math.round(vocabularyCoverage * 1000) / 1000,
      total_events: totalEvents,
      mapped_events: mappedEvents,
      unmapped_events: unmappedEvents,
    },
    replay_modes: {
      per_event_transitions: perEventResult.totalTransitions,
      per_session_transitions: perSessionResult.totalTransitions,
      sessions_replayed: perSessionResult.sessionsReplayed,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const jsonFlag = process.argv.includes('--json');

  // Read conformance events
  const pp = require(path.join(__dirname, 'planning-paths.cjs'));
  const logPath = pp.resolveWithFallback(PROJECT_ROOT, 'conformance-events');
  let conformanceEvents = [];
  if (fs.existsSync(logPath)) {
    const raw = fs.readFileSync(logPath, 'utf8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    for (const line of lines) {
      try { conformanceEvents.push(JSON.parse(line)); } catch (_) { /* skip malformed lines */ }
    }
  }

  // Read vocabulary
  const vocabPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'evidence', 'event-vocabulary.json');
  let vocabulary = {};
  if (fs.existsSync(vocabPath)) {
    try { vocabulary = JSON.parse(fs.readFileSync(vocabPath, 'utf8')); } catch (_) { /* fail-open */ }
  }

  const result = buildObservedFSM(conformanceEvents, vocabulary);

  // Write output
  const outputPath = path.join(PROJECT_ROOT, '.planning', 'formal', 'semantics', 'observed-fsm.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');

  if (jsonFlag) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write('[observed-fsm] States observed: ' + result.states_observed.length + '\n');
    process.stdout.write('[observed-fsm] Model coverage: ' + result.coverage.model_coverage + '\n');
    process.stdout.write('[observed-fsm] Vocabulary coverage: ' + result.coverage.vocabulary_coverage + '\n');
    process.stdout.write('[observed-fsm] Total events: ' + result.coverage.total_events + '\n');
    process.stdout.write('[observed-fsm] Mapped events: ' + result.coverage.mapped_events + '\n');
    process.stdout.write('[observed-fsm] Per-event transitions: ' + result.replay_modes.per_event_transitions + '\n');
    process.stdout.write('[observed-fsm] Per-session transitions: ' + result.replay_modes.per_session_transitions + '\n');
    process.stdout.write('[observed-fsm] Sessions replayed: ' + result.replay_modes.sessions_replayed + '\n');
    process.stdout.write('[observed-fsm] Missing in observed: ' + result.model_comparison.missing_in_observed.length + '\n');
    process.stdout.write('[observed-fsm] Missing in model: ' + result.model_comparison.missing_in_model.length + '\n');
    process.stdout.write('[observed-fsm] Matching: ' + result.model_comparison.matching.length + '\n');
    process.stdout.write('[observed-fsm] Output: ' + outputPath + '\n');
  }

  process.exit(0);
}

module.exports = { buildObservedFSM, extractModelTransitions, normalizeState, replayPerEvent, replayPerSession, mergeAdjacencyMaps, compareWithModel };
