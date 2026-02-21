---
phase: quick-30
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/execute-phase.md
  - ~/.claude/qgsd/workflows/execute-phase.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "When a spot-check fails and SUMMARY.md contains diagnosis markers, the orchestrator auto-spawns a quick task instead of asking the user"
    - "When a real failure has no diagnosis in SUMMARY.md, the existing ask-user behavior is preserved"
    - "CI failures with diagnosed root causes in SUMMARY.md trigger the auto-spawn quick task path"
    - "The failure_handling block documents the diagnosed-CI-failure auto-spawn behavior"
  artifacts:
    - path: "get-shit-done/workflows/execute-phase.md"
      provides: "Updated execute-phase source with auto-spawn on diagnosed CI failures"
      contains: "diagnosed root causes"
    - path: "~/.claude/qgsd/workflows/execute-phase.md"
      provides: "Installed copy matching source"
      contains: "diagnosed root causes"
  key_links:
    - from: "execute_waves step 4 (spot-check fails)"
      to: "auto-spawn quick task"
      via: "SUMMARY.md diagnosis detection"
      pattern: "Root Cause|Diagnosed|Bug [0-9]|CI Failures|Deferred.*CI"
    - from: "execute_waves step 5 (real failure)"
      to: "auto-spawn quick task"
      via: "SUMMARY.md diagnosis detection before asking user"
      pattern: "same diagnosis heuristic"
---

<objective>
Fix execute-phase orchestrator so CI failures with diagnosed root causes auto-spawn a quick task instead of asking the user "Continue? or Stop?".

Purpose: When quick-29 executor leaves diagnosed CI failures in SUMMARY.md (sections containing "Root Cause", "Bug 1 —", "CI Failures", "Deferred: CI fixes"), the orchestrator should read that diagnosis and immediately spawn a quick task to fix them — no user gate, same pattern as /qgsd:quick workflow Steps 2-6.

Output: Both source and installed execute-phase.md updated with three targeted edits: spot-check failure path (step 4), real failure path (step 5), and failure_handling block.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update execute_waves step 4 and step 5 in source</name>
  <files>get-shit-done/workflows/execute-phase.md</files>
  <action>
Read the file first. Make three targeted edits:

**Edit 1 — Step 4, spot-check failure path (around line 155):**

Replace:
```
   If ANY spot-check fails: report which plan failed, route to failure handler — ask "Retry plan?" or "Continue with remaining waves?"
```

With:
```
   If ANY spot-check fails: report which plan failed, then check SUMMARY.md for diagnosis markers.

   **Diagnosis detection heuristic:** SUMMARY.md is diagnosed when it contains any of: `Root Cause:`, `Diagnosed`, `Bug 1 —`, `Bug 2 —`, `CI Failures`, `Deferred: CI fixes`.

   - **Diagnosis present:** Read the diagnosis section. Auto-spawn quick task with the diagnosis as description (no user gate) — see auto-spawn mechanism below.
   - **No diagnosis:** Ask "Retry plan?" or "Continue with remaining waves?" (existing behavior).
```

**Edit 2 — Step 5, real failure path (around line 177):**

Replace:
```
   For real failures: report which plan failed → ask "Continue?" or "Stop?" → if continue, dependent plans may also fail. If stop, partial completion report.
```

With:
```
   For real failures: report which plan failed, then check SUMMARY.md for diagnosis markers (same heuristic as step 4: `Root Cause:`, `Diagnosed`, `Bug 1 —`, `Bug 2 —`, `CI Failures`, `Deferred: CI fixes`).

   - **Diagnosis present:** Read the diagnosis section. Auto-spawn quick task with the diagnosis as description (no user gate) — see auto-spawn mechanism below.
   - **No diagnosis:** Ask "Continue?" or "Stop?" → if continue, dependent plans may also fail. If stop, partial completion report.

   **Auto-spawn quick task mechanism** (used by both step 4 and step 5):
   Extract the diagnosis text from SUMMARY.md (all lines under any "Root Cause", "Diagnosed", "Bug N —", "CI Failures", or "Deferred: CI fixes" headings). Compose a description: "Fix CI failures diagnosed in {phase}-{plan}: {first-line-of-diagnosis}".

   Then execute these steps inline (no user gate):
   ```bash
   INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init quick "$DESCRIPTION")
   # Parse next_num, slug, task_dir, planner_model, executor_model from INIT
   mkdir -p "${task_dir}"
   node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
     "{\"activity\":\"quick\",\"sub_activity\":\"planning\"}"
   ```
   Then spawn qgsd-planner Task with the description and QUICK_DIR (same prompt as quick.md Step 5 standard mode).
   After planner returns, run quorum review (quick.md Step 5.7).
   After quorum approves, spawn qgsd-executor Task (same prompt as quick.md Step 6).
   After executor completes, update STATE.md quick tasks table and commit (same as quick.md Steps 7-8).
   Then resume phase execution from the failed plan.
```

**Edit 3 — `<failure_handling>` block (around line 461):**

Add a new bullet after the classifyHandoffIfNeeded bullet:

```
- **CI failures with diagnosed root causes:** Executor SUMMARY.md contains sections with "Root Cause:", "Diagnosed", "Bug N —", "CI Failures", or "Deferred: CI fixes" → read diagnosis → auto-spawn quick task using init quick + qgsd-planner + qgsd-executor sequence (quick.md Steps 2-6 pattern), no user gate → resume phase execution after quick task completes
```
  </action>
  <verify>
Read the updated file and confirm:
1. Step 4 spot-check failure path contains "Diagnosis detection heuristic" text
2. Step 5 real failure path contains "Auto-spawn quick task mechanism" text
3. failure_handling block contains "CI failures with diagnosed root causes" bullet
Run: grep -n "Diagnosis detection heuristic\|Auto-spawn quick task mechanism\|CI failures with diagnosed root causes" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
Expected: 3 matching lines
  </verify>
  <done>Source file contains all three edits. grep returns exactly 3 matches.</done>
</task>

<task type="auto">
  <name>Task 2: Sync installed execute-phase.md and commit source</name>
  <files>~/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
The installed file at ~/.claude/qgsd/workflows/execute-phase.md is the same content as the source except the gsd-tools.cjs path uses the absolute path /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs instead of the tilde shorthand ~/.claude/qgsd/bin/gsd-tools.cjs.

Read the source file at /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md.

Apply the same three edits to the installed file at /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md, substituting the absolute path form for any gsd-tools.cjs references in the new text (replace ~/.claude/qgsd/bin/gsd-tools.cjs with /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs in the auto-spawn mechanism text).

After writing the installed file, commit only the source file (installed file is disk-only per project convention — ~/.claude/qgsd/ is outside the repo):

```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs commit "feat(quick-30): auto-spawn quick task on diagnosed CI failures in execute-phase orchestrator" --files get-shit-done/workflows/execute-phase.md
```
  </action>
  <verify>
1. Installed file contains diagnosis detection text:
   grep -n "Diagnosis detection heuristic\|Auto-spawn quick task mechanism\|CI failures with diagnosed root causes" /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
   Expected: 3 matching lines

2. Source committed to git:
   git log --oneline -3 /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/execute-phase.md
   Expected: top commit contains "quick-30"
  </verify>
  <done>Installed file has 3 matching lines. Git log shows quick-30 commit on source file.</done>
</task>

</tasks>

<verification>
Both files updated. grep confirms all three edits present in both source and installed copies. Git commit created for source file only (installed is disk-only per project convention).
</verification>

<success_criteria>
- Source file: 3 grep matches for diagnosis detection / auto-spawn text
- Installed file: 3 grep matches for same text (absolute path variant)
- Git: one commit on get-shit-done/workflows/execute-phase.md with "quick-30" in message
- Behavior: orchestrator now checks SUMMARY.md before asking user on any failure path
</success_criteria>

<output>
After completion, create .planning/quick/30-fix-execute-phase-orchestrator-ci-failur/30-SUMMARY.md
Update STATE.md Quick Tasks Completed table with row: | 30 | fix execute-phase orchestrator CI failure gate: auto-spawn quick task when executor SUMMARY.md has diagnosed root causes | 2026-02-21 | {commit_hash} | [30-fix-execute-phase-orchestrator-ci-failur](.planning/quick/30-fix-execute-phase-orchestrator-ci-failur/) |
</output>
