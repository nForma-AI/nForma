---
phase: quick-126
plan: 01
type: execute
completed_date: 2026-03-01
completion_time_minutes: 8
tasks_completed: 3
commits: [5774b9fd, adbaed25, 51c8c08f]
---

# Quick Task 126: Enforce Spec Requirements — R9 Rule + Binding Prompts + Baseline Capture

## Summary

Added R9 binding rule to enforce that spec objectives are never weakened to match reality. Wired R9 into planner, plan checker, and verifier agent prompts. Implemented pre-verification baseline capture (Step 0) in verify-phase.md that reads ROADMAP success_criteria before loading PLAN must_haves, detecting objective drift at verification entry point.

## Objective Met

- R9 rule added to PROJECT.md with explicit weakening criteria (6 items)
- Planner prompt now has R9 binding_rule requiring truths derived from ROADMAP success_criteria
- Plan checker prompt now has R9 binding_rule flagging missing/weakened criteria as blockers
- Verifier now has Step 0 baseline_capture that reads ROADMAP success_criteria BEFORE PLAN must_haves
- Establish_must_haves step has binding_rule enforcing R9 immutability policy
- Determine_status includes r9_deviation status (WARNING-level, non-blocking)
- Schema validation guard halts on malformed ROADMAP success_criteria (parse error, non-array, empty strings)
- generate-phase-spec.cjs coverage documented in both PROJECT.md and verify-phase.md

## Tasks Completed

| # | Name | Status | Commit | Files |
|----|------|--------|--------|-------|
| 1 | Add R9 binding rule to PROJECT.md with explicit weakening criteria | VERIFIED | 5774b9fd | .planning/PROJECT.md |
| 2 | Add binding_rule blocks to planner and checker prompts in plan-phase.md | VERIFIED | adbaed25 | qgsd-core/workflows/plan-phase.md |
| 3 | Add Step 0 baseline capture and binding_rule to verify-phase.md | VERIFIED | 51c8c08f | qgsd-core/workflows/verify-phase.md |

## Deviations from Plan

None — plan executed exactly as written.

## Technical Details

### Task 1: R9 Binding Rule (PROJECT.md)

Added new "## Binding Rules" section (lines 354–378) between Constraints and Key Decisions.

**R9 Definition:**
- Principle: Spec structure tracks reality, objectives never weaken
- 6 explicit weakening criteria: thresholds, invariants, language, count, verdicts, scope
- 4 enforcement points: planner, plan checker, verifier, spec generation
- User approval required for objective relaxation

**Verification Results:**
- grep -c "R9": 6 ✓ (heading + enforcement points + references)
- grep -c "Weakening": 1 ✓
- grep -c "generate-phase-spec": 4 ✓
- grep -c "Binding Rules": 1 ✓
- Placement: Before "## Key Decisions" ✓

### Task 2: Plan-Phase Binding Rules (plan-phase.md)

Added two binding_rule blocks:

**A. Planner prompt (lines 255–264):**
- Requires truths derived from ROADMAP success_criteria
- Prohibits invention of weaker truths
- Requires count ≥ ROADMAP criteria count
- Forbids language softening and scope narrowing

**B. Checker prompt (lines 484–495):**
- Verifies PLAN truths cover ALL ROADMAP success_criteria
- Flags as BLOCKER when truths missing or weaker
- Checks count, language, scope alignment
- States objective relaxation never acceptable

**Verification Results:**
- grep -c "binding_rule": 4 ✓ (2 opening + 2 closing tags)
- grep -c "R9": 2 ✓ (one per binding_rule)
- Planner placement: between </planning_context> and <downstream_consumer> ✓
- Checker placement: inside <verification_context> ✓
- grep -c "BLOCKER": 1 ✓

### Task 3: Verify-Phase Baseline Capture (verify-phase.md)

Added three components:

**A. Step 0 baseline_capture (lines 27–74):**
- Reads ROADMAP success_criteria as immutable baseline BEFORE load_context
- Executes gsd-tools command to extract success_criteria
- Implements schema validation guard: halts on parse error, non-array, or empty strings
- Comparison logic: count check + matching check
- Deferred to "After loading PLAN must_haves" section

**B. binding_rule in establish_must_haves (lines 93–107):**
- Enforces ROADMAP criteria override PLAN-level must_haves
- Requires not reducing verification scope
- Flags weaker truths as R9 deviations (not blockers)
- Documents generate-phase-spec.cjs alignment requirement

**C. r9_deviation status in determine_status (lines 259–276):**
- WARNING-level (does not block execution)
- Produces `## R9 Baseline Comparison` section in VERIFICATION.md
- Three downstream resolution options for user
- Rationale: legitimate deviations (phase splitting) require visibility not blockage

**Verification Results:**
- grep -c "baseline_capture": 1 ✓
- grep -c "binding_rule": 2 ✓ (opening + closing tags)
- grep -c "R9": 15 ✓ (distributed throughout)
- grep -c "ROADMAP_CRITERIA": 3 ✓
- grep -c "success_criteria": 15 ✓
- grep -c "generate-phase-spec": 1 ✓
- baseline_capture before load_context: line 27 < 74 ✓
- grep -c "r9_deviation": 1 ✓
- grep -c "malformed": 2 ✓
- grep -c "Halting verification": 1 ✓
- grep -c "WARNING-level": 1 ✓

## Key Decisions Made

**R9 design: Warning-level deviation, not blocker**
- Legitimate use cases exist (phase-split criteria across multiple phases)
- WARNING visibility + 3 resolution options balances enforcement with flexibility
- Documented explicit downstream action to prevent silent drift

**baseline_capture as mandatory Step 0**
- Critical to prevent spec weakening anti-pattern
- Must read ROADMAP before PLAN to detect drift
- Schema validation guard prevents silent failures from corrupted ROADMAP data

**Schema validation approach**
- Three valid states: absent/empty, well-formed non-empty, error
- Halts on malformed to prevent baseline-skip defeating R9 purpose
- Conservative (fail-halt on corruption)

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| .planning/PROJECT.md | Added R9 Binding Rules section | +26 |
| qgsd-core/workflows/plan-phase.md | Added 2 binding_rule blocks (planner + checker) | +87 |
| qgsd-core/workflows/verify-phase.md | Added Step 0, binding_rule, r9_deviation status | +70 |

**Total lines added:** 183

## Verification Against must_haves

✓ PROJECT.md contains R9 binding rule with 6 explicit weakening criteria
✓ plan-phase.md planner prompt has binding_rule requiring truths from ROADMAP success_criteria
✓ plan-phase.md checker prompt has binding_rule flagging missing/weakened criteria as blockers
✓ verify-phase.md Step 0 captures ROADMAP success_criteria before PLAN must_haves
✓ verify-phase.md establish_must_haves has binding_rule enforcing immutability
✓ verify-phase.md determine_status includes r9_deviation status
✓ generate-phase-spec.cjs referenced in both PROJECT.md R9 and verify-phase.md binding_rule
✓ All 3 quorum-identified gaps addressed:
  - Explicit "weakening" definition → R9 in PROJECT.md
  - Pre-verification baseline capture → Step 0 in verify-phase.md
  - generate-phase-spec.cjs coverage → R9 enforcement points + verify-phase.md note
✓ Step 0 schema validation guard halts on malformed ROADMAP success_criteria
✓ determine_status r9_deviation has explicit WARNING-level severity with documented downstream action

## Impact

- **Planning:** Planner and checker will now enforce R9, preventing goal weakening at plan creation and validation
- **Verification:** Verifier establishes baseline at entry point, making objective drift immediately visible
- **Spec generation:** generate-phase-spec.cjs readers aware that truths must align with ROADMAP for sound TLA+ properties
- **User experience:** Clear enforcement points + three resolution options for legitimate deviations
- **Project coherence:** R9 reinforces principle that specs track reality but objectives stay immutable

## Upstream Context

Task 126 addresses quorum feedback from 2026-02-28 (3 models identified gaps):
- opencode-1: Need explicit "weakening" criteria definition
- claude-4: Need pre-verification baseline capture to detect drift
- claude-4: Need schema validation guard for robustness

All 3 gaps now addressed structurally (not instruction-following).
