#!/usr/bin/env node
'use strict';
// bin/validate-traces.cjs
// Replays .planning/conformance-events.jsonl through the XState machine
// and reports a deviation score (% of traces that are valid XState executions).
//
// MCPENV-03: also validates MCP interaction metadata for mcp_call events.
// Schema: formal/trace/trace.schema.json
//
// Exit code 0: no divergences found (or log file missing)
// Exit code 1: one or more divergences found

const fs   = require('fs');
const path = require('path');

// ── Confidence tier constants and helpers ─────────────────────────────────────

const CONFIDENCE_THRESHOLDS = {
  low:    { min_rounds: 0,     min_days: 0  },
  medium: { min_rounds: 500,   min_days: 14 },
  high:   { min_rounds: 10000, min_days: 90 },
};

function computeConfidenceTier(n_rounds, window_days) {
  if (n_rounds >= CONFIDENCE_THRESHOLDS.high.min_rounds && window_days >= CONFIDENCE_THRESHOLDS.high.min_days) return 'high';
  if (n_rounds >= CONFIDENCE_THRESHOLDS.medium.min_rounds && window_days >= CONFIDENCE_THRESHOLDS.medium.min_days) return 'medium';
  return 'low';
}

function readScoreboardMeta() {
  const scoreboardPath = path.join(process.cwd(), '.planning', 'quorum-scoreboard.json');
  try {
    const raw = fs.readFileSync(scoreboardPath, 'utf8');
    const sb = JSON.parse(raw);
    const rounds = Array.isArray(sb.rounds) ? sb.rounds : [];
    const n_rounds = rounds.length;
    if (n_rounds === 0) return { n_rounds: 0, window_days: 0 };
    const dates = rounds.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t));
    const window_days = dates.length < 2 ? 0 : Math.floor((Math.max(...dates) - Math.min(...dates)) / 86400000);
    return { n_rounds, window_days };
  } catch (_) {
    return { n_rounds: 0, window_days: 0 };
  }
}

// Validates MCP-specific metadata fields for mcp_call events (MCPENV-03).
// Schema: formal/trace/trace.schema.json
// Returns true if valid, or an array of error strings if invalid.
// Non-mcp_call events are always valid (returns true immediately).
function validateMCPMetadata(event) {
  if (!event || event.action !== 'mcp_call') return true; // not an MCP event — skip

  const errors = [];
  if (!event.request_id || typeof event.request_id !== 'string') {
    errors.push('mcp_call missing or invalid request_id (expected string, e.g. round1:codex-1:1, got: ' + JSON.stringify(event.request_id) + ')');
  }
  if (!event.peer || typeof event.peer !== 'string') {
    errors.push('mcp_call missing or invalid peer (expected slot name string, e.g. codex-1, got: ' + JSON.stringify(event.peer) + ')');
  }
  const validMCPOutcomes = ['success', 'fail', 'timeout', 'reorder'];
  if (!validMCPOutcomes.includes(event.mcp_outcome)) {
    errors.push('mcp_call missing or invalid mcp_outcome (expected: success|fail|timeout|reorder, got: ' + JSON.stringify(event.mcp_outcome) + ')');
  }
  if (typeof event.attempt !== 'number' || !Number.isInteger(event.attempt) || event.attempt < 1) {
    errors.push('mcp_call missing or invalid attempt (expected integer >= 1, got: ' + JSON.stringify(event.attempt) + ')');
  }
  return errors.length === 0 ? true : errors;
}

// Maps a conformance event action to the XState event type and payload.
// Returns null if the action is unmappable (schema violation).
function mapToXStateEvent(event) {
  if (!event || typeof event.action !== 'string') return null;
  switch (event.action) {
    case 'quorum_start':
      return { type: 'QUORUM_START', slotsAvailable: event.slots_available || 0 };
    case 'quorum_complete':
      return { type: 'VOTES_COLLECTED', successCount: event.vote_result || 0 };
    case 'quorum_block':
      return { type: 'DECIDE', outcome: 'BLOCK' };
    case 'deliberation_round':
      return { type: 'VOTES_COLLECTED', successCount: event.vote_result || 0 };
    default:
      return null;
  }
}

// Returns the expected XState state after this event, based on the event's outcome field.
function expectedState(event) {
  if (event.outcome === 'APPROVE') return 'DECIDED';
  if (event.outcome === 'BLOCK')   return 'DECIDED';
  if (event.action === 'quorum_start')      return 'COLLECTING_VOTES';
  if (event.action === 'deliberation_round') return 'DELIBERATING';
  return null; // cannot determine — will count as divergence
}

if (require.main === module) {
  const { writeCheckResult } = require('./write-check-result.cjs');
  // Machine CJS path: in the repo, ../dist/machines/ (bin/ → dist/machines/)
  // When installed at ~/.claude/qgsd-bin/, ./dist/machines/ (qgsd-bin/ → qgsd-bin/dist/machines/)
  const machinePath = (function () {
    const repoDist = path.join(__dirname, '..', 'dist', 'machines', 'qgsd-workflow.machine.cjs');
    const installDist = path.join(__dirname, 'dist', 'machines', 'qgsd-workflow.machine.cjs');
    if (fs.existsSync(repoDist)) return repoDist;
    if (fs.existsSync(installDist)) return installDist;
    throw new Error('[validate-traces] Cannot find qgsd-workflow.machine.cjs in ' + repoDist + ' or ' + installDist);
  })();
  const { createActor, qgsdWorkflowMachine } = require(machinePath);

  const logPath = path.join(process.cwd(), '.planning', 'conformance-events.jsonl');

  if (!fs.existsSync(logPath)) {
    process.stdout.write('[validate-traces] No conformance log at: ' + logPath + ' — nothing to validate\n');
    try { writeCheckResult({ tool: 'validate-traces', formalism: 'trace', result: 'pass', metadata: { reason: 'no-log' } }); } catch (e) { process.stderr.write('[validate-traces] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(0);
  }

  const raw   = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    process.stdout.write('[validate-traces] Conformance log is empty — deviation score: 100.0% (0/0)\n');
    try { writeCheckResult({ tool: 'validate-traces', formalism: 'trace', result: 'pass', metadata: { reason: 'empty-log' } }); } catch (e) { process.stderr.write('[validate-traces] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(0);
  }

  // Read scoreboard metadata ONCE before the loop (avoid repeated file reads)
  const scoreboardMeta = readScoreboardMeta();
  const confidence = computeConfidenceTier(scoreboardMeta.n_rounds, scoreboardMeta.window_days);

  let valid       = 0;
  const divergences = [];

  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch (parseErr) {
      divergences.push({
        line,
        reason: 'json_parse_error: ' + parseErr.message,
        ...scoreboardMeta,
        confidence,
      });
      continue;
    }

    // MCPENV-03: validate MCP interaction metadata for mcp_call events
    const mcpErrors = validateMCPMetadata(event);
    if (mcpErrors !== true) {
      divergences.push({
        event,
        reason: 'mcp_field_validation',
        errors: mcpErrors,
        ...scoreboardMeta,
        confidence,
      });
      continue;
    }

    const xstateEvent = mapToXStateEvent(event);
    if (!xstateEvent) {
      divergences.push({
        event,
        reason: 'unmappable_action: ' + event.action,
        ...scoreboardMeta,
        confidence,
      });
      continue;
    }

    // Fresh actor per event — each conformance event is a single-step trace
    const actor = createActor(qgsdWorkflowMachine);
    actor.start();
    actor.send(xstateEvent);
    const snapshot = actor.getSnapshot();
    actor.stop();

    const expected = expectedState(event);
    if (expected === null || snapshot.matches(expected)) {
      valid++;
    } else {
      divergences.push({
        event,
        actual:   snapshot.value,
        expected,
        reason:   'state_mismatch',
        ...scoreboardMeta,
        confidence,
      });
    }
  }

  const total = lines.length;
  const score = ((valid / total) * 100).toFixed(1);

  process.stdout.write('[validate-traces] Deviation score: ' + score + '% valid (' + valid + '/' + total + ' traces)\n');

  if (divergences.length > 0) {
    process.stdout.write('[validate-traces] ' + divergences.length + ' divergence(s) found:\n');
    for (const d of divergences) {
      process.stdout.write('  ' + JSON.stringify(d) + '\n');
    }
    try { writeCheckResult({ tool: 'validate-traces', formalism: 'trace', result: 'fail', metadata: { divergences: divergences.length, total } }); } catch (e) { process.stderr.write('[validate-traces] Warning: failed to write check result: ' + e.message + '\n'); }
    process.exit(1);
  }

  try { writeCheckResult({ tool: 'validate-traces', formalism: 'trace', result: 'pass', metadata: { valid, total } }); } catch (e) { process.stderr.write('[validate-traces] Warning: failed to write check result: ' + e.message + '\n'); }
  process.exit(0);
}

if (typeof module !== 'undefined') {
  module.exports = { computeConfidenceTier, CONFIDENCE_THRESHOLDS, validateMCPMetadata };
}
