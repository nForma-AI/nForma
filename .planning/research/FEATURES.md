# Feature Research

**Domain:** Session intelligence and friction reduction patterns in AI coding assistants (Claude Code plugin)
**Milestone:** v0.40 — Session Intelligence & Friction Reduction
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH (hook patterns verified via official Claude Code docs + community; AI orchestration patterns cross-referenced from multiple credible sources)

---

## Context: What Already Exists

nForma already ships:
- `nf-prompt.js` (UserPromptSubmit hook): circuit breaker recovery injection, pending-task injection, quorum instruction injection
- `nf-stop.js` (Stop hook): quorum verification gate — reads transcript, blocks on missing quorum
- `nf-circuit-breaker.js` (PreToolUse hook): oscillation detection from git history
- `quick.md` workflow: planner spawn → plan-checker loop → quorum review → executor

The 6 v0.40 features extend this infrastructure without replacing it. They are additive to existing hooks and workflows.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that competent AI assistant orchestration frameworks provide. Missing these makes the tool feel half-finished or unreliable.

| Feature | Why Expected | Complexity | Infrastructure Dependency | Notes |
|---------|--------------|------------|---------------------------|-------|
| Session state injection (STATE.md on first message) | Without this, every new session starts blind — the AI doesn't know current milestone, blockers, or last activity. Context amnesia is the #1 friction in AI coding workflows per Addy Osmani's 2026 analysis. | LOW | `nf-prompt.js` already has `additionalContext` injection pathway; `session_state.json` or `current-activity.json` already tracked | First-message detection is the only new logic required; STATE.md parsing is trivial |
| Root cause template injection for debug/fix prompts | AI assistants default to surface-level pattern matching ("fix the error") rather than causal analysis ("understand why"). Structured prompting before quorum dispatch is standard in all production agentic frameworks. | LOW | `nf-prompt.js` already classifies prompt intent via `taskClassifier`; debug/fix pattern detection is an extension of existing regex matching | Template must be compact — context budget is shared with quorum instructions |
| Approach declaration before planner spawn | Expert practitioners universally require declaring WHAT, WHY, and WHAT-NOT before planning begins (Addy Osmani, Martin Fowler's context engineering). Without this, planners interpret scope too broadly and produce over-engineered plans. | MEDIUM | `quick.md` planner spawn (Step 5) is the injection point; requires adding a structured declaration step between description collection and planner Task call | Complexity is in enforcing the gate without adding dialog burden — declaration should be derivable from description with minimal user friction |
| Constraint injection for edit/content prompts | AI assistants default to creating new files when edits are requested. Edit-in-place default is expected behavior in mature coding assistants; it reduces unintended file proliferation. | LOW | `nf-prompt.js` intent classification already exists; adding an edit constraint to `additionalContext` is 5-10 lines | Must fire only on detected edit intent, not on all prompts |

### Differentiators (Competitive Advantage)

Features that align with nForma's core value (structural enforcement over policy) and distinguish it from basic context injection approaches.

| Feature | Value Proposition | Complexity | Infrastructure Dependency | Notes |
|---------|-------------------|------------|---------------------------|-------|
| Root cause quorum vote in solve-diagnose.md (before remediation dispatch) | Quorum on diagnosis — not just on solutions — prevents the most expensive failure mode: acting on the wrong root cause. No other AI coding plugin enforces multi-model consensus at the diagnosis stage. This extends nForma's structural enforcement identity into the diagnostic phase. | MEDIUM | `solve-diagnose.md` workflow must add a pre-dispatch quorum vote step; requires `quorum-dispatch.md` protocol integration; `nf-prompt.js` root cause template injection feeds the input to this vote | Deliberation is on the diagnosis hypothesis, not the fix — keeps scope narrow |
| Branch scope guard hook (PreToolUse:Edit/Write warning for out-of-scope files) | Structural enforcement of file edit scope. When on a feature branch, edits to files outside the declared scope of the current plan are warned or blocked. Prevents the drift pattern where AI expands edits beyond the stated task. This is structural enforcement (hook) vs behavioral policy (CLAUDE.md instructions that get ignored). | HIGH | New PreToolUse hook or extension of `nf-circuit-breaker.js`; requires reading the current plan's `files:` field to determine in-scope set; needs current-activity.json to know which plan is active | HIGH complexity because: parsing plan files at hook time is expensive, scope is hard to define precisely, false positives kill trust. Fail-open is critical. Must be a warning (not block) for v1. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-turn STATE.md injection (every message) | "The AI should always know the project state" | Context budget erosion — STATE.md at ~60 lines consumes meaningful tokens every turn. At 50 turns per session, this adds 3,000+ tokens of repeated context with diminishing returns. "Build context gradually, not all at once" per Martin Fowler's context engineering research. | Inject only on first message of session (session detection via `session_id` from Claude Code hook payload) |
| Hard-blocking branch scope guard (exit code 2) | "Enforce scope strictly" | False positive rate for file scope detection is high: plans don't always enumerate all touched files, indirect dependencies (test files, config) are legitimately out-of-plan-scope but necessary. A block on the wrong file destroys workflow trust. Community consensus: hooks that block create "zero tolerance for friction that doesn't pay for itself." | Warning-only for v1 (inject context, exit 0); measure false positive rate before promoting to hard block |
| Approach declaration as AskUserQuestion dialog | "Structured input produces better output" | Three-prompt dialog before task start adds 2-3 round-trips. Research shows this creates "paralysis from over-customization" — users start bypassing the workflow. | Derive APPROACH/NOT-DOING/SCOPE from description automatically (Haiku classification), ask only when ambiguous. Show as compact inline declaration, not a modal gate. |
| Root cause injection on ALL prompts | "Always think causally" | Template injection on non-debug/fix prompts (e.g., "add a feature", "write a test") is noise that degrades instruction quality. Context window poisoning — injecting irrelevant guardrails into unrelated prompts — is a recognized failure mode in AI assistant orchestration. | Pattern-detect debug/fix intent: `fix`, `error`, `bug`, `failing`, `broken`, `why is`, `debug`, `crash`, `exception` trigger injection; `add`, `implement`, `write`, `create` do not |
| Quorum vote on every debug session | "All decisions need quorum" | Root cause quorum adds 30-90 seconds per diagnosis. For simple bugs (typos, obvious config errors), this is pure overhead with no signal. | Gate the quorum vote on complexity signals: bug crosses multiple files, has no obvious single cause, or is flagged by the `taskClassifier` as COMPLEX. Simple bugs skip quorum and proceed. |

---

## Feature Dependencies

```
Session state injection (nf-prompt.js)
    └──enables──> Approach declaration gate (quick.md)
                      (state injection gives planner the project context
                       that makes the declaration meaningful)

Root cause template injection (nf-prompt.js)
    └──feeds──> Root cause quorum vote (solve-diagnose.md)
                    (template structures the diagnosis hypothesis
                     that quorum votes on)

Approach declaration gate (quick.md)
    └──feeds──> Branch scope guard hook (PreToolUse)
                    (declared scope/files list is what the guard
                     checks against)

Constraint injection (nf-prompt.js)
    ──independent──> (no dependencies; pure context injection)

Root cause template injection (nf-prompt.js)
    ──independent-of──> Session state injection (nf-prompt.js)
    (both live in same hook but different trigger conditions)
```

### Dependency Notes

- **Session state injection enables approach declaration gate:** The approach declaration in `quick.md` asks the planner to declare scope relative to current project state. Without session state injection already priming the project context, the declaration step has less grounding. Build session injection first.
- **Root cause template injection feeds root cause quorum vote:** The quorum vote in `solve-diagnose.md` needs a structured hypothesis to vote on. The template injection in `nf-prompt.js` produces that structure. Build template injection before the quorum vote step.
- **Approach declaration feeds branch scope guard:** The scope guard needs a file list to check against. That list comes from the plan produced by the approach-declaration-gated planner. Without approach declaration, scope guard has nothing reliable to compare against.
- **Constraint injection is independent:** Pure `additionalContext` injection in `nf-prompt.js`. No dependencies on other v0.40 features. Can be built in any order.

---

## MVP Definition

### Launch With (v1 — all 6 features for v0.40)

These are the stated milestone goals. All 6 are required for v0.40 completion.

- [ ] Session state injection — why essential: eliminates context amnesia, lowest complexity, highest frequency impact (fires on every session start)
- [ ] Constraint injection for edit prompts — why essential: eliminates file proliferation, lowest complexity, high frequency impact
- [ ] Root cause template injection — why essential: structural enforcement of causal reasoning; feeds the quorum vote feature
- [ ] Approach declaration gate in quick.md — why essential: prevents scope-too-broad planning; medium complexity
- [ ] Root cause quorum vote in solve-diagnose.md — why essential: extends quorum enforcement identity to diagnosis layer
- [ ] Branch scope guard hook — why essential: structural (hook) vs behavioral (CLAUDE.md) enforcement of edit scope

### Build Order (dependency-driven)

1. Session state injection + Constraint injection (both in `nf-prompt.js`, independent, low complexity)
2. Root cause template injection (in `nf-prompt.js`, builds on session detection patterns from #1)
3. Approach declaration gate (in `quick.md`, builds on session injection context)
4. Root cause quorum vote (in `solve-diagnose.md`, requires template injection from #2)
5. Branch scope guard hook (requires approach declaration scope list from #3, highest complexity last)

### Defer to Future Milestones

- [ ] Per-turn state injection — context budget concern, first-message injection satisfies the use case
- [ ] Hard-blocking scope guard — false positive risk; warning-first, promote later with data
- [ ] Quorum vote on every debug session — complexity filter needed first

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session state injection | HIGH — fires every session | LOW — ~20 lines in nf-prompt.js | P1 |
| Constraint injection for edit prompts | HIGH — high frequency, prevents proliferation | LOW — ~10 lines in nf-prompt.js | P1 |
| Root cause template injection | HIGH — changes debug behavior structurally | LOW — ~30 lines in nf-prompt.js | P1 |
| Approach declaration gate | HIGH — prevents wrong-scope plans | MEDIUM — new workflow step in quick.md | P1 |
| Root cause quorum vote | MEDIUM — extends quorum identity, less frequent | MEDIUM — new step in solve-diagnose.md + quorum dispatch | P2 |
| Branch scope guard hook | MEDIUM — catch out-of-scope edits | HIGH — plan parsing at hook time, scope ambiguity | P2 |

**Priority key:**
- P1: Must have for launch (v0.40)
- P2: Should have (v0.40, build after P1s)
- P3: Defer (not in v0.40)

---

## Effectiveness vs. Annoyance Analysis

Research from Claude Code community (dev.to/mikelane, eesel.ai hooks guide) and context engineering literature (Martin Fowler, Addy Osmani) converges on these principles for hook-based enforcement:

### What Makes These Mechanisms Effective

1. **Single-trigger, not every-turn**: Session state injection fires once (first message). Root cause template fires only on debug/fix intent. This prevents context budget erosion and notification fatigue.

2. **Context over blocking**: Where possible, inject guidance (exit 0 with `additionalContext`) rather than hard-block. The branch scope guard should warn first, block never in v1. Hard blocks are reserved for provably-destructive operations only (existing circuit breaker pattern already demonstrates this).

3. **Structured output from templates**: The root cause template injection creates a hypothesis structure (OBSERVED BEHAVIOR / EXPECTED BEHAVIOR / HYPOTHESIS / WHAT NOT TO ASSUME) that quorum workers can evaluate. Unstructured "think about root cause" instructions are lower signal.

4. **Fail-open everything**: All 6 features must fail-open. Hook crashes, file-not-found, parse errors — never block Claude from responding. This is the existing nForma pattern and must be preserved.

5. **Approach declaration compact, not modal**: The gate in `quick.md` should derive APPROACH/NOT-DOING/SCOPE from the existing `$DESCRIPTION` via Haiku classification, display compactly for user confirmation, and inject into planner prompt. Three-dialog AskUserQuestion flows create friction that users learn to skip.

### What Makes These Mechanisms Annoying/Noisy

1. **Per-turn repetition**: STATE.md injected every message. Template injected on non-debug prompts. Users see the same boilerplate dozens of times.

2. **False-positive blocking**: Scope guard blocking edits to test files or config because they weren't in the plan's `files:` list. Creates workflow breaks that the user has to manually override.

3. **Slow hooks**: PreToolUse hooks that read and parse plan files (branch scope guard) add latency to every Edit/Write call. Must be fast (<100ms) or users notice.

4. **Overly prescriptive templates**: Root cause templates that force a specific 5-step causal analysis format for a one-line typo fix. Gate on complexity.

---

## Competitor Feature Analysis

| Feature | Cursor | Copilot | Our Approach |
|---------|--------|---------|--------------|
| Session state injection | No structural injection — relies on rules files loaded every turn | No structural injection — context window management is manual | Targeted: first-message only, compact STATE.md summary, hook-level (not behavioral policy) |
| Approach declaration | No pre-planning declaration gate | Copilot Workspace has task specs but no NOT-DOING constraint | Structural gate in workflow, Haiku-derived from description, not separate dialog |
| Root cause enforcement | No enforcement — model decides approach | No enforcement | Template injection + quorum vote = structural, not policy |
| Edit-in-place default | Some rules files patterns exist | No structural default | `additionalContext` injection on edit-intent detection |
| Branch scope guard | No hook-level scope enforcement | No scope enforcement | PreToolUse hook with plan-derived file list, warning-only v1 |
| Quorum on diagnosis | N/A — single model | N/A — single model | Unique differentiator — extends quorum identity to the diagnosis layer |

---

## Sources

- [Building Guardrails for AI Coding Assistants: A PreToolUse Hook System for Claude Code](https://dev.to/mikelane/building-guardrails-for-ai-coding-assistants-a-pretooluse-hook-system-for-claude-code-ilj) — MEDIUM confidence (community, verified with Claude Code hook docs)
- [Context Engineering for Coding Agents — Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/context-engineering-coding-agents.html) — HIGH confidence (Martin Fowler, authoritative practitioner source)
- [My LLM coding workflow going into 2026 — Addy Osmani](https://addyosmani.com/blog/ai-coding-workflow/) — HIGH confidence (Addy Osmani, Chrome DevRel, 2026)
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks) — HIGH confidence (official Claude Code documentation)
- [Guardrails and Best Practices for Agentic Orchestration — Camunda](https://camunda.com/blog/2026/01/guardrails-and-best-practices-for-agentic-orchestration/) — MEDIUM confidence (vendor, Jan 2026)
- [Context Engineering in Agent — Chier Hu, Medium/Agentic AI](https://medium.com/agenticais/context-engineering-in-agent-982cb4d36293) — LOW confidence (single source, unverified)
- [Claude Code Hooks: 5 Automations That Eliminate Developer Friction](https://medium.com/coding-nexus/claude-code-hooks-5-automations-that-eliminate-developer-friction-7b6ddeff9dd2) — MEDIUM confidence (community, 2025)
- [Claude-mem: AI Plugin for Claude Code Session Memory](https://aitoolly.com/ai-news/article/2026-03-17-claude-mem-a-new-plugin-for-automated-coding-session-memory-and-context-injection-via-claude-code) — MEDIUM confidence (March 2026, corroborates session injection pattern)

---
*Feature research for: v0.40 Session Intelligence & Friction Reduction (nForma)*
*Researched: 2026-03-19*
