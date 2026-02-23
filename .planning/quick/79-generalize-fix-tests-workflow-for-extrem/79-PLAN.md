---
phase: quick-79
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/fix-tests.md
autonomous: true
requirements: [QUICK-79]

must_haves:
  truths:
    - "The Python batch runner is generated unconditionally on every fresh run regardless of batch count"
    - "The manual loop (Steps 6a-6h) is retained as fallback-only with a clear fallback label and trigger condition"
    - "Step 5-post AI reclassification still runs after the runner exits for all heuristic real_bug verdicts"
    - "Step 6h dispatch still runs after Step 5-post completes — Claude handles dispatch, not the runner"
    - "The state handoff block (printed by runner at exit) is explicitly documented so Claude knows what to read"
    - "The threshold comment (> 5 batches) is removed from Step 5"
  artifacts:
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "Revised fix-tests workflow with unconditional Python runner"
      contains: "Python batch runner is the unconditional default"
  key_links:
    - from: "Step 5 (batch loop)"
      to: "Python runner generation"
      via: "unconditional — no threshold check"
      pattern: "unconditional"
    - from: "runner exit"
      to: "Step 5-post"
      via: "state handoff block read by Claude"
      pattern: "RUNNER COMPLETE"
    - from: "Step 5-post"
      to: "Step 6h dispatch"
      via: "Claude-directed Task agents"
      pattern: "proceed.*Step 6h"
---

<objective>
Generalize the fix-tests Python batch runner from a large-suite optimization (>5 batches) to the unconditional default for all runs, demoting the manual loop to an explicit fallback.

Purpose: The current threshold (>5 batches) is arbitrary. Context window exhaustion and state drift are failure modes for any run. A Python subprocess that persists state after every batch is strictly better than a manual loop for all suite sizes. Making it unconditional eliminates the decision branch and makes the workflow robust for 100+ batch suites.

Output: Updated `get-shit-done/workflows/fix-tests.md` with:
- Step 5 "Execution Strategy" section rewritten — Python runner is default, manual loop is fallback
- Python runner script template retained verbatim
- Step 5-post (AI reclassification) applies to all runs, not just large-suite path
- State handoff block documented as structured output to read after runner exits
- Dispatch (Step 6h and 6h.1) remains Claude-driven after Step 5-post
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite Step 5 to make Python runner unconditional and manual loop a fallback</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Edit `get-shit-done/workflows/fix-tests.md` — Step 5 section and Step 5-post section only. Do not touch any other steps.

**Changes to make:**

1. **Replace the "Execution Strategy" subsection** (currently has two bullets: "Small suite" and "Large suite") with:

```
### Execution Strategy

**Default (all runs):** Generate and execute the Python batch runner script. The script runs all remaining batches in a single subprocess, applies heuristic pre-classification inline, and saves state to disk after every batch. This prevents per-batch context accumulation from exhausting the context window regardless of suite size.

**Fallback (runner unavailable):** If `python3` is not available or the runner fails to start, fall back to the manual loop (Steps 6a–6h below). The manual loop is retained for portability only — use it only when Python is unavailable.
```

2. **Rename the "Python Batch Runner (large suite path)" subsection heading** to:

```
### Python Batch Runner (default path)
```

   The script template and all code within it stays verbatim — do NOT modify any Python code.

3. **Update Step 5-post heading and scope** — change the parenthetical from "(large suite path only)" to "(all runs)":

```
### Step 5-post: AI Reclassification of Heuristic real_bug Verdicts (all runs)
```

   Also update the body text of Step 5-post: replace "After the batch runner exits" with "After the Python batch runner exits" and remove the sentence "The batch loop below does NOT run for large suites." Replace it with: "The manual loop below is fallback-only (see Execution Strategy above)."

4. **Add a "State Handoff Block" paragraph** immediately before the `---` separator that ends Step 5-post (the one before "For each batch index B starting from..."). Insert:

```
### State Handoff Block

The Python runner prints a structured summary as its final output after `RUNNER COMPLETE`. After the runner exits, read this output and the state file to confirm:
- `batches_complete` value (how many batches ran)
- Category counts from `results_by_category` (printed by runner)
- Count of heuristic real_bug verdicts needing AI review (all `categorization_verdicts` where `heuristic == true` AND `category == "real_bug"`)

This handoff information drives Step 5-post: if the heuristic real_bug count is 0, skip Step 5-post and go directly to Step 6h dispatch.
```

5. **Update the manual loop header** — the line immediately after Step 5-post's `---` separator currently reads: "For each batch index B starting from `batches_complete` up to `total_batches - 1` (zero-based):"

   Replace it with:

```
### Manual Loop (fallback only — use only when Python is unavailable)

For each batch index B starting from `batches_complete` up to `total_batches - 1` (zero-based):
```

   Everything after this line (Steps 6a through 6h.1 and their full content) stays verbatim.
  </action>
  <verify>
After editing, confirm:
1. `grep -n "unconditional\|all runs\|fallback" get-shit-done/workflows/fix-tests.md` — finds the new labels
2. `grep -n "large suite path" get-shit-done/workflows/fix-tests.md` — returns zero matches (old label removed)
3. `grep -n "State Handoff Block" get-shit-done/workflows/fix-tests.md` — finds the new section
4. `grep -n "Manual Loop (fallback" get-shit-done/workflows/fix-tests.md` — finds the renamed section
5. `grep -n "def heuristic_categorize\|RUNNER COMPLETE\|batches_complete" get-shit-done/workflows/fix-tests.md` — all three still present (Python script untouched)
6. `grep -n "6h\|6h.1\|dispatch" get-shit-done/workflows/fix-tests.md | tail -20` — dispatch steps still present
  </verify>
  <done>
Step 5 Execution Strategy declares the Python runner as the unconditional default with no threshold condition. Step 5-post applies to all runs. A State Handoff Block section exists between Step 5-post and the manual loop. The manual loop is clearly labeled as fallback-only. The Python script template is byte-for-byte unchanged. All dispatch steps (6h, 6h.1) remain intact.
  </done>
</task>

</tasks>

<verification>
Run verification commands from Task 1's verify block. All six grep checks must pass. Also manually review the Step 5 section in the edited file to confirm the flow reads: generate runner → run runner → read state handoff → Step 5-post AI reclassification (if heuristic real_bugs > 0) → Step 6h dispatch.
</verification>

<success_criteria>
- Python runner is generated unconditionally on every fresh run (no threshold check in Step 5)
- "large suite path only" label is gone; "all runs" label is present in Step 5-post
- State Handoff Block section documents what to read after runner exits and the skip condition for Step 5-post
- Manual loop is labeled "fallback only — use only when Python is unavailable"
- Python script template unchanged
- Dispatch steps (6h, 6h.1) unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/79-generalize-fix-tests-workflow-for-extrem/79-SUMMARY.md`
</output>
