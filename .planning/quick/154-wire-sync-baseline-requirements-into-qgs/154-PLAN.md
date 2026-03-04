---
phase: quick-154
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/qgsd/sync-baselines.md
  - qgsd-core/workflows/new-milestone.md
  - qgsd-core/workflows/new-project.md
autonomous: true
requirements: [QUICK-154]
formal_artifacts: none

must_haves:
  truths:
    - "Running /qgsd:sync-baselines reads profile from config or --profile flag and executes node bin/sync-baseline-requirements.cjs, displaying added/skipped counts"
    - "The sync-baselines skill commits .formal/requirements.json when requirements are added"
    - "The new-milestone workflow syncs baselines into .formal/requirements.json after Step 8.6 baseline loading"
    - "The new-project workflow syncs baselines into .formal/requirements.json after Step 7 requirements definition"
  artifacts:
    - path: "commands/qgsd/sync-baselines.md"
      provides: "/qgsd:sync-baselines command skill"
      contains: "sync-baseline-requirements.cjs"
      min_lines: 30
    - path: "qgsd-core/workflows/new-milestone.md"
      provides: "Baseline sync step after 8.6"
      contains: "sync-baseline-requirements.cjs"
    - path: "qgsd-core/workflows/new-project.md"
      provides: "Baseline sync step after Step 7"
      contains: "sync-baseline-requirements.cjs"
  key_links:
    - from: "commands/qgsd/sync-baselines.md"
      to: "bin/sync-baseline-requirements.cjs"
      via: "node bin/sync-baseline-requirements.cjs --profile"
      pattern: "sync-baseline-requirements"
    - from: "qgsd-core/workflows/new-milestone.md"
      to: "bin/sync-baseline-requirements.cjs"
      via: "node bin/sync-baseline-requirements.cjs --profile"
      pattern: "sync-baseline-requirements"
    - from: "qgsd-core/workflows/new-project.md"
      to: "bin/sync-baseline-requirements.cjs"
      via: "node bin/sync-baseline-requirements.cjs --profile"
      pattern: "sync-baseline-requirements"
---

<objective>
Wire `bin/sync-baseline-requirements.cjs` (built in quick-153) into QGSD by creating a standalone `/qgsd:sync-baselines` skill and adding sync calls to the new-milestone and new-project workflows.

Purpose: After quick-153 created the sync tool, it needs to be invocable as a QGSD command and automatically called during project/milestone initialization so baseline requirements flow into `.formal/requirements.json` without manual intervention.

Output: 1 new skill file, 2 workflow file edits -- all markdown, no JS changes.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/qgsd/add-requirement.md
@bin/sync-baseline-requirements.cjs
@qgsd-core/workflows/new-milestone.md
@qgsd-core/workflows/new-project.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /qgsd:sync-baselines skill</name>
  <files>commands/qgsd/sync-baselines.md</files>
  <action>
Create `commands/qgsd/sync-baselines.md` following the same frontmatter pattern as `commands/qgsd/add-requirement.md`.

**Frontmatter:**
```yaml
---
name: qgsd:sync-baselines
description: Sync baseline requirements into .formal/requirements.json (idempotent merge by text match)
argument-hint: [--profile <web|mobile|desktop|api|cli|library>]
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
```

**Body structure:**

1. `<objective>` -- Sync baseline requirements from the QGSD defaults into `.formal/requirements.json`. Reads the project profile from `.planning/config.json` (field: `profile`) unless `--profile` flag is provided. Runs `node bin/sync-baseline-requirements.cjs`, displays results, and commits if requirements were added.

2. `<process>` section with these steps:

   **Step 1: Determine profile**
   - Parse `--profile` from $ARGUMENTS if present
   - Otherwise read `.planning/config.json` and extract the `profile` field
   - If neither available, ask user via AskUserQuestion with options: web, mobile, desktop, api, cli, library
   - Store as `$PROFILE`

   **Step 2: Run sync**
   ```bash
   node bin/sync-baseline-requirements.cjs --profile "$PROFILE" --json
   ```
   Parse the JSON output. Display a human-readable summary:
   ```
   Baseline sync complete ($PROFILE profile)
     Added:   N new requirements
     Skipped: M (already present)
     Total:   K requirements
   ```
   If added > 0, list each added requirement: `  + [ID] text`

   **Step 3: Commit if needed**
   If `added.length > 0`:
   ```bash
   node ~/.claude/qgsd/bin/gsd-tools.cjs commit "req(baseline): sync N baseline requirements" --files .formal/requirements.json
   ```
   Where N is the count of added requirements.

   If `added.length === 0`: display "No new requirements to sync -- .formal/requirements.json is up to date."

3. `<success_criteria>` -- sync-baseline-requirements ran without error, results displayed, .formal/requirements.json committed if changed.
  </action>
  <verify>
    1. `test -f commands/qgsd/sync-baselines.md && echo "exists"` -- prints "exists"
    2. `head -5 commands/qgsd/sync-baselines.md` -- shows frontmatter with `name: qgsd:sync-baselines`
    3. `grep -c 'sync-baseline-requirements.cjs' commands/qgsd/sync-baselines.md` -- at least 2 occurrences (run + commit context)
  </verify>
  <done>
    commands/qgsd/sync-baselines.md exists with proper frontmatter (name, description, argument-hint, allowed-tools), process steps covering profile resolution, sync execution with --json, human-readable output, and conditional git commit of .formal/requirements.json.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire sync into new-milestone and new-project workflows</name>
  <files>qgsd-core/workflows/new-milestone.md, qgsd-core/workflows/new-project.md</files>
  <action>
**Edit 1: new-milestone.md -- Add Step 8.7 after Step 8.6 (Load Baseline Requirements)**

After the existing Step 8.6 content (which ends with "Present for opt-out with multiSelect per category."), insert a new section:

```markdown
## 8.7. Sync Baselines into Formal Envelope

After baseline requirements are loaded/confirmed in Step 8.6, sync them into `.formal/requirements.json`:

\```bash
node bin/sync-baseline-requirements.cjs --profile "$PROJECT_PROFILE"
\```

This is idempotent -- if baselines were already synced in a previous milestone, they will be skipped. Display the sync summary (added/skipped counts).

If any requirements were added, include `.formal/requirements.json` in the next commit (Step 9 requirements commit or Step 6 cleanup commit, whichever comes next).
```

Insert this BEFORE the existing `## 9. Define Requirements` section. Do NOT renumber Step 9 or later steps.

**Edit 2: new-project.md -- Add Step 7.1 after Step 7 (Define Requirements) commit**

In Step 7, after the requirements commit block:
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs: define v1 requirements" --files .planning/REQUIREMENTS.md
```

Insert a new sub-step:

```markdown
**Sync baselines into formal envelope:**

After REQUIREMENTS.md is committed, sync baseline requirements into `.formal/requirements.json`:

\```bash
node bin/sync-baseline-requirements.cjs --profile "$PROJECT_PROFILE"
\```

This merges baseline requirements into the formal envelope with idempotent text matching. Display the sync summary.

If any requirements were added, commit:

\```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "req(baseline): sync baseline requirements into formal envelope" --files .formal/requirements.json
\```
```

Insert this BEFORE the `## 8. Create Roadmap` section. Do NOT renumber any steps.

**Important:** Use the Edit tool for both changes. Preserve all existing content -- only insert new sections at the specified locations.
  </action>
  <verify>
    1. `grep -c 'sync-baseline-requirements.cjs' qgsd-core/workflows/new-milestone.md` -- at least 1 (the new Step 8.7)
    2. `grep -c 'sync-baseline-requirements.cjs' qgsd-core/workflows/new-project.md` -- at least 1 (the new sync step)
    3. `grep '## 8.7' qgsd-core/workflows/new-milestone.md` -- finds the new section header
    4. `grep 'Sync baselines into formal envelope' qgsd-core/workflows/new-project.md` -- finds the new sub-step
    5. `grep '## 9\. Define Requirements' qgsd-core/workflows/new-milestone.md` -- Step 9 still exists (not broken)
    6. `grep '## 8\. Create Roadmap' qgsd-core/workflows/new-project.md` -- Step 8 still exists (not broken)
  </verify>
  <done>
    new-milestone.md has Step 8.7 (Sync Baselines into Formal Envelope) between Steps 8.6 and 9. new-project.md has a baseline sync sub-step after the REQUIREMENTS.md commit in Step 7, before Step 8 (Create Roadmap). Both reference `node bin/sync-baseline-requirements.cjs --profile "$PROJECT_PROFILE"` and include conditional commits for .formal/requirements.json. No existing steps were renumbered or removed.
  </done>
</task>

</tasks>

<verification>
1. `test -f commands/qgsd/sync-baselines.md` -- skill file exists
2. `grep 'sync-baseline-requirements.cjs' commands/qgsd/sync-baselines.md qgsd-core/workflows/new-milestone.md qgsd-core/workflows/new-project.md | wc -l` -- at least 4 matches across the 3 files
3. All 3 files are valid markdown with no broken structure
4. Existing step numbering in both workflows is preserved
</verification>

<success_criteria>
- /qgsd:sync-baselines skill exists at commands/qgsd/sync-baselines.md with proper frontmatter and process steps
- new-milestone.md has Step 8.7 calling sync-baseline-requirements.cjs after baseline loading
- new-project.md has a sync step after REQUIREMENTS.md commit calling sync-baseline-requirements.cjs
- All sync calls use `--profile "$PROJECT_PROFILE"` for consistency
- Conditional commits only fire when requirements are actually added
- No existing workflow steps are renumbered, removed, or broken
</success_criteria>

<output>
After completion, create `.planning/quick/154-wire-sync-baseline-requirements-into-qgs/154-SUMMARY.md`
</output>
