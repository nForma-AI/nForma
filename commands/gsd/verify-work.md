---
name: gsd:verify-work
description: Validate built features through conversational UAT
argument-hint: "[phase number, e.g., '4']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Edit
  - Write
  - Task
---

<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gsd:execute-phase
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/verify-work.md
@~/.claude/get-shit-done/templates/UAT.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
1. Check for active UAT sessions (resume or start new)
2. Find SUMMARY.md files for the phase
3. Extract testable deliverables (user-observable outcomes)
4. Create {phase}-UAT.md with test list
5. Present tests one at a time:
   - Show expected behavior
   - Wait for plain text response
   - "yes/y/next" = pass, anything else = issue (severity inferred)
6. Update UAT.md after each response
7. On completion: commit, present summary
8. If issues found:
   - Spawn parallel debug agents to diagnose root causes
   - Spawn gsd-planner in --gaps mode to create fix plans
   - Spawn gsd-plan-checker to verify fix plans
   - Iterate planner ↔ checker until plans pass (max 3)
   - Present ready status with `/clear` then `/gsd:execute-phase`
</process>

<anti_patterns>
- Don't use AskUserQuestion for test responses — plain text conversation
- Don't ask severity — infer from description
- Don't present full checklist upfront — one test at a time
- Don't run automated tests — this is manual user validation
- Don't fix issues during testing — log as gaps, diagnose after all tests complete
</anti_patterns>

<success_criteria>
- [ ] UAT.md created with tests from SUMMARY.md
- [ ] Tests presented one at a time with expected behavior
- [ ] Plain text responses (no structured forms)
- [ ] Severity inferred, never asked
- [ ] Batched writes: on issue, every 5 passes, or completion
- [ ] Committed on completion
- [ ] If issues: parallel debug agents diagnose root causes
- [ ] If issues: gsd-planner creates fix plans from diagnosed gaps
- [ ] If issues: gsd-plan-checker verifies fix plans (max 3 iterations)
- [ ] Ready for `/gsd:execute-phase` when complete
</success_criteria>
