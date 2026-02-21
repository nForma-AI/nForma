---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/execute-phase.md
  - CLAUDE.md
autonomous: true
requirements:
  - EXEC-VERIFY-01
  - EXEC-VERIFY-02
  - EXEC-VERIFY-03

must_haves:
  truths:
    - "Plans whose verification is handled by quorum-test carry task type checkpoint:verify (not checkpoint:human-verify)"
    - "checkpoint:human-verify is reserved exclusively for: (a) quorum escalation after 3 failed debug rounds, or (b) all quorum models UNAVAILABLE"
    - "Executor encountering a checkpoint:verify task calls /qgsd:quorum-test instead of waiting for human"
    - "If quorum-test returns BLOCK or persistent REVIEW-NEEDED, executor enters /qgsd:debug loop capped at 3 rounds before escalating to checkpoint:human-verify"
    - "CLAUDE.md R1 table defines both checkpoint:verify and checkpoint:human-verify with distinct semantics"
    - "All plans execute to completion with optional /qgsd:verify-work prompt"
  artifacts:
    - path: "commands/qgsd/execute-phase.md"
      provides: "qgsd:execute-phase command with checkpoint:verify handling and debug loop"
      contains: "checkpoint:verify"
    - path: "CLAUDE.md"
      provides: "R1 definitions including checkpoint:verify and checkpoint:human-verify"
      contains: "checkpoint:verify"
  key_links:
    - from: "commands/qgsd/execute-phase.md checkpoint:verify handler"
      to: "commands/qgsd/quorum-test.md"
      via: "/qgsd:quorum-test call on checkpoint:verify encounter"
      pattern: "quorum-test"
    - from: "commands/qgsd/execute-phase.md debug loop"
      to: "commands/qgsd/debug.md"
      via: "/qgsd:debug call when quorum-test returns BLOCK or REVIEW-NEEDED"
      pattern: "qgsd:debug"
    - from: "CLAUDE.md R1"
      to: "commands/qgsd/execute-phase.md checkpoint:verify handler"
      via: "definition of checkpoint:verify triggers executor behavior"
      pattern: "checkpoint:verify"
---

<objective>
Build the checkpoint:verify flow into the QGSD execute-phase command: automated quorum gate on plan verification steps with debug loop escalation and a final fallback to checkpoint:human-verify.

Purpose: New plans that use automated test-suite verification will carry checkpoint:verify so the executor calls /qgsd:quorum-test instead of waiting for human input. Existing plans (e.g., 02-04-PLAN.md) that have at least one non-automatable check (e.g., Check 6 requires a live Claude Code session) correctly retain checkpoint:human-verify and are NOT being renamed. Human review is reserved for: (a) plans with inherently non-automatable checks, (b) quorum cannot agree after 3 debug rounds, or (c) all models are unavailable.

Output: New qgsd:execute-phase command with full checkpoint:verify logic, CLAUDE.md R1 definitions for both checkpoint types.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/quorum-test.md
@commands/qgsd/debug.md
@commands/qgsd/execute-phase.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create qgsd:execute-phase command with checkpoint:verify handling</name>
  <files>
    commands/qgsd/execute-phase.md
  </files>
  <action>
    Replace the full contents of `commands/qgsd/execute-phase.md` with the `/qgsd:execute-phase`
    command definition. This command wraps the existing gsd:execute-phase execution workflow and
    adds automated handling for checkpoint:verify tasks.

    The file must use the following frontmatter:

      name: qgsd:execute-phase
      description: Execute all plans in a phase with wave parallelization and automated checkpoint:verify gates via quorum-test.
      argument-hint: "<phase-number>"
      allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, TodoWrite, AskUserQuestion

    The command body must define these sections:

    OBJECTIVE: Execute all plans in a phase. Delegates to the gsd:execute-phase workflow for
    wave-based plan execution. Extends the workflow with automated verification gates: when a
    plan step has type checkpoint:verify, the executor runs /qgsd:quorum-test instead of waiting
    for human input. Escalates to checkpoint:human-verify only on failure.

    EXECUTION CONTEXT:
      @~/.claude/get-shit-done/workflows/execute-phase.md

    CONTEXT:
      Phase: $ARGUMENTS
      Flag --gaps-only: execute only plans with gap_closure: true in frontmatter.

    PROCESS — Checkpoint type handling rules (applied during plan step execution):

    Rule 1 — checkpoint:verify (automated quorum gate):
      When the executor reads a plan step whose type is checkpoint:verify, it MUST:
      a. NOT pause for human input.
      b. Identify the test scope from the step's verify section (test file paths or test command).
      c. Call /qgsd:quorum-test with that scope.
      d. Evaluate the consensus verdict:
         - PASS: log "checkpoint:verify PASSED — quorum consensus" and continue execution.
         - BLOCK or REVIEW-NEEDED: enter the debug loop (see Rule 3).
         - ALL models UNAVAILABLE: escalate immediately to checkpoint:human-verify (see Rule 4).

    Rule 2 — checkpoint:human-verify (human gate):
      When the executor reads a plan step whose type is checkpoint:human-verify, it MUST pause
      and request human confirmation before continuing. This is the standard behavior and the
      escalation target for Rule 3.

    Rule 3 — Debug loop (3 rounds max):
      Triggered when /qgsd:quorum-test returns BLOCK or REVIEW-NEEDED on a checkpoint:verify step.
      Round N (N = 1, 2, 3):
        1. Call /qgsd:debug with the quorum-test failure context as $ARGUMENTS.
        2. Apply the consensus next step from /qgsd:debug (code fix, test correction, or config
           update as directed by the consensus).
        3. Re-run /qgsd:quorum-test with the same scope.
        4. If result is PASS: log "checkpoint:verify PASSED after N debug round(s)" and continue.
        5. If result is still BLOCK/REVIEW-NEEDED and N < 3: increment round, repeat.
      After 3 rounds with no PASS: escalate to checkpoint:human-verify (Rule 4).

    Rule 4 — Escalation to checkpoint:human-verify:
      Display a failure summary:
        - The checkpoint:verify step that failed
        - Number of /qgsd:debug rounds attempted
        - Final quorum-test verdict and concerns from each model
      Then pause: request human review and corrective action before resuming.

    COMPLETION:
      After all plans in the phase complete, display:
      "All plans complete. Run /qgsd:verify-work to confirm goal achievement."

    CHECKPOINT TYPE REFERENCE TABLE (include in the command body as a markdown table):

      | Task Type              | Who handles it   | Escalates to           | When used                        |
      |------------------------|------------------|------------------------|----------------------------------|
      | checkpoint:verify      | Executor auto    | checkpoint:human-verify| Test-suite gates (quorum-testable)|
      | checkpoint:human-verify| Human            | N/A                    | Live session / escalation only   |
  </action>
  <verify>
    grep "name: qgsd:execute-phase" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "checkpoint:verify" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "checkpoint:human-verify" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "qgsd:debug" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "3 rounds" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "qgsd:verify-work" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    grep "All plans complete" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md
    # All greps must return matches
  </verify>
  <done>commands/qgsd/execute-phase.md defines qgsd:execute-phase with: checkpoint:verify automated handling via /qgsd:quorum-test, 3-round /qgsd:debug escalation loop, checkpoint:human-verify as escalation-only gate, and post-completion /qgsd:verify-work suggestion.</done>
</task>

<task type="auto">
  <name>Task 2: Add checkpoint:verify and checkpoint:human-verify definitions to CLAUDE.md R1</name>
  <files>
    CLAUDE.md
  </files>
  <action>
    In `CLAUDE.md`, extend the R1 definitions table (## R1 — Definitions) with two new rows.

    The R1 table currently ends with the UNAVAILABLE row. Insert two new rows immediately after
    it (before the closing `---` separator that starts ## R2):

    Row 1 — checkpoint:verify:
      Term: checkpoint:verify
      Definition: An automated verification gate in a plan step. When the executor encounters a
      task of this type, it MUST call /qgsd:quorum-test rather than waiting for human confirmation.
      If quorum-test returns BLOCK or REVIEW-NEEDED, the executor enters the /qgsd:debug loop
      (capped at 3 rounds). If the loop fails to reach PASS after 3 rounds, it escalates to
      checkpoint:human-verify.

    Row 2 — checkpoint:human-verify:
      Term: checkpoint:human-verify
      Definition: A human-required verification gate. Used only when: (a) a checkpoint:verify
      debug loop exhausts 3 rounds without reaching PASS, or (b) all quorum models are UNAVAILABLE
      during a checkpoint:verify gate. Plans assign this type only for verifications that are
      inherently non-automatable (e.g., live session integration tests).

    After the insertion, the bottom of the R1 table section should look like:

      | `OSCILLATION` | ≥ 3 of the last 6 commits alternating changes to the same file set with no net stability improvement |
      | `UNAVAILABLE` | A model returns an error, quota failure, or no response after 1 retry |
      | `checkpoint:verify` | An automated verification gate in a plan step. When the executor encounters a task of this type, it MUST call `/qgsd:quorum-test` rather than waiting for human confirmation. If quorum-test returns BLOCK or REVIEW-NEEDED, the executor enters the `/qgsd:debug` loop (capped at 3 rounds). If the loop fails to reach PASS after 3 rounds, it escalates to `checkpoint:human-verify`. |
      | `checkpoint:human-verify` | A human-required verification gate. Used only when: (a) a `checkpoint:verify` debug loop exhausts 3 rounds without reaching PASS, or (b) all quorum models are UNAVAILABLE during a `checkpoint:verify` gate. Plans assign this type only for verifications that are inherently non-automatable (e.g., live session integration tests). |

    The two rows must be inside the existing R1 table (no new section, no new header).
  </action>
  <verify>
    grep "checkpoint:verify" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    grep "checkpoint:human-verify" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    grep "3 rounds" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    node -e "
      const fs = require('fs');
      const content = fs.readFileSync('/Users/jonathanborduas/code/QGSD/CLAUDE.md', 'utf8');
      const r1Section = content.split('## R2')[0];
      console.log('checkpoint:verify in R1:', r1Section.includes('checkpoint:verify'));
      console.log('checkpoint:human-verify in R1:', r1Section.includes('checkpoint:human-verify'));
    "
    # Expected: both true
  </verify>
  <done>CLAUDE.md R1 definitions table contains both checkpoint:verify (automated quorum gate, debug loop, escalation path) and checkpoint:human-verify (escalation-only, non-automatable checks). Both appear within the R1 section before ## R2.</done>
</task>

</tasks>

<verification>
Post-task checks across both files:

1. grep "name: qgsd:execute-phase" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md — returns match
2. grep "checkpoint:verify" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md — returns match
3. grep "qgsd:debug" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md — returns match
4. grep "3 rounds" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md — returns match
5. grep "All plans complete" /Users/jonathanborduas/code/QGSD/commands/qgsd/execute-phase.md — returns match
6. node -e check on CLAUDE.md — both checkpoint:verify and checkpoint:human-verify appear in R1 section
</verification>

<success_criteria>
- commands/qgsd/execute-phase.md defines qgsd:execute-phase with: checkpoint:verify auto-flow via /qgsd:quorum-test, 3-round /qgsd:debug escalation, checkpoint:human-verify as final escalation only, post-completion /qgsd:verify-work suggestion
- CLAUDE.md R1 table defines checkpoint:verify (automated quorum gate) and checkpoint:human-verify (escalation-only) with distinct, precise semantics
- New plans that carry checkpoint:verify will be handled automatically by the executor; existing plans with non-automatable checks (e.g., 02-04-PLAN.md Check 6) correctly retain checkpoint:human-verify
</success_criteria>

<output>
After completion, create `.planning/quick/6-build-checkpoint-verify-flow-into-qgsd-e/6-SUMMARY.md`
</output>
