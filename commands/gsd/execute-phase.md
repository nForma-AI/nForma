---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/templates/subagent-task-prompt.md
</execution_context>

<context>
Phase: $ARGUMENTS

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
1. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found

2. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - Build list of incomplete plans

3. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user

4. **Execute waves**
   For each wave in order:
   - Fill subagent-task-prompt template for each plan
   - Spawn all agents in wave simultaneously (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

5. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status
   - Update ROADMAP.md, STATE.md

6. **Update requirements**
   Mark phase requirements as Complete:
   - Read ROADMAP.md, find this phase's `Requirements:` line (e.g., "AUTH-01, AUTH-02")
   - Read REQUIREMENTS.md traceability table
   - For each REQ-ID in this phase: change Status from "Pending" to "Complete"
   - Write updated REQUIREMENTS.md
   - Skip if: REQUIREMENTS.md doesn't exist, or phase has no Requirements line

7. **Commit phase completion**
   Bundle all phase metadata updates in one commit:
   - Stage: `git add .planning/ROADMAP.md .planning/STATE.md`
   - Stage REQUIREMENTS.md if updated: `git add .planning/REQUIREMENTS.md`
   - Commit: `docs({phase}): complete {phase-name} phase`

8. **Offer next steps**
   - Route to next action (see `<offer_next>`)
</process>

<offer_next>
**MANDATORY: Present copy/paste-ready next command.**

After phase completes, determine what's next:

**Step 1: Check milestone status**

Read ROADMAP.md. Find current phase number and highest phase in milestone.

| Condition | Action |
|-----------|--------|
| current < highest | More phases → Route A |
| current = highest | Milestone complete → Route B |

---

**Route A: More phases remain in milestone**

```
## ✓ Phase {Z}: {Name} Complete

All {Y} plans finished.

---

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/gsd:plan-phase {Z+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work {Z}` — manual acceptance testing before continuing
- `/gsd:discuss-phase {Z+1}` — gather context first
- `/gsd:research-phase {Z+1}` — investigate unknowns

---
```

---

**Route B: Milestone complete**

```
🎉 MILESTONE COMPLETE!

## ✓ Phase {Z}: {Name} Complete

All {N} phases finished.

---

## ▶ Next Up

**Complete Milestone** — archive and prepare for next

`/gsd:complete-milestone`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work` — manual acceptance testing before completing milestone
- `/gsd:add-phase <description>` — add another phase before completing

---
```
</offer_next>

<wave_execution>
**Parallel spawning:**

Spawn all plans in a wave with a single message containing multiple Task calls:

```
Task(prompt=filled_template_for_plan_01, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_02, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_03, subagent_type="general-purpose")
```

All three run in parallel. Task tool blocks until all complete.

**No polling.** No background agents. No TaskOutput loops.
</wave_execution>

<checkpoint_handling>
Plans with `autonomous: false` have checkpoints. The execute-phase.md workflow handles the full checkpoint flow:
- Subagent pauses at checkpoint, returns structured state
- Orchestrator presents to user, collects response
- Spawns fresh continuation agent (not resume)

See `@~/.claude/get-shit-done/workflows/execute-phase.md` step `checkpoint_handling` for complete details.
</checkpoint_handling>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention.
</deviation_rules>

<commit_rules>
**Per-Task Commits:**

After each task completes:
1. Stage only files modified by that task
2. Commit with format: `{type}({phase}-{plan}): {task-name}`
3. Types: feat, fix, test, refactor, perf, chore
4. Record commit hash for SUMMARY.md

**Plan Metadata Commit:**

After all tasks in a plan complete:
1. Stage plan artifacts only: PLAN.md, SUMMARY.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**Phase Completion Commit:**

After all plans in phase complete (step 7):
1. Stage: ROADMAP.md, STATE.md, REQUIREMENTS.md (if updated)
2. Commit with format: `docs({phase}): complete {phase-name} phase`
3. Bundles all phase-level state updates in one commit

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**
</commit_rules>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] User informed of next steps
</success_criteria>
