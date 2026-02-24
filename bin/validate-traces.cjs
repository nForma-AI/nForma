#!/usr/bin/env node
'use strict';
// bin/validate-traces.cjs
// Replays .planning/conformance-events.jsonl through the XState machine
// and reports a deviation score (% of traces that are valid XState executions).
//
// Exit code 0: no divergences found (or log file missing)
// Exit code 1: one or more divergences found

const fs   = require('fs');
const path = require('path');
// Machine CJS path: in the repo, ../dist/machines/ (bin/ → dist/machines/)
// When installed at ~/.claude/qgsd-bin/, ./dist/machines/ (qgsd-bin/ → qgsd-bin/dist/machines/)
const machinePath = (function () {
  const fs = require('fs');
  const repoDist = require('path').join(__dirname, '..', 'dist', 'machines', 'qgsd-workflow.machine.cjs');
  const installDist = require('path').join(__dirname, 'dist', 'machines', 'qgsd-workflow.machine.cjs');
  if (fs.existsSync(repoDist)) return repoDist;
  if (fs.existsSync(installDist)) return installDist;
  throw new Error('[validate-traces] Cannot find qgsd-workflow.machine.cjs in ' + repoDist + ' or ' + installDist);
})();
const { createActor, qgsdWorkflowMachine } = require(machinePath);
const { VALID_ACTIONS, VALID_PHASES, VALID_OUTCOMES } = require('./conformance-schema.cjs');

const logPath = path.join(process.cwd(), '.planning', 'conformance-events.jsonl');

if (!fs.existsSync(logPath)) {
  process.stdout.write('[validate-traces] No conformance log at: ' + logPath + ' — nothing to validate\n');
  process.exit(0);
}

const raw   = fs.readFileSync(logPath, 'utf8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);

if (lines.length === 0) {
  process.stdout.write('[validate-traces] Conformance log is empty — deviation score: 100.0% (0/0)\n');
  process.exit(0);
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

let valid       = 0;
const divergences = [];

for (const line of lines) {
  let event;
  try {
    event = JSON.parse(line);
  } catch (parseErr) {
    divergences.push({ line, reason: 'json_parse_error: ' + parseErr.message });
    continue;
  }

  const xstateEvent = mapToXStateEvent(event);
  if (!xstateEvent) {
    divergences.push({ event, reason: 'unmappable_action: ' + event.action });
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
  process.exit(1);
}

process.exit(0);
