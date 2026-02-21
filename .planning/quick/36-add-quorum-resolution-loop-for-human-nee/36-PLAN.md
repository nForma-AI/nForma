---
phase: quick-36
plan: 36
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/.claude/qgsd/workflows/execute-phase.md
  - ~/.claude/qgsd/workflows/quick.md
autonomous: true
requirements: [QUICK-36]

must_haves:
  truths:
    - "When verifier returns human_needed, quorum models are consulted before escalating to the user"
    - "If all available quorum models vote RESOLVED (with evidence), the phase/task is treated as passed — no user interruption"
    - "If any available quorum model votes UNRESOLVABLE, the human_verification items are escalated to the user exactly as before"
    - "Unavailable models (quota/error) are skipped; remaining available models form the quorum"
    - "Each model call is sequential, never parallel (R3.2 compliance)"
    - "The quorum prompt includes the full human_verification section from VERIFICATION.md"
  artifacts:
    - path: ~/.claude/qgsd/workflows/execute-phase.md
      provides: "Updated human_needed branch in verify_phase_goal step with quorum resolution loop"
      contains: "quorum resolution loop"
    - path: ~/.claude/qgsd/workflows/quick.md
      provides: "Updated human_needed row in Step 6.5 with quorum resolution loop"
      contains: "quorum resolution loop"
  key_links:
    - from: "execute-phase.md verify_phase_goal human_needed branch"
      to: "quorum models (Claude, Codex, Gemini, OpenCode, Copilot)"
      via: "sequential tool calls per R3.2"
      pattern: "RESOLVED|UNRESOLVABLE"
    - from: "quick.md Step 6.5 human_needed row"
      to: "quorum models (Claude, Codex, Gemini, OpenCode, Copilot)"
      via: "sequential tool calls per R3.2"
      pattern: "RESOLVED|UNRESOLVABLE"
---

<objective>
Add a quorum resolution loop for human_needed verifier status in both execute-phase and quick (--full) workflows.

Purpose: Currently when qgsd-verifier returns human_needed, both workflows immediately present the items to the user. This wastes human attention on items that automated quorum models can resolve. The quorum loop runs first; only truly unresolvable items reach the user.

Output: Updated execute-phase.md (verify_phase_goal step) and quick.md (Step 6.5) with identical quorum resolution loop logic inserted before the user escalation path.
</objective>

<execution_context>
@~/.claude/qgsd/workflows/execute-plan.md
@~/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@~/.claude/qgsd/workflows/execute-phase.md
@~/.claude/qgsd/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add quorum resolution loop to execute-phase.md human_needed branch</name>
  <files>~/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
In the `verify_phase_goal` step, locate the `human_needed` status row in the status table and the `**If human_needed:**` prose block that follows it.

Replace the existing `**If human_needed:**` block with this new block:

```
**If human_needed:**

Before escalating to the user, run a quorum resolution loop to attempt automated resolution:

1. Read the full `human_verification` section from `${PHASE_DIR}/${PHASE_NUM}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)?

3. Query each quorum model **sequentially** (separate tool calls, never parallel — R3.2):

   ```
   Phase ${PHASE_NUMBER} verification produced human_needed status.
   The following items require human judgment per the verifier:

   [Paste full human_verification section from VERIFICATION.md]

   Using available tools (grep, file inspection, quorum-test), try to resolve each item.
   Vote RESOLVED (with tool evidence) or UNRESOLVABLE (with reason for each unresolvable item).
   ```

   Fail-open: if a model is UNAVAILABLE (quota/error), skip it and proceed with available models.

4. Evaluate votes:
   - **All available models vote RESOLVED** → Consensus reached. Treat as `passed`. Log: `Quorum resolved human_needed items — treating as passed`. Proceed to → update_roadmap.
   - **Any model votes UNRESOLVABLE** → Cannot auto-resolve. Escalate to user with the standard block below.

**If escalating to user (quorum could not resolve):**
```
## Phase {X}: {Name} — Human Verification Required

All automated checks passed. Quorum attempted resolution but could not fully verify {N} items:

{From VERIFICATION.md human_verification section}

"approved" → continue | Report issues → gap closure
```
```

Do NOT alter the `passed` or `gaps_found` branches, the status table, or any other part of the step.
  </action>
  <verify>
grep -n "quorum resolution loop" ~/.claude/qgsd/workflows/execute-phase.md
grep -n "RESOLVED" ~/.claude/qgsd/workflows/execute-phase.md
grep -n "UNRESOLVABLE" ~/.claude/qgsd/workflows/execute-phase.md
  </verify>
  <done>
execute-phase.md human_needed branch contains: quorum resolution loop prose, sequential model query instruction, RESOLVED/UNRESOLVABLE vote evaluation, fail-open note, and original user escalation block preserved as the fallback path.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add quorum resolution loop to quick.md Step 6.5 human_needed row</name>
  <files>~/.claude/qgsd/workflows/quick.md</files>
  <action>
In Step 6.5 (Verification, --full mode only), locate the status table row:

```
| `human_needed` | Display items needing manual check, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
```

Replace that row's action description and add a prose block immediately after the status table. The new row:

```
| `human_needed` | Run quorum resolution loop (see below). If quorum resolves → store `$VERIFICATION_STATUS = "Verified"`, continue. If quorum cannot resolve → display items, store `$VERIFICATION_STATUS = "Needs Review"`, continue |
```

Then, immediately after the status table, insert a new prose block:

```
**Quorum resolution loop for human_needed:**

1. Read the full `human_verification` section from `${QUICK_DIR}/${next_num}-VERIFICATION.md`.

2. Form your own position: can each item be verified via available tools (grep, file reads, quorum-test)?

3. Query each quorum model **sequentially** (separate tool calls, never parallel — R3.2):

   ```
   Quick task ${next_num} verification produced human_needed status.
   The following items require human judgment per the verifier:

   [Paste full human_verification section from VERIFICATION.md]

   Using available tools (grep, file inspection, quorum-test), try to resolve each item.
   Vote RESOLVED (with tool evidence) or UNRESOLVABLE (with reason for each unresolvable item).
   ```

   Fail-open: if a model is UNAVAILABLE (quota/error), skip it and proceed with available models.

4. Evaluate votes:
   - **All available models vote RESOLVED** → Consensus reached. Store `$VERIFICATION_STATUS = "Verified"`. Proceed to step 7.
   - **Any model votes UNRESOLVABLE** → Cannot auto-resolve. Display items needing manual check to user. Store `$VERIFICATION_STATUS = "Needs Review"`. Continue to step 7.
```

Do NOT alter the `passed` or `gaps_found` rows or any other part of the step.
  </action>
  <verify>
grep -n "quorum resolution loop" ~/.claude/qgsd/workflows/quick.md
grep -n "RESOLVED" ~/.claude/qgsd/workflows/quick.md
grep -n "UNRESOLVABLE" ~/.claude/qgsd/workflows/quick.md
  </verify>
  <done>
quick.md Step 6.5 human_needed row updated to reference the quorum resolution loop, and the prose block below the table describes the full sequential loop with RESOLVED/UNRESOLVABLE vote paths, fail-open, and VERIFICATION_STATUS outcome for each branch.
  </done>
</task>

</tasks>

<verification>
1. grep "quorum resolution loop" ~/.claude/qgsd/workflows/execute-phase.md — must return match in verify_phase_goal step
2. grep "quorum resolution loop" ~/.claude/qgsd/workflows/quick.md — must return match in Step 6.5
3. grep "RESOLVED\|UNRESOLVABLE" ~/.claude/qgsd/workflows/execute-phase.md — both votes documented
4. grep "RESOLVED\|UNRESOLVABLE" ~/.claude/qgsd/workflows/quick.md — both votes documented
5. grep "R3.2" ~/.claude/qgsd/workflows/execute-phase.md — sequential call rule cited in new block
6. grep "R3.2" ~/.claude/qgsd/workflows/quick.md — sequential call rule cited in new block
7. Verify passed/gaps_found branches are untouched in both files
</verification>

<success_criteria>
- Both workflow files updated with identical quorum resolution loop logic
- human_needed no longer immediately escalates to user; quorum runs first
- Sequential model call pattern preserved (R3.2 compliant)
- Fail-open: unavailable models skipped without blocking resolution
- Consensus = all available vote RESOLVED → treated as passed
- Any UNRESOLVABLE vote → original user escalation preserved as fallback
- VERIFICATION_STATUS = "Verified" in quick.md when quorum resolves (not "Needs Review")
</success_criteria>

<output>
After completion, create `.planning/quick/36-add-quorum-resolution-loop-for-human-nee/36-SUMMARY.md`
</output>
