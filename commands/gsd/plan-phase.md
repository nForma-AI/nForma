---
name: gsd:plan-phase
description: Create detailed execution plan for a phase (PLAN.md) with verification loop
argument-hint: "[phase] [--gaps] [--skip-verify]"
agent: gsd-planner
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
Create executable phase prompts (PLAN.md files) for a roadmap phase.

**Orchestrator role:** Parse arguments, validate phase, gather context paths, spawn gsd-planner agent, present results.

**Why subagent:** Planning burns context fast (reading codebase, building dependency graphs, breaking down tasks). Fresh 200k context for planning. Main context stays lean for user interaction.
</objective>

<context>
Phase number: $ARGUMENTS (optional - auto-detects next unplanned phase if not provided)
Gap closure mode: `--gaps` flag triggers gap closure workflow

Check for existing plans:

```bash
ls .planning/phases/${PHASE}-*/*-PLAN.md 2>/dev/null
```

</context>

<process>

## 1. Validate Environment

```bash
ls .planning/ 2>/dev/null
```

**If not found:** Error - user should run `/gsd:new-project` first.

## 2. Parse Arguments

Extract from $ARGUMENTS:

- Phase number (integer or decimal like `2.1`)
- `--gaps` flag for gap closure mode

**If no phase number:** Detect next unplanned phase from roadmap.

## 3. Validate Phase

```bash
grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md 2>/dev/null
```

**If not found:** Error with available phases. **If found:** Extract phase number, name, description.

## 4. Check Existing Plans

```bash
ls .planning/phases/${PHASE}-*/*-PLAN.md 2>/dev/null
```

**If exists:** Offer: 1) Continue planning, 2) View existing, 3) Replan. Wait for response.

## 5. Gather Context Paths

Identify context files for the agent:

```bash
# Required
STATE=.planning/STATE.md
ROADMAP=.planning/ROADMAP.md
REQUIREMENTS=.planning/REQUIREMENTS.md

# Optional
PHASE_DIR=$(ls -d .planning/phases/${PHASE}-* 2>/dev/null | head -1)
CONTEXT="${PHASE_DIR}/${PHASE}-CONTEXT.md"
RESEARCH="${PHASE_DIR}/${PHASE}-RESEARCH.md"
VERIFICATION="${PHASE_DIR}/${PHASE}-VERIFICATION.md"
UAT="${PHASE_DIR}/${PHASE}-UAT.md"
```

## 6. Spawn gsd-planner Agent

Fill prompt and spawn:

```markdown
<planning_context>

**Phase:** {phase_number}
**Mode:** {standard | gap_closure}

**Project State:**
@.planning/STATE.md

**Roadmap:**
@.planning/ROADMAP.md

**Requirements (if exists):**
@.planning/REQUIREMENTS.md

**Phase Context (if exists):**
@.planning/phases/{phase_dir}/{phase}-CONTEXT.md

**Research (if exists):**
@.planning/phases/{phase_dir}/{phase}-RESEARCH.md

**Gap Closure (if --gaps mode):**
@.planning/phases/{phase_dir}/{phase}-VERIFICATION.md
@.planning/phases/{phase_dir}/{phase}-UAT.md

</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase or /gsd:execute-plan
Plans must be executable prompts with:

- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
  </downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
      </quality_gate>
```

```
Task(
  prompt=filled_prompt,
  subagent_type="gsd-planner",
  description="Plan Phase {phase}"
)
```

## 7. Handle Agent Return

**`## PLANNING COMPLETE`:** Display summary, offer: Execute phase, Review plans, Adjust, Done.

**`## CHECKPOINT REACHED`:** Present to user, get response, spawn continuation.

**`## PLANNING INCONCLUSIVE`:** Show what was attempted, offer: Add context, Retry, Manual.

## 8. Spawn Continuation Agent

```markdown
<objective>
Continue planning for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Phase directory: @.planning/phases/{phase_dir}/
Existing plans: @.planning/phases/{phase_dir}/\*-PLAN.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-planner",
  description="Continue planning Phase {phase}"
)
```

</process>

<success_criteria>

- [ ] .planning/ directory validated
- [ ] Phase validated against roadmap
- [ ] Existing plans checked
- [ ] gsd-planner spawned with context
- [ ] Checkpoints handled correctly
- [ ] User knows next steps (execute or review)
      </success_criteria>
