---
name: qgsd:settings
description: Project manager hub — dashboard, smart routing, and configuration
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
  - Grep
---

<objective>
Guided project manager hub with state-aware dashboard and categorized action menu.

Shows project status (milestone, phase, progress, config) then routes to:
- Continue Working — smart routing based on project state (same as /qgsd:progress)
- Project Management — phases, milestones, todos, debug, roadmap
- Configuration — workflow settings, project profile, baselines, quorum agents
- Quick Task — ad-hoc tasks via /qgsd:quick

Backward compatible: /qgsd:settings --config goes directly to workflow settings (original 6-question config form).
</objective>

<execution_context>
@~/.claude/qgsd/workflows/settings.md
</execution_context>

<process>
**Follow the settings workflow** from `@~/.claude/qgsd/workflows/settings.md`.

The workflow handles all logic including:
1. Flag check (--config for backward compat)
2. Dashboard state loading via gsd-tools
3. Status dashboard display
4. Main menu presentation (4 categories)
5. Sub-menu routing and action execution
6. Original config flow (via --config or Configuration menu)
</process>
