---
name: gsd:research-project
description: Research domain ecosystem before creating roadmap
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - WebSearch
  - mcp__context7__*
---

<objective>
Comprehensive domain research before roadmap creation.

Answers the questions that inform quality roadmaps:
- What's the standard stack for this type of product?
- What features do users expect?
- How are these systems typically structured?
- What do projects in this domain commonly get wrong?

Run after `/gsd:new-project`, before `/gsd:define-requirements`.

Output: `.planning/research/` folder with ecosystem knowledge.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/workflows/research-project.md
@~/.claude/get-shit-done/templates/research-project/SUMMARY.md
@~/.claude/get-shit-done/templates/research-project/STACK.md
@~/.claude/get-shit-done/templates/research-project/FEATURES.md
@~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
@~/.claude/get-shit-done/templates/research-project/PITFALLS.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/config.json (if exists)
</context>

<process>

<step name="validate">
```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }

# Check if roadmap already exists
[ -f .planning/ROADMAP.md ] && echo "WARNING: ROADMAP.md already exists. Research is typically done before roadmap creation."

# Check if research already exists
[ -d .planning/research ] && echo "RESEARCH_EXISTS" || echo "NO_RESEARCH"
```
</step>

<step name="check_existing">
**If RESEARCH_EXISTS:**

Use AskUserQuestion:
- header: "Research exists"
- question: "Research folder already exists. What would you like to do?"
- options:
  - "View existing" — Show current research summary
  - "Replace" — Run fresh research (will overwrite)
  - "Cancel" — Keep existing research

If "View existing": Read and display `.planning/research/SUMMARY.md`, then exit
If "Cancel": Exit
If "Replace": Continue with workflow
</step>

<step name="execute_research">
Follow the research-project.md workflow:
- Analyze PROJECT.md to determine domain
- Identify research questions based on domain
- Spawn parallel research agents
- Aggregate results into `.planning/research/`
- Create SUMMARY.md with roadmap implications
</step>

<step name="done">
```
Research complete:

- Summary: .planning/research/SUMMARY.md
- Stack: .planning/research/STACK.md
- Features: .planning/research/FEATURES.md
- Architecture: .planning/research/ARCHITECTURE.md
- Pitfalls: .planning/research/PITFALLS.md

---

## ▶ Next Up

Choose your path:

**Option A: Define requirements first** (recommended)
Scope your v1 from research findings. Transforms "what exists" into "what we're building" with checkable requirements.

`/gsd:define-requirements`

**Option B: Create roadmap directly**
Skip requirements if scope is already clear from research.

`/gsd:create-roadmap`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<when_to_use>
**Use research-project for:**
- Greenfield projects in established domains (community, e-commerce, SaaS)
- When "what features should exist" is partially unknown
- Complex integrations requiring ecosystem knowledge
- Domains where best practices matter (auth, payments, real-time)
- Any project where you'd Google "how to build a [X]" before starting

**Skip research-project for:**
- Well-defined specs ("build exactly this API")
- Simple tools/utilities with clear scope
- Adding features to existing codebases (use research-phase instead)
- Domains you've built in many times before
</when_to_use>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] Domain identified from project description
- [ ] Research questions determined and approved
- [ ] Parallel research agents spawned
- [ ] All research documents created in .planning/research/
- [ ] SUMMARY.md includes roadmap implications
- [ ] Research committed to git
- [ ] User knows next step (define-requirements)
</success_criteria>
