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

**If `roadmap_exists` is false:** Error — Quick mode requires an active project with ROADMAP.md. Run `/nf:new-project` first.

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

**Step 4.5: Formal scope scan (only when `$FULL_MODE`)**

Skip this step entirely if NOT `$FULL_MODE`.

```bash
FORMAL_SPEC_CONTEXT=[]
```

List subdirectories under `.planning/formal/spec/` (if the directory exists):
```bash
ls .planning/formal/spec/ 2>/dev/null
```

For each subdirectory found, check if `.planning/formal/spec/{module}/invariants.md` exists:
```bash
ls .planning/formal/spec/{module}/invariants.md 2>/dev/null
```

If it exists, record the module name and path: `.planning/formal/spec/{module}/invariants.md`.

**Relevance heuristic:** Match `$DESCRIPTION` keywords (lowercased, split on spaces/hyphens) against module names. A module is relevant if any keyword appears as a substring of the module name, or the module name appears as a substring of any keyword.

Examples:
- Description "fix quorum deliberation bug" → modules matching: `quorum`, `deliberation`
- Description "update TUI navigation flow" → modules matching: `tui-nav`
- Description "refactor breaker circuit logic" → modules matching: `breaker`

If no modules match: `$FORMAL_SPEC_CONTEXT = []`
If modules match: `$FORMAL_SPEC_CONTEXT` = array of `{ module, path }` objects for each matching module.

Display:
```
◆ Formal scope scan: found {N} relevant module(s): {module names or "none"}
```

Store `$FORMAL_SPEC_CONTEXT` for use in steps 5, 5.5, 6.5.

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
${FORMAL_SPEC_CONTEXT.length > 0 ? FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n') : ''}
</files_to_read>

**Project skills:** Check .agents/skills/ directory (if exists) — read SKILL.md files, plans should account for project skill rules

<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ?
`Relevant formal modules identified: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}

Constraints:
- Read the injected invariants.md files and identify which invariants apply to this task
- Declare \`formal_artifacts:\` in plan frontmatter (required field when FORMAL_SPEC_CONTEXT is non-empty):
  - \`none\` — task does not create or modify .planning/formal/ files
  - \`update: [list of .planning/formal/ file paths]\` — task modifies existing .planning/formal/ files
  - \`create: [list of {path, type (tla|alloy|prism), description}]\` — task creates new .planning/formal/ files
- Plan tasks MUST NOT violate the identified invariants` :
`No formal modules matched this task. Declare \`formal_artifacts: none\` in plan frontmatter.`}
</formal_context>

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
${FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n')}
</files_to_read>

**Scope:** This is a quick task, not a full phase. Skip checks that require a ROADMAP phase goal.
</verification_context>

<check_dimensions>
- Requirement coverage: Does the plan address the task description?
- Task completeness: Do tasks have files, action, verify, done fields?
- Key links: Are referenced files real?
- Scope sanity: Is this appropriately sized for a quick task (1-3 tasks)?
- must_haves derivation: Are must_haves traceable to the task description?
- Formal artifacts (--full only): If `formal_artifacts` is `update` or `create`, are the target file paths well-specified (not vague)?
- Invariant compliance (--full only): Do plan tasks avoid operations that would violate the invariants identified in the formal context? (If `$FORMAL_SPEC_CONTEXT` is empty, skip this check.)

Skip: context compliance (no CONTEXT.md), cross-plan deps (single plan), ROADMAP alignment
</check_dimensions>

<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ? `Relevant formal modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}. Check plan formal_artifacts declaration and invariant compliance.` : 'No formal modules matched. Verify plan declares formal_artifacts: none.'}
</formal_context>

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

**Step 5.7: Quorum review of plan with R3.6 (required by R3.1 + R3.6)**

This step is MANDATORY regardless of `--full` mode. R3.1 requires quorum for any planning output from `/nf:quick`. R3.6 wraps this in an improvement-iteration loop (up to 10 iterations).

Initialize: `improvement_iteration = 0`

**LOOP** (while `improvement_iteration <= 10`):

Form your own position on the current plan: does it correctly address the task description? Are tasks atomic and safe? State your vote as 1-2 sentences (APPROVE or BLOCK with rationale).

Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
- Mode A — artifact review (plan is pre-execution; no traces to pass)
- artifact_path: `${QUICK_DIR}/${next_num}-PLAN.md`
- review_context: "This is a pre-execution task plan. The code does not exist yet. Evaluate whether the task breakdown is atomic, safe to execute, and correctly addresses the objective — not whether the implementation already exists."
- request_improvements: true          ← R3.6 signal infrastructure
- Build `$DISPATCH_LIST` first (quorum.md Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list)
- Dispatch `$DISPATCH_LIST` as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100`
- Deliberate up to 10 rounds per R3.3

Fail-open: if a slot errors (UNAVAIL), note it and proceed — same as R6 policy.

After quorum returns, extract the improvements signal from your own output:

Scan for the HTML comment block in the quorum response:
```
<!-- QUORUM_IMPROVEMENTS_START
[...]
QUORUM_IMPROVEMENTS_END -->
```
Extract the text between `QUORUM_IMPROVEMENTS_START` and `QUORUM_IMPROVEMENTS_END`, trim whitespace, and parse as a JSON array. Store as `$QUORUM_IMPROVEMENTS`.

**Do NOT summarize or paraphrase the JSON — extract the exact text between the delimiters.**

If the signal is absent, the delimiters don't match, or JSON.parse would fail: set `$QUORUM_IMPROVEMENTS = []` (fail-open — R3.6 does not fire).

**Route:**

- **BLOCKED** → Report the blocker to the user. Do not execute. **Break loop.**
- **ESCALATED** → Present the escalation to the user. Do not execute until resolved. **Break loop.**

- **APPROVED AND ($QUORUM_IMPROVEMENTS is empty OR improvement_iteration >= 10)**:
    Include `<!-- GSD_DECISION -->` in your response summarizing quorum results.
    If `improvement_iteration > 0`: note "R3.6: ${improvement_iteration} iteration(s) ran."
    If `improvement_iteration >= 10` AND improvements remained: note
      "R3.6 cap reached — improvements not incorporated."
    Proceed to Step 6. **Break loop.**

- **APPROVED AND $QUORUM_IMPROVEMENTS non-empty AND improvement_iteration < 10**:
    `improvement_iteration += 1`

    Display:
    ```
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     QGSD ► QUICK TASK — R3.6 improvements (${improvement_iteration}/10)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ```

    List each improvement: `• <model>: <suggestion> — <rationale>`

    Display: `Sending improvements to planner...`

    Conflict check: if two improvements are mutually incompatible, escalate to user before
    spawning planner. Await user resolution, then filter improvements to the chosen set.

    Spawn planner in improvement-revision mode:

    ```
    Task(
      prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.\n\n
      <revision_context>
      Mode: improvement-revision (R3.6 iteration ${improvement_iteration}/10)

      <files_to_read>
      - ${QUICK_DIR}/${next_num}-PLAN.md (current plan to revise)
      </files_to_read>

      <quorum_improvements>
      ${QUORUM_IMPROVEMENTS formatted as readable bullet list}
      </quorum_improvements>

      <instructions>
      Incorporate the quorum improvements above into the plan.
      Make targeted updates only. Do NOT replan from scratch.
      Return a summary of what changed.
      </instructions>
      </revision_context>",
      subagent_type="general-purpose",
      model="{planner_model}",
      description="R3.6 improvements (iteration ${improvement_iteration})"
    )
    ```

    After planner returns:
    - **If planner returns `## PLANNING COMPLETE` or equivalent success:** plan at
      `${QUICK_DIR}/${next_num}-PLAN.md` is updated. Continue loop.
    - **If planner returns `## PLANNING INCONCLUSIVE` or fails to update the file:**
      Do NOT loop again on the same improvements. Display:
      > "R3.6: planner could not incorporate improvements in iteration ${improvement_iteration}. Proceeding with current plan."
      Include `<!-- GSD_DECISION -->` summarizing quorum results. Proceed to Step 6. **Break loop.**

**END LOOP**

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
- If the plan declares `formal_artifacts: update` or `formal_artifacts: create`, execute those formal file changes and include the .planning/formal/ files in the atomic commit for that task (alongside the implementation files)
- Formal/ files must never be committed separately — always include in the task's atomic commit
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

Ready for next task: /nf:quick
```

---

**Step 6.3: Post-execution formal check (only when `$FULL_MODE` AND `$FORMAL_SPEC_CONTEXT` non-empty)**

Skip this step entirely if NOT `$FULL_MODE` or `$FORMAL_SPEC_CONTEXT` is empty.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FORMAL CHECK (post-execution)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Running TLC/Alloy/PRISM for modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}
```

Build the module list:
```bash
MODULES=$(FORMAL_SPEC_CONTEXT.map(f => f.module).join(','))
```

Run the formal check script:
```bash
FORMAL_CHECK_OUTPUT=$(node bin/run-formal-check.cjs --modules=${MODULES} 2>&1)
FORMAL_CHECK_EXIT=$?
```

Parse the result line from output:
```bash
FORMAL_CHECK_RESULT=$(echo "$FORMAL_CHECK_OUTPUT" | grep '^FORMAL_CHECK_RESULT=' | cut -d= -f2-)
```

Display the output to the user (stream FORMAL_CHECK_OUTPUT to console).

Store `$FORMAL_CHECK_RESULT` and `$FORMAL_CHECK_EXIT` for use in Step 6.5.

**Route on exit code:**

| Exit code | Meaning | Action |
|-----------|---------|--------|
| 0 | All checks passed or skipped (no counterexample) | Display: `◆ Formal check: PASSED`. Continue to Step 6.5. |
| 1 | Counterexample found | Display: `◆ Formal check: COUNTEREXAMPLE FOUND — see output above`. Store result. Continue to Step 6.5 (do NOT abort — verifier receives this as hard failure signal). |

**Fail-open clause:** If `node bin/run-formal-check.cjs` itself fails to launch (e.g., Node.js error, script not found), log:
```
◆ Formal check: WARNING — run-formal-check.cjs not found or errored. Skipping.
```
Set `$FORMAL_CHECK_RESULT = null`. Continue to Step 6.5 without blocking.

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
${FORMAL_SPEC_CONTEXT.map(f => `- ${f.path} (Formal invariants for module: ${f.module})`).join('\n')}
</files_to_read>

<formal_context>
${FORMAL_SPEC_CONTEXT.length > 0 ?
`Relevant formal modules: ${FORMAL_SPEC_CONTEXT.map(f => f.module).join(', ')}

Additional verification checks:
- Did executor respect the identified invariants? Check implementation files against invariant conditions.
- If plan declared formal_artifacts update or create: are the modified/created .planning/formal/ files syntactically reasonable for their type (TLA+/Alloy/PRISM)? (Basic structure check, not model checking.)

Formal check result from Step 6.3: ${FORMAL_CHECK_RESULT !== null ? JSON.stringify(FORMAL_CHECK_RESULT) : 'skipped (tool unavailable)'}
If failed > 0 in formal check result: treat as a HARD FAILURE in your verification — must_haves cannot pass if a counterexample was found.` :
'No formal modules matched. Skip formal invariant checks.'}
</formal_context>

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

**Step 6.5.1: Quorum review of VERIFICATION.md (only when `$FULL_MODE` and `$VERIFICATION_STATUS = "Verified"`)**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM REVIEW OF VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Running quorum review of VERIFICATION.md...
```

Form your own position: does VERIFICATION.md confirm all must_haves are met and no invariants violated? State your vote as APPROVE or BLOCK with 1-2 sentences.

Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
- Mode A — artifact review
- artifact_path: `${QUICK_DIR}/${next_num}-VERIFICATION.md`
- review_context: "Review this VERIFICATION.md and answer: (1) Are all must_haves confirmed met? (2) Are any invariants from the formal context violated? Vote APPROVE if verification is sound and complete. Vote BLOCK if must_haves are not confirmed or invariants are violated."
- request_improvements: false
- Build `$DISPATCH_LIST` (quorum.md Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list)
- Dispatch `$DISPATCH_LIST` as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100`

Fail-open: if all slots are UNAVAIL, keep `$VERIFICATION_STATUS = "Verified"` and note: "Quorum unavailable — verification result uncontested."

Route on quorum result:
| Verdict | Action |
|---------|--------|
| **APPROVED** | Keep `$VERIFICATION_STATUS = "Verified"`. Proceed to status update. |
| **BLOCKED** | Set `$VERIFICATION_STATUS = "Needs Review"`. Display block reason. Proceed to status update. |
| **ESCALATED** | Present escalation to user. Set `$VERIFICATION_STATUS = "Needs Review"`. Proceed to status update. |

---

**Quorum resolution loop for human_needed:**

1. Read the full `human_verification` section from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely requires human eyes) with 1-2 sentence rationale per item.

3. Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
   - Mode A — pure question
   - Question: "Can each human_needed item from quick task ${next_num} be resolved using available tools (grep, file inspection, quorum-test)? Vote APPROVE (can resolve programmatically) or BLOCK (genuinely needs human eyes)."
   - Include the full `human_verification` section as context
   - Build `$DISPATCH_LIST` first (quorum.md Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list). Then dispatch `$DISPATCH_LIST` as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku", max_turns=100` — do NOT dispatch slots outside `$DISPATCH_LIST`
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

---

**Step 6.7: Requirement elevation (only when `$FULL_MODE` AND `$VERIFICATION_STATUS = "Verified"`)**

Skip this step if NOT `$FULL_MODE` or `$VERIFICATION_STATUS` is not `"Verified"`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► REQUIREMENT ELEVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Drafting requirement from verified quick task...
```

**6.7.1: Draft requirement via Haiku**

Spawn a Haiku subagent to draft a formal requirement from the completed task:

```
Task(
  subagent_type="general-purpose",
  model="haiku",
  description="Draft requirement from quick task",
  prompt="
You are drafting a formal requirement from a completed quick task.

## Task context
- Description: ${DESCRIPTION}
- Plan: Read ${QUICK_DIR}/${next_num}-PLAN.md
- Summary: Read ${QUICK_DIR}/${next_num}-SUMMARY.md

## Existing requirements
Read .planning/formal/requirements.json. Note all existing ID prefixes and their counts.

## Your task

Draft a single requirement that captures what this quick task delivered. Follow these rules:

1. **ID**: Pick the most semantically appropriate existing prefix. If no prefix fits, propose a new one (2-6 uppercase letters). Append the next available number for that prefix (e.g., if STOP-09 exists, use STOP-10).

2. **Text**: One sentence describing the deliverable — what the system now does, not what the task was. Use present tense, imperative style matching existing requirements.

3. **Category**: Match an existing category from the same prefix group, or propose a new one.

4. **Phase**: Use 'unknown' (quick tasks are not phase-tracked).

5. **Background**: 1-2 sentences explaining why this requirement exists and what problem it solves.

## Response format

Respond with EXACTLY this JSON (no markdown fencing, no extra text):
{
  \"id\": \"PREFIX-NN\",
  \"text\": \"...\",
  \"category\": \"...\",
  \"phase\": \"unknown\",
  \"status\": \"Complete\",
  \"background\": \"...\"
}
"
)
```

Parse the Haiku response as JSON. Store as `$DRAFT_REQ`.

**6.7.2: Present to user for approval**

Display the drafted requirement:

```
◆ Proposed requirement from quick task ${next_num}:

  ID:         ${DRAFT_REQ.id}
  Text:       ${DRAFT_REQ.text}
  Category:   ${DRAFT_REQ.category}
  Background: ${DRAFT_REQ.background}
```

Ask the user:

```
AskUserQuestion(
  header: "Elevate?",
  question: "Add this requirement to .planning/formal/requirements.json?",
  options: [
    { label: "Yes, add it", description: "Add the requirement as drafted" },
    { label: "Edit first", description: "I'll modify the ID, text, or category before adding" },
    { label: "Skip", description: "Don't add a requirement for this task" }
  ],
  multiSelect: false
)
```

**Route on user response:**

- **"Yes, add it"** → Proceed to 6.7.3.
- **"Edit first"** → Ask follow-up questions for each field the user wants to change (id, text, category, background). Update `$DRAFT_REQ` with user edits. Then proceed to 6.7.3.
- **"Skip"** → Display: `◆ Requirement elevation skipped.` Proceed to completion banner.

**6.7.3: Write requirement with conflict checks**

Execute the add-requirement workflow inline (same checks as `/nf:add-requirement`):

1. **Duplicate ID check**: Search existing requirements for exact ID match on `$DRAFT_REQ.id`. If found, show conflict and ask user for a different ID.

2. **Semantic conflict check** (MANDATORY — always runs): Spawn Haiku with the conflict-detection prompt from `add-requirement.md` workflow (step `check_semantic_conflicts`) against the ENTIRE envelope, not just same-prefix. If `CONFLICT` returned, show it to user and ask how to proceed.

3. **Unfreeze** `.planning/formal/requirements.json` if `frozen_at` is not null.

4. **Append** `$DRAFT_REQ` to the requirements array with provenance:
   ```json
   {
     "source_file": "${QUICK_DIR}/${next_num}-PLAN.md",
     "milestone": "quick-${next_num}"
   }
   ```

5. **Sort** array by ID, **recompute** `content_hash`, update `aggregated_at`.

6. **Write** atomically (temp + rename).

7. **Re-freeze** the envelope.

8. **Commit**:
   ```bash
   node ~/.claude/qgsd/bin/gsd-tools.cjs commit "req(quick-${next_num}): add ${DRAFT_REQ.id}" \
     --files .planning/formal/requirements.json
   ```

9. Display:
   ```
   ◆ Requirement ${DRAFT_REQ.id} added to .planning/formal/requirements.json
     Total requirements: ${new_count}
   ```

---

Display final completion banner:

```
---

QGSD > QUICK TASK COMPLETE (FULL MODE)

Quick Task ${next_num}: ${DESCRIPTION}

Summary: ${QUICK_DIR}/${next_num}-SUMMARY.md
Verification: ${QUICK_DIR}/${next_num}-VERIFICATION.md (${VERIFICATION_STATUS})
${DRAFT_REQ ? 'Requirement: ' + DRAFT_REQ.id + ' (elevated to .planning/formal/requirements.json)' : ''}
Commit: ${commit_hash}

---

Ready for next task: /nf:quick
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
- [ ] (--full) Formal scope scan runs before planner (step 4.5), $FORMAL_SPEC_CONTEXT populated
- [ ] (--full) Planner receives relevant invariants.md in files_to_read
- [ ] (--full) Plan declares formal_artifacts field in frontmatter
- [ ] (--full) Plan checker validates plan, revision loop capped at 2
- [ ] Quorum ran (step 5.7) with `request_improvements: true`
- [ ] R3.6 loop ran: if improvements proposed, planner revision spawned; if none or planner failed, loop exited; `<!-- GSD_DECISION -->` present in response
- [ ] `${next_num}-SUMMARY.md` created by executor
- [ ] (--full) Executor includes .planning/formal/ files in atomic commits when formal_artifacts non-empty
- [ ] (--full) `${next_num}-VERIFICATION.md` created by verifier
- [ ] (--full) Verifier checks invariant compliance and formal artifact syntax
- [ ] (--full) Step 6.3 formal check ran when FORMAL_SPEC_CONTEXT non-empty; FORMAL_CHECK_RESULT passed to verifier
- [ ] (--full) Quorum reviews VERIFICATION.md after passed status (step 6.5.1)
- [ ] Executor commits PLAN.md + SUMMARY.md + STATE.md atomically
- [ ] (--full) Orchestrator updates STATE.md Status cell after verification
- [ ] (--full) Requirement elevation runs when VERIFICATION_STATUS is "Verified" (step 6.7)
- [ ] (--full) Haiku drafts requirement from task context (description + plan + summary)
- [ ] (--full) User is asked to approve, edit, or skip the drafted requirement
- [ ] (--full) If approved: duplicate ID check, semantic conflict check (Haiku), then write to .planning/formal/requirements.json with unfreeze/re-freeze lifecycle
- [ ] (--full) Elevated requirement uses provenance { source_file: quick plan path, milestone: "quick-NNN" }
</success_criteria>

<anti_patterns>
**R3.6 — do NOT:**
- Do NOT skip the R3.6 loop because the plan "looks good enough" or improvements "seem trivial." The loop is MANDATORY when `$QUORUM_IMPROVEMENTS` is non-empty.
- Do NOT pre-filter or discard improvements before passing them to the planner. Pass the full array.
- Do NOT emit `<!-- GSD_DECISION -->` before the loop exits. Only emit it on the final break.
- Do NOT run the R3.6 improvement planner as a parallel Task. It is always sequential: quorum → planner → quorum → ...
- Do NOT loop again after a planner failure (`## PLANNING INCONCLUSIVE`). Break immediately with the failure note.
</anti_patterns>
