# Project Research Summary

**Project:** nForma v0.30 -- Advanced Agent Patterns
**Domain:** Claude Code plugin infrastructure -- agent harness patterns (token optimization, memory persistence, continuous verification, worktree parallelization, iterative retrieval, smart compaction)
**Researched:** 2026-03-07
**Confidence:** MEDIUM-HIGH

## Executive Summary

nForma v0.30 introduces six advanced agent patterns that extend the existing hook-driven pipeline: dynamic model selection, cross-session learning, continuous verification, git worktree parallelization, iterative retrieval for quorum context, and earlier compaction triggering. The core finding across all four research files is that **zero new npm dependencies are required**. All six patterns build on Node.js built-ins (fs, path, child_process, crypto), existing infrastructure (hooks, config-loader, budget-tracker, scoreboard, token-usage.jsonl), and Claude Code's native lifecycle events. The existing architecture -- 12 hooks across 7 event types, two-layer config merge, file-based state persistence -- provides all the integration points needed. This is an extension milestone, not a foundation-building one.

The recommended approach is to build in dependency order starting with the two lowest-risk, highest-leverage patterns (dynamic model selection and earlier compaction), which extend well-understood existing hooks. Cross-session learning and continuous verification come next as the foundational infrastructure for memory and quality. Iterative retrieval and git worktree parallelization are the most complex and risky patterns and must come last, after the simpler patterns have stabilized. This ordering is strongly supported by the dependency graph: verification loops need compaction headroom, continuous learning needs memory persistence, parallelization needs orchestration, and the cascade method needs both parallelization and quorum review.

The dominant risks are: (1) downgrade loop oscillation between budget control and quality control when dynamic model selection fights the existing budget tracker, (2) memory bloat and stale patterns in cross-session learning crowding out quorum instructions in the limited additionalContext budget, (3) verification performance overhead turning every tool call into a gate, (4) git worktree shared state corruption when parallel agents write to the same `.planning/` files, and (5) token explosion in iterative retrieval ballooning quorum calls from ~36k to ~120k+ tokens. All five are preventable with upfront design decisions but expensive to retrofit.

## Key Findings

### Recommended Stack

No new npm dependencies. Eight new bin/ scripts and two new hooks, all using CommonJS with Node.js built-ins. The existing `gsd-context-monitor.js` (PostToolUse) becomes the primary extension point for three of the six patterns. New config keys must be flat (not nested) due to the shallow merge in config-loader.js. Claude Code's native WorktreeCreate/WorktreeRemove hook events and subagent `isolation: worktree` field provide the parallelization foundation. See STACK.md for capability-by-capability analysis.

**Core technologies (no changes):**
- Node.js >= 16.7.0, CommonJS modules, Claude Code Hooks API -- existing runtime, no version bump needed
- File-based JSON/JSONL persistence -- proven pattern (debt-state-machine.cjs, token-usage.jsonl, conformance-events.jsonl)
- spawnSync for subprocess calls -- proven in nf-circuit-breaker.js, budget-tracker.cjs

**New components (8 bin scripts, 2 hooks, 1 agent definition):**
- `bin/model-selector.cjs` -- dynamic model scoring per task envelope
- `bin/session-learner.cjs` + `bin/pattern-store.cjs` -- transcript pattern extraction and persistence
- `bin/continuous-verify.cjs` -- incremental lint/typecheck after file writes
- `bin/worktree-manager.cjs` + `hooks/nf-worktree-create.js` + `hooks/nf-worktree-remove.js` -- worktree lifecycle
- `bin/context-stack.cjs` -- hierarchical context management for iterative retrieval
- `bin/smart-compactor.cjs` -- curated compaction context

### Expected Features

**Must have (P1 -- v0.30 core):**
- Earlier compaction at workflow boundaries -- LOW complexity, HIGH value, extends existing detectCleanBoundary()
- Extended thinking budget scaling -- LOW complexity, config-loader + additionalContext injection
- File-based execution state tracking -- MEDIUM complexity, critical foundation for verification and memory
- Structured state persistence beyond STATE.md -- MEDIUM complexity, extends nf-precompact.js
- Error resolution memory -- MEDIUM complexity, leverages native subagent `memory: project` field
- Worktree-isolated quorum workers -- MEDIUM complexity, uses native `isolation: worktree`
- Phase-based context accumulation -- MEDIUM complexity, new `.planning/context-stack/`

**Should have (P2 -- v0.30.x validation):**
- Task-complexity-aware model routing -- when token data shows Opus waste on simple tasks
- Continuous test verification during execution -- when file-based state tracking proves stable
- Machine-verifiable completion conditions -- Ralph Loop pattern adapted to nForma
- Quorum-validated skill extraction -- when memory persistence accumulates data
- Iterative retrieval for quorum context -- when worktree isolation works for slot workers
- Failure catalog with confidence scores -- when error resolution memory has entries

**Defer (v0.31+):**
- Cascade method (best-of-N parallel implementations) -- HIGH complexity, requires validated parallelization + orchestration
- Dynamic model selection per subagent type -- requires task complexity classifier + provider reliability data
- Context stack with relevance scoring -- requires accumulated context data
- Formal model re-verification on code change -- requires stable three-layer FV pipeline from v0.29

### Architecture Approach

The architecture integrates six new patterns as extensions of the existing hook pipeline, not as parallel systems. Three patterns extend `gsd-context-monitor.js` (PostToolUse): dynamic model selection, continuous verification, and earlier compaction. Cross-session learning extends `nf-session-start.js` (SessionStart) and `nf-precompact.js` (PreCompact). Worktree parallelization adds two new hooks on WorktreeCreate/WorktreeRemove events. All new hooks follow the existing patterns: synchronous execution, fail-open, stdout-only for decisions, stderr for debug, CommonJS modules. See ARCHITECTURE.md for the full component inventory and data flow diagrams.

**Major components and their modification surface:**
1. `gsd-context-monitor.js` (PostToolUse) -- modified by 3 patterns: budget feedback, file-write detection, auto-compact trigger
2. `nf-prompt.js` (UserPromptSubmit) -- modified by 3 patterns: model selection dispatch, worktree instructions, retrieval dispatch
3. `nf-precompact.js` (PreCompact) -- modified by 2 patterns: preserve learned patterns, rich compaction context
4. `config-loader.js` -- modified by all patterns: 15+ new flat config keys with defaults

**Key architectural constraint:** Multiple hooks on the same event type risk additionalContext conflicts. All PostToolUse logic MUST consolidate into gsd-context-monitor.js (not separate hooks) to maintain single-writer semantics.

### Critical Pitfalls

1. **Downgrade loop oscillation** -- Budget tracker and model selector create competing control loops. Prevent with cooldown period (min 3 rounds), downgrade-quality gate (no downgrade if consensus < 70%), and unified decision function. Must be designed into Phase 1.

2. **Memory bloat crowding quorum instructions** -- additionalContext has a practical ceiling of ~4000 tokens; quorum instructions already use ~800. Hard cap memory injection at 1500 tokens, select top-5 patterns by relevance, implement retention policy with automatic pruning. Must be designed into Phase 2.

3. **Stale patterns causing wrong behavior** -- Extracted patterns become dangerous when codebase changes. Tag patterns with git SHA, implement confidence decay (10% per session), validate referenced files exist on SessionStart. Must be designed into Phase 2.

4. **Worktree shared state corruption** -- nForma assumes exclusive access to `.planning/` state files. Scope ALL mutable state to worktree-specific directories, use file locking for shared state, detect worktree context via `git rev-parse --git-common-dir`. Must be the first implementation step in Phase 5.

5. **Token explosion in iterative retrieval** -- Without per-slot budgets, 3 slots doing 3 retrieval rounds balloons from ~36k to ~120k+ tokens. Hard cap at 8k retrieved tokens per slot, max 2 rounds, shared retrieval cache across slots. Must be enforced before enabling any retrieval in Phase 4.

## Implications for Roadmap

Based on combined research, suggested 6-phase structure:

### Phase 1: Dynamic Model Selection and Token Optimization
**Rationale:** Smallest surface area, extends existing budget-tracker.cjs with proven patterns, delivers immediate cost savings. No hard dependencies on other patterns. Config-loader extension establishes the pattern for all subsequent phases.
**Delivers:** bin/model-selector.cjs, config additions for dynamic model routing, nf-prompt.js dispatch changes, extended thinking budget scaling.
**Addresses:** Token Optimization table stakes (task-complexity routing, thinking budget, token dashboarding).
**Avoids:** Pitfall 1 (downgrade oscillation) by designing cooldown and quality gate from the start.

### Phase 2: Earlier Compaction and Smart Context Management
**Rationale:** Extends existing smart_compact infrastructure in gsd-context-monitor.js. Benefits all subsequent patterns by preserving more context across compaction. Must precede cross-session learning (Phase 3) because pattern survival depends on rich compaction context.
**Delivers:** bin/smart-compactor.cjs, workflow-aware compaction thresholds, enriched nf-precompact.js with curated continuation context, quorum evidence checkpointing.
**Addresses:** Earlier compaction at boundaries, context window forecasting.
**Avoids:** Pitfall 9 (compaction storm) by using boundary-triggered thresholds; Pitfall 10 (quorum evidence loss) by checkpointing evidence before compaction.

### Phase 3: Cross-Session Learning and Memory Persistence
**Rationale:** Depends on Phase 2 (compaction context enrichment) for pattern survival across sessions. Foundation for continuous learning and failure catalogs.
**Delivers:** bin/session-learner.cjs, bin/pattern-store.cjs, nf-session-start.js pattern injection, structured state persistence beyond STATE.md, error resolution memory.
**Addresses:** Memory Persistence table stakes + differentiators (structured state, proactive reminders, error resolution memory).
**Avoids:** Pitfall 2 (memory bloat) with 1500-token injection cap and retention policy; Pitfall 3 (stale patterns) with git-SHA tagging and confidence decay; Pitfall 12 (privacy leakage) with sanitization pipeline.

### Phase 4: Continuous Verification
**Rationale:** Independent of Phases 1-3 but benefits from earlier compaction (headroom for verification overhead) and learned patterns (prioritize checks). Extends gsd-context-monitor.js PostToolUse path.
**Delivers:** bin/continuous-verify.cjs, file-write detection in gsd-context-monitor.js, boundary-batched verification, machine-verifiable completion conditions.
**Addresses:** Verification Loops table stakes (continuous checks, file-based state tracking, completion conditions).
**Avoids:** Pitfall 4 (verification overhead) with boundary-batched checks (max 3 per phase), 5s hard timeout, advisory-only warnings; Pitfall 11 (hook composition conflicts) by consolidating into gsd-context-monitor.js.

### Phase 5: Iterative Retrieval and Subagent Orchestration
**Rationale:** Requires stable slot dispatch (Phase 1 model selection) and stable compaction (Phase 2). Changes call-quorum-slot.cjs from synchronous single-shot to multi-round, which is a high-risk architectural change. Must come after simpler patterns stabilize.
**Delivers:** bin/context-stack.cjs, multi-round call-quorum-slot.cjs, nf-stop.js multi-round recognition, specialized retrieval agents, phase-based context accumulation.
**Addresses:** Subagent Orchestration table stakes + differentiators (iterative retrieval, context stack, specialized agents).
**Avoids:** Pitfall 7 (token explosion) with per-slot 8k budget and max 2 rounds; Pitfall 8 (context drift) with goal anchoring in every retrieval round prompt.

### Phase 6: Git Worktree Parallelization
**Rationale:** Most complex integration. Worktrees interact with every hook (circuit breaker cwd, config-loader project root, state file paths). Requires all other patterns stable. State isolation is the critical prerequisite -- must be the first step within this phase.
**Delivers:** bin/worktree-manager.cjs, hooks/nf-worktree-create.js, hooks/nf-worktree-remove.js, agents/nf-worktree-executor.md, circuit breaker worktree awareness, worktree-scoped state files.
**Addresses:** Parallelization table stakes (worktree-isolated quorum workers, parallel plan execution, merge orchestration).
**Avoids:** Pitfall 5 (shared state corruption) with worktree-scoped `.planning/worktree-<name>/`; Pitfall 6 (cleanup failures) with manifest tracking and 24h cleanup sweep.

### Phase Ordering Rationale

- Phases 1-2 are the foundation: cost control and context management improve every subsequent pattern.
- Phase 3 depends on Phase 2 (compaction context for pattern survival).
- Phase 4 is semi-independent but benefits from Phases 1-2.
- Phase 5 depends on Phase 1 (model selection for retrieval agents) and changes the quorum slot architecture.
- Phase 6 depends on ALL prior phases being stable because worktrees interact with every hook.
- This ordering minimizes blast radius: early phases change 1-2 existing hooks each; later phases touch 3+ hooks.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (Iterative Retrieval):** Changes call-quorum-slot.cjs from synchronous to multi-round. Slot timeout implications unclear. Need to validate whether Claude Code subagents support multi-turn interaction within a single slot invocation, or if this requires a fundamentally different dispatch model.
- **Phase 6 (Git Worktrees):** Hook cwd resolution in worktrees, config-loader project root detection, and circuit breaker per-worktree isolation all need validation against actual Claude Code behavior. Community reports conflict on edge cases.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Dynamic Model Selection):** Extends existing budget-tracker.cjs DOWNGRADE_CHAIN. Well-understood extension pattern.
- **Phase 2 (Earlier Compaction):** Extends existing smart_compact infrastructure in gsd-context-monitor.js. Pure threshold and context tuning.
- **Phase 4 (Continuous Verification):** Follows established lint/test-on-save pattern. The 5s timeout constraint is the main design variable.

Phase needing light research:
- **Phase 3 (Cross-Session Learning):** Pattern extraction heuristics need empirical tuning. Start simple (tool sequences, error-resolution pairs), iterate based on data quality.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all integration points verified against existing source code; Claude Code hook events confirmed in current docs |
| Features | MEDIUM-HIGH | Table stakes well-defined from official docs + community patterns; differentiators (cascade method, quorum-gated verification) are novel combinations without external precedent |
| Architecture | HIGH | Based on direct analysis of all 12 existing hooks; component inventory, modification surface, and data flow changes are specific and verified |
| Pitfalls | HIGH | 12 pitfalls grounded in existing nForma architecture constraints, community reports, and published research; each has concrete prevention strategy and verification criteria |

**Overall confidence:** MEDIUM-HIGH -- the individual patterns are well-understood (proven in existing codebase or community), but the six-pattern integration is novel. The main uncertainty is in Phases 5-6 where architectural changes interact with multiple existing hooks simultaneously.

### Gaps to Address

- **Multi-round slot interaction model:** call-quorum-slot.cjs currently uses spawnSync (single-shot). Iterative retrieval (Phase 5) needs multi-round interaction. Whether this requires event-driven subprocess management or repeated spawn calls needs validation during Phase 5 planning.
- **additionalContext composition:** When multiple sources inject into additionalContext (quorum instructions + memory patterns + verification warnings + compaction advisories), the merge behavior is undefined. Phase 1 must establish a token-budgeted composition model before any new injection sources are added.
- **Worktree hook cwd resolution:** Documentation says WorktreeCreate hooks REPLACE default behavior and must print the path. Actual behavior with nForma's installed hooks at `~/.claude/hooks/` needs empirical validation in Phase 6.
- **Cross-session pattern quality:** No benchmark exists for "useful" vs "noise" patterns. Phase 3 must ship with instrumentation to measure pattern hit rate and relevance, not just extraction volume.
- **Flat config key explosion:** Adding 15+ flat config keys to config-loader.js DEFAULT_CONFIG (required by shallow merge) may become unwieldy. Consider whether a config section merging strategy is needed before Phase 4 adds more keys.

## Sources

### Primary (HIGH confidence)
- Claude Code Hooks Reference (code.claude.com/docs/en/hooks) -- WorktreeCreate, WorktreeRemove, PostToolUse, SessionStart event schemas
- Claude Code Subagents (code.claude.com/docs/en/sub-agents) -- isolation, memory, model, skills, maxTurns fields
- Claude Code Skills (code.claude.com/docs/en/skills) -- skill format, auto-discovery, context: fork
- Claude Code Memory (code.claude.com/docs/en/memory) -- CLAUDE.md, auto-memory, /remember
- Existing nForma codebase -- all 12 hooks, config-loader.js, budget-tracker.cjs, debt-state-machine.cjs, gsd-context-monitor.js, nf-precompact.js, nf-stop.js, nf-token-collector.js

### Secondary (MEDIUM confidence)
- Ralph Loop / continuous-claude (GitHub) -- Stop hook re-feed, file-based state persistence, machine-verifiable completion
- Claudeception / continuous-learning-skill (GitHub) -- skill extraction from error resolutions
- Git worktree community reports (Medium, SuperGok, claudefa.st) -- worktree isolation issues, disk consumption, lifecycle management
- AgentSpec: Customizable Runtime Enforcement (ICSE 2026) -- verification overhead measurements (~430ms per decision cycle)
- Dynamic Model Routing and Cascading survey (arXiv 2603.04445) -- routing paradigms, capability mismatch

### Tertiary (LOW confidence)
- Cross-session pattern extraction quality -- no established benchmarks; will require empirical tuning
- Multi-round slot worker interaction model -- untested against Claude Code subagent lifecycle constraints
- Worktree hook cwd behavior with globally-installed nForma hooks -- needs empirical validation

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
