<purpose>
Execute a phase prompt (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<parallel_flag>
If the user invokes /nf:execute-phase with --parallel flag, Pattern D routing is enabled.
Without --parallel, existing Pattern A/B/C behavior is unchanged.
Pattern D requires: no checkpoints in plan AND --parallel flag detected.
</parallel_flag>

<required_reading>
Read STATE.md before any operation to load project context.
Read config.json for planning behavior settings.

@~/.claude/nf/references/git-integration.md
</required_reading>

<process>

<step name="init_context" priority="first">
Load execution context (paths only to minimize orchestrator context):

```bash
INIT=$(node ~/.claude/nf/bin/gsd-tools.cjs init execute-phase "${PHASE}")
```

Extract from init JSON: `executor_model`, `commit_docs`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`, `state_path`, `config_path`.

If `.planning/` missing: error.
</step>

<step name="identify_plan">
```bash
# Use plans/summaries from INIT JSON, or list files
ls .planning/phases/XX-name/*-PLAN.md 2>/dev/null | sort
ls .planning/phases/XX-name/*-SUMMARY.md 2>/dev/null | sort
```

Find first PLAN without matching SUMMARY. Decimal phases supported (`01.1-hotfix/`):

```bash
PHASE=$(echo "$PLAN_PATH" | grep -oE '[0-9]+(\.[0-9]+)?-[0-9]+')
# config settings can be fetched via gsd-tools config-get if needed
```

<if mode="yolo">
Auto-approve: `⚡ Execute {phase}-{plan}-PLAN.md [Plan X of Y for Phase Z]` → parse_segments.
</if>

<if mode="interactive" OR="custom with gates.execute_next_plan true">
Present plan identification, wait for confirmation.
</if>
</step>

<step name="check_resume_state">
Check if resuming after compaction:

```bash
RESUME_STATE=$(node bin/execution-progress.cjs get-status)
```

Parse the JSON result:
- If `status` is `"no_progress_file"`: fresh start, continue normally.
- If `status` is `"failed"`: report failure reason to user. If `failure_reason` is `"iteration_cap_exhausted"`, say "Execution cap reached after {iteration_count} compaction cycles -- this plan may need manual intervention." If `failure_reason` is `"stuck_on_task"`, say "Stuck on Task {stuck_task} after {resume_attempts} attempts -- investigate why this task cannot complete."
- If `status` is `"in_progress"`: this is a post-compaction resume. Check that `plan_file` matches the current plan. If it matches, skip completed tasks and resume at the first `pending` or `in_progress` task. If it does not match (stale from prior plan), call `node bin/execution-progress.cjs init ...` to overwrite with current plan.
- If `status` is `"complete"`: stale file from a completed plan. Call `node bin/execution-progress.cjs clear` and continue fresh.
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

Initialize execution progress tracking:
```bash
PLAN_TASK_COUNT=$(grep -c '<task type=' .planning/phases/XX-name/{phase}-{plan}-PLAN.md)
PLAN_TASK_NAMES=$(grep '<name>' .planning/phases/XX-name/{phase}-{plan}-PLAN.md | sed 's/.*<name>//;s/<\/name>.*//' | paste -sd',' -)
node bin/execution-progress.cjs init --plan "{phase}-{plan}-PLAN.md" --tasks "$PLAN_TASK_COUNT" --names "$PLAN_TASK_NAMES"
```

Parse done_conditions from PLAN.md tasks (if present):
```bash
# Each task may have a <done_conditions> element containing JSON array of conditions.
# Extract and pass to execution-progress.cjs init via --done-conditions flag.
DONE_CONDITIONS=$(node -e "
  const fs = require('fs');
  const plan = fs.readFileSync('$PLAN_PATH', 'utf8');
  const tasks = plan.match(/<task[^>]*>[\s\S]*?<\/task>/g) || [];
  const conditions = tasks.map(t => {
    const m = t.match(/<done_conditions>([\s\S]*?)<\/done_conditions>/);
    return m ? JSON.parse(m[1].trim()) : [];
  });
  console.log(JSON.stringify(conditions));
" 2>/dev/null || echo '[]')
# If done_conditions were found, re-init with them:
if [ "$DONE_CONDITIONS" != "[]" ]; then
  node bin/execution-progress.cjs init --plan "{phase}-{plan}-PLAN.md" --tasks "$PLAN_TASK_COUNT" --names "$PLAN_TASK_NAMES" --done-conditions "$DONE_CONDITIONS"
fi
```

Note: done_conditions are optional. If a task has no `<done_conditions>` element, it defaults to an empty array.
</step>

<step name="parse_segments">
```bash
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**Routing by checkpoint type and independence:**

| Checkpoints | Independence | Pattern | Execution |
|-------------|-------------|---------|-----------|
| None | Yes, --parallel | D (parallel) | Parallel worktree executors per task, merge orchestration |
| None | No or no --parallel | A (autonomous) | Single subagent: full plan |
| Verify-only | - | B (segmented) | Segments between checkpoints |
| Decision | - | C (main) | Execute entirely in main context |

Pattern D is selected ONLY when: (1) no checkpoints found AND (2) --parallel flag is present. Otherwise, existing A/B/C routing applies unchanged.

**Pattern A:** init_agent_tracking → spawn Task(subagent_type="nf-executor", model=executor_model, description="Execute plan {plan_number}: {phase_number}-{phase_name}") with prompt: execute plan at [path], autonomous, all tasks + SUMMARY + commit, follow deviation/auth rules, report: plan name, tasks, SUMMARY path, commit hash → track agent_id → wait → update tracking → report.

**Pattern B:** Execute segment-by-segment. Autonomous segments: spawn subagent for assigned tasks only (no SUMMARY/commit). Checkpoints: main context. After all segments: aggregate, create SUMMARY, commit. See segment_execution.

**Pattern C:** Execute in main using standard flow (step name="execute").

Fresh context per subagent preserves peak quality. Main context stays lean.
</step>

<step name="detect_parallel_tasks">
Pattern D only (no checkpoints AND --parallel flag). Skip for A/B/C.

Parse all `<task>` elements from the plan and extract their `<files>` lists:

```bash
# Extract file lists per task from PLAN.md
node -e "
  const fs = require('fs');
  const plan = fs.readFileSync('$PLAN_PATH', 'utf8');
  const tasks = plan.match(/<task[^>]*>[\s\S]*?<\/task>/g) || [];
  const taskFiles = tasks.map((t, i) => {
    const filesMatch = t.match(/<files>([\s\S]*?)<\/files>/);
    const files = filesMatch ? filesMatch[1].trim().split(/\n/).map(f => f.trim()).filter(Boolean) : [];
    return { task: i + 1, files };
  });
  console.log(JSON.stringify(taskFiles));
"
```

**Independence detection algorithm:**

1. **SERIAL_FILES list** — any task touching these files MUST run sequentially (never in parallel):
   - STATE.md, ROADMAP.md, REQUIREMENTS.md
   - package.json, package-lock.json
   - .gitignore, .claude/settings.json
   - Any config files matching `*.config.{js,ts,cjs,mjs}`
   These shared resources have high contention risk and MUST NOT be modified by parallel worktrees.

2. **Install sync detection** — tasks containing `install.js --claude --global` force sequential execution (modifies global state).

3. **Empty files lists** — tasks with EMPTY `<files>` lists are treated as non-overlapping and parallelizable. Documentation-only or verification tasks with no file output can safely run in parallel.

4. **Overlap detection** — for tasks with non-empty file lists, check pairwise overlap:
   - If task A files intersect with task B files, they must run sequentially
   - If no overlap, they can run in parallel

5. **Output:** `parallel_groups` (tasks that can run simultaneously) and `sequential_tasks` (must run in order)

6. **Fallback:** If no parallel groups found (all tasks overlap or all require serial files), fall back to Pattern A.

```
# Pseudocode for independence detection:
SERIAL_FILES = [
  "STATE.md", "ROADMAP.md", "REQUIREMENTS.md",
  "package.json", "package-lock.json",
  ".gitignore", ".claude/settings.json"
]
SERIAL_PATTERNS = ["*.config.js", "*.config.ts", "*.config.cjs", "*.config.mjs"]

for each task:
  if task.files intersects SERIAL_FILES or matches SERIAL_PATTERNS:
    → sequential_tasks
  elif task.action contains "install.js --claude --global":
    → sequential_tasks
  elif task.files is empty:
    → parallel_groups (safe to parallelize)
  else:
    → check overlap with other tasks
      overlapping → sequential_tasks
      independent → parallel_groups

if parallel_groups.length == 0:
  fall back to Pattern A
```
</step>

<step name="parallel_dispatch">
Pattern D only. Executes after detect_parallel_tasks identifies parallel_groups and sequential_tasks.

**PARALLEL_BATCH_TIMEOUT:** 15 minutes for the entire parallel batch. If any executor has not completed within this window, treat it as failed and proceed with completed executors only.

**1. Pre-dispatch validation:**
```bash
# Ensure all current changes are committed before creating worktrees
git status --porcelain | head -5
# If uncommitted changes exist, commit or stash before proceeding
```

**2. Parallel task dispatch:**
For each task in parallel_groups, spawn a worktree executor:

```
Spawn Task(subagent_type="nf-worktree-executor",
           description="Execute task {N}: {task_name}",
           prompt="Execute task {N} from plan at {plan_path}.
                   IMPORTANT: Skip state_updates and final_commit steps -- the orchestrator handles those after merge.
                   Report completion with a fenced JSON block at the end of your output:
                   ```json
                   {\"worktree_branch\": \"<branch>\", \"task_number\": <N>, \"status\": \"complete|failed\", \"files_modified\": [...]}
                   ```",
           maxTurns=50)
```

**maxTurns=50** prevents runaway execution (same default as nf-executor tasks).

Wait for ALL parallel tasks to complete (or timeout at PARALLEL_BATCH_TIMEOUT of 15 minutes).

**3. Collect results — structured JSON parsing:**
Parse each executor's output by extracting the fenced JSON block:
- Extract content between \`\`\`json and \`\`\` markers using regex
- JSON.parse the extracted content
- Do NOT use grep for free-form worktree_branch text
- Collect branch names, task numbers, statuses, and files_modified from each

**4. Partial failure handling:**
When one or more executors fail but others succeed:
  a. Log failed executors to stderr with task numbers and error details
  b. Proceed with merging ONLY the successful branches (do not block on failures)
  c. Record failed tasks in the SUMMARY.md with status "failed-parallel" and the error
  d. After merge of successful branches, report which tasks need re-execution (fall back to Pattern A for those specific tasks)

**5. Sequential task execution:**
Run sequential_tasks in order (same as Pattern A, in main worktree). These run after parallel tasks complete and merge.

**6. Merge orchestration:**
After all parallel tasks complete:

```bash
# a. Pre-merge validation
node bin/worktree-merge.cjs ensure-clean

# b. Merge parallel branches
node bin/worktree-merge.cjs merge <branch1> <branch2> ...

# c. Check merge results -- if conflict, report to user and fall back to manual resolution

# d. Post-merge verification (includes automatic rollback on failure)
node bin/worktree-merge.cjs verify

# e. Cleanup worktree branches
node bin/worktree-merge.cjs cleanup <branch1> <branch2> ...

# f. Aggregate execution progress from worktrees
node bin/execution-progress.cjs aggregate-parallel <worktree-path1> <worktree-path2> ...
```

**7. Post-merge validation:**
```bash
# Verify no orphaned worktrees remain
git worktree list
# Should show only main worktree
```

**8. Completion:**
- Create SUMMARY.md aggregating all task results (parallel + sequential)
- Commit metadata (STATE.md, ROADMAP.md, REQUIREMENTS.md, SUMMARY.md)

**Safety notes:**
- If worktree creation fails (Claude Code error), fall back to Pattern A with stderr warning
- Worktrees branch from origin/main -- ensure current changes are committed before parallel dispatch
- After merge, verify no orphaned worktrees: `git worktree list` should show only main worktree
- On partial executor failure: merge successful branches, report failures, suggest Pattern A re-run for failed tasks
- Pre-merge state is validated by ensureCleanState; post-merge failures trigger automatic rollback
- maxTurns=50 on worktree executors prevents runaway execution
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
rm -f .planning/current-agent-id.txt
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

If interrupted: ask user to resume (Task `resume` parameter) or start fresh.

**Tracking protocol:** On spawn: write agent_id to `current-agent-id.txt`, append to agent-history.json: `{"agent_id":"[id]","task_description":"[desc]","phase":"[phase]","plan":"[plan]","segment":[num|null],"timestamp":"[ISO]","status":"spawned","completion_timestamp":null}`. On completion: status → "completed", set completion_timestamp, delete current-agent-id.txt. Prune: if entries > max_entries, remove oldest "completed" (never "spawned").

Run for Pattern A/B before spawning. Pattern C: skip.
</step>

<step name="segment_execution">
Pattern B only (verify-only checkpoints). Skip for A/C.

1. Parse segment map: checkpoint locations and types
2. Per segment:
   - Subagent route: spawn nf-executor for assigned tasks only. Prompt: task range, plan path, read full plan for context, execute assigned tasks, track deviations, NO SUMMARY/commit. Track via agent protocol.
   - Main route: execute tasks using standard flow (step name="execute")
3. After ALL segments: aggregate files/deviations/decisions → create SUMMARY.md → commit → self-check:
   - Verify key-files.created exist on disk with `[ -f ]`
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns ≥1 commit
   - Append `## Self-Check: PASSED` or `## Self-Check: FAILED` to SUMMARY

   **Known Claude Code bug (classifyHandoffIfNeeded):** If any segment agent reports "failed" with `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Run spot-checks; if they pass, treat as successful.




</step>

<step name="load_prompt">
```bash
cat .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```
This IS the execution instructions. Follow exactly. If plan references CONTEXT.md: honor user's vision throughout.
</step>

<step name="previous_phase_check">
```bash
node ~/.claude/nf/bin/gsd-tools.cjs phases list --type summaries --raw
# Extract the second-to-last summary from the JSON result
```
If previous SUMMARY has unresolved "Issues Encountered" or "Next Phase Readiness" blockers: AskUserQuestion(header="Previous Issues", options: "Proceed anyway" | "Address first" | "Review previous").
</step>

<step name="execute">
Deviations are normal — handle via rules below.

1. Read @context files from prompt
2. Per task:
   - `type="auto"`: if `tdd="true"` → TDD execution. Implement with deviation rules + auth gates. Verify done criteria. Commit (see task_commit). Track hash for Summary.
   - `type="checkpoint:*"`: STOP → checkpoint_protocol → wait for user → continue only after confirmation.
3. Run `<verification>` checks
4. Confirm `<success_criteria>` met
5. Document deviations in Summary
</step>

<authentication_gates>

## Authentication Gates

Auth errors during execution are NOT failures — they're expected interaction points.

**Indicators:** "Not authenticated", "Unauthorized", 401/403, "Please run {tool} login", "Set {ENV_VAR}"

**Protocol:**
1. Recognize auth gate (not a bug)
2. STOP task execution
3. Create dynamic checkpoint:human-action with exact auth steps
4. Wait for user to authenticate
5. Verify credentials work
6. Retry original task
7. Continue normally

**Example:** `vercel --yes` → "Not authenticated" → checkpoint asking user to `vercel login` → verify with `vercel whoami` → retry deploy → continue

**In Summary:** Document as normal flow under "## Authentication Gates", not as deviations.

</authentication_gates>

<deviation_rules>

## Deviation Rules

You WILL discover unplanned work. Apply automatically, track all for Summary.

| Rule | Trigger | Action | Permission |
|------|---------|--------|------------|
| **1: Bug** | Broken behavior, errors, wrong queries, type errors, security vulns, race conditions, leaks | Fix → test → verify → track `[Rule 1 - Bug]` | Auto |
| **2: Missing Critical** | Missing essentials: error handling, validation, auth, CSRF/CORS, rate limiting, indexes, logging | Add → test → verify → track `[Rule 2 - Missing Critical]` | Auto |
| **3: Blocking** | Prevents completion: missing deps, wrong types, broken imports, missing env/config/files, circular deps | Fix blocker → verify proceeds → track `[Rule 3 - Blocking]` | Auto |
| **4: Architectural** | Structural change: new DB table, schema change, new service, switching libs, breaking API, new infra | STOP → present decision (below) → track `[Rule 4 - Architectural]` | Ask user |

**Rule 4 format:**
```
⚠️ Architectural Decision Needed

Current task: [task name]
Discovery: [what prompted this]
Proposed change: [modification]
Why needed: [rationale]
Impact: [what this affects]
Alternatives: [other approaches]

Proceed with proposed change? (yes / different approach / defer)
```

**Priority:** Rule 4 (STOP) > Rules 1-3 (auto) > unsure → Rule 4
**Edge cases:** missing validation → R2 | null crash → R1 | new table → R4 | new column → R1/2
**Heuristic:** Affects correctness/security/completion? → R1-3. Maybe? → R4.

</deviation_rules>

<deviation_documentation>

## Documenting Deviations

Summary MUST include deviations section. None? → `## Deviations from Plan\n\nNone - plan executed exactly as written.`

Per deviation: **[Rule N - Category] Title** — Found during: Task X | Issue | Fix | Files modified | Verification | Commit hash

End with: **Total deviations:** N auto-fixed (breakdown). **Impact:** assessment.

</deviation_documentation>

<tdd_plan_execution>
## TDD Execution

For `type: tdd` plans — RED-GREEN-REFACTOR:

1. **Infrastructure** (first TDD plan only): detect project, install framework, config, verify empty suite
2. **RED:** Read `<behavior>` → failing test(s) → run (MUST fail) → commit: `test({phase}-{plan}): add failing test for [feature]`
3. **GREEN:** Read `<implementation>` → minimal code → run (MUST pass) → commit: `feat({phase}-{plan}): implement [feature]`
4. **REFACTOR:** Clean up → tests MUST pass → commit: `refactor({phase}-{plan}): clean up [feature]`

Errors: RED doesn't fail → investigate test/existing feature. GREEN doesn't pass → debug, iterate. REFACTOR breaks → undo.

See `~/.claude/nf/references/tdd.md` for structure.
</tdd_plan_execution>

<task_commit>
## Task Commit Protocol

After each task (verification passed, done criteria met), commit immediately.

**1. Check:** `git status --short`

**2. Stage individually** (NEVER `git add .` or `git add -A`):
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**3. Commit type:**

| Type | When | Example |
|------|------|---------|
| `feat` | New functionality | feat(08-02): create user registration endpoint |
| `fix` | Bug fix | fix(08-02): correct email validation regex |
| `test` | Test-only (TDD RED) | test(08-02): add failing test for password hashing |
| `refactor` | No behavior change (TDD REFACTOR) | refactor(08-02): extract validation to helper |
| `perf` | Performance | perf(08-02): add database index |
| `docs` | Documentation | docs(08-02): add API docs |
| `style` | Formatting | style(08-02): format auth module |
| `chore` | Config/deps | chore(08-02): add bcrypt dependency |

**4. Format:** `{type}({phase}-{plan}): {description}` with bullet points for key changes.

**5. Record hash:**
```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
TASK_COMMITS+=("Task ${TASK_NUM}: ${TASK_COMMIT}")
```

**6. Machine-Verifiable Completion Check (done_conditions):**

After each task completes successfully, if the task has done_conditions defined:

1. Run: `node bin/continuous-verify.cjs evaluate --cwd . --conditions '<json-array>'`
2. Parse the JSON result. If `all_pass` is false:
   - Report which conditions failed
   - Attempt to fix the failing conditions (e.g., run lint fix, fix test)
   - Re-evaluate. If still failing after one retry, note in SUMMARY.md and continue (advisory, not blocking).
3. If `all_pass` is true, proceed to mark task complete via execution-progress.cjs.

Note: done_conditions evaluation is advisory. A task can still be marked complete even if conditions fail,
but the executor should make a good-faith effort to satisfy them first.

**7. Record execution progress:**
```bash
node bin/execution-progress.cjs complete-task --number ${TASK_NUM} --commit $(git rev-parse --short HEAD)
```

Note: For Pattern A/B (subagent), the orchestrator updates progress after the subagent returns, not the subagent itself. Orchestrator-level tracking for Pattern A/B is deferred.

</task_commit>

<step name="checkpoint_protocol">
On `type="checkpoint:*"`: automate everything possible first. Checkpoints are for verification/decisions only.

Display: `CHECKPOINT: [Type]` box → Progress {X}/{Y} → Task name → type-specific content → `YOUR ACTION: [signal]`

| Type | Content | Resume signal |
|------|---------|---------------|
| human-verify (90%) | What was built + verification steps (commands/URLs) | "approved" or describe issues |
| decision (9%) | Decision needed + context + options with pros/cons | "Select: option-id" |
| human-action (1%) | What was automated + ONE manual step + verification plan | "done" |

After response: verify if specified. Pass → continue. Fail → inform, wait. WAIT for user — do NOT hallucinate completion.

See ~/.claude/nf/references/checkpoints.md for details.
</step>

<step name="checkpoint_return_for_orchestrator">
When spawned via Task and hitting checkpoint: return structured state (cannot interact with user directly).

**Required return:** 1) Completed Tasks table (hashes + files) 2) Current Task (what's blocking) 3) Checkpoint Details (user-facing content) 4) Awaiting (what's needed from user)

Orchestrator parses → presents to user → spawns fresh continuation with your completed tasks state. You will NOT be resumed. In main context: use checkpoint_protocol above.
</step>

<step name="verification_failure_gate">
If verification fails: STOP. Present: "Verification failed for Task [X]: [name]. Expected: [criteria]. Actual: [result]." Options: Retry | Skip (mark incomplete) | Stop (investigate). If skipped → SUMMARY "Issues Encountered".
</step>

<step name="record_completion_time">
```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```
</step>

<step name="generate_user_setup">
```bash
grep -A 50 "^user_setup:" .planning/phases/XX-name/{phase}-{plan}-PLAN.md | head -50
```

If user_setup exists: create `{phase}-USER-SETUP.md` using template `~/.claude/nf/templates/user-setup.md`. Per service: env vars table, account setup checklist, dashboard config, local dev notes, verification commands. Status "Incomplete". Set `USER_SETUP_CREATED=true`. If empty/missing: skip.
</step>

<step name="create_summary">
Create `{phase}-{plan}-SUMMARY.md` at `.planning/phases/XX-name/`. Use `~/.claude/nf/templates/summary.md`.

**Frontmatter:** phase, plan, subsystem, tags | requires/provides/affects | tech-stack.added/patterns | key-files.created/modified | key-decisions | requirements-completed (**MUST** copy `requirements` array from PLAN.md frontmatter verbatim) | duration ($DURATION), completed ($PLAN_END_TIME date).

Title: `# Phase [X] Plan [Y]: [Name] Summary`

One-liner SUBSTANTIVE: "JWT auth with refresh rotation using jose library" not "Authentication implemented"

Include: duration, start/end times, task count, file count.

Next: more plans → "Ready for {next-plan}" | last → "Phase complete, ready for transition".

Clear execution progress (plan complete):
```bash
node bin/execution-progress.cjs clear
```
</step>

<step name="update_current_position">
Update STATE.md using gsd-tools:

```bash
# Advance plan counter (handles last-plan edge case)
node ~/.claude/nf/bin/gsd-tools.cjs state advance-plan

# Recalculate progress bar from disk state
node ~/.claude/nf/bin/gsd-tools.cjs state update-progress

# Record execution metrics
node ~/.claude/nf/bin/gsd-tools.cjs state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
</step>

<step name="extract_decisions_and_issues">
From SUMMARY: Extract decisions and add to STATE.md:

```bash
# Add each decision from SUMMARY key-decisions
node ~/.claude/nf/bin/gsd-tools.cjs state add-decision \
  --phase "${PHASE}" --summary "${DECISION_TEXT}" --rationale "${RATIONALE}"

# Add blockers if any found
node ~/.claude/nf/bin/gsd-tools.cjs state add-blocker "Blocker description"
```
</step>

<step name="update_session_continuity">
Update session info using gsd-tools:

```bash
node ~/.claude/nf/bin/gsd-tools.cjs state record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" \
  --resume-file "None"
```

Keep STATE.md under 150 lines.
</step>

<step name="issues_review_gate">
If SUMMARY "Issues Encountered" ≠ "None": yolo → log and continue. Interactive → present issues, wait for acknowledgment.
</step>

<step name="update_roadmap">
```bash
node ~/.claude/nf/bin/gsd-tools.cjs roadmap update-plan-progress "${PHASE}"
```
Counts PLAN vs SUMMARY files on disk. Updates progress table row with correct count and status (`In Progress` or `Complete` with date).
</step>

<step name="update_requirements">
Mark completed requirements from the PLAN.md frontmatter `requirements:` field:

```bash
node ~/.claude/nf/bin/gsd-tools.cjs requirements mark-complete ${REQ_IDS}
```

Extract requirement IDs from the plan's frontmatter (e.g., `requirements: [AUTH-01, AUTH-02]`). If no requirements field, skip.
</step>

<step name="git_commit_metadata">
Task code already committed per-task. Commit plan metadata:

```bash
node ~/.claude/nf/bin/gsd-tools.cjs commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```
</step>

<step name="update_codebase_map">
If .planning/codebase/ doesn't exist: skip.

```bash
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null
```

Update only structural changes: new src/ dir → STRUCTURE.md | deps → STACK.md | file pattern → CONVENTIONS.md | API client → INTEGRATIONS.md | config → STACK.md | renamed → update paths. Skip code-only/bugfix/content changes.

```bash
node ~/.claude/nf/bin/gsd-tools.cjs commit "" --files .planning/codebase/*.md --amend
```
</step>

<step name="offer_next">
If `USER_SETUP_CREATED=true`: display `⚠️ USER SETUP REQUIRED` with path + env/config tasks at TOP.

```bash
ls -1 .planning/phases/[current-phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[current-phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

| Condition | Route | Action |
|-----------|-------|--------|
| summaries < plans | **A: More plans** | Find next PLAN without SUMMARY. Yolo: auto-continue. Interactive: show next plan, suggest `/nf:execute-phase {phase}` + `/nf:verify-work`. STOP here. |
| summaries = plans, current < highest phase | **B: Phase done** | Show completion, suggest `/nf:plan-phase {Z+1}` + `/nf:verify-work {Z}` + `/nf:discuss-phase {Z+1}` |
| summaries = plans, current = highest phase | **C: Milestone done** | Show banner, detect gap closure, chain into audit-milestone (see below) |

---

**Route C expanded: Milestone done — chain into audit-milestone**

Step 1: Detect whether the completed phase is a Gap Closure phase.

```bash
# Check if the completed phase's ROADMAP.md entry has a Gap Closure marker
IS_GAP_CLOSURE=$(grep -A 4 "^### Phase ${COMPLETED_PHASE}:" .planning/ROADMAP.md | grep -c '\*\*Gap Closure:\*\*')
# IS_GAP_CLOSURE=0 -> primary path (first audit before completing)
# IS_GAP_CLOSURE=1+ -> re-audit path (gap closure phase just finished)
```

Step 2a: Gap Closure re-audit path (IS_GAP_CLOSURE=1+)

<if mode="yolo">

```
Phase {X} plan complete — all plans finished.

Gap closure phase finished — re-auditing milestone {version}

Auto-continuing: Re-run milestone audit to verify gaps are closed
```

Exit and invoke SlashCommand("/nf:audit-milestone {version} --auto")

</if>

<if mode="interactive">

```
## Phase {X}: {Phase Name} Complete

Gap closure phase finished.

---

## Next Up

**Re-audit Milestone {version}** — verify gap closure succeeded

`/nf:audit-milestone {version}`

<sub>`/clear` first - fresh context window</sub>

---
```

</if>

Step 2b: Primary completion path (IS_GAP_CLOSURE=0)

<if mode="yolo">

```
Phase {X} plan complete — all plans finished.

Milestone {version} is 100% complete — all {N} phases finished!

Auto-continuing: Run milestone audit before completing
```

Exit and invoke SlashCommand("/nf:audit-milestone {version} --auto")

</if>

<if mode="interactive">

```
## Phase {X}: {Phase Name} Complete

Milestone {version} is 100% complete — all {N} phases finished!

---

## Next Up

**Audit Milestone {version}** — verify requirements before completing

`/nf:audit-milestone {version}`

<sub>`/clear` first - fresh context window</sub>

---
```

</if>

All routes: `/clear` first for fresh context.
</step>

</process>

<success_criteria>

- All tasks from PLAN.md completed
- All verifications pass
- USER-SETUP.md generated if user_setup in frontmatter
- SUMMARY.md created with substantive content
- STATE.md updated (position, decisions, issues, session)
- ROADMAP.md updated
- If codebase map exists: map updated with execution changes (or skipped if no significant changes)
- If USER-SETUP.md created: prominently surfaced in completion output
</success_criteria>
