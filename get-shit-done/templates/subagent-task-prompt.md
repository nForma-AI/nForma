# Subagent Task Prompt Template

Template for spawning plan execution subagents from execute-phase orchestrator.

---

## Template

```markdown
<objective>
Execute plan {plan_number} of phase {phase_number}-{phase_name}.

Commit each task atomically. Create SUMMARY.md. Update STATE.md.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
@~/.claude/get-shit-done/references/checkpoints.md
@~/.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
Plan: @{plan_path}
Project state: @.planning/STATE.md
Config: @.planning/config.json (if exists)
</context>

<success_criteria>
- [ ] All tasks executed
- [ ] Each task committed individually
- [ ] SUMMARY.md created in plan directory
- [ ] STATE.md updated with position and decisions
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{phase_number}` | Phase directory name | `01` |
| `{phase_name}` | Phase directory name | `foundation` |
| `{plan_number}` | Plan filename | `01` |
| `{plan_path}` | Full path to PLAN.md | `.planning/phases/01-foundation/01-01-PLAN.md` |

---

## Usage

Orchestrator fills placeholders and passes to Task tool:

```python
Task(
    prompt=filled_template,
    subagent_type="general-purpose"
)
```

Subagent reads @-references, loads full workflow context, executes plan.
