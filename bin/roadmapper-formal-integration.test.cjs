#!/usr/bin/env node
'use strict';
// bin/roadmapper-formal-integration.test.cjs
// TDD tests for v0.23-03: roadmapper formal integration
// STRUCTURAL tests are RED until Plan 02 updates source files and Plan 03 installs them.
// UNIT tests are GREEN from the start (pure functions, no I/O).
// Requirements: WFI-05, ENF-03

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ----- UNIT TESTS (GREEN from the start — pure functions, no I/O) -----

// Inline the standard keyword-match algorithm as JS.
// Mirrors the bash bidirectional algorithm from plan-phase.md Step 4.5
// (canonical version): split desc on ' -/', check module contains keyword OR keyword contains module.
function matchKeyword(descLower, moduleLower) {
  if (!descLower || !moduleLower) return false;
  const keywords = descLower.split(/[ \-\/]/).filter(k => k.length > 0);
  return keywords.some(kw => moduleLower.includes(kw) || kw.includes(moduleLower));
}

test('matchKeyword: module in keyword desc — returns true (quorum gate / quorum)', () => {
  assert.strictEqual(matchKeyword('quorum gate', 'quorum'), true);
});

test('matchKeyword: hyphenated module — tui-nav matched by tui navigation keyword tokens', () => {
  // 'tui navigation' splits to ['tui', 'navigation']
  // 'navigation'.includes('tui-nav') → false; 'tui-nav'.includes('navigation') → false
  // 'tui'.includes('tui-nav') → false; 'tui-nav'.includes('tui') → true
  assert.strictEqual(matchKeyword('tui navigation', 'tui-nav'), true);
});

test('matchKeyword: no match — quorum gate vs breaker returns false', () => {
  assert.strictEqual(matchKeyword('quorum gate', 'breaker'), false);
});

test('matchKeyword: slash separator — tui/navigation design / navigation returns true', () => {
  // Slash splits: ['tui', 'navigation', 'design']
  // 'navigation'.includes('navigation') → true
  assert.strictEqual(matchKeyword('tui/navigation design', 'navigation'), true);
});

test('matchKeyword: empty desc — returns false', () => {
  assert.strictEqual(matchKeyword('', 'quorum'), false);
});

test('matchKeyword: empty module — returns false', () => {
  assert.strictEqual(matchKeyword('quorum', ''), false);
});

// Fail-open: FORMAL_SPEC_CONTEXT behavior with empty and missing inputs
test('fail-open: empty FORMAL_SPEC_CONTEXT array produces 0 matches (no error)', () => {
  const FORMAL_SPEC_CONTEXT = [];
  // Simulate: if FORMAL_SPEC_CONTEXT is empty, skip scan and produce 0 matches
  const matchCount = FORMAL_SPEC_CONTEXT.length;
  assert.strictEqual(matchCount, 0);
  // No error thrown — roadmapper proceeds normally
});

test('fail-open: missing formal/spec/ directory → FORMAL_SPEC_CONTEXT stays empty array', () => {
  // Simulated: if dir absent, the guard `if [ -d "formal/spec" ]` is false → FORMAL_SPEC_CONTEXT=()
  const formalSpecPath = '/tmp/__nonexistent_formal_spec_dir__';
  const dirExists = fs.existsSync(formalSpecPath);
  assert.strictEqual(dirExists, false);
  // Code path: dirExists false → FORMAL_SPEC_CONTEXT=[] (represented as empty array)
  const FORMAL_SPEC_CONTEXT = dirExists ? ['would-scan'] : [];
  assert.strictEqual(FORMAL_SPEC_CONTEXT.length, 0);
});

// ----- STRUCTURAL TESTS (RED until Plan 02 updates source + Plan 03 installs) -----
// These tests read source files from qgsd-core/ and agents/ (NOT installed ~/.claude/ copies).
// Implementation edits source; Plan 03 runs install.js to sync to ~/.claude/.

// ---- Test Group 1: gsd-tools.cjs goal regex fix (ISSUE-2) ----
// Plan 02 must replace **Goal:** (colon inside asterisks) with **Goal**: (colon outside).
// Three locations: lines 1027, 2612, 4370.

const GSD_TOOLS_PATH = path.resolve(__dirname, '../qgsd-core/bin/gsd-tools.cjs');
let gsdToolsContent = '';
try {
  gsdToolsContent = fs.readFileSync(GSD_TOOLS_PATH, 'utf8');
} catch (e) {
  gsdToolsContent = '';
}

test('gsd-tools.cjs: old broken regex **Goal:** is NOT present', () => {
  assert.ok(
    !gsdToolsContent.includes('**Goal:**'),
    'Old broken regex still present: "**Goal:**" found in qgsd-core/bin/gsd-tools.cjs — fix all 3 regex locations'
  );
});

test('gsd-tools.cjs: fixed regex **Goal**: appears at least 3 times (all 3 parser locations)', () => {
  const count = (gsdToolsContent.match(/\*\*Goal\*\*:/g) || []).length;
  assert.ok(
    count >= 3,
    `Expected >=3 occurrences of **Goal**: (fixed regex) in gsd-tools.cjs, got ${count}`
  );
});

// ---- Test Group 2: plan-phase.md Step 4.5 source field fix (ISSUE-1 part 1) ----
// Plan 02 must change .phase_name to .goal // .phase_name in Step 4.5 bash block.

const PLAN_PHASE_PATH = path.resolve(__dirname, '../qgsd-core/workflows/plan-phase.md');
let planPhaseContent = '';
try {
  planPhaseContent = fs.readFileSync(PLAN_PHASE_PATH, 'utf8');
} catch (e) {
  planPhaseContent = '';
}

test('plan-phase.md: Step 4.5 uses .goal // .phase_name (not bare .phase_name)', () => {
  assert.ok(
    planPhaseContent.includes('.goal // .phase_name'),
    'Pattern not found: expected ".goal // .phase_name" in qgsd-core/workflows/plan-phase.md Step 4.5 — fix source field'
  );
});

// ---- Test Group 3: execute-phase.md verify_phase_goal standardization (ISSUE-1 part 2) ----
// Plan 02 must fix: .goal // empty → .goal // .phase_name, add '/' to separator, add bidirectional match.

const EXECUTE_PHASE_PATH = path.resolve(__dirname, '../qgsd-core/workflows/execute-phase.md');
let executePhaseContent = '';
try {
  executePhaseContent = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');
} catch (e) {
  executePhaseContent = '';
}

test('execute-phase.md: verify_phase_goal uses .goal // .phase_name fallback (not .goal // empty)', () => {
  assert.ok(
    executePhaseContent.includes('.goal // .phase_name'),
    'Pattern not found: expected ".goal // .phase_name" in qgsd-core/workflows/execute-phase.md verify_phase_goal — fix field fallback'
  );
});

test("execute-phase.md: verify_phase_goal separator includes '/' (tr ' -/')", () => {
  assert.ok(
    executePhaseContent.includes("tr ' -/'"),
    "Pattern not found: expected \"tr ' -/'\" in qgsd-core/workflows/execute-phase.md — add slash to separator"
  );
});

test('execute-phase.md: verify_phase_goal uses bidirectional match (grep -qF "$KEYWORD" || echo "$KEYWORD" | grep -qF)', () => {
  // Bidirectional: MODULE.includes(KEYWORD) || KEYWORD.includes(MODULE)
  // In bash: grep -qF "$KEYWORD" || echo "$KEYWORD" | grep -qF
  assert.ok(
    executePhaseContent.includes('grep -qF "$KEYWORD" || echo "$KEYWORD" | grep -qF'),
    'Pattern not found: expected bidirectional match pattern in qgsd-core/workflows/execute-phase.md — add reverse match condition'
  );
});

// ---- Test Group 4: new-milestone.md formal scope scan block (WFI-05) ----
// Plan 02 must add Step 9.5 / inline Step 10 pre-roadmapper formal scan.

const NEW_MILESTONE_PATH = path.resolve(__dirname, '../qgsd-core/workflows/new-milestone.md');
let newMilestoneContent = '';
try {
  newMilestoneContent = fs.readFileSync(NEW_MILESTONE_PATH, 'utf8');
} catch (e) {
  newMilestoneContent = '';
}

test('new-milestone.md: contains formal/spec scan block (directory check exists)', () => {
  assert.ok(
    newMilestoneContent.includes('formal/spec'),
    'Pattern not found: expected "formal/spec" in qgsd-core/workflows/new-milestone.md — add formal scope scan step'
  );
});

test('new-milestone.md: builds FORMAL_SPEC_CONTEXT variable', () => {
  assert.ok(
    newMilestoneContent.includes('FORMAL_SPEC_CONTEXT'),
    'Pattern not found: expected "FORMAL_SPEC_CONTEXT" in qgsd-core/workflows/new-milestone.md — add context accumulator'
  );
});

test('new-milestone.md: references invariants.md (roadmapper injection includes invariant files)', () => {
  assert.ok(
    newMilestoneContent.includes('invariants.md'),
    'Pattern not found: expected "invariants.md" in qgsd-core/workflows/new-milestone.md — reference invariants file in injection block'
  );
});

// ---- Test Group 5: qgsd-roadmapper.md formal_context handling (WFI-05) ----
// Plan 02 must add formal_context handling section to roadmapper agent execution_flow.

const ROADMAPPER_PATH = path.resolve(__dirname, '../agents/qgsd-roadmapper.md');
let roadmapperContent = '';
try {
  roadmapperContent = fs.readFileSync(ROADMAPPER_PATH, 'utf8');
} catch (e) {
  roadmapperContent = '';
}

test('qgsd-roadmapper.md: contains formal_context section (agent knows to use formal context)', () => {
  assert.ok(
    roadmapperContent.includes('formal_context'),
    'Pattern not found: expected "formal_context" in agents/qgsd-roadmapper.md — add formal context handling to execution_flow'
  );
});

test('qgsd-roadmapper.md: references invariants (agent uses invariants for success criteria)', () => {
  assert.ok(
    roadmapperContent.includes('invariants'),
    'Pattern not found: expected "invariants" in agents/qgsd-roadmapper.md — agent must reference invariants when deriving criteria'
  );
});
