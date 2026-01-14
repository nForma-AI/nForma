---
name: gsd:plan-fix
description: Plan fixes for UAT issues from verify-work
argument-hint: "<phase, e.g., '4'>"
allowed-tools:
  - Read
  - Bash
  - Write
  - Glob
  - Grep
  - AskUserQuestion
  - SlashCommand
---

<objective>
Create FIX.md plan from UAT issues found during verify-work.

Purpose: Plan fixes for issues logged in {phase}-UAT.md.
Output: {phase}-FIX.md in the phase directory, ready for execution.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/plan-format.md
@~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
Phase: $ARGUMENTS (required - e.g., "4")

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>

<step name="parse">
**Parse phase argument:**

$ARGUMENTS should be a phase number like "4" or "04".

If no argument provided:
```
Error: Phase number required.

Usage: /gsd:plan-fix 4

This creates a fix plan from .planning/phases/04-name/04-UAT.md
```
Exit.
</step>

<step name="find">
**Find UAT.md file:**

```bash
ls .planning/phases/${PHASE_ARG}*/*-UAT.md 2>/dev/null
```

If not found:
```
No UAT.md found for phase {phase}.

UAT.md files are created by /gsd:verify-work during testing.
Run /gsd:verify-work {phase} first.
```
Exit.

If found but status is "testing":
```
UAT session still in progress.

Run /gsd:verify-work to complete testing first.
```
Exit.
</step>

<step name="read">
**Read issues from UAT.md:**

Read the "Issues for /gsd:plan-fix" section.

If section is empty or says "[none yet]":
```
No issues found in UAT.md.

All tests passed - no fix plan needed.
```
Exit.

Parse each issue:
- ID (UAT-XXX)
- Brief summary
- Severity (blocker/major/minor/cosmetic)
- Test number (for context)
- **root_cause** (if diagnosed - may be empty)

Also read the corresponding test from "Tests" section to get:
- expected behavior
- reported issue (verbatim user description)
- root_cause (if diagnosed)
- debug_session (path to debug file, if diagnosed)

**Check if diagnosed:**
- If UAT.md status is "diagnosed" OR root_cause fields are populated → issues have been investigated
- If not diagnosed → plan based on symptoms only (less precise)
</step>

<step name="plan">
**Create fix tasks:**

For each issue (or logical group):
- Create one task per issue OR
- Group related cosmetic/minor issues into single task

**If diagnosed (root_cause available):**
```xml
<task type="auto">
  <name>Fix UAT-{NNN}: {issue summary}</name>
  <files>{files from diagnosis}</files>
  <action>
**Root Cause:** {root_cause from diagnosis}
**Issue:** {verbatim reported description}
**Expected:** {from test}

**Fix:** {specific fix based on diagnosed root cause}

Debug session: {debug_session path} (for reference)
  </action>
  <verify>
- Confirm root cause addressed
- {expected behavior} now works correctly
  </verify>
  <done>UAT-{NNN} resolved - {root_cause} fixed</done>
</task>
```

**If NOT diagnosed (symptoms only):**
```xml
<task type="auto">
  <name>Fix UAT-{NNN}: {issue summary}</name>
  <files>[affected files - infer from test context]</files>
  <action>
**Issue:** {verbatim reported description}
**Expected:** {from test}

[Investigate and fix - root cause unknown]
  </action>
  <verify>
- Reproduce original issue - confirm fixed
- {expected behavior} now works correctly
  </verify>
  <done>UAT-{NNN} resolved - {expected behavior} works</done>
</task>
```

Prioritize: blocker → major → minor → cosmetic
</step>

<step name="write">
**Write FIX.md:**

Create `.planning/phases/XX-name/{phase}-FIX.md`:

```markdown
---
phase: XX-name
plan: {phase}-FIX
type: fix
wave: 1
depends_on: []
autonomous: true
---

<objective>
Fix {N} UAT issues from phase {phase}.

Source: {phase}-UAT.md
Diagnosed: {yes/no - whether root causes were identified}
Priority: {blocker count} blocker, {major count} major, {minor count} minor, {cosmetic count} cosmetic
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

**Issues being fixed:**
@.planning/phases/XX-name/{phase}-UAT.md

**Debug sessions (if diagnosed):**
[Reference each debug_session path from UAT.md for full investigation context]

**Original plans for reference:**
@.planning/phases/XX-name/{phase}-01-PLAN.md
[other relevant plans]
</context>

<tasks>
[Generated fix tasks]
</tasks>

<verification>
Before declaring plan complete:
- [ ] All blocker issues fixed
- [ ] All major issues fixed
- [ ] Minor/cosmetic issues fixed or documented as deferred
- [ ] Each fix verified against original reported issue
</verification>

<success_criteria>
- All UAT issues from {phase}-UAT.md addressed
- Tests pass
- Ready for re-verification with /gsd:verify-work {phase}
</success_criteria>

<output>
After completion, create `.planning/phases/XX-name/{phase}-FIX-SUMMARY.md`
</output>
```
</step>

<step name="offer">
**Offer execution:**

```
## Fix Plan Created

**{phase}-FIX.md** — {N} issues to fix

| Severity | Count |
|----------|-------|
| Blocker  | {n}   |
| Major    | {n}   |
| Minor    | {n}   |
| Cosmetic | {n}   |
```

Use AskUserQuestion:
- header: "Next"
- question: "What would you like to do?"
- options:
  - "Execute fix plan" — Run the fixes now
  - "Review plan first" — Look at the plan before executing
  - "Done for now" — Come back later

**If "Execute fix plan":**
Invoke `/gsd:execute-plan .planning/phases/XX-name/{phase}-FIX.md`

**If "Review plan first":**
Display the plan contents, then ask again whether to execute.

**If "Done for now":**
```
Fix plan saved. Run when ready:
`/gsd:execute-plan .planning/phases/XX-name/{phase}-FIX.md`
```
</step>

</process>

<success_criteria>
- [ ] UAT.md found and issues parsed
- [ ] Fix tasks created for each issue
- [ ] FIX.md written with proper structure
- [ ] User offered next steps
</success_criteria>
