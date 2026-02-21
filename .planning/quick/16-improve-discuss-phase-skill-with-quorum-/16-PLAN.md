---
phase: quick-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
  - /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Claude runs quorum on all candidate gray-area questions before showing any to the user"
    - "Questions where quorum agrees on one direction are auto-resolved and recorded as assumptions (never shown to user)"
    - "Questions that are genuine preference territory are shown to the user, each with Claude's stated recommendation"
    - "The user sees auto-resolved assumptions listed before preference questions, so they know what was decided on their behalf"
    - "Auto-resolved assumptions are persisted in CONTEXT.md under ### Auto-Resolved Assumptions for planner transparency"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md"
      provides: "Updated workflow with quorum_filter step"
      contains: "quorum_filter"
    - path: "/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md"
      provides: "Updated command entry point with quorum pre-filter in process steps"
      contains: "quorum pre-filter"
  key_links:
    - from: "analyze_phase step"
      to: "quorum_filter step"
      via: "new step inserted between gray area identification and user presentation"
      pattern: "quorum_filter"
    - from: "quorum_filter step"
      to: "present_gray_areas step"
      via: "passes only unresolved preference questions forward"
      pattern: "preference questions"
---

<objective>
Add an explicit quorum pre-filter step to the discuss-phase workflow that runs quorum on all candidate gray-area questions before any are shown to the user. Questions with a clear correct direction are auto-resolved and recorded as assumptions. Only genuine user-preference questions reach the user, each accompanied by Claude's stated recommendation.

Purpose: CLAUDE.md R4 already mandates this behavior, and STATE.md notes the hooks enforce it structurally. But the workflow itself has no explicit logic for (a) the classification between "has a correct answer" vs "genuine preference", or (b) stating Claude's recommendation for preference questions. This makes the skill self-documenting and executable without relying solely on behavioral instruction.

Output: Updated discuss-phase.md workflow and command entry point.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/CLAUDE.md
@/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
@/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add quorum_filter step to discuss-phase workflow</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md</files>
  <action>
Insert a new `<step name="quorum_filter">` between `analyze_phase` and `present_gray_areas` in the workflow's `<process>` block.

The step must:

1. State that this step runs BEFORE any question is presented to the user.

2. For each candidate gray area question identified in analyze_phase, Claude runs quorum (per CLAUDE.md R3) with the question plus full phase context (ROADMAP.md phase description + any CONTEXT.md already gathered).

3. Classify each question using this decision table:
   - **Auto-resolve**: All available quorum models agree there is one clearly correct technical or standard direction → record as assumption, do NOT show to user
   - **Preference question**: Genuine trade-offs exist (multiple valid directions, real cost/benefit differences, user taste/style involved) → add to user-facing list WITH Claude's stated recommendation

4. Build two lists:
   - `assumptions[]` — auto-resolved: the question text + the agreed answer
   - `preference_questions[]` — genuine preference: the question text + Claude's recommendation + reasoning (1 sentence)

5. Persist auto-resolved assumptions: `assumptions[]` MUST be written to CONTEXT.md under an explicit `### Auto-Resolved Assumptions` section by the `write_context` step. Each entry: question text + agreed answer + "Resolved by: quorum consensus". This gives the planner full context on what was pre-decided and provides a historical record for future sessions.

6. Transition rule: If ALL candidate questions are auto-resolved (assumptions[] has all, preference_questions[] is empty), skip `present_gray_areas` and go directly to `write_context` using only the assumption data. Notify user: "All gray areas were auto-resolved by quorum. No questions needed."

7. Update quorum scoreboard (R8) after the filter round completes.

The classification heuristic:
- Auto-resolve signals: "industry standard", "no functional difference for user", "implementation detail", "unanimous best practice", "performance-determined"
- Preference signals: "visual style", "information density", "interaction model", "user workflow preference", "organizational scheme", content tone/voice"

Insert the step XML immediately after `</step>` for `analyze_phase` and before `<step name="present_gray_areas">`.

Also update `present_gray_areas` step to:
- Begin by displaying `assumptions[]` as a numbered "Auto-resolved assumptions" block before the multi-select question picker
- Only list `preference_questions[]` in the multi-select picker (NOT the full original gray area list)
- For each preference option shown, append "Claude recommends: [recommendation]" as the option description
</action>
  <verify>
grep -n "quorum_filter" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
grep -n "Auto-resolved" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
grep -n "Claude recommends" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md
</verify>
  <done>
- `quorum_filter` step exists in workflow between `analyze_phase` and `present_gray_areas`
- `assumptions[]` and `preference_questions[]` classification logic is explicit
- `present_gray_areas` shows auto-resolved assumptions before the picker
- Each preference option displays "Claude recommends:" guidance
- Transition rule for all-auto-resolved case is documented
</done>
</task>

<task type="auto">
  <name>Task 2: Update command entry point to reflect quorum pre-filter</name>
  <files>/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md</files>
  <action>
Update the `<process>` section of the command entry point to add step 3.5 (between analyze and present) that explicitly calls out the quorum pre-filter.

Current process steps:
1. Validate phase number
2. Check if CONTEXT.md exists
3. Analyze phase — identify domain and gray areas
4. Present gray areas — multi-select picker
5. Deep-dive each area
6. Write CONTEXT.md
7. Offer next steps

Updated process steps (insert between 3 and 4):
```
3. Analyze phase — identify domain and generate candidate gray area questions
3.5. Quorum pre-filter (per CLAUDE.md R4) — run quorum on ALL candidate questions:
     - Questions with clear correct direction → auto-resolve, record as assumption
     - Genuine preference questions → keep for user, add Claude's recommendation
     - Update quorum scoreboard (R8)
4. Present to user:
     - First: list of auto-resolved assumptions (what quorum decided)
     - Then: multi-select picker with only preference questions, each with "Claude recommends: X"
     - If ALL questions auto-resolved: skip picker, go to write_context
```

Also update `<objective>` description to mention the quorum pre-filter:
Add after "2. Present gray areas — user selects which to discuss":
"   (Quorum pre-filters: only genuine preference questions reach the user; auto-resolved assumptions are shown first)"

Also update `success_criteria` to add:
- "Quorum pre-filter ran on all candidate questions before user saw any"
- "Auto-resolved assumptions listed before preference questions"
- "Each preference question shown with Claude's recommendation"
</action>
  <verify>
grep -n "quorum pre-filter\|Quorum pre-filter\|auto-resolve\|Auto-resolve" /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md
grep -n "Claude recommends\|assumption" /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md
</verify>
  <done>
- Command entry point process steps include the quorum pre-filter between analyze and present
- Objective mentions the pre-filter behavior
- Success criteria includes quorum, assumptions, and recommendation requirements
- No references to get-shit-done workflow remain (command should ref qgsd workflow — fix if present)
</done>
</task>

</tasks>

<verification>
After both tasks:
1. grep -n "quorum_filter" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md — must find the new step
2. grep -n "assumptions\[\]" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md — must find classification lists
3. grep -n "preference_questions" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md — must find the second list
4. grep -n "Claude recommends" /Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md — must find recommendation pattern in present_gray_areas
5. grep -n "Quorum pre-filter\|quorum pre-filter" /Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md — must find in command entry point
6. Verify quorum_filter step appears AFTER analyze_phase step and BEFORE present_gray_areas step (line numbers confirm ordering)
</verification>

<success_criteria>
- discuss-phase workflow has an explicit quorum_filter step that classifies questions before any reach the user
- Auto-resolved questions are stored as assumptions and displayed as a block before the preference picker
- Only genuine preference questions appear in the multi-select picker
- Each preference question carries "Claude recommends: X" guidance
- Command entry point accurately describes the pre-filter in its process steps and success criteria
- The transition rule for all-auto-resolved case (skip picker entirely) is documented
- Scoreboard update (R8) is noted in the filter step
</success_criteria>

<output>
After completion, commit the two changed files:

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs commit "feat(discuss-phase): add quorum pre-filter step — auto-resolve vs preference classification" --files "/Users/jonathanborduas/.claude/qgsd/workflows/discuss-phase.md" "/Users/jonathanborduas/.claude/commands/qgsd/discuss-phase.md"
```

Then update STATE.md quick task log with entry for quick-16.
</output>
