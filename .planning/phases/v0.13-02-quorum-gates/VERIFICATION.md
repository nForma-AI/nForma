---
phase: v0.13-02
status: passed
verified: 2026-02-25
verifier: Claude Sonnet 4.6
---

# Phase v0.13-02 Verification — Quorum Gates

## Phase Goal Verification

**Phase:** v0.13-02 — Quorum Gates
**Goal:** Replace every AskUserQuestion in the autonomous milestone execution loop with R3 quorum consensus — plan-milestone-gaps confirmation gate (QUORUM-01), plan-milestone-gaps auto-spawn of plan-phase (LOOP-04), execute-phase gap resolution (QUORUM-02), discuss-phase gray-area routing in auto mode (QUORUM-03).

**Status: PASSED** — All four requirements implemented and confirmed present in the workflow files.

---

## Requirements Check

| Requirement | Description | Result |
|-------------|-------------|--------|
| QUORUM-01 | plan-milestone-gaps submits proposed gap phases to R3 quorum before ROADMAP update | PASS |
| LOOP-04 | plan-milestone-gaps auto-spawns plan-phase Task for first gap phase after quorum APPROVE | PASS |
| QUORUM-02 | execute-phase gaps_found triggers quorum diagnosis + auto-resolution via plan-phase --gaps | PASS |
| QUORUM-03 | discuss-phase routes for_user[] survivors to quorum second pass in auto mode | PASS |

---

## Per-Requirement Evidence

### QUORUM-01 — plan-milestone-gaps R3 quorum gate

**File:** `qgsd-core/workflows/plan-milestone-gaps.md`

**Evidence:**
- Line 120: `qgsd-quorum-slot-worker` dispatch in Step 5 — "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)"
- Line 125: `update-scoreboard` call — `node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs"` (fires before Step 6 ROADMAP update)
- `GSD_DECISION` marker present (grep count: 1) — confirms quorum decision point is wired
- "Wait for user confirmation" absent (grep count: 0) — confirms AskUserQuestion fully replaced by R3 quorum

**What was changed:** The old `AskUserQuestion("Do you approve these phases?")` gate in Step 5 was replaced with a full R3 quorum dispatch using `qgsd-quorum-slot-worker`. ROADMAP.md is only updated after quorum APPROVE.

---

### LOOP-04 — plan-milestone-gaps auto-spawn of plan-phase

**File:** `qgsd-core/workflows/plan-milestone-gaps.md`

**Evidence:**
- Line 200: `FIRST_GAP_PHASE="${phases_created[0]}"` — captures first gap phase from the list created in Step 6
- Line 210: `Auto-spawning plan-phase for Phase {FIRST_GAP_PHASE}...` — the auto-spawn log message confirming the step fires
- Line 217: `prompt="Run /qgsd:plan-phase {FIRST_GAP_PHASE} --auto` — Task spawn prompt with --auto flag
- Line 219: `Gap closure phase goal: {goal from ROADMAP.md for FIRST_GAP_PHASE}` — goal injection into the spawned Task
- Line 221: `subagent_type="general-purpose"` — Task spawn uses general-purpose agent (no dedicated subagent type needed)
- Line 222: `description="Plan gap phase {FIRST_GAP_PHASE}"` — Task description

**What was changed:** Step 10 previously said "suggest the user run /qgsd:plan-phase". It now auto-spawns a `Task` with the plan-phase command directly. No human prompt required.

---

### QUORUM-02 — execute-phase gaps_found quorum diagnosis block

**File:** `qgsd-core/workflows/execute-phase.md`

**Evidence:**
- Line 405: `qgsd-quorum-slot-worker` dispatch — "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)" (first quorum block in verify_phase_goal)
- Line 435: `qgsd-quorum-slot-worker` dispatch — second quorum block in gaps_found Quorum Diagnosis section
- Line 430: Question template: "Form your own position: are these gaps auto-resolvable via plan-phase --gaps, or do they require human review? State your vote APPROVE (auto-resolvable) or BLOCK (needs human) with 1-2 sentence rationale."
- Line 434: Compact prompt format confirmed: "Phase {PHASE_NUMBER} verification found {N} gaps. Are these auto-resolvable via plan-phase --gaps Task spawn, or do they require human review? Gaps: {1-sentence-per-gap — max 20 words each}. Vote APPROVE (auto-resolvable) or BLOCK (needs human)."
- Line 440: `update-scoreboard` call — `node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs"` fires after quorum resolves
- Line 453: `prompt="Run /qgsd:plan-phase {PHASE_NUMBER} --gaps --auto"` — auto-spawn of plan-phase --gaps on APPROVE
- Line 470: `### Quorum Diagnosis` — section heading confirms the block is present and titled
- Line 517: `offer_next` Exception note updated — "If `gaps_found`, the `verify_phase_goal` step handles routing via quorum (QUORUM-02). If quorum approved auto-fix, plan-phase --gaps was already spawned inline. If quorum blocked (escalated to user), the user sees the gap report — no additional routing needed. In both cases, skip auto-advance."

**Note on untouched branches:** The `passed` and `human_needed` branches in `verify_phase_goal` were confirmed untouched — QUORUM-02 only adds the `gaps_found` routing block; existing logic for other outcomes is preserved.

---

### QUORUM-03 — discuss-phase auto mode second quorum pass

**File:** `qgsd-core/workflows/discuss-phase.md`

**Evidence:**
- Line 237: `**Auto mode second quorum pass (QUORUM-03):**` — section heading confirms the block is present and labeled
- Line 242: `AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")` — auto mode detection via config
- Line 245: `**If \`--auto\` flag present OR \`AUTO_CFG\` is \`"true"\` AND \`for_user[]\` is non-empty:**` — gate condition: only fires when auto mode active and gray areas remain
- Line 261: `node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs"` — scoreboard update fires after QUORUM-03 resolves
- Line 284: `**If neither \`--auto\` nor \`AUTO_CFG\` is true (interactive mode):** Skip this entire sub-section. Go directly to the standard display and AskUserQuestion below (unchanged).` — interactive mode path explicitly preserved; quorum second pass does not replace AskUserQuestion in non-auto mode

**r4_pre_filter intact:**
- Line 194: `<step name="r4_pre_filter">` — the r4_pre_filter step heading is unchanged. QUORUM-03 second pass fires AFTER r4_pre_filter completes, not replacing it. The auto-resolution pipeline is: r4_pre_filter (consensus removal) → for_user[] survivors → QUORUM-03 second pass (auto mode only) → any remaining go to user (interactive mode path).

**Decision recorded (STATE.md):** QUORUM-03 uses a 3-round deliberation cap (not 10) — it matches the R4 secondary pre-filter pattern, not full R3 arbitration.

---

## Verification Commands Run

### QUORUM-01 evidence commands and output

```
$ grep -n "qgsd-quorum-slot-worker" qgsd-core/workflows/plan-milestone-gaps.md
120:- Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)

$ grep -n "update-scoreboard" qgsd-core/workflows/plan-milestone-gaps.md
125:node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \

$ grep -c "GSD_DECISION" qgsd-core/workflows/plan-milestone-gaps.md
1

$ grep -c "Wait for user confirmation" qgsd-core/workflows/plan-milestone-gaps.md
0
```

### LOOP-04 evidence commands and output

```
$ grep -n "FIRST_GAP_PHASE" qgsd-core/workflows/plan-milestone-gaps.md
200:FIRST_GAP_PHASE="${phases_created[0]}"  # First element of the phases created list from Step 6
210:Auto-spawning plan-phase for Phase {FIRST_GAP_PHASE}...
217:  prompt="Run /qgsd:plan-phase {FIRST_GAP_PHASE} --auto
219:Gap closure phase goal: {goal from ROADMAP.md for FIRST_GAP_PHASE}
222:  description="Plan gap phase {FIRST_GAP_PHASE}"

$ grep -n "general-purpose" qgsd-core/workflows/plan-milestone-gaps.md
221:  subagent_type="general-purpose",
```

### QUORUM-02 evidence commands and output

```
$ grep -n "qgsd-quorum-slot-worker" qgsd-core/workflows/execute-phase.md
405:   - Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)
435:- Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks (one per slot)

$ grep -n "update-scoreboard" qgsd-core/workflows/execute-phase.md
440:node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \

$ grep -n "plan-phase.*gaps.*auto" qgsd-core/workflows/execute-phase.md
453:    prompt="Run /qgsd:plan-phase {PHASE_NUMBER} --gaps --auto",

$ grep -n "Quorum Diagnosis" qgsd-core/workflows/execute-phase.md
470:  ### Quorum Diagnosis
```

### QUORUM-03 evidence commands and output

```
$ grep -n "Auto mode second quorum pass" qgsd-core/workflows/discuss-phase.md
237:**Auto mode second quorum pass (QUORUM-03):**

$ grep -n "update-scoreboard" qgsd-core/workflows/discuss-phase.md
261:   node "$HOME/.claude/qgsd-bin/update-scoreboard.cjs" \

$ grep -n "AUTO_CFG" qgsd-core/workflows/discuss-phase.md
242:AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
245:**If `--auto` flag present OR `AUTO_CFG` is `"true"` AND `for_user[]` is non-empty:**
284:**If neither `--auto` nor `AUTO_CFG` is true (interactive mode):** Skip this entire sub-section. Go directly to the standard display and AskUserQuestion below (unchanged).
547:   AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
550:**If `--auto` flag present AND `AUTO_CFG` is not true:** Persist auto-advance to config (handles direct `--auto` usage without new-project):
555:**If `--auto` flag present OR `AUTO_CFG` is true:**

$ grep -n "r4_pre_filter" qgsd-core/workflows/discuss-phase.md
194:<step name="r4_pre_filter">
286:**First, display auto-resolved assumptions (from r4_pre_filter):**
```

---

## Summary

Phase v0.13-02 implemented all four requirements. The verification confirms:

1. **QUORUM-01** — `qgsd-quorum-slot-worker` dispatch and `update-scoreboard` present in plan-milestone-gaps.md Step 5; "Wait for user confirmation" absent (0 matches). AskUserQuestion fully replaced.
2. **LOOP-04** — `FIRST_GAP_PHASE` assignment + Task spawn with `subagent_type="general-purpose"` and `--auto` flag confirmed at lines 200–222 of plan-milestone-gaps.md.
3. **QUORUM-02** — `qgsd-quorum-slot-worker` dispatch, compact prompt, `update-scoreboard`, plan-phase `--gaps --auto` spawn, and updated `offer_next` Exception note all confirmed in execute-phase.md. Untouched branches (passed, human_needed) are preserved.
4. **QUORUM-03** — Section heading at line 237, `AUTO_CFG` gate, `update-scoreboard`, interactive-mode bypass, and intact `r4_pre_filter` step all confirmed in discuss-phase.md. Second quorum pass fires only in auto mode, preserving existing AskUserQuestion path for interactive use.
