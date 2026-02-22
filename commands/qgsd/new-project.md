---
name: qgsd:new-project
description: Initialize a new project with deep context gathering and PROJECT.md
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<context>
**Flags:**
- `--auto` — Automatic mode. After config questions, runs research → requirements → roadmap without further interaction. Expects idea document via @ reference.
</context>

<objective>
Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**
- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

**After this command:** Run `/qgsd:plan-phase 1` to start execution.
</objective>

<execution_context>
@~/.claude/qgsd/workflows/new-project.md
@~/.claude/qgsd/references/questioning.md
@~/.claude/qgsd/references/ui-brand.md
@~/.claude/qgsd/templates/project.md
@~/.claude/qgsd/templates/requirements.md
</execution_context>

<process>
Execute the new-project workflow from @~/.claude/qgsd/workflows/new-project.md end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
</process>
