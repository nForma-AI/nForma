---
phase: quick-29
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-executor.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Executor fixes CI failures revealed by a masking fix without asking user permission"
    - "Both source and installed executor files are in sync"
  artifacts:
    - path: "agents/qgsd-executor.md"
      provides: "Updated SCOPE BOUNDARY with masked-CI-failure exception"
      contains: "revealed by a masking fix"
  key_links:
    - from: "agents/qgsd-executor.md"
      to: "~/.claude/agents/qgsd-executor.md"
      via: "manual copy (disk-only install)"
      pattern: "revealed by a masking fix"
---

<objective>
Add an exception to the executor SCOPE BOUNDARY so that CI failures newly revealed when a masking fix lands are treated as Rule 1 auto-fixes, not out-of-scope deferrals.

Purpose: When a fix (e.g., Phase 3c RemoteDisconnected) clears a blocking failure and previously-masked CI phases become visible, the executor currently hits the SCOPE BOUNDARY and asks "Want me to proceed?" — a permission gate that breaks autonomous execution. These failures have clear root causes and fall squarely under Rule 1 (auto-fix bugs). The SCOPE BOUNDARY exception removes the gate.

Output: `agents/qgsd-executor.md` (source) + `~/.claude/agents/qgsd-executor.md` (installed, disk-only) updated with the exception clause. No git commit for the installed file per project convention.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add masked-CI-failure exception to SCOPE BOUNDARY in source file</name>
  <files>agents/qgsd-executor.md</files>
  <action>
In `agents/qgsd-executor.md`, locate the **SCOPE BOUNDARY** paragraph (around line 161):

```
**SCOPE BOUNDARY:**
Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing warnings, linting errors, or failures in unrelated files are out of scope.
- Log out-of-scope discoveries to `deferred-items.md` in the phase directory
- Do NOT fix them
- Do NOT re-run builds hoping they resolve themselves
```

Replace it with:

```
**SCOPE BOUNDARY:**
Only auto-fix issues DIRECTLY caused by the current task's changes. Pre-existing warnings, linting errors, or failures in unrelated files are out of scope.
- Log out-of-scope discoveries to `deferred-items.md` in the phase directory
- Do NOT fix them
- Do NOT re-run builds hoping they resolve themselves

**Exception — CI failures revealed by a masking fix:** When the current task fixes a failure that was masking downstream CI phases, newly visible failures in those phases are in-scope under Rule 1 — fix them inline, no user permission needed. Rationale: the masking fix is the proximate cause; asking permission at this point breaks autonomous execution with no benefit.
```

Also locate the `<step name="execute_tasks">` block which ends with:
```
3. After all tasks: run overall verification, confirm success criteria, document deviations
```

Append to that point (or add as a new bullet inside step 3's context) the following guidance:

```
   - If CI verification reveals failures in phases that were previously masked by a now-fixed failure: apply Rule 1 inline (auto-fix), do not gate on user permission.
```

The exact insertion point is in the `<step name="execute_tasks">` block at the last bullet of item 1 (type="auto" handling). Add after "Track completion + commit hash for Summary":

```
   - If CI run post-fix reveals newly unmasked failures with clear root causes: treat as Rule 1 (auto-fix) regardless of which task introduced them originally
```
  </action>
  <verify>grep -n "revealed by a masking fix" /Users/jonathanborduas/code/QGSD/agents/qgsd-executor.md</verify>
  <done>Source file contains the exception clause "revealed by a masking fix" in the SCOPE BOUNDARY section.</done>
</task>

<task type="auto">
  <name>Task 2: Sync updated source to installed agent (disk-only)</name>
  <files>~/.claude/agents/qgsd-executor.md</files>
  <action>
Copy the updated source file to the installed location:

```bash
cp /Users/jonathanborduas/code/QGSD/agents/qgsd-executor.md ~/.claude/agents/qgsd-executor.md
```

Do NOT git-add or git-commit `~/.claude/agents/qgsd-executor.md` — installed files are disk-only per project convention (same as quick-17, quick-18, quick-20 precedents in STATE.md).

Verify the installed copy contains the exception clause.
  </action>
  <verify>grep -n "revealed by a masking fix" ~/.claude/agents/qgsd-executor.md</verify>
  <done>Installed file at ~/.claude/agents/qgsd-executor.md contains the same exception clause as the source. Git status shows only agents/qgsd-executor.md modified (no ~/.claude/ file staged).</done>
</task>

</tasks>

<verification>
1. `grep -n "revealed by a masking fix" /Users/jonathanborduas/code/QGSD/agents/qgsd-executor.md` — returns a match in the SCOPE BOUNDARY section
2. `grep -n "revealed by a masking fix" ~/.claude/agents/qgsd-executor.md` — returns the same match
3. `git diff --name-only` — shows only `agents/qgsd-executor.md` (not the installed path)
</verification>

<success_criteria>
- SCOPE BOUNDARY in source file has the masking-fix exception clause
- The exception explicitly states no user permission needed (Rule 1 inline)
- Installed file is an exact copy of source
- No installed-path file is staged in git
</success_criteria>

<output>
After completion, create `.planning/quick/29-make-executor-auto-proceed-with-ci-failu/29-SUMMARY.md`
</output>
