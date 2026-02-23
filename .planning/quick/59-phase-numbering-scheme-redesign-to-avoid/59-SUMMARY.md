---
phase: quick-59
plan: 01
subsystem: gsd-tools
tags: [phase-numbering, milestone-scoped, roadmap, tooling, test-coverage]
dependency-graph:
  requires: []
  provides:
    - "parseMilestonePhaseId() in gsd-tools.cjs"
    - "milestone-scoped phase directory layout (v0.7-01/02/03)"
    - "updated roadmap template with preferred numbering convention"
  affects:
    - "all future phase planning under v0.7 milestone"
    - "gsd-tools find-phase, phases list, roadmap analyze, phase add, phase insert commands"
tech-stack:
  added: []
  patterns:
    - "milestone-scoped phase IDs: v{major}.{minor}-{NN} format"
    - "parseMilestonePhaseId() + normalizePhaseName() delegation pattern"
key-files:
  created:
    - "get-shit-done/references/decimal-phase-calculation.md (milestone section appended)"
    - ".planning/phases/v0.7-01-composition-architecture/ (renamed from 40-)"
    - ".planning/phases/v0.7-02-multiple-slots/ (renamed from 41-)"
    - ".planning/phases/v0.7-03-wizard-composition-screen/ (renamed from 42-)"
  modified:
    - "get-shit-done/bin/gsd-tools.cjs"
    - "get-shit-done/bin/gsd-tools.test.cjs"
    - "get-shit-done/templates/roadmap.md"
    - ".planning/ROADMAP.md"
    - ".planning/STATE.md"
    - ".planning/phases/v0.7-01-composition-architecture/v0.7-01-01-PLAN.md"
    - ".planning/phases/v0.7-01-composition-architecture/v0.7-01-02-PLAN.md"
    - ".planning/phases/v0.7-01-composition-architecture/v0.7-01-03-PLAN.md"
    - ".planning/phases/v0.7-01-composition-architecture/v0.7-01-04-PLAN.md"
decisions:
  - "Phase IDs are milestone-scoped (v0.7-01 format) to prevent collision when parallel milestones run or gap phases are inserted mid-milestone"
  - "parseMilestonePhaseId() is defined before normalizePhaseName() and called by delegation"
  - "Legacy integer phase IDs continue to work unchanged (backward compat preserved)"
  - "Sort key encodes milestone version as 1000000 + major*10000 + minor*100 + seq to sort after all legacy integers"
metrics:
  duration: "~30 minutes"
  completed: "2026-02-23"
  tasks: 3
  files: 10
---

# Quick Task 59: Phase Numbering Scheme Redesign to Avoid Milestone Collision

**One-liner:** Milestone-scoped phase IDs (v0.7-01 format) added to gsd-tools.cjs; QGSD v0.7 phases renamed from 40/41/42; roadmap template updated to prefer new convention.

## What Was Done

Redesigned the GSD phase numbering scheme within QGSD's bundled tooling to scope phase IDs to their milestone. Global integer phase numbers accumulate across milestones causing two problems: (1) inserting a gap phase between 39 and 40 requires renumbering all subsequent phases; (2) working two milestones in parallel produces number conflicts. Milestone-scoped IDs (v0.7-01, v0.7-02) are self-contained — a v0.7 gap insertion becomes v0.7-01.1 without touching v0.7-02 or any other milestone's numbers.

## Tasks Completed

### Task 1: Add milestone-scoped phase ID support to gsd-tools.cjs

Added `parseMilestonePhaseId()` helper that parses `v0.7-01` and `v0.7-01.1` formats, returning structured `{ milestone, seq, decimal, full }` objects. Updated `normalizePhaseName()` to delegate to this helper for vX.Y-NN inputs. All key operations updated:

- **Sort:** `dirs.sort()` in `cmdPhasesList()` now uses a composite sort key that places milestone-scoped phases after all legacy integers, ordered by major/minor version then sequence number with decimal support.
- **Find:** Existing prefix-match in `cmdPhasesList()` works automatically since `normalizePhaseName()` now returns the correct prefix.
- **Roadmap analyze:** `phasePattern` regex updated to capture `v\d+\.\d+-\d+` format; `checklistPattern` updated similarly; `checkboxPattern` now escapes both dots and dashes in phase numbers.
- **Phase add:** Detects milestone-scoped projects by scanning for existing `vX.Y-NN` headers and appends new phases within the latest milestone sequence.
- **Phase insert:** Fixes for decimal pattern escaping, leading-zero strip (skipped for milestone-scoped IDs), and headerPattern conditional.
- **Next-header detection:** All three `\n#{2,4}\s+Phase\s+\d/i` patterns updated to `(?:\d|v\d)` to match both formats.

### Task 2: Update templates and QGSD ROADMAP.md

- **Directory renames (git mv):** `40-composition-architecture` → `v0.7-01-composition-architecture`, `41-multiple-slots` → `v0.7-02-multiple-slots`, `42-wizard-composition-screen` → `v0.7-03-wizard-composition-screen`
- **Plan file renames:** `40-0N-PLAN.md` → `v0.7-01-0N-PLAN.md` (01..04); `40-RESEARCH.md` → `v0.7-01-RESEARCH.md`
- **Frontmatter updates:** `phase: 40-composition-architecture` → `phase: v0.7-01-composition-architecture` in all 4 plan files; `depends_on: [40-01]` → `depends_on: [v0.7-01-01]` in plans 03 and 04; context and output SUMMARY/RESEARCH path references updated
- **ROADMAP.md:** Phase 40/41/42 → v0.7-01/02/03 in milestones list, v0.7 detail section, phase details headers, depends-on lines, plan file references, and progress table
- **roadmap.md template:** Phase numbering block rewritten to document milestone-scoped convention as preferred; example template uses v1.0-01/02/03 IDs; guidelines updated
- **decimal-phase-calculation.md:** New section "Milestone-Scoped Decimal Insertion" added with examples and directory/plan naming conventions
- **STATE.md:** Decision recorded under Decisions section

### Task 3: Add gsd-tools test coverage for milestone-scoped phase IDs

Four new tests added in `describe('milestone-scoped phase IDs')` block after the "roadmap analyze command" describe:

- **MS-TC-01:** `roadmap analyze` parses `### Phase v0.7-01: ...` headers; verifies `phase_count: 2`, `phases[0].number: 'v0.7-01'`, goal extraction
- **MS-TC-02:** `find-phase v0.7-01` locates `v0.7-01-composition-architecture/` directory
- **MS-TC-03:** `phases list` sorts `v0.7-01`, `v0.7-01.1`, `v0.7-02` in correct order
- **MS-TC-04:** `roadmap analyze` reads `disk_status: 'complete'` for a v0.7-01 directory with matching PLAN and SUMMARY files

Total gsd-tools tests: 139 (was 135), all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] maxPhase variable scoping error in cmdPhaseAdd()**
- **Found during:** Task 1 verification (test run)
- **Issue:** After refactoring `cmdPhaseAdd()` to support milestone-scoped mode, the `phaseEntry` template string still referenced `${maxPhase}` which was now scoped inside the `else` block, causing `ReferenceError: maxPhase is not defined`
- **Fix:** Introduced `prevPhaseNum` variable to track the "previous phase" in both branches (milestone-scoped uses `${latestMilestone}-${String(maxSeq).padStart(2,'0')}`, integer uses the old `maxPhase`); updated `phaseEntry` to use `${prevPhaseNum}`
- **Files modified:** `get-shit-done/bin/gsd-tools.cjs`
- **Commit:** e410ab0

## Commits

- `e410ab0` — `feat(quick-59): add milestone-scoped phase ID support to gsd-tools.cjs`
- `d59f77f` — `feat(quick-59): update templates and QGSD files to use milestone-scoped phase IDs`
- `4b370c0` — `test(quick-59): add MS-TC-01..04 milestone-scoped phase ID test coverage`

## Self-Check: PASSED

All artifacts verified:
- FOUND: get-shit-done/bin/gsd-tools.cjs (contains parseMilestonePhaseId)
- FOUND: get-shit-done/bin/gsd-tools.test.cjs (contains v0.7-01 tests)
- FOUND: .planning/phases/v0.7-01-composition-architecture/
- FOUND: .planning/phases/v0.7-02-multiple-slots/
- FOUND: .planning/phases/v0.7-03-wizard-composition-screen/
- FOUND: .planning/phases/v0.7-01-composition-architecture/v0.7-01-01-PLAN.md
- FOUND: get-shit-done/templates/roadmap.md (updated)
- FOUND: get-shit-done/references/decimal-phase-calculation.md (updated)

All commits present:
- e410ab0 — feat(quick-59): add milestone-scoped phase ID support
- d59f77f — feat(quick-59): update templates and QGSD files
- 4b370c0 — test(quick-59): add MS-TC-01..04 test coverage

gsd-tools tests: 139/139 passing (4 new MS-TC tests added)
