---
name: nf:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify]"
agent: nf-planner
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---
<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn nf-planner, verify with nf-plan-checker, iterate until pass or max iterations, present results.
</objective>

<execution_context>
@~/.claude/nf/workflows/plan-phase.md
@~/.claude/nf/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop

Normalize phase input in step 2 before any directory lookups.
</context>

<pre-planning>
## Pre-Planning Impact Analysis

Before spawning the planner, run design-impact analysis on recent changes to understand which formal verification layers are affected:

```bash
node bin/design-impact.cjs --json 2>/dev/null || true
```

This three-layer git diff impact analysis traces recent changes through L1 (instrumentation), L2 (state transitions), and L3 (hazards). The output helps the planner understand which subsystems have active churn and may need more careful planning.

If the script is not found or fails, skip silently and proceed to the planning workflow (fail-open).
</pre-planning>

<process>
Execute the plan-phase workflow from @~/.claude/nf/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
