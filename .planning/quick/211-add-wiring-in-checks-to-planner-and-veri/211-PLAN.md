---
phase: quick-211
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/nf-planner.md
  - agents/nf-verifier.md
autonomous: true
formal_artifacts: none
requirements:
  - QUICK-211

must_haves:
  truths:
    - "Planner explicitly requires a wiring/consumer task when plans create new bin/ scripts, hooks, or data files"
    - "Verifier checks for orphaned producers as a dedicated verification step with structured gap output"
    - "Both agents reference the same concept (system-level consumers) consistently"
  artifacts:
    - path: "agents/nf-planner.md"
      provides: "System integration awareness in task breakdown"
      contains: "System Integration"
    - path: "agents/nf-verifier.md"
      provides: "Orphaned producer check as dedicated step"
      contains: "Orphaned Producer"
  key_links:
    - from: "agents/nf-planner.md"
      to: "agents/nf-verifier.md"
      via: "shared concept of system-level consumers"
      pattern: "system-level consumer"
---

<objective>
Add wiring-in checks to the planner and verifier agent instructions so that (1) planners explicitly plan how new features connect to the system, and (2) verifiers check that new features are actually wired into the system and not orphaned producers.

Purpose: Prevent the pattern seen in quick-207 where a new feature was created but the plan didn't explicitly address how it would be consumed by the rest of the system. The consumer integration check exists at the orchestrator level (quick.md step 6) but the agents themselves lack this awareness.

Output: Updated agents/nf-planner.md and agents/nf-verifier.md
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@agents/nf-planner.md
@agents/nf-verifier.md
@core/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add System Integration Awareness to nf-planner.md</name>
  <files>agents/nf-planner.md</files>
  <action>
Add a new subsection "## System Integration Awareness" to the `<task_breakdown>` section (after "## User Setup Detection", before the closing `</task_breakdown>` tag). This section teaches planners to detect when a plan creates new artifacts that need system-level consumers and to explicitly include wiring tasks.

Content to add:

```markdown
## System Integration Awareness

When a plan creates NEW artifacts (bin/ scripts, hooks, data files, workflows), the planner MUST identify how each artifact connects to the rest of the system.

**Detection:** Any task whose `<files>` section includes a NEW file (not modifying existing) in these directories:
- `bin/*.cjs` — CLI scripts
- `hooks/*.js` — Hook handlers
- `core/workflows/*.md` — Workflow definitions
- `commands/**/*.md` — Skill commands
- `.planning/formal/**` — Formal verification artifacts

**For each new artifact, answer:**
1. **Who calls it?** — What existing script, workflow, or command will invoke this? (e.g., `nf-solve.cjs` calls it via `spawnTool()`, or a workflow step references it)
2. **How is it called?** — What's the integration mechanism? (e.g., `require()`, `spawnTool()`, `@file` reference in a .md workflow)
3. **What if nobody calls it?** — If no existing consumer needs it, the plan MUST include a task to wire it in. An artifact with tests but no consumer is an orphaned producer.

**Rule:** If a plan creates a new bin/ script or hook, it MUST either:
- Include a task that wires it into an existing consumer (with specific `grep` verification), OR
- Document in the task action WHY it's a standalone tool invoked directly by the user (e.g., `bin/install.js` is user-invoked)

**Anti-pattern:** Plan creates `bin/analyze-foo.cjs` + `bin/analyze-foo.test.cjs` but no task adds a `spawnTool('bin/analyze-foo.cjs')` call to the script that should invoke it.

**Good pattern:** Plan has Task 1: "Create bin/analyze-foo.cjs" and Task 2: "Wire analyze-foo into nf-solve.cjs autoClose()" with verify: `grep 'analyze-foo' bin/nf-solve.cjs`
```

Also, in the `must_haves` YAML example in `<goal_backward>` (around line 539), verify the `consumers` field is already present (it is — lines 563-567). No change needed there, but the new section in task_breakdown creates the planning-time awareness that feeds into the goal-backward consumers field.
  </action>
  <verify>
grep -c "System Integration Awareness" agents/nf-planner.md should return 1.
grep -c "orphaned producer" agents/nf-planner.md should return at least 2 (one in goal_backward, one in new section).
grep -c "Who calls it" agents/nf-planner.md should return 1.
  </verify>
  <done>
nf-planner.md contains a "System Integration Awareness" subsection in task_breakdown that teaches planners to detect new artifacts needing system consumers and to plan wiring tasks explicitly.
  </done>
</task>

<task type="auto">
  <name>Task 2: Elevate Orphaned Producer Check in nf-verifier.md</name>
  <files>agents/nf-verifier.md</files>
  <action>
The verifier already has a system-level consumer check at Step 4 (Level 3b, lines 173-188), but it's buried inside artifact verification. Elevate this concern by:

1. **Add a new Step 5.5: "Verify System Integration (Orphaned Producer Check)"** between Step 5 (Key Links) and Step 6 (Requirements Coverage). This makes the check a first-class verification step rather than a sub-check of artifact verification.

Content for Step 5.5:

```markdown
## Step 5.5: Verify System Integration (Orphaned Producer Check)

For each NEW file created by this phase (not modified — created), check whether it has a system-level consumer. This catches the common failure where a feature is implemented and tested but never wired into the system.

**Scope:** New files in bin/, hooks/, commands/, core/workflows/. Skip test files, planning artifacts, and config files.

```bash
# Get new files from this phase's commits
NEW_FILES=$(git diff --name-only --diff-filter=A $(git log --oneline -20 --format=%H | tail -1)..HEAD -- 'bin/*.cjs' 'hooks/*.js' 'commands/**/*.md' 'core/workflows/*.md' | grep -v test)

for f in $NEW_FILES; do
  name=$(basename "$f" | sed 's/\.\(cjs\|js\|md\)$//')
  # Check for consumers outside of test files and planning docs
  consumers=$(grep -rl "$name" commands/ core/workflows/ bin/ hooks/ agents/ 2>/dev/null | grep -v test | grep -v ".planning/" | grep -v "$f" | wc -l)
  if [ "$consumers" -eq 0 ]; then
    echo "ORPHANED: $f — no system-level consumer found"
  fi
done
```

**Orphaned producer = verification gap.** If a new artifact has no consumer, create a gap entry:

```yaml
- truth: "New artifact {filename} is wired into the system"
  status: failed
  reason: "No system-level consumer found — artifact exists but nothing invokes it"
  artifacts:
    - path: "{filepath}"
      issue: "Orphaned producer — no script, workflow, or command references it"
  missing:
    - "Add invocation in {suggested_consumer} (e.g., spawnTool() call, require(), or @file reference)"
```

**Exception:** If the plan's must_haves.consumers section explicitly documents the consumer and the consumer verification passes, skip the orphaned check for that artifact.

**Exception:** Standalone user-invoked tools (e.g., bin/install.js) are not orphaned — they are consumed by the user directly. The plan should document this in the action text.
```

2. **Update the Step 9 (Overall Status) section** to mention that orphaned producers count as gaps:

After the existing status determination text, add:
"Orphaned producers from Step 5.5 count as gaps_found — a feature that exists but has no consumer is not achieving its goal."

3. **Update the Step 10 (Gap Output) section** to include an example gap for orphaned producers in the YAML sample if not already present.
  </action>
  <verify>
grep -c "Step 5.5" agents/nf-verifier.md should return at least 1.
grep -c "Orphaned Producer Check" agents/nf-verifier.md should return at least 1.
grep -c "ORPHANED" agents/nf-verifier.md should return at least 2 (existing + new).
grep -c "system-level consumer" agents/nf-verifier.md should return at least 2.
  </verify>
  <done>
nf-verifier.md contains a dedicated Step 5.5 that checks for orphaned producers as a first-class verification step, with structured gap output format and clear exception rules.
  </done>
</task>

</tasks>

<verification>
1. Both agents reference "system-level consumer" concept: `grep -l "system-level consumer" agents/nf-planner.md agents/nf-verifier.md` returns both files
2. Planner has the new section: `grep "System Integration Awareness" agents/nf-planner.md`
3. Verifier has the elevated check: `grep "Step 5.5" agents/nf-verifier.md`
4. No existing content was removed — only additions: `git diff --stat agents/nf-planner.md agents/nf-verifier.md` shows only additions
</verification>

<success_criteria>
- nf-planner.md teaches planners to detect new artifacts needing consumers and plan wiring tasks
- nf-verifier.md checks for orphaned producers as a dedicated step (not buried in artifact check)
- Both agents use consistent terminology ("system-level consumer", "orphaned producer")
- Existing agent functionality is preserved — only additive changes
</success_criteria>

<output>
After completion, create `.planning/quick/211-add-wiring-in-checks-to-planner-and-veri/211-SUMMARY.md`
</output>
