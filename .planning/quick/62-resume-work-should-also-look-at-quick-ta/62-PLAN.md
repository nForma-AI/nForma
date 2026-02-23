---
phase: quick
plan: 62
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/workflows/resume-project.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "resume-work detects quick tasks that have a PLAN but no SUMMARY and flags them as incomplete"
    - "resume-work detects an incomplete qgsd:debug session (quorum-debug-latest.md without '## fix applied') and flags it"
    - "the present_status and determine_next_action steps surface these as actionable incomplete-work items"
    - "the installed copy at ~/.claude/qgsd/workflows/resume-project.md matches the source"
  artifacts:
    - path: "get-shit-done/workflows/resume-project.md"
      provides: "Updated check_incomplete_work step with quick-task and debug-session detection"
      contains: "quick/*/N-PLAN.md"
    - path: "~/.claude/qgsd/workflows/resume-project.md"
      provides: "Installed copy reflecting the change"
      contains: "quick/*/N-PLAN.md"
  key_links:
    - from: "check_incomplete_work"
      to: ".planning/quick/"
      via: "bash glob + PLAN/SUMMARY pair check"
      pattern: "quick/"
    - from: "check_incomplete_work"
      to: ".planning/quick/quorum-debug-latest.md"
      via: "grep for '## fix applied'"
      pattern: "quorum-debug-latest"
---

<objective>
Extend the `check_incomplete_work` step in the resume-project workflow so that /qgsd:resume-work also detects two currently-invisible incomplete states: (1) quick tasks with a PLAN but no SUMMARY, and (2) /qgsd:debug sessions that found consensus but have no "fix applied" record.

Purpose: Without this, the user resumes a session and misses abandoned quick tasks or stale debug findings — both represent real dangling work that should be surfaced.
Output: Updated `get-shit-done/workflows/resume-project.md` (source + installed copy).
</objective>

<execution_context>
@~/.claude/qgsd/workflows/execute-plan.md
@~/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/62-resume-work-should-also-look-at-quick-ta/62-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend check_incomplete_work in resume-project.md to scan quick tasks and debug artifacts</name>
  <files>get-shit-done/workflows/resume-project.md</files>
  <action>
Edit `get-shit-done/workflows/resume-project.md`. In the `check_incomplete_work` step (the bash block and its handling), add two new checks after the existing interrupted-agent check:

**Check A — incomplete quick tasks:**

Add to the bash block:
```bash
# Check for incomplete quick tasks (PLAN without SUMMARY)
for plan in .planning/quick/*/?-PLAN.md .planning/quick/??-PLAN.md .planning/quick/???-PLAN.md .planning/quick/*/*-PLAN.md; do
  [ ! -f "$plan" ] && continue
  dir=$(dirname "$plan")
  num=$(basename "$plan" -PLAN.md)
  summary="$dir/$num-SUMMARY.md"
  [ ! -f "$summary" ] && echo "Incomplete quick task: $plan"
done 2>/dev/null
```

Note: The pattern must handle both flat (`.planning/quick/N-PLAN.md` — older style) and nested (`.planning/quick/N-description/N-PLAN.md` — current style) layouts. The nested layout is standard since quick-52+. Use:
```bash
# Check for incomplete quick tasks (PLAN without SUMMARY)
for plan in .planning/quick/*/*-PLAN.md; do
  [ ! -f "$plan" ] && continue
  dir=$(dirname "$plan")
  num=$(basename "$plan" -PLAN.md)
  summary="$dir/$num-SUMMARY.md"
  [ ! -f "$summary" ] && echo "Incomplete quick task: $plan"
done 2>/dev/null
```

**Check B — incomplete debug session:**

Add to the bash block:
```bash
# Check for incomplete qgsd:debug session (consensus found but no fix applied)
if [ -f ".planning/quick/quorum-debug-latest.md" ]; then
  grep -q "## fix applied" .planning/quick/quorum-debug-latest.md \
    || echo "Incomplete debug session: .planning/quick/quorum-debug-latest.md (consensus found, fix not applied)"
fi
```

**Handling blocks (prose after the bash block):**

After the "If interrupted agent found:" handling block, add:

```
**If incomplete quick task found:**

- A quick task was planned and execution started but no SUMMARY was written
- Flag: "Found incomplete quick task"
- Recovery: `/qgsd:quick` — the quick command will pick up the existing PLAN
```

```
**If incomplete debug session found:**

- /qgsd:debug ran and reached consensus, but no fix was applied before the session ended
- Flag: "Found incomplete debug session"
- Recovery: Read `.planning/quick/quorum-debug-latest.md` for the consensus next step, then apply it, or re-run `/qgsd:debug` to get a fresh analysis
```

**present_status additions:**

In the `present_status` step, extend the "If incomplete work found:" display block to include quick task and debug session items, using the same warning style as existing incomplete-plan entries:

```
[If incomplete quick task found:]
⚠️  Incomplete quick task:
    - [path to PLAN.md]
    Recovery: /qgsd:quick

[If incomplete debug session found:]
⚠️  Incomplete debug session:
    - Consensus found but fix not applied
    - File: .planning/quick/quorum-debug-latest.md
    Recovery: apply consensus step or re-run /qgsd:debug
```

**determine_next_action additions:**

In the "If incomplete plan (PLAN without SUMMARY)" block, add a parallel block for quick tasks:

```
**If incomplete quick task (quick PLAN without SUMMARY):**
→ Primary: Complete the quick task (`/qgsd:quick`)
→ Option: Abandon (delete the PLAN.md)
```

And for debug sessions:

```
**If incomplete debug session:**
→ Primary: Read quorum-debug-latest.md, apply consensus step
→ Option: Re-run `/qgsd:debug` for fresh analysis
→ Option: Dismiss (delete quorum-debug-latest.md if stale)
```

Do NOT change any other content in the file. Preserve all existing steps, formatting, and prose exactly.
  </action>
  <verify>
```bash
grep -n "incomplete quick task\|quorum-debug-latest\|Incomplete quick\|Incomplete debug" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md
```
Should show at least 4 matches — one in the bash block, one in the handling prose, one in present_status, one in determine_next_action.
  </verify>
  <done>Both new detection cases (quick task PLAN+no-SUMMARY and debug-latest without fix-applied) appear in the bash detection block, the handling prose, the present_status display, and the determine_next_action routing section.</done>
</task>

<task type="auto">
  <name>Task 2: Install-sync to update ~/.claude/qgsd/workflows/resume-project.md</name>
  <files>~/.claude/qgsd/workflows/resume-project.md</files>
  <action>
Run the installer to propagate changes from source to the installed copy:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This overwrites `~/.claude/qgsd/workflows/resume-project.md` with the updated source. The installer handles path substitution (e.g., `~/.claude/qgsd/bin/gsd-tools.cjs` references).
  </action>
  <verify>
```bash
grep -n "quorum-debug-latest\|incomplete quick task" /Users/jonathanborduas/.claude/qgsd/workflows/resume-project.md
```
Should match the same content as the source file.
  </verify>
  <done>Installed copy at `~/.claude/qgsd/workflows/resume-project.md` contains the quick-task and debug-session detection logic matching the source.</done>
</task>

</tasks>

<verification>
1. Source file updated: `grep "quorum-debug-latest" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md` returns matches.
2. Installed copy updated: `grep "quorum-debug-latest" ~/.claude/qgsd/workflows/resume-project.md` returns matches.
3. Source and installed copy are in sync: `diff <(grep -n "quorum-debug-latest\|incomplete quick" /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md) <(grep -n "quorum-debug-latest\|incomplete quick" ~/.claude/qgsd/workflows/resume-project.md)` returns no differences (accounting for any path substitution by the installer).
4. Existing content preserved: `wc -l /Users/jonathanborduas/code/QGSD/get-shit-done/workflows/resume-project.md` should be ~380+ lines (was 358, new content adds ~25+).
</verification>

<success_criteria>
- check_incomplete_work bash block scans `.planning/quick/*/*-PLAN.md` and flags those missing a SUMMARY
- check_incomplete_work bash block reads quorum-debug-latest.md and flags it when no "## fix applied" line is present
- Both cases are surfaced in present_status with actionable recovery commands
- Both cases are handled in determine_next_action routing
- Installed copy matches source
- Commit created
</success_criteria>

<output>
After completion, create `.planning/quick/62-resume-work-should-also-look-at-quick-ta/62-SUMMARY.md`
</output>
