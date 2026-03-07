# Architecture Patterns: Advanced Agent Pattern Integration

**Domain:** Claude Code plugin (nForma) -- 6 new agent patterns integrating with existing hook pipeline
**Researched:** 2026-03-07
**Confidence:** HIGH (based on direct codebase analysis of all existing hooks and infrastructure)

## Executive Summary

nForma's existing architecture is a hook-driven pipeline with 12 hooks across 7 lifecycle events (UserPromptSubmit, Stop, PreToolUse, PostToolUse, PreCompact, SessionStart, SubagentStart/SubagentStop), a quorum dispatch system using parallel sibling Task calls to `nf-quorum-slot-worker` agents, a two-layer config system (DEFAULT -> global ~/.claude/nf.json -> project .claude/nf.json), and extensive observability (conformance events, token usage, scoreboard). The 6 new patterns must integrate as extensions of this existing infrastructure, not parallel systems.

## Existing Architecture (Current State)

### Hook Pipeline

```
SessionStart
  nf-session-start.js    -- keychain sync, state reminder, telemetry

UserPromptSubmit
  nf-prompt.js           -- circuit breaker recovery, pending tasks, quorum injection

PreToolUse
  nf-circuit-breaker.js  -- oscillation detection, deny on active breaker

PostToolUse
  gsd-context-monitor.js -- context %, budget, smart compact suggestions
  nf-spec-regen.js       -- XState change -> spec regeneration

Stop
  nf-stop.js             -- quorum verification gate (block if no evidence)

PreCompact
  nf-precompact.js       -- inject STATE.md + pending tasks into compaction context

SubagentStart
  nf-slot-correlator.js  -- write correlation stub for slot workers

SubagentStop
  nf-token-collector.js  -- sum transcript tokens, write usage JSONL
```

### Key Constraints

| Constraint | Impact on New Patterns |
|-----------|----------------------|
| Hooks are synchronous (stdin JSON -> stdout JSON -> process.exit) | No async operations in hot path; spawnSync for subprocess calls |
| Config is shallow merge (no nested object merging) | New config keys must be flat or handle merge manually |
| stdout = decision channel only | All debug/log output to stderr; additionalContext for Claude injection |
| Fail-open on all errors | Every new hook/extension must wrap in try/catch with process.exit(0) |
| Task-based subagent dispatch | No direct MCP tool calls; must use Task(subagent_type=...) |
| CommonJS only (except unified-mcp-server.mjs) | require/module.exports, not import/export |
| Install sync required | hooks/ -> hooks/dist/ -> node bin/install.js --claude --global |

### Data Flow (Current)

```
User prompt
  -> nf-prompt.js reads config, scoreboard, provider cache, quorum failures
  -> Injects quorum instructions as additionalContext
  -> Claude dispatches Task(subagent_type="nf-quorum-slot-worker") calls
  -> nf-slot-correlator.js writes correlation stubs at SubagentStart
  -> Slot workers execute via call-quorum-slot.cjs -> MCP tools
  -> nf-token-collector.js sums usage at SubagentStop
  -> Claude synthesizes, writes GSD_DECISION marker
  -> nf-stop.js verifies quorum evidence in transcript
  -> gsd-context-monitor.js tracks context % after each tool use
  -> nf-precompact.js preserves state across compaction
```

## The 6 New Patterns: Integration Architecture

### Pattern 1: Dynamic Model Selection (Token Optimization)

**What it is:** Automatic model tier adjustment based on real-time token consumption, task complexity, and cost signals. Extends existing budget tracking (v0.28) from "warn and downgrade profiles" to "select optimal model per dispatch."

**Integration points:**
- **EXTENDS** `gsd-context-monitor.js` (PostToolUse) -- already tracks context %, budget status
- **EXTENDS** `config-loader.js` -- already has `model_tier_planner`, `model_tier_worker`, `budget` config
- **EXTENDS** `nf-prompt.js` -- already reads risk_level and computes fan-out count
- **NEW** `bin/model-selector.cjs` -- scoring function: (task_complexity, remaining_budget, slot_success_rate) -> model_id

**Data flow change:**
```
BEFORE: nf-prompt.js reads static model_tier from config
AFTER:  nf-prompt.js calls model-selector.cjs(task_envelope, token_budget, scoreboard)
        -> returns { model_id, rationale }
        -> injected into slot-worker dispatch prompt as model override
```

**Config additions (flat keys for shallow merge):**
```json
{
  "dynamic_model_enabled": true,
  "dynamic_model_cost_ceiling_usd": 0.50,
  "dynamic_model_complexity_threshold": "medium"
}
```

**New components:** 1 (bin/model-selector.cjs)
**Modified components:** 2 (nf-prompt.js dispatch, gsd-context-monitor.js feedback)

---

### Pattern 2: Cross-Session Learning (Memory Persistence)

**What it is:** Extract patterns, error resolutions, and successful strategies from session transcripts and persist them for future sessions. Extends existing nf-session-start.js (session state reminder) and nf-precompact.js (compaction survival).

**Integration points:**
- **EXTENDS** `nf-session-start.js` (SessionStart) -- already injects state reminders and telemetry alerts
- **EXTENDS** `nf-precompact.js` (PreCompact) -- already preserves STATE.md across compaction
- **EXTENDS** `nf-token-collector.js` (SubagentStop) -- already reads agent transcripts
- **NEW** `bin/session-learner.cjs` -- extract patterns from transcript at session end
- **NEW** `bin/pattern-store.cjs` -- read/write pattern database

**Data flow change:**
```
BEFORE: SubagentStop just counts tokens
AFTER:  SubagentStop also feeds transcript snippets to pattern extraction queue
        (async, non-blocking -- write to .planning/learning-queue.jsonl)

BEFORE: SessionStart injects state reminder only
AFTER:  SessionStart also injects top-N relevant learned patterns as additionalContext
        (reads .planning/learned-patterns.json, filtered by current task context)

BEFORE: PreCompact preserves STATE.md only
AFTER:  PreCompact also preserves current session's extracted patterns
        (appends to learned-patterns.json before compaction)
```

**Storage:** `.planning/learned-patterns.json` (gitignored -- contains session-specific data)
```json
{
  "version": 1,
  "patterns": [
    {
      "id": "pat_abc123",
      "type": "error_resolution",
      "trigger": "ENOENT on planning-paths.cjs",
      "resolution": "Check both local bin/ and ~/.claude/nf-bin/ paths",
      "confidence": 0.85,
      "uses": 3,
      "last_used": "2026-03-07T..."
    }
  ]
}
```

**Config additions:**
```json
{
  "cross_session_learning_enabled": true,
  "learning_max_patterns": 100,
  "learning_inject_count": 5
}
```

**New components:** 2 (bin/session-learner.cjs, bin/pattern-store.cjs)
**Modified components:** 3 (nf-session-start.js, nf-precompact.js, nf-token-collector.js)

---

### Pattern 3: Continuous Verification (File-Based)

**What it is:** Run verification checks during execution (not just at phase end). Uses PostToolUse hook to trigger lightweight checks after each file write.

**Integration points:**
- **EXTENDS** `gsd-context-monitor.js` (PostToolUse) -- already fires after every tool use
- **EXTENDS** `nf-circuit-breaker.js` (PreToolUse) -- already analyzes git history per tool call
- **NEW** `bin/continuous-verify.cjs` -- lightweight check runner (lint, type-check, test subset)
- **REUSES** existing `bin/run-formal-verify.cjs` in `--quick` mode

**Data flow change:**
```
BEFORE: PostToolUse only checks context % and budget
AFTER:  PostToolUse also detects file writes (Edit/Write tool_name)
        -> spawns continuous-verify.cjs via spawnSync with 5s timeout
        -> if violations found, injects warning as additionalContext
        -> does NOT block (advisory only, like smart compact)

BEFORE: Verification runs only at phase-end via execute-phase
AFTER:  Incremental verification after each substantive file change
        Results accumulate in .planning/continuous-verify.jsonl
        Phase-end verification reads this to skip already-checked files
```

**Critical constraint:** PostToolUse hooks must be fast. The continuous verification MUST:
- Use spawnSync with a hard 5-second timeout
- Only check the specific file(s) just modified (not full suite)
- Cache results to avoid re-checking unchanged files
- Fail-open: timeout or error = silent pass

**Config additions:**
```json
{
  "continuous_verify_enabled": true,
  "continuous_verify_timeout_ms": 5000,
  "continuous_verify_checks": ["lint", "typecheck"]
}
```

**New components:** 1 (bin/continuous-verify.cjs)
**Modified components:** 1 (gsd-context-monitor.js -- add file-write detection branch)

---

### Pattern 4: Git Worktree Parallelization

**What it is:** Use git worktrees to run parallel executor subagents on isolated branches, preventing file conflicts. Each executor Task gets its own worktree.

**Integration points:**
- **EXTENDS** `nf-prompt.js` (UserPromptSubmit) -- inject worktree setup instructions for parallel tasks
- **EXTENDS** `nf-circuit-breaker.js` (PreToolUse) -- must be worktree-aware (each worktree has own git root)
- **NEW** `bin/worktree-manager.cjs` -- create/list/cleanup worktrees
- **NEW** `agents/nf-worktree-executor.md` -- subagent definition for worktree-isolated execution

**Data flow change:**
```
BEFORE: All executor Tasks share the main working tree
AFTER:  For parallelizable plans:
        1. nf-prompt.js detects parallel-eligible tasks from PLAN.md
        2. Injects worktree setup as additionalContext
        3. Claude spawns Task(subagent_type="nf-worktree-executor")
           with worktree_path in prompt
        4. Each executor runs in isolated worktree
        5. Results merged back to main branch
        6. worktree-manager.cjs cleanup on completion

WORKTREE LIFECYCLE:
  bin/worktree-manager.cjs create --branch feat/plan-03-task-2
    -> git worktree add .worktrees/plan-03-task-2 -b feat/plan-03-task-2
    -> returns { worktree_path, branch }

  bin/worktree-manager.cjs cleanup --all
    -> git worktree remove .worktrees/*
    -> git branch -d feat/plan-03-task-*
```

**Critical constraints:**
- Worktrees share .git objects -- no disk duplication
- Hooks use `getGitRoot(cwd)` -- worktree cwd resolves to worktree root, NOT main repo
- Circuit breaker must check oscillation per-worktree, not globally
- config-loader must resolve project .claude/nf.json from MAIN repo, not worktree
- `.worktrees/` directory must be gitignored

**Config additions:**
```json
{
  "worktree_enabled": false,
  "worktree_max_concurrent": 3,
  "worktree_base_dir": ".worktrees"
}
```

**New components:** 2 (bin/worktree-manager.cjs, agents/nf-worktree-executor.md)
**Modified components:** 2 (nf-prompt.js, nf-circuit-breaker.js -- worktree awareness)

---

### Pattern 5: Iterative Retrieval (Context Stack Management)

**What it is:** Quorum slot workers use an iterative retrieval pattern -- instead of receiving all context upfront, they ask follow-up questions and retrieve additional context in rounds. Reduces initial prompt size while improving response quality.

**Integration points:**
- **EXTENDS** `bin/call-quorum-slot.cjs` -- currently single-shot prompt -> response
- **EXTENDS** `nf-prompt.js` -- dispatch instructions must allow multi-round worker interaction
- **EXTENDS** `nf-stop.js` -- must recognize multi-round slot worker patterns as valid quorum evidence
- **NEW** `bin/context-stack.cjs` -- manages hierarchical context (summary -> detail -> code)

**Data flow change:**
```
BEFORE: Slot worker gets full prompt, returns single response
AFTER:  Slot worker lifecycle:
        Round 1: Summary context (task envelope + high-level question)
        -> Worker asks for specific file/detail
        Round 2: Detailed context (requested files/sections)
        -> Worker produces informed vote

        context-stack.cjs manages the hierarchy:
        Level 0: Task envelope (objective, constraints, risk_level)
        Level 1: PLAN.md summary
        Level 2: Specific file contents (on demand)
        Level 3: Git diff / test output (on demand)
```

**Critical constraints:**
- Slot worker timeout must accommodate multiple rounds (current: 30s per slot)
- Token savings only realized if Level 2/3 retrieval is needed < 50% of the time
- nf-stop.js already handles multi-round deliberation -- extend to multi-round retrieval within a single slot
- call-quorum-slot.cjs currently uses spawnSync -- multi-round needs event-driven subprocess or repeated spawn calls

**Config additions:**
```json
{
  "iterative_retrieval_enabled": true,
  "iterative_retrieval_max_rounds": 3,
  "iterative_retrieval_timeout_ms": 60000
}
```

**New components:** 1 (bin/context-stack.cjs)
**Modified components:** 3 (call-quorum-slot.cjs, nf-prompt.js, nf-stop.js)

---

### Pattern 6: Earlier Compaction (Smart Context Management)

**What it is:** Proactively compact context before hitting critical thresholds, preserving more useful information. Extends existing smart compact (v0.28) from "suggest compact at boundaries" to "automatically trigger compaction with curated content."

**Integration points:**
- **EXTENDS** `gsd-context-monitor.js` (PostToolUse) -- already has smart_compact detection
- **EXTENDS** `nf-precompact.js` (PreCompact) -- already injects continuation context
- **NEW** `bin/smart-compactor.cjs` -- curates what to preserve, triggers /compact programmatically
- **REUSES** existing `.planning/STATE.md` as compaction state anchor

**Data flow change:**
```
BEFORE: gsd-context-monitor.js suggests /compact at workflow boundaries
AFTER:  gsd-context-monitor.js triggers automatic compaction:
        1. At context_warn_pct (60%), start curating important context
        2. Write .claude/compaction-context.json with:
           - Current plan progress
           - Key decisions made this session
           - Unfinished task details
           - Files currently being worked on
        3. At compaction_trigger_pct (75%), inject STRONG compaction instruction
        4. nf-precompact.js reads compaction-context.json (if present)
           and produces richer continuation context than just STATE.md

BEFORE: PreCompact injects STATE.md Current Position section only
AFTER:  PreCompact injects:
        - STATE.md Current Position (existing)
        - Compaction context (key decisions, current files, partial work)
        - Learned patterns relevant to current task (from Pattern 2)
```

**Config additions:**
```json
{
  "smart_compact_auto_trigger": false,
  "smart_compact_curate_pct": 60,
  "smart_compact_trigger_pct": 75
}
```

**New components:** 1 (bin/smart-compactor.cjs)
**Modified components:** 2 (gsd-context-monitor.js, nf-precompact.js)

---

## Component Inventory: New vs Modified

### New Components (8 total)

| Component | Type | Pattern | Purpose |
|-----------|------|---------|---------|
| `bin/model-selector.cjs` | bin script | P1: Dynamic Model | Score and select optimal model per task |
| `bin/session-learner.cjs` | bin script | P2: Cross-Session | Extract patterns from transcripts |
| `bin/pattern-store.cjs` | bin script | P2: Cross-Session | Read/write pattern database |
| `bin/continuous-verify.cjs` | bin script | P3: Continuous Verify | Run incremental checks after file writes |
| `bin/worktree-manager.cjs` | bin script | P4: Git Worktrees | Create/list/cleanup git worktrees |
| `agents/nf-worktree-executor.md` | agent def | P4: Git Worktrees | Worktree-isolated executor subagent |
| `bin/context-stack.cjs` | bin script | P5: Iterative Retrieval | Hierarchical context management |
| `bin/smart-compactor.cjs` | bin script | P6: Earlier Compaction | Curate compaction context |

### Modified Components (8 unique, some modified by multiple patterns)

| Component | Modified By | Change Type |
|-----------|-------------|-------------|
| `hooks/nf-prompt.js` | P1, P4, P5 | Add model selection, worktree instructions, retrieval dispatch |
| `hooks/gsd-context-monitor.js` | P1, P3, P6 | Budget feedback, file-write detection, auto-compact trigger |
| `hooks/nf-session-start.js` | P2 | Inject learned patterns |
| `hooks/nf-precompact.js` | P2, P6 | Preserve patterns, rich compaction context |
| `hooks/nf-token-collector.js` | P2 | Feed transcript to learning queue |
| `hooks/nf-circuit-breaker.js` | P4 | Worktree-aware git root resolution |
| `hooks/nf-stop.js` | P5 | Recognize multi-round retrieval as valid evidence |
| `hooks/config-loader.js` | All | Validate new config keys |
| `bin/call-quorum-slot.cjs` | P5 | Multi-round slot interaction |

## Dependency Graph and Build Order

```
                     config-loader.js (foundation -- all patterns need config keys)
                            |
                   +--------+--------+
                   |                 |
            P1: Dynamic Model   P6: Earlier Compaction
            (model-selector)    (smart-compactor)
                   |                 |
                   v                 v
            P3: Continuous      P2: Cross-Session
            Verification        Learning
            (continuous-verify) (session-learner, pattern-store)
                   |                 |
                   +--------+--------+
                            |
                   P5: Iterative Retrieval
                   (context-stack, call-quorum-slot changes)
                            |
                            v
                   P4: Git Worktrees
                   (worktree-manager, worktree-executor)
```

### Suggested Build Order (6 Phases)

**Phase 1: Dynamic Model Selection**
- Rationale: Extends existing budget tracking (v0.28), smallest surface area, immediate cost savings
- Dependencies: None (reads existing scoreboard + config)
- Risk: LOW -- config-loader already validates model_tier keys
- Deliverables: bin/model-selector.cjs, config additions, nf-prompt.js dispatch changes

**Phase 2: Earlier Compaction (Smart Context Management)**
- Rationale: Extends existing smart_compact infrastructure, improves all subsequent patterns by preserving more context
- Dependencies: None, but benefits all later patterns
- Risk: LOW -- gsd-context-monitor.js and nf-precompact.js are well-understood
- Deliverables: bin/smart-compactor.cjs, gsd-context-monitor.js extensions, nf-precompact.js enrichment

**Phase 3: Cross-Session Learning**
- Rationale: Depends on rich compaction (P6) for pattern survival across sessions
- Dependencies: Phase 2 (compaction context enrichment)
- Risk: MEDIUM -- transcript parsing is nondeterministic, pattern quality varies
- Deliverables: bin/session-learner.cjs, bin/pattern-store.cjs, hook modifications

**Phase 4: Continuous Verification**
- Rationale: Independent but benefits from P3 (learned patterns can inform which checks to prioritize)
- Dependencies: None hard, P3 soft dependency
- Risk: MEDIUM -- 5s timeout is tight for meaningful verification; must carefully scope checks
- Deliverables: bin/continuous-verify.cjs, gsd-context-monitor.js file-write branch

**Phase 5: Iterative Retrieval**
- Rationale: Requires stable slot dispatch (P1 model selection), stable compaction (P2), and working learning (P3) to build the context hierarchy effectively
- Dependencies: Phase 1 (model selection affects what models receive retrieval prompts)
- Risk: HIGH -- changes call-quorum-slot.cjs synchronous architecture; slot timeout implications
- Deliverables: bin/context-stack.cjs, call-quorum-slot.cjs multi-round, nf-stop.js recognition

**Phase 6: Git Worktree Parallelization**
- Rationale: Most complex integration; needs all other patterns stable first; worktree isolation affects circuit breaker, config resolution, and state management
- Dependencies: All patterns must be stable (worktrees interact with every hook)
- Risk: HIGH -- git worktree edge cases, hook cwd resolution, merge conflicts
- Deliverables: bin/worktree-manager.cjs, agents/nf-worktree-executor.md, circuit breaker worktree awareness

## Patterns to Follow

### Pattern 1: Hook Extension via New Branch

When extending an existing hook (e.g., adding file-write detection to gsd-context-monitor.js):

```javascript
// Add new detection branch AFTER existing logic, not replacing it
// Existing: context %, budget, smart compact
// New: file-write detection for continuous verify

const toolName = input.tool_name || '';
const isFileWrite = toolName === 'Edit' || toolName === 'Write';

if (isFileWrite && config.continuous_verify_enabled) {
  const changedFile = (input.tool_input || {}).file_path || '';
  if (changedFile) {
    try {
      const result = spawnSync('node', [
        path.join(__dirname, '..', 'bin', 'continuous-verify.cjs'),
        '--file', changedFile,
        '--timeout', String(config.continuous_verify_timeout_ms || 5000),
      ], { encoding: 'utf8', timeout: 6000 }); // outer timeout > inner
      if (result.stdout) {
        messages.push(result.stdout.trim());
      }
    } catch (_) {} // fail-open
  }
}
```

### Pattern 2: Config Key Validation for New Features

All new config keys must be flat (not nested objects) because of shallow merge:

```javascript
// In validateConfig():
if (config.dynamic_model_enabled !== undefined) {
  if (typeof config.dynamic_model_enabled !== 'boolean') {
    process.stderr.write('[nf] WARNING: nf.json: dynamic_model_enabled must be boolean; defaulting to false\n');
    config.dynamic_model_enabled = false;
  }
}
```

### Pattern 3: New bin/ Script Structure

Every new bin/ script follows the same template:

```javascript
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// Feature implementation here

// CLI entry point
if (require.main === module) {
  // Parse args, execute, write to stdout
}

// Export for testing
module.exports = { /* exported functions */ };
```

### Pattern 4: Worktree-Aware Git Root Resolution

For Pattern 4 (git worktrees), hooks need to distinguish between "worktree git root" and "main repo root":

```javascript
// Get main repo root (for config, STATE.md, .planning/)
function getMainRepoRoot(cwd) {
  // git worktree list --porcelain -> first entry is always main worktree
  const result = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd, encoding: 'utf8', timeout: 5000,
  });
  if (result.status !== 0 || result.error) return cwd;
  const firstLine = (result.stdout || '').split('\n')[0] || '';
  const match = firstLine.match(/^worktree\s+(.+)/);
  return match ? match[1] : cwd;
}

// Get current worktree root (for circuit breaker, git operations)
function getWorktreeRoot(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd, encoding: 'utf8', timeout: 5000,
  });
  if (result.status !== 0 || result.error) return cwd;
  return result.stdout.trim();
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Async Operations in Hooks
**What:** Using async/await or Promises in synchronous hook paths
**Why bad:** Hooks must exit synchronously; async operations may not complete before process.exit(0)
**Instead:** Use spawnSync for subprocess calls; write async results to queue files for later processing
**Exception:** nf-session-start.js uses async IIFE (with await _stdinPromise), but this is the only exception and it works because it controls its own exit timing

### Anti-Pattern 2: Nested Config Objects
**What:** Adding nested objects to DEFAULT_CONFIG for new features
**Why bad:** Shallow merge `{ ...DEFAULT_CONFIG, ...global, ...project }` replaces entire nested objects
**Instead:** Use flat keys: `continuous_verify_enabled`, `continuous_verify_timeout_ms`, not `continuous_verify: { enabled, timeout_ms }`

### Anti-Pattern 3: Blocking Hooks for Advisory Features
**What:** Using permissionDecision: 'deny' for non-critical pattern violations
**Why bad:** Only the circuit breaker should deny tool calls; advisory features inject additionalContext
**Instead:** All 6 new patterns should be advisory (additionalContext) not blocking (deny)

### Anti-Pattern 4: Direct MCP Calls from Hooks
**What:** Calling mcp__* tools directly from hook logic
**Why bad:** Violates R3.2 dispatch protocol; bypasses slot worker isolation
**Instead:** Always dispatch via Task(subagent_type="nf-quorum-slot-worker")

### Anti-Pattern 5: Cross-Worktree State Pollution
**What:** Reading/writing state files relative to cwd when in a worktree
**Why bad:** Worktree cwd is .worktrees/task-N/, but config and state live in main repo
**Instead:** Always resolve config from main repo root (git worktree list --porcelain -> first entry is main)

## Scalability Considerations

| Concern | Current (12 slots) | At 20 slots | At 50+ slots |
|---------|-------------------|-------------|-------------|
| Dispatch latency | 3s health probe + serial filter | Same (filter is O(n)) | Consider parallel health probes |
| Token cost | ~380k/run, model-selector helps | model-selector critical | Must have iterative retrieval |
| Compaction frequency | Manual, ~70% threshold | Auto-compact at 60% | Aggressive curated compaction |
| Worktree disk | N/A | 3 worktrees viable | Git worktree overhead manageable (shared objects) |
| Pattern storage | In-memory viable | JSON file sufficient | Consider SQLite if > 1000 patterns |
| Continuous verify | 5s timeout sufficient | May need parallel checks | File-level caching essential |

## Sources

- Direct codebase analysis of all 12 hooks in hooks/ directory
- config-loader.js DEFAULT_CONFIG (lines 78-144) for config structure
- nf-prompt.js (730 lines) for quorum dispatch architecture
- nf-stop.js (687 lines) for transcript verification architecture
- providers.json (12 slots across 5 providers) for slot infrastructure
- PROJECT.md v0.28-v0.30 milestone descriptions for architecture decisions
- gsd-context-monitor.js for PostToolUse data flow
- nf-precompact.js for compaction survival architecture
- nf-token-collector.js for SubagentStop transcript parsing
- nf-circuit-breaker.js for PreToolUse oscillation detection
