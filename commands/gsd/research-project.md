---
name: gsd:research-project
description: Research domain ecosystem before creating roadmap
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Research domain ecosystem. Spawns 4 parallel gsd-researcher agents for comprehensive coverage.

**Orchestrator role:** Analyze project, generate research questions, spawn 4 parallel agents, synthesize SUMMARY.md.

**Why subagents:** Research burns context fast. Fresh 200k context per domain. Main context stays lean.
</objective>

<context>
@.planning/PROJECT.md
@.planning/config.json (if exists)
</context>

<process>

## 1. Validate Prerequisites

```bash
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md. Run /gsd:new-project first."; exit 1; }
[ -f .planning/ROADMAP.md ] && echo "WARNING: ROADMAP.md exists. Research is typically done before roadmap."
[ -d .planning/research ] && echo "RESEARCH_EXISTS" || echo "NO_RESEARCH"
```

## 2. Handle Existing Research

**If RESEARCH_EXISTS:** Use AskUserQuestion (View existing / Replace / Cancel)

## 3. Analyze Project

Read PROJECT.md, extract domain/stack/core value/constraints. Present for approval:
```
Domain analysis:
- Type: [domain]
- Stack: [stated or TBD]
- Core: [core value]
Does this look right? (yes / adjust)
```

## 4. Generate Research Questions

| Dimension | Question |
|-----------|----------|
| Stack | "What's the standard 2025 stack for [domain]?" |
| Features | "What features do [domain] products have?" |
| Architecture | "How are [domain] systems structured?" |
| Pitfalls | "What do [domain] projects get wrong?" |

Present for approval.

## 5. Spawn Research Agents

```bash
mkdir -p .planning/research
```

Spawn all 4 in parallel:

```
Task(prompt="Research stack for [domain]. Question: [question]. Context: [PROJECT.md summary].
Write to: .planning/research/STACK.md. Use template from ~/.claude/get-shit-done/templates/research-project/STACK.md",
subagent_type="gsd-researcher", description="Stack research")

Task(prompt="Research features for [domain]. Question: [question]. Context: [PROJECT.md summary].
Write to: .planning/research/FEATURES.md. Use template from ~/.claude/get-shit-done/templates/research-project/FEATURES.md",
subagent_type="gsd-researcher", description="Features research")

Task(prompt="Research architecture for [domain]. Question: [question]. Context: [PROJECT.md summary].
Write to: .planning/research/ARCHITECTURE.md. Use template from ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md",
subagent_type="gsd-researcher", description="Architecture research")

Task(prompt="Research pitfalls for [domain]. Question: [question]. Context: [PROJECT.md summary].
Write to: .planning/research/PITFALLS.md. Use template from ~/.claude/get-shit-done/templates/research-project/PITFALLS.md",
subagent_type="gsd-researcher", description="Pitfalls research")
```

**Announce:** "Spawning 4 research agents... may take 2-3 minutes."

## 6. Synthesize Results

After all agents complete, read their outputs and write `.planning/research/SUMMARY.md`:
- Read template: `~/.claude/get-shit-done/templates/research-project/SUMMARY.md`
- Synthesize executive summary from all 4 files
- Include "Implications for Roadmap" with suggested phase structure
- Add confidence assessment

## 7. Commit Research

```bash
git add .planning/research/
git commit -m "docs: research [domain] ecosystem

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]"
```

## 8. Present Results

```
Research complete:

Files: SUMMARY.md, STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]

---
## > Next Up
**Define requirements** - `/gsd:define-requirements`
<sub>`/clear` first</sub>
---
```

</process>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] Domain identified and approved
- [ ] 4 gsd-researcher agents spawned in parallel
- [ ] All research files created
- [ ] SUMMARY.md synthesized with roadmap implications
- [ ] Research committed
</success_criteria>
