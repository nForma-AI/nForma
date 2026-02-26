---
phase: quick
task: 111
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/quorum.md
  - qgsd-core/workflows/discuss-phase.md
  - qgsd-core/workflows/quick.md
  - qgsd-core/workflows/execute-phase.md
  - qgsd-core/workflows/plan-phase.md
autonomous: true
requirements: []
user_setup: []

must_haves:
  truths:
    - All Task dispatch examples for qgsd-quorum-slot-worker include max_turns=100 parameter
    - max_turns limits each slot-worker to ~27 minutes (100 turns × 15s/turn avg)
    - Prevents indefinite hangs when external models are slow or unresponsive
  artifacts:
    - path: commands/qgsd/quorum.md
      provides: "Mode A and Mode B dispatch examples with max_turns parameter"
      pattern: "max_turns=100"
    - path: qgsd-core/workflows/discuss-phase.md
      provides: "R4 pre-filter quorum dispatch with max_turns parameter"
      pattern: "max_turns=100"
    - path: qgsd-core/workflows/quick.md
      provides: "Quick task quorum review dispatch with max_turns parameter"
      pattern: "max_turns=100"
  key_links:
    - from: "commands/qgsd/quorum.md"
      to: "qgsd-quorum-slot-worker agent"
      via: "Task dispatch examples"
      pattern: "max_turns parameter present in all dispatch examples"
---

<objective>
Add `max_turns=100` parameter to all Task dispatch examples for `qgsd-quorum-slot-worker` across dispatch workflow files. Companion to quick-110 (which added `model="haiku"`). Limits each slot-worker to maximum 100 agentic turns before stopping.

Purpose: Prevent indefinite hangs when external models are slow or quota-limited. Cap worst-case at ~27 minutes per worker.

Output: Updated dispatch examples in all 5 workflow files with consistent max_turns implementation.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@commands/qgsd/quorum.md
@qgsd-core/workflows/discuss-phase.md
@qgsd-core/workflows/quick.md
@agents/qgsd-quorum-slot-worker.md
</execution_context>

<context>
@.planning/STATE.md (reference for dispatch pattern context)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add max_turns=100 to quorum.md Mode A and Mode B dispatch examples</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Update all Task dispatch examples in commands/qgsd/quorum.md to include `max_turns=100` parameter.

Search for all inline code blocks containing `Task(subagent_type="qgsd-quorum-slot-worker"`. There are 4 locations:
1. Mode A "Example dispatch (all Tasks in one message turn)" section (~line 252-257) — 5 example Task lines
2. Mode A "For each round, dispatch one Task..." Deliberation section (~line 291) — describe adding max_turns to Round 2+ dispatch pattern
3. Mode B "Dispatch quorum workers via Task" section (~line 538-543) — 5 example Task lines
4. Mode B Round 2+ deliberation — describe adding max_turns to prior_positions rounds

For each Task example line, add `max_turns=100,` after `model="haiku", `.

Pattern transformation:
- Before: `Task(subagent_type="qgsd-quorum-slot-worker", model="haiku", description=...`
- After: `Task(subagent_type="qgsd-quorum-slot-worker", model="haiku", max_turns=100, description=...`

For prose descriptions of Round 2+ dispatch, also add: "Append `max_turns=100` to all YAML blocks in deliberation rounds (same as Round 1)" after the model="haiku" description.
  </action>
  <verify>
grep -n 'max_turns=100' commands/qgsd/quorum.md | wc -l → should show 12+ matches (5 Mode A examples + 5 Mode B examples + prose mentions in deliberation sections)
  </verify>
  <done>All Task dispatch example lines in Mode A and Mode B include max_turns=100 parameter. Deliberation round descriptions updated to reference max_turns persistence.</done>
</task>

<task type="auto">
  <name>Task 2: Add max_turns=100 to discuss-phase.md R4 pre-filter quorum dispatch</name>
  <files>qgsd-core/workflows/discuss-phase.md</files>
  <action>
Update the R4 pre-filter quorum dispatch in qgsd-core/workflows/discuss-phase.md to include `max_turns=100`.

Search for the quorum dispatch section in r4_pre_filter step (~line 208). This section describes:
```
Run R3 quorum inline (dispatch_pattern from `commands/qgsd/quorum.md` — Mode A:
   - Question: "Should '[question text]'..."
   - Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku"`
```

Update to: `with \`model="haiku", max_turns=100\``

Also update the second pass (present_gray_areas step, ~line 254) which has similar dispatch language. Change all dispatch descriptions to include max_turns=100.

Pattern: Any prose saying "dispatch ... Tasks with \`model=\"haiku\"\`" becomes "dispatch ... Tasks with \`model=\"haiku\", max_turns=100\`"
  </action>
  <verify>
grep -n 'max_turns=100' qgsd-core/workflows/discuss-phase.md | wc -l → should show 3+ matches (r4_pre_filter section, present_gray_areas R4 secondary pass, any other deliberation mentions)
  </verify>
  <done>discuss-phase.md r4_pre_filter and R4 secondary pass dispatch descriptions updated to reference max_turns=100 for all slot-worker Tasks.</done>
</task>

<task type="auto">
  <name>Task 3: Add max_turns=100 to quick.md quorum review dispatch</name>
  <files>qgsd-core/workflows/quick.md</files>
  <action>
Update the quorum review dispatch in qgsd-core/workflows/quick.md step 5.7 to include `max_turns=100`.

Search for "Step 5.7: Quorum review of plan" section (~line 247). This describes:
```
Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model="haiku"`
```

Update to: `with \`model="haiku", max_turns=100\``

Check for any other mentions of qgsd-quorum-slot-worker Task dispatch in Step 6.5 (verification quorum resolution loop, ~line 397) and update those as well if present.
  </action>
  <verify>
grep -n 'max_turns=100' qgsd-core/workflows/quick.md | wc -l → should show 2+ matches (step 5.7 and any step 6.5 verification loop dispatch mentions)
  </verify>
  <done>quick.md Step 5.7 quorum review and Step 6.5 verification loop dispatch descriptions updated to include max_turns=100 parameter.</done>
</task>

<task type="auto">
  <name>Task 4: Add max_turns=100 to execute-phase.md quorum dispatch</name>
  <files>qgsd-core/workflows/execute-phase.md</files>
  <action>
Update the quorum dispatch descriptions in qgsd-core/workflows/execute-phase.md to include `max_turns=100`.

Search for all lines containing "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model=\"haiku\"`" and update to add `max_turns=100`:

Pattern: "with `model=\"haiku\"`" → "with `model=\"haiku\", max_turns=100`"
  </action>
  <verify>
grep -n 'max_turns=100' qgsd-core/workflows/execute-phase.md | wc -l → should show 2+ matches
  </verify>
  <done>execute-phase.md all slot-worker dispatch descriptions include max_turns=100.</done>
</task>

<task type="auto">
  <name>Task 5: Add max_turns=100 to plan-phase.md quorum dispatch</name>
  <files>qgsd-core/workflows/plan-phase.md</files>
  <action>
Update the quorum dispatch description in qgsd-core/workflows/plan-phase.md to include `max_turns=100`.

Search for "Dispatch all active slots as sibling `qgsd-quorum-slot-worker` Tasks with `model=\"haiku\"`" and update to add `max_turns=100`:

Pattern: "with `model=\"haiku\"`" → "with `model=\"haiku\", max_turns=100`"
  </action>
  <verify>
grep -n 'max_turns=100' qgsd-core/workflows/plan-phase.md | wc -l → should show 1+ match
  </verify>
  <done>plan-phase.md slot-worker dispatch description includes max_turns=100.</done>
</task>

</tasks>

<verification>
After all tasks complete:
1. Run: `grep -c 'max_turns=100' commands/qgsd/quorum.md qgsd-core/workflows/discuss-phase.md qgsd-core/workflows/quick.md qgsd-core/workflows/execute-phase.md qgsd-core/workflows/plan-phase.md` → should return total count of 20+ across all files
2. Verify no dispatch lines lack max_turns: `grep -rn 'model="haiku"' qgsd-core/workflows/ commands/qgsd/quorum.md` — all occurrences should also have max_turns nearby
</verification>

<success_criteria>
- All 5 workflow files updated with max_turns=100 parameter
- Mode A dispatch examples (quorum.md) include max_turns
- Mode B dispatch examples (quorum.md) include max_turns
- Deliberation round descriptions reference max_turns persistence
- discuss-phase.md R4 pre-filter and secondary pass include max_turns
- quick.md Steps 5.7 and 6.5 include max_turns
- execute-phase.md quorum dispatches include max_turns
- plan-phase.md quorum dispatch includes max_turns
- No Task dispatch for qgsd-quorum-slot-worker lacks max_turns parameter
</success_criteria>

<output>
After completion, create `.planning/quick/111-add-max-turns-100-to-all-qgsd-quorum-slo/111-SUMMARY.md` with:
- Summary of changes (3 files updated, pattern applied consistently)
- Count of max_turns additions
- Rationale (prevents 23+ minute hangs, complements quick-110 modernization)
- Files modified list
</output>
