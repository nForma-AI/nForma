---
phase: quick-41
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
autonomous: true
requirements:
  - QUICK-41
must_haves:
  truths:
    - "Invoking /qgsd:quorum with no arguments automatically infers the open question from conversation context and runs the full quorum protocol on it"
    - "The inference algorithm follows a deterministic priority order: last explicit question asked → last decision requiring input → last open concern"
    - "Claude displays what question it inferred before proceeding, so the user can see what quorum is evaluating"
    - "If no question can be inferred after applying the algorithm, Claude states exactly what it looked for and stops gracefully"
  artifacts:
    - path: "commands/qgsd/quorum.md"
      provides: "Updated quorum command with robust auto-inference for empty-argument invocation"
      contains: "priority order inference algorithm"
  key_links:
    - from: "Mode A Step 1 (empty $ARGUMENTS branch)"
      to: "conversation context scan"
      via: "deterministic priority algorithm"
      pattern: "Priority 1.*Priority 2.*Priority 3"
---

<objective>
Strengthen `/qgsd:quorum` so that invoking it with no arguments automatically and reliably infers the open question from the current conversation context and runs the full quorum protocol on it.

Purpose: Currently the empty-argument path says "identify the open question from conversation context" without specifying how. This makes the auto-inference fragile and non-deterministic. Adding a concrete priority-ordered inference algorithm makes the command self-sufficient for follow-up question scenarios.

Output: Updated `commands/qgsd/quorum.md` with a deterministic inference algorithm in Mode A Step 1.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quorum.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add deterministic question-inference algorithm to Mode A Step 1</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
In `commands/qgsd/quorum.md`, replace the Mode A Step 1 section's empty-argument handling with a concrete priority-ordered inference algorithm.

The current text says:
```
If empty, identify the open question from conversation context and display:
Using conversation context as question: "[inferred question]"

If no question can be inferred, stop: "Usage: /qgsd:quorum <question or prompt>"
```

Replace this with a structured algorithm block that specifies exactly how Claude scans the conversation:

```
If $ARGUMENTS is empty, scan the current conversation using this priority order:

Priority 1 — Explicit question: Find the most recent message containing a literal "?" that has not yet received a substantive answer. Use that as the question.

Priority 2 — Pending decision: Find the most recent message that describes a choice or trade-off between options (keywords: "should we", "which approach", "option A vs", "do we", "whether to"). Use that as the question.

Priority 3 — Open concern or blocker: Find the most recent message that raises a concern, flags a risk, or states something is unclear (keywords: "not sure", "concern", "blocker", "question:", "unclear", "wondering"). Restate it as a question.

If none of the above applies: stop with:
"No open question found. Looked for: explicit '?' question, pending decision, or open concern in recent conversation. Provide a question explicitly: /qgsd:quorum <question>"
```

When a question is inferred via any priority, Claude MUST display before proceeding:
```
Using conversation context as question (Priority N — [type]):
"[inferred question text]"
```

This replaces the vague single-line instruction with a deterministic algorithm that Claude can apply mechanically. The rest of Mode A (Steps 2–7) remains unchanged.

No other changes to the file.
  </action>
  <verify>
Read the updated commands/qgsd/quorum.md and confirm:
1. Mode A Step 1 contains "Priority 1", "Priority 2", "Priority 3" labels
2. Each priority specifies concrete detection criteria (literal "?", keywords for decisions, keywords for concerns)
3. The graceful-stop message lists what was looked for
4. The display format shows which priority matched
5. All other sections (Mode B, Steps 2-7, scoreboard updates) are unchanged
  </verify>
  <done>
commands/qgsd/quorum.md Mode A Step 1 has a priority-ordered inference algorithm with three concrete detection tiers and a clear graceful-stop message. Invoking /qgsd:quorum with no arguments will apply this algorithm deterministically rather than relying on vague "identify from context" instruction.
  </done>
</task>

</tasks>

<verification>
Read commands/qgsd/quorum.md after the edit and verify:
- Mode A Step 1 contains the three-priority algorithm
- The rest of the file is intact (Mode B, all steps, scoreboard update commands)
- No unintended whitespace or formatting regressions
</verification>

<success_criteria>
/qgsd:quorum invoked with no arguments applies a deterministic 3-priority algorithm to find the open question: (1) literal "?" unanswered, (2) pending decision phrasing, (3) open concern/blocker. Claude displays which priority matched and what question it inferred before running quorum. If none match, Claude stops with a specific message describing what it looked for.
</success_criteria>

<output>
After completion, create `.planning/quick/41-make-qgsd-quorum-use-quorum-automaticall/41-SUMMARY.md`
</output>
