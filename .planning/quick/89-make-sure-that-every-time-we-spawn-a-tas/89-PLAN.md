---
phase: quick-89
plan: 89
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
  - /Users/jonathanborduas/.claude/qgsd/workflows/settings.md
  - /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Every Task() block in the 6 target files has a description= parameter"
    - "The description= value is meaningful and identifies the sub-agent's purpose"
    - "The paren-tracking audit script reports zero MISSING blocks across all 6 files"
    - "Files confirmed already correct (fix-tests.md, new-project.md, new-milestone.md, quick.md, verify-work.md) are not modified"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md"
      provides: "executor Task (line ~110), inline-prose Task (line ~200), and verifier Task (line ~367) all have description="
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md"
      provides: "Pattern A prose Task (line ~69) and checkpoint_return prose (line ~281) have description="
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md"
      provides: "researcher Task (line ~44) has description="
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md"
      provides: "integration-checker Task (line ~80) has description="
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/settings.md"
      provides: "Task() reference at line ~83 has description= in the prose"
    - path: "/Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md"
      provides: "example Task block (line ~20) has description= added"
  key_links:
    - from: "execute-phase.md executor Task (~line 110)"
      to: "description= parameter"
      via: "description=\"Execute plan {plan_number}: {phase_number}-{phase_name}\""
      pattern: "description=.Execute plan"
    - from: "execute-phase.md verifier Task (~line 367)"
      to: "description= parameter"
      via: "description=\"Verify phase {phase_number}\""
      pattern: "description=.Verify phase"
    - from: "research-phase.md researcher Task (~line 44)"
      to: "description= parameter"
      via: "description=\"Research phase {phase}: {name}\""
      pattern: "description=.Research phase"
---

<objective>
Add the missing `description=` parameter to every Task() spawn call in the 6 QGSD workflow and reference files identified by the paren-tracking audit.

Purpose: The `description` parameter labels sub-agents in the Claude Code UI and activity log. Without it, spawned agents appear as anonymous tasks, making debugging harder.

Output: 6 files patched so all 9 Task() occurrences have a `description=` parameter. Files already confirmed correct (fix-tests.md, new-project.md, new-milestone.md, quick.md, verify-work.md) are NOT touched.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add description= to all 9 missing Task() locations across 6 files</name>
  <files>
    /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md
    /Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
    /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md
    /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md
    /Users/jonathanborduas/.claude/qgsd/workflows/settings.md
    /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
  </files>
  <action>
Read all 6 files first, then apply the following targeted edits.

**execute-phase.md — 3 locations:**

**1. Executor Task (around line 110):**
The Task block begins:
```
Task(
  subagent_type="qgsd-executor",
  model="{executor_model}",
  prompt="
```
Find the closing `)` of this Task block and add `description=` as the last parameter before it:
```
  model="{executor_model}",
  description="Execute plan {plan_number}: {phase_number}-{phase_name}"
)
```

**2. Inline executor prose (around line 200):**
The line reads:
```
   After quorum approves, spawn qgsd-executor Task (same prompt as quick.md Step 6).
```
This is prose text, not a code block. The audit flagged it because it contains `Task(`. Update the sentence to include a description note:
```
   After quorum approves, spawn qgsd-executor Task (description="Execute quick task {task_number}: {slug}", same prompt as quick.md Step 6).
```

**3. Verifier Task (around line 367):**
The Task block ends with:
```
  subagent_type="qgsd-verifier",
  model="{verifier_model}"
)
```
Change to:
```
  subagent_type="qgsd-verifier",
  model="{verifier_model}",
  description="Verify phase {phase_number}"
)
```

**execute-plan.md — 2 locations:**

**4. Pattern A prose (around line 69):**
The line reads:
```
**Pattern A:** init_agent_tracking → spawn Task(subagent_type="qgsd-executor", model=executor_model) with prompt: ...
```
Update to include description= in the prose example:
```
**Pattern A:** init_agent_tracking → spawn Task(subagent_type="qgsd-executor", model=executor_model, description="Execute plan {plan_number}: {phase_number}-{phase_name}") with prompt: ...
```

**5. Checkpoint return prose (around line 281):**
The line reads:
```
**Required return:** 1) Completed Tasks table (hashes + files) 2) Current Task (what's blocking) 3) Checkpoint Details (user-facing content) 4) Awaiting (what's needed from user)
```
This line does not actually contain `Task(` — the audit flagged line 281. Read the exact content at line 281 and if it contains a `Task(` reference, add `description=` to it in whatever form is appropriate (prose mention or code block). If the line at 281 is pure prose without `Task(`, check lines 279-284 for a `Task(` that starts a block and add description= to that block's closing.

**research-phase.md — 1 location:**

**6. Researcher Task (around line 44):**
The Task block ends with:
```
  subagent_type="qgsd-phase-researcher",
  model="{researcher_model}"
)
```
Change to:
```
  subagent_type="qgsd-phase-researcher",
  model="{researcher_model}",
  description="Research phase {phase}: {name}"
)
```

**audit-milestone.md — 1 location:**

**7. Integration-checker Task (around line 80):**
Find the Task block that has `subagent_type="qgsd-integration-checker"`. Add description= before the closing `)`:
```
  subagent_type="qgsd-integration-checker",
  model="{integration_checker_model}",
  description="Audit milestone: integration check"
)
```

**settings.md — 1 location:**

**8. Task() string reference (around line 83):**
The line reads:
```
      { label: "Yes", description: "Chain stages via Task() subagents (same isolation)" }
```
This is a JavaScript object property value (a string). The audit flagged it. Update the description string to mention description= so the text is accurate:
```
      { label: "Yes", description: "Chain stages via Task() subagents (description= set per agent, same isolation)" }
```

**references/model-profile-resolution.md — 1 location:**

**9. Example Task block (around line 20):**
The example is:
```
Task(
  prompt="...",
  subagent_type="qgsd-planner",
  model="{resolved_model}"  # "inherit", "sonnet", or "haiku"
)
```
Move the inline comment, add a comma after model, and add description=:
```
Task(
  prompt="...",
  subagent_type="qgsd-planner",
  model="{resolved_model}",  # "inherit", "sonnet", or "haiku"
  description="[descriptive label for this sub-agent]"
)
```

After all edits, commit all 6 files:
```bash
node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs commit "fix(workflows): add description= to all Task() spawns" \
  --files /Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md \
         /Users/jonathanborduas/.claude/qgsd/workflows/settings.md \
         /Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md
```

Then create the SUMMARY.md and update STATE.md quick tasks table.
  </action>
  <verify>
Run this paren-tracking audit script. It finds each `Task(` opening, tracks parenthesis depth to locate the full block end, and checks whether `description=` appears anywhere in that block:

```python
python3 << 'PYEOF'
import sys

TARGET_FILES = [
    '/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/research-phase.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/audit-milestone.md',
    '/Users/jonathanborduas/.claude/qgsd/workflows/settings.md',
    '/Users/jonathanborduas/.claude/qgsd/references/model-profile-resolution.md',
]

missing = []
ok = []

for path in TARGET_FILES:
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"NOT FOUND: {path}")
        continue

    i = 0
    while i < len(lines):
        line = lines[i]
        # Detect any line that contains Task( (the opening of a Task block)
        col = line.find('Task(')
        if col != -1:
            start_line = i + 1  # 1-based
            # Collect the block by tracking paren depth
            depth = 0
            block_lines = []
            j = i
            # Start depth count from the Task( occurrence
            scan_from = col
            while j < len(lines):
                scan_line = lines[j] if j > i else lines[j][scan_from:]
                for ch in scan_line:
                    if ch == '(':
                        depth += 1
                    elif ch == ')':
                        depth -= 1
                        if depth == 0:
                            break
                block_lines.append(lines[j])
                if depth == 0:
                    break
                j += 1
            block_text = ''.join(block_lines)
            if 'description=' in block_text:
                ok.append(f"OK:      {path}:{start_line}")
            else:
                missing.append(f"MISSING: {path}:{start_line}")
        i += 1

for m in missing:
    print(m)
for o in ok:
    print(o)
if not missing:
    print("PASS: all Task() blocks have description=")
else:
    print(f"FAIL: {len(missing)} Task() block(s) missing description=")
    sys.exit(1)
PYEOF
```

Expected output: all 9 blocks (across 6 files) show OK, final line is `PASS: all Task() blocks have description=`.
  </verify>
  <done>All 9 Task() occurrences across execute-phase.md (3), execute-plan.md (2), research-phase.md (1), audit-milestone.md (1), settings.md (1), and model-profile-resolution.md (1) have description= in their blocks. Paren-tracking audit exits 0. Git commit created. STATE.md quick tasks table updated with entry for task 89.</done>
</task>

</tasks>

<verification>
Run the paren-tracking Python script from the verify block above against the 6 target files. Output must show all Task() blocks as OK with zero MISSING lines. Script must exit 0.

Also confirm the 5 already-correct files are untouched (no edits to fix-tests.md, new-project.md, new-milestone.md, quick.md, verify-work.md).
</verification>

<success_criteria>
- All 9 Task() occurrences across 6 files have description= (paren-tracking audit confirms)
- Description values are meaningful identifiers, not empty strings
- Single git commit created via /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs covering all 6 edited files
- Previously-correct files (fix-tests.md, new-project.md, new-milestone.md, quick.md, verify-work.md) are not modified
- STATE.md updated with quick task 89 entry
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/89-make-sure-that-every-time-we-spawn-a-tas/89-SUMMARY.md`
</output>
