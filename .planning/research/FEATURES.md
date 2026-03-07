# Feature Research: Advanced Agent Patterns for nForma v0.30

**Domain:** Claude Code plugin infrastructure — advanced agent harness patterns
**Researched:** 2026-03-07
**Confidence:** MEDIUM-HIGH (official docs verified for subagents/skills/worktrees/memory; community patterns for Ralph Loop and continuous learning)

## Feature Landscape

Six pattern areas, each broken into table stakes, differentiators, and anti-features. Dependencies on existing nForma infrastructure noted per feature.

---

### Pattern 1: Token Optimization (Dynamic Model Selection + Budget Control)

**Existing nForma infrastructure:** `bin/budget-tracker.cjs` (computeBudgetStatus, triggerProfileDowngrade, DOWNGRADE_CHAIN), `gsd-context-monitor.js` (PostToolUse context % tracking, smart compact suggestions), `nf-token-collector.js` (per-slot token recording to token-usage.jsonl).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Task-complexity-aware model routing | Budget tracker already downgrades on context %, but doesn't consider task complexity — simple commits shouldn't burn Opus tokens | MEDIUM | `budget-tracker.cjs` DOWNGRADE_CHAIN, subagent `model` field |
| Extended thinking budget scaling | Claude Code defaults to 31,999 thinking tokens; simple tasks waste tokens, complex tasks benefit — need adaptive budget | LOW | Config-loader two-layer merge, `nf-prompt.js` additionalContext injection |
| Context window usage forecasting | Smart compact fires at boundaries but doesn't predict — "you have ~3 tool calls left" prevents mid-task compaction | MEDIUM | `gsd-context-monitor.js` PostToolUse payload `context_window` field |
| Token usage dashboarding | token-usage.jsonl exists but no aggregation view — users need cost visibility per milestone/phase/slot | LOW | `nf-token-collector.js` JSONL output, `bin/gsd-tools.cjs` CLI |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Dynamic model selection per subagent type | Route quorum slots to Haiku for simple reviews, Opus for architecture — based on task classification, not just budget pressure | HIGH | `bin/providers.json` slot map, subagent `model` field (sonnet/opus/haiku), quorum dispatch |
| Earlier compaction triggers at workflow boundaries | Don't wait for 95% auto-compaction — trigger at 60-70% when at a clean boundary (phase-complete, verification-done) | LOW | `gsd-context-monitor.js` `detectCleanBoundary()` already exists, just lower thresholds |
| Context slimming via selective tool output truncation | Large test outputs, grep results consume context — summarize before returning to main conversation | MEDIUM | Subagent isolation (built-in Explore agent already does this), PostToolUse hook |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time token cost display in terminal | Users want to see spend live | Claude Code has no hook event for "mid-turn" — only PostToolUse fires after each tool; adds noise without actionable data | Post-session summary via `nf-token-collector.js` aggregation |
| Automatic context window compression | "Just make it fit more" | Lossy compression of conversation history breaks reasoning chains; Claude Code's own compaction is already optimized | Earlier compaction at clean boundaries + context slimming of tool outputs |
| Per-message model switching | Switch Opus/Sonnet mid-conversation | Claude Code doesn't support model switching within a session — only subagents can use different models | Route to subagents with explicit model selection per task type |

---

### Pattern 2: Memory Persistence (Cross-Session Learning)

**Existing nForma infrastructure:** `nf-precompact.js` (injects STATE.md Current Position + pending tasks at compaction), `nf-session-start.js` (parses STATE.md for session reminder, syncs keychain), `nf-prompt.js` (injects quorum instructions + circuit breaker recovery context), `.planning/STATE.md` (live project state).

**Claude Code native:** CLAUDE.md (survives compaction, re-read from disk), auto-memory (`~/.claude/projects/*/memory/MEMORY.md`), session memory (automatic background extraction), `/remember` command, subagent `memory` field (user/project/local scopes with persistent directory at `~/.claude/agent-memory/<name>/` or `.claude/agent-memory/<name>/`).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Structured state persistence beyond STATE.md | STATE.md tracks phase/plan/status but not accumulated decisions, rejected approaches, or partial findings | MEDIUM | `nf-precompact.js` PreCompact additionalContext, `.planning/` directory |
| Proactive session reminders with richer context | nf-session-start.js reminds about phase/status, but not about "last 3 decisions made" or "blockers discovered" | LOW | `nf-session-start.js` `parseStateForReminder()`, SessionStart hook |
| Error resolution memory | When Claude fixes a tricky error, that fix should be available in future sessions without re-discovery | MEDIUM | Subagent `memory: project` field, `.claude/agent-memory/` directory |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Quorum decision memory | Quorum debates have rationale — "chose X over Y because Z" — but this evaporates at compaction; persisting quorum rationale enables faster re-decisions | HIGH | `nf-stop.js` quorum transcript parsing, `.planning/quorum/` directory |
| Multi-session learning accumulation | Each session discovers project patterns (coding conventions, error-prone modules, performance bottlenecks); accumulating these across sessions compounds effectiveness | HIGH | Subagent `memory` field (native), custom extraction hook at SubagentStop |
| Failure pattern catalog | Track "this approach was tried and failed because X" to prevent re-attempting dead ends | MEDIUM | SubagentStop hook, `.planning/failures.jsonl` or similar |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full conversation history persistence | "Remember everything from every session" | Grows unbounded, stale context harms more than helps, privacy concerns with stored transcripts | Structured extraction of decisions/learnings only |
| Automatic CLAUDE.md updates from memory | "Just write what you learn to CLAUDE.md" | CLAUDE.md is user-controlled configuration; auto-writes create drift and conflicts | Use subagent `memory` directories (separate from CLAUDE.md), surface suggestions via `/remember` pattern |
| Embedding-based semantic search over history | Vector DB for past conversations | Over-engineering for a CLI plugin; file-based grep over structured JSONL is sufficient and zero-dependency | Structured JSONL with tagged entries + grep search |

---

### Pattern 3: Continuous Learning (Skill Extraction + Pattern Library)

**Existing nForma infrastructure:** None directly — this is net-new capability.

**Claude Code native:** Skills system (`.claude/skills/*/SKILL.md` with YAML frontmatter), auto-discovery from nested directories, `context: fork` for subagent execution, `disable-model-invocation` control, `user-invocable: false` for background knowledge. Community: Claudeception/continuous-learning-skill (single-model extraction from errors), ECC Tools (git history analysis for skill generation).

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Structured skill format for nForma workflows | nForma has workflows (plan-phase, execute-phase, verify, quick) but they're in `core/workflows/*.md` — converting to Skills format enables Claude's native skill loading and auto-invocation | LOW | `core/workflows/` directory, `.claude/skills/` directory |
| Error resolution extraction | When a tricky bug is fixed, extract the pattern ("symptom -> root cause -> fix") into a searchable catalog | MEDIUM | PostToolUse or SubagentStop hook, `.claude/skills/` or `.planning/learnings/` |
| User correction tracking | When user corrects Claude's approach, record the correction as a learned pattern | MEDIUM | Stop hook or UserPromptSubmit hook, pattern extraction logic |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Quorum-validated skill extraction | Unlike Claudeception (single model extracts skills), nForma can quorum-validate extracted patterns — only persist skills that multiple models agree are valuable | HIGH | Quorum dispatch infrastructure, SubagentStop hook, `.claude/skills/` |
| Failure catalog with confidence scores | Track failed approaches with scored confidence ("tried 3x, failed each time" vs "tried once, unclear") — prevents re-attempting AND surfaces patterns worth investigating | MEDIUM | `.planning/failures.jsonl`, confidence scoring logic |
| Project-specific convention extraction from git history | Analyze commit patterns, code style, naming conventions from git log and auto-generate skills | HIGH | `git log` analysis, ECC Tools pattern (but self-hosted, no external dependency) |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time skill extraction during every tool call | "Learn from everything" | Massive overhead — every PostToolUse hook would need LLM classification of "was this a learning moment?" | Batch extraction at session end or at workflow boundaries |
| Automatic skill injection into all sessions | "Always use everything learned" | Skills budget is 2% of context window (~16K chars); flooding with auto-generated skills crowds out user-defined ones | Relevance-based loading (Claude's native skill matching) + manual curation |
| Cross-project skill sharing without review | "Share learnings across all repos" | Project-specific patterns applied to wrong project cause harm; security-sensitive patterns leak | User-level skills (`~/.claude/skills/`) require explicit promotion from project-level |

---

### Pattern 4: Verification Loops (File-Based State Machines + Ralph Loop)

**Existing nForma infrastructure:** `nf-verifier.md` (batch phase verification), three-layer formal verification (v0.29), `gsd-context-monitor.js` (clean boundary detection via `detectCleanBoundary()`), `nf-stop.js` (quorum verification gate). Existing verification is phase-end only — not continuous during execution.

**Community:** Ralph Loop (continuous-claude, ralph-claude-code) — Stop hook re-feeds prompt with fresh context, file-based state persistence via PROGRESS.md + git commits, machine-verifiable completion conditions. Used at scale: 16 agents, ~2,000 sessions, 100K-line C compiler.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| File-based execution state tracking | Currently STATE.md tracks phase/plan but not sub-task progress within a plan — mid-execution compaction loses where you were in a multi-step plan | MEDIUM | `.planning/STATE.md` format extension, `nf-precompact.js` injection |
| Continuous test verification during execution | Don't wait until phase-complete to discover test failures — run relevant tests after each code change | MEDIUM | PostToolUse hook (matcher: Write/Edit), Bash test runner |
| Machine-verifiable completion conditions | Ralph Loop's key insight: define "done" as a checkable condition (all tests pass, linter clean, type-check passes) rather than LLM judgment | LOW | `nf-verifier.md` already has verification checklists; need machine-readable format |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Quorum-gated verification loops | Ralph Loop uses single-model assessment; nForma can quorum-verify "is this task actually done?" before marking complete | HIGH | Quorum dispatch, Stop hook, verification checklist format |
| Formal model re-verification on code change | When code changes, re-run relevant TLA+/Alloy checks (not just tests) to detect invariant violations early | HIGH | Three-layer FV infrastructure (v0.29), `bin/run-formal-check.cjs`, PostToolUse hook |
| Progressive state checkpointing | At each clean boundary, checkpoint full execution state (not just STATE.md but accumulated context, decisions, file changes) so recovery after crash/compaction is seamless | MEDIUM | `nf-precompact.js`, `.planning/checkpoints/` directory |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Infinite autonomous loops without human checkpoints | "Just keep going until done" | Unbounded loops accumulate errors; $20K C compiler experiment was supervised; without checkpoints, drift compounds | Bounded iteration with explicit continuation points and quorum gates |
| Re-running all tests after every file edit | "Continuous CI locally" | Full test suites take minutes; blocks agent progress; wastes tokens waiting | Targeted test runs: only tests affected by changed files |
| State machine in code (XState/statecharts) for execution tracking | "Proper FSM implementation" | Over-engineering for file-based state; adds runtime dependency; nForma already has XState for workflow FSM (different purpose) | File-based state with JSON/MD: simple, inspectable, no runtime needed |

---

### Pattern 5: Parallelization (Git Worktrees + Cascade Method)

**Existing nForma infrastructure:** Quorum dispatch already parallelizes across models (slot workers), but quorum is for review/consensus — not parallel implementation. No git worktree usage currently.

**Claude Code native (v2.1.49+):** Built-in `--worktree` flag, subagent `isolation: worktree` frontmatter field, automatic worktree cleanup when subagent makes no changes, `/batch` bundled skill (researches codebase, decomposes into 5-30 independent units, spawns one background agent per unit in worktrees, each opens a PR). Worktrees stored at `.claude/worktrees/<name>/`.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Worktree-isolated quorum slot workers | Quorum workers currently share the main working directory — if they need to read/write files for analysis, they can conflict | MEDIUM | Subagent `isolation: worktree` field, `bin/call-quorum-slot.cjs`, `.claude/agents/` |
| Parallel plan execution for independent tasks | When a plan has 3 independent implementation tasks, run them in parallel worktrees instead of sequentially | HIGH | `core/workflows/execute-phase.md`, subagent orchestration, worktree support |
| Worktree cleanup and merge orchestration | After parallel work, merge results back to main branch — handle conflicts, run integration tests | MEDIUM | Git merge logic, PostToolUse or SubagentStop hook |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Cascade method (3-5 parallel implementations, best-of-N) | Like pass@k but for implementation: spawn 3-5 agents implementing the same task differently, select best result via quorum review | HIGH | Worktree isolation, quorum consensus for selection, merge logic |
| Quorum-reviewed parallel merge | After parallel agents complete, quorum reviews each result and ranks them before merging — not just "first to finish" | HIGH | Quorum dispatch, worktree results, `nf-stop.js` verification |
| Dependency-aware task decomposition | Automatically determine which plan tasks can parallelize (no shared file writes) vs must serialize | MEDIUM | Plan format analysis, file dependency detection |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Unlimited parallel agents | "More agents = faster" | Each agent consumes API tokens; 10+ parallel Opus agents is expensive and produces merge conflicts; diminishing returns past 3-5 | Bounded parallelism: 3-5 max, with quorum gate on results |
| Worktree-per-tool-call isolation | "Isolate every file write" | Massive overhead for simple edits; worktree creation/deletion per tool call is slower than sequential writes | Worktree isolation at task level, not tool-call level |
| Auto-parallelizing existing sequential plans | "Make everything parallel automatically" | Plans have implicit ordering assumptions; auto-parallelizing without dependency analysis causes conflicts | Explicit parallel/serial markers in plan format; dependency analysis before parallelization |

---

### Pattern 6: Subagent Orchestration (Iterative Retrieval + Context Stack)

**Existing nForma infrastructure:** Quorum slot workers (nf-quorum-slot-worker agent type), `nf-slot-correlator.js` (SubagentStart hook, writes correlation file), `nf-token-collector.js` (SubagentStop hook, reads transcript). Subagents cannot spawn other subagents (Claude Code constraint).

**Claude Code native:** Custom subagents (`.claude/agents/*.md` with YAML frontmatter), built-in Explore/Plan/general-purpose agents, `skills` preloading in subagents, `memory` field for persistent cross-session knowledge (user/project/local scopes), foreground/background modes, resume capability via agent ID, `maxTurns` limit, `permissionMode` control, hooks scoped to subagent lifecycle.

#### Table Stakes

| Feature | Why Expected | Complexity | Dependencies |
|---------|--------------|------------|--------------|
| Iterative retrieval for quorum context | Quorum slot workers get a fixed context dump; instead, have them iteratively request more context as needed via Read/Grep/Glob tools | HIGH | Subagent `tools` field (Read, Grep, Glob), quorum slot worker agent definition in `.claude/agents/` |
| Phase-based context accumulation | As phases progress, accumulate relevant context (architecture decisions, test results, API contracts) and inject into subsequent phases | MEDIUM | `nf-precompact.js`, `.planning/context-stack/` directory, PreCompact hook |
| Subagent result summarization | When subagents return, their full output enters main context — large outputs waste context window | LOW | Built-in behavior (subagents already summarize), but nForma can enforce max return size via `maxTurns` |

#### Differentiators

| Feature | Value Proposition | Complexity | Dependencies |
|---------|-------------------|------------|--------------|
| Context stack with relevance scoring | Not all accumulated context is equally relevant — score by recency, citation count, and topic relevance to current task | HIGH | Context accumulation infrastructure, scoring algorithm, `nf-prompt.js` injection |
| Specialized retrieval agents per domain | Instead of generic Explore, create domain-specific retrieval agents (test-retriever, architecture-retriever, formal-model-retriever) with preloaded skills | MEDIUM | `.claude/agents/` directory, `skills` preloading field, domain-specific system prompts |
| Quorum slot workers with persistent memory | Slot workers forget everything between invocations; with `memory: project`, they accumulate project knowledge across quorum rounds | MEDIUM | Subagent `memory` field (native), `.claude/agent-memory/` directory |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Nested subagent spawning | "Let subagents spawn their own subagents" | Claude Code explicitly prohibits this — subagents cannot spawn other subagents; architectural constraint | Chain subagents from main conversation; use skills within subagents for reusable logic |
| Unlimited context injection | "Give the agent everything it might need" | More context != better results; past ~100K tokens, models degrade; irrelevant context causes hallucination | Selective retrieval with relevance scoring; iterative on-demand fetching |
| Shared mutable state between parallel subagents | "Let agents communicate via shared files" | Race conditions, stale reads, conflicting writes — same problems as multi-threaded programming | Immutable context injection from orchestrator; worktree isolation for writes |

---

## Feature Dependencies

```
[Token Optimization: Budget Forecasting]
    └──requires──> [Token Optimization: Task Complexity Classification]
                       └──enables──> [Token Optimization: Dynamic Model Selection]

[Memory Persistence: Structured State]
    └──requires──> [Verification Loops: File-Based State Tracking]
    └──enables──> [Memory Persistence: Proactive Reminders]
                       └──enables──> [Continuous Learning: Error Resolution Extraction]

[Continuous Learning: Skill Extraction]
    └──requires──> [Memory Persistence: Error Resolution Memory]
    └──requires──> [Subagent Orchestration: Specialized Retrieval Agents]

[Parallelization: Worktree Isolation]
    └──requires──> [Subagent Orchestration: Iterative Retrieval] (for merge review)
    └──enables──> [Parallelization: Cascade Method]
                       └──requires──> [Subagent Orchestration: Quorum-Reviewed Merge]

[Verification Loops: Continuous Checks]
    └──requires──> [Token Optimization: Earlier Compaction] (to maintain headroom)
    └──enhances──> [Parallelization: Merge Orchestration] (verify after merge)

[Subagent Orchestration: Context Stack]
    └──enhances──> [Memory Persistence: Multi-Session Learning]
    └──enhances──> [Continuous Learning: Failure Catalog]
```

### Dependency Notes

- **Verification Loops require Token Optimization:** Continuous checks consume context; earlier compaction and context slimming keep headroom for verification overhead.
- **Continuous Learning requires Memory Persistence:** You can't extract and persist patterns without the memory infrastructure to store them.
- **Parallelization requires Subagent Orchestration:** Worktree-based parallel execution needs orchestration for merge review and conflict resolution.
- **Cascade Method requires both Parallelization AND Orchestration:** Multiple parallel implementations need quorum review to select the best result.
- **Context Stack enhances everything downstream:** Better context management improves memory, learning, and verification quality.
- **File-Based State Tracking is foundational:** Both Memory Persistence and Verification Loops need structured sub-task state before they can work.

---

## MVP Definition

### Launch With (v0.30 core)

- [ ] **Earlier compaction at workflow boundaries** — LOW complexity, HIGH value, extends existing `gsd-context-monitor.js` detectCleanBoundary()
- [ ] **Extended thinking budget scaling** — LOW complexity, uses config-loader + additionalContext injection
- [ ] **File-based execution state tracking** — MEDIUM complexity, extends STATE.md, critical foundation for all other patterns
- [ ] **Structured state persistence beyond STATE.md** — MEDIUM complexity, extends `nf-precompact.js` injection with decisions/findings
- [ ] **Error resolution memory** — MEDIUM complexity, leverages native subagent `memory: project` field
- [ ] **Worktree-isolated quorum workers** — MEDIUM complexity, uses native `isolation: worktree` in subagent frontmatter
- [ ] **Phase-based context accumulation** — MEDIUM complexity, new `.planning/context-stack/` with PreCompact injection

### Add After Validation (v0.30.x)

- [ ] **Task-complexity-aware model routing** — when token data shows Opus waste on simple tasks
- [ ] **Continuous test verification during execution** — when file-based state tracking proves stable
- [ ] **Machine-verifiable completion conditions** — when verification checklists are in machine-readable format
- [ ] **Quorum-validated skill extraction** — when memory persistence is working and accumulating data
- [ ] **Iterative retrieval for quorum context** — when worktree isolation works for slot workers
- [ ] **Failure catalog with confidence scores** — when error resolution memory accumulates enough entries
- [ ] **Specialized retrieval agents** — when iterative retrieval pattern is validated

### Future Consideration (v0.31+)

- [ ] **Cascade method (best-of-N parallel implementations)** — HIGH complexity, requires validated parallelization + orchestration
- [ ] **Quorum-gated verification loops** — HIGH complexity, requires continuous verification + quorum integration
- [ ] **Dynamic model selection per subagent type** — requires task complexity classifier + provider reliability data
- [ ] **Project-specific convention extraction from git history** — HIGH complexity, nice-to-have
- [ ] **Context stack with relevance scoring** — HIGH complexity, requires accumulated context data
- [ ] **Formal model re-verification on code change** — HIGH complexity, requires stable three-layer FV pipeline

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Pattern |
|---------|------------|---------------------|----------|---------|
| Earlier compaction at boundaries | HIGH | LOW | P1 | Token Optimization |
| Extended thinking budget scaling | MEDIUM | LOW | P1 | Token Optimization |
| File-based execution state tracking | HIGH | MEDIUM | P1 | Verification Loops |
| Structured state persistence | HIGH | MEDIUM | P1 | Memory Persistence |
| Error resolution memory | HIGH | MEDIUM | P1 | Memory Persistence |
| Worktree-isolated quorum workers | HIGH | MEDIUM | P1 | Parallelization |
| Phase-based context accumulation | MEDIUM | MEDIUM | P1 | Subagent Orchestration |
| Token usage dashboarding | MEDIUM | LOW | P2 | Token Optimization |
| Context window usage forecasting | MEDIUM | MEDIUM | P2 | Token Optimization |
| Task-complexity model routing | HIGH | HIGH | P2 | Token Optimization |
| Continuous test verification | HIGH | MEDIUM | P2 | Verification Loops |
| Machine-verifiable completion conditions | MEDIUM | LOW | P2 | Verification Loops |
| Quorum-validated skill extraction | HIGH | HIGH | P2 | Continuous Learning |
| Iterative retrieval for quorum | HIGH | HIGH | P2 | Subagent Orchestration |
| Failure catalog with confidence scores | MEDIUM | MEDIUM | P2 | Continuous Learning |
| Specialized retrieval agents | MEDIUM | MEDIUM | P2 | Subagent Orchestration |
| Cascade method (best-of-N) | HIGH | HIGH | P3 | Parallelization |
| Quorum-gated verification loops | HIGH | HIGH | P3 | Verification Loops |
| Dynamic model selection per subagent | MEDIUM | HIGH | P3 | Token Optimization |
| Context stack relevance scoring | MEDIUM | HIGH | P3 | Subagent Orchestration |
| Convention extraction from git | LOW | HIGH | P3 | Continuous Learning |

**Priority key:**
- P1: Must have for v0.30 launch — foundational infrastructure that other features build on
- P2: Should have — adds significant value once P1 foundation is stable
- P3: Nice to have — high-complexity differentiators that require validated P1+P2

---

## Competitor/Community Feature Analysis

| Feature Area | Ralph Loop (community) | Claudeception (community) | Claude Code Native (v2.1.49+) | nForma v0.30 Approach |
|-------------|----------------------|-------------------------|-------------------------------|----------------------|
| State persistence | PROGRESS.md + git commits | Skill files in `.claude/skills/` | CLAUDE.md + auto-memory + session memory + subagent `memory` field | Extended STATE.md + context-stack + quorum decision memory + failure catalogs |
| Verification | File-based completion conditions, single-model | None | Built-in test running, subagent resume | Quorum-gated verification + formal model re-checks + machine-verifiable conditions |
| Parallelization | Not supported | Not supported | `--worktree`, `/batch`, `isolation: worktree` | Worktree isolation + cascade method + quorum merge review + dependency-aware decomposition |
| Learning | Not supported | Single-model skill extraction from errors and corrections | `/remember`, auto-memory, skill auto-discovery | Quorum-validated extraction, failure catalogs with confidence scoring |
| Token optimization | Fresh context per iteration (implicit) | None | `--model` flag, subagent model field, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE | Dynamic routing based on task complexity + budget tracking + earlier compaction at boundaries |
| Context management | File-based state only | Skill loading via descriptions | Subagent context isolation, skill preloading, `maxTurns` | Context stack with relevance scoring, iterative retrieval, phase-based accumulation |
| Subagent orchestration | None | None | Built-in Explore/Plan/general-purpose, custom agents, foreground/background | Specialized retrieval agents, quorum workers with memory, iterative context fetching |

---

## Sources

### Official Documentation (HIGH confidence)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents) — subagent frontmatter fields including `isolation`, `memory`, `model`, `skills`, `hooks`, `maxTurns`, `background`
- [Claude Code Skills](https://code.claude.com/docs/en/skills) — skill format, YAML frontmatter, auto-discovery, `context: fork`, `disable-model-invocation`, `user-invocable`
- [Claude Code Memory](https://code.claude.com/docs/en/memory) — CLAUDE.md, auto-memory, session memory, `/remember` command
- [Claude Code Costs](https://code.claude.com/docs/en/costs) — extended thinking budget (31,999 default), model selection, thinking token billing
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows) — worktree support (v2.1.49), `/batch` skill, parallel sessions

### Community/WebSearch (MEDIUM confidence)
- [Ralph Loop / continuous-claude](https://github.com/AnandChowdhary/continuous-claude) — autonomous loop with PRs, Stop hook re-feed
- [Claudeception / continuous-learning-skill](https://github.com/blader/claude-code-continuous-learning-skill) — skill extraction from error resolutions, Voyager-inspired skill library
- [Claude Code Git Worktree Support](https://supergok.com/claude-code-git-worktree-support/) — v2.1.49 feature, `.claude/worktrees/<name>/` storage
- [Parallel Worktrees Plugin](https://github.com/spillwavesolutions/parallel-worktrees) — community worktree orchestration
- [ECC Tools](https://ecc.tools) — automated skill generation from git history analysis

### nForma Internal (HIGH confidence)
- `hooks/gsd-context-monitor.js` — existing context monitoring, smart compact suggestions, `detectCleanBoundary()`
- `bin/budget-tracker.cjs` — existing budget computation, DOWNGRADE_CHAIN (quality->balanced->budget->null)
- `hooks/nf-token-collector.js` — existing per-slot token recording to token-usage.jsonl
- `hooks/nf-precompact.js` — existing STATE.md + pending task injection at compaction
- `hooks/nf-session-start.js` — existing session state reminder via `parseStateForReminder()`
- `hooks/nf-slot-correlator.js` — existing SubagentStart correlation file writing
- `hooks/nf-stop.js` — existing quorum verification gate
- `bin/call-quorum-slot.cjs` — existing quorum slot dispatch

---
*Feature research for: Advanced Agent Patterns (nForma v0.30)*
*Researched: 2026-03-07*
