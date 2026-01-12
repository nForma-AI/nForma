<purpose>
Execute all plans in a phase with intelligent parallelization.
Analyzes plan dependencies to identify independent plans that can run in parallel.
</purpose>

<when_to_use>
Use /gsd:execute-phase when:
- Phase has multiple unexecuted plans (2+)
- Want "walk away, come back to completed work" execution
- Plans have clear dependency boundaries

Use /gsd:execute-plan when:
- Executing a single specific plan
- Want sequential, interactive execution
- Need checkpoint interactions
</when_to_use>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="load_project_state" priority="first">
Before any operation, read project state:

```bash
cat .planning/STATE.md 2>/dev/null
```

**If file exists:** Parse and internalize:

- Current position (phase, plan, status)
- Accumulated decisions (constraints on this execution)
- Deferred issues (context for deviations)
- Blockers/concerns (things to watch for)

**If file missing but .planning/ exists:**

```
STATE.md missing but planning artifacts exist.
Options:
1. Reconstruct from existing artifacts
2. Continue without project state (may lose accumulated context)
```

**If .planning/ doesn't exist:** Error - project not initialized.
</step>

<step name="identify_phase">
**Identify the phase to execute from argument or roadmap.**

**1. Parse phase argument:**
```bash
# From command argument: /gsd:execute-phase 10
# Or: /gsd:execute-phase .planning/phases/10-parallel-execution/
PHASE_ARG="$1"
```

**2. Find phase directory:**
```bash
# If numeric: find matching directory
if [[ "$PHASE_ARG" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
  PHASE_DIR=$(ls -d .planning/phases/${PHASE_ARG}-* 2>/dev/null | head -1)
else
  PHASE_DIR="$PHASE_ARG"
fi

# Verify exists
if [ ! -d "$PHASE_DIR" ]; then
  echo "Error: Phase directory not found: $PHASE_DIR"
  exit 1
fi
```

**3. List all PLAN.md files:**
```bash
PLANS=($(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null | sort))
echo "Found ${#PLANS[@]} plans in phase"
```

**4. Identify unexecuted plans:**
```bash
UNEXECUTED=()
for plan in "${PLANS[@]}"; do
  summary="${plan//-PLAN.md/-SUMMARY.md}"
  if [ ! -f "$summary" ]; then
    UNEXECUTED+=("$plan")
  fi
done
echo "Unexecuted: ${#UNEXECUTED[@]} plans"
```

**5. Check if parallelization is appropriate:**

| Condition | Action |
|-----------|--------|
| 0 unexecuted plans | "All plans complete. Nothing to execute." |
| 1 unexecuted plan | "Single plan - use /gsd:execute-plan instead" |
| 2+ unexecuted plans | Proceed to dependency analysis |

</step>

<step name="analyze_plan_dependencies">
**Analyze plan dependencies to determine parallelization.**

**1. For each plan, extract dependency info:**

Read each plan file and extract:
- Frontmatter `requires:` field (explicit dependencies)
- `<files>` elements (files this plan modifies)
- References to other plan SUMMARYs in context

```bash
for plan in "${UNEXECUTED[@]}"; do
  # Extract frontmatter requires
  REQUIRES=$(grep -A10 "^---" "$plan" | grep "requires:" | cut -d: -f2-)

  # Extract files from <files> elements
  FILES=$(grep -oP '(?<=<files>).*(?=</files>)' "$plan")

  # Check for SUMMARY references in context
  SUMMARY_REFS=$(grep -oP '\d+-\d+-SUMMARY\.md' "$plan" || echo "")
done
```

**2. Build dependency graph:**

For each plan, determine:
- `requires`: Prior phases/plans this depends on
- `files_modified`: Files from `<files>` elements
- `has_checkpoints`: Contains checkpoint tasks

```
Plan dependencies:
- 10-01: requires=[], files=[workflow/execute-plan.md], checkpoints=false
- 10-02: requires=[10-01], files=[workflow/execute-phase.md], checkpoints=false
- 10-03: requires=[10-02], files=[commands/execute-phase.md], checkpoints=false
- 10-04: requires=[], files=[templates/agent-history.md], checkpoints=false
```

**3. Detect conflicts:**

```
File conflict rules:
- If Plan A and Plan B both modify same file → sequential (B depends on A)
- If Plan B reads file created by Plan A → B depends on A
- If Plan B references Plan A's SUMMARY → B depends on A
```

**4. Categorize plans:**

| Category | Criteria | Action |
|----------|----------|--------|
| independent | No dependencies, no file conflicts | Can run in parallel |
| dependent | Requires another plan | Wait for dependency |
| has_checkpoints | Contains checkpoint tasks | Foreground or skip checkpoints |

**5. Build execution waves:**

Group plans into waves based on dependencies:
```
Wave 1: Plans with no dependencies (can run in parallel)
Wave 2: Plans that depend only on Wave 1 (run after Wave 1 completes)
Wave 3: Plans that depend on Wave 2 (run after Wave 2 completes)
...
```

**6. Safety rule:**
If dependency detection is uncertain, default to sequential execution.
</step>

<step name="parallelization_config">
**Read parallelization configuration.**

```bash
cat .planning/config.json 2>/dev/null
```

**Config schema (parallelization section):**

```json
{
  "parallelization": {
    "enabled": true,
    "max_concurrent_agents": 3,
    "checkpoint_handling": "foreground",
    "commit_strategy": "orchestrator"
  }
}
```

**Config options:**

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| enabled | true/false | true | Enable parallel execution |
| max_concurrent_agents | 1-5 | 3 | Max simultaneous background agents |
| checkpoint_handling | "foreground"/"skip" | "foreground" | How to handle plans with checkpoints |
| commit_strategy | "orchestrator"/"agent" | "orchestrator" | Who commits changes |

**If parallelization.enabled is false:**
- Fall back to sequential execution
- Use /gsd:execute-plan for each plan in order

**Checkpoint handling modes:**
- `foreground`: Plans with checkpoints run in foreground (not parallel)
- `skip`: Skip checkpoints during parallel execution (not recommended)

**Commit strategy:**
- `orchestrator`: Agents don't commit. Orchestrator collects all changes and commits.
- `agent`: Each agent commits its own changes (may cause conflicts)
</step>

<step name="spawn_parallel_agents">
**Spawn independent plans as parallel background agents.**

**1. Record pre-spawn git state:**
```bash
PRE_SPAWN_COMMIT=$(git rev-parse HEAD)
echo "All agents start from commit: $PRE_SPAWN_COMMIT"
```

**2. Generate parallel group ID:**
```bash
PARALLEL_GROUP="pg-$(date +%Y%m%d%H%M%S)-$(uuidgen | cut -d- -f1)"
```

**3. Initialize tracking:**
```bash
# Ensure agent-history.json exists
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.2","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
```

**4. For each wave, spawn independent plans:**

For Wave 1 (no dependencies):
```
For each independent plan in Wave 1:
  1. Check max_concurrent_agents limit
  2. Spawn via Task tool with run_in_background: true
  3. Record in agent-history.json
  4. Track spawned agent IDs
```

**Agent spawn prompt (for plans WITHOUT checkpoints):**
```
"You are running as a PARALLEL agent executing plan: {plan_path}

**CRITICAL INSTRUCTIONS:**
1. Execute ALL tasks in the plan
2. DO NOT commit any changes - the orchestrator will handle commits
3. Track all files you create or modify
4. Follow all deviation rules from the plan
5. Create SUMMARY.md when complete (do not commit it)

**When done, report:**
- Plan name
- Tasks completed (count and names)
- Files created/modified (full paths)
- Deviations encountered
- SUMMARY.md path
- Any issues or blockers

**Do NOT:**
- Run git commit
- Run git add (except to check status)
- Push to remote
- Modify files outside plan scope"
```

**5. Record spawn in agent-history.json:**
```json
{
  "agent_id": "[from Task response]",
  "task_description": "Parallel: Execute {phase}-{plan}-PLAN.md",
  "phase": "{phase}",
  "plan": "{plan}",
  "parallel_group": "{PARALLEL_GROUP}",
  "granularity": "plan",
  "wave": 1,
  "timestamp": "[ISO]",
  "status": "spawned",
  "files_modified": [],
  "completion_timestamp": null
}
```

**6. Queue dependent plans:**
Plans in Wave 2+ are queued, not spawned yet.
They spawn after their dependencies complete.
</step>

<step name="monitor_parallel_completion">
**Poll for agent completion and spawn dependents.**

**1. Polling loop:**
```
running_agents = [list of spawned agent IDs]

while running_agents.length > 0:
  for agent_id in running_agents:
    result = TaskOutput(task_id=agent_id, block=false, timeout=5000)

    if result.status == "completed":
      # Capture results
      files_modified = parse_files_from_result(result)

      # Update agent-history.json
      update_entry(agent_id, status="completed", files_modified=files_modified)

      # Remove from running list
      running_agents.remove(agent_id)

      # Check if dependents can now start
      spawn_ready_dependents()

    elif result.status == "failed":
      log_failure(agent_id, result.error)
      running_agents.remove(agent_id)
      # Continue with other agents - don't kill batch

  sleep(10)  # Poll every 10 seconds
```

**2. Spawn ready dependents:**
```
For each queued plan in Wave 2+:
  if all dependencies completed:
    if under max_concurrent_agents limit:
      spawn_agent(plan)
      move from queue to running_agents
```

**3. Handle failures:**
- Log failed agent to agent-history.json with status="failed"
- Continue monitoring other agents
- Report failures in final summary
- Do NOT automatically retry (user decision)

**4. Completion:**
When all agents complete (running_agents empty and queue empty):
- Proceed to orchestrator_commit step
</step>

<step name="orchestrator_commit">
**Batch commit after all agents complete.**

**1. Collect files from all agents:**
```bash
# Read agent-history.json
# For each agent in this parallel_group:
#   Collect files_modified arrays
#   Merge into master list

ALL_FILES=()
for entry in $(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\") | .files_modified[]" .planning/agent-history.json); do
  ALL_FILES+=("$entry")
done
```

**2. Check for merge conflicts:**
```bash
# Files modified by multiple agents = potential conflict
CONFLICTS=$(echo "${ALL_FILES[@]}" | tr ' ' '\n' | sort | uniq -d)

if [ -n "$CONFLICTS" ]; then
  echo "WARNING: Multiple agents modified same files:"
  echo "$CONFLICTS"
  echo "Manual conflict resolution may be needed."
fi
```

**3. Stage and commit per-plan:**
```bash
# For each completed agent (in execution order):
for agent in $(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\" and .status==\"completed\") | .agent_id" .planning/agent-history.json | sort); do
  PLAN=$(jq -r ".entries[] | select(.agent_id==\"$agent\") | .plan" .planning/agent-history.json)
  FILES=$(jq -r ".entries[] | select(.agent_id==\"$agent\") | .files_modified[]" .planning/agent-history.json)

  # Stage files for this plan
  for f in $FILES; do
    git add "$f"
  done

  # Commit with plan context
  git commit -m "feat({phase}-{plan}): [plan name from PLAN.md]

- [task 1]
- [task 2]
- [task 3]

Executed by parallel agent: $agent"
done
```

**4. Stage and commit metadata:**
```bash
# Stage all SUMMARY.md files created
git add .planning/phases/${PHASE_DIR}/*-SUMMARY.md

# Stage STATE.md and ROADMAP.md
git add .planning/STATE.md
git add .planning/ROADMAP.md

# Commit metadata
git commit -m "docs(${PHASE}): complete phase via parallel execution

Plans executed: ${#COMPLETED[@]}
Parallel group: $PARALLEL_GROUP

Agents:
$(for a in "${COMPLETED[@]}"; do echo "- $a"; done)"
```

**5. Generate timing stats:**
```bash
START_TIME=$(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\") | .timestamp" .planning/agent-history.json | sort | head -1)
END_TIME=$(jq -r ".entries[] | select(.parallel_group==\"$PARALLEL_GROUP\") | .completion_timestamp" .planning/agent-history.json | sort -r | head -1)

echo "Parallel execution stats:"
echo "- Plans executed: ${#COMPLETED[@]}"
echo "- Wall clock time: $(time_diff $START_TIME $END_TIME)"
echo "- Sequential estimate: $(sum of individual plan durations)"
echo "- Time saved: ~X%"
```
</step>

<step name="create_phase_summary">
**Aggregate results into phase-level summary.**

After all plans complete, create a phase summary that aggregates:

**1. Collect individual SUMMARY.md files:**
```bash
SUMMARIES=($(ls "$PHASE_DIR"/*-SUMMARY.md | sort))
```

**2. Update STATE.md:**
- Update Current Position
- Add any decisions from individual summaries
- Update session continuity

**3. Update ROADMAP.md:**
- Mark phase as complete
- Add completion date
- Update progress table

**4. Report completion:**
```
═══════════════════════════════════════════════════
Phase {X}: {Phase Name} Complete (Parallel Execution)
═══════════════════════════════════════════════════

Plans executed: {N}
- {phase}-01: [name] - {duration}
- {phase}-02: [name] - {duration}
- {phase}-03: [name] - {duration}

Execution mode: Parallel ({max_concurrent} agents)
Wall clock time: {total_duration}
Estimated sequential time: {sum_of_durations}
Time saved: ~{percent}%

Files modified: {total_count}
Commits created: {commit_count}
```
</step>

<step name="offer_next">
**Present next steps after phase completion.**

Read ROADMAP.md to determine milestone status.

**If more phases remain in milestone:**
```
## ✓ Phase {X}: {Phase Name} Complete

All {N} plans finished via parallel execution.

---

## ▶ Next Up

**Phase {X+1}: {Next Phase Name}** — {Goal from ROADMAP.md}

`/gsd:plan-phase {X+1}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:verify-work {X}` — manual acceptance testing
- `/gsd:discuss-phase {X+1}` — gather context first
```

**If milestone complete:**
```
🎉 MILESTONE COMPLETE!

All {N} phases finished.

`/gsd:complete-milestone`
```
</step>

</process>

<error_handling>

**Agent failure during parallel execution:**
- Log failure but continue with other agents
- Failed plans can be retried individually with /gsd:execute-plan
- Do not automatically retry (may cause cascade failures)

**Merge conflict detected:**
- Stop orchestrator_commit
- Present conflicting files to user
- Options:
  1. Manual resolution
  2. Re-run sequential with /gsd:execute-plan

**Max concurrent limit reached:**
- Queue excess plans
- Spawn as agents complete
- First-in-first-out ordering within each wave

**Config.json missing:**
- Use defaults: enabled=true, max_concurrent=3, orchestrator commits

</error_handling>

<success_criteria>
- All plans in phase executed
- All agents completed (no failures)
- Commits created for all plans
- STATE.md updated
- ROADMAP.md updated
- No merge conflicts
</success_criteria>
