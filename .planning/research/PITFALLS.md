# Pitfalls Research

**Domain:** Advanced Agent Patterns for Hook-Based Claude Code Extension (nForma v0.30)
**Researched:** 2026-03-07
**Confidence:** HIGH (patterns grounded in existing nForma architecture + verified community reports)

## Critical Pitfalls

### Pitfall 1: Downgrade Loop Oscillation in Dynamic Model Selection

**What goes wrong:**
The existing budget tracker (`bin/budget-tracker.cjs`) uses a linear downgrade chain: `quality -> balanced -> budget -> null`. Adding dynamic model selection for quorum slots creates a second, parallel downgrade axis. When a slot is downgraded to a cheaper model, it produces lower-quality votes, which triggers more deliberation rounds (R3.3), which consumes more tokens, which triggers further downgrades. The system oscillates between "downgrade because of budget" and "upgrade because quality is too low for consensus." This is exactly the kind of oscillation nForma's circuit breaker was built to detect in git history -- but it cannot detect it in model selection because that state lives in `.planning/config.json`, not in git commits.

**Why it happens:**
The budget tracker's `triggerProfileDowngrade()` writes to `.planning/config.json` but has no feedback loop to measure whether the downgrade actually helped. The scoreboard tracks per-slot success rates but doesn't correlate them with the active model profile. Two independent control loops (budget control + quality control) fight each other without coordination.

**How to avoid:**
- Implement a cooldown period after any downgrade (minimum 3 quorum rounds before reconsidering). The existing `DOWNGRADE_CHAIN` object in budget-tracker.cjs should gain a `cooldown_rounds` property.
- Add a downgrade-quality gate: before downgrading, check scoreboard consensus rate for current profile. If consensus rate is already below 70%, do NOT downgrade further -- inject a compaction suggestion instead.
- Unify the two control loops: budget status and quality status should be computed together in a single function, not independently in different hooks.
- Add a `downgrade_history` array to the budget state with timestamps, so the system can detect oscillation patterns (3+ alternating upgrades/downgrades within 10 rounds = freeze at current level).

**Warning signs:**
- Scoreboard shows declining consensus rates correlating with profile changes
- `conformance-events.jsonl` shows rapid alternation of `budget_downgrade` and `quality_warning` events
- Quorum rounds consistently hitting `maxDeliberation` limit after a downgrade

**Phase to address:**
Phase 1 (Dynamic Model Selection). Must be designed into the routing logic from the start -- retrofitting a coordination layer between budget and quality is a rewrite.

---

### Pitfall 2: Memory Bloat in Cross-Session Learning Hooks

**What goes wrong:**
Cross-session memory files grow unbounded. nForma already has `STATE.md`, `conformance-events.jsonl`, the scoreboard, and the debt ledger as persistent state. Adding a pattern extraction store (learned patterns from transcripts) creates a new unbounded growth vector. Within 20-30 sessions, the memory store exceeds what can be usefully injected into context via `additionalContext` in the UserPromptSubmit hook. The `nf-prompt.js` hook already injects quorum instructions, circuit breaker recovery, and pending tasks -- adding memory injection on top risks exceeding the additionalContext budget and diluting critical quorum instructions.

**Why it happens:**
Developers treat "learn and store" as the hard problem and "prune and forget" as a later optimization. But the additionalContext injection path in Claude Code hooks has a practical ceiling: beyond ~4000 tokens of injected context, the signal-to-noise ratio degrades and the agent starts ignoring parts of it. The existing quorum instructions alone are ~800 tokens. The PreCompact hook (`nf-precompact.js`) extracts STATE.md's Current Position section, adding another ~200-500 tokens. Every new injection source competes for the same limited budget.

**How to avoid:**
- Set a hard token budget for memory injection: maximum 1500 tokens total, enforced by truncation at the injection site in `nf-prompt.js`.
- Implement a relevance scorer that selects the top-K patterns (K <= 5) based on the current command type, not a dump of all stored patterns.
- Add a retention policy with automatic pruning: patterns not triggered in 10 sessions get archived; patterns triggered fewer than 2 times get deleted.
- Store patterns in a separate file (`.claude/nf-memory.json`) distinct from STATE.md to keep concerns separated and allow independent pruning.
- Never inject memory patterns during quorum dispatch -- they go only into the primary agent's context, not into slot workers.

**Warning signs:**
- `.claude/nf-memory.json` exceeds 50KB
- The `additionalContext` string in nf-prompt.js output exceeds 3000 tokens
- Agent responses start ignoring quorum instructions (the memory injection is crowding them out)
- Patterns in the store reference files or functions that no longer exist in the codebase

**Phase to address:**
Phase 2 (Cross-Session Learning). The storage format and pruning policy must be part of the initial design, not an afterthought.

---

### Pitfall 3: Stale Patterns Causing Wrong Behavior

**What goes wrong:**
Extracted patterns from past sessions become dangerous when the codebase changes. A pattern like "always run `npm test` after editing hooks/" is correct today but wrong if the test runner changes. Worse, patterns about file locations, API signatures, or configuration keys can actively mislead the agent into making incorrect edits. Unlike hallucinations (which are random), stale patterns are _confidently wrong_ because they were once correct.

**Why it happens:**
Pattern extraction captures a snapshot of "what worked" without anchoring it to the codebase state (git HEAD) at the time. There's no invalidation signal when the underlying code changes. The MEMORY.md auto-memory system has this same problem but is human-curated; automated extraction amplifies the risk because volume is higher and review is absent.

**How to avoid:**
- Tag every extracted pattern with the git commit SHA at extraction time. On injection, check if files referenced by the pattern have changed since that SHA (using `git diff --name-only <sha> HEAD`).
- Implement a "confidence decay" -- patterns lose 10% confidence per session, and are pruned at 0%. Patterns that are re-confirmed (agent follows pattern and succeeds) reset to 100%.
- Separate patterns into "structural" (file paths, commands) which need git-based invalidation, and "behavioral" (workflow preferences) which decay more slowly.
- Run a lightweight validation pass on SessionStart: for each top-K pattern about to be injected, verify that referenced files still exist. Drop any pattern referencing deleted files.

**Warning signs:**
- Agent edits files that don't exist (following a stale path pattern)
- Agent uses deprecated command syntax from a stored pattern
- `git diff` shows the pattern was extracted 20+ commits ago with no revalidation

**Phase to address:**
Phase 2 (Cross-Session Learning). Invalidation must be part of the storage schema from day one.

---

### Pitfall 4: Verification Performance Overhead Blocking Execution

**What goes wrong:**
nForma's formal verification pipeline (TLA+/Alloy/PRISM) already runs at plan-phase step 8.2 and in execute-phase gates. Adding continuous verification during execution (checking file changes, running lint passes, running subset tests after each edit) transforms verification from a gate into a tax on every tool call. The PostToolUse hook (`gsd-context-monitor.js`) already processes every tool call for context monitoring. Adding verification checks to this path means every `Write` or `Edit` tool call triggers verification, adding 2-30 seconds per call depending on the check type. A typical phase execution with 40-60 tool calls goes from 5 minutes to 15-25 minutes.

**Why it happens:**
The "shift left" instinct -- verify earlier to catch problems sooner -- is correct in principle but catastrophic when applied uniformly. Not every file edit needs immediate verification. The existing formal verification pipeline runs at well-defined gates (plan-phase, execute-phase end). Adding continuous verification without selectivity turns every tool call into a gate.

**How to avoid:**
- Verify only on _accumulation boundaries_, not individual tool calls. Define boundaries as: (a) after 5+ file writes, (b) after a test file is modified, (c) after a config file is modified, (d) on `phase-complete` (already done via `detectCleanBoundary` in gsd-context-monitor.js).
- Use a verification queue, not inline checks. Buffer file changes and run verification in a single batch at the next boundary, not synchronously on each PostToolUse event.
- Set a verification budget per phase: maximum 3 continuous verification runs per phase execution. Each run checks all accumulated changes since the last run.
- Make continuous verification advisory-only (inject warnings via `additionalContext`), not blocking. Reserve hard blocks for the existing formal gates at phase end.

**Warning signs:**
- Phase execution time more than doubles after enabling continuous verification
- The PostToolUse hook's execution time exceeds 5 seconds (measured via conformance events)
- Agent starts avoiding file edits to reduce verification triggers (gaming the system)

**Phase to address:**
Phase 3 (Continuous Verification). Must implement the batching/boundary strategy before enabling any continuous checks.

---

### Pitfall 5: Git Worktree Shared State Corruption

**What goes wrong:**
Git worktrees share the `.git` directory, `hooks/`, and any files referenced by absolute path. nForma's hooks read from `~/.claude/nf.json` (global config), `~/.claude/hooks/` (installed hooks), and write to `.planning/` (project state). When multiple Claude Code agents run in parallel worktrees, they all write to the same `.planning/STATE.md`, the same `.planning/conformance-events.jsonl`, and the same scoreboard. Two agents updating STATE.md simultaneously produces corrupted JSON or lost state transitions. The circuit breaker state file (`.claude/circuit-breaker-state.json`) is per-worktree (relative path), but the scoreboard and conformance events are not.

**Why it happens:**
nForma was designed for single-agent execution. Every hook assumes exclusive access to `.planning/` state files. `fs.writeFileSync` is atomic for the write itself but not for read-modify-write cycles. Two agents reading STATE.md, modifying it, and writing it back will lose one agent's changes. Claude Code's native worktree support (v2.1.49) creates isolated file trees but does NOT isolate nForma's shared state.

**How to avoid:**
- Scope ALL mutable state files to the worktree. Each worktree should write to `.planning/worktree-<name>/` instead of `.planning/` directly.
- Use file locking (advisory locks via `flock`) for any shared state that genuinely needs to be shared (e.g., the scoreboard). The scoreboard already uses `appendFileSync` for JSONL but does read-modify-write for JSON state.
- Add a worktree detection guard at the top of every hook: `git rev-parse --git-common-dir` returns a different path from `git rev-parse --git-dir` when running in a worktree. Use this to namespace state file paths.
- Merge worktree-scoped state back into main `.planning/` only on worktree removal, using a three-way merge strategy.
- Do NOT share circuit breaker state across worktrees. Each worktree has independent oscillation patterns.

**Warning signs:**
- STATE.md contains malformed JSON or duplicate section headers
- Conformance events show interleaved timestamps from different agent sessions
- Scoreboard data shows impossible state transitions (two phases "active" simultaneously)
- Worktree cleanup fails because state files are locked by another process

**Phase to address:**
Phase 4 (Git Worktree Parallelization). State isolation must be the first implementation step, before spawning any parallel agents.

---

### Pitfall 6: Worktree Cleanup Failures Leaking Disk Space

**What goes wrong:**
`git worktree remove` fails silently when there are uncommitted changes, untracked files, or locked files in the worktree. Claude Code agents frequently leave temporary files, `.planning/` artifacts, and node_modules in worktrees. A single failed cleanup is invisible. Over many sessions, leaked worktrees accumulate, consuming disk at the rate of the full repo size per worktree. Community reports confirm 2GB codebases creating 10GB of leaked worktrees in 20-minute sessions.

**Why it happens:**
`git worktree remove` requires `--force` to remove worktrees with modifications, but force-removing loses uncommitted work. There's no "clean up but preserve work" operation. Claude Code's native WorktreeRemove hook fires but doesn't guarantee cleanup success. nForma's install sync pattern (copy to `hooks/dist/`, run `bin/install.js`) doesn't account for worktree-scoped installations.

**How to avoid:**
- Implement a pre-removal checklist in the WorktreeRemove hook: (1) commit or stash all changes, (2) merge state back to main `.planning/`, (3) remove node_modules and temp files, (4) then `git worktree remove --force`.
- Add a periodic cleanup sweep: on SessionStart, run `git worktree list --porcelain` and remove any worktrees older than 24 hours or whose creating session no longer exists.
- Set a maximum concurrent worktree limit (default: 3). Refuse to create new worktrees until old ones are cleaned.
- Track worktree creation in a manifest file (`.claude/worktree-manifest.json`) with creation timestamps and session IDs.

**Warning signs:**
- `git worktree list` shows more than 3 entries
- Disk usage increases by repo-size multiples between sessions
- `git worktree prune` reports removed stale entries (indicates previous cleanup failures)

**Phase to address:**
Phase 4 (Git Worktree Parallelization). Cleanup must be part of the worktree lifecycle from the start.

---

### Pitfall 7: Iterative Retrieval Token Explosion in Slot Workers

**What goes wrong:**
The quorum slot worker is currently a "thin JavaScript passthrough" (11-12k tokens). Adding iterative retrieval (allow the slot worker to read files, search code, fetch context before voting) transforms it from a stateless function into a stateful agent with its own context window. Each retrieval round adds ~2-5k tokens of file content. With 3-4 slots each doing 2-3 retrieval rounds, a single quorum call balloons from ~36k total tokens (3 slots x 12k) to ~120k+ tokens (3 slots x 12k base + 3 slots x 3 rounds x 5k retrieved). This exceeds the budget for a single quorum call and can trigger the budget tracker's downgrade, creating a compounding problem (see Pitfall 1).

**Why it happens:**
Retrieval feels "free" -- reading a file doesn't cost API tokens. But the retrieved content enters the slot worker's context and must be processed by the backing model. Each retrieval round's output becomes input for the next round. Without a token budget per slot, retrieval expands to fill the available context window. The current `session_limit_tokens` budget in `budget-tracker.cjs` tracks the primary session, not individual slot workers.

**How to avoid:**
- Set a per-slot retrieval token budget: maximum 8k tokens of retrieved content per slot per quorum call. Track this in the slot worker dispatch, not in the global budget tracker.
- Limit retrieval rounds: maximum 2 rounds per slot. The first round retrieves, the second round can refine, then the slot must vote.
- Implement a retrieval cache shared across slots: if slot-1 retrieves file X, slot-2 and slot-3 should reuse the cached content, not re-retrieve it. Store in a temp file (`.claude/quorum-retrieval-cache-<HEAD>.json`) keyed by file path + git HEAD.
- Make retrieval opt-in per quorum call via a `retrieval_depth` parameter: `none` (current behavior), `shallow` (1 round, 4k budget), `deep` (2 rounds, 8k budget). Default to `none` for backward compatibility.

**Warning signs:**
- Quorum calls taking >60 seconds (previously ~20 seconds)
- Slot worker token consumption exceeding 20k per call (visible in JSONL telemetry)
- Budget tracker triggering downgrades during quorum calls specifically
- `check-mcp-health.cjs` showing increased latency on quorum-heavy workflows

**Phase to address:**
Phase 5 (Iterative Retrieval). The token budget must be enforced before enabling any retrieval in slot workers.

---

### Pitfall 8: Context Drift in Iterative Retrieval Loops

**What goes wrong:**
An iterative retrieval agent starts with a clear question ("Is this code safe?"), retrieves relevant files, then formulates a follow-up question based on what it found. Each round's question drifts further from the original intent. By round 3, the agent is investigating a tangentially related module and has forgotten the original question. This is particularly dangerous in quorum slot workers because the drifted vote doesn't address the actual quorum question, making consensus impossible.

**Why it happens:**
LLMs exhibit "attention dilution" as context grows -- the original question gets buried under retrieved content. Without explicit goal anchoring, the model's next retrieval query is generated from the most recent content (recency bias), not from the original question. Community reports confirm that after 30+ minutes, agents act as if the system prompt never existed.

**How to avoid:**
- Pin the original quorum question at the top of every retrieval round's prompt, not just the first round. Use a structured format: `ORIGINAL QUESTION: <question>\nRETRIEVAL ROUND: <N>\nPREVIOUS FINDINGS: <summary>\nNEXT RETRIEVAL: <what to look for>`.
- Implement a relevance gate: after each retrieval, score the retrieved content's relevance to the ORIGINAL question (0-1). If relevance drops below 0.5, stop retrieval and vote with current knowledge.
- Summarize previous findings between rounds instead of carrying raw retrieved content forward. This compresses the context and forces the model to distill what it learned.
- Add a hard maximum of 2 retrieval rounds (see Pitfall 7) -- this is both a token budget control AND a drift prevention measure.

**Warning signs:**
- Slot workers returning votes that don't address the quorum question
- Retrieval queries in round 3+ that share no keywords with the original question
- Consensus rate dropping when retrieval is enabled vs. disabled

**Phase to address:**
Phase 5 (Iterative Retrieval). Goal anchoring must be built into the retrieval prompt template.

---

### Pitfall 9: Compaction Storm from Aggressive Triggering

**What goes wrong:**
The existing compaction trigger fires at ~167k tokens (83.5% of 200k). Moving this threshold earlier (e.g., 60%) to "preserve more working memory" means compaction fires more frequently. Each compaction discards conversation history and forces the agent to re-read files it needs. The re-reading consumes tokens, pushing toward the next compaction threshold. This creates a "compaction storm" -- rapid repeated compactions that destroy session coherence. The PreCompact hook (`nf-precompact.js`) preserves STATE.md's Current Position, but everything else (file contents, reasoning chains, quorum deliberation context) is lost.

**Why it happens:**
The intuition "compact earlier = more room to work" is backwards. Earlier compaction means less accumulated context before each compaction, which means the summary is thinner, which means more re-reading is needed, which fills context faster. The optimal compaction threshold depends on the workflow phase: planning phases need more context (deliberation history), execution phases need less (they reference PLAN.md, not history).

**How to avoid:**
- Do NOT use a fixed lower threshold. Instead, use workflow-aware compaction timing. The `detectCleanBoundary()` function in `gsd-context-monitor.js` already identifies `phase_complete`, `verification_done`, and `commit` boundaries. Trigger compaction at these boundaries when above 70%, not at a fixed percentage.
- Before compaction, checkpoint critical context to a file. Write the current quorum deliberation state, active file set, and key decisions to `.claude/pre-compact-checkpoint.json`. The SessionStart hook can re-inject this on the post-compaction resume.
- Never trigger compaction mid-quorum. If a quorum deliberation is in progress (detectable by checking for open slot worker tasks), delay compaction until deliberation completes. Compacting during quorum loses the votes already collected.
- Use `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` to set the threshold dynamically per workflow phase, not globally.

**Warning signs:**
- More than 2 compactions per phase execution (normal is 0-1)
- Conformance events showing `compact` events less than 5 minutes apart
- Agent repeatedly re-reading the same files after compaction
- Plan execution regressing (re-doing completed steps) after compaction

**Phase to address:**
Phase 6 (Earlier Compaction). This should be the LAST phase because it requires understanding from all previous phases (what context each feature needs to preserve).

---

### Pitfall 10: Premature Context Loss Destroying Quorum State

**What goes wrong:**
Earlier compaction discards quorum deliberation transcripts. If compaction fires between "slot workers dispatched" and "consensus synthesized," the primary agent loses the votes it collected. The Stop hook (`nf-stop.js`) scans the current-turn transcript for quorum evidence. After compaction, the transcript is gone. The Stop hook sees no quorum evidence and blocks the response. The agent is stuck: it ran quorum, lost the evidence to compaction, and can't deliver its output.

**Why it happens:**
The Stop hook's `getCurrentTurnLines()` function searches backward from the end of the transcript for the last human message, then checks for quorum tool calls in that window. Compaction replaces the transcript with a summary that does not contain the raw tool call entries the Stop hook searches for. The PreCompact hook preserves STATE.md but NOT quorum evidence.

**How to avoid:**
- Add quorum evidence to the PreCompact hook's preservation set. Before compaction, extract the quorum decision token (`<!-- GSD_DECISION -->`) and slot worker results and write them to `.claude/quorum-evidence-<timestamp>.json`. The Stop hook should check this file as a fallback when transcript scanning finds nothing.
- Implement a compaction lockout during quorum: set a flag file (`.claude/quorum-in-progress`) when quorum dispatch starts, clear it when the decision is delivered. The context monitor's compaction suggestion logic should check for this flag and suppress suggestions.
- The `nf-prompt.js` hook's quorum instructions should include a directive: "If you detect recent compaction (via SessionStart event or thin context), re-check `.claude/quorum-evidence-*.json` before re-running quorum."

**Warning signs:**
- Stop hook blocking responses immediately after compaction
- Agent re-running quorum for a decision it already made
- `quorum-in-progress` flag file persisting across sessions (cleanup failure)

**Phase to address:**
Phase 6 (Earlier Compaction). Must be solved before lowering the compaction threshold.

---

### Pitfall 11: Hook Execution Order Conflicts with New Hooks

**What goes wrong:**
nForma currently has 4 hooks: `nf-prompt.js` (UserPromptSubmit), `nf-stop.js` (Stop), `nf-circuit-breaker.js` (PreToolUse), and `gsd-context-monitor.js` (PostToolUse). Adding new hooks for cross-session learning (SessionStart), continuous verification (PostToolUse), and compaction control (PreCompact) means multiple hooks on the same event type. Claude Code runs hooks on the same event sequentially but in filesystem-sort order. If `gsd-context-monitor.js` and a new `nf-continuous-verify.js` both run on PostToolUse, their `additionalContext` outputs may conflict or exceed the injection budget.

**Why it happens:**
Claude Code's hook system doesn't have a priority or composition model. Each hook on the same event type runs independently and returns its own output. If two hooks both set `additionalContext`, the later one may overwrite the earlier one (depending on Claude Code's merge behavior). The existing hooks avoid this because they're on different event types. Adding hooks to already-occupied event types creates the conflict.

**How to avoid:**
- Consolidate all PostToolUse logic into a single hook (`gsd-context-monitor.js`). Add continuous verification as a module imported by the existing hook, not as a separate hook. This maintains single-writer semantics for `additionalContext`.
- If separate hooks are unavoidable, implement a shared output bus: each hook writes its contribution to `.claude/hook-output-<event>-<hook>.json`. A final "compositor" hook reads all contributions, merges them with budget enforcement, and produces the single `additionalContext` output.
- Document the hook execution order explicitly in install.js. Use numeric prefixes if needed (`01-nf-prompt.js`, `02-nf-continuous-verify.js`) to guarantee order.
- Test multi-hook scenarios in the hook test suite. The existing tests verify single-hook behavior; add integration tests for hook composition.

**Warning signs:**
- `additionalContext` in hook output is empty or missing expected content
- Two hooks logging conflicting actions in conformance events for the same tool call
- Budget tracker and continuous verifier both trying to inject warnings simultaneously

**Phase to address:**
Phase 1 or Phase 3 (whichever adds the first new hook to an existing event type). Must be addressed before any new hook is added.

---

### Pitfall 12: Privacy Leakage in Cross-Session Pattern Store

**What goes wrong:**
Pattern extraction from transcripts captures code snippets, file paths, API keys (if they appeared in error messages), user names, and project-specific information. If the pattern store (`.claude/nf-memory.json`) is not gitignored, it leaks into version control. Even if gitignored, it persists on disk and could be read by other tools or agents. The existing security sweep (`nf-stop.js` security scanning) checks for secrets in code files but not in nForma's own state files.

**Why it happens:**
Pattern extraction is designed to capture "what worked" without filtering for sensitive content. Error messages often contain environment variables, file paths with usernames, and API endpoint URLs. The existing `.gitignore` covers `.claude/circuit-breaker-state.json` but may not cover new state files.

**How to avoid:**
- Run the existing security sweep regex patterns against every extracted pattern before storing it. Reject any pattern that matches secret/key/token patterns.
- Gitignore ALL files in `.claude/nf-memory*` explicitly.
- Never store raw code snippets in patterns. Store only structural descriptions: "when editing file X, also update file Y" not "change `const key = 'abc123'` to ...".
- Add a `sanitize()` function that strips absolute paths (replace with relative), removes email addresses, and redacts anything matching `[A-Za-z0-9+/=]{32,}` (base64-encoded secrets).

**Warning signs:**
- `.claude/nf-memory.json` appears in `git status` as untracked
- Pattern store contains absolute paths with `/Users/<username>/`
- Pattern store entries contain strings matching the security sweep's regex patterns

**Phase to address:**
Phase 2 (Cross-Session Learning). Sanitization must be in the extraction pipeline, not a post-processing step.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Global mutable state files for worktree agents | No architecture change needed | Race conditions, data corruption, lost state | Never -- worktree isolation is a prerequisite |
| Injecting all learned patterns into context | Simple implementation | Token waste, attention dilution, quorum instruction crowding | During initial prototype only, must add selection within same milestone |
| Synchronous verification on every tool call | Maximum coverage | 3-5x execution time increase | Never -- use batched boundary verification |
| Hardcoded compaction threshold | Simple to configure | Wrong for different workflow phases | MVP only; must add workflow-aware thresholds before production use |
| Unbounded retrieval in slot workers | Maximum context for voting | Token explosion, budget cascade, latency spike | Never -- per-slot budgets are mandatory |
| Separate hooks per event type | Cleaner code organization | additionalContext conflicts, execution order bugs | Only if a compositor/merge layer is implemented first |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Budget tracker + dynamic model selection | Two independent control loops fighting each other | Unified decision function that considers both budget and quality |
| PreCompact hook + quorum state | Compaction destroys quorum evidence the Stop hook needs | Checkpoint quorum evidence to file before compaction; Stop hook checks file as fallback |
| Worktree hooks + nForma state | Assuming `.planning/` is worktree-scoped (it's not -- `.git` is shared) | Detect worktree via `git rev-parse --git-common-dir` and namespace state paths |
| Continuous verification + context monitor | Two PostToolUse hooks with conflicting additionalContext | Consolidate into single hook or implement compositor pattern |
| Cross-session memory + quorum injection | Memory injection crowding out quorum instructions in additionalContext | Hard token budget for memory (1500 tokens max); quorum instructions always take priority |
| Iterative retrieval + slot worker token budget | Retrieval costs invisible to global budget tracker | Per-slot retrieval budget tracked at dispatch site, not in global tracker |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Continuous verification on every Write/Edit | Phase execution time 3-5x longer | Batch verification at accumulation boundaries (5+ writes) | Immediately -- even first use is too slow |
| Unbounded cross-session memory injection | additionalContext exceeds useful size, quorum instructions ignored | Hard 1500-token cap with relevance-based selection | At ~20 stored patterns (~5 sessions) |
| Per-slot iterative retrieval | Single quorum call exceeds 120k tokens, triggers budget downgrade | Per-slot 8k retrieval budget, max 2 rounds, shared cache | At 3+ slots with 3+ retrieval rounds |
| Git worktree creation without cleanup | Disk space grows by repo-size per session | Manifest tracking, 24h cleanup sweep, max 3 concurrent limit | After 5-10 sessions without cleanup |
| Compaction storm from low threshold | Rapid repeated compactions, coherence loss, re-reading loops | Workflow-aware thresholds, boundary-triggered compaction | When threshold is below 65% for planning-heavy workflows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing raw transcript excerpts in pattern memory | API keys, secrets, PII in error messages captured and persisted | Sanitize before storage; run security sweep regex on every pattern |
| Pattern store not gitignored | Sensitive learned patterns committed to repo | Explicitly gitignore `.claude/nf-memory*`; add to install.js cleanup |
| Worktree agents sharing credential state | One agent's credential rotation invalidates another agent's session | Per-worktree credential isolation or read-only credential access for worktree agents |
| Retrieval cache containing sensitive file content | Cached file content persists in `.claude/quorum-retrieval-cache-*.json` | Key cache by git HEAD (auto-invalidates), clean on session end |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent model downgrade without notification | User doesn't know quality dropped; confused by worse results | Inject visible advisory: "Model profile downgraded from quality to balanced (budget at 87%)" |
| Compaction destroying in-progress work | User loses context mid-task, must re-explain | Compaction lockout during quorum; checkpoint before compact |
| Worktree agents producing conflicting changes | Merge conflicts on worktree close; user must manually resolve | Pre-merge conflict detection before worktree removal |
| Learned patterns overriding user intent | Agent follows stored pattern instead of current instruction | User instructions always override stored patterns; add `/nf:forget` command |
| Verification false positives blocking execution | Agent stuck on advisory warnings, can't proceed | Advisory-only continuous verification; hard blocks only at phase gates |

## "Looks Done But Isn't" Checklist

- [ ] **Dynamic model selection:** Often missing downgrade cooldown -- verify that 3+ consecutive downgrades are impossible without a cooldown gap
- [ ] **Cross-session memory:** Often missing pruning -- verify that the pattern store has a retention policy and maximum size limit
- [ ] **Cross-session memory:** Often missing sanitization -- verify that no stored pattern contains absolute paths, secrets, or PII
- [ ] **Continuous verification:** Often missing batching -- verify that verification runs at boundaries, not on every tool call
- [ ] **Continuous verification:** Often missing quorum lockout -- verify that verification doesn't trigger during active quorum deliberation
- [ ] **Git worktrees:** Often missing state isolation -- verify that `.planning/` writes are worktree-scoped, not shared
- [ ] **Git worktrees:** Often missing cleanup -- verify that `git worktree list` shows no stale entries after session end
- [ ] **Iterative retrieval:** Often missing token budget -- verify that per-slot retrieval is capped at 8k tokens
- [ ] **Iterative retrieval:** Often missing goal anchoring -- verify that the original question appears in every retrieval round's prompt
- [ ] **Earlier compaction:** Often missing quorum evidence preservation -- verify that Stop hook still finds quorum evidence after compaction
- [ ] **Earlier compaction:** Often missing workflow awareness -- verify that compaction threshold adapts to workflow phase
- [ ] **Hook composition:** Often missing additionalContext merge testing -- verify that multiple hooks on the same event produce coherent combined output

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Downgrade loop oscillation | LOW | Freeze model profile at current level; add cooldown logic; re-run failed quorum |
| Memory bloat | LOW | Truncate pattern store to top-K by recency; add size limit; re-test injection |
| Stale patterns causing errors | MEDIUM | Clear pattern store (`rm .claude/nf-memory.json`); add git-SHA invalidation; re-extract from recent sessions only |
| Verification performance overhead | LOW | Disable continuous verification via hook profile (`minimal`); restore boundary-only checking |
| Worktree state corruption | HIGH | Manually merge corrupted `.planning/` state; remove all worktrees; re-create from clean state |
| Worktree disk leak | LOW | `git worktree list` + manual remove; add cleanup sweep to SessionStart |
| Token explosion in retrieval | MEDIUM | Kill active slot workers; reduce retrieval_depth to `none`; add per-slot budget enforcement |
| Context drift in retrieval | LOW | Disable retrieval; fall back to current thin-passthrough slot workers |
| Compaction storm | LOW | Reset `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` to default; remove custom threshold |
| Quorum evidence lost to compaction | MEDIUM | Re-run quorum for the blocked decision; add evidence checkpointing to PreCompact hook |
| Hook additionalContext conflict | MEDIUM | Consolidate conflicting hooks into single hook; test combined output |
| Privacy leakage in patterns | HIGH | Delete pattern store; audit git history for committed patterns; add sanitization pipeline |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Downgrade loop oscillation | Phase 1: Dynamic Model Selection | Scoreboard shows no >3 consecutive downgrades; conformance events show cooldown gaps |
| Memory bloat | Phase 2: Cross-Session Learning | Pattern store stays under 50KB; additionalContext under 3000 tokens total |
| Stale patterns | Phase 2: Cross-Session Learning | Patterns tagged with git SHA; patterns referencing deleted files are auto-pruned |
| Privacy leakage | Phase 2: Cross-Session Learning | Security sweep on pattern store finds 0 matches; no absolute paths in stored patterns |
| Verification overhead | Phase 3: Continuous Verification | Phase execution time increases by <30% vs. baseline; verification runs <= 3 per phase |
| Hook composition conflicts | Phase 3: Continuous Verification | Integration test with 2 PostToolUse hooks producing merged additionalContext |
| Worktree state corruption | Phase 4: Git Worktree Parallelization | 2 parallel agents write to scoped paths; no data loss after 10 concurrent sessions |
| Worktree cleanup failures | Phase 4: Git Worktree Parallelization | `git worktree list` returns only main + active worktrees after cleanup |
| Token explosion in retrieval | Phase 5: Iterative Retrieval | Per-slot token consumption stays under 20k; quorum call under 60k total |
| Context drift in retrieval | Phase 5: Iterative Retrieval | Slot worker votes address the original quorum question (verified by consensus rate) |
| Compaction storm | Phase 6: Earlier Compaction | Maximum 2 compactions per phase; no compactions closer than 5 minutes apart |
| Quorum evidence lost to compaction | Phase 6: Earlier Compaction | Stop hook finds quorum evidence after compaction via checkpoint file fallback |

## Sources

- [Parallel Development with Claude Code and Git Worktrees](https://medium.com/@ooi_yee_fei/parallel-ai-development-with-git-worktrees-f2524afc3e33) -- worktree isolation issues, disk consumption
- [Git worktrees for parallel AI coding agents (Upsun)](https://devcenter.upsun.com/posts/git-worktrees-for-parallel-ai-coding-agents/) -- worktree lifecycle management
- [Claude Code Git Worktree Support (SuperGok)](https://supergok.com/claude-code-git-worktree-support/) -- native worktree support, unintended creation bugs
- [Claude Code Worktrees: Run Parallel Sessions Without Conflicts](https://claudefa.st/blog/guide/development/worktree-guide) -- database isolation gaps
- [Memory Management in LLM Agents (Martin Keywood)](https://medium.com/@martinkeywood/memory-management-in-llm-agents-how-i-stopped-my-agents-from-becoming-goldfish-00afc2c5d420) -- memory bloat, pruning strategies
- [Cross-Session Agent Memory: Foundations and Challenges](https://mgx.dev/insights/cross-session-agent-memory-foundations-implementations-challenges-and-future-directions/d03dd30038514b75ad4cbbda2239c468) -- stale patterns, error propagation
- [Agent Memory Architecture (DEV Community)](https://dev.to/mfs_corp/agent-memory-architecture-how-our-ai-remembers-across-sessions-j8l) -- transient vs persistent memory separation
- [LLM Tool-Calling in Production: The Infinite Loop Failure Mode](https://medium.com/@komalbaparmar007/llm-tool-calling-in-production-rate-limits-retries-and-the-infinite-loop-failure-mode-you-must-2a1e2a1e84c8) -- loop guardrails, hard termination
- [Solving agent system prompt drift in long sessions](https://community.openai.com/t/solving-agent-system-prompt-drift-in-long-sessions-a-300-token-fix/1375139) -- context drift, goal anchoring
- [Claude Code Context Buffer: The 33K-45K Token Problem](https://claudefa.st/blog/guide/mechanics/context-buffer-management) -- compaction thresholds, reserved buffer
- [Why Claude Loses Context After Compaction](https://docs.bswen.com/blog/2026-02-09-claude-context-loss-compaction/) -- compaction recovery strategies
- [Compaction (Claude API Docs)](https://platform.claude.com/docs/en/build-with-claude/compaction) -- official compaction behavior
- [Dynamic Model Routing and Cascading for Efficient LLM Inference: A Survey](https://arxiv.org/abs/2603.04445) -- routing paradigms, capability mismatch
- [AgentSpec: Customizable Runtime Enforcement for Safe LLM Agents (ICSE 2026)](https://cposkitt.github.io/files/publications/agentspec_llm_enforcement_icse26.pdf) -- verification overhead measurements (~430ms per decision cycle)
- nForma source: `bin/budget-tracker.cjs` -- existing downgrade chain logic
- nForma source: `hooks/gsd-context-monitor.js` -- existing boundary detection
- nForma source: `hooks/nf-precompact.js` -- existing compaction state preservation
- nForma source: `hooks/nf-stop.js` -- existing transcript scanning for quorum evidence
- nForma source: `hooks/nf-circuit-breaker.js` -- existing oscillation detection patterns

---
*Pitfalls research for: Advanced Agent Patterns (nForma v0.30)*
*Researched: 2026-03-07*
