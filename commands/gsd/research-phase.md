---
name: gsd:research-phase
description: Research how to implement a phase before planning
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - WebFetch
  - WebSearch
  - mcp__context7__*
---

<objective>
Comprehensive research on HOW to implement a phase before planning.

This is for niche/complex domains where Claude's training data is sparse or outdated. Research discovers:
- What libraries exist for this problem
- What architecture patterns experts use
- What the standard stack looks like
- What problems people commonly hit
- What NOT to hand-roll (use existing solutions)

Output: RESEARCH.md with ecosystem knowledge that informs quality planning.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/workflows/research-phase.md
@~/.claude/get-shit-done/templates/research.md
@~/.claude/get-shit-done/references/research-pitfalls.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

**Load project state:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md

**Load requirements:**
@.planning/REQUIREMENTS.md

Extract phase requirements before research:
1. Find the phase in ROADMAP.md, get its `Requirements:` list
2. Look up each REQ-ID in REQUIREMENTS.md for full description
3. Use concrete requirements to focus research domains

**Load phase context if exists:**
Check for `.planning/phases/XX-name/{phase}-CONTEXT.md` - bonus context from discuss-phase.
</context>

<process>
1. Validate phase number argument (error if missing or invalid)
2. Check if phase exists in roadmap - extract phase description
3. Check if RESEARCH.md already exists (offer to update or use existing)
4. Load CONTEXT.md if it exists (bonus context for research direction)
5. Follow research-phase.md workflow:
   - Analyze phase to identify knowledge gaps
   - Determine research domains (architecture, ecosystem, patterns, pitfalls)
   - Execute comprehensive research via Context7, official docs, WebSearch
   - Cross-verify all findings
   - Create RESEARCH.md with actionable ecosystem knowledge
6. Offer next steps (plan the phase)
</process>


<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Domain/ecosystem identified from phase description
- [ ] Comprehensive research executed (Context7 + official docs + WebSearch)
- [ ] All WebSearch findings cross-verified with authoritative sources
- [ ] RESEARCH.md created with ecosystem knowledge
- [ ] Standard stack/libraries identified
- [ ] Architecture patterns documented
- [ ] Common pitfalls catalogued
- [ ] What NOT to hand-roll is clear
- [ ] User knows next steps (plan phase)
</success_criteria>
