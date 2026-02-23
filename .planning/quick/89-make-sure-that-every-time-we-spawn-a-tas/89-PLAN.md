---
phase: quick-89
plan: 89
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
  - /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Every Task() call in QGSD workflow files has a description= parameter"
    - "The description= value is meaningful and identifies the sub-agent's purpose (e.g., 'Execute plan {N}: {name}', 'Research phase {phase}', 'Verify phase {phase}')"
    - "The model-profile-resolution.md reference example also shows description= so new workflows copy the correct pattern"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md"
      provides: "executor Task (line ~110) and verifier Task (line ~367) with description= added"
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md"
      provides: "researcher Task (line ~44) with description= added"
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md"
      provides: "integration-checker Task (line ~80) with description= added"
    - path: "/Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md"
      provides: "reference example Task with description= added"
  key_links:
    - from: "execute-phase.md executor Task"
      to: "description= parameter"
      via: "description=\"Execute plan {plan_number}: {phase_number}-{phase_name}\""
      pattern: "description=.Execute plan"
    - from: "execute-phase.md verifier Task"
      to: "description= parameter"
      via: "description=\"Verify phase {phase_number}\""
      pattern: "description=.Verify phase"
    - from: "research-phase.md researcher Task"
      to: "description= parameter"
      via: "description=\"Research phase {phase}\""
      pattern: "description=.Research phase"
---

<objective>
Add the missing `description=` parameter to every Task() sub-agent spawn call in QGSD workflow and reference files.

Purpose: The `description` parameter identifies what a sub-agent is doing in the Claude Code UI and activity log. Without it, parallel or sequential Task spawns appear as anonymous agents, making debugging and observability harder. Every Task() call should declare its purpose.

Output: Four files patched so all Task() calls have a `description=` parameter with a meaningful value.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add description= to execute-phase.md Task spawns</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md</files>
  <action>
Read the full file first. There are two Task() calls missing description=:

**1. Executor Task (around line 110):**
The Task block starts with:
```
Task(
  subagent_type="qgsd-executor",
  model="{executor_model}",
  prompt="
```
Add `description="Execute plan {plan_number}: {phase_number}-{phase_name}"` as the last parameter before the closing `)` of the Task call. It should go after the closing `"` of the prompt parameter, like:
```
  ",
  description="Execute plan {plan_number}: {phase_number}-{phase_name}"
)
```

**2. Verifier Task (around line 367):**
The Task block is:
```
Task(
  prompt="Verify phase {phase_number} goal achievement.
...
Create VERIFICATION.md.",
  subagent_type="qgsd-verifier",
  model="{verifier_model}"
)
```
Add `description="Verify phase {phase_number}"` so the closing becomes:
```
  subagent_type="qgsd-verifier",
  model="{verifier_model}",
  description="Verify phase {phase_number}"
)
```
  </action>
  <verify>
grep -n "description=" /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
Should show at least 3 results: one for the executor Task, one for the verifier Task, one for the quorum-orchestrator Task (already had it at line ~404).
  </verify>
  <done>execute-phase.md has description= on all three Task() calls (executor, verifier, quorum-orchestrator)</done>
</task>

<task type="auto">
  <name>Task 2: Add description= to research-phase.md, audit-milestone.md, and model-profile-resolution.md</name>
  <files>
    /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
    /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
    /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
  </files>
  <action>
Read all three files first, then patch each one.

**research-phase.md (around line 44):**
The Task block ends with:
```
  subagent_type="qgsd-phase-researcher",
  model="{researcher_model}"
)
```
Add description so it becomes:
```
  subagent_type="qgsd-phase-researcher",
  model="{researcher_model}",
  description="Research phase {phase}: {name}"
)
```

**audit-milestone.md (around line 80):**
The Task block ends with:
```
  subagent_type="qgsd-integration-checker",
  model="{integration_checker_model}"
)
```
Add description so it becomes:
```
  subagent_type="qgsd-integration-checker",
  model="{integration_checker_model}",
  description="Audit milestone: integration check"
)
```

**references/model-profile-resolution.md (around line 20):**
The example Task block is:
```
Task(
  prompt="...",
  subagent_type="qgsd-planner",
  model="{resolved_model}"  # "inherit", "sonnet", or "haiku"
)
```
Add description so it becomes:
```
Task(
  prompt="...",
  subagent_type="qgsd-planner",
  model="{resolved_model}",  # "inherit", "sonnet", or "haiku"
  description="[descriptive label for this sub-agent]"
)
```
Note: the inline comment on the model line needs the comma moved — change `model="{resolved_model}"  # comment` to `model="{resolved_model}",  # comment` and add the description line after.

After all three files are edited, commit all four changed files (execute-phase.md from Task 1 + these three) in a single commit:
```bash
node /Users/jonathanborduas/code/QGSD/bin/gsd-tools.cjs commit "fix(workflows): add description= to all Task() spawns" \
  --files /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md \
         /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
```

Then create the SUMMARY.md and update STATE.md quick tasks table.
  </action>
  <verify>
grep -n "description=" /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
grep -n "description=" /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
grep -n "description=" /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md

Each should return at least 1 result with description=.

Also run the full audit to confirm zero missing:
python3 -c "
import re
files = [
    '/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md',
    '/Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md',
]
for path in files:
    content = open(path).read()
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if re.match(r'^Task\(', line.strip()):
            block = '\n'.join(lines[i:i+80])
            if 'description=' not in block:
                print(f'MISSING: {path} line {i+1}')
print('Audit complete')
"
  </verify>
  <done>All four files have description= on every Task() call. Git commit created. STATE.md quick tasks table updated with entry for task 89.</done>
</task>

</tasks>

<verification>
Run the audit script from the verify block above. Output should be only "Audit complete" with no MISSING lines.
</verification>

<success_criteria>
- Every Task() call in execute-phase.md, research-phase.md, audit-milestone.md, and model-profile-resolution.md has a description= parameter
- Description values are meaningful identifiers (not empty strings, not generic "sub-agent")
- Single git commit created with all four files
- STATE.md updated with quick task 89 entry
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/89-make-sure-that-every-time-we-spawn-a-tas/89-SUMMARY.md`
</output>
