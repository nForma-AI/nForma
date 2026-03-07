# Stack Research

**Domain:** Advanced Claude Code agent patterns for nForma plugin
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

This research identifies what stack additions are needed for six advanced agent capabilities. The core finding is that **zero new npm dependencies are required**. All six patterns can be implemented using Node.js built-ins (`fs`, `path`, `child_process`, `crypto`), existing infrastructure (hooks, config-loader, scoreboard, token-usage.jsonl), and Claude Code's native hook events (including the recently added `WorktreeCreate`/`WorktreeRemove` events). The existing XState machine (`src/machines/nf-workflow.machine.ts`) provides the state machine pattern but is a devDependency used for TLA+ generation -- runtime state machines for continuous verification should use plain JSON file-based FSMs consistent with the CommonJS hook architecture.

## Recommended Stack

### Core Technologies (Already Present -- No Changes)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >= 16.7.0 | Runtime for all hooks and bin/ scripts | Already required by package.json engines field |
| CommonJS modules | N/A | Module system for hooks | Project convention; ESM only for unified-mcp-server.mjs |
| Claude Code Hooks API | Current | Lifecycle integration points | Native support for all 6 patterns via existing event types |
| XState | ^5.28.0 | State machine definitions (devDep only) | Already used for formal verification spec generation |

### New Bin Scripts Required

| Script | Purpose | Hook Integration | Dependencies |
|--------|---------|------------------|--------------|
| `bin/model-selector.cjs` | Dynamic model downgrade based on token metrics | Called by `gsd-context-monitor.js` (PostToolUse) | `fs`, `path` only -- reads token-usage.jsonl + scoreboard |
| `bin/transcript-indexer.cjs` | Cross-session learning: index transcripts, extract patterns | Called by `nf-session-start.js` (SessionStart) or standalone CLI | `fs`, `path`, `crypto` -- JSONL parsing, SHA-based dedup |
| `bin/cv-state-machine.cjs` | Continuous verification state transitions | Called by `gsd-context-monitor.js` (PostToolUse) at boundaries | `fs`, `path` -- JSON file-based FSM |
| `bin/worktree-manager.cjs` | Git worktree lifecycle for parallel executors | Called by WorktreeCreate/WorktreeRemove hooks | `child_process.spawnSync`, `fs`, `path` |
| `bin/retrieval-loop.cjs` | Iterative retrieval orchestration for subagents | Called from agent definitions or inline by nf-prompt.js | `fs`, `path` -- reads retrieval config |
| `bin/compact-trigger.cjs` | Earlier compaction triggering based on task boundaries | Called by `gsd-context-monitor.js` (PostToolUse) | `fs`, `path` -- reads context_window metrics |

### New Hooks Required

| Hook | Event Type | Purpose | Integration Point |
|------|-----------|---------|-------------------|
| `hooks/nf-worktree-create.js` | WorktreeCreate | Custom worktree creation with nForma state isolation | `.claude/settings.json` WorktreeCreate |
| `hooks/nf-worktree-remove.js` | WorktreeRemove | Cleanup worktree + merge results back | `.claude/settings.json` WorktreeRemove |

### Config Additions to `config-loader.js` DEFAULT_CONFIG

| Config Key | Type | Default | Purpose |
|------------|------|---------|---------|
| `model_downgrade.enabled` | boolean | `true` | Master switch for dynamic model selection |
| `model_downgrade.token_budget_pct` | integer | `70` | Token usage % threshold to trigger downgrade |
| `model_downgrade.chain` | object | `{opus:'sonnet', sonnet:'haiku'}` | Downgrade sequence per model tier |
| `cross_session.enabled` | boolean | `false` | Master switch for transcript indexing |
| `cross_session.index_path` | string | `'.planning/.session-index'` | Where session index lives |
| `cross_session.max_patterns` | integer | `50` | Cap on stored patterns to avoid bloat |
| `cv.enabled` | boolean | `true` | Continuous verification master switch |
| `cv.state_path` | string | `'.planning/cv-state.json'` | Verification FSM state file |
| `cv.gates` | string[] | `['lint','test','type-check']` | Verification checks to run |
| `worktree.enabled` | boolean | `false` | Master switch for worktree isolation |
| `worktree.max_concurrent` | integer | `3` | Maximum parallel worktrees |
| `worktree.base_dir` | string | `'~/.claude/nf-worktrees'` | Where worktrees are created |
| `compact_trigger.context_pct` | integer | `50` | Earlier compaction threshold (vs current 60%) |
| `compact_trigger.boundary_types` | string[] | `['phase_complete','commit','verification_done']` | Clean boundaries for auto-compact |

## Capability-by-Capability Analysis

### 1. Dynamic Model Downgrade (Token-Based)

**What exists:** `budget-tracker.cjs` already does profile downgrade (quality -> balanced -> budget). `gsd-context-monitor.js` already calls it from PostToolUse. `nf-token-collector.js` writes per-slot token records to `token-usage.jsonl`.

**What's needed:** Extend the downgrade logic to use actual token-usage.jsonl data instead of just context window percentage. The current `computeBudgetStatus()` estimates tokens from context % (`usedPct / 100 * 200000`), which is crude. A new `model-selector.cjs` should:
1. Read `token-usage.jsonl`, sum input+output tokens for current session
2. Compare against `budget.session_limit_tokens` from config
3. When threshold crossed, write downgrade to `.planning/config.json` (existing path -- `budget-tracker.cjs` already does this)
4. Optionally adjust `quorum.maxSize` to reduce fan-out when tokens are expensive

**Hook integration:** PostToolUse via `gsd-context-monitor.js` -- add a call to `model-selector.cjs` alongside the existing `budget-tracker.cjs` call. No new hook needed.

**Config integration:** Extend existing `budget` config section. The `DOWNGRADE_CHAIN` in `budget-tracker.cjs` already defines the sequence.

**Confidence:** HIGH -- extends existing proven pattern.

### 2. Cross-Session Learning (Transcript Indexing)

**What exists:** `nf-session-start.js` already reads STATE.md for session resumption. `nf-token-collector.js` reads subagent transcripts. `nf-precompact.js` saves context before compaction. Transcript JSONL format is well-understood (used by nf-stop.js for quorum verification).

**What's needed:** A `transcript-indexer.cjs` that:
1. On SessionStart (or SessionEnd), scans the transcript JSONL
2. Extracts "patterns" -- recurring tool sequences, common errors, successful resolution strategies
3. Writes to a persistent index at `.planning/.session-index/patterns.jsonl`
4. On subsequent SessionStart, injects relevant patterns as `additionalContext`

**Pattern extraction approach:** No NLP library needed. Use structural pattern matching:
- Extract tool_use sequences (what tools were called in what order)
- Extract error -> resolution pairs (PostToolUseFailure followed by successful retry)
- Hash patterns with `crypto.createHash('sha256')` for dedup
- Store as JSONL with `{hash, pattern_type, pattern_data, frequency, last_seen}`

**Hook integration:** `nf-session-start.js` already supports `additionalContext` injection. Add a call to `transcript-indexer.cjs` in the startup flow after the state reminder. `SessionEnd` hook (currently unused by nForma) can trigger indexing of the ending session.

**Confidence:** MEDIUM -- pattern extraction quality depends on heuristics. Start simple (tool sequences only), iterate.

### 3. Continuous Verification State Machine (File-Based)

**What exists:** `debt-state-machine.cjs` already implements a file-based FSM pattern (ALLOWED_TRANSITIONS map + canTransition guard). `gsd-context-monitor.js` already detects clean workflow boundaries (`detectCleanBoundary()`). The XState machine in `src/machines/` is for formal verification spec generation only -- it is a devDependency, not runtime.

**What's needed:** A `cv-state-machine.cjs` that:
1. Maintains a JSON state file at `.planning/cv-state.json`
2. States: `IDLE -> EDITING -> VERIFYING -> VERIFIED -> IDLE` (cycles)
3. Transitions triggered by PostToolUse events (file edits = EDITING, commit = VERIFYING)
4. In VERIFYING state, runs configured verification gates (lint, test, type-check)
5. Writes results to `.planning/cv-results.json` for quorum context

**Do NOT use XState at runtime.** XState is a devDependency (^5.28.0) used only for `npm run build:machines` which generates TLA+ specs. Runtime hooks must use plain CommonJS with JSON persistence. This matches the existing pattern in `debt-state-machine.cjs`.

**Hook integration:** `gsd-context-monitor.js` (PostToolUse) already detects boundaries. Add cv-state-machine calls at detected boundaries. The existing `detectCleanBoundary()` function returns `'phase_complete'`, `'verification_done'`, `'commit'` -- these map directly to FSM transitions.

**Confidence:** HIGH -- proven pattern exists in debt-state-machine.cjs.

### 4. Git Worktree Isolation for Parallel Executors

**What exists:** Claude Code natively supports `WorktreeCreate` and `WorktreeRemove` hook events (verified in official docs). Subagents can use `isolation: "worktree"` in their definition. Git worktree is built into git.

**What's needed:**
1. `hooks/nf-worktree-create.js` -- WorktreeCreate hook that:
   - Creates worktree via `git worktree add`
   - Copies `.planning/STATE.md` and `.planning/config.json` into the worktree
   - Prints the worktree path to stdout (required by Claude Code)
2. `hooks/nf-worktree-remove.js` -- WorktreeRemove hook that:
   - Collects results from worktree (e.g., merge verification reports back)
   - Runs `git worktree remove`
3. `bin/worktree-manager.cjs` -- shared logic for both hooks

**Critical constraint:** WorktreeCreate hooks REPLACE the default git behavior. The hook must handle `git worktree add` itself and print the path. Non-zero exit fails creation.

**Hook registration:** Add to `.claude/settings.json` (or `~/.claude/settings.json` for global):
```json
{
  "hooks": {
    "WorktreeCreate": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/nf-worktree-create.js" }] }],
    "WorktreeRemove": [{ "hooks": [{ "type": "command", "command": "node ~/.claude/hooks/nf-worktree-remove.js" }] }]
  }
}
```

**Confidence:** HIGH -- Claude Code provides the hook events, git worktree is stable.

### 5. Iterative Retrieval Loops in Subagent Orchestration

**What exists:** `nf-prompt.js` already builds dispatch lists for quorum slot-workers. `call-quorum-slot.cjs` handles individual slot invocations. The Task(subagent_type=...) pattern is proven for parallel dispatch.

**What's needed:** A `retrieval-loop.cjs` that:
1. Accepts a retrieval query and context budget
2. Iteratively searches (Grep/Glob/Read) based on initial query
3. Scores relevance of results
4. Decides whether to expand search or stop based on quality threshold
5. Returns consolidated context to the calling agent

**Implementation approach:** This is a workflow pattern, not a library dependency. Implement as:
- A bin script that takes query + config on stdin
- Uses `spawnSync` to call `grep`/`find` for file discovery
- Applies a simple TF-IDF-like scoring (term frequency in matches) using built-in `String.prototype.match` -- no NLP library needed
- Stops when: (a) quality threshold met, (b) max iterations reached, or (c) context budget exhausted
- Returns results as JSON on stdout

**Hook integration:** Can be called from within agent definitions (`.claude/agents/*.md`) as a Bash tool call, or integrated into `nf-prompt.js` as context pre-loading for planning commands.

**Confidence:** MEDIUM -- the retrieval quality depends on heuristic tuning. Start with simple keyword matching, add sophistication if needed.

### 6. Earlier Compaction Triggering

**What exists:** `gsd-context-monitor.js` already has smart compact logic. `detectCleanBoundary()` identifies workflow boundaries. `nf-precompact.js` saves state before compaction. The `smart_compact.context_warn_pct` config defaults to 60%.

**What's needed:** Lower the effective trigger threshold and make compaction proactive:
1. Extend `compact-trigger.cjs` to check context % after EVERY PostToolUse (not just at boundaries)
2. At 50% context usage, inject a `COMPACT_RECOMMENDED` advisory into additionalContext
3. At boundaries (phase_complete, commit), automatically suggest `/compact` if above threshold
4. Add task-scope awareness: if current plan has N remaining tasks, estimate whether context will survive

**Hook integration:** Extend `gsd-context-monitor.js` PostToolUse handler. No new hook needed.

**Confidence:** HIGH -- pure threshold tuning of existing infrastructure.

## Installation

```bash
# No new npm dependencies required.
# All capabilities use Node.js built-ins (fs, path, child_process, crypto).

# After implementing new bin scripts, install:
node bin/install.js --claude --global
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Plain JSON FSM (cv-state-machine) | XState runtime | Never for hooks -- XState is devDep only, adds import complexity, breaks CommonJS convention |
| crypto.createHash for pattern dedup | External dedup library | Never -- built-in crypto is sufficient for SHA-256 hashing |
| JSONL for session index | SQLite (better-sqlite3) | Only if pattern count exceeds 10K+ entries per project. JSONL is simpler, zero-dep, append-only |
| spawnSync for worktree ops | Native git bindings (nodegit) | Never -- nodegit has native compilation issues, spawnSync to git CLI is proven in nf-circuit-breaker |
| Simple keyword scoring for retrieval | Embeddings via API | Only if retrieval quality proves insufficient. Adds API cost and latency |
| PostToolUse context_window field | Polling transcript size | Never -- context_window is already available (used by gsd-context-monitor) even if undocumented |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| XState at runtime in hooks | devDependency only, ESM/CJS mismatch, adds 50KB+ to hook cold start | Plain JSON FSM with ALLOWED_TRANSITIONS pattern (see debt-state-machine.cjs) |
| External NLP libraries for pattern extraction | Adds dependency weight, overkill for structural pattern matching | Built-in String.match + regex for tool sequence extraction |
| nodegit / isomorphic-git | Native compilation issues, large dependency tree | `spawnSync('git', [...])` -- proven pattern throughout codebase |
| Separate database for session index | Adds operational complexity, backup concerns | JSONL files in .planning/ -- consistent with token-usage.jsonl pattern |
| New hook event types | Cannot add custom events to Claude Code | Piggyback on existing PostToolUse, SessionStart, WorktreeCreate events |
| ESM for new scripts | Breaks convention, all hooks/bin use CommonJS | CommonJS require/module.exports per coding-style.md rules |

## Integration Map: New Capabilities to Existing Hooks

```
PostToolUse (gsd-context-monitor.js)
  |-- budget-tracker.cjs          [EXISTS]
  |-- model-selector.cjs          [NEW - capability 1]
  |-- cv-state-machine.cjs        [NEW - capability 3]
  |-- compact-trigger.cjs         [NEW - capability 6]

SessionStart (nf-session-start.js)
  |-- secrets sync                [EXISTS]
  |-- state reminder              [EXISTS]
  |-- transcript-indexer.cjs      [NEW - capability 2]

SessionEnd [NEW HOOK REGISTRATION]
  |-- transcript-indexer.cjs      [NEW - capability 2, indexing pass]

WorktreeCreate [NEW HOOK]
  |-- nf-worktree-create.js       [NEW - capability 4]

WorktreeRemove [NEW HOOK]
  |-- nf-worktree-remove.js       [NEW - capability 4]

SubagentStart (existing)
  |-- retrieval-loop.cjs          [NEW - capability 5, context injection]

nf-prompt.js (UserPromptSubmit)
  |-- retrieval context pre-load  [NEW - capability 5, optional]
```

## File-Based State Persistence Pattern

All six capabilities use the same persistence pattern already proven in the codebase:

| Capability | State File | Format | Read By | Written By |
|------------|-----------|--------|---------|------------|
| Model downgrade | `.planning/config.json` | JSON | nf-prompt.js | model-selector.cjs |
| Session index | `.planning/.session-index/patterns.jsonl` | JSONL | nf-session-start.js | transcript-indexer.cjs |
| CV state | `.planning/cv-state.json` | JSON | gsd-context-monitor.js | cv-state-machine.cjs |
| Worktree state | `.planning/worktree-state.json` | JSON | nf-worktree-*.js | worktree-manager.cjs |
| Retrieval cache | `.planning/.retrieval-cache/` | JSON | retrieval-loop.cjs | retrieval-loop.cjs |
| Compact decisions | `.planning/compact-log.jsonl` | JSONL | gsd-context-monitor.js | compact-trigger.cjs |

All files are gitignored except cv-state.json (which tracks verification status for the project).

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| Node.js >= 16.7.0 | All new scripts | fs.rmSync available from 14.14, crypto.createHash from 0.1.92 |
| Claude Code hooks API | WorktreeCreate/Remove events | Verified in current official docs (2026-03) |
| git >= 2.17 | git worktree add/remove | Worktree feature stable since git 2.17 (2018) |
| Existing nf.json config | Shallow merge with new keys | New config keys added to DEFAULT_CONFIG, fail-open if absent |

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- verified WorktreeCreate, WorktreeRemove, PostToolUse, SessionStart, SessionEnd event schemas (HIGH confidence)
- [Git Worktrees with Claude Code](https://medium.com/@dtunai/mastering-git-worktrees-with-claude-code-for-parallel-development-workflow-41dc91e645fe) -- practical patterns for worktree isolation (MEDIUM confidence)
- [Agentic Coding with Git Worktrees](https://blog.shanelee.name/2026/02/03/agentic-coding-git-worktrees-and-agent-skills-for-parallel-workflows/) -- parallel agent workflow patterns (MEDIUM confidence)
- Existing codebase analysis: hooks/gsd-context-monitor.js, bin/budget-tracker.cjs, bin/debt-state-machine.cjs, hooks/nf-token-collector.js, hooks/nf-session-start.js, hooks/nf-precompact.js (HIGH confidence -- direct source code review)

---
*Stack research for: nForma advanced agent patterns milestone*
*Researched: 2026-03-07*
