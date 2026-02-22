---
name: qgsd:execute-phase
description: Execute all plans in a phase with wave parallelization and automated checkpoint:verify gates via quorum-test.
argument-hint: "<phase-number>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in a phase. Delegates to the gsd:execute-phase workflow for wave-based plan execution. Extends the workflow with automated verification gates: when a plan step has type checkpoint:verify, the executor runs /qgsd:quorum-test instead of waiting for human input. Escalates to checkpoint:human-verify only on failure.
</objective>

<execution_context>
@~/.claude/qgsd/workflows/execute-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.
</context>

<process>

Execute the execute-phase workflow from @~/.claude/qgsd/workflows/execute-phase.md end-to-end, applying the checkpoint type handling rules below at every plan step.

## Agent Substitution (QGSD override)

The GSD workflow uses GSD-specific agent types. When following that workflow, substitute:

| GSD agent type (in workflow) | Use instead (QGSD) |
|------------------------------|---------------------|
| `gsd-executor` | `qgsd-executor` |
| `gsd-verifier` | `qgsd-verifier` |

This applies everywhere the workflow calls `Task(subagent_type="gsd-executor", ...)` or `Task(subagent_type="gsd-verifier", ...)`. All other agent types pass through unchanged.

## Checkpoint Type Handling Rules

These rules are applied during plan step execution. Each plan step carries a `type` attribute. Handle checkpoint types as follows:

---

### Rule 1 — checkpoint:verify (automated quorum gate)

When the executor reads a plan step whose type is `checkpoint:verify`, it MUST:

a. NOT pause for human input.
b. Identify the test scope from the step's verify section (test file paths or test command).
c. Call `/qgsd:quorum-test` with that scope.
d. Evaluate the consensus verdict:
   - **PASS:** log `checkpoint:verify PASSED — quorum consensus` and continue execution.
   - **BLOCK or REVIEW-NEEDED:** enter the debug loop (see Rule 3).
   - **ALL models UNAVAILABLE:** escalate immediately to `checkpoint:human-verify` (see Rule 4).

---

### Rule 2 — checkpoint:human-verify (human gate)

When the executor reads a plan step whose type is `checkpoint:human-verify`, it MUST pause and request human confirmation before continuing. This is the standard behavior and the escalation target for Rule 3.

---

### Rule 3 — Debug loop (3 rounds max)

Triggered when `/qgsd:quorum-test` returns BLOCK or REVIEW-NEEDED on a `checkpoint:verify` step.

Round N (N = 1, 2, 3):

1. Call `/qgsd:debug` with the quorum-test failure context as `$ARGUMENTS`.
2. Apply the consensus next step from `/qgsd:debug` (code fix, test correction, or config update as directed by the consensus).
3. Re-run `/qgsd:quorum-test` with the same scope.
4. If result is PASS: log `checkpoint:verify PASSED after N debug round(s)` and continue.
5. If result is still BLOCK/REVIEW-NEEDED and N < 3: increment round, repeat.

After 3 rounds with no PASS: escalate to `checkpoint:human-verify` (Rule 4).

---

### Rule 4 — Escalation to checkpoint:human-verify

Display a failure summary:
- The `checkpoint:verify` step that failed
- Number of `/qgsd:debug` rounds attempted
- Final quorum-test verdict and concerns from each model

Then pause: request human review and corrective action before resuming.

---

## Checkpoint Type Reference Table

| Task Type               | Who handles it    | Escalates to            | When used                           |
|-------------------------|-------------------|-------------------------|-------------------------------------|
| `checkpoint:verify`     | Executor auto     | `checkpoint:human-verify` | Test-suite gates (quorum-testable) |
| `checkpoint:human-verify` | Human           | N/A                     | Live session / escalation only      |

---

## Completion

After all plans in the phase complete, display:

```
All plans complete. Run /qgsd:verify-work to confirm goal achievement.
```

</process>
