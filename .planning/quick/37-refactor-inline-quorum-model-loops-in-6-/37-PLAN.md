---
phase: quick-37
plan: 37
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.claude/qgsd/workflows/quick.md
  - ~/.claude/qgsd/workflows/execute-phase.md
  - ~/.claude/qgsd/workflows/plan-phase.md
  - ~/.claude/qgsd/workflows/discuss-phase.md
  - ~/.claude/qgsd/workflows/map-codebase.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "quick.md Step 5.7 delegates to Task(qgsd-quorum-orchestrator) instead of looping over models inline"
    - "quick.md Step 6.5 human_needed loop delegates to Task(qgsd-quorum-orchestrator) with APPROVE/BLOCK framing"
    - "execute-phase.md verify_phase_goal human_needed loop delegates to Task(qgsd-quorum-orchestrator)"
    - "plan-phase.md Step 8.5 delegates to Task(qgsd-quorum-orchestrator) instead of looping over models inline"
    - "discuss-phase.md r4_pre_filter delegates to Task(qgsd-quorum-orchestrator) for each gray area"
    - "map-codebase.md quorum_validate delegates to Task(qgsd-quorum-orchestrator) instead of looping over models inline"
    - "Every replacement site: orchestrator forms claude_vote first, spawns sub-agent, reads quorum_result, emits <!-- GSD_DECISION --> itself on APPROVED"
    - "Fail-open preserved: if qgsd-quorum-orchestrator itself errors, note and proceed"
  artifacts:
    - path: "~/.claude/qgsd/workflows/quick.md"
      provides: "Step 5.7 and Step 6.5 using Task(qgsd-quorum-orchestrator)"
    - path: "~/.claude/qgsd/workflows/execute-phase.md"
      provides: "verify_phase_goal human_needed using Task(qgsd-quorum-orchestrator)"
    - path: "~/.claude/qgsd/workflows/plan-phase.md"
      provides: "Step 8.5 using Task(qgsd-quorum-orchestrator)"
    - path: "~/.claude/qgsd/workflows/discuss-phase.md"
      provides: "r4_pre_filter using Task(qgsd-quorum-orchestrator)"
    - path: "~/.claude/qgsd/workflows/map-codebase.md"
      provides: "quorum_validate using Task(qgsd-quorum-orchestrator)"
  key_links:
    - from: "orchestrator (any of 6 workflows)"
      to: "qgsd-quorum-orchestrator sub-agent"
      via: "Task(subagent_type=qgsd-quorum-orchestrator, prompt='claude_vote: ...\\nartifact: ...')"
      pattern: "subagent_type=\"qgsd-quorum-orchestrator\""
    - from: "qgsd-quorum-orchestrator return"
      to: "orchestrator routing"
      via: "quorum_result: APPROVED | BLOCKED | ESCALATED"
      pattern: "quorum_result"
    - from: "APPROVED result"
      to: "<!-- GSD_DECISION --> comment"
      via: "orchestrator writes it itself after reading verdict"
      pattern: "GSD_DECISION"
---

<objective>
Replace all 6 inline quorum model loops in workflow files with Task(qgsd-quorum-orchestrator) sub-agent spawns. The orchestrators currently bloat their context window by running Codex/Gemini/OpenCode/Copilot calls inline. After this refactor, each site: (1) forms Claude's vote, (2) spawns the sub-agent, (3) reads quorum_result, (4) routes on APPROVED/BLOCKED.

Purpose: Keep orchestrators thin (GSD's core design principle). Quorum mechanics — sequential model calls, deliberation rounds, R3.6 improvement iterations, scoreboard updates — belong in the sub-agent's isolated context, not the orchestrator's.

Output: 5 modified workflow files at ~/.claude/qgsd/workflows/ (quick.md has 2 sites).
</objective>

<execution_context>
@~/.claude/qgsd/workflows/execute-plan.md
@~/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace inline quorum loops in quick.md (Step 5.7 and Step 6.5)</name>
  <files>~/.claude/qgsd/workflows/quick.md</files>
  <action>
Read ~/.claude/qgsd/workflows/quick.md.

**Replace Step 5.7** (plan approval quorum):

Current pattern: Claude forms position, then queries Codex/Gemini/OpenCode/Copilot sequentially with a model-specific prompt, evaluates consensus inline, writes <!-- GSD_DECISION --> on APPROVE.

Replace with:

```
**Step 5.7: Quorum review of plan (required by R3.1)**

This step is MANDATORY regardless of `--full` mode. R3.1 requires quorum for any planning output from `/qgsd:quick`.

Form your own position on the plan first: does it correctly address the task description? Are tasks atomic and safe? State your vote as 1-2 sentences (APPROVE or BLOCK with rationale).

Read the full plan content from `${QUICK_DIR}/${next_num}-PLAN.md`.

Spawn the quorum orchestrator sub-agent:

```
Task(
  subagent_type="qgsd-quorum-orchestrator",
  description="Quorum review: quick plan ${next_num}",
  prompt="claude_vote: [Your APPROVE/BLOCK vote with 1-2 sentence rationale]
artifact: [Full plan content from ${QUICK_DIR}/${next_num}-PLAN.md]"
)
```

Fail-open: if the Task itself errors (agent unavailable), note it and proceed — same as R6 policy for individual models.

**Route on quorum_result:**
- **APPROVED:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results, then proceed to Step 6.
- **BLOCKED:** Report the blocker to the user. Do not execute.
- **ESCALATED:** Present the escalation to the user. Do not execute until resolved.
```

**Replace Step 6.5 human_needed quorum resolution loop:**

Current pattern: Claude forms position, queries each quorum model sequentially asking RESOLVED or UNRESOLVABLE, evaluates votes inline.

Replace with:

```
**Quorum resolution loop for human_needed:**

1. Read the full `human_verification` section from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely needs human eyes) with 1-2 sentence rationale per item.

3. Spawn the quorum orchestrator sub-agent:

   ```
   Task(
     subagent_type="qgsd-quorum-orchestrator",
     description="Quorum resolve human_needed: quick task ${next_num}",
     prompt="claude_vote: [Your APPROVE/BLOCK vote — APPROVE means can be resolved programmatically, BLOCK means genuinely requires human]
artifact: Quick task ${next_num} verification produced human_needed status.
The following items require human judgment per the verifier:

[Paste full human_verification section from VERIFICATION.md]

Can each item be resolved using available tools (grep, file inspection, quorum-test)? Vote APPROVE (can resolve) or BLOCK (needs human) with tool evidence or reason."
   )
   ```

   Fail-open: if the Task itself errors, note it and treat as BLOCK (escalate to user).

4. Route on quorum_result:
   - **APPROVED** → Consensus reached. Store `$VERIFICATION_STATUS = "Verified"`. Proceed to step 7.
   - **BLOCKED** → Cannot auto-resolve. Display items needing manual check to user. Store `$VERIFICATION_STATUS = "Needs Review"`. Continue to step 7.
   - **ESCALATED** → Present escalation to user as "Needs Review". Continue to step 7.
```
  </action>
  <verify>
    Read ~/.claude/qgsd/workflows/quick.md and confirm:
    - Step 5.7 contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls to Codex/Gemini/OpenCode/Copilot)
    - Step 5.7 contains `claude_vote:` in the Task prompt
    - Step 5.7 routes on `quorum_result:` (APPROVED/BLOCKED/ESCALATED)
    - Step 5.7 orchestrator writes `<!-- GSD_DECISION -->` itself on APPROVED
    - Step 6.5 contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls)
    - Step 6.5 uses APPROVE/BLOCK framing (not RESOLVED/UNRESOLVABLE)
    - No remaining `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, `mcp__opencode__opencode`, or `mcp__copilot-cli__ask` calls in either step
  </verify>
  <done>
    quick.md Step 5.7 and Step 6.5 both delegate quorum mechanics to the qgsd-quorum-orchestrator sub-agent. No inline model loops remain in either step.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace inline quorum loops in execute-phase.md and plan-phase.md</name>
  <files>~/.claude/qgsd/workflows/execute-phase.md, ~/.claude/qgsd/workflows/plan-phase.md</files>
  <action>
**In execute-phase.md — replace the human_needed quorum resolution loop inside verify_phase_goal:**

Current pattern: Claude forms position, queries each model sequentially (RESOLVED/UNRESOLVABLE), evaluates votes.

Replace the quorum resolution block with:

```
Before escalating to the user, run a quorum resolution loop to attempt automated resolution:

1. Read the full `human_verification` section from `${PHASE_DIR}/${PHASE_NUM}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)? State your vote as APPROVE (can resolve programmatically) or BLOCK (genuinely needs human eyes) with 1-2 sentence rationale.

3. Spawn the quorum orchestrator sub-agent:

   ```
   Task(
     subagent_type="qgsd-quorum-orchestrator",
     description="Quorum resolve human_needed: phase ${PHASE_NUMBER}",
     prompt="claude_vote: [Your APPROVE/BLOCK vote — APPROVE means can be resolved programmatically, BLOCK means genuinely requires human]
artifact: Phase ${PHASE_NUMBER} verification produced human_needed status.
The following items require human judgment per the verifier:

[Paste full human_verification section from VERIFICATION.md]

Can each item be resolved using available tools (grep, file inspection, quorum-test)? Vote APPROVE (can resolve) or BLOCK (needs human) with tool evidence or reason."
   )
   ```

   Fail-open: if the Task itself errors, treat as BLOCK (escalate to user).

4. Route on quorum_result:
   - **APPROVED** → Consensus reached. Treat as `passed`. Log: `Quorum resolved human_needed items — treating as passed`. Proceed to → update_roadmap.
   - **BLOCKED** → Cannot auto-resolve. Escalate to user with the standard block below.
   - **ESCALATED** → Escalate to user with escalation details appended to the standard block.
```

**In plan-phase.md — replace Step 8.5 inline quorum loop:**

Current pattern: Claude forms position, then queries Codex/Gemini/OpenCode/Copilot sequentially (from R3.2–R3.3 procedure), runs up to 3 rounds.

Replace Step 8.5 with:

```
## 8.5 Run QUORUM (per CLAUDE.md R3)

Before presenting planner output to the user, run QUORUM as required by R3.1.

Form your own position on the plans first: do they correctly address the phase goal, requirement IDs, and user decisions from CONTEXT.md? State your vote as APPROVE or BLOCK with 1-2 sentence rationale.

Read the plan files from `${PHASE_DIR}/*-PLAN.md` to prepare the artifact for the sub-agent.

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"plan_phase\",\"sub_activity\":\"quorum\",\"phase\":${PHASE_NUMBER},\"quorum_round\":1}"
```

Spawn the quorum orchestrator sub-agent:

```
Task(
  subagent_type="qgsd-quorum-orchestrator",
  description="Quorum review: phase ${PHASE_NUMBER} plans",
  prompt="claude_vote: [Your APPROVE/BLOCK vote with 1-2 sentence rationale]
artifact: [Full content of all PLAN.md files from ${PHASE_DIR}]"
)
```

Fail-open: if the Task itself errors (agent unavailable), note it and proceed — same as R6 policy for individual models.

Route on quorum_result:
- **APPROVED:** Include `<!-- GSD_DECISION -->` in your response summarizing quorum results. Proceed to step 9.
- **BLOCKED:** Report blocker to user. Do not proceed.
- **ESCALATED:** Present escalation to user. Do not proceed until resolved.
```
  </action>
  <verify>
    Read both files and confirm:
    - execute-phase.md verify_phase_goal section contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls)
    - execute-phase.md routes on `quorum_result:` with APPROVED/BLOCKED/ESCALATED
    - plan-phase.md Step 8.5 contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls)
    - plan-phase.md routes on `quorum_result:` with APPROVED/BLOCKED/ESCALATED
    - plan-phase.md orchestrator writes `<!-- GSD_DECISION -->` itself on APPROVED
    - No remaining `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, `mcp__opencode__opencode`, or `mcp__copilot-cli__ask` calls in either replaced section
  </verify>
  <done>
    execute-phase.md and plan-phase.md both delegate quorum mechanics to the qgsd-quorum-orchestrator sub-agent. No inline model loops remain in the replaced sections.
  </done>
</task>

<task type="auto">
  <name>Task 3: Replace inline quorum loops in discuss-phase.md and map-codebase.md</name>
  <files>~/.claude/qgsd/workflows/discuss-phase.md, ~/.claude/qgsd/workflows/map-codebase.md</files>
  <action>
**In discuss-phase.md — replace r4_pre_filter inline model calls:**

Current pattern: For each gray area, Claude forms position, then queries Codex/Gemini/OpenCode/Copilot sequentially with CONSENSUS-READY/USER-INPUT-NEEDED prompt, then runs R3.3 deliberation (up to 3 rounds) inline.

The r4_pre_filter step processes one gray area at a time. Replace the per-question model call loop with a sub-agent spawn per question:

Replace the r4_pre_filter step body with:

```
<step name="r4_pre_filter">
Apply the R4 pre-filter (CLAUDE.md §R4) to every gray area candidate before presenting anything to the user.

**This step is MANDATORY. Do NOT skip even if gray areas seem obvious.**

**For each gray area question identified in analyze_phase:**

1. **Form Claude's own position first** — Bias toward the long-term solution. Write a 1-2 sentence answer and classify as CONSENSUS-READY or USER-INPUT-NEEDED. This is Claude's active quorum vote.

2. **Spawn the quorum orchestrator sub-agent** (one spawn per question — sequential, not parallel):

   ```
   Task(
     subagent_type="qgsd-quorum-orchestrator",
     description="R4 pre-filter: [question text excerpt]",
     prompt="claude_vote: [CONSENSUS-READY: answer | USER-INPUT-NEEDED: reason] — Claude's position on whether this gray area can be resolved by quorum or needs user input.
artifact: Context: We are planning [phase name] for the QGSD project.
Phase goal: [goal from ROADMAP.md]
Codebase context: [relevant patterns/decisions from STATE.md]

Gray area question: [question text]

Should this be decided by quorum now (removing it from the user's question list), or does it genuinely require the user's vision/preference to answer?

If quorum can decide: provide the recommended answer biased toward the long-term solution.
If user input is needed: explain why quorum cannot resolve this without user preference.

Vote APPROVE (quorum can decide — equivalent to CONSENSUS-READY) or BLOCK (user input needed — equivalent to USER-INPUT-NEEDED)."
   )
   ```

   Fail-open: if the Task itself errors (agent unavailable), note it and mark the question for user presentation per R6.

3. **Route on quorum_result:**
   - **APPROVED** → Record as auto-resolved assumption. Add to `auto_resolved[]` with the consensus answer from the sub-agent's final_positions. Remove from user-facing question list.
   - **BLOCKED or ESCALATED** → Mark for user presentation. Add to `for_user[]`.

4. **Maintain two lists:**
   - `auto_resolved[]` — Questions resolved by quorum consensus, with the recorded assumption
   - `for_user[]` — Questions that could not be resolved by quorum

5. **After processing all questions:** Pass `auto_resolved[]` and `for_user[]` to the `present_gray_areas` step.

**If `for_user[]` is empty** (all questions resolved): Skip `present_gray_areas`. Go directly to `discuss_areas` with a note:
```
All gray areas were resolved by quorum consensus. Proceeding with auto-resolved assumptions:

[list each assumption]

No further input needed for this phase. Proceeding to context capture.
```
Then jump to `write_context`.
</step>
```

**In map-codebase.md — replace quorum_validate inline model calls:**

Current pattern: quorum_validate step queries each model sequentially with an APPROVED/ISSUES prompt, evaluates consensus inline.

Replace the `quorum_validate` step body with:

```
<step name="quorum_validate">
Run quorum validation on the 4 key mapper documents before finalizing.

**What quorum checks:**
- Internal consistency across STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md
- Completeness — obvious areas not covered by any mapper
- Blind spots — what parallel agents may have missed by working in isolation
- Concern triage — which items in CONCERNS.md should block new work vs be deferred

Form your own position first: read the 4 documents and assess consistency, completeness, and blind spots. State your vote as APPROVE (no significant issues) or BLOCK (issues found) with 1-2 sentence rationale.

Spawn the quorum orchestrator sub-agent:

```
Task(
  subagent_type="qgsd-quorum-orchestrator",
  description="Quorum validate: codebase map documents",
  prompt="claude_vote: [Your APPROVE/BLOCK vote with 1-2 sentence rationale]
artifact: [Full contents of .planning/codebase/STACK.md, .planning/codebase/ARCHITECTURE.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/CONCERNS.md]

Review these 4 codebase analysis documents produced by independent mapper agents.

Check for:
1. CONSISTENCY — Do the docs contradict each other?
2. COMPLETENESS — Are there obvious areas (security, scaling, auth, data layer) absent from all docs?
3. BLIND SPOTS — What did the parallel agents likely miss by working in isolation?
4. CONCERN TRIAGE — Which CONCERNS.md items should block new feature work vs be deferred?

Vote APPROVE (no significant issues) or BLOCK (issues found with structured list)."
)
```

Fail-open: if the Task itself errors (all models unavailable per R6.6), note reduced quorum, continue to scan_for_secrets — documents are still better than nothing.

**Route on quorum_result:**

**On APPROVED (consensus):** Continue to scan_for_secrets.

**On BLOCKED or ESCALATED:** Present to user:

```
⚠ Quorum flagged issues in codebase map:

[Issue list from sub-agent final_positions — e.g. "STACK says React 18 but ARCH references React 17 hooks pattern"]

Options:
1. Edit the affected documents now, then re-run quorum
2. Accept as-is and proceed to commit (issues noted)
3. Abort and re-run /qgsd:map-codebase
```

Wait for user response before continuing.
</step>
```
  </action>
  <verify>
    Read both files and confirm:
    - discuss-phase.md r4_pre_filter step contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls)
    - discuss-phase.md routes on `quorum_result:` with APPROVED/BLOCKED/ESCALATED
    - discuss-phase.md fail-open: errors mark question for user presentation
    - map-codebase.md quorum_validate step contains `subagent_type="qgsd-quorum-orchestrator"` (no inline model calls)
    - map-codebase.md routes on `quorum_result:` with APPROVED/BLOCKED/ESCALATED
    - No remaining `mcp__codex-cli__review`, `mcp__gemini-cli__gemini`, `mcp__opencode__opencode`, or `mcp__copilot-cli__ask` calls in either replaced section
  </verify>
  <done>
    discuss-phase.md and map-codebase.md both delegate quorum mechanics to the qgsd-quorum-orchestrator sub-agent. No inline model loops remain in the replaced sections.
  </done>
</task>

</tasks>

<verification>
After all tasks complete, run a cross-file check:

```bash
grep -n "mcp__codex-cli__review\|mcp__gemini-cli__gemini\|mcp__opencode__opencode\|mcp__copilot-cli__ask" \
  ~/.claude/qgsd/workflows/quick.md \
  ~/.claude/qgsd/workflows/execute-phase.md \
  ~/.claude/qgsd/workflows/plan-phase.md \
  ~/.claude/qgsd/workflows/discuss-phase.md \
  ~/.claude/qgsd/workflows/map-codebase.md
```

Expected: zero matches in the sections that were replaced (model calls may still appear in comments/examples outside the quorum loops — that is acceptable).

Confirm each replaced site:
- Contains `subagent_type="qgsd-quorum-orchestrator"`
- Contains `claude_vote:` in the Task prompt
- Routes on `quorum_result:`
- Has a fail-open clause for Task errors
</verification>

<success_criteria>
- All 6 inline quorum loops replaced with Task(qgsd-quorum-orchestrator) spawns
- Orchestrators remain thin — no model calls for quorum mechanics
- GSD_DECISION comment emitted by orchestrator itself (not the sub-agent) on APPROVED
- APPROVE/BLOCK framing used consistently (not RESOLVED/UNRESOLVABLE)
- Fail-open preserved for sub-agent unavailability
- No behavioral regression: quorum still required at all 6 sites
</success_criteria>

<output>
After completion, create `.planning/quick/37-refactor-inline-quorum-model-loops-in-6-/37-SUMMARY.md`
</output>
