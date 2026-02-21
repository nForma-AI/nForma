# Phase 16: Verify Phase 15 — ACT-02 and ACT-04 Gap Closure — Research

**Researched:** 2026-02-21
**Domain:** Verification workflow — gsd-verifier pattern applied to Phase 15 gap-closure edits; REQUIREMENTS.md traceability closure for ACT-02 and ACT-04
**Confidence:** HIGH

---

## Summary

Phase 16 is a verification phase. Its sole deliverable is `15-VERIFICATION.md` — a formal gsd-verifier report that confirms the surgical edits made by Phase 15 are correctly wired in both source and installed files. No new code is written. No schema changes are introduced. The planner needs one plan and one task set: run the gsd-verifier, produce the structured report, and update REQUIREMENTS.md traceability to mark ACT-02 and ACT-04 Complete.

Phase 15 executed one plan (15-01-PLAN.md) that made 8 targeted edits across 4 files (2 source, 2 installed). The v0.4-MILESTONE-AUDIT.md (3rd audit) independently confirmed via live grep that all 8 edits are present and synchronized. The audit classified ACT-02 and ACT-04 as "partial" solely because Phase 15 produced no formal VERIFICATION.md — only self-verification via grep in its SUMMARY.md. Phase 16 closes this process gap.

One additional fix is in scope for Phase 16: the audit identified INT-02, a structural inconsistency where the `planning` row in the resume-project.md routing table at line 172 lacks the `(activity=plan_phase)` qualifier that Phase 15 applied to the `researching` row. Phase 16 should fix this label and include it in the VERIFICATION.md evidence, closing INT-02 alongside the formal verification of Phase 15's work.

**Primary recommendation:** Single plan with three tasks: (1) fix INT-02 planning row label in both source and installed resume-project.md, (2) run the full gsd-verifier must-have truth checks and produce 15-VERIFICATION.md, (3) update REQUIREMENTS.md traceability rows for ACT-02 and ACT-04 to Complete, update ROADMAP.md Phase 15 status to Complete, and update the pending count.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACT-02 | Activity schema: `{ activity, sub_activity, phase?, plan?, wave?, debug_round?, checkpoint?, quorum_round?, updated }` — all fields except `activity` and `updated` are optional; unknown fields are preserved | Phase 15 added `"phase":"${PHASE_NUMBER}"` to oscillation-resolution-mode.md Steps 4 and 5. Confirmed present at lines 65 and 93 in source and installed. The VERIFICATION.md must verify this with live grep evidence and mark it SATISFIED in the requirements coverage table. |
| ACT-04 | `resume-work` reads current-activity.json and routes to the exact recovery point — displaying the interrupted state before resuming execution | Phase 15 added `researching (activity=new_milestone)` and `creating_roadmap` routing rows; disambiguated bare `researching` to `researching (activity=plan_phase)`. Confirmed present in source and installed. Phase 16 must also fix the `planning` row (INT-02) and include all four routing rows in VERIFICATION.md evidence. |
</phase_requirements>

---

## What Phase 16 Verifies

Phase 16 does NOT re-implement Phase 15's work. It verifies that the work is correct and produces a stamped VERIFICATION.md. The verification checks come directly from Phase 15's own `<verification>` section and the 15-01-PLAN.md `must_haves`:

### Must-Have Truths (from 15-01-PLAN.md)

| # | Truth | Source | How to Verify |
|---|-------|--------|---------------|
| 1 | oscillation-resolution-mode.md Steps 4+5 activity-set payloads include `phase` field so resume can render `/qgsd:execute-phase {phase}` with a real number | 15-01-PLAN.md must_haves[0] | `grep -c 'PHASE_NUMBER' source + installed` — must return 2 each |
| 2 | new-milestone `researching` state routes to `/qgsd:new-milestone`, not `/qgsd:plan-phase` | 15-01-PLAN.md must_haves[1] | `grep 'activity=new_milestone.*new-milestone'` in both resume-project files |
| 3 | new-milestone `creating_roadmap` state routes to `/qgsd:new-milestone` | 15-01-PLAN.md must_haves[2] | `grep 'creating_roadmap.*new-milestone'` in both resume-project files |
| 4 | Bare `researching` row replaced with `researching (activity=plan_phase)` disambiguation | 15-01-PLAN.md must_haves[3] | `grep -c '^| researching |'` must return 0; `grep 'activity=plan_phase'` must return 1 per file |
| 5 | `planning` row now has `(activity=plan_phase)` qualifier (INT-02 fix — added in Phase 16) | INT-02 from v0.4-MILESTONE-AUDIT.md | `grep 'planning (activity=plan_phase)'` in both resume-project files |

### Verification Grep Commands (from 15-01-PLAN.md `<verification>` section)

```bash
# ACT-02 evidence
grep -c 'PHASE_NUMBER' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/oscillation-resolution-mode.md
# Expected: 2

grep -c 'PHASE_NUMBER' /Users/jonathanborduas/.claude/qgsd/workflows/oscillation-resolution-mode.md
# Expected: 2

# ACT-04 evidence
grep -c 'activity=plan_phase\|activity=new_milestone\|creating_roadmap' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md
# Expected: 3 (pre-INT-02 fix) or 4 (post-INT-02 fix if planning row also counts)

grep -c '^| researching |' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md
# Expected: 0

# REQUIREMENTS.md
grep '\[x\].*ACT-02\|\[x\].*ACT-04' /Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md
# Expected: 2 lines
```

---

## Current State (Pre-Phase-16)

The following is the verified on-disk state as of the 3rd v0.4 audit (2026-02-21T20:35:00Z), confirmed by independent integration checker:

### oscillation-resolution-mode.md (ACT-02)

Both source and installed copies confirmed correct:

```
Line 65 (source): "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"oscillation_diagnosis\",\"phase\":\"${PHASE_NUMBER}\"}"
Line 93 (source): "{\"activity\":\"circuit_breaker\",\"sub_activity\":\"awaiting_approval\",\"phase\":\"${PHASE_NUMBER}\"}"
```

`grep -c 'PHASE_NUMBER'` returns 2 in both source and installed. Live-confirmed as of research.

### resume-project.md (ACT-04 — partial)

Both source and installed copies confirmed:

```
Line 171: | researching (activity=plan_phase) | `/qgsd:plan-phase {phase}` — researcher was running, re-trigger with --research flag |
Line 172: | planning | `/qgsd:plan-phase {phase}` — planner was running, re-trigger plan-phase |   ← INT-02: missing (activity=plan_phase) label
Line 175: | researching (activity=new_milestone) | `/qgsd:new-milestone` — milestone research was running |
Line 176: | creating_roadmap | `/qgsd:new-milestone` — roadmapper was spawning |
```

Bare `| researching |` row: 0 matches (gone). `grep -c 'activity=plan_phase\|activity=new_milestone\|creating_roadmap'` returns 3 (source and installed).

INT-02 open item: line 172 `| planning |` should be `| planning (activity=plan_phase) |` for consistency with the disambiguation pattern applied to `researching` in Phase 15. All other ambiguous rows have been qualified. This is a label annotation fix only — the routing itself works because plan-phase is the only context that writes `sub_activity=planning` with an `activity` field other than `quick` (which already has its own row `planning (activity=quick)`).

### REQUIREMENTS.md (traceability — must be updated by Phase 16)

Current state (intentional holding pattern from 2nd audit):
- Checkboxes: `[x] **ACT-02**` and `[x] **ACT-04**` — already checked
- Traceability rows: `| ACT-02 | Phase 16 (verification of Phase 15) | Pending |` and `| ACT-04 | Phase 16 (verification of Phase 15) | Pending |`
- Pending count: `20 (v0.2: ORES-01..05 + v0.3: RLS-01..04 + v0.4: ACT-02, ACT-04)`

Phase 16 must change both traceability rows from `Pending` to `Complete` and update the pending count from `20` to `18` (removing the two v0.4 items).

---

## Architecture Patterns

### Pattern 1: gsd-verifier VERIFICATION.md Structure

From `14-VERIFICATION.md` (Phase 14, passed 13/13) — the canonical template for this project:

**YAML frontmatter:**
```yaml
---
phase: {phase-dir-name}
verified: {ISO timestamp}
status: passed  # or failed
score: {N/N} must-haves verified
re_verification: false
gaps: []
human_verification: []
---
```

**Required sections:**
1. `## Goal Achievement` — `### Observable Truths` table with columns: `#`, `Truth`, `Status`, `Evidence`
2. `## Required Artifacts` — table with columns: `Artifact`, `Expected`, `Status`, `Details`
3. `## Key Link Verification` — table with columns: `From`, `To`, `Via`, `Status`, `Details`
4. `## Requirements Coverage` — table with columns: `Requirement`, `Source Plan`, `Description`, `Status`, `Evidence`
5. `## Anti-Patterns Found` — table (populate with "None found" if clean)
6. `## Human Verification Required` — list any items needing human confirmation
7. `## Summary` — prose wrap-up of what was achieved

The VERIFICATION.md for Phase 15 should be named `15-VERIFICATION.md` and placed at:
`.planning/phases/15-v0.4-gap-closure-activity-resume-routing/15-VERIFICATION.md`

### Pattern 2: Observable Truths Evidence Style

From Phase 14 VERIFICATION.md — evidence column format: cite live test results or grep command + result. Example:

```
| 1 | oscillation-resolution-mode.md source and installed have `phase` field in circuit_breaker activity-sets | VERIFIED | grep -c 'PHASE_NUMBER' source → 2; grep -c 'PHASE_NUMBER' installed → 2 |
```

Truths come from the Phase 15 PLAN.md `must_haves.truths` array. Each truth becomes one row.

### Pattern 3: Required Artifacts Table

Artifacts come from Phase 15 PLAN.md `must_haves.artifacts` list. Each artifact gets a row. The `Details` column cites the live grep result or specific line numbers confirming the artifact contains what was promised.

### Pattern 4: Key Links Table

Key links come from Phase 15 PLAN.md `must_haves.key_links` list. These confirm the wiring: that an emitter (oscillation-resolution-mode.md activity-set) connects correctly to a consumer (resume-project.md routing row) via the mechanism described (phase field value).

### Pattern 5: VERIFICATION.md Placement

Phase 9 and Phase 10 established the pattern for verification phases: the VERIFICATION.md for the *verified phase* lives inside *that phase's directory*, not in the verifier phase's directory. Phase 16 verifies Phase 15, so the output is:

- `15-VERIFICATION.md` → `.planning/phases/15-v0.4-gap-closure-activity-resume-routing/15-VERIFICATION.md`
- Phase 16 may optionally have its own `16-VERIFICATION.md` but the primary deliverable is the Phase 15 file.

Looking at Phase 9 precedent: 09-VERIFICATION.md lives in the Phase 9 directory (verifier phase), but it documents the Phase 9 process goal (creating 05-VERIFICATION.md and 06-VERIFICATION.md). For Phase 16, the simplest pattern is a single plan that produces `15-VERIFICATION.md` — no separate Phase 16 VERIFICATION.md is needed unless project convention requires it.

---

## INT-02 Fix Specification

The planner should include INT-02 as Task 1 (before verification) so verification can include the fixed state.

**Files:** (both source and installed)
- `/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md`
- `/Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md`

**Edit (source line 172, installed line 172):**
```
Before: | planning | `/qgsd:plan-phase {phase}` — planner was running, re-trigger plan-phase |
After:  | planning (activity=plan_phase) | `/qgsd:plan-phase {phase}` — planner was running, re-trigger plan-phase |
```

**Verify after edit:**
```bash
grep -n 'planning (activity=plan_phase)' /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md
# Must return 1 line

grep -n 'planning (activity=plan_phase)' /Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md
# Must return 1 line
```

Note: `planning (activity=quick)` remains a separate row — this edit only adds the qualifier to the bare `| planning |` row.

---

## REQUIREMENTS.md Update Specification

After `15-VERIFICATION.md` exists with `status: passed`, Phase 16 must update REQUIREMENTS.md:

**Current traceability (lines 265, 267):**
```
| ACT-02 | Phase 16 (verification of Phase 15) | Pending |
| ACT-04 | Phase 16 (verification of Phase 15) | Pending |
```

**Target state:**
```
| ACT-02 | Phase 16 (verification of Phase 15) | Complete |
| ACT-04 | Phase 16 (verification of Phase 15) | Complete |
```

**Current pending count (line 280):**
```
- Pending (awaiting verification): 20 (v0.2: ORES-01..05 + v0.3: RLS-01..04 + v0.4: ACT-02, ACT-04)
```

**Target state:**
```
- Pending (awaiting verification): 18 (v0.2: ORES-01..05 + v0.3: RLS-01..04)
```

**ROADMAP.md update:** Phase 15 progress table row should change from `In Progress` to `Complete`:
```
Before: | 15. v0.4 Gap Closure — Activity Resume Routing | 1/1 planned | In Progress | — |
After:  | 15. v0.4 Gap Closure — Activity Resume Routing | 1/1 planned | Complete | 2026-02-21 |
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Evidence gathering | Write a custom evidence script | Run grep commands from 15-01-PLAN.md `<verification>` section directly | The verification commands are already specified; use them verbatim |
| VERIFICATION.md structure | Invent a new format | Follow 14-VERIFICATION.md as template | Consistency across the project; planner can slot in data without structural decisions |
| Checking if Phase 15 fixes are wired | Re-read workflow files manually | Use the specific grep commands already proven accurate by the 3rd audit | INT checker already ran these; repeat for authoritative VERIFICATION.md evidence |

---

## Common Pitfalls

### Pitfall 1: Verifying the Wrong Files
**What goes wrong:** Grepping source files only, not installed copies.
**Why it happens:** Source edits are in the repo; installed copies are at `~/.claude/qgsd/workflows/`.
**How to avoid:** Run every grep check against both source (`/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/`) and installed (`/Users/jonathanborduas/.claude/qgsd/workflows/`). Both must pass.

### Pitfall 2: Running INT-02 Fix After Writing VERIFICATION.md
**What goes wrong:** VERIFICATION.md documents the pre-fix state, then INT-02 is patched afterward — VERIFICATION.md is then stale.
**How to avoid:** Fix INT-02 first (Task 1), then run all grepping and produce VERIFICATION.md (Task 2) against the fully-fixed state. VERIFICATION.md should include the INT-02 fix as an additional truth.

### Pitfall 3: Updating REQUIREMENTS.md Before 15-VERIFICATION.md Exists
**What goes wrong:** Traceability rows updated to Complete before the verification artifact is produced — leaves the project in an inconsistent state if verification fails.
**How to avoid:** Gate: 15-VERIFICATION.md must exist with `status: passed` before REQUIREMENTS.md traceability rows are changed. This matches the Phase 9 gate pattern documented in STATE.md.

### Pitfall 4: Wrong Pending Count Math
**What goes wrong:** Pending count calculation error — removing 2 items (ACT-02, ACT-04) from the v0.4 group gives 18, not 16.
**How to avoid:** Current pending = 20 (v0.2: 5 + v0.3: 4 + v0.4: 2 = 11 + 9 = wait: ORES 5 + RLS 4 + ACT 2 = 11). After closing ACT-02 and ACT-04: 20 - 2 = 18. New pending = `18 (v0.2: ORES-01..05 + v0.3: RLS-01..04)`. The v0.4 group is fully removed from the description.

---

## Proposed Plan Structure

Phase 16 needs one plan (16-01-PLAN.md) with the following task sequence:

**Task 1 (auto): Fix INT-02 — add `(activity=plan_phase)` qualifier to `planning` row in both resume-project.md files**
- Edit source: line 172
- Edit installed: line 172
- Verify: grep returns 1 match per file

**Task 2 (auto): Produce `15-VERIFICATION.md` — run all Phase 15 must-have truth checks with live grep evidence**
- Run all 7 grep checks from 15-01-PLAN.md `<verification>` section (including new INT-02 check)
- Collect evidence output verbatim
- Write `.planning/phases/15-v0.4-gap-closure-activity-resume-routing/15-VERIFICATION.md` with:
  - YAML frontmatter: `status: passed`, `score: 5/5 must-haves verified` (4 original + 1 INT-02)
  - Observable Truths table: one row per truth
  - Required Artifacts table: one row per artifact from 15-01-PLAN.md
  - Key Link Verification table: one row per key_link from 15-01-PLAN.md
  - Requirements Coverage table: ACT-02 SATISFIED + ACT-04 SATISFIED with evidence citations

**Task 3 (auto): Update REQUIREMENTS.md traceability + ROADMAP.md Phase 15 status**
- Gate: 15-VERIFICATION.md must have `status: passed` before this task runs
- REQUIREMENTS.md: ACT-02 and ACT-04 traceability rows Pending → Complete
- REQUIREMENTS.md: pending count 20 → 18, remove v0.4 items from description
- ROADMAP.md: Phase 15 table row In Progress → Complete, add date 2026-02-21

**Task 4 (checkpoint:verify): Run quorum-test to confirm all artifacts exist and are correctly populated**
- Verify 15-VERIFICATION.md exists at correct path with `status: passed` in frontmatter
- Verify REQUIREMENTS.md traceability shows `Complete` for both ACT-02 and ACT-04
- Verify pending count = 18

---

## Sources

### Primary (HIGH confidence)

- `/Users/jonathanborduas/code/QGSD/.planning/phases/15-v0.4-gap-closure-activity-resume-routing/15-01-PLAN.md` — Source of must_haves, artifacts, key_links, verification commands
- `/Users/jonathanborduas/code/QGSD/.planning/phases/15-v0.4-gap-closure-activity-resume-routing/15-01-SUMMARY.md` — Confirms what Phase 15 actually did + task completion table
- `/Users/jonathanborduas/code/QGSD/.planning/phases/14-activity-tracking/14-VERIFICATION.md` — Template for VERIFICATION.md structure (13/13 truths, all section types)
- `/Users/jonathanborduas/code/QGSD/.planning/v0.4-MILESTONE-AUDIT.md` — 3rd audit, INT-02 finding, live grep confirmation of Phase 15 edits
- Live grep (run during research): confirmed PHASE_NUMBER count=2 in both oscillation files; confirmed 3 disambiguation rows in both resume-project files; confirmed INT-02 planning row at line 172

### Secondary (MEDIUM confidence)

- `/Users/jonathanborduas/code/QGSD/.planning/phases/09-verify-phases-5-6/09-VERIFICATION.md` — Phase 9 precedent for verification-phase VERIFICATION.md structure
- `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — Confirmed ACT-02/04 traceability current state (Pending at Phase 16) and pending count (20)
- `/Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md` — Phase 15 progress table current state (In Progress)

---

## Metadata

**Confidence breakdown:**
- Verification checks: HIGH — grep commands are exact, files confirmed readable, results verified live
- VERIFICATION.md structure: HIGH — template is 14-VERIFICATION.md, same project, same gsd-verifier pattern
- REQUIREMENTS.md update: HIGH — exact lines identified, current state confirmed, target state clear
- INT-02 fix: HIGH — line 172 confirmed, edit is one-character change (add qualifier), both files accessible

**Research date:** 2026-02-21
**Valid until:** No expiry — codebase-specific static file analysis
