<purpose>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking). Quick mode spawns qgsd-planner (quick mode) + qgsd-executor(s), tracks tasks in `.planning/quick/`, and updates STATE.md's "Quick Tasks Completed" table.

With `--full` flag: enables plan-checking (max 2 iterations) and post-execution verification for quality guarantees without full milestone ceremony.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>
**Step 1: Parse arguments and get task description**

Parse `$ARGUMENTS` for:
- `--full` flag → store as `$FULL_MODE` (true/false)
- Remaining text → use as `$DESCRIPTION` if non-empty

If `$DESCRIPTION` is empty after parsing, prompt user interactively:

```
AskUserQuestion(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```

Store response as `$DESCRIPTION`.

If still empty, re-prompt: "Please provide a task description."

If `$FULL_MODE`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUICK TASK (FULL MODE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Plan checking + verification enabled
```

---

**Step 2: Initialize**

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init quick "$DESCRIPTION")
```

Parse JSON for: `planner_model`, `executor_model`, `checker_model`, `verifier_model`, `commit_docs`, `next_num`, `slug`, `date`, `timestamp`, `quick_dir`, `task_dir`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` is false:** Error — Quick mode requires an active project with ROADMAP.md. Run `/qgsd:new-project` first.

Quick tasks can run mid-phase - validation only checks ROADMAP.md exists, not phase status.

---

**Step 3: Create task directory**

```bash
mkdir -p "${task_dir}"
```

---

**Step 4: Create quick task directory**

Create the directory for this quick task:

```bash
QUICK_DIR=".planning/quick/${next_num}-${slug}"
mkdir -p "$QUICK_DIR"
```

Report to user:
```
Creating quick task ${next_num}: ${DESCRIPTION}
Directory: ${QUICK_DIR}
```

Store `$QUICK_DIR` for use in orchestration.

---

**Step 5: Spawn planner (quick mode)**

**If `$FULL_MODE`:** Use `quick-full` mode with stricter constraints.

**If NOT `$FULL_MODE`:** Use standard `quick` mode.

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"quick\",\"sub_activity\":\"planning\"}"
```

```
Task(
  prompt="
<planning_context>

**Mode:** ${FULL_MODE ? 'quick-full' : 'quick'}
**Directory:** ${QUICK_DIR}
**Description:** ${DESCRIPTION}

<files_to_read>
- .planning/STATE.md (Project State)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
</files_to_read>

**Project skills:** Check .agents/skills/ directory (if exists) — read SKILL.md files, plans should account for project skill rules

</planning_context>

<constraints>
- Create a SINGLE plan with 1-3 focused tasks
- Quick tasks should be atomic and self-contained
- No research phase
${FULL_MODE ? '- Target ~40% context usage (structured for verification)' : '- Target ~30% context usage (simple, focused)'}
${FULL_MODE ? '- MUST generate `must_haves` in plan frontmatter (truths, artifacts, key_links)' : ''}
${FULL_MODE ? '- Each task MUST have `files`, `action`, `verify`, `done` fields' : ''}
</constraints>

<output>
Write plan to: ${QUICK_DIR}/${next_num}-PLAN.md
Return: ## PLANNING COMPLETE with plan path
</output>
",
  subagent_type="qgsd-planner",
  model="{planner_model}",
  description="Quick plan: ${DESCRIPTION}"
)
```

After planner returns:
1. Verify plan exists at `${QUICK_DIR}/${next_num}-PLAN.md`
2. Extract plan count (typically 1 for quick tasks)
3. Report: "Plan created: ${QUICK_DIR}/${next_num}-PLAN.md"

If plan not found, error: "Planner failed to create ${next_num}-PLAN.md"

---

**Step 5.5: Plan-checker loop (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► CHECKING PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Checker prompt:

```markdown
<verification_context>
**Mode:** quick-full
**Task Description:** ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan to verify)
</files_to_read>

**Scope:** This is a quick task, not a full phase. Skip checks that require a ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: Does the plan address the task description?
- Task completeness: Do tasks have files, action, verify, done fields?
- Key links: Are referenced files real?
- Scope sanity: Is this appropriately sized for a quick task (1-3 tasks)?
- must_haves derivation: Are must_haves traceable to the task description?

Skip: context compliance (no CONTEXT.md), cross-plan deps (single plan), ROADMAP alignment
</check_dimensions>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

```
Task(
  prompt=checker_prompt,
  subagent_type="qgsd-plan-checker",
  model="{checker_model}",
  description="Check quick plan: ${DESCRIPTION}"
)
```

**Handle checker return:**

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 6.
- **`## ISSUES FOUND`:** Display issues, check iteration count, enter revision loop.

**Revision loop (max 2 iterations):**

Track `iteration_count` (starts at 1 after initial plan + check).

**If iteration_count < 2:**

Display: `Sending back to planner for revision... (iteration ${N}/2)`

Revision prompt:

```markdown
<revision_context>
**Mode:** quick-full (revision)

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Existing plan)
</files_to_read>

**Checker issues:** ${structured_issues_from_checker}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

```
Task(
  prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.\n\n" + revision_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Revise quick plan: ${DESCRIPTION}"
)
```

After planner returns → spawn checker again, increment iteration_count.

**If iteration_count >= 2:**

Display: `Max iterations reached. ${N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Abort

---

**Step 5.7: Quorum review of plan (required by R3.1)**

This step is MANDATORY regardless of `--full` mode. R3.1 requires quorum for any planning output from `/qgsd:quick`.

Form your own position on the plan first: does it correctly address the task description? Are tasks atomic and safe? State your vote as 1-2 sentences (APPROVE or BLOCK with rationale).

Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
- Mode A — artifact review (plan is pre-execution; no traces to pass)
- artifact_path: `${QUICK_DIR}/${next_num}-PLAN.md`
- review_context: "This is a pre-execution task plan. The code does not exist yet. Evaluate whether the task breakdown is atomic, safe to execute, and correctly addresses the objective — not whether the implementation already exists."
- Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100` (one per slot)
- Synthesize results inline, deliberate up to 10 rounds per R3.3

Fail-open: if a slot errors (UNAVAIL), note it and proceed — same as R6 policy.

**Route on quorum_result:**
- **APPROVED:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results, then proceed to Step 6.
- **BLOCKED:** Report the blocker to the user. Do not execute.
- **ESCALATED:** Present the escalation to the user. Do not execute until resolved.

---

**Step 6: Spawn executor**

Spawn qgsd-executor with plan reference:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"quick\",\"sub_activity\":\"executing\"}"
```

```
Task(
  prompt="
Execute quick task ${next_num}.

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan)
- .planning/STATE.md (Project state)
- ./CLAUDE.md (Project instructions, if exists)
- .agents/skills/ (Project skills, if exists — list skills, read SKILL.md for each, follow relevant rules during implementation)
</files_to_read>

<constraints>
- Execute all tasks in the plan
- Commit each task atomically (use the gsd-tools.cjs commit command per the execute-plan workflow)
- Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
- Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
- After creating the SUMMARY.md, update STATE.md "Quick Tasks Completed" table:
  - If the table doesn't exist, create it after "### Blockers/Concerns" with columns:
    | # | Description | Date | Commit | Status | Directory |
  - Append a new row: | ${next_num} | ${DESCRIPTION} | ${date} | {commit_hash} | Pending | [${next_num}-${slug}](./quick/${next_num}-${slug}/) |
    Use "Pending" as the Status placeholder (orchestrator will update when verifier runs, if --full)
  - Update "Last activity" line: "${date} - Completed quick task ${next_num}: ${DESCRIPTION}"
- Commit STATE.md alongside PLAN.md and SUMMARY.md in a single final commit:
  node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(quick-${next_num}): ${DESCRIPTION}" \
    --files ${QUICK_DIR}/${next_num}-PLAN.md ${QUICK_DIR}/${next_num}-SUMMARY.md .planning/STATE.md
- After committing, run: node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
- Return the final commit hash in your completion response (format: "Commit: {hash}")
</constraints>
",
  subagent_type="qgsd-executor",
  model="{executor_model}",
  description="Execute: ${DESCRIPTION}"
)
```

After executor returns:
1. Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
2. Extract commit hash from executor output ("Commit: {hash}" pattern)
3. Display the completion banner (see below)

**Known Claude Code bug (classifyHandoffIfNeeded):** If executor reports "failed" with error `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Check if summary file exists and git log shows commits. If so, treat as successful.

If summary not found, error: "Executor failed to create ${next_num}-SUMMARY.md"

Note: For quick tasks producing multiple plans (rare), spawn executors in parallel waves per execute-phase patterns.

**Completion banner (NOT --full, or --full before verification):**

```
---

QGSD > QUICK TASK COMPLETE

Quick Task ${next_num}: ${DESCRIPTION}

Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Commit: ${commit_hash}

---

Ready for next task: /qgsd:quick
```

---

**Step 6.5: Verification (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► VERIFYING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning verifier...
```

```
Task(
  prompt="Verify quick task goal achievement.
Task directory: ${QUICK_DIR}
Task goal: ${DESCRIPTION}

<files_to_read>
- ${QUICK_DIR}/${next_num}-PLAN.md (Plan)
</files_to_read>

Check must_haves against actual codebase. Create VERIFICATION.md at ${QUICK_DIR}/${next_num}-VERIFICATION.md.",
  subagent_type="qgsd-verifier",
  model="{verifier_model}",
  description="Verify: ${DESCRIPTION}"
)
```

Read verification status:
```bash
grep "^status:" "${QUICK_DIR}/${next_num}-VERIFICATION.md" | cut -d: -f2 | tr -d ' '
```

Store as `$VERIFICATION_STATUS`.

| Status | Action |
|--------|--------|
| `passed` | Store `$VERIFICATION_STATUS = "Verified"`, continue to status update |
| `human_needed` | Run quorum resolution loop (see below). If quorum resolves → store `$VERIFICATION_STATUS = "Verified"`, continue. If quorum cannot resolve → display items, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
| `gaps_found` | Display gap summary, offer: 1) Re-run executor to fix gaps, 2) Accept as-is. Store `$VERIFICATION_STATUS = "Gaps"` |

**Quorum resolution loop for human_needed:**

1. Read the full `human_verification` section from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely requires human eyes) with 1-2 sentence rationale per item.

3. Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
   - Mode A — pure question
   - Question: "Can each human_needed item from quick task ${next_num} be resolved using available tools (grep, file inspection, quorum-test)? Vote APPROVE (can resolve programmatically) or BLOCK (genuinely needs human eyes)."
   - Include the full `human_verification` section as context
   - Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100` (one per slot)
   - Synthesize results inline, deliberate up to 10 rounds per R3.3

   Fail-open: if all slots error, treat as BLOCK (escalate to user).

4. Route on quorum_result:
   - **APPROVED** → Consensus reached. Store `$VERIFICATION_STATUS = "Verified"`. Proceed to status update.
   - **BLOCKED** → Cannot auto-resolve. Display items needing manual check to user. Store `$VERIFICATION_STATUS = "Needs Review"`. Continue to status update.
   - **ESCALATED** → Present escalation to user as "Needs Review". Continue to status update.

**Update STATE.md Status cell after verification:**

Read STATE.md, find the row for `${next_num}`, replace "Pending" with the actual `$VERIFICATION_STATUS`. Then commit:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(quick-${next_num}): update verification status" \
  --files .planning/STATE.md ${QUICK_DIR}/${next_num}-VERIFICATION.md
```

Display final completion banner:

```
---

QGSD > QUICK TASK COMPLETE (FULL MODE)

Quick Task ${next_num}: ${DESCRIPTION}

Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Verification: ${QUICK_DIR}/${next_num}-VERIFICATION.md (${VERIFICATION_STATUS})
Commit: ${commit_hash}

---

Ready for next task: /qgsd:quick
```

</process>

<success_criteria>
- [ ] ROADMAP.md validation passes
- [ ] User provides task description
- [ ] `--full` flag parsed from arguments when present
- [ ] Slug generated (lowercase, hyphens, max 40 chars)
- [ ] Next number calculated (001, 002, 003...)
- [ ] Directory created at `.planning/quick/NNN-slug/`
- [ ] `${next_num}-PLAN.md` created by planner
- [ ] (--full) Plan checker validates plan, revision loop capped at 2
- [ ] `${next_num}-SUMMARY.md` created by executor
- [ ] (--full) `${next_num}-VERIFICATION.md` created by verifier
- [ ] Executor commits PLAN.md + SUMMARY.md + STATE.md atomically
- [ ] (--full) Orchestrator updates STATE.md Status cell after verification
</success_criteria>
