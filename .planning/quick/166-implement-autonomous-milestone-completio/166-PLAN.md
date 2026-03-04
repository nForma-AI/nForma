---
phase: 166-implement-autonomous-milestone-completio
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - qgsd-core/workflows/audit-milestone.md
  - qgsd-core/workflows/transition.md
  - commands/qgsd/audit-milestone.md
autonomous: true
formal_artifacts: none
requirements:
  - QUICK-166

must_haves:
  truths:
    - "audit-milestone.md accepts --auto flag and propagates it through the loop"
    - "When --auto and audit returns passed, complete-milestone is auto-invoked"
    - "When --auto and audit returns gaps_found, plan-milestone-gaps is auto-spawned, gap phases are auto-executed, then re-audit runs — looping until passed or max iterations"
    - "When --auto and audit returns tech_debt, milestone is auto-completed (accept debt)"
    - "A MAX_ITERATIONS=3 limit prevents infinite loops"
    - "After iteration 2, a user confirmation gate via AskUserQuestion requires approval to continue"
    - "transition.md passes --auto flag through to audit-milestone invocation"
  artifacts:
    - path: "qgsd-core/workflows/audit-milestone.md"
      provides: "Auto-loop logic in offer_next section"
      contains: "MAX_ITERATIONS"
    - path: "qgsd-core/workflows/transition.md"
      provides: "--auto flag passthrough to audit-milestone"
      contains: "--auto"
    - path: "commands/qgsd/audit-milestone.md"
      provides: "Updated argument-hint showing --auto flag"
      contains: "--auto"
  key_links:
    - from: "qgsd-core/workflows/transition.md"
      to: "qgsd-core/workflows/audit-milestone.md"
      via: "--auto flag passthrough in Route B yolo mode"
      pattern: "audit-milestone.*--auto"
    - from: "qgsd-core/workflows/audit-milestone.md"
      to: "qgsd-core/workflows/plan-milestone-gaps.md"
      via: "Task spawn in auto-loop"
      pattern: "plan-milestone-gaps"
    - from: "qgsd-core/workflows/audit-milestone.md"
      to: "qgsd-core/workflows/execute-phase.md"
      via: "Task spawn for each gap phase"
      pattern: "execute-phase"
    - from: "qgsd-core/workflows/audit-milestone.md"
      to: "qgsd-core/workflows/complete-milestone.md"
      via: "Task spawn on passed status"
      pattern: "complete-milestone"
---

<objective>
Extend the existing --auto pipeline to handle milestone completion autonomously.

Currently the --auto chain flows: plan-phase → execute-phase → transition → audit-milestone → STOP.
After this task, audit-milestone --auto will loop: audit → [gaps?] → plan-gaps → execute → re-audit → [repeat] → complete-milestone.

No new commands needed — this extends existing workflows.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Source files (in repo, NOT ~/.claude — installer copies them):
- qgsd-core/workflows/audit-milestone.md — workflow to add --auto loop logic
- qgsd-core/workflows/transition.md — needs --auto passthrough to audit-milestone
- commands/qgsd/audit-milestone.md — needs --auto in argument-hint

Key architecture:
- transition.md Route B (yolo mode): currently invokes `SlashCommand("/qgsd:audit-milestone {version}")`
  → needs to become `SlashCommand("/qgsd:audit-milestone {version} --auto")`
- audit-milestone.md `<offer_next>` section: currently presents suggestions
  → needs auto-loop when --auto flag present
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --auto loop to audit-milestone workflow</name>
  <files>
    qgsd-core/workflows/audit-milestone.md
    commands/qgsd/audit-milestone.md
  </files>
  <action>
**1a. Update command file** `commands/qgsd/audit-milestone.md`:
- Add `--auto` to argument-hint: `"[version] [--auto]"`
- Add `AskUserQuestion` to allowed-tools list

**1b. Update workflow file** `qgsd-core/workflows/audit-milestone.md`:

Add argument parsing at the top of Step 0 (Initialize Milestone Context):
```
Parse $ARGUMENTS for:
- Version number (existing)
- `--auto` flag → store as $AUTO_MODE (true/false)

If $AUTO_MODE:
  Set MAX_ITERATIONS=3
  Set current_iteration=0
```

Replace the `<offer_next>` section with auto-loop logic when --auto:

```
## 7. Present Results

**If NOT $AUTO_MODE:** Use existing <offer_next> routing (unchanged).

**If $AUTO_MODE:** Enter autonomous completion loop.

### Auto-Loop Logic (only when $AUTO_MODE)

**If passed:**
  Display: "Audit passed. Auto-completing milestone..."
  Spawn complete-milestone:
  ```
  Task(
    prompt="Run /qgsd:complete-milestone {version}
    Follow @~/.claude/qgsd/workflows/complete-milestone.md end-to-end.",
    subagent_type="general-purpose",
    description="Auto-complete: milestone {version}"
  )
  ```
  Display final result and exit.

**If tech_debt:**
  Display: "Audit found tech debt but no blockers. Auto-completing with accepted debt..."
  Same as passed — spawn complete-milestone.

**If gaps_found:**
  Increment current_iteration.

  Safety check:
  - If current_iteration > MAX_ITERATIONS (3): HALT. Display iteration count,
    remaining gaps, instruct user to investigate manually. Do NOT continue.
  - If current_iteration == 2: Insert user gate:
    AskUserQuestion(
      header: "Continue?",
      question: "Iteration 2 of 3 complete, gaps remain. Continue to iteration 3?",
      options: [
        { label: "Yes, continue", description: "Attempt one more gap closure cycle" },
        { label: "Abort", description: "Stop here, investigate manually" }
      ]
    )
    If abort → halt with current state summary.

  Pre-routing check (existing logic): classify missing phases as
  plan_exists_not_executed vs missing_no_plan.

  If ALL gaps are executable (plan_exists_not_executed):
    Auto-execute each phase, then re-audit:
    For each missing phase (lowest first):
      Task(
        prompt="Run /qgsd:execute-phase {phase} --auto",
        subagent_type="general-purpose",
        description="Auto-complete: execute gap phase {phase}"
      )
    After all execute, loop back: re-invoke audit (recursively or via loop).

  If ANY phase is missing_no_plan:
    Spawn plan-milestone-gaps:
    Task(
      prompt="Run /qgsd:plan-milestone-gaps --auto
      Audit file: .planning/v{version}-v{version}-MILESTONE-AUDIT.md
      Follow @~/.claude/qgsd/workflows/plan-milestone-gaps.md end-to-end.
      After phases are created and the first phase is planned, execute all gap
      phases sequentially.",
      subagent_type="general-purpose",
      description="Auto-complete: plan & execute milestone gaps (iteration {N})"
    )

    After plan-milestone-gaps completes (which auto-spawns plan-phase → execute):
    Loop back: re-invoke audit.

  Re-audit: Recursively re-run audit workflow from Step 1 with same --auto
  flag and incremented iteration counter.
```
  </action>
  <verify>
- `grep -c "AUTO_MODE\|auto_mode\|--auto" qgsd-core/workflows/audit-milestone.md` returns 5+
- `grep "MAX_ITERATIONS" qgsd-core/workflows/audit-milestone.md` finds safety limit
- `grep "AskUserQuestion" qgsd-core/workflows/audit-milestone.md` finds user gate
- `grep "complete-milestone" qgsd-core/workflows/audit-milestone.md` finds auto-completion
- `grep "\-\-auto" commands/qgsd/audit-milestone.md` finds flag in argument-hint
  </verify>
  <done>
audit-milestone.md has --auto loop logic with 3-iteration safety limit, user gate after iteration 2,
auto-complete on passed/tech_debt, and auto gap-closure with re-audit on gaps_found.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire --auto through transition.md and install</name>
  <files>
    qgsd-core/workflows/transition.md
  </files>
  <action>
**2a. Update transition.md** Route B (yolo mode):

In the `offer_next_phase` step, Route B, both sub-routes (LOOP-01 primary and LOOP-02 gap closure):

Currently (LOOP-01 yolo):
```
Exit skill and invoke SlashCommand("/qgsd:audit-milestone {version}")
```

Change to:
```
Exit skill and invoke SlashCommand("/qgsd:audit-milestone {version} --auto")
```

Currently (LOOP-02 yolo):
```
Exit skill and invoke SlashCommand("/qgsd:audit-milestone {version}")
```

Change to:
```
Exit skill and invoke SlashCommand("/qgsd:audit-milestone {version} --auto")
```

This ensures --auto propagates from plan-phase → execute-phase → transition → audit-milestone.

**2b. Run installer to deploy updated files:**

```bash
node bin/install.js --claude --global
```

Verify installed files match source.
  </action>
  <verify>
- `grep -c "\-\-auto" qgsd-core/workflows/transition.md` returns 2+ (both Route B paths)
- `diff qgsd-core/workflows/audit-milestone.md ~/.claude/qgsd/workflows/audit-milestone.md` shows no diff (installed matches source)
- `diff qgsd-core/workflows/transition.md ~/.claude/qgsd/workflows/transition.md` shows no diff
  </verify>
  <done>
transition.md passes --auto to audit-milestone in both Route B paths (primary and gap closure).
All updated files installed to ~/.claude/ locations.
  </done>
</task>

</tasks>

<verification>
1. audit-milestone.md parses --auto flag
2. When --auto + passed → auto-invokes complete-milestone
3. When --auto + gaps_found → auto plan-gaps → execute → re-audit loop
4. When --auto + tech_debt → auto-complete (accept debt)
5. MAX_ITERATIONS=3 prevents infinite loops
6. User gate after iteration 2
7. transition.md Route B passes --auto through
8. All files installed via bin/install.js
</verification>

<success_criteria>
- The --auto chain now goes all the way from plan-phase to complete-milestone
- audit-milestone --auto loops through gap closure automatically
- Safety limits prevent runaway automation (3 iterations max, user gate at 2)
- No new commands needed — extends existing workflows
</success_criteria>
