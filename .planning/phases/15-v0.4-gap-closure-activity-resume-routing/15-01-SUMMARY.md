---
phase: 15-v0.4-gap-closure-activity-resume-routing
plan: 01
type: summary
status: complete
completed: 2026-02-21
requirements_closed: [ACT-02, ACT-04]
---

# Phase 15-01 Summary: v0.4 Gap Closure — Activity Resume Routing

## What Was Done

Closed two ACT-02 and ACT-04 gaps found in the v0.4 milestone audit. Surgical edits to two workflow markdown files (source + installed copies) plus REQUIREMENTS.md checkbox updates.

## Tasks Completed

### Task 1: Add phase field to oscillation-resolution-mode.md (source + installed)

Added `"phase":"${PHASE_NUMBER}"` to both activity-set JSON payloads in the oscillation resolution workflow:

- **Step 4 (quorum_diagnosis):** `{"activity":"circuit_breaker","sub_activity":"oscillation_diagnosis","phase":"${PHASE_NUMBER}"}`
- **Step 5 (on_consensus):** `{"activity":"circuit_breaker","sub_activity":"awaiting_approval","phase":"${PHASE_NUMBER}"}`

Applied to both files:
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md`
- `/Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md`

**Verification:** `grep -c 'PHASE_NUMBER'` returns 2 in each file (4 total matches).

### Task 2: Fix resume-project.md routing table (source + installed)

Three edits to the `determine_next_action` routing table:

1. **Disambiguated** the existing bare `researching` row → `researching (activity=plan_phase)` to scope it unambiguously to plan_phase activity
2. **Added** `researching (activity=new_milestone)` row routing to `/qgsd:new-milestone`
3. **Added** `creating_roadmap` row routing to `/qgsd:new-milestone`

Applied to both files:
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md`
- `/Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md`

**Verification:** `grep -c 'activity=plan_phase|activity=new_milestone|creating_roadmap'` returns 3 in each file; bare `| researching |` row is gone (0 matches).

### Task 3: Mark ACT-02 and ACT-04 complete in REQUIREMENTS.md

- `[x]` checkbox for ACT-02 (was already [x]; confirmed)
- `[x]` checkbox for ACT-04 (was `[ ]`; updated to `[x]`)
- Traceability table: ACT-02 `Pending` → `Complete`
- Traceability table: ACT-04 `Pending` → `Complete`
- Coverage summary: `Pending (awaiting verification): 20 (v0.2: ORES-01..05 + v0.3: RLS-01..04 + v0.4: ACT-02, ACT-04)` → `18 (v0.2: ORES-01..05 + v0.3: RLS-01..04)`

### Task 4: checkpoint:verify — All Checks Pass

All 7 grep verification checks passed:

| Check | Expected | Result |
|-------|----------|--------|
| `grep -c 'PHASE_NUMBER'` oscillation-resolution-mode.md source | 2 | 2 |
| `grep -c 'PHASE_NUMBER'` oscillation-resolution-mode.md installed | 2 | 2 |
| `grep 'oscillation_diagnosis.*PHASE_NUMBER'` source | 1 match | PASS |
| `grep 'awaiting_approval.*PHASE_NUMBER'` source | 1 match | PASS |
| `grep -c 'activity=plan_phase\|...'` resume-project.md source | 3 | 3 |
| `grep -c 'activity=plan_phase\|...'` resume-project.md installed | 3 | 3 |
| `grep -c '^| researching |'` source | 0 | 0 |
| `grep '\[x\].*ACT-02\|\[x\].*ACT-04'` REQUIREMENTS.md | 2 lines | 2 lines |

## E2E Flows Fixed

**Flow 1 — Oscillation resolution context reset:**
- Before: `{"activity":"circuit_breaker","sub_activity":"oscillation_diagnosis"}` → resume-project rendered `/qgsd:execute-phase undefined`
- After: `{"activity":"circuit_breaker","sub_activity":"oscillation_diagnosis","phase":"15-v0.4-gap-closure"}` → resume-project renders `/qgsd:execute-phase 15-v0.4-gap-closure`

**Flow 2 — New-milestone context reset:**
- Before: `{"activity":"new_milestone","sub_activity":"researching"}` → resume-project routed to `/qgsd:plan-phase` (wrong command, no routing row)
- After: `researching (activity=new_milestone)` row matches → routes to `/qgsd:new-milestone`

## Files Modified

| File | Edit |
|------|------|
| `get-shit-done/workflows/oscillation-resolution-mode.md` | Added `"phase":"${PHASE_NUMBER}"` to Step 4 and Step 5 activity-set JSON payloads |
| `/Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md` | Same as above (installed copy) |
| `get-shit-done/workflows/resume-project.md` | Disambiguated `researching` row + added 2 new_milestone routing rows |
| `/Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md` | Same as above (installed copy) |
| `.planning/REQUIREMENTS.md` | ACT-04 checkbox [x], ACT-02+ACT-04 traceability → Complete, pending count 20→18 |

## Requirements Satisfied

- **ACT-02**: Activity schema includes `phase` field in circuit_breaker activity-set calls — oscillation resolution mode now writes phase to the activity file at both diagnosis and approval steps
- **ACT-04**: resume-work routes to exact recovery point for all workflow states — new_milestone activity states now have correct routing rows; disambiguated researching row prevents false matches
