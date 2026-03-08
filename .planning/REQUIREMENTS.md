# Requirements: nForma v0.30 — Advanced Agent Patterns

**Defined:** 2026-03-07
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## Milestone v0.30 Requirements

### Token Optimization

- [x] **TOKN-01**: User benefits from automatic compaction at 60-70% context usage when at a clean workflow boundary (phase-complete, verification-done, wave-barrier)
- [x] **TOKN-02**: User can configure extended thinking budget scaling per task type — 0 for exploration subagents, reduced for simple reviews, full for architecture decisions
- [x] **TOKN-03**: User can view a token usage dashboard aggregating cost per milestone, phase, and slot from token-usage.jsonl
- [x] **TOKN-04**: User benefits from automatic task-complexity-aware model routing — simple tasks routed to cheaper models, complex tasks to Opus based on classification

### Memory Persistence

- [x] **MEMP-01**: User's accumulated decisions, rejected approaches, and partial findings persist across compaction via structured state beyond STATE.md
- [x] **MEMP-02**: User receives proactive session reminders at SessionStart with richer context — last 3 decisions made, blockers discovered, relevant learnings from previous sessions
- [x] **MEMP-03**: User benefits from error resolution memory — tricky bug fixes persist as searchable symptom/root-cause/fix patterns via subagent memory
- [x] **MEMP-04**: User benefits from quorum decision memory — debate rationale ("chose X over Y because Z") persists across compaction and sessions

### Continuous Learning

- [x] **LRNG-01**: User benefits from automatic error resolution extraction — symptom-to-root-cause-to-fix patterns extracted into a searchable catalog at session boundaries
- [x] **LRNG-02**: User corrections to Claude's approach are automatically recorded as learned patterns for future sessions
- [x] **LRNG-03**: User benefits from quorum-validated skill extraction — only patterns that multiple models agree are valuable get persisted as reusable skills
- [x] **LRNG-04**: User benefits from a failure catalog tracking failed approaches with confidence scores to prevent re-attempting dead ends

### Verification Loops

- [x] **VERF-01**: User's sub-task progress within a plan is tracked in file-based state so mid-execution compaction does not lose position
- [x] **VERF-02**: User benefits from continuous test verification during execution — relevant tests run after each code change via PostToolUse, not just at phase end
- [x] **VERF-03**: User benefits from machine-verifiable completion conditions — "done" defined as checkable conditions (tests pass, linter clean, type-check passes) rather than LLM judgment

### Parallelization

- [ ] **PARA-01**: User benefits from worktree-isolated executor subagents — parallel tasks run in git worktrees using native `isolation: worktree` without file conflicts
- [ ] **PARA-02**: User benefits from parallel plan execution — independent plan tasks run simultaneously in isolated worktrees instead of sequentially

### Subagent Orchestration

- [ ] **ORCH-01**: User benefits from iterative retrieval for quorum slot workers — workers can request additional context as needed via Read/Grep/Glob instead of receiving a fixed context dump
- [ ] **ORCH-02**: User benefits from phase-based context accumulation — architecture decisions, test results, and API contracts accumulate across phases and inject into subsequent phase planning
- [ ] **ORCH-03**: User benefits from specialized retrieval agents — domain-specific agents (test-retriever, architecture-retriever, formal-model-retriever) with preloaded skills for targeted context fetching

## Future Requirements

### v0.31+ Consideration

- **CASCADE-01**: Cascade method — spawn 3-5 parallel implementations, select best via quorum review
- **QVLOOP-01**: Quorum-gated verification loops — multi-model validation of task completion
- **DYNMOD-01**: Dynamic model selection per subagent type with task complexity classifier
- **CONVEN-01**: Project-specific convention extraction from git history
- **CTXREL-01**: Context stack with relevance scoring (recency, citation count, topic relevance)
- **FMREV-01**: Formal model re-verification on code change during execution

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time token cost display in terminal | No mid-turn hook event; post-session summary sufficient |
| Full conversation history persistence | Unbounded growth; stale context harmful; extract structured learnings only |
| Embedding-based semantic search over history | Over-engineering for CLI plugin; file-based grep over JSONL sufficient |
| Unlimited parallel agents | Diminishing returns past 3-5; expensive; merge conflicts |
| Nested subagent spawning | Claude Code architectural constraint — subagents cannot spawn subagents |
| Auto-parallelizing existing sequential plans | Requires dependency analysis; explicit parallel markers safer |
| Automatic CLAUDE.md updates from memory | CLAUDE.md is user-controlled; auto-writes create drift |
| Real-time skill extraction during every tool call | Massive overhead; batch at session/workflow boundaries instead |
| Worktree-per-tool-call isolation | Overhead too high; worktree isolation at task level only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKN-01 | v0.30-01 | Complete |
| TOKN-02 | v0.30-01 | Complete |
| TOKN-03 | v0.30-01 | Complete |
| TOKN-04 | v0.30-01 | Complete |
| MEMP-01 | v0.30-03 | Complete |
| MEMP-02 | v0.30-03 | Complete |
| MEMP-03 | v0.30-03 | Complete |
| MEMP-04 | v0.30-03 | Complete |
| LRNG-01 | v0.30-04 | Complete |
| LRNG-02 | v0.30-04 | Complete |
| LRNG-03 | v0.30-04 | Complete |
| LRNG-04 | v0.30-04 | Complete |
| VERF-01 | v0.30-02 | Complete |
| VERF-02 | v0.30-05 | Complete |
| VERF-03 | v0.30-05 | Complete |
| PARA-01 | v0.30-07 | Pending |
| PARA-02 | v0.30-07 | Pending |
| ORCH-01 | v0.30-06 | Pending |
| ORCH-02 | v0.30-06 | Pending |
| ORCH-03 | v0.30-06 | Pending |

**Coverage:**
- v0.30 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
