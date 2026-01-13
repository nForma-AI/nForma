---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number>"
allowed-tools:
  - Read
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

3. **Analyze dependencies**
   - Read each plan's `<context>` section
   - Detect cross-references to other plans' outputs
   - Build dependency graph

4. **Group into waves**
   - Wave 1: Plans with no dependencies
   - Wave N: Plans depending only on earlier waves
   - Report wave structure to user

5. **Execute waves**
   For each wave:
   - Fill subagent-task-prompt template for each plan
   - Spawn all agents in wave simultaneously (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

6. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status
   - Update ROADMAP.md

7. **Offer next steps**
   - More phases → `/gsd:plan-phase {next}`
   - Milestone complete → `/gsd:complete-milestone`
</process>

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

<checkpoint_detection>
Before adding a plan to a parallel wave, scan for checkpoints:

```bash
grep -c 'type="checkpoint' {plan_path}
```

**If checkpoints > 0:**
- Plan requires user interaction
- Execute in main context OR as solo subagent (not parallel)
- User interaction flows through normally

**If checkpoints = 0:**
- Fully autonomous
- Safe for parallel wave execution
</checkpoint_detection>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] User informed of next steps
</success_criteria>
