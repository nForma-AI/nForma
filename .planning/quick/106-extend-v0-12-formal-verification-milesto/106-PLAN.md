---
phase: quick-106
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/ROADMAP.md
autonomous: true
requirements:
  - GAP-1
  - GAP-2
  - GAP-3
  - GAP-4
  - GAP-5
  - GAP-6
  - GAP-7
  - GAP-8
  - GAP-9

must_haves:
  truths:
    - "ROADMAP.md v0.12 section lists phases v0.12-01 through v0.12-08 (8 phases total)"
    - "v0.12-01, v0.12-02, v0.12-03 are marked [x] (complete) in the phase checklist"
    - "v0.12-04 through v0.12-08 appear as [ ] (not started) in the phase checklist"
    - "Each new phase has a Phase Details block with Goal, Depends on, Requirements, Success Criteria, and Plans sections"
    - "Milestone header and all other milestones are unchanged"
    - "The milestone summary line is updated to reflect 8 phases (v0.12-01..v0.12-08)"
    - "Progress table has rows for v0.12-04 through v0.12-08 (not started)"
  artifacts:
    - path: ".planning/ROADMAP.md"
      provides: "Extended v0.12 milestone with 5 new phases"
      contains: "Phase v0.12-08"
  key_links:
    - from: "v0.12-04"
      to: "v0.12-03"
      via: "depends_on chain"
      pattern: "Depends on.*v0.12-03"
    - from: "v0.12-05"
      to: "v0.12-04"
      via: "depends_on chain"
      pattern: "Depends on.*v0.12-04"
    - from: "v0.12-06"
      to: "v0.12-03"
      via: "depends_on chain"
      pattern: "Depends on.*v0.12-03"
    - from: "v0.12-07"
      to: "v0.12-06"
      via: "depends_on chain"
      pattern: "Depends on.*v0.12-06"
    - from: "v0.12-08"
      to: "v0.12-07"
      via: "depends_on chain"
      pattern: "Depends on.*v0.12-07"

quorum:
  result: "self-quorum only"
  claude: "APPROVE"
  codex: "UNAVAILABLE"
  gemini: "UNAVAILABLE"
  opencode: "UNAVAILABLE"
  copilot: "UNAVAILABLE"
  note: "All external quorum models unavailable — R6.2 degraded state. Proceeding with self-quorum."
---

<objective>
Extend the v0.12 Formal Verification milestone in ROADMAP.md with 5 new phases (v0.12-04 through v0.12-08) that cover all 9 formal verification gaps identified for QGSD. Also mark v0.12-01, v0.12-02, and v0.12-03 as completed, reflecting the actual state confirmed in STATE.md.

Purpose: The v0.12 milestone currently covers 3 phases (schema + TLA+ quorum spec + static analysis suite). Nine verification gaps remain unaddressed by those phases. These 5 new phases formally verify the circuit breaker algorithm, protocol termination bounds, scoreboard audit trail, hook transcript scanning logic, and installer/taxonomy safety — extending the formal verification surface to cover the full QGSD operational envelope.

Output: Updated ROADMAP.md with 8 total v0.12 phases, 3 marked complete, 5 planned and not started.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Mark v0.12-01/02/03 complete and append 5 new phases to ROADMAP.md</name>
  <files>.planning/ROADMAP.md</files>
  <action>
Read ROADMAP.md in full before editing. Make two sets of changes:

**Change set A — Mark existing phases complete:**
In the v0.12 phase checklist (the bullet list under `### 🚧 v0.12`), change:
- `- [ ] **Phase v0.12-01:` → `- [x] **Phase v0.12-01:`
- `- [ ] **Phase v0.12-02:` → `- [x] **Phase v0.12-02:`
- `- [ ] **Phase v0.12-03:` → `- [x] **Phase v0.12-03:`

Also update the milestone summary line from:
`🚧 **v0.12 — Formal Verification** — Phases v0.12-01..v0.12-03 (in progress)`
to:
`🚧 **v0.12 — Formal Verification** — Phases v0.12-01..v0.12-08 (in progress)`

**Change set B — Append 5 new phase bullets to the v0.12 checklist:**
After the v0.12-03 bullet, append:
```
- [ ] **Phase v0.12-04: Circuit Breaker Algorithm Verification** — TLA+ models for run-collapse oscillation detection algorithm and circuit breaker state persistence + Haiku convergence (GAP-1, GAP-5)
- [ ] **Phase v0.12-05: Protocol Termination Proofs** — TLA+ bounded termination specs for R3 deliberation loop (max 10 rounds + 10 improvement iterations) and R4 pre-filter protocol (max 3 rounds) (GAP-2, GAP-6)
- [ ] **Phase v0.12-06: Audit Trail Invariants** — Alloy models for scoreboard recomputation idempotency/no-vote-loss/no-double-counting and availability hint date arithmetic (GAP-3, GAP-9)
- [ ] **Phase v0.12-07: Hook Transcript Verification** — Alloy model for qgsd-stop.js transcript scanning: boundary detection, tool_use/tool_result pairing uniqueness, ceiling enforcement (GAP-4)
- [ ] **Phase v0.12-08: Installer and Taxonomy Extensions** — Alloy extension to install-scope.als (rollback soundness, config sync completeness) and new taxonomy-safety.als (injection prevention, closed/open taxonomy consistency) (GAP-7, GAP-8)
```

**Change set C — Append 5 Phase Details blocks:**
After the `### Phase v0.12-03: Static Analysis Suite` details block (at the end of the Phase Details section, before `## Progress`), insert these 5 blocks:

```markdown
### Phase v0.12-04: Circuit Breaker Algorithm Verification
**Goal**: The run-collapse oscillation detection algorithm and circuit breaker state persistence are formally verified — oscillation is flagged correctly (iff ≥3 alternating groups with net-negative diff), the algorithm terminates, resolvedAt is write-once, and Haiku unavailability cannot corrupt persisted state
**Depends on**: Phase v0.12-03
**Requirements**: GAP-1, GAP-5
**Success Criteria** (what must be TRUE):
  1. `formal/tla/QGSDOscillation.tla` exists with state vars `commits`, `runs`, `flagCount`; invariant `OscillationFlaggedCorrectly` (flag iff ≥3 alternating groups with net-negative diff); liveness property `AlgorithmTerminates`
  2. TLC verifies `MCoscillation.cfg` with INVARIANT + PROPERTY — no violations
  3. `formal/tla/QGSDConvergence.tla` exists with `resolvedAt` write-once invariant; log-write-before-state-delete ordering; Haiku unavailability cannot corrupt state
  4. `bin/run-oscillation-tlc.cjs` exists, is gated on JAVA_HOME, and `npm test` passes without Java installed; 4 error-path tests in `bin/run-oscillation-tlc.test.cjs` are GREEN
**Plans**: TBD

Plans:
- [ ] v0.12-04-01-PLAN.md — Wave 0 RED stubs for run-oscillation-tlc.test.cjs (GAP-1, GAP-5)
- [ ] v0.12-04-02-PLAN.md — Author QGSDOscillation.tla + MCoscillation.cfg + QGSDConvergence.tla + MCconvergence.cfg (GAP-1, GAP-5)
- [ ] v0.12-04-03-PLAN.md — Implement bin/run-oscillation-tlc.cjs + GREEN tests (GAP-1, GAP-5)

### Phase v0.12-05: Protocol Termination Proofs
**Goal**: The R3 deliberation loop (max 10 rounds) and R3.6 improvement iteration loop (max 10 iterations) are provably bounded and eventually terminate; the R4 pre-filter protocol terminates within 3 rounds; regression handling and auto-resolution soundness are formally specified
**Depends on**: Phase v0.12-04
**Requirements**: GAP-2, GAP-6
**Success Criteria** (what must be TRUE):
  1. `formal/tla/QGSDDeliberation.tla` exists with vars `deliberationRound`, `improvementIteration`, `voteState`; invariant `TotalRoundsBounded` (deliberationRound + improvementIteration ≤ 20); liveness `ProtocolTerminates` (<>(phase = "ESCALATED" \/ phase = "CONSENSUS")); regression rule: APPROVE→BLOCK transition treated as new blocker
  2. TLC verifies `MCdeliberation.cfg` — no violations
  3. `formal/tla/QGSDPreFilter.tla` exists with invariant `AutoResolutionSound` (auto-resolved iff all models agree + same answer) and liveness `PreFilterTerminates` (≤3 rounds)
  4. `bin/run-protocol-tlc.cjs` exists, gated on JAVA_HOME; `npm test` passes without Java; `bin/run-protocol-tlc.test.cjs` has error-path tests GREEN
**Plans**: TBD

Plans:
- [ ] v0.12-05-01-PLAN.md — Wave 0 RED stubs for run-protocol-tlc.test.cjs (GAP-2, GAP-6)
- [ ] v0.12-05-02-PLAN.md — Author QGSDDeliberation.tla + MCdeliberation.cfg + QGSDPreFilter.tla + MCprefilter.cfg (GAP-2, GAP-6)
- [ ] v0.12-05-03-PLAN.md — Implement bin/run-protocol-tlc.cjs + GREEN tests (GAP-2, GAP-6)

### Phase v0.12-06: Audit Trail Invariants
**Goal**: The scoreboard recomputation function is formally verified as idempotent with no vote loss and no double counting; the availability hint date arithmetic handles year rollover and returns null on unrecognized format
**Depends on**: Phase v0.12-03
**Requirements**: GAP-3, GAP-9
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/scoreboard-recompute.als` exists with assertions `RecomputeIdempotent` (applying recompute twice = once), `NoVoteLoss` (every vote in rounds appears in final score), `NoDoubleCounting` (no vote counted twice); uses Alloy integer arithmetic for delta accumulation
  2. `formal/alloy/availability-parsing.als` exists with assertions `ParseCorrect` (parsed timestamp ≥ now), `YearRolloverHandled` (Dec→Jan crossing), `FallbackIsNull` (unrecognized format → null, not crash)
  3. `bin/run-audit-alloy.cjs` targets both .als files, is gated on JAVA_HOME; `npm test` passes without Java; `bin/run-audit-alloy.test.cjs` has error-path tests GREEN
**Plans**: TBD

Plans:
- [ ] v0.12-06-01-PLAN.md — Wave 0 RED stubs for run-audit-alloy.test.cjs (GAP-3, GAP-9)
- [ ] v0.12-06-02-PLAN.md — Author scoreboard-recompute.als + availability-parsing.als (GAP-3, GAP-9)
- [ ] v0.12-06-03-PLAN.md — Implement bin/run-audit-alloy.cjs + GREEN tests (GAP-3, GAP-9)

### Phase v0.12-07: Hook Transcript Verification
**Goal**: The qgsd-stop.js transcript scanning algorithm is formally verified — the last human message boundary is correctly identified, every tool_use_id matches at most one tool_result, no tool_result is double-counted, and successCount never exceeds minSize
**Depends on**: Phase v0.12-06
**Requirements**: GAP-4
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/transcript-scan.als` exists with sigs `Entry`, `ToolUse extends Entry`, `ToolResult extends Entry`, `HumanMessage extends Entry` modeling JSONL transcript as ordered sequence; predicates `BoundaryCorrect`, `PairingUnique`, `NoDuplicateCounting`, `CeilingEnforced`
  2. All 4 predicates are asserted as checks — Alloy Analyzer finds no counterexamples
  3. `bin/run-transcript-alloy.cjs` exists, gated on JAVA_HOME; `npm test` passes without Java; `bin/run-transcript-alloy.test.cjs` has error-path tests GREEN
**Plans**: TBD

Plans:
- [ ] v0.12-07-01-PLAN.md — Wave 0 RED stubs for run-transcript-alloy.test.cjs (GAP-4)
- [ ] v0.12-07-02-PLAN.md — Author formal/alloy/transcript-scan.als (GAP-4)
- [ ] v0.12-07-03-PLAN.md — Implement bin/run-transcript-alloy.cjs + GREEN tests (GAP-4)

### Phase v0.12-08: Installer and Taxonomy Extensions
**Goal**: The install.js rollback is formally verified as sound (uninstall restores previous state) and config sync is verified complete (hooks/dist/ and ~/.claude/hooks/ in sync after install); the Haiku classification taxonomy is verified injection-safe and maintains closed/open category consistency
**Depends on**: Phase v0.12-07
**Requirements**: GAP-7, GAP-8
**Success Criteria** (what must be TRUE):
  1. `formal/alloy/install-scope.als` is extended with pred `RollbackSound` (uninstall restores previous state) and pred `ConfigSyncComplete` (after install, hooks/dist/ and ~/.claude/hooks/ are identical)
  2. `formal/alloy/taxonomy-safety.als` exists with sigs `TaskDescription`, `Category`, `Subcategory`; asserts `NoInjection` (taskDescription content cannot alter category structure), `TaxonomyClosed` (is_new=false implies category already in sig), `NewCategoryConsistent` (is_new=true implies category not previously in sig)
  3. `bin/run-installer-alloy.cjs` exists, targets both install-scope.als and taxonomy-safety.als, is gated on JAVA_HOME; `npm test` passes without Java; `bin/run-installer-alloy.test.cjs` has error-path tests GREEN
**Plans**: TBD

Plans:
- [ ] v0.12-08-01-PLAN.md — Wave 0 RED stubs for run-installer-alloy.test.cjs (GAP-7, GAP-8)
- [ ] v0.12-08-02-PLAN.md — Extend install-scope.als + author taxonomy-safety.als (GAP-7, GAP-8)
- [ ] v0.12-08-03-PLAN.md — Implement bin/run-installer-alloy.cjs + GREEN tests (GAP-7, GAP-8)
```

**Change set D — Append Progress table rows:**
In the `## Progress` table, after the `v0.12-03` row, append:
```
| v0.12-04. Circuit Breaker Algorithm Verification | v0.12 | 0/3 | Not started | - |
| v0.12-05. Protocol Termination Proofs | v0.12 | 0/3 | Not started | - |
| v0.12-06. Audit Trail Invariants | v0.12 | 0/3 | Not started | - |
| v0.12-07. Hook Transcript Verification | v0.12 | 0/3 | Not started | - |
| v0.12-08. Installer and Taxonomy Extensions | v0.12 | 0/3 | Not started | - |
```

Also update the existing v0.12 progress rows to mark them complete:
- `v0.12-01` row: change `0/3 | Not started` to `3/3 | Complete | 2026-02-25`
- `v0.12-02` row: change `0/? | Not started` to `3/3 | Complete | 2026-02-25`
- `v0.12-03` row: change `0/4 | Not started` to `4/4 | Complete | 2026-02-25`
  </action>
  <verify>
Run: grep -c "v0.12-0[4-8]" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
Expected: at least 10 matches (each phase appears multiple times).

Run: grep "\[x\].*v0.12-0[123]" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
Expected: 3 lines (one per completed phase).

Run: grep "v0.12-01..v0.12-08" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
Expected: 1 line (milestone header updated).

Run: grep "Phase v0.12-08" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
Expected: at least 2 matches (checklist entry + Phase Details header).
  </verify>
  <done>
ROADMAP.md has 8 v0.12 phases total. v0.12-01/02/03 are marked [x] in the checklist. v0.12-04 through v0.12-08 are listed as [ ] with detailed Phase Details blocks. The milestone summary line references v0.12-01..v0.12-08. The Progress table has rows for all 8 phases with correct completion status. No other milestones or phases are changed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit ROADMAP.md update</name>
  <files>.planning/ROADMAP.md</files>
  <action>
Stage and commit ROADMAP.md using node gsd-tools.cjs commit:

```bash
node /Users/jonathanborduas/code/QGSD/bin/gsd-tools.cjs commit "docs(v0.12): extend milestone with phases v0.12-04 through v0.12-08 covering all 9 formal verification gaps" --files .planning/ROADMAP.md
```

If gsd-tools commit fails, use git directly:
```bash
cd /Users/jonathanborduas/code/QGSD && git add .planning/ROADMAP.md && git commit -m "docs(v0.12): extend milestone with phases v0.12-04 through v0.12-08 covering all 9 formal verification gaps"
```
  </action>
  <verify>
Run: git -C /Users/jonathanborduas/code/QGSD log --oneline -1
Expected: commit message contains "v0.12" and "phases v0.12-04"
  </verify>
  <done>
ROADMAP.md changes are committed. git log shows the commit. Working tree is clean for ROADMAP.md.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `grep "Phase v0.12-08" .planning/ROADMAP.md` returns at least 2 lines
2. `grep "\[x\]" .planning/ROADMAP.md | grep "v0.12-0[123]"` returns 3 lines
3. `grep "v0.12-01..v0.12-08" .planning/ROADMAP.md` returns 1 line
4. `git log --oneline -1` shows the v0.12 extension commit
5. No other milestone sections changed (grep for "v0.9\|v0.10\|v0.11" to confirm their [x]/[ ] status is unchanged)
</verification>

<success_criteria>
ROADMAP.md contains 8 v0.12 phases (v0.12-01 through v0.12-08). The 3 existing phases are marked complete. The 5 new phases (v0.12-04 through v0.12-08) are fully specified with Goal, Depends on, Requirements, Success Criteria, and Plans sections. All 9 formal verification gaps (GAP-1 through GAP-9) are assigned to at least one phase. Changes are committed to git.
</success_criteria>

<output>
After completion, create `.planning/quick/106-extend-v0-12-formal-verification-milesto/106-SUMMARY.md` with:
- What was done (ROADMAP extended with 5 phases)
- Gaps covered (GAP-1 through GAP-9 mapped to phases)
- Quorum result (self-quorum only, all external models unavailable)
- Commit hash
- Status: Verified
</output>
