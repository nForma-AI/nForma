---
phase: quick-60
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/fix-tests.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "Plain invocation of fix-tests always starts fresh — no resume logic fires unless --resume is passed"
    - "fix-tests never calls --disable-breaker or --enable-breaker under any code path"
    - "Resume behavior is preserved but requires explicit --resume flag to activate"
  artifacts:
    - path: "get-shit-done/workflows/fix-tests.md"
      provides: "Updated workflow without breaker steps and with --resume-gated resume logic"
  key_links:
    - from: "Step 1 (Load State)"
      to: "fresh-start vs resume branch"
      via: "--resume flag check added before STATE_JSON branch"
      pattern: "--resume"
---

<objective>
Remove circuit breaker management from fix-tests.md and gate resume behavior behind --resume.

Purpose: fix-tests should never touch the circuit breaker (orthogonal concern). Fresh run should be the default so plain invocation always starts clean; the old resume-from-state path is preserved but only activates with --resume.

Output: Updated get-shit-done/workflows/fix-tests.md with Step 2 and Step 7 removed, and Step 1 rewritten to require --resume for resume behavior.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@get-shit-done/workflows/fix-tests.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Steps 2 and 7 (circuit breaker disable/enable)</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Delete Step 2 entirely (lines covering "## Step 2: Disable Circuit Breaker" through the blank line before "## Step 3"). This includes the bash block `node ~/.claude/qgsd-bin/qgsd.cjs --disable-breaker` and all descriptive prose.

Delete Step 7 entirely (lines covering "## Step 7: Re-enable Circuit Breaker" through the blank line before "## Step 8"). This includes the bash block `node ~/.claude/qgsd-bin/qgsd.cjs --enable-breaker` and all descriptive prose.

Also remove the breaker re-enable references in the Error Handling section at the bottom:
- Remove the line `2. Run: \`node ~/.claude/qgsd-bin/qgsd.cjs --enable-breaker\` (always — do not skip)`
- Renumber the remaining error-handling steps (step 2 becomes step 2, etc.) — the old step 3 becomes 2 and old step 4 becomes 3.

Renumber all steps after the deletions so they are contiguous:
- Old Step 3 → Step 2
- Old Step 4 → Step 3
- Old Step 5 → Step 4
- Old Step 6 → Step 5
- Old Step 8 → Step 6
- Old Step 9 → Step 7

Update the Overview line at the top to remove "circuit breaker lifecycle" — reword to reflect the actual flow: "Discover → Batch → Execute → Categorize → Dispatch → Iterate loop with three-condition termination."

Update the Resume Logic Detail section header reference from "Steps 3-4" to "Steps 2-3" (since the old Step 3 is now Step 2 and Step 4 is now Step 3).
  </action>
  <verify>grep -n "disable-breaker\|enable-breaker\|Circuit Breaker" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md</verify>
  <done>No lines in the file contain "--disable-breaker", "--enable-breaker", or "Circuit Breaker" in step headers or prose. The overview no longer mentions "circuit breaker lifecycle".</done>
</task>

<task type="auto">
  <name>Task 2: Gate resume behavior behind --resume flag</name>
  <files>get-shit-done/workflows/fix-tests.md</files>
  <action>
Rewrite the new Step 1 (was Step 1, still Step 1 after renumbering) to make fresh-start the default and require an explicit `--resume` flag to activate resume logic.

Replace the current Step 1 content with:

```
## Step 1: Determine Run Mode

**Fresh start (default):** Plain invocation always starts fresh — existing state is ignored.

**Resume mode (explicit only):** Pass `--resume` to the slash command to continue an interrupted run.

```bash
# Check if --resume was passed as an argument to this invocation
# $RESUME_FLAG = true if "--resume" was present in the command arguments, false otherwise
```

- If `$RESUME_FLAG` is false (plain invocation): this is a FRESH START — proceed to Step 2.
- If `$RESUME_FLAG` is true (`--resume` passed): attempt resume:

  ```bash
  STATE_JSON=$(node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests load-state 2>/dev/null)
  ```

  - If STATE_JSON is a valid JSON object: RESUME — extract `batches_complete` and `manifest_path`
    from the state, then skip Steps 2-3 (discovery and batching), jump directly to Step 5 starting
    at batch index `batches_complete`.
  - If STATE_JSON is `null` or empty: no saved state found — fall through to FRESH START (Step 2).
```

Also update the Resume Logic Detail section at the bottom to reflect the new flag-gated behavior:
- Change "On a RESUME (STATE_JSON is not null):" to "On a RESUME (`--resume` passed AND STATE_JSON is not null):"
- Change "Skip Steps 3-4" to "Skip Steps 2-3" (renumbered steps)
  </action>
  <verify>grep -n "\-\-resume\|RESUME_FLAG\|fresh.start\|Fresh start" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/fix-tests.md | head -20</verify>
  <done>Step 1 checks $RESUME_FLAG before calling load-state. Plain invocation goes directly to Step 2 (discovery). --resume flag is required to trigger the load-state path. Resume Logic Detail section reflects the flag check.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `grep -c "disable-breaker\|enable-breaker" get-shit-done/workflows/fix-tests.md` returns 0
2. `grep -c "\-\-resume" get-shit-done/workflows/fix-tests.md` returns at least 3 occurrences (Step 1 prose + flag check + Resume Logic Detail)
3. Step numbers are contiguous 1..7 with no gaps
4. The Overview no longer mentions "circuit breaker lifecycle"
5. Fresh start is documented as the default behavior in Step 1
</verification>

<success_criteria>
- fix-tests.md contains zero references to --disable-breaker or --enable-breaker
- Plain invocation always fresh-starts (no load-state call unless --resume is passed)
- --resume flag explicitly documented as the only way to resume from saved state
- Step numbering is contiguous with no gaps after the two deletions
</success_criteria>

<output>
After completion, create `.planning/quick/60-in-fix-tests-md-1-remove-steps-2-and-7-c/60-SUMMARY.md` following @/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</output>
