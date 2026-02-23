---
phase: quick-86
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
autonomous: true
requirements: [QUICK-86]

must_haves:
  truths:
    - "When quorum BLOCKs a quick plan, the orchestrator sends the block rationale back to the planner for targeted revision (max 2 iterations)"
    - "After each quorum-triggered revision, the plan-checker loop runs again before re-running quorum"
    - "After 2 quorum-BLOCK iterations with no resolution, the orchestrator presents the block list to the user with abort/force options"
    - "The quorum revision loop tracks quorum_iteration_count independently from Step 5.5's iteration_count — each loop manages its own cycle counter"
    - "A BLOCK on the second attempt (iteration 2) triggers abort/force prompt — not a silent third attempt"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/quick.md"
      provides: "Updated quick workflow with revision loop after quorum BLOCK"
      contains: "Revision loop after quorum BLOCK"
  key_links:
    - from: "Step 5.7 quorum BLOCKED branch"
      to: "planner revision sub-agent"
      via: "Task(subagent_type=general-purpose, model=planner_model) with block rationale"
      pattern: "quorum_block_reasons"
    - from: "planner revision"
      to: "Step 5.5 re-entry point"
      via: "re-run plan-checker then re-run quorum"
      pattern: "iteration_count"
---

<objective>
Add a revision loop to Step 5.7 (quorum review) of the quick workflow, analogous to the existing revision loop in Step 5.5 (plan-checker).

Purpose: When quorum BLOCKs a quick plan, the current workflow dead-ends by reporting the block to the user and stopping. This means the planner's work is wasted and the user must restart. A revision loop (max 2 iterations) allows the planner to fix the specific issues quorum identified, then re-check and re-submit — the same pattern already proven in Step 5.5.

Output: Updated /Users/jonathanborduas/.claude/qgsd/workflows/quick.md with a "Revision loop after quorum BLOCK" section inside Step 5.7.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/.claude/qgsd/workflows/quick.md
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add quorum BLOCK revision loop to Step 5.7 in quick.md</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/quick.md</files>
  <action>
Read `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md` in full.

Locate **Step 5.7** (quorum review). The current "Route on quorum_result" section reads:

```
- **APPROVED:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results, then proceed to Step 6.
- **BLOCKED:** Report the blocker to the user. Do not execute.
- **ESCALATED:** Present the escalation to the user. Do not execute until resolved.
```

Replace the `**BLOCKED:**` bullet and add the revision loop text immediately after the Route block, so the full updated "Route on quorum_result" section reads:

```
**Route on quorum_result:**
- **APPROVED:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results, then proceed to Step 6.
- **BLOCKED:** Enter the quorum revision loop below.
- **ESCALATED:** Present the escalation to the user. Do not execute until resolved.

**Revision loop after quorum BLOCK (max 2 iterations):**

Track `quorum_iteration_count` (starts at 1 after initial plan + quorum check). This counter is separate from the plan-checker `iteration_count` in Step 5.5 — both track their own cycle independently.

**If quorum_iteration_count < 2:**

Display: `Quorum BLOCKED. Sending back to planner for revision... (quorum iteration ${N}/2)`

Revision prompt for planner:

```markdown
<revision_context>
**Mode:** quick-full (quorum revision)

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Existing plan)
</files_to_read>

**Quorum block reasons:** ${quorum_block_reasons}

</revision_context>

<instructions>
Make targeted updates to address the quorum block reasons.
Do NOT replan from scratch unless the issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt="First, read /Users/jonathanborduas/.claude/agents/qgsd-planner.md for your role and instructions.\n\n" + revision_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Revise quick plan (quorum block): ${DESCRIPTION}"
)
```

After planner returns:
1. Re-run the plan-checker (Step 5.5 logic, single pass — no nested revision loop). If checker returns ISSUES FOUND, note the issues but do not loop back to planner again; they will be addressed in the same revision.
2. Increment `quorum_iteration_count`.
3. Re-spawn the quorum orchestrator sub-agent (same prompt pattern as Step 5.7).
4. Route again on the new quorum_result.

**If quorum_iteration_count >= 2:**

Display: `Quorum BLOCKED after ${N} revision attempts. Issues remain:`

List the block reasons from the final quorum result.

Offer:
1. Force proceed (skip quorum gate — use only if you are confident the plan is correct)
2. Abort task
```

The ESCALATED bullet remains unchanged.

After editing, verify the file reads correctly end-to-end (no broken markdown, the revision loop block is inside Step 5.7, and the Step 6 anchor is unaffected).
  </action>
  <verify>
    grep -n "Revision loop after quorum BLOCK" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
    grep -n "quorum_iteration_count" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
    grep -n "quorum_block_reasons" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
    # All three must return matching lines
  </verify>
  <done>
    quick.md contains "Revision loop after quorum BLOCK", "quorum_iteration_count", and "quorum_block_reasons". Step 5.7 BLOCKED branch now enters the revision loop instead of dead-ending. Step 6 is unaffected.
  </done>
</task>

</tasks>

<verification>
grep -A 40 "Revision loop after quorum BLOCK" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md

Confirm:
- The revision loop section appears inside Step 5.7 (after the Route block, before Step 6)
- quorum_iteration_count is tracked separately from Step 5.5's iteration_count
- The loop re-runs plan-checker (single pass) before re-running quorum
- Max 2 iterations before offering abort/force to user
- ESCALATED and APPROVED routes are unchanged
</verification>

<success_criteria>
- Step 5.7 BLOCKED branch enters a revision loop instead of terminating
- Revision loop: send block reasons to planner → re-run plan-checker (1 pass) → re-run quorum → max 2 iterations
- After 2 failed iterations: present abort/force options to user
- quorum_iteration_count is independent of Step 5.5's iteration_count
- APPROVED and ESCALATED routes in Step 5.7 are unchanged
- No other steps in quick.md are modified
</success_criteria>

<output>
After completion, create `.planning/quick/86-deep-investigation-quick-workflow-does-n/86-SUMMARY.md`
</output>
