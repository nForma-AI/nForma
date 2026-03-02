---
phase: quick-127
plan: 01
task_count: 2
completed_tasks: 2
files_modified: 2
date: 2026-03-02
status: complete
commits:
  - hash: "pending"
    message: "docs(quick-127): fix auto-advance chain"
---

# Quick Task 127: Fix auto-advance chain Summary

**One-liner:** Structured PHASE_COMPLETE signal from execute-phase eliminates dead-end transition flow; plan-phase parses and invokes Skill(plan-phase NEXT --auto) for flat auto-advance chain.

## Objective

Fix the auto-advance chain so it actually continues to the next phase instead of printing a dead-end "Next: ..." message. When running `--auto`, the pipeline should flow plan -> execute -> plan(next) -> execute(next) without manual intervention. Previously execute-phase tried to read transition.md inline (heavy context), and plan-phase just printed a suggestion instead of invoking the next step.

## Execution Summary

### Task 1: Replace execute-phase offer_next with structured PHASE_COMPLETE return

**Files modified:** `/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md`

**Changes:**
- Replaced inline transition.md read (lines 535-537) with structured PHASE_COMPLETE signal return
- Added display banner confirming phase completion
- Defined PHASE_COMPLETE markdown block with 5 required fields:
  - `status: PHASE_COMPLETE`
  - `completed_phase: {PHASE}`
  - `next_phase: {next_phase}`
  - `next_phase_name: {next_phase_name}`
  - `is_last_phase: {is_last_phase}`
- Added critical variable sourcing documentation: variables come from `gsd-tools phase complete` JSON output (line 491 update_roadmap step)
- Added fallback logic: if variables are empty/undefined (parse failure), fall through to non-auto behavior so plan-phase can detect gracefully
- Added design rationale: execute-phase returns signal → plan-phase handles routing → context stays flat, no nested workflow reads
- Preserved exception paragraph (gaps_found) unchanged
- Preserved non-auto fallback behavior unchanged

**Verification:**
- PHASE_COMPLETE structured format confirmed (5 fields present)
- No inline transition.md read in auto path
- Non-auto fallback preserved
- Gaps_found exception preserved
- All required fields documented with source references

---

### Task 2: Replace plan-phase return handler with Skill invocation for chain continuation

**Files modified:** `/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md`

**Changes:**
- Replaced dead-end "Next: /qgsd:discuss-phase" text (lines 680) with active chain continuation logic
- Added structured parsing of execute-phase PHASE_COMPLETE marker and field extraction
- Implemented is_last_phase=true case: displays milestone-complete banner and stops chain
- Implemented is_last_phase=false case: displays continuation banner and invokes `Skill("/qgsd:plan-phase ${NEXT_PHASE} --auto")` at top level
- Added design note explaining Skill choice: keeps chain flat at orchestrator level, avoids nested Task context bleed, each Skill invocation gets fresh 200k context window
- Added graceful fallback: if PHASE_COMPLETE marker missing or fields cannot be extracted, displays manual transition prompt instead of crashing
- Preserved GAPS FOUND / VERIFICATION FAILED handler unchanged (lines 720-726)
- Preserved non-auto fallback behavior unchanged

**Verification:**
- PHASE_COMPLETE marker parsing confirmed
- Field extraction (completed_phase, next_phase, next_phase_name, is_last_phase) documented
- Milestone-complete case (is_last_phase=true) with banner confirmed
- Auto-advance case (is_last_phase=false) with Skill invocation confirmed
- Graceful fallback (manual transition prompt on parse failure) confirmed
- GAPS FOUND handler preserved
- Non-auto fallback preserved
- No dead-end "Next: ..." text remains

---

## Contract Verification

**execute-phase → plan-phase handoff:**

1. **Emit format (execute-phase):**
   ```markdown
   ## PHASE_COMPLETE

   - **status:** PHASE_COMPLETE
   - **completed_phase:** {PHASE}
   - **next_phase:** {next_phase}
   - **next_phase_name:** {next_phase_name}
   - **is_last_phase:** {is_last_phase}
   ```

2. **Parse format (plan-phase):**
   - Looks for `## PHASE_COMPLETE` marker
   - Extracts: `next_phase`, `next_phase_name`, `is_last_phase`
   - Routes based on `is_last_phase` value

3. **Match verified:** Exact field names and structure documented in both files

---

## Auto-Advance Chain Flow

**Before fix (broken):**
```
plan-phase -> Task(execute-phase) -> inline transition.md -> dead-end "Next: ..."
```

**After fix (working):**
```
plan-phase -> Task(execute-phase) -> PHASE_COMPLETE return -> plan-phase parser
-> Skill(plan-phase NEXT) -> Task(execute-phase NEXT) -> ...
```

Chain is flat (no nested Task-inside-Task-inside-transition), context stays lean (~10-15% orchestrator + fresh 200k per Skill), each phase execution gets isolated context.

---

## Design Decisions

- **Structured return vs inline read:** PHASE_COMPLETE signal allows orchestrator to route without loading full transition.md (avoids context budget explosion)
- **Skill vs Task for next phase:** Skill invocation keeps chain at orchestrator level, avoids nested Tasks that accumulate context
- **Graceful fallback on parse failure:** If variables are empty/undefined, fall back to manual transition prompt rather than crashing or producing silent undefined behavior
- **Flat chain architectural goal:** Option C from consensus — avoid nested workflow reads, keep orchestrator lean, use structured signals + routing

---

## Non-Auto Behavior

Both workflows preserve non-auto behavior unchanged:
- execute-phase: if not `--auto` or AUTO_CFG false, workflow ends with manual transition suggestion
- plan-phase: if not `--auto` or AUTO_CFG false, routes to existing `<offer_next>` section

---

## Testing Notes

The chain is activated by:
1. Running `/qgsd:execute-phase {PHASE} --auto` from execute-phase workflow, OR
2. Running `/qgsd:plan-phase {PHASE} --auto` from plan-phase workflow (which spawns execute as Task)

Auto-advance works when:
- `--auto` flag is explicitly passed, OR
- `workflow.auto_advance` config is true

Variables `next_phase`, `next_phase_name`, `is_last_phase` come from gsd-tools phase complete JSON output — ensure this step completes successfully before offer_next step runs (it already does in the workflow sequence).

---

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed with exact specifications:
1. execute-phase offer_next returns structured PHASE_COMPLETE with all 5 required fields
2. plan-phase handler parses PHASE_COMPLETE and invokes Skill(plan-phase NEXT --auto) for continuation
3. Graceful fallback (parse failure → manual transition prompt) implemented
4. Design rationale documented in both files
5. Non-auto behavior preserved in both files

---

## Self-Check

- [x] execute-phase.md lines 514-557: offer_next step updated with PHASE_COMPLETE return
- [x] plan-phase.md lines 671-729: Handle execute-phase return section updated with parsing logic
- [x] Both files commit ready
- [x] Workflow contract (PHASE_COMPLETE marker + fields) verified to match in both files
