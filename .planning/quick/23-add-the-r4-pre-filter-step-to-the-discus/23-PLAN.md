---
phase: quick-23
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/discuss-phase.md
autonomous: true
requirements:
  - META-01
must_haves:
  truths:
    - "The discuss-phase workflow runs R4 pre-filter on every gray area before showing checkboxes to the user"
    - "Gray areas where all available models reach consensus are recorded as assumptions and never shown to the user"
    - "Gray areas without consensus after deliberation (up to 3 rounds) are escalated to the user"
    - "The user-facing output leads with the auto-resolved assumptions list before the remaining questions"
    - "Claude forms its own position on each question before querying external models"
  artifacts:
    - path: "get-shit-done/workflows/discuss-phase.md"
      provides: "r4_pre_filter step inserted between analyze_phase and present_gray_areas"
      contains: "r4_pre_filter"
  key_links:
    - from: "analyze_phase step"
      to: "r4_pre_filter step"
      via: "sequential step ordering in <process>"
      pattern: "r4_pre_filter"
    - from: "r4_pre_filter step"
      to: "present_gray_areas step"
      via: "passes only non-consensus questions forward"
      pattern: "present_gray_areas"
---

<objective>
Insert the R4 pre-filter step into the discuss-phase workflow between analyze_phase and present_gray_areas.

Purpose: R4 in CLAUDE.md mandates that before presenting gray area questions to the user, each question must be run through quorum. Questions reaching consensus are silently resolved as assumptions; only questions without consensus are shown to the user. The discuss-phase workflow currently lacks this step entirely.

Output: Updated get-shit-done/workflows/discuss-phase.md with a new `r4_pre_filter` step that implements the full R4 decision table and feeds filtered output to `present_gray_areas`.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/CLAUDE.md
@/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/discuss-phase.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert r4_pre_filter step into discuss-phase.md</name>
  <files>get-shit-done/workflows/discuss-phase.md</files>
  <action>
Insert a new `<step name="r4_pre_filter">` block immediately after the closing `</step>` of `analyze_phase` and immediately before the opening `<step name="present_gray_areas">`. The new step must implement R4 exactly as specified in CLAUDE.md.

The step content:

```xml
<step name="r4_pre_filter">
Apply the R4 pre-filter (CLAUDE.md §R4) to every gray area candidate before presenting anything to the user.

**This step is MANDATORY. Do NOT skip even if gray areas seem obvious.**

**For each gray area question identified in analyze_phase:**

1. **Form Claude's own position first** — Bias toward the long-term solution. Write a 1-2 sentence answer and your confidence level internally before querying other models. This is Claude's active quorum vote.

2. **Query each external model sequentially** (one separate tool call per model — NOT sibling calls):
   - Codex (`mcp__codex-cli__review`)
   - Gemini (`mcp__gemini-cli__gemini`)
   - OpenCode (`mcp__opencode__opencode`)
   - Copilot (`mcp__copilot-cli__ask`)

   Prompt template (use identical prompt for all models):
   ```
   Context: We are planning [phase name] for the QGSD project.
   Phase goal: [goal from ROADMAP.md]
   Codebase context: [relevant patterns/decisions from STATE.md and prior summaries]

   Gray area question: [question text]

   Should this be decided by quorum now (removing it from the user's question list), or does it genuinely require the user's vision/preference to answer?

   If quorum can decide: provide the recommended answer biased toward the long-term solution.
   If user input is needed: explain why quorum cannot resolve this without user preference.

   Respond with: CONSENSUS-READY: [answer] or USER-INPUT-NEEDED: [reason]
   ```

3. **Collect all positions.** Apply the R4 decision table:

   | Outcome | Action |
   |---|---|
   | All available models agree on CONSENSUS-READY + same answer | Record as assumption. Remove from user-facing question list. |
   | Any model returns USER-INPUT-NEEDED, OR models give conflicting CONSENSUS-READY answers | Run R3.3 deliberation (up to 3 rounds). |
   | Still no consensus after 3 deliberation rounds | Mark for user presentation. |

4. **Maintain two lists:**
   - `auto_resolved[]` — Questions resolved by consensus, with the recorded assumption
   - `for_user[]` — Questions that could not be resolved by quorum

5. **Apply R6 tool failure policy:** If a model is UNAVAILABLE, proceed with available models per R6. Note the reduced quorum for each affected question.

6. **After processing all questions:** Pass `auto_resolved[]` and `for_user[]` to the `present_gray_areas` step.

**If `for_user[]` is empty** (all questions resolved): Skip `present_gray_areas`. Go directly to `discuss_areas` with a note:
```
All gray areas were resolved by quorum consensus. Proceeding with auto-resolved assumptions:

[list each assumption]

No further input needed for this phase. Proceeding to context capture.
```
Then jump to `write_context`.
</step>
```

After inserting the step, also update the `present_gray_areas` step to:
1. Acknowledge it receives only the non-consensus questions from `r4_pre_filter`
2. Prepend the auto-resolved assumptions list before showing the checkboxes

Specifically, replace the opening of the `present_gray_areas` step's "First, state the boundary" block to add this display before the checkbox AskUserQuestion:

```
**First, display auto-resolved assumptions (from r4_pre_filter):**

If `auto_resolved[]` is non-empty, display:
```
## Auto-Resolved by Quorum

The following gray areas were resolved without needing your input:

[For each item in auto_resolved[]:
- [Question text] → [Recorded assumption]]
```

Then display the domain boundary and present only the `for_user[]` items as checkboxes.
```

Do NOT change any other part of the workflow — only insert the new step and add the auto-resolved prefix to present_gray_areas.
  </action>
  <verify>
    1. Read the updated file and confirm the `r4_pre_filter` step exists between `analyze_phase` and `present_gray_areas`
    2. Confirm the step contains: "Form Claude's own position first", the four model names, the decision table with CONSENSUS-READY/USER-INPUT-NEEDED, "auto_resolved[]", "for_user[]", and the R6 reference
    3. Confirm `present_gray_areas` now has the auto-resolved display block at its start
    4. Confirm step ordering in `<process>`: initialize → check_existing → analyze_phase → r4_pre_filter → present_gray_areas → discuss_areas → write_context → confirm_creation → git_commit → update_state → auto_advance
  </verify>
  <done>
    - `r4_pre_filter` step is present in the workflow file between analyze_phase and present_gray_areas
    - The step implements the full R4 decision table (form own position, query 4 models sequentially, consensus → assumption, no consensus → deliberation → escalate to user)
    - auto_resolved[] and for_user[] lists are defined and handed to present_gray_areas
    - present_gray_areas displays auto-resolved assumptions before the user checkbox list
    - All other workflow steps are unchanged
  </done>
</task>

</tasks>

<verification>
After execution:
- Read get-shit-done/workflows/discuss-phase.md
- Confirm r4_pre_filter step exists as a named step in <process>
- Confirm step position: after analyze_phase, before present_gray_areas
- Confirm R4 compliance: Claude votes first, 4 models queried sequentially, decision table present, 3-round deliberation cap, R6 referenced, auto_resolved[] feeds into present_gray_areas
- Confirm present_gray_areas shows auto-resolved block before checkboxes
</verification>

<success_criteria>
The discuss-phase workflow enforces R4 by filtering every gray area through quorum before any question reaches the user. Users see only questions that quorum could not resolve, preceded by the list of auto-resolved assumptions.
</success_criteria>

<output>
After completion, create `.planning/quick/23-add-the-r4-pre-filter-step-to-the-discus/23-SUMMARY.md` using the summary template.
</output>
