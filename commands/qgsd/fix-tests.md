---
name: qgsd:fix-tests
description: Autonomously discover, batch, run, categorize, and fix test failures across large suites
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---

<objective>
Discover all test failures in the project, batch them, run each with flakiness detection,
stub-categorize each confirmed failure, and iterate until a terminal state is reached.

This command is execution-only — it does NOT invoke quorum workers (R2.1 / INTG-03).
</objective>

<execution_context>
@~/.claude/qgsd/workflows/fix-tests.md
</execution_context>

<process>
Follow the fix-tests workflow from @~/.claude/qgsd/workflows/fix-tests.md end-to-end.
</process>
