<purpose>
Execute all plans in a phase using wave-based parallel execution. Orchestrator stays lean by delegating plan execution to subagents.
</purpose>

<core_principle>
The orchestrator's job is coordination, not execution. Each subagent loads the full execute-plan context itself. Orchestrator discovers plans, analyzes dependencies, groups into waves, spawns agents, collects results.
</core_principle>

<process>

<step name="validate_phase">
Confirm phase exists and has plans:

```bash
PHASE_DIR=$(ls -d .planning/phases/${PHASE_ARG}* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  echo "ERROR: No phase directory matching '${PHASE_ARG}'"
  exit 1
fi

PLAN_COUNT=$(ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$PLAN_COUNT" -eq 0 ]; then
  echo "ERROR: No plans found in $PHASE_DIR"
  exit 1
fi
```

Report: "Found {N} plans in {phase_dir}"
</step>

<step name="discover_plans">
List all plans and their completion status:

```bash
# Get all plans
ls -1 "$PHASE_DIR"/*-PLAN.md 2>/dev/null | sort

# Get completed plans (have SUMMARY.md)
ls -1 "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null | sort
```

Build plan inventory:
- Plan path
- Plan number (extracted from filename)
- Completion status (SUMMARY exists = complete)

Skip completed plans. If all complete, report "Phase already executed" and exit.
</step>

<step name="analyze_dependencies">
For each incomplete plan, check if it depends on outputs from other plans.

**Read each plan's `<context>` section:**
- Look for @-references to files that other plans create
- Look for explicit `requires:` in frontmatter

**Dependency patterns:**
- Plan references `@.planning/phases/.../XX-YY-SUMMARY.md` → depends on plan XX-YY
- Plan references files created by earlier plan → depends on that plan
- No cross-references → independent, can run in parallel

**Build dependency graph:**
```
plan-01: []              # no dependencies
plan-02: []              # no dependencies
plan-03: [plan-01]       # depends on plan-01 outputs
plan-04: [plan-02]       # depends on plan-02 outputs
plan-05: [plan-03, plan-04]  # depends on both
```
</step>

<step name="group_into_waves">
Group plans into execution waves based on dependencies:

**Wave assignment algorithm:**
1. Wave 1: All plans with no dependencies
2. Wave 2: Plans whose dependencies are all in Wave 1
3. Wave N: Plans whose dependencies are all in earlier waves

**Example:**
```
Wave 1: [plan-01, plan-02]     # parallel - no dependencies
Wave 2: [plan-03, plan-04]     # parallel - depend only on Wave 1
Wave 3: [plan-05]              # sequential - depends on Wave 2
```

Report wave structure to user:
```
Execution Plan:
  Wave 1 (parallel): plan-01, plan-02
  Wave 2 (parallel): plan-03, plan-04
  Wave 3: plan-05

Total: 5 plans in 3 waves
```
</step>

<step name="execute_waves">
Execute each wave in sequence. Plans within a wave run in parallel.

**For each wave:**

1. **Spawn all agents in wave simultaneously:**

   Use Task tool with multiple parallel calls. Each agent gets prompt from subagent-task-prompt template:

   ```
   <objective>
   Execute plan {plan_number} of phase {phase_number}-{phase_name}.

   Commit each task atomically. Create SUMMARY.md. Update STATE.md.
   </objective>

   <execution_context>
   @~/.claude/get-shit-done/workflows/execute-plan.md
   @~/.claude/get-shit-done/templates/summary.md
   @~/.claude/get-shit-done/references/checkpoints.md
   @~/.claude/get-shit-done/references/tdd.md
   </execution_context>

   <context>
   Plan: @{plan_path}
   Project state: @.planning/STATE.md
   Config: @.planning/config.json (if exists)
   </context>

   <success_criteria>
   - [ ] All tasks executed
   - [ ] Each task committed individually
   - [ ] SUMMARY.md created in plan directory
   - [ ] STATE.md updated with position and decisions
   </success_criteria>
   ```

2. **Wait for all agents in wave to complete:**

   Task tool blocks until each agent finishes. All parallel agents return together.

3. **Collect results from wave:**

   For each completed agent:
   - Verify SUMMARY.md exists at expected path
   - Note any issues reported
   - Record completion

4. **Handle failures:**

   If any agent in wave fails:
   - Report which plan failed and why
   - Ask user: "Continue with remaining waves?" or "Stop execution?"
   - If continue: proceed to next wave (dependent plans may also fail)
   - If stop: exit with partial completion report

5. **Proceed to next wave**

</step>

<step name="aggregate_results">
After all waves complete, aggregate results:

```markdown
## Phase {X}: {Name} Execution Complete

**Waves executed:** {N}
**Plans completed:** {M} of {total}

### Wave Summary

| Wave | Plans | Status |
|------|-------|--------|
| 1 | plan-01, plan-02 | ✓ Complete |
| 2 | plan-03, plan-04 | ✓ Complete |
| 3 | plan-05 | ✓ Complete |

### Plan Details

1. **plan-01**: [one-liner from SUMMARY.md]
2. **plan-02**: [one-liner from SUMMARY.md]
...

### Issues Encountered
[Aggregate from all SUMMARYs, or "None"]
```
</step>

<step name="update_roadmap">
Update ROADMAP.md to reflect phase completion:

```bash
# Mark phase complete
# Update completion date
# Update status
```

Commit roadmap update:
```bash
git add .planning/ROADMAP.md
git commit -m "docs(phase-{X}): complete phase execution"
```
</step>

<step name="offer_next">
Present next steps based on milestone status:

**If more phases remain:**
```
## ▶ Next Up

**Phase {X+1}: {Name}** — {Goal}

`/gsd:plan-phase {X+1}`

<sub>`/clear` first → fresh context window</sub>
```

**If milestone complete:**
```
🎉 MILESTONE COMPLETE!

All {N} phases executed.

`/gsd:complete-milestone`
```
</step>

</process>

<context_efficiency>
**Why this works:**

Orchestrator context usage: ~10-15%
- Read plan files (small)
- Analyze dependencies (logic, no heavy reads)
- Fill template strings
- Spawn Task calls
- Collect results

Each subagent: Fresh 200k context
- Loads full execute-plan workflow
- Loads templates, references
- Executes plan with full capacity
- Creates SUMMARY, commits

**No polling.** Task tool blocks until completion. No TaskOutput loops.

**No context bleed.** Orchestrator never reads workflow internals. Just paths and results.
</context_efficiency>

<failure_handling>
**Subagent fails mid-plan:**
- SUMMARY.md won't exist
- Orchestrator detects missing SUMMARY
- Reports failure, asks user how to proceed

**Dependency chain breaks:**
- Wave 1 plan fails
- Wave 2 plans depending on it will likely fail
- Orchestrator can still attempt them (user choice)
- Or skip dependent plans entirely

**All agents in wave fail:**
- Something systemic (git issues, permissions, etc.)
- Stop execution
- Report for manual investigation
</failure_handling>

<checkpoint_handling>
Plans with checkpoints require user interaction. These cannot run fully autonomous.

**Detection:** Scan plan for `type="checkpoint` before spawning.

**If checkpoints found:**
- Don't include in parallel wave
- Execute after wave completes, in main context
- Or spawn as single agent and wait (user interaction flows through)

**Checkpoint-heavy plans:** Execute sequentially in main context rather than subagent.
</checkpoint_handling>
