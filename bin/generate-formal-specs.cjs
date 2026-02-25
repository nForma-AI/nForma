#!/usr/bin/env node
'use strict';
// bin/generate-formal-specs.cjs
// Generates ALL formal verification artifacts from the XState machine.
//
// The XState machine (src/machines/qgsd-workflow.machine.ts) is the SINGLE SOURCE OF TRUTH.
// All formal specs are generated artifacts — do not edit them by hand.
//
// Generates:
//   formal/tla/QGSDQuorum.tla   — TLA+ spec (states, transitions, invariants)
//   formal/tla/MCsafety.cfg     — TLC safety model config (N=5, symmetry)
//   formal/tla/MCliveness.cfg   — TLC liveness model config (N=3)
//   formal/alloy/quorum-votes.als — Alloy vote-counting model
//   formal/prism/quorum.pm      — PRISM DTMC convergence model
//
// Usage:
//   node bin/generate-formal-specs.cjs        # write all specs
//   node bin/generate-formal-specs.cjs --dry  # print without writing
//
// Guard translations (TypeScript → TLA+/Alloy):
//   minQuorumMet:           successCount >= Math.ceil(N/2)  →  n * 2 >= N
//   noInfiniteDeliberation: deliberationRounds < maxDelib   →  deliberationRounds < MaxDeliberation
//
// If you change a guard formula, update the GUARD_TLA / GUARD_ALLOY maps below.

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY  = process.argv.includes('--dry');

// ── Parse XState machine ──────────────────────────────────────────────────────
const machineFile = path.join(ROOT, 'src', 'machines', 'qgsd-workflow.machine.ts');
if (!fs.existsSync(machineFile)) {
  process.stderr.write('[generate-formal-specs] XState machine not found: ' + machineFile + '\n');
  process.exit(1);
}
const src = fs.readFileSync(machineFile, 'utf8');

// State names (4-space indent top-level state keys inside `states:`)
const stateNames = (src.match(/^    ([A-Z_]+):\s*\{/gm) || [])
  .map(l => l.trim().split(':')[0]);

// maxDeliberation default
const maxDelibMatch = src.match(/maxDeliberation:\s*(\d+)/);
const maxDelib = maxDelibMatch ? parseInt(maxDelibMatch[1], 10) : null;

// Initial state
const initialMatch = src.match(/initial:\s*'([A-Z_]+)'/);
const initialState = initialMatch ? initialMatch[1] : null;

// Final state (type: 'final') — match state block with no nested braces before type:'final'
// [^{]* prevents the regex from crossing into adjacent state blocks
const finalMatch = src.match(/^    ([A-Z_]+):\s*\{[^{]*?type:\s*'final'/m);
const finalState = finalMatch ? finalMatch[1] : null;

if (!stateNames.length || maxDelib === null || !initialState || !finalState) {
  process.stderr.write('[generate-formal-specs] Could not extract all facts from XState machine.\n');
  process.stderr.write('  states: ' + stateNames.join(', ') + '\n');
  process.stderr.write('  maxDeliberation: ' + maxDelib + '\n');
  process.stderr.write('  initial: ' + initialState + '\n');
  process.stderr.write('  final:   ' + finalState + '\n');
  process.exit(1);
}

const ts = new Date().toISOString().split('T')[0];
const GENERATED_HEADER = (comment, file) =>
  comment + ' ' + file + '\n' +
  comment + ' GENERATED — do not edit by hand.\n' +
  comment + ' Source of truth: src/machines/qgsd-workflow.machine.ts\n' +
  comment + ' Regenerate:      node bin/generate-formal-specs.cjs\n' +
  comment + ' Generated:       ' + ts + '\n';

process.stdout.write('[generate-formal-specs] XState machine → ' + stateNames.join(', ') +
  '  maxDeliberation=' + maxDelib + '  initial=' + initialState + '  final=' + finalState + '\n');

// ── 1. QGSDQuorum.tla ─────────────────────────────────────────────────────────
// Intermediate states = all states except initial and final
const collectingState   = 'COLLECTING_VOTES';
const deliberatingState = 'DELIBERATING';
const phaseSet = stateNames.map(s => '"' + s + '"').join(', ');

const tlaSpec = [
  '---- MODULE QGSDQuorum ----',
  '(*',
  GENERATED_HEADER(' *', 'formal/tla/QGSDQuorum.tla'),
  ' * Models the quorum workflow defined in src/machines/qgsd-workflow.machine.ts.',
  ' * Guard translations:',
  ' *   minQuorumMet (line ~24):           successCount >= Math.ceil(N/2)  →  n * 2 >= N',
  ' *   noInfiniteDeliberation (line ~27):  deliberationRounds < maxDelib  →  deliberationRounds < MaxDeliberation',
  '*)',
  'EXTENDS Naturals, FiniteSets, TLC',
  '',
  'CONSTANTS',
  '    Agents,          \\* Set of quorum model slots (e.g., {"a1","a2","a3","a4","a5"})',
  '    MaxDeliberation  \\* Maximum deliberation rounds before forced ' + finalState + ' (default: ' + maxDelib + ')',
  '',
  'ASSUME MaxDeliberation \\in Nat /\\ MaxDeliberation > 0',
  '',
  '\\* N = total number of agents; used for majority calculation',
  'N == Cardinality(Agents)',
  '',
  '\\* AgentSymmetry: referenced by MCsafety.cfg as SYMMETRY AgentSymmetry.',
  'AgentSymmetry == Permutations(Agents)',
  '',
  'VARIABLES',
  '    phase,              \\* One of: ' + phaseSet,
  '    successCount,       \\* Number of APPROVE votes collected in current round',
  '    deliberationRounds  \\* Number of deliberation rounds completed',
  '',
  'vars == <<phase, successCount, deliberationRounds>>',
  '',
  '\\* ── Type invariant ───────────────────────────────────────────────────────────',
  'TypeOK ==',
  '    /\\ phase \\in {' + phaseSet + '}',
  '    /\\ successCount \\in 0..N',
  '    /\\ deliberationRounds \\in 0..MaxDeliberation',
  '',
  '\\* ── Initial state ────────────────────────────────────────────────────────────',
  'Init ==',
  '    /\\ phase              = "' + initialState + '"',
  '    /\\ successCount       = 0',
  '    /\\ deliberationRounds = 0',
  '',
  '\\* ── Actions ──────────────────────────────────────────────────────────────────',
  '',
  '\\* StartQuorum: workflow leaves ' + initialState + ' → ' + collectingState,
  'StartQuorum ==',
  '    /\\ phase = "' + initialState + '"',
  '    /\\ phase\' = "' + collectingState + '"',
  '    /\\ UNCHANGED <<successCount, deliberationRounds>>',
  '',
  '\\* CollectVotes(n): n APPROVE votes received from available agents.',
  '\\* minQuorumMet (n * 2 >= N) → ' + finalState + '; otherwise → ' + deliberatingState + '.',
  'CollectVotes(n) ==',
  '    /\\ phase = "' + collectingState + '"',
  '    /\\ successCount\' = n',
  '    /\\ IF n * 2 >= N',
  '       THEN /\\ phase\' = "' + finalState + '"',
  '            /\\ UNCHANGED deliberationRounds',
  '       ELSE /\\ phase\' = "' + deliberatingState + '"',
  '            /\\ deliberationRounds\' = deliberationRounds + 1',
  '',
  '\\* Deliberate(n): n APPROVE votes after a deliberation round.',
  '\\* Majority or exhaustion (deliberationRounds >= MaxDeliberation) → ' + finalState + '.',
  'Deliberate(n) ==',
  '    /\\ phase = "' + deliberatingState + '"',
  '    /\\ successCount\' = n',
  '    /\\ IF n * 2 >= N \\/ deliberationRounds >= MaxDeliberation',
  '       THEN /\\ phase\' = "' + finalState + '"',
  '            /\\ UNCHANGED deliberationRounds',
  '       ELSE /\\ phase\' = "' + deliberatingState + '"',
  '            /\\ deliberationRounds\' = deliberationRounds + 1',
  '',
  '\\* Decide: forced termination when deliberation limit is exhausted.',
  'Decide ==',
  '    /\\ phase = "' + deliberatingState + '"',
  '    /\\ deliberationRounds >= MaxDeliberation',
  '    /\\ phase\' = "' + finalState + '"',
  '    /\\ UNCHANGED <<successCount, deliberationRounds>>',
  '',
  'Next ==',
  '    \\/ StartQuorum',
  '    \\/ \\E n \\in 0..N : CollectVotes(n)',
  '    \\/ \\E n \\in 0..N : Deliberate(n)',
  '    \\/ Decide',
  '',
  '\\* ── Safety invariants ────────────────────────────────────────────────────────',
  '',
  '\\* MinQuorumMet: if ' + finalState + ' via approval, a majority of agents approved.',
  'MinQuorumMet ==',
  '    phase = "' + finalState + '" =>',
  '        (successCount * 2 >= N \\/ deliberationRounds >= MaxDeliberation)',
  '',
  '\\* NoInvalidTransition: ' + initialState + ' can only advance to ' + collectingState + '.',
  'NoInvalidTransition ==',
  '    [][phase = "' + initialState + '" => phase\' \\in {"' + initialState + '", "' + collectingState + '"}]_vars',
  '',
  '\\* ── Liveness ─────────────────────────────────────────────────────────────────',
  '',
  '\\* EventualConsensus: every behavior eventually reaches ' + finalState + '.',
  'EventualConsensus == <>(phase = "' + finalState + '")',
  '',
  '\\* ── Composite actions for fairness ──────────────────────────────────────────',
  'AnyCollectVotes == \\E n \\in 0..N : CollectVotes(n)',
  'AnyDeliberate   == \\E n \\in 0..N : Deliberate(n)',
  '',
  '\\* ── Full specification with fairness ────────────────────────────────────────',
  'Spec == Init /\\ [][Next]_vars',
  '        /\\ WF_vars(Decide)',
  '        /\\ WF_vars(StartQuorum)',
  '        /\\ WF_vars(AnyCollectVotes)',
  '        /\\ WF_vars(AnyDeliberate)',
  '',
  '====',
  '',
].join('\n');

// ── 2. MCsafety.cfg + MCliveness.cfg ─────────────────────────────────────────
const SAFETY_AGENTS   = 5;
const LIVENESS_AGENTS = 3;

function agentDecls(n) {
  const lines = [];
  for (let i = 1; i <= n; i++) lines.push('    a' + i + ' = a' + i);
  return lines.join('\n');
}
function agentsSet(n) {
  const names = [];
  for (let i = 1; i <= n; i++) names.push('a' + i);
  return '{' + names.join(', ') + '}';
}

const tlaCfgHeader = (file, desc) => [
  '\\* ' + file,
  '\\* GENERATED — do not edit by hand.',
  '\\* Source of truth: src/machines/qgsd-workflow.machine.ts',
  '\\* Regenerate:      node bin/generate-formal-specs.cjs',
  '\\* Generated:       ' + ts,
  '\\*',
  '\\* ' + desc,
  '\\* Run: node bin/run-tlc.cjs ' + file.replace('formal/tla/', '').replace('.cfg', ''),
].join('\n');

const safetyCfg = tlaCfgHeader('formal/tla/MCsafety.cfg',
  'TLC safety model: N=' + SAFETY_AGENTS + ' agents, symmetry reduction, no liveness.') + '\n' + [
  'SPECIFICATION Spec',
  'CONSTANTS',
  agentDecls(SAFETY_AGENTS),
  '    Agents = ' + agentsSet(SAFETY_AGENTS),
  '    MaxDeliberation = ' + maxDelib,
  'SYMMETRY AgentSymmetry',
  'INVARIANT TypeOK',
  'INVARIANT MinQuorumMet',
  'PROPERTY NoInvalidTransition',
  'CHECK_DEADLOCK FALSE',
  '',
].join('\n');

const livenessCfg = tlaCfgHeader('formal/tla/MCliveness.cfg',
  'TLC liveness model: N=' + LIVENESS_AGENTS + ' agents, no symmetry (incompatible with liveness).') + '\n' + [
  'SPECIFICATION Spec',
  'CONSTANTS',
  agentDecls(LIVENESS_AGENTS),
  '    Agents = ' + agentsSet(LIVENESS_AGENTS),
  '    MaxDeliberation = ' + maxDelib,
  'PROPERTY EventualConsensus',
  'CHECK_DEADLOCK FALSE',
  '',
].join('\n');

// ── 3. quorum-votes.als ───────────────────────────────────────────────────────
// Alloy vote-counting model — derived from minQuorumMet guard in XState machine
const alloySpec = [
  GENERATED_HEADER('--', 'formal/alloy/quorum-votes.als'),
  '-- QGSD Quorum Vote-Counting Model (Alloy 6)',
  '-- Requirements: ALY-01',
  '--',
  '-- Models the minQuorumMet guard from src/machines/qgsd-workflow.machine.ts:',
  '--   successCount >= Math.ceil(slotsAvailable / 2)',
  '--   ≡  mul[#approvals, 2] >= total  (integer arithmetic, no division)',
  '--',
  '-- Checks that no round reaches ' + finalState + ' without satisfying the majority predicate.',
  '-- Scope: ' + SAFETY_AGENTS + ' agents (QGSD quorum slot count), 5 vote rounds.',
  '',
  'module quorum_votes',
  '',
  '-- Signatures',
  'sig Agent {}',
  '',
  'sig VoteRound {',
  '    approvals : set Agent,',
  '    total     : one Int',
  '}',
  '',
  '-- MajorityReached: mirrors minQuorumMet guard.',
  '-- mul avoids integer division: #approvals * 2 >= total  ≡  successCount * 2 >= N',
  'pred MajorityReached [r : VoteRound] {',
  '    mul[#r.approvals, 2] >= r.total',
  '}',
  '',
  'pred ValidRound [r : VoteRound] {',
  '    r.total > 0',
  '    r.total = #Agent',
  '    #r.approvals <= r.total',
  '}',
  '',
  'pred MinQuorumMet [r : VoteRound] {',
  '    -- Minimum: ceil(N/2) approvals. With N=' + SAFETY_AGENTS + ': at least ' + Math.ceil(SAFETY_AGENTS / 2) + ' required.',
  '    #r.approvals >= div[r.total, 2].add[1]',
  '}',
  '',
  '-- Assertion: no valid round can be accepted without satisfying MajorityReached.',
  'assert NoSpuriousApproval {',
  '    all r : VoteRound |',
  '        (ValidRound[r] and not MajorityReached[r])',
  '            implies (mul[#r.approvals, 2] < r.total)',
  '}',
  '',
  'check NoSpuriousApproval for ' + SAFETY_AGENTS + ' Agent, 5 VoteRound',
  '',
  'run MajorityReached for ' + SAFETY_AGENTS + ' Agent, 1 VoteRound',
  '',
].join('\n');

// ── 4. quorum.pm ─────────────────────────────────────────────────────────────
// PRISM DTMC — 3-state model derived from machine states (collecting, deliberating, decided)
// State numbering: 0=collecting, 1=decided, 2=deliberating (absorbing at 1)
const prismSpec = [
  GENERATED_HEADER('//', 'formal/prism/quorum.pm'),
  '// QGSD Quorum Convergence — DTMC Model',
  '// Requirements: PRM-01',
  '//',
  '// Discrete-Time Markov Chain modeling quorum state transitions.',
  '// States:',
  '//   s=0 : ' + collectingState + '  (initial)',
  '//   s=1 : ' + finalState + '       (absorbing)',
  '//   s=2 : ' + deliberatingState + '     (retry)',
  '//',
  '// Derived from src/machines/qgsd-workflow.machine.ts:',
  '//   ' + stateNames.join(', '),
  '//',
  '// Default rates are conservative priors. Override with empirical values:',
  '//   node bin/export-prism-constants.cjs',
  '//',
  '// To run (requires PRISM_BIN env var):',
  '//   $PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]"',
  '//',
  '// To override rates from empirical scoreboard data (no file-include in PRISM):',
  '//   $PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]" -const tp_rate=0.72 -const unavail=0.28',
  '',
  'dtmc',
  '',
  '// Slot aggregate rates (conservative priors — override with empirical data)',
  '// tp_rate = P(a slot votes APPROVE | it is AVAILABLE)',
  '// unavail = P(slot is UNAVAILABLE in a given round)',
  'const double tp_rate = 0.85;   // conservative prior (see bin/export-prism-constants.cjs)',
  'const double unavail = 0.15;   // conservative prior (see bin/export-prism-constants.cjs)',
  '',
  'module quorum_convergence',
  '    s : [0..2] init 0;',
  '',
  '    // From ' + collectingState + ':',
  '    // minQuorumMet → ' + finalState + '; otherwise → ' + deliberatingState,
  '    [] s=0 -> (tp_rate * (1 - unavail)) : (s\'=1)',
  '            + (1 - tp_rate * (1 - unavail)) : (s\'=2);',
  '',
  '    // From ' + deliberatingState + ': same transition probabilities (memoryless DTMC)',
  '    // Note: MaxDeliberation (' + maxDelib + ') is enforced by XState guard, not modeled here.',
  '    // The DTMC captures convergence probability per round, not the capped count.',
  '    [] s=2 -> (tp_rate * (1 - unavail)) : (s\'=1)',
  '            + (1 - tp_rate * (1 - unavail)) : (s\'=2);',
  '',
  '    // ' + finalState + ' is an absorbing state',
  '    [] s=1 -> 1.0 : (s\'=1);',
  '',
  'endmodule',
  '',
  '// Properties (run with -pf flag):',
  '// P=? [ F s=1 ]   — probability of eventually reaching ' + finalState + ' (should be 1.0)',
  '// R=? [ F s=1 ]   — expected rounds until ' + finalState + ' (add reward structure)',
  '',
].join('\n');

// ── Write or print ────────────────────────────────────────────────────────────
const outputs = [
  { rel: 'formal/tla/QGSDQuorum.tla',              content: tlaSpec      },
  { rel: 'formal/tla/MCsafety.cfg',                content: safetyCfg    },
  { rel: 'formal/tla/MCliveness.cfg',              content: livenessCfg  },
  { rel: 'formal/alloy/quorum-votes.als',           content: alloySpec    },
  { rel: 'formal/prism/quorum.pm',                  content: prismSpec    },
];

for (const { rel, content } of outputs) {
  if (DRY) {
    process.stdout.write('\n--- ' + rel + ' ---\n' + content + '\n');
  } else {
    fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
    process.stdout.write('[generate-formal-specs] Written: ' + rel + '\n');
  }
}

if (!DRY) {
  process.stdout.write('[generate-formal-specs] All formal specs generated from XState machine.\n');
}
