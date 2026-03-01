<purpose>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification. Default flow: Research (if needed) -> Plan -> Verify -> Done. Orchestrates qgsd-phase-researcher, qgsd-planner, and qgsd-plan-checker agents with a revision loop (max 3 iterations).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/qgsd/references/ui-brand.md
</required_reading>

<process>

## 1. Initialize

Load all context in one call (paths only to minimize orchestrator context):

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init plan-phase "$PHASE")
```

Parse JSON for: `researcher_model`, `planner_model`, `checker_model`, `research_enabled`, `plan_checker_enabled`, `nyquist_validation_enabled`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `plan_count`, `planning_exists`, `roadmap_exists`.

**File paths (for <files_to_read> blocks):** `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`, `verification_path`, `uat_path`. These are null if files don't exist.

**If `planning_exists` is false:** Error — run `/qgsd:new-project` first.

## 2. Parse and Normalize Arguments

Extract from $ARGUMENTS: phase number (integer or decimal like `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`).

**If no phase number:** Detect next unplanned phase from roadmap.

**If `phase_found` is false:** Validate phase exists in ROADMAP.md. If valid, create the directory using `phase_slug` and `padded_phase` from init:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**Existing artifacts from init:** `has_research`, `has_plans`, `plan_count`.

## 3. Validate Phase

```bash
PHASE_INFO=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap get-phase "${PHASE}")
```

**If `found` is false:** Error with available phases. **If `found` is true:** Extract `phase_number`, `phase_name`, `goal` from JSON.

## 4. Load CONTEXT.md

Check `context_path` from init JSON.

If `context_path` is not null, display: `Using phase context from: ${context_path}`

**If `context_path` is null (no CONTEXT.md exists):**

**If `--auto` flag is present:** Log `⚡ Auto-continuing without context (--auto mode)` and proceed to step 5 — no question asked.

**Otherwise:** Use AskUserQuestion:
- header: "No context"
- question: "No CONTEXT.md found for Phase {X}. Plans will use research and requirements only — your design preferences won't be included. Continue or capture context first?"
- options:
  - "Continue without context" — Plan using research + requirements only
  - "Run discuss-phase first" — Capture design decisions before planning

If "Continue without context": Proceed to step 5.
If "Run discuss-phase first": Display `/qgsd:discuss-phase {X}` and exit workflow.

## 5. Handle Research

**Skip if:** `--gaps` flag, `--skip-research` flag, or `research_enabled` is false (from init) without `--research` override.

**Research always runs** (overwriting any existing RESEARCH.md unless skipped via flags above). Research is not cached between plan-phase invocations.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► RESEARCHING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning researcher...
```

### Spawn qgsd-phase-researcher

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"plan_phase\",\"sub_activity\":\"researching\",\"phase\":${PHASE_NUMBER}}"
```

```bash
PHASE_DESC=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap get-phase "${PHASE}" | jq -r '.section')
PHASE_REQ_IDS=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap get-phase "${PHASE}" | jq -r '.section // empty' | grep -i "Requirements:" | head -1 | sed 's/.*Requirements:\*\*\s*//' | sed 's/[\[\]]//g' | tr ',' '\n' | sed 's/^ *//;s/ *$//' | grep -v '^$' | tr '\n' ',' | sed 's/,$//')
```

Research prompt:

```markdown
<objective>
Research how to implement Phase {phase_number}: {phase_name}
Answer: "What do I need to know to PLAN this phase well?"
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /qgsd:discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

<additional_context>
**Phase description:** {phase_description}
**Phase requirement IDs (MUST address):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .agents/skills/ directory (if exists) — read SKILL.md files, research should account for project skill patterns

**Nyquist Validation:** If `nyquist_validation_enabled` is true (from INIT JSON), your RESEARCH.md MUST include a `## Validation Architecture` section covering:
- Test framework and commands (quick run command, full suite command)
- Wave 0 test scaffolding requirements (which test files need to exist before implementation starts)
- Per-task test type (unit / integration / smoke / manual) for each planned task
</additional_context>

<output>
Write to: {phase_dir}/{phase_num}-RESEARCH.md
</output>
```

> **Note:** Use the Task tool to spawn this sub-agent. Do NOT invoke any Skill tool (e.g., `mcp__gemini-cli-1__gemini`, `mcp__codex-cli-1__review`, `mcp__opencode__opencode`, `mcp__copilot-cli__ask`) as a substitute. Skill tool calls do not spawn sub-agents — they call external models directly, bypassing the agent system.

```
Task(
  prompt="First, read ~/.claude/agents/qgsd-phase-researcher.md for your role and instructions.\n\n" + research_prompt,
  subagent_type="general-purpose",
  model="{researcher_model}",
  description="Research Phase {phase}"
)
```

### Handle Researcher Return

- **`## RESEARCH COMPLETE`:** Display confirmation, continue to step 6
- **`## RESEARCH BLOCKED`:** Display blocker, offer: 1) Provide context, 2) Skip research, 3) Abort

## 5.5. Create Validation Strategy (if Nyquist enabled)

**Skip if:** `nyquist_validation_enabled` is false from INIT JSON.

After researcher completes, check if RESEARCH.md contains a Validation Architecture section:

```bash
grep -l "## Validation Architecture" "${PHASE_DIR}"/*-RESEARCH.md 2>/dev/null
```

**If found:**
1. Read validation template from `~/.claude/qgsd/templates/VALIDATION.md`
2. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`
3. Fill frontmatter: replace `{N}` with phase number, `{phase-slug}` with phase slug, `{date}` with current date
4. If `commit_docs` is true:
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(phase-${PHASE}): add validation strategy" --files "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md"
```

**If not found (and nyquist enabled):**

HALT with error:
```
ERROR: Nyquist validation is enabled but no "## Validation Architecture" section was found in RESEARCH.md.
       VALIDATION.md cannot be generated.

To fix: Either
  1. Re-run research (the researcher must include ## Validation Architecture in its output), or
  2. Disable Nyquist: node ~/.claude/qgsd/bin/gsd-tools.cjs config-set workflow.nyquist_validation false

Do NOT proceed to plan creation without VALIDATION.md when nyquist_validation_enabled is true.
```

## 5.6. Envelope Init (ENV-01)

After researcher completes and VALIDATION.md is written:

```bash
# Initialize task envelope with research context
TASK_ENVELOPE_ENABLED=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get task_envelope_enabled 2>/dev/null || echo "true")
if [ "$TASK_ENVELOPE_ENABLED" = "true" ]; then
  PHASE_NUM="${PADDED_PHASE}"
  RISK_LEVEL=$(grep -oE '"risk_level"\s*:\s*"(low|medium|high)"' "${PHASE_DIR}/${PADDED_PHASE}-RESEARCH.md" 2>/dev/null | grep -oE '(low|medium|high)' | head -1 || echo "medium")
  OBJECTIVE=$(node -e "const fs=require('fs'); const r=fs.readFileSync('${PHASE_DIR}/${PADDED_PHASE}-RESEARCH.md','utf8'); const m=r.match(/^## Summary\n\n([^\n]+)/m); console.log(m ? m[1].substring(0,200) : 'phase objective')" 2>/dev/null || echo "phase objective")
  node bin/task-envelope.cjs init \
    --phase "${PHASE_NUM}" \
    --objective "${OBJECTIVE}" \
    --risk-level "${RISK_LEVEL:-medium}"
fi
```

## 6. Check Existing Plans

```bash
ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Add more plans, 2) View existing, 3) Replan from scratch.

## 7. Use Context Paths from INIT

Extract from INIT JSON:

```bash
STATE_PATH=$(echo "$INIT" | jq -r '.state_path // empty')
ROADMAP_PATH=$(echo "$INIT" | jq -r '.roadmap_path // empty')
REQUIREMENTS_PATH=$(echo "$INIT" | jq -r '.requirements_path // empty')
RESEARCH_PATH=$(echo "$INIT" | jq -r '.research_path // empty')
VERIFICATION_PATH=$(echo "$INIT" | jq -r '.verification_path // empty')
UAT_PATH=$(echo "$INIT" | jq -r '.uat_path // empty')
CONTEXT_PATH=$(echo "$INIT" | jq -r '.context_path // empty')
```

## 8. Spawn qgsd-planner Agent

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"plan_phase\",\"sub_activity\":\"planning\",\"phase\":${PHASE_NUMBER}}"
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► PLANNING PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning planner...
```

Planner prompt:

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

<files_to_read>
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /qgsd:discuss-phase)
- {research_path} (Technical Research)
- {verification_path} (Verification Gaps - if --gaps)
- {uat_path} (UAT Gaps - if --gaps)
</files_to_read>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — follow project-specific guidelines
**Project skills:** Check .agents/skills/ directory (if exists) — read SKILL.md files, plans should account for project skill rules
</planning_context>

<binding_rule id="R9">
PLAN must_haves truths MUST be derived from ROADMAP success_criteria for this phase.
You MUST NOT:
- Invent truths that are weaker than ROADMAP success_criteria
- Reduce the count of truths below the count of success_criteria
- Soften language ("must" -> "should", "all" -> "some")
- Narrow the scope of what a truth covers compared to its source criterion

If ROADMAP has no success_criteria for this phase, derive truths from the phase goal
using goal-backward methodology. The truths must be AT LEAST as strong as the goal implies.

Any truth that relaxes a ROADMAP success criterion is a plan defect, not an optimization.
</binding_rule>

<downstream_consumer>
Output consumed by /qgsd:execute-phase. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

> **Note:** Use the Task tool to spawn this sub-agent. Do NOT invoke any Skill tool (e.g., `mcp__gemini-cli-1__gemini`, `mcp__codex-cli-1__review`, `mcp__opencode__opencode`, `mcp__copilot-cli__ask`) as a substitute. Skill tool calls do not spawn sub-agents — they call external models directly, bypassing the agent system.

```
Task(
  prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.\n\n" + filled_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Plan Phase {phase}"
)
```

## 8.4. Envelope Update — Plan Section (ENV-02)

After planner completes and PLAN.md files are committed:

```bash
# Update envelope with plan metadata
TASK_ENVELOPE_ENABLED=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get task_envelope_enabled 2>/dev/null || echo "true")
if [ "$TASK_ENVELOPE_ENABLED" = "true" ]; then
  # Find first PLAN.md path for this phase
  PLAN_PATH=$(ls "${PHASE_DIR}/${PADDED_PHASE}-"*"-PLAN.md" 2>/dev/null | head -1 || echo "")
  if [ -n "$PLAN_PATH" ]; then
    node bin/task-envelope.cjs update \
      --section plan \
      --phase "${PADDED_PHASE}" \
      --plan-path "${PLAN_PATH}"
  fi
fi
```

## 8.5 Run QUORUM with R3.6 (per CLAUDE.md R3 + R3.6)

Before presenting planner output to the user, run QUORUM as required by R3.1.
R3.6 wraps this in an improvement-iteration loop (up to 10 iterations).

Set envelope_path for quorum context (ENV-02 context injection):

```bash
ENVELOPE_FILE="${PHASE_DIR}/task-envelope.json"
if [ -f "$ENVELOPE_FILE" ]; then
  ENVELOPE_PATH="$PWD/$ENVELOPE_FILE"
else
  ENVELOPE_PATH=""
fi
```

Initialize: `improvement_iteration = 0`

**LOOP** (while `improvement_iteration <= 10`):

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"plan_phase\",\"sub_activity\":\"quorum\",\"phase\":${PHASE_NUMBER},\"quorum_round\":${improvement_iteration + 1}}"
```

Form your own position on the current plan files first (CLAUDE.md R3.2): do they correctly address the phase goal, requirement IDs, and user decisions from CONTEXT.md? State your vote as APPROVE or BLOCK with 1-2 sentence rationale.

Run quorum inline (R3 dispatch_pattern from `commands/qgsd/quorum.md`):
- Mode A — pure question (reviewers read artifact directly)
- artifact_path: all current `${PHASE_DIR}/*-PLAN.md` files
- envelope_path: `${ENVELOPE_PATH}` (if file exists) for risk_level context
- review_context: "This is a pre-execution implementation plan. The code does not exist yet. Evaluate the plan's approach, task breakdown, and correctness — not whether the implementation already exists in the repository."
- request_improvements: true          ← R3.6 signal infrastructure
- Build `$DISPATCH_LIST` first (Adaptive Fan-Out: read risk_level → compute FAN_OUT_COUNT → take first FAN_OUT_COUNT-1 slots from active working list)
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

- **BLOCKED** → Report blocker to user. Do not proceed. **Break loop.**
- **ESCALATED** → Present escalation to user. Do not proceed until resolved. **Break loop.**

- **APPROVED AND ($QUORUM_IMPROVEMENTS is empty OR improvement_iteration >= 10)**:
    Include `<!-- GSD_DECISION -->` in your response summarizing quorum results.
    If `improvement_iteration > 0`: note "R3.6: ${improvement_iteration} iteration(s) ran."
    If `improvement_iteration >= 10` AND improvements remained: note
      "R3.6 cap reached — improvements not incorporated."
    Proceed to step 9. **Break loop.**

- **APPROVED AND $QUORUM_IMPROVEMENTS non-empty AND improvement_iteration < 10**:
    `improvement_iteration += 1`

    Display:
    ```
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     QGSD ► QUORUM APPROVED — R3.6 improvements (${improvement_iteration}/10)
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ```

    List each improvement: `• <model>: <suggestion> — <rationale>`

    Display: `Sending improvements to planner...`

    Conflict check: if two improvements are mutually incompatible (one undoes the other),
    escalate to user BEFORE spawning planner:
    > "R3.6 conflict: improvements from [model A] and [model B] are incompatible. [describe
    > conflict]. Which should take precedence?"
    Await user resolution, then filter improvements to the chosen set.

    Spawn planner in improvement-revision mode:

    ```
    Task(
      prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.\n\n
      <revision_context>
      Phase: ${PHASE_NUMBER}
      Mode: improvement-revision (R3.6 iteration ${improvement_iteration}/10)

      <files_to_read>
      - ${PHASE_DIR}/*-PLAN.md (current plans to revise)
      - ${CONTEXT_PATH} (USER DECISIONS — must not contradict)
      </files_to_read>

      <quorum_improvements>
      ${QUORUM_IMPROVEMENTS formatted as readable bullet list}
      </quorum_improvements>

      <instructions>
      Incorporate the quorum improvements above into the plans.
      Make targeted updates only. Do NOT replan from scratch.
      If an improvement conflicts with user decisions in CONTEXT.md, skip it and note why.
      Return a summary of what changed.
      </instructions>
      </revision_context>",
      subagent_type="general-purpose",
      model="{planner_model}",
      description="R3.6 improvements (iteration ${improvement_iteration})"
    )
    ```

    After planner returns:
    - **If planner returns `## PLANNING COMPLETE` or equivalent success:** re-read
      `${PHASE_DIR}/*-PLAN.md` (plan files are now updated). Continue loop.
    - **If planner returns `## PLANNING INCONCLUSIVE` or fails to update files:**
      Do NOT loop again on the same improvements. Display:
      > "R3.6: planner could not incorporate improvements in iteration ${improvement_iteration}. Proceeding with current plan."
      Include `<!-- GSD_DECISION -->` summarizing quorum results. Proceed to step 9. **Break loop.**

**END LOOP**

## 9. Handle Planner Return

- **`## PLANNING COMPLETE`:** Display plan count. If `--skip-verify` or `plan_checker_enabled` is false (from init): skip to step 13. Otherwise: step 10.
- **`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation (step 12)
- **`## PLANNING INCONCLUSIVE`:** Show attempts, offer: Add context / Retry / Manual

## 10. Spawn qgsd-plan-checker Agent

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"plan_phase\",\"sub_activity\":\"checking_plan\",\"phase\":${PHASE_NUMBER}}"
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► VERIFYING PLANS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning plan checker...
```

Checker prompt:

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Plans to verify)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
- {context_path} (USER DECISIONS from /qgsd:discuss-phase)
</files_to_read>

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists — verify plans honor project guidelines
**Project skills:** Check .agents/skills/ directory (if exists) — verify plans account for project skill rules

<binding_rule id="R9">
Verify that PLAN must_haves truths cover ALL ROADMAP success_criteria for this phase.
Flag as BLOCKER if:
- Any ROADMAP success criterion has no corresponding PLAN truth
- Any PLAN truth is weaker than its source ROADMAP criterion (relaxed threshold, narrowed scope, softened language)
- The count of PLAN truths is less than the count of ROADMAP success_criteria
- Any truth uses "should" where ROADMAP uses "must", or "some" where ROADMAP uses "all"

Objective relaxation is NEVER acceptable as a plan optimization. Missing or weakened
criteria = blocker, not warning.
</binding_rule>
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

> **Note:** Use the Task tool to spawn this sub-agent. Do NOT invoke any Skill tool (e.g., `mcp__gemini-cli-1__gemini`, `mcp__codex-cli-1__review`, `mcp__opencode__opencode`, `mcp__copilot-cli__ask`) as a substitute. Skill tool calls do not spawn sub-agents — they call external models directly, bypassing the agent system.

```
Task(
  prompt=checker_prompt,
  subagent_type="qgsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

## 11. Handle Checker Return

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 11.5.
- **`## ISSUES FOUND`:** Display issues, check iteration count, proceed to step 12.

## 11.5. Populate VALIDATION.md (if Nyquist enabled)

**Skip if:** `nyquist_validation_enabled` is false from INIT JSON, or `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md` does not exist.

After plan-checker passes, the orchestrator populates VALIDATION.md with real data extracted from the approved plans. Step 5.5 created the template with placeholder values — this step fills them in.

**Process:**

1. **Detect test framework** from project root:
   ```bash
   # Check for common test config files
   ls jest.config.* vitest.config.* pytest.ini setup.cfg pyproject.toml Cargo.toml go.mod 2>/dev/null
   ```
   Map to framework name and commands:
   | Config found | Framework | Quick run | Full suite |
   |---|---|---|---|
   | `jest.config.*` | Jest | `npx jest --bail` | `npx jest` |
   | `vitest.config.*` | Vitest | `npx vitest run --bail 1` | `npx vitest run` |
   | `pytest.ini` / `pyproject.toml [tool.pytest]` | Pytest | `pytest -x --tb=short` | `pytest --tb=short` |
   | None found | (use project's existing test pattern from RESEARCH.md or STATE.md) | | |

2. **Extract task data from all approved PLAN.md files.** For each `${PHASE_DIR}/${PADDED_PHASE}-*-PLAN.md`:
   - Parse YAML frontmatter: `wave`, `requirements` (array of IDs)
   - Parse `<task>` XML blocks: extract task number and `<verify>` content
   - Build task ID: `${PADDED_PHASE}-{plan_number}-{task_number}` (e.g., `v0.22-01-01-01`)
   - Classify test type from verify content: `unit` (single test file), `integration` (multi-file or endpoint test), `smoke` (curl/HTTP check), `manual` (no automated command)

3. **Fill VALIDATION.md sections** by editing the file in-place:

   **Test Infrastructure table:** Replace placeholder values with detected framework, config path, quick/full commands, estimated runtime.

   **Nyquist Sampling Rate:** Replace `{quick run command}` and `{full suite command}` with actual detected commands. Set feedback latency to a reasonable default (30s for unit-heavy, 120s for integration-heavy).

   **Per-Task Verification Map:** Replace the 3 placeholder rows with one row per actual task:
   ```
   | {task_id} | {plan_num} | {wave} | {requirement_id} | {test_type} | `{verify_command}` | TBD | ⬜ pending |
   ```
   If a plan covers multiple requirements, create one row per task (the requirement is from the plan's `requirements` frontmatter, distributed across tasks).

   **Wave 0 Requirements:** If any plan has `wave: 0`, list its test scaffolding files. Otherwise write: "Existing infrastructure covers all phase requirements — no Wave 0 test tasks needed."

   **Manual-Only Verifications:** If any task has no `<verify>` block or verify says "manual", list it here. Otherwise write: "All phase behaviors have automated verification coverage."

   **Validation Sign-Off:** Check each box that is satisfied by the plan data. Set `nyquist_compliant: true` in frontmatter if all boxes pass.

   **Execution Tracking:** Leave as template — this is filled during `/qgsd:execute-phase`.

4. **Update frontmatter:**
   ```yaml
   status: approved
   nyquist_compliant: true  # or false if sign-off checks failed
   ```

5. **Commit if `commit_docs` is true:**
   ```bash
   node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(phase-${PHASE}): populate validation strategy from approved plans" --files "${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md"
   ```

Proceed to step 13.

## 12. Revision Loop (Max 3 Iterations)

Track `iteration_count` (starts at 1 after initial plan + check).

**If iteration_count < 3:**

Display: `Sending back to planner for revision... (iteration {N}/3)`

Revision prompt:

```markdown
<revision_context>
**Phase:** {phase_number}
**Mode:** revision

<files_to_read>
- {PHASE_DIR}/*-PLAN.md (Existing plans)
- {context_path} (USER DECISIONS from /qgsd:discuss-phase)
</files_to_read>

**Checker issues:** {structured_issues_from_checker}
</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>
```

> **Note:** Use the Task tool to spawn this sub-agent. Do NOT invoke any Skill tool (e.g., `mcp__gemini-cli-1__gemini`, `mcp__codex-cli-1__review`, `mcp__opencode__opencode`, `mcp__copilot-cli__ask`) as a substitute. Skill tool calls do not spawn sub-agents — they call external models directly, bypassing the agent system.

```
Task(
  prompt="First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.\n\n" + revision_prompt,
  subagent_type="general-purpose",
  model="{planner_model}",
  description="Revise Phase {phase} plans"
)
```

After planner returns -> spawn checker again (step 10), increment iteration_count.

**If iteration_count >= 3:**

Display: `Max iterations reached. {N} issues remain:` + issue list

Offer: 1) Force proceed, 2) Provide guidance and retry, 3) Abandon

## 13. Present Final Status

Route to `<offer_next>` OR `auto_advance` depending on flags/config.

After presenting final status to the user (offer_next output displayed OR auto-advance complete):

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

## 14. Auto-Advance Check

Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. Read `workflow.auto_advance` from config:
   ```bash
   AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
   ```

**If `--auto` flag present OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► AUTO-ADVANCING TO EXECUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Plans ready. Spawning execute-phase...
```

Spawn execute-phase as Task:

> **Note:** Use the Task tool to spawn this sub-agent. Do NOT invoke any Skill tool (e.g., `mcp__gemini-cli-1__gemini`, `mcp__codex-cli-1__review`, `mcp__opencode__opencode`, `mcp__copilot-cli__ask`) as a substitute. Skill tool calls do not spawn sub-agents — they call external models directly, bypassing the agent system.

```
Task(
  prompt="Run /qgsd:execute-phase ${PHASE} --auto",
  subagent_type="general-purpose",
  description="Execute Phase ${PHASE}"
)
```

**Handle execute-phase return:**
- **PHASE COMPLETE** → Display final summary:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QGSD ► PHASE ${PHASE} COMPLETE ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /qgsd:discuss-phase ${NEXT_PHASE} --auto
  ```
- **GAPS FOUND / VERIFICATION FAILED** → Display result, stop chain:
  ```
  Auto-advance stopped: Execution needs review.

  Review the output above and continue manually:
  /qgsd:execute-phase ${PHASE}
  ```

**If neither `--auto` nor config enabled:**
Route to `<offer_next>` (existing behavior).

</process>

<offer_next>
Output this markdown directly (not as a code block):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► PHASE {X} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — {N} plan(s) in {M} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1    | 01, 02 | [objectives] |
| 2    | 03     | [objective]  |

Research: {Completed | Skipped}
Verification: {Passed | Passed with override | Skipped}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase {X}** — run all {N} plans

/qgsd:execute-phase {X}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/{phase-dir}/*-PLAN.md — review plans
- /qgsd:plan-phase {X} --research — re-research first

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Phase directory created if needed
- [ ] CONTEXT.md loaded early (step 4) and passed to ALL agents
- [ ] Research completed (unless --skip-research or --gaps or research_enabled=false)
- [ ] qgsd-phase-researcher spawned with CONTEXT.md
- [ ] Existing plans checked
- [ ] qgsd-planner spawned with CONTEXT.md + RESEARCH.md
- [ ] Plans created (PLANNING COMPLETE or CHECKPOINT handled)
- [ ] qgsd-plan-checker spawned with CONTEXT.md
- [ ] Verification passed OR user override OR max iterations with user decision
- [ ] Quorum ran (step 8.5) with `request_improvements: true`
- [ ] R3.6 loop ran: if improvements were proposed, planner revision was spawned; if none, loop exited cleanly; `<!-- GSD_DECISION -->` present in response
- [ ] User sees status between agent spawns
- [ ] User knows next steps
</success_criteria>

<anti_patterns>
**R3.6 — do NOT:**
- Do NOT skip the R3.6 loop because the plan "looks complete" or improvements "seem minor." The loop is MANDATORY when `request_improvements: true` returns a non-empty array.
- Do NOT pre-filter or discard improvements before passing them to the planner. Pass the full `$QUORUM_IMPROVEMENTS` array.
- Do NOT count the initial quorum run (improvement_iteration=0) as one of the 10 R3.6 iterations. Iteration counting starts at 1 when the first planner revision is spawned.
- Do NOT emit `<!-- GSD_DECISION -->` before the loop exits. Only emit it on the final break.
- Do NOT run the R3.6 improvement planner as a parallel Task alongside anything else. It must be sequential — quorum → planner → quorum → ...
</anti_patterns>
