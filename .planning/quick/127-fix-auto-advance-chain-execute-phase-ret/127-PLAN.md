---
phase: quick-127
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
autonomous: true
requirements: [CHAIN-01, CHAIN-02]

must_haves:
  truths:
    - "execute-phase returns structured PHASE_COMPLETE signal with next_phase identifier when auto-advancing, instead of reading transition.md inline"
    - "plan-phase parses execute-phase structured return and invokes Skill(plan-phase NEXT --auto) to continue the chain at the top level"
    - "The auto-advance chain stays flat (no nested Task-inside-Task-inside-transition-inside-execute)"
    - "Non-auto mode behavior is unchanged in both workflows"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md"
      provides: "Structured return from offer_next step"
      contains: "PHASE_COMPLETE"
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md"
      provides: "Return handler that invokes next plan-phase"
      contains: "plan-phase"
  key_links:
    - from: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md"
      to: "/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md"
      via: "structured return value parsed by plan-phase return handler"
      pattern: "PHASE_COMPLETE.*next_phase"
    - from: "/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md"
      to: "/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md"
      via: "self-invocation via Skill for next phase"
      pattern: "plan-phase.*--auto"
---

<objective>
Fix the auto-advance chain so it actually continues to the next phase instead of printing a dead-end "Next: ..." message.

Purpose: When running `--auto`, the pipeline should flow plan -> execute -> plan(next) -> execute(next) without manual intervention. Currently execute-phase tries to run transition.md inline (heavy context), and plan-phase just prints a suggestion instead of invoking the next step. Option C (quorum consensus) fixes this by making execute-phase return a structured signal that plan-phase can act on.

Output: Two modified workflow .md files with a working flat auto-advance chain.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/debates/2026-03-02-fix-auto-advance-chain-approach.md
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
@/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace execute-phase offer_next inline transition with structured return</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
Edit the `<step name="offer_next">` section (lines 514-542) in execute-phase.md.

**Keep unchanged:** The exception paragraph about gaps_found (line 516), the auto-advance detection logic (lines 518-524), and the non-auto fallback (lines 539-541).

**Replace the auto-advance action block (lines 526-537)** with a structured return signal. The new behavior when `--auto` flag present OR `AUTO_CFG` is true (AND verification passed with no gaps):

1. Display a concise banner:
```
======================================
 PHASE {X} COMPLETE -- returning signal
 next_phase: {next_phase}
======================================
```

2. Return a structured result (output as markdown that the calling plan-phase can parse). The result must contain these exact markers for reliable parsing:
```
## PHASE_COMPLETE

- **status:** PHASE_COMPLETE
- **completed_phase:** {PHASE}
- **next_phase:** {next_phase from update_roadmap step}
- **next_phase_name:** {next_phase_name from update_roadmap step}
- **is_last_phase:** {is_last_phase from update_roadmap step}
```

3. Do NOT read or follow transition.md. Do NOT use Task or Skill to invoke anything. The workflow ends here -- the caller (plan-phase) handles the chain continuation.

**Variable sourcing (CRITICAL):** Before constructing the PHASE_COMPLETE markdown block, verify that the variables `next_phase`, `next_phase_name`, and `is_last_phase` are available from the `update_roadmap` step output. These come from the JSON result of `gsd-tools phase complete "${PHASE_NUMBER}"` (line 491 of execute-phase.md). The step already says "Extract from result: `next_phase`, `next_phase_name`, `is_last_phase`" (line 501). The PHASE_COMPLETE block MUST use these extracted values -- not hardcoded placeholders. If the `phase complete` call fails or returns malformed JSON, the offer_next step should fall through to the non-auto fallback (display manual transition suggestion) rather than emitting a PHASE_COMPLETE block with empty/undefined values.

**Key detail:** The `update_roadmap` step (lines 487-512) already calls `gsd-tools phase complete` which handles all critical state updates (ROADMAP checkbox, STATE.md advancement, REQUIREMENTS.md). The transition.md bookkeeping (PROJECT.md evolution, session continuity, etc.) is non-critical for auto-advance and can be done later via manual `/qgsd:transition`.

**Also update the comment on line 535 ("do NOT use Task" rationale) to explain the new design:** execute-phase returns a structured signal; the orchestrator (plan-phase) handles chain continuation. This keeps context flat and avoids nested workflow reads.

**Non-auto behavior (lines 539-541) stays exactly the same:** workflow ends, user runs `/qgsd:progress` or invokes transition manually.
  </action>
  <verify>
Read the modified execute-phase.md lines 514-545. Confirm:
1. The PHASE_COMPLETE structured result format is present with all 5 fields (status, completed_phase, next_phase, next_phase_name, is_last_phase)
2. No reference to reading transition.md inline remains in the auto path
3. The non-auto fallback is still intact
4. The gaps_found exception paragraph is still intact
  </verify>
  <done>
execute-phase offer_next step returns a structured PHASE_COMPLETE signal when auto-advancing, does not read transition.md, and preserves all non-auto behavior unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace plan-phase return handler with Skill invocation for chain continuation</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/plan-phase.md</files>
  <action>
Edit the "Handle execute-phase return" section (lines 671-688) in plan-phase.md.

**Replace the PHASE COMPLETE handler (lines 672-681)** with logic that:

1. Parses the structured return from execute-phase. Look for the `## PHASE_COMPLETE` marker and extract `next_phase`, `next_phase_name`, and `is_last_phase` fields.

2. **If `is_last_phase` is true:** Display milestone completion banner and stop the chain:
```
=============================================
 QGSD -- MILESTONE COMPLETE
=============================================

All phases finished. Run /qgsd:audit-milestone to review.
```

3. **If `is_last_phase` is false (more phases remain):** Display a continuation banner and invoke the next plan-phase:
```
=============================================
 QGSD -- AUTO-ADVANCING TO NEXT PHASE
 Phase ${NEXT_PHASE}: ${NEXT_PHASE_NAME}
=============================================
```

Then invoke at the TOP LEVEL (not inside a Task):
```
Skill("/qgsd:plan-phase ${NEXT_PHASE} --auto")
```

Add a note explaining: "Use Skill (not Task) to keep the chain flat at the orchestrator level. Each Skill invocation gets its own context window. This is the core of Option C from the quorum consensus."

4. **Fallback if PHASE_COMPLETE parsing fails:** If the `## PHASE_COMPLETE` marker is missing from execute-phase's return, or if `next_phase`/`next_phase_name`/`is_last_phase` cannot be extracted (empty, undefined, or malformed), do NOT crash or silently swallow the error. Instead, fall back to a user-facing manual transition prompt:
```
=============================================
 QGSD -- AUTO-ADVANCE PARSE FAILURE
 Could not extract next phase from execute-phase return.
 Manual transition required.
=============================================

Next: /qgsd:transition   (to advance manually)
```
This ensures the chain degrades gracefully rather than hanging or producing undefined behavior.

5. **Keep the GAPS FOUND / VERIFICATION FAILED handler (lines 682-688) exactly the same.** This already correctly stops the chain.

6. **Keep the non-auto fallback (lines 690-691) exactly the same.**

**Important:** The Skill invocation should use the slash command format: `Skill("/qgsd:plan-phase ${NEXT_PHASE} --auto")`. This ensures plan-phase is invoked fresh at the top level, not nested inside the current plan-phase's Task tree.
  </action>
  <verify>
Read the modified plan-phase.md lines 671-700. Confirm:
1. The PHASE_COMPLETE handler parses next_phase, next_phase_name, is_last_phase from the structured return
2. is_last_phase=true case displays milestone completion and stops
3. is_last_phase=false case invokes Skill("/qgsd:plan-phase ${NEXT_PHASE} --auto")
4. Fallback clause exists: if PHASE_COMPLETE marker is missing or fields cannot be extracted, displays manual transition prompt instead of crashing
5. GAPS FOUND handler is preserved unchanged
6. Non-auto fallback is preserved unchanged
7. No "Next: /qgsd:discuss-phase" dead-end text remains
  </verify>
  <done>
plan-phase return handler parses execute-phase structured result and invokes Skill(plan-phase NEXT --auto) for chain continuation. Milestone-complete case stops the chain. Gaps/failure case stops the chain. Parse-failure case falls back to manual transition prompt (graceful degradation). The "Next: ..." dead-end text is gone.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. Read execute-phase.md offer_next step -- confirm structured PHASE_COMPLETE return, no transition.md reference in auto path
2. Confirm execute-phase only emits PHASE_COMPLETE when next_phase/next_phase_name/is_last_phase are valid (sourced from gsd-tools phase complete JSON output); falls through to non-auto behavior if variables are missing
3. Read plan-phase.md auto-advance section -- confirm Skill invocation, no dead-end "Next:" text
4. Verify the contract: execute-phase outputs `## PHASE_COMPLETE` with fields, plan-phase parses `## PHASE_COMPLETE` and extracts fields -- the format must match exactly
5. Verify plan-phase has graceful fallback: if PHASE_COMPLETE parsing fails, displays manual transition prompt instead of crashing
6. Verify non-auto paths in both files are untouched
</verification>

<success_criteria>
- execute-phase returns structured PHASE_COMPLETE signal (not inline transition) when auto-advancing
- plan-phase invokes Skill(plan-phase NEXT --auto) on receiving PHASE_COMPLETE (not printing dead-end text)
- Auto-advance chain is flat: plan-phase -> Task(execute-phase) -> return -> Skill(plan-phase NEXT) -> Task(execute-phase NEXT) -> ...
- Non-auto behavior unchanged in both workflows
- is_last_phase=true terminates the chain with milestone-complete message
</success_criteria>

<output>
After completion, create `.planning/quick/127-fix-auto-advance-chain-execute-phase-ret/127-SUMMARY.md`
</output>
