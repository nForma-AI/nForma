# Architecture Research

**Domain:** QGSD v0.3 — `/qgsd:maintain-tests` integration into existing Claude Code plugin
**Researched:** 2026-02-22
**Confidence:** HIGH (existing QGSD codebase read directly; integration points derived from live source; no novel APIs involved)

---

## Context: This Is a Subsequent Milestone

The existing QGSD architecture (v0.1–v0.2) is stable and documented. This file answers a specific integration question for v0.3:

> How does `/qgsd:maintain-tests` fit into the existing QGSD plugin without breaking what exists?

The answer covers five questions:
1. Where the new workflow file lives
2. How the discovery + batch execution engine integrates
3. How the AI categorization loop connects to existing debug/quick patterns
4. How state tracking works across batch iterations
5. Build order for phases 18+

---

## System Overview — Existing Architecture (v0.2 Stable)

```
~/.claude/
├── hooks/
│   ├── qgsd-prompt.js          # UserPromptSubmit: injects quorum instructions
│   ├── qgsd-stop.js            # Stop: verifies quorum evidence in transcript
│   └── qgsd-circuit-breaker.js # PreToolUse: detects oscillation, blocks Bash
├── qgsd/
│   ├── bin/
│   │   ├── gsd-tools.cjs       # CLI utility (state, phase ops, activity tracking)
│   │   └── update-scoreboard.cjs
│   ├── workflows/              # Installed workflow orchestrators (md files)
│   │   ├── plan-phase.md
│   │   ├── execute-phase.md
│   │   ├── quick.md
│   │   └── ...
│   ├── templates/              # Research/planning templates
│   └── references/             # UI brand, etc.
├── commands/qgsd/              # Slash commands (frontmatter + execution_context refs)
│   ├── plan-phase.md
│   ├── quick.md
│   ├── debug.md
│   └── ...
└── agents/
    ├── qgsd-planner.md
    ├── qgsd-executor.md
    ├── qgsd-debugger.md
    └── ...
```

QGSD source (`~/code/QGSD/`):
```
QGSD/
├── hooks/                      # Source hooks + config-loader.js
│   └── dist/                   # esbuild-bundled (installed to ~/.claude/hooks/)
├── bin/install.js              # Installer
├── commands/qgsd/              # Source slash commands (synced to ~/.claude/commands/qgsd/)
├── agents/                     # Source agents (synced to ~/.claude/agents/)
└── ...
```

---

## Integration Architecture: `/qgsd:maintain-tests`

### Where the New Command Lives

The new command follows the identical pattern as all other QGSD commands:

```
Source:    QGSD/commands/qgsd/maintain-tests.md
Installed: ~/.claude/commands/qgsd/maintain-tests.md
Invoked:   /qgsd:maintain-tests [args]
```

The command file uses the standard frontmatter + workflow reference pattern:

```yaml
---
name: qgsd:maintain-tests
description: Discover, batch, and categorize test failures across large suites
argument-hint: "[--batch-size N] [--runner jest|playwright|pytest] [--dir path]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
  - AskUserQuestion
---
```

The workflow logic lives in a separate file referenced via `<execution_context>`:

```
Source:    QGSD/workflows/maintain-tests.md   (NEW)
Installed: ~/.claude/qgsd/workflows/maintain-tests.md
```

This separation (command stub + workflow file) matches every existing QGSD command and avoids the installer having to manage inline logic in slash command files. The installer's `WORKFLOWS_TO_COPY` array gains one entry: `maintain-tests.md`.

**No hook changes.** The Stop hook's `quorum_commands` allowlist does NOT include `maintain-tests` by default. This command is an execution operation (it runs tests and categorizes failures) rather than a planning command. Adding it to the quorum allowlist would be wrong per CLAUDE.md R2.2. The existing hook layer is untouched.

---

### Discovery + Batch Execution Engine: Node.js Module vs Claude Agent Spawning

**Decision: Node.js CLI module in `gsd-tools.cjs`, invoked from the Claude workflow.**

The discovery and batching logic should be a new `gsd-tools.cjs` sub-command, not a spawned Claude agent. Rationale:

| Criterion | Node.js CLI in gsd-tools.cjs | Separate Claude agent |
|-----------|------------------------------|----------------------|
| Test file discovery (find/glob) | Straightforward `glob` + `fs` | Overkill — agents are for reasoning, not filesystem glob |
| Random batching into groups of 100 | Trivial array shuffle + slice | Agent would call Bash for this anyway |
| Execution (jest/playwright/pytest run) | Bash via `execSync` or `spawnSync` | Agent spawns Bash — same result, more overhead |
| Output capture (structured JSON) | Direct `spawnSync` output capture | Agent parses text output — fragile |
| Resumability (save batch index to disk) | Write JSON file directly | Agent would use gsd-tools.cjs anyway |
| Context window | Zero impact | Consumes 10k+ tokens per batch |

The workflow (Claude) handles the reasoning layer: reading batch outputs, calling categorization logic, deciding what to skip/adapt/isolate/fix. The Node.js CLI handles the mechanical layer: discover, batch, run, capture, persist state.

**New `gsd-tools.cjs` sub-commands to add:**

```
maintain-tests discover [--runner auto|jest|playwright|pytest] [--dir path]
  → JSON: { runner, test_files[], total_count, detected_runner }

maintain-tests batch --size N --seed S [--state-file path]
  → JSON: { batch_id, batch_files[], remaining_count, is_last_batch }
  (reads prior state from state-file to skip already-processed files)

maintain-tests run-batch [--state-file path] [--timeout N]
  → JSON: { batch_id, results[], passed_count, failed_count, skipped_count }
  (runs tests in the current batch, captures output per-file)

maintain-tests save-state [--state-file path] <json>
  → writes JSON to state file (used after categorization decisions)

maintain-tests load-state [--state-file path]
  → JSON: current maintenance session state
```

These are thin orchestration commands. They do no AI reasoning. All reasoning stays in the Claude workflow.

**Runner detection priority** (matches existing `/qgsd:quorum-test` pattern in `debug.md`):
1. `package.json` devDependencies/dependencies — jest, vitest, playwright
2. `package.json` scripts.test content
3. Presence of `pytest.ini`, `pyproject.toml` with `[tool.pytest]`
4. Fallback: `node --test`

---

### AI Categorization Loop: Connection to Existing debug/quick Patterns

The categorization loop is the core reasoning layer. It maps to existing patterns as follows:

**Existing patterns it builds on:**

| Existing Pattern | How maintain-tests uses it |
|-----------------|---------------------------|
| `/qgsd:debug` — quorum workers diagnose a failure, reach consensus on next step | Categorization uses the same quorum worker dispatch but for bulk classification, not single-failure diagnosis |
| `/qgsd:quick` — spawns planner + executor for an ad-hoc task | After categorization identifies "adapt" failures, a quick task is spawned to implement the fix |
| `execute-phase` checkpoint:verify loop — debug → fix → verify → repeat | Batch iteration loop mirrors this: run batch → categorize → action → verify → next batch |
| `qgsd-debugger` agent — autonomous multi-step investigation | Replaced here by structured 5-category classification (not open-ended debugging) |

**Categorization loop design:**

```
For each batch:
  1. run-batch (Node.js CLI) → results JSON
  2. Claude reads results, spawns parallel categorization workers (Task) per failing test
     Each worker classifies into 5 categories:
       - valid_skip: test is permanently irrelevant (outdated, wrong environment)
       - adapt: test logic needs updating for current codebase state
       - isolate: test has flaky/env dependency, needs isolation wrapper
       - real_bug: test found a genuine regression, needs code fix
       - fixture: test needs data/fixture update only
  3. Claude aggregates classifications → action plan per category
  4. Action dispatch:
       valid_skip → mark in state as skipped; update test file with skip annotation
       fixture    → spawn /qgsd:quick to update fixtures
       adapt      → spawn /qgsd:quick to adapt test logic
       isolate    → spawn /qgsd:quick to add isolation wrapper
       real_bug   → surface to user with diagnosis; do NOT auto-fix (requires human)
  5. After actioning: re-run affected tests to confirm categorization was correct
  6. Save state (Node.js CLI): mark batch complete, record outcomes
  7. Load next batch if remaining_count > 0
```

**Connection to `/qgsd:debug`:**

The categorization workers use the same quorum dispatch pattern as `/qgsd:debug` Step 3 (parallel Task calls to Gemini, OpenCode, Copilot, Codex). The key difference is the prompt:

- `/qgsd:debug`: "What is the root cause? What is the next debugging step?" (investigative)
- `maintain-tests` categorization: "Which of the 5 categories does this failure belong to? Why?" (classificatory)

The consensus mechanism is identical: 3+ workers agree → consensus category. Disagreement → Claude as tiebreaker (same as R3.3 deliberation).

**Connection to `/qgsd:quick`:**

After categorization, `adapt`, `fixture`, and `isolate` failures are actioned via `/qgsd:quick` spawns. This uses the existing quick workflow without modification. The maintain-tests workflow calls quick as a sub-task:

```
Task(
  subagent_type="general-purpose",
  prompt="Run /qgsd:quick: [specific fix description for this test adaptation]"
)
```

This keeps quick tasks atomic and tracked in `.planning/quick/` as usual. Each quick task produces a SUMMARY.md. The maintain-tests session state references the quick task number for traceability.

---

### State Tracking Across Batch Iterations

For 20k+ test suites, batch progress must survive interruption. The state tracking uses two mechanisms:

**1. Session state file: `.planning/maintain-tests-state.json`**

Written by `gsd-tools.cjs maintain-tests save-state`. Gitignored (alongside `circuit-breaker-state.json`). Structure:

```json
{
  "session_id": "2026-02-22T14:30:00Z",
  "runner": "jest",
  "total_tests": 21000,
  "batch_size": 100,
  "seed": 42,
  "batches_complete": 15,
  "batches_total": 210,
  "processed_files": ["path/to/test1.test.js", "..."],
  "results_by_category": {
    "valid_skip": ["..."],
    "adapt": ["..."],
    "isolate": ["..."],
    "real_bug": ["..."],
    "fixture": ["..."]
  },
  "actioned": {
    "valid_skip": ["..."],
    "adapt": { "quick-task-42": ["test-file-1.js"] },
    "isolate": { "quick-task-43": ["test-file-2.js"] },
    "fixture": { "quick-task-44": ["test-file-3.js"] }
  },
  "pending_real_bugs": [
    { "file": "test-file-4.js", "diagnosis": "...", "surfaced_to_user": false }
  ],
  "updated": "2026-02-22T15:45:00Z"
}
```

**2. Activity sidecar: `.planning/current-activity.json`**

Existing `gsd-tools.cjs activity-set` is called at each state transition. Structure for maintain-tests:

```json
{
  "activity": "maintain_tests",
  "sub_activity": "categorizing_batch",
  "batch": 15,
  "batch_total": 210,
  "state_file": ".planning/maintain-tests-state.json",
  "updated": "2026-02-22T15:45:00Z"
}
```

`sub_activity` values for the routing table (resume-work):

| sub_activity | Resume action |
|---|---|
| `discovering_tests` | Re-run discovery |
| `running_batch` | Re-run current batch (batch N in state file) |
| `categorizing_batch` | Load batch results from state, resume categorization |
| `actioning_batch` | Resume quick task dispatch for current batch |
| `verifying_batch` | Re-run verification for actioned tests |
| `complete` | Report summary, clear activity |

**Resumability design:**

The batch iterator uses a deterministic seed stored in state. The same seed + full processed_files list allows the next session to skip already-processed tests and resume from batch N+1. This means `maintain-tests batch` always takes `--state-file` and excludes files in `processed_files`. The 20k+ scale is handled by array filtering (O(n) in memory), which is acceptable for Node.js with arrays up to ~100k entries.

**No new `gsd-tools.cjs init maintain-tests` compound command needed.** Unlike `plan-phase` or `execute-phase` which need rich init context (model profiles, roadmap state, phase structure), maintain-tests needs only: state file path, runner, batch size. These are simple enough to construct inline in the workflow without a compound init call.

---

## Recommended File Structure — New Files Only

```
QGSD/
├── commands/qgsd/
│   └── maintain-tests.md       # NEW: slash command stub (frontmatter + execution_context ref)
├── workflows/
│   └── maintain-tests.md       # NEW: full workflow orchestrator
├── bin/
│   └── install.js              # MODIFIED: add maintain-tests.md to WORKFLOWS_TO_COPY
└── .planning/
    └── phases/18-*/             # NEW: phase directories for v0.3 plans
```

No new agents. No new hooks. No new Node.js modules outside `gsd-tools.cjs`.

Gitignore additions (`.gitignore` or `.claude/.gitignore`):

```
.planning/maintain-tests-state.json
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `commands/qgsd/maintain-tests.md` | Command entry point; routes to workflow | Claude Code (slash command dispatch) |
| `workflows/maintain-tests.md` | Orchestrates the full maintain-tests session; spawns workers; dispatches quick tasks | gsd-tools.cjs, Task() workers, /qgsd:quick via Task |
| `gsd-tools.cjs` (extended) | Discovery, batching, run, state I/O | Filesystem, test runners (jest/playwright/pytest via spawnSync) |
| Task workers (inline, not agents) | Parallel failure categorization using quorum models | Gemini/OpenCode/Copilot/Codex MCP tools |
| `/qgsd:quick` (existing, unmodified) | Implements adapt/fixture/isolate fixes as atomic tasks | Existing planner + executor agents |
| `current-activity.json` (existing) | Session resume routing | resume-work workflow |
| `maintain-tests-state.json` (new) | Batch progress, processed files, categorization results | gsd-tools.cjs, maintain-tests workflow |

---

## Data Flow

### Full Maintain-Tests Session

```
User: /qgsd:maintain-tests [--batch-size 100]
          |
          v
maintain-tests.md workflow
  1. Read state (gsd-tools.cjs maintain-tests load-state)
     - If no state: start fresh (discover → batch)
     - If state exists: resume from last complete batch
          |
          v
  2. Discovery
     gsd-tools.cjs maintain-tests discover
     → { runner, test_files[], total_count }
          |
          v
  3. Batch loop (repeats until all files processed)
     a. gsd-tools.cjs maintain-tests batch --size 100 --seed S --state-file ...
        → { batch_id, batch_files[], remaining_count }
     b. activity-set { activity: maintain_tests, sub_activity: running_batch, batch: N }
     c. gsd-tools.cjs maintain-tests run-batch --state-file ...
        → { results[] }  (passed/failed/error per file)
     d. activity-set { sub_activity: categorizing_batch }
     e. Parallel Task dispatch: categorization workers per failed test
        - 4 workers (Gemini, OpenCode, Copilot, Codex)
        - Each returns: { category, confidence, reasoning }
        - Claude aggregates → consensus category per test
     f. activity-set { sub_activity: actioning_batch }
     g. Action dispatch:
        - valid_skip → write skip annotation directly
        - adapt/fixture/isolate → spawn /qgsd:quick per group
        - real_bug → surface to user, do NOT auto-fix
     h. activity-set { sub_activity: verifying_batch }
     i. Re-run actioned tests to confirm
     j. gsd-tools.cjs maintain-tests save-state (batch complete)
     k. activity-set { sub_activity: categorizing_batch, batch: N+1 }  (next iteration)
          |
          v
  4. Session complete
     - Print summary: total/passed/skipped/adapted/isolated/real_bugs
     - gsd-tools.cjs activity-clear
     - Write quick task summary to .planning/quick/ (if any quick tasks spawned)
```

### Batch→Categorize→Iterate Loop Detail

```
Batch N results JSON
    ↓
Claude reads: test_file, error_output, stack_trace per failed test
    ↓
For each failed test (parallel Task dispatch):
    Worker prompt:
      "Given this test failure, classify into ONE of:
       valid_skip / adapt / isolate / real_bug / fixture
       Respond: category: X, confidence: HIGH|MED|LOW, reason: ..."
    Workers: Gemini, OpenCode, Copilot, Codex
    ↓
Claude aggregates (same consensus logic as /qgsd:debug):
    - 3+ workers agree → consensus category
    - Disagreement → Claude tiebreaker
    ↓
action_plan = group tests by consensus category
    ↓
For adapt/fixture/isolate groups:
    Task( /qgsd:quick "Fix [N] tests: [category] - [brief description]" )
    → each quick task tracked in .planning/quick/ with SUMMARY.md
    ↓
For real_bug tests:
    Collect diagnosis + test file path
    Surface to user at session end (not mid-loop)
    ↓
Batch state saved → advance to batch N+1
```

---

## Architectural Patterns

### Pattern 1: Thin CLI + Reasoning Workflow Separation

**What:** Node.js CLI (`gsd-tools.cjs`) handles all mechanical operations (discovery, batching, test execution, state I/O). The workflow (Claude) handles all reasoning (categorization, action decisions, quorum consensus).

**When to use:** Always, for QGSD features. This mirrors how `execute-phase` uses `gsd-tools.cjs init execute-phase` for mechanical context gathering while Claude handles wave coordination and plan reading.

**Trade-offs:**
- Pro: Testable CLI operations; reasoning is separate from mechanics
- Pro: Workflow stays readable (no embedded subprocess logic)
- Con: State passing via JSON files requires careful schema design

### Pattern 2: Deterministic Batching with Resumable State

**What:** Batches are determined by a fixed seed + processed_files exclusion list. The same seed always produces the same ordering; the exclusion list ensures already-processed tests are skipped.

**When to use:** Any large-dataset iteration where interruption is likely (20k+ tests can take hours).

**Example:**

```javascript
// gsd-tools.cjs maintain-tests batch
function seededShuffle(arr, seed) {
  // Mulberry32 or similar fast PRNG — no external dependency
  let s = seed;
  return arr.slice().sort(() => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF - 0.5;
  });
}
const unprocessed = allFiles.filter(f => !processedFiles.includes(f));
const shuffled = seededShuffle(unprocessed, state.seed);
const batch = shuffled.slice(0, batchSize);
```

**Trade-offs:**
- Pro: Resumable without re-running completed batches
- Pro: No external shuffle dependency
- Con: Must persist `processed_files` array; grows to 20k+ entries (acceptable in JSON)

### Pattern 3: Category-Grouped Quick Task Dispatch

**What:** Instead of spawning one quick task per failing test (which could be thousands), group by category and description similarity, then spawn one quick task per group (e.g., "adapt 12 snapshot tests after model schema change").

**When to use:** Any time categorization produces many similar failures. Anti-pattern: spawning a quick task per individual test.

**Grouping heuristic:**
- Same category + same error type + same directory → same group
- Cap group size at 20 tests per quick task (keeps tasks atomic)
- If group > 20: spawn multiple quick tasks for the same fix

**Trade-offs:**
- Pro: Manageable quick task count (likely 10–50 tasks, not thousands)
- Pro: Each quick task has a clear, focused scope
- Con: Grouping heuristic must be conservative — wrong grouping misses test-specific context

### Pattern 4: Real Bug Deferral (No Auto-Fix)

**What:** Tests classified as `real_bug` are collected into a summary but NOT actioned. They are surfaced to the user at session end with diagnosis.

**When to use:** Any time auto-fixing a failure could hide a genuine regression.

**Why this is architectural:** Real bugs represent code that is genuinely broken. Auto-fixing by adapting the test would mask the bug, defeating the purpose of the test suite. The maintain-tests command's job is to maximize test suite value, not to make CI green at any cost.

**Surface format:**

```
## Real Bugs Found (require human attention)

| Test File | Error Summary | Diagnosis |
|-----------|---------------|-----------|
| path/to/test.js | TypeError: cannot read X of undefined | Model.findById() returns null after schema migration; fixture needs seeding |
```

---

## Anti-Patterns

### Anti-Pattern 1: Running Full Test Suite Per Batch Iteration

**What people do:** Run `jest` with no file filter, then manually extract per-file results.

**Why it's wrong:** For 20k+ tests, a full suite run may take 30+ minutes per iteration. Batching requires targeted per-file execution. Jest, pytest, and playwright all support file-targeted execution.

**Do this instead:**

```bash
# Jest: target specific files
npx jest path/to/test1.js path/to/test2.js --passWithNoTests

# pytest: target specific files
pytest path/to/test1.py path/to/test2.py

# playwright: target specific spec files
npx playwright test path/to/test1.spec.ts
```

The `gsd-tools.cjs run-batch` command builds the correct invocation per runner.

### Anti-Pattern 2: One Quick Task Per Failing Test

**What people do:** For each categorized test, spawn `/qgsd:quick` to fix it.

**Why it's wrong:** 200 failing tests → 200 quick tasks → 200 STATE.md entries + 200 commits. The quick task table becomes unreadable. Each task also has planning + execution overhead.

**Do this instead:** Group by category + similarity. One quick task fixes a batch of related failures. Cap at 20 tests per task.

### Anti-Pattern 3: Adding maintain-tests to quorum_commands

**What people do:** Add `maintain-tests` to the Stop hook's quorum command allowlist so quorum runs before delivering results.

**Why it's wrong:** `maintain-tests` is an EXECUTION command, not a PLANNING command. CLAUDE.md R2.2 prohibits quorum during execution. Quorum on execution is also impractical here: batch iterations happen dozens to hundreds of times; quorum on every batch output would be non-functional.

**Do this instead:** Quorum is only needed when maintain-tests is first planned (that planning happens in `/qgsd:plan-phase` for the feature being worked on, which already has quorum). Execution remains Claude-only per R2.2.

### Anti-Pattern 4: Storing Full Test Output in State File

**What people do:** Write the full stderr/stdout of each test run into `maintain-tests-state.json`.

**Why it's wrong:** A failing test can produce 50KB of output. 100 failing tests in a batch → 5MB per batch iteration → state file grows to gigabytes over a 20k-test session.

**Do this instead:** Store only: test file path, exit code, error type classification, and first 500 chars of error output (for categorization context). Full output is captured in a per-batch temp file that is replaced each iteration and not persisted.

### Anti-Pattern 5: Spawning gsd-tools.cjs as a Claude Subagent

**What people do:** `Task("Run gsd-tools.cjs maintain-tests discover and report back")`.

**Why it's wrong:** `gsd-tools.cjs` is a CLI tool, not an agent. Spawning it as a Task burns context window and adds agent spawn overhead for work that is trivially done with a direct `Bash` call in the workflow.

**Do this instead:**

```bash
DISCOVERY=$(node ~/.claude/qgsd/bin/gsd-tools.cjs maintain-tests discover --runner auto)
```

Bash calls to `gsd-tools.cjs` are the standard pattern across all existing QGSD workflows.

---

## Build Order — Phases 18+

The build order is constrained by: (a) existing QGSD phase numbering (v0.2 ended at Phase 17), (b) the dependency chain within maintain-tests itself.

```
Phase 18: CLI Foundation (gsd-tools.cjs extension)
  - maintain-tests discover sub-command
  - maintain-tests batch sub-command
  - maintain-tests run-batch sub-command (jest/playwright/pytest runners)
  - maintain-tests save-state / load-state sub-commands
  - Unit tests for all new sub-commands
  Dependency: none (extends existing gsd-tools.cjs)
  Risk: runner detection logic across 3 test frameworks; pytest subprocess on non-Python projects

Phase 19: State Schema + Activity Tracking Integration
  - maintain-tests-state.json schema definition
  - .gitignore addition
  - activity-set sub_activity values for resume-work routing table
  - resume-work.md routing table addition (6 new rows for maintain-tests sub_activities)
  Dependency: Phase 18 (state schema informed by CLI commands)
  Risk: resume-work routing table already has 15+ rows; adding 6 more requires careful disambiguation

Phase 20: Workflow Orchestrator
  - workflows/maintain-tests.md (full workflow: discovery → batch loop → categorize → action → verify)
  - commands/qgsd/maintain-tests.md (slash command stub)
  - Installer addition: WORKFLOWS_TO_COPY entry
  Dependency: Phase 18 (CLI commands), Phase 19 (state schema, activity tracking)
  Risk: workflow complexity; batch loop with categorization workers is the most complex workflow in QGSD

Phase 21: Categorization Engine
  - Quorum worker prompt design (5-category classification)
  - Consensus aggregation logic in workflow
  - Category-grouped quick task dispatch logic
  - Real bug deferral and surface format
  Dependency: Phase 20 (workflow structure must exist to add categorization)
  Risk: Quorum model availability during categorization; LOW confidence in consensus rate for novel test failure patterns

Phase 22: Integration Test + Verification
  - End-to-end test on a real failing test suite
  - VERIFICATION.md for Phases 18–21
  - Update installer to install maintain-tests command + workflow
  Dependency: All prior phases
  Risk: Integration test requires a project with controllable test failures; use QGSD's own test suite or a fixture project
```

**Phase ordering rationale:**

- Phase 18 first: CLI foundation is mechanically testable before any workflow logic exists. Unit tests for `discover`/`batch`/`run-batch` catch runner detection bugs before they block workflow development.
- Phase 19 before Phase 20: The workflow needs a stable state schema and activity tracking hooks. Getting these wrong after the workflow is built would require a rewrite.
- Phase 20 before Phase 21: Categorization is a feature of the workflow, not a standalone component. The workflow shell must exist before categorization logic is added.
- Phase 21 is the highest-risk phase: quorum worker prompt design for 5-category classification is novel. It should be isolated in its own phase so prompt failures don't block the rest of the workflow.
- Phase 22 last: Integration testing requires all prior phases to be functional.

**No research flag needed for Phases 18–19.** CLI extension and state schema follow established patterns in `gsd-tools.cjs`.

**Research flag for Phase 21:** Quorum worker classification prompts for test categorization are novel. Phase-specific research should verify: (a) whether 5-category classification is achievable with the quorum models at HIGH confidence, (b) whether categorization prompts need examples/few-shot to be reliable, (c) what consensus rate to expect and how to handle persistent disagreement.

---

## Integration Points

### New vs Modified Components

| Component | Status | Notes |
|-----------|--------|-------|
| `commands/qgsd/maintain-tests.md` | NEW | Slash command stub |
| `workflows/maintain-tests.md` | NEW | Full workflow orchestrator |
| `gsd-tools.cjs` (maintain-tests sub-commands) | MODIFIED | Additive — no existing commands changed |
| `bin/install.js` (WORKFLOWS_TO_COPY) | MODIFIED | One array entry added |
| `resume-work.md` (routing table) | MODIFIED | 6 new rows for maintain-tests sub_activities |
| `.gitignore` | MODIFIED | One new entry for maintain-tests-state.json |
| `config-loader.js` | UNMODIFIED | No new config keys needed |
| `qgsd-prompt.js` | UNMODIFIED | maintain-tests not a quorum command |
| `qgsd-stop.js` | UNMODIFIED | No scope change |
| `qgsd-circuit-breaker.js` | UNMODIFIED | No new Bash patterns to exempt |
| Existing agents (planner, executor, debugger) | UNMODIFIED | Quick tasks use them as-is |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| maintain-tests.md workflow → gsd-tools.cjs | Bash call, JSON stdout | Same pattern as all existing workflows |
| maintain-tests.md → test runners | Bash via gsd-tools.cjs run-batch | gsd-tools.cjs owns runner invocation |
| maintain-tests.md → categorization workers | Task() parallel spawns | Same pattern as /qgsd:debug Step 3 |
| maintain-tests.md → /qgsd:quick | Task() sequential spawn | Existing quick workflow, unmodified |
| gsd-tools.cjs → maintain-tests-state.json | fs.readFileSync / writeFileSync | JSON, gitignored |
| gsd-tools.cjs → current-activity.json | activity-set (existing command) | Same as execute-phase |
| resume-work.md → maintain-tests-state.json | Bash read via gsd-tools.cjs load-state | Resume routing reads state to recover position |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — HIGH confidence (authoritative project scope). v0.3 goal: discover, batch, categorize, iterate.
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/debug.md` — HIGH confidence (source read). Quorum worker dispatch pattern, consensus logic, parallel Task dispatch.
- `/Users/jonathanborduas/code/QGSD/commands/qgsd/quick.md` — HIGH confidence (source read). Quick task pattern for atomic fixes.
- `/Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs` — HIGH confidence (source read). Existing sub-command interface, init compound commands, activity-set pattern.
- `/Users/jonathanborduas/.claude/qgsd/workflows/execute-phase.md` — HIGH confidence (source read). Activity-set usage across step transitions; checkpoint:verify pattern.
- `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md` — HIGH confidence (source read). Quick task workflow structure, init call, STATE.md update pattern.
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — HIGH confidence (source read). Two-layer config, DEFAULT_CONFIG structure, no changes required.
- `/Users/jonathanborduas/code/QGSD/.planning/STATE.md` — HIGH confidence (source read). Phase numbering (last phase = 17), key decisions table.

---

*Architecture research for: QGSD v0.3 — /qgsd:maintain-tests integration*
*Researched: 2026-02-22*
