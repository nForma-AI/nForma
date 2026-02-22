# Phase 21: Categorization Engine — Research

**Researched:** 2026-02-22
**Domain:** AI-driven test failure classification, git pickaxe context, grouped quick task dispatch
**Confidence:** HIGH — all findings derived from live source code inspection of gsd-tools.cjs, fix-tests workflow, run-batch output schema, and Phase 20 summary

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CATG-01 | Claude classifies each confirmed failure into one of 5 categories: `valid-skip` / `adapt` / `isolate` / `real-bug` / `fixture` | Categorization prompt design; context assembly (test source + stack trace files); `deferred` convergence category; context_score gating |
| CATG-02 | For `adapt`-categorized failures, tool provides git pickaxe context (`git log -S`) linking the failing test to the commit that changed the code under test | `git log -S` pickaxe invocation pattern; identifier extraction from test source; result format for prompt enrichment |
| CATG-03 | `adapt`, `fixture`, and `isolate` failures are automatically grouped by category, error type, and directory — then dispatched as `/qgsd:quick` tasks (max 20 tests per task); `real-bug` failures go to a deferred user report and never auto-actioned | Task dispatch pattern; grouping algorithm; max-20 cap; `/qgsd:quick` invocation from within fix-tests workflow; deferred report format |
</phase_requirements>

---

## Summary

Phase 21 replaces the stub categorization in Step 6d of the fix-tests workflow with a real AI classification engine. The stub marks every confirmed failure as `real_bug`. Phase 21 must (a) assemble context for each confirmed failure — test file source + top-2 stack trace source files — compute a `context_score`, run Claude's own classification (the fix-tests workflow IS Claude, so categorization happens inline), (b) for `adapt` results, run `git log -S` to identify the commit that mutated the code under test, and (c) group actionable failures (`adapt`, `fixture`, `isolate`) by category + error type + directory, then dispatch them as `/qgsd:quick` tasks capped at 20 tests per task.

The critical insight is that fix-tests runs AS Claude — categorization is Claude reasoning directly from the context assembled for each failure, not a separate API call. The categorization prompt defines the 5-category taxonomy with decision rules, and Claude produces a structured JSON verdict with a `category` field and `context_score`. Context assembly (reading file sources, parsing stack traces) happens via Bash + Read within the workflow. Only results with `context_score >= 2` proceed to auto-action dispatch (CATG-03); lower-confidence results go to the deferred user report alongside `real-bug`.

Quick task dispatch reuses the `/qgsd:quick` mechanism by invoking the gsd-tools.cjs quick workflow machinery. The fix-tests workflow calls `gsd-tools.cjs init quick` and then spawns a `qgsd-planner` Task agent — identical to how a human would type `/qgsd:quick` — except the description is programmatically generated from the grouped failure batch. This is permitted because fix-tests is already running inside Claude's context; it spawns sub-Tasks the same way the quick workflow does.

**Primary recommendation:** Implement categorization as an inline Claude reasoning step (not a spawned sub-agent) that processes all confirmed failures in a batch, produces a JSON verdict array, then runs git pickaxe enrichment for `adapt` results, then groups and dispatches quick tasks for actionable categories.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsd-tools.cjs | Local | save-state/load-state, activity-set, quick init | Already built Phases 18–20; no new deps |
| Node.js `child_process.spawnSync` | Node built-in | Run `git log -S` pickaxe commands (synchronous, short-lived) | Consistent with Phase 18 pattern for CLI invocations; spawnSync safe for short git queries |
| Node.js `fs.readFileSync` | Node built-in | Read test file source and stack trace source files | Synchronous read; context assembly is sequential by design |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `git log -S"<identifier>" --oneline --diff-filter=M -- <path>` | git built-in | Pickaxe search: find commit that introduced/modified the identifier tested | Only for `adapt`-classified failures; run after category verdict |
| `git log -S"<identifier>" --oneline -10` | git built-in | Broader pickaxe if path-scoped search returns nothing | Fallback when test imports cross-directory |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline Claude reasoning for categorization | Spawned sub-agent per failure | Sub-agent per failure wastes context startup; inline reasoning leverages Claude's already-loaded context and is faster at scale |
| Grouping by directory only | Grouping by category + error_type + directory | Error type adds semantic grouping so a fixer gets same-error failures together; without error type, fixtures and import errors end up mixed |
| Max 20 tests/task as hard cap | Configurable cap | The success criteria specify "max 20 tests per task" — treat 20 as the fixed cap unless qgsd.json overrides |

**Installation:** No new packages. All dependencies are git + Node built-ins already present.

---

## Architecture Patterns

### Recommended Project Structure (Phase 21 changes only)

```
get-shit-done/workflows/
  fix-tests.md                     # MODIFY: replace Step 6d stub with full categorization
  # Source copy + installed copy, same as Phase 20

bin/gsd-tools.cjs                  # NO CHANGE: categorization is a workflow step, not a CLI subcommand
```

Phase 21 does NOT add new gsd-tools.cjs subcommands. All categorization logic lives in the workflow file (and the installed copy). The workflow IS Claude reasoning — the classification happens inline, not via a new CLI.

---

### Pattern 1: Context Assembly for Each Confirmed Failure

**What:** For each confirmed failure (status == 'failed' in batch result), assemble: (1) full test file source, (2) top-2 source files referenced in the stack trace (error_summary), (3) a context_score.
**When to use:** Before presenting each failure to the categorization step.

```
For each result in batch_results where status == 'failed':

  1. Read test file source:
     TEST_SOURCE = Read(result.file)   [or Bash cat if file is large — truncate at 4000 chars]

  2. Parse stack trace from error_summary:
     - Extract file paths that match src/ or lib/ or app/ (not node_modules, not the test file itself)
     - Take top 2 unique source paths
     - Read each: SOURCE_FILE_1 = Read(stack_path_1), SOURCE_FILE_2 = Read(stack_path_2)

  3. Compute context_score:
     - +1 if TEST_SOURCE is available and non-empty
     - +1 if at least 1 stack trace source file was read successfully
     - +1 if error_summary is non-null and non-empty
     Score range: 0–3

  4. If context_score < 2: skip categorization → put in deferred_tests (not auto-actioned)
```

**context_score meaning:**
- 0 — no context at all (empty test, no error) → deferred
- 1 — only test source OR only error_summary → deferred
- 2 — test source + error_summary OR test source + stack file → categorize (minimum actionable)
- 3 — full context → categorize with high confidence

**Warning:** `error_summary` in the run-batch output is truncated to 500 characters (verified in gsd-tools.cjs `truncateErrorSummary`). This is enough for stack frame extraction but not the full output. Accept this limitation; the test source + source file context compensates.

---

### Pattern 2: Categorization Prompt — 5-Category Taxonomy

**What:** Present Claude with assembled context and have it produce a structured JSON verdict.
**When to use:** For each confirmed failure with context_score >= 2.

```
The categorization happens as inline Claude reasoning — the fix-tests workflow instructs Claude
(itself) to classify the failure based on the assembled context. The "prompt" is the workflow
instruction that specifies the decision rules.
```

**5-Category Decision Rules:**

| Category | When to Classify | Action |
|----------|-----------------|--------|
| `valid-skip` | Test was already skipped or marked pending in the test file; or tests a removed/deprecated feature; test file checks `process.env.CI` | No action — mark processed |
| `adapt` | Test failure is caused by a real code change that mutated the behavior the test asserts; error_summary shows "expected X got Y" or assertion mismatch clearly traceable to a code change | Enriched with git pickaxe context; dispatched as quick task |
| `isolate` | Test fails only due to environment or ordering dependency (no real code change); error shows missing env var, port conflict, race condition, or depends on another test's side effects | Dispatched as quick task (make test standalone) |
| `real-bug` | Test failure reveals a genuine defect in the code under test that requires developer judgment to fix; stack trace shows panic/crash/wrong logic | Deferred user report — never auto-actioned |
| `fixture` | Test fails because a fixture file, test data file, snapshot, or generated mock is stale/missing/mismatched | Dispatched as quick task (regenerate/update fixture) |

**Convergence category (not in CATG-01 but in success criteria):**

| Category | When | Meaning |
|----------|------|---------|
| `deferred` | context_score < 2, OR Claude cannot determine category with confidence | Not auto-actioned; added to deferred_tests in state |

**Categorization output per failure (JSON):**

```json
{
  "file": "path/to/test.test.js",
  "category": "adapt",
  "confidence": "high",
  "context_score": 3,
  "reason": "AssertionError: expected 'v2' to equal 'v1' — likely caused by API return format change",
  "error_type": "assertion_mismatch",
  "pickaxe_context": null
}
```

The `error_type` field enables grouping for dispatch. Standard error types:
- `assertion_mismatch` — expected != actual
- `import_error` — cannot find module / import fails
- `snapshot_mismatch` — snapshot does not match
- `fixture_missing` — fixture file not found
- `env_missing` — environment variable not set
- `port_conflict` — address already in use
- `timeout` — test took too long
- `unknown` — cannot classify error type

---

### Pattern 3: Git Pickaxe Context (CATG-02)

**What:** For every `adapt`-classified failure, run `git log -S` to find the commit that changed the behavior under test.
**When to use:** After category verdict, before dispatch, only for adapt results.

```bash
# Step 1: Extract identifier from test source
# Look for the primary function/method/class being tested
# Extract the string being asserted or the import name as the search term
IDENTIFIER="<function or string being tested>"

# Step 2: Run pickaxe scoped to likely source file directory
git log -S"$IDENTIFIER" --oneline --diff-filter=M -- src/ lib/ app/ 2>/dev/null | head -10

# Step 3: Fallback — broader search if scoped returns nothing
git log -S"$IDENTIFIER" --oneline -10 2>/dev/null

# Step 4: Attach to verdict JSON
pickaxe_context = {
  "identifier": IDENTIFIER,
  "commits": ["abc1234 feat: change API return format", ...],
  "command_run": "git log -S\"<identifier>\" --oneline -10"
}
```

**Important constraints:**
- Run in the project root (use `git rev-parse --show-toplevel`)
- If `git log -S` returns no commits: set `pickaxe_context.commits = []` — do not fail
- If the git repo has no history or the project dir is not a git repo: set `pickaxe_context = null` — still dispatch the adapt task (pickaxe is enhancement, not gating)
- Keep `IDENTIFIER` short (< 60 chars) to avoid shell escaping issues with spawnSync

```bash
# Safe invocation pattern (Source: Phase 18 decision — use spawnSync, not execSync)
const result = spawnSync('git', ['log', `-S${identifier}`, '--oneline', '-10'], {
  cwd: projectRoot,
  encoding: 'utf-8'
});
const commits = result.stdout ? result.stdout.trim().split('\n').filter(Boolean) : [];
```

---

### Pattern 4: Grouping Algorithm for Task Dispatch (CATG-03)

**What:** Group actionable failures (adapt, fixture, isolate) into dispatch batches for /qgsd:quick tasks.
**When to use:** After all failures in a batch are categorized; before dispatch.

```
Group key = category + "_" + error_type + "_" + directory_prefix

Where directory_prefix = first 2 path segments of test file path
(e.g., "src/auth" for "src/auth/user.test.js")

For each group:
  - Collect all test files with that group key
  - Chunk into sub-groups of max 20 files
  - Each sub-group becomes one /qgsd:quick task

Example groups:
  adapt_assertion_mismatch_src/auth → 35 files → 2 tasks (20 + 15)
  fixture_snapshot_mismatch_src/ui → 8 files → 1 task
  isolate_env_missing_tests/e2e → 12 files → 1 task
```

**Task description template (what gets sent to /qgsd:quick):**

```
Fix {count} {category} test failures in {directory_prefix} — {error_type}

Test files:
- path/to/test1.test.js (reason: <reason from verdict>)
- path/to/test2.test.js (reason: <reason from verdict>)
[... up to 20 files]

Category: {category}
Error pattern: {error_type}
{if adapt: "Git context: {pickaxe_context.commits[0..2]}"}
```

---

### Pattern 5: Dispatching a /qgsd:quick Task from Within fix-tests

**What:** Invoke the /qgsd:quick machinery programmatically from within the fix-tests workflow.
**When to use:** For each grouped dispatch batch (adapt, fixture, isolate).

The fix-tests workflow is already running as Claude. It can dispatch sub-Tasks the same way it would for any orchestration:

```
Task(
  prompt="
<planning_context>
Mode: quick
Description: {task_description}

<files_to_read>
- .planning/STATE.md
- ./CLAUDE.md (if exists)
</files_to_read>
</planning_context>

First, read ~/.claude/agents/qgsd-planner.md for your role and instructions.
Execute this as a quick task with GSD guarantees.
",
  subagent_type="qgsd-planner",
  model="{planner_model}",
  description="Fix {category} failures: {directory_prefix}"
)
```

**Critical:** fix-tests is execution-only (INTG-03). Dispatching sub-Tasks to fix `adapt`/`fixture`/`isolate` failures is permitted because those Tasks are themselves execution activities on the target project's tests — not QGSD planning decisions that require quorum. The fix-tests workflow never calls quorum workers directly.

**Alternative dispatch approach (simpler):** Instead of spawning a Task agent inline, the fix-tests workflow can call `gsd-tools.cjs init quick "{description}"` to register the task and create its directory, then let the user pick it up via `/qgsd:quick` or `/qgsd:resume-work`. This "deferred dispatch" is safer but less autonomous. The success criteria say "automatically dispatched" — use inline Task spawning.

---

### Pattern 6: State Schema Extensions for Phase 21

Phase 21 must add new fields to the state JSON (non-breaking under schema_version: 1 — save-state accepts arbitrary JSON):

```json
{
  "schema_version": 1,
  "...existing fields...",
  "results_by_category": {
    "valid_skip": [],
    "adapt": [],
    "isolate": [],
    "real_bug": [],
    "fixture": []
  },
  "categorization_verdicts": [
    {
      "file": "path/to/test.test.js",
      "category": "adapt",
      "confidence": "high",
      "context_score": 3,
      "reason": "...",
      "error_type": "assertion_mismatch",
      "pickaxe_context": { "identifier": "...", "commits": ["..."] }
    }
  ],
  "deferred_tests": ["path/to/test.test.js"],
  "dispatched_tasks": [
    {
      "task_id": "42",
      "category": "adapt",
      "error_type": "assertion_mismatch",
      "directory": "src/auth",
      "test_count": 15,
      "test_files": ["..."],
      "dispatched_at": "2026-02-22T..."
    }
  ],
  "deferred_report": {
    "real_bug": ["path/to/test.test.js"],
    "low_context": ["path/to/test2.test.js"]
  }
}
```

**Key new fields:**
- `categorization_verdicts` — full verdict for every classified failure (enables Phase 22 audit)
- `dispatched_tasks` — record of every /qgsd:quick task dispatched (enables deduplication on resume)
- `deferred_report` — accumulated real_bug + low_context (< 2) failures for user report at end
- `deferred_tests` — already in Phase 20 schema; Phase 21 populates it for real

---

### Pattern 7: Deferred User Report (real-bug + low context)

**What:** Failures that must not be auto-actioned are accumulated in `state.deferred_report` and printed at the end of the fix-tests run as a human-readable report.
**When to use:** At Step 9 (terminal summary), after re-enabling circuit breaker.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Deferred Failures (Action Required)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Real bugs (requires developer judgment):
  - src/payments/process.test.js — AssertionError: payment total wrong
  - ...

Low context (couldn't classify reliably):
  - tests/e2e/smoke.test.js — context_score: 1
  - ...

These failures were NOT auto-actioned. Review manually.
Full details in: .planning/maintain-tests-state.json (deferred_report)
```

---

### Anti-Patterns to Avoid

- **Spawning a sub-agent per failure:** Context startup overhead per failure makes this impractical at 20k tests. Process failures in batches inline.
- **Running git pickaxe before category verdict:** Only run pickaxe for confirmed `adapt` results — running it universally wastes time and produces noise.
- **Auto-actioning real-bug failures:** Strictly prohibited by success criteria and by common sense (source changes need developer review). real_bug goes to deferred report ONLY.
- **Dispatching tasks before state is saved:** Always save state (with dispatched_tasks record) BEFORE spawning Task agents. If the spawn fails, the state record enables retry/skip logic on resume.
- **Using error_summary alone for categorization:** error_summary is truncated at 500 chars (gsd-tools.cjs line 5890). Always supplement with test file source. The 500-char limit is enough for error type + first stack frame but not full output.
- **Forgetting to replace state.results_by_category.real_bug:** Phase 20 stub filled real_bug with all failures. Phase 21 must clear and repopulate all 5 category arrays from the real verdicts. On a fresh run this is no issue; on resume, Phase 21 must handle partially-classified state.
- **Over-engineering identifier extraction for pickaxe:** Use the test file's primary import name (the thing being `describe`d or `test`ed). A simple regex `describe\(['"](\w+)` or `import.*from ['"](.+)['"]` is sufficient — pickaxe is enhancement, not gating.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test failure classification API | Custom LLM call via fetch/axios | Claude's own inline reasoning (the workflow IS Claude) | fix-tests already runs as Claude — classification is inline reasoning, not a separate call |
| Context file reading | Custom file reader with encoding detection | `Read` tool (Claude) or `fs.readFileSync` (Bash) | Standard tools handle encoding; no new dep needed |
| Git commit history traversal | Custom git parsing | `git log -S` (pickaxe) | Pickaxe is git's built-in semantic search; hand-rolling is worse |
| Task dispatch queue | In-memory queue object | Task() spawn directly + state record | Quick workflow already handles task tracking; duplicate queue adds complexity |
| Error type classification | Regex library | Inline regex patterns in workflow | Error types are stable (7 types); a small match table is simpler than a library |

**Key insight:** Phase 21 is orchestration + reasoning, not I/O primitives. The mechanical layer (file reading, git calls, state writes) reuses built-in tools; the classification is Claude's native capability applied inline.

---

## Common Pitfalls

### Pitfall 1: Attempting to Re-Classify Already-Classified Failures on Resume

**What goes wrong:** On resume, Phase 21 tries to categorize failures that were already in `results_by_category` from a previous partial run, producing duplicates.

**Why it happens:** The batch loop resumes from `batches_complete`, which may include batches where categorization started but the workflow was interrupted mid-categorization.

**How to avoid:** Before categorizing a failure, check if `result.file` is already in any `results_by_category` array or in `categorization_verdicts`. If found: skip classification, use existing verdict for dispatch grouping.

**Warning signs:** Category array lengths exceed total_tests; duplicate file paths in verdicts.

---

### Pitfall 2: Git Pickaxe Produces No Results for Legitimate adapt Failures

**What goes wrong:** `git log -S"<identifier>"` returns empty output even for a real code change, causing the pickaxe_context.commits to be empty.

**Why it happens:** The identifier extracted from the test file doesn't match the changed symbol (renamed, refactored, test uses a wrapper). Common in heavily abstracted codebases.

**How to avoid:** Empty pickaxe is acceptable — the task still dispatches. Set `pickaxe_context.commits = []` and include the tested identifier in the task description so the fixer can search manually. Never gate dispatch on non-empty pickaxe.

**Warning signs:** All adapt failures have empty commits arrays even in a project with real history.

---

### Pitfall 3: context_score Threshold Blocks All Classifications

**What goes wrong:** `context_score < 2` check defers too many failures because error_summary is null or the stack trace has no recognizable source paths.

**Why it happens:** Some test runners (especially pytest) produce minimal error output that doesn't parse into source file paths. error_summary truncation at 500 chars also loses the full trace.

**How to avoid:** If `error_summary` is null but `TEST_SOURCE` is readable, score = 1 (deferred). If `TEST_SOURCE` is readable AND `error_summary` is non-null (even truncated), score = 2 (classify). This is the minimum threshold from the success criteria. Do not raise the threshold above 2 without empirical evidence.

**Warning signs:** Majority of failures are deferred with context_score = 1 despite having readable test files.

---

### Pitfall 4: Grouping Produces Tasks With Identical Descriptions

**What goes wrong:** Two groups have the same category + error_type + directory_prefix but different chunked test sets; the /qgsd:quick task descriptions are identical, confusing the task tracker.

**Why it happens:** Chunking 35 files in the same group produces two tasks both named "Fix adapt assertion_mismatch src/auth" — same directory.

**How to avoid:** Append chunk number to task description: "Fix adapt assertion_mismatch src/auth (batch 1/2)" and "(batch 2/2)".

**Warning signs:** Duplicate task slugs in `.planning/quick/` directory.

---

### Pitfall 5: Dispatching Tasks After Terminal Condition Has Fired

**What goes wrong:** The loop hits a terminal condition (no-progress guard fires) but still dispatches quick tasks for the batch that triggered termination, then exits. The tasks are dispatched but the terminal summary doesn't mention them.

**How to avoid:** Evaluate terminal conditions BEFORE dispatching tasks for each batch. If terminal: save state, skip dispatch, print terminal summary that includes any undispatched failures in the deferred_report.

---

### Pitfall 6: Phase 20 real_bug Stub Data Persists in State on Resume

**What goes wrong:** If Phase 21 is applied to a project that already ran Phase 20's stub categorization, the state file has all failures in `results_by_category.real_bug`. Phase 21's classification loop sees them as already-classified and skips them.

**How to avoid:** At Phase 21 workflow start (first execution in a session): check if `categorization_verdicts` is empty but `results_by_category.real_bug` is non-empty — this indicates stub state. Clear all category arrays and re-classify. The stub real_bug entries are not real verdicts; they must be replaced.

**Warning signs:** Phase 21 run completes but deferred_report.real_bug contains every failure and no tasks are dispatched.

---

## Code Examples

Verified patterns from live source inspection:

### Context Assembly (Read test file source)

```bash
# Source: workflow runs as Claude — use Read tool for source files, Bash for git
# In the workflow instruction to Claude:

Read the failing test file to get its full source:
  Read("path/to/failing.test.js")

Parse error_summary to extract stack trace file paths:
  - Lines matching: "at .* (src/..." or "File \"src/..."
  - Take first 2 unique non-test, non-node_modules paths
  - Read each: Read("src/extracted/path.js")

Compute context_score:
  - +1 if test source non-empty
  - +1 if at least 1 stack file read successfully
  - +1 if error_summary non-null and non-empty
```

### Git Pickaxe (spawnSync, safe for adapt enrichment)

```bash
# Source: Phase 18 decision — use spawnSync (not execSync) for CLI invocations
# Run in the workflow as a Bash step:

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
IDENTIFIER="<primary function or import from test source>"

# Scoped search first (faster):
git -C "$PROJECT_ROOT" log -S"$IDENTIFIER" --oneline --diff-filter=M -- src/ lib/ app/ 2>/dev/null | head -10

# Fallback if empty:
git -C "$PROJECT_ROOT" log -S"$IDENTIFIER" --oneline -10 2>/dev/null
```

### State Update: Replace Stub with Real Verdict

```bash
# Phase 21 clears stub state and saves real verdict
# Source: Phase 20 state schema + Pattern 6 above

# Clear stub real_bug on first Phase 21 run:
# (detected via: categorization_verdicts.length == 0 AND results_by_category.real_bug.length > 0)

node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests save-state \
  --state-json '{
    "schema_version": 1,
    "...existing fields...",
    "results_by_category": {"valid_skip":[],"adapt":[],"isolate":[],"real_bug":[],"fixture":[]},
    "categorization_verdicts": [],
    "dispatched_tasks": [],
    "deferred_tests": [],
    "deferred_report": {"real_bug":[], "low_context":[]}
  }'
```

### Task Dispatch (inline Task spawn from fix-tests)

```
# Source: quick.md command + quick workflow pattern (Step 5 of GSD quick.md)
# In workflow instruction to Claude:

For each group chunk (category, error_type, directory_prefix, test_files[0..19]):

  Task(
    prompt="
First, read ~/.claude/agents/qgsd-planner.md for your role.

<planning_context>
Mode: quick
Description: Fix {count} {category} test failures in {directory_prefix} — {error_type}

Test files requiring fixes:
{test_files joined by newline with reason}
{if adapt: "Git context (recent commits touching code under test): {commits}"}

<files_to_read>
- .planning/STATE.md
- ./CLAUDE.md (if exists)
</files_to_read>
</planning_context>
",
    subagent_type="qgsd-planner",
    description="Fix {category}/{error_type} failures: {directory_prefix} ({chunk_num}/{total_chunks})"
  )

  # After Task returns: record dispatched_task in state and save-state
  node gsd-tools.cjs maintain-tests save-state --state-json '<state with dispatched_tasks appended>'
```

### run-batch Output Schema (Phase 20-confirmed, for categorization input)

```json
{
  "batch_id": 5,
  "runner": "jest",
  "executed_count": 100,
  "passed_count": 95,
  "failed_count": 3,
  "skipped_count": 0,
  "flaky_count": 2,
  "timeout_count": 0,
  "batch_timed_out": false,
  "results": [
    {
      "file": "src/auth/user.test.js",
      "runner": "jest",
      "status": "failed",
      "duration_ms": 1234,
      "error_summary": "AssertionError: expected 'v2' to equal 'v1'\n  at Object.<anonymous> (src/auth/user.test.js:45:5)",
      "flaky": false,
      "flaky_pass_count": 0
    }
  ]
}
```

Key constraint: `error_summary` is truncated at 500 chars (gsd-tools.cjs `truncateErrorSummary`). The first stack frame is usually within the first 500 chars. Source file paths appear on lines after "at " or "File \"".

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 20 stub: all failures → real_bug | Phase 21: 5-category AI classification | Phase 21 (this phase) | Failures get correct category; adapt/fixture/isolate are auto-fixed; real bugs deferred |
| No context assembly | Context assembly: test source + stack files + context_score | Phase 21 | Classification quality scales with available context; low-context deferred rather than misclassified |
| No git enrichment | git pickaxe for adapt failures | Phase 21 | Fixer gets commit history context; reduces hunt time |
| No dispatch | Grouped /qgsd:quick task dispatch | Phase 21 | Autonomous fix loop; user only reviews real_bug |

**Deprecated:**
- Phase 20 stub Step 6d comment "Phase 20 placeholder — Phase 21 replaces this" — this entire block is replaced by Phase 21's categorization engine.

---

## Open Questions

1. **Should categorization happen per-batch or accumulate and categorize at end of full iteration?**
   - What we know: Success criteria say "each confirmed failure is classified" and dispatched as grouped tasks. The current stub categorizes per-batch (Step 6d).
   - What's unclear: Whether dispatching tasks mid-loop (while more batches are running) could cause the fixer Tasks to conflict with later batch runs.
   - Recommendation: Categorize per-batch but defer dispatch until end-of-iteration (when all batches in one pass are complete). This prevents task dispatch collision with concurrent batch execution and allows better grouping across the full iteration's failures. Add a `pending_dispatch` accumulator to state; dispatch at iteration boundary.

2. **How to handle the Phase 20 stub state on a project that already ran Phase 20?**
   - What we know: Phase 20 stub fills `results_by_category.real_bug` with all failures. Phase 21 must detect and clear this stub state.
   - What's unclear: Whether Phase 21 should always clear and re-run, or only clear on explicit user request.
   - Recommendation: Detect stub state (categorization_verdicts empty, real_bug non-empty) at workflow start and clear automatically — Phase 20 stub data has no classification value. Print a notice: "Clearing Phase 20 stub classification — re-classifying all failures."

3. **Can the fix-tests workflow dispatch /qgsd:quick tasks via Task() without violating INTG-03?**
   - What we know: INTG-03 says "fix-tests is NOT listed in quorum_commands." INTG-03 is about quorum enforcement, not about what fix-tests can spawn. /qgsd:quick tasks don't use quorum unless explicitly triggered by the quick workflow's quorum step.
   - What's unclear: Whether spawning qgsd-planner from inside fix-tests constitutes a "quorum bypass."
   - Recommendation: No violation. fix-tests is execution-only (doesn't call quorum workers). Spawning qgsd-planner for a quick task is the same as a user typing /qgsd:quick — the planner then runs the fix without quorum. R2.1 says fix-tests shouldn't REQUIRE quorum, not that it can't spawn planners. Verify during Phase 22 integration test.

4. **What is the right batch size for categorization within a batch?**
   - What we know: A batch contains up to 100 test files (configurable). Only confirmed failures (status='failed') need categorization.
   - What's unclear: Whether categorizing 100 failures at once in one Claude reasoning step is practical vs. chunking into groups of 10-20.
   - Recommendation: Categorize in groups of 20 failures per reasoning step to avoid context overflow. Present 20 failures with their contexts, produce 20 verdicts as a JSON array, then proceed to next group of 20. This is an implementation detail for the plan.

---

## Sources

### Primary (HIGH confidence)
- Live inspection of `get-shit-done/workflows/fix-tests.md` (installed) — Phase 20 workflow, Steps 6c/6d confirmed as stub placeholder for Phase 21
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 5887–5894 — `truncateErrorSummary` confirmed 500-char truncation limit
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 6143–6154 — `batchOutput` schema confirmed (batch_id, runner, results array with file/status/error_summary/flaky fields)
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 6100–6126 — 3-run flakiness pre-check confirmed; `flaky: true` status marks pre-checked tests
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 5560–5597 — save-state accepts arbitrary JSON object (schema_version agnostic); new fields can be added without breaking changes
- Live inspection of `commands/qgsd/quick.md` + `get-shit-done/workflows/quick.md` — Task spawn pattern for qgsd-planner confirmed; description argument is free-form text
- `.planning/REQUIREMENTS.md` CATG-01, CATG-02, CATG-03 — requirement text directly transcribed
- `.planning/ROADMAP.md` Phase 21 success criteria — context_score < 2 gating confirmed; "full source of failing test and top-2 stack trace source files" confirmed; "max 20 tests per task" confirmed
- `.planning/STATE.md` decisions — Phase 18 spawnSync decision (not execSync) for CLI invocations applies to pickaxe; Phase 20 stub categorization design confirmed

### Secondary (MEDIUM confidence)
- `.planning/phases/20-workflow-orchestrator/20-RESEARCH.md` — Pattern 6 (placeholder categorization) design; run-batch output schema reference; state field definitions
- git man page knowledge (HIGH for `git log -S` semantics — well-established git feature unchanged for years; flag meaning stable)

### Tertiary (LOW confidence)
- None — all critical findings verified from live source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — verified from gsd-tools.cjs; all tools are built-in or already present
- Architecture (workflow modification only): HIGH — Phase 20 fix-tests.md confirmed as the single file to modify; pattern established
- Context assembly (context_score, stack trace parsing): HIGH — run-batch schema confirmed; truncation limit confirmed; error_summary format confirmed from live runner output patterns
- Git pickaxe (CATG-02): HIGH — `git log -S` is a stable git built-in; spawnSync pattern confirmed from Phase 18
- Task dispatch via Task() (CATG-03): MEDIUM — dispatch mechanism matches quick.md pattern but has not been done from within fix-tests before; Open Question 3 applies
- Categorization prompting (inline Claude reasoning): MEDIUM — the approach (Claude classifying inline) is architecturally sound but the exact prompt structure is implementation detail for the plan

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (all sources are internal; no external dependency drift risk)
