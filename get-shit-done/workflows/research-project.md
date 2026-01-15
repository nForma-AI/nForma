<purpose>
Comprehensive domain research before roadmap creation.

Answers the questions that inform quality roadmaps:
- What's the standard stack for this type of product?
- What features do users expect?
- How are these systems typically structured?
- What do projects in this domain commonly get wrong?

This research shapes the roadmap. Without it, phases are guesses based on intuition.
With it, phases reflect how experts actually build these systems.
</purpose>

<when_to_use>
**Use for:**
- Greenfield projects in established domains
- When "what features should exist" is partially unknown
- Complex integrations requiring ecosystem knowledge
- Any project where you'd research before starting

**Skip for:**
- Well-defined specs with clear scope
- Simple utilities
- Brownfield features (use research-phase instead)
</when_to_use>

<required_reading>
**Read these files NOW:**

1. ~/.claude/get-shit-done/templates/research-project/SUMMARY.md
2. ~/.claude/get-shit-done/templates/research-project/STACK.md
3. ~/.claude/get-shit-done/templates/research-project/FEATURES.md
4. ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md
5. ~/.claude/get-shit-done/templates/research-project/PITFALLS.md
6. .planning/PROJECT.md
</required_reading>

<process>

<step name="analyze_project">
Read PROJECT.md and extract:

1. **Domain**: What type of product is this?
   - Community platform, e-commerce, SaaS tool, developer tool, mobile app, game, etc.

2. **Stated stack**: Did user specify technologies?
   - If yes: research how to use that stack for this domain
   - If no: research what stack is standard for this domain

3. **Core value**: What's the one thing that must work?

4. **Requirements**: What did user explicitly request?

5. **Constraints**: Any limitations on choices?

Present analysis:
```
Domain analysis:

- Type: [inferred domain]
- Stack: [stated or "to be determined"]
- Core: [core value from PROJECT.md]
- Key requirements: [list]

Does this look right? (yes / adjust)
```
</step>

<step name="determine_research_questions">
Based on domain, generate 4 research questions:

| Dimension | Question Template |
|-----------|-------------------|
| Stack | "What's the standard 2025 stack for building [domain]?" |
| Features | "What features do [domain] products have? What's table stakes vs. differentiating?" |
| Architecture | "How are [domain] systems typically structured? What are the major components?" |
| Pitfalls | "What do [domain] projects commonly get wrong? What are the critical mistakes?" |

**Customize questions based on project specifics:**

- If stack is stated: "How do you build [domain] with [stack]? What supporting libraries?"
- If specific features mentioned: "How do experts implement [feature] in [domain]?"
- If constraints exist: "What's the best approach for [domain] given [constraint]?"

Present questions for approval:
```
Research questions:

1. Stack: [question]
2. Features: [question]
3. Architecture: [question]
4. Pitfalls: [question]

Proceed with these questions? (yes / adjust)
```
</step>

<step name="setup_directory">
Create `.planning/research/` directory before spawning agents:

```bash
mkdir -p .planning/research
```
</step>

<step name="spawn_research_agents">
Spawn 4 parallel Task agents using subagent_type: "general-purpose".

**Each agent writes its own file directly.** This enables parallel writes and keeps the orchestrator lean.

**Agent prompts (spawn all 4 in parallel):**

**1. Stack Agent:**
```
Research: [stack question from determine_research_questions]

Domain: [domain]
Project context: [summary from PROJECT.md]

Instructions:
1. Use Context7 to find relevant library documentation
2. Use WebSearch to find current best practices (2024-2025)
3. Cross-verify findings with authoritative sources
4. Focus on actionable recommendations

When complete, write your findings to: .planning/research/STACK.md

Use this template structure:
- Read ~/.claude/get-shit-done/templates/research-project/STACK.md for format
- Include specific version numbers and rationale
- Cite sources with confidence levels (HIGH/MEDIUM/LOW)
- Be specific: versions, library names, exact patterns

Constraints:
- Prefer official docs and Context7 over blog posts
- Mark anything unverified as LOW confidence
```

**2. Features Agent:**
```
Research: [features question from determine_research_questions]

Domain: [domain]
Project context: [summary from PROJECT.md]

Instructions:
1. Use Context7 to find relevant library documentation
2. Use WebSearch to find current best practices (2024-2025)
3. Cross-verify findings with authoritative sources
4. Focus on what users actually expect

When complete, write your findings to: .planning/research/FEATURES.md

Use this template structure:
- Read ~/.claude/get-shit-done/templates/research-project/FEATURES.md for format
- Categorize as table stakes / differentiators / anti-features
- Note complexity and dependencies between features
- Cite sources with confidence levels (HIGH/MEDIUM/LOW)

Constraints:
- Prefer official docs and Context7 over blog posts
- Mark anything unverified as LOW confidence
```

**3. Architecture Agent:**
```
Research: [architecture question from determine_research_questions]

Domain: [domain]
Project context: [summary from PROJECT.md]

Instructions:
1. Use Context7 to find relevant library documentation
2. Use WebSearch to find current best practices (2024-2025)
3. Cross-verify findings with authoritative sources
4. Focus on how systems are actually structured

When complete, write your findings to: .planning/research/ARCHITECTURE.md

Use this template structure:
- Read ~/.claude/get-shit-done/templates/research-project/ARCHITECTURE.md for format
- Include system diagrams (ASCII)
- Document component responsibilities and boundaries
- Cite sources with confidence levels (HIGH/MEDIUM/LOW)

Constraints:
- Prefer official docs and Context7 over blog posts
- Mark anything unverified as LOW confidence
```

**4. Pitfalls Agent:**
```
Research: [pitfalls question from determine_research_questions]

Domain: [domain]
Project context: [summary from PROJECT.md]

Instructions:
1. Use WebSearch to find post-mortems and failure cases
2. Look for community discussions about common mistakes
3. Find what experienced developers warn against
4. Focus on preventable mistakes, not edge cases

When complete, write your findings to: .planning/research/PITFALLS.md

Use this template structure:
- Read ~/.claude/get-shit-done/templates/research-project/PITFALLS.md for format
- Include warning signs and prevention strategies
- Note which phase should address each pitfall
- Cite sources with confidence levels (HIGH/MEDIUM/LOW)

Constraints:
- Prefer post-mortems and experienced developers over generic advice
- Mark anything unverified as LOW confidence
```

**Spawn all 4 agents in parallel:**

```
Spawning research agents (each writes its own file):

1. Stack research → .planning/research/STACK.md
2. Features research → .planning/research/FEATURES.md
3. Architecture research → .planning/research/ARCHITECTURE.md
4. Pitfalls research → .planning/research/PITFALLS.md

This may take 2-3 minutes...
```

Wait for all agents to complete.
</step>

<step name="write_summary">
After all agents complete, read their outputs and synthesize SUMMARY.md:

```bash
# Verify all files exist
ls .planning/research/
```

Read each file:
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md

Write `.planning/research/SUMMARY.md` using template from `templates/research-project/SUMMARY.md`:
- Executive summary synthesizing all findings
- **Critical: Include "Implications for Roadmap" section**
- Suggest phase structure based on research
- Cross-reference findings across all documents
</step>

<step name="roadmap_implications">
In SUMMARY.md, include explicit roadmap guidance:

```markdown
## Implications for Roadmap

Based on research, suggested phase structure:

1. **[Phase name]** — [rationale from research]
   - Addresses: [features from FEATURES.md]
   - Avoids: [pitfall from PITFALLS.md]

2. **[Phase name]** — [rationale from research]
   - Implements: [architecture component from ARCHITECTURE.md]
   - Uses: [stack element from STACK.md]

3. **[Phase name]** — [rationale from research]
   ...

**Phase ordering rationale:**
- [Why this order based on dependencies discovered]
- [Why this grouping based on architecture patterns]

**Research flags for phases:**
- Phase [X]: Likely needs deeper research (reason)
- Phase [Y]: Standard patterns, unlikely to need research
```

This section directly feeds into create-roadmap.
</step>

<step name="confidence_assessment">
Add confidence section to SUMMARY.md:

```markdown
## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | [HIGH/MEDIUM/LOW] | [reason - e.g., "verified with Context7"] |
| Features | [HIGH/MEDIUM/LOW] | [reason - e.g., "based on competitor analysis"] |
| Architecture | [HIGH/MEDIUM/LOW] | [reason - e.g., "standard patterns, well-documented"] |
| Pitfalls | [HIGH/MEDIUM/LOW] | [reason - e.g., "from post-mortems and community"] |

**Overall confidence:** [HIGH/MEDIUM/LOW]

**Gaps to address during planning:**
- [Any areas where research was inconclusive]
- [Topics that need phase-specific research later]
```
</step>

<step name="git_commit">
Commit research:

```bash
git add .planning/research/
git commit -m "$(cat <<'EOF'
docs: research [domain] ecosystem

Researched stack, features, architecture, and pitfalls for [project name].

Key findings:
- Stack: [one-liner]
- Architecture: [one-liner]
- Critical pitfall: [one-liner]

Ready for roadmap creation.
EOF
)"
```
</step>

<step name="present_results">
```
Research complete:

## Files Created

- .planning/research/SUMMARY.md — Executive summary + roadmap implications
- .planning/research/STACK.md — Recommended technologies
- .planning/research/FEATURES.md — Feature landscape
- .planning/research/ARCHITECTURE.md — System structure patterns
- .planning/research/PITFALLS.md — Common mistakes to avoid

## Key Findings

**Stack:** [one-liner from STACK.md]
**Architecture:** [one-liner from ARCHITECTURE.md]
**Critical pitfall:** [most important from PITFALLS.md]

## Suggested Phases

[List from SUMMARY.md Implications for Roadmap section]

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

<research_quality>
**Good research answers:**
- What specific libraries/versions to use (not just "use React")
- What features users expect (not just "add features")
- How components connect (not just "it has a backend")
- What specific mistakes to avoid (not just "be careful")

**Research is ready when:**
- Each document has specific, actionable content
- Sources are cited with confidence levels
- Roadmap implications are explicit
- A developer could start planning immediately
</research_quality>

<success_criteria>
- [ ] PROJECT.md analyzed, domain identified
- [ ] Research questions customized and approved
- [ ] .planning/research/ directory created
- [ ] 4 parallel agents spawned (each writes its own file)
- [ ] STACK.md written by stack agent
- [ ] FEATURES.md written by features agent
- [ ] ARCHITECTURE.md written by architecture agent
- [ ] PITFALLS.md written by pitfalls agent
- [ ] All agent files verified to exist
- [ ] SUMMARY.md written by orchestrator (synthesizes all)
- [ ] Confidence assessment included in SUMMARY.md
- [ ] Research committed to git
</success_criteria>
