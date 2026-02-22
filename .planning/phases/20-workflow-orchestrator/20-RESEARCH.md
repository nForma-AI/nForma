# Phase 20: Workflow Orchestrator — Research

**Researched:** 2026-02-22
**Domain:** Claude command authoring, batch loop orchestration, circuit breaker lifecycle management, loop termination logic
**Confidence:** HIGH — all findings derived from live source code inspection of installed commands, gsd-tools.cjs, install.js, and Phase 19 summaries

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ITER-01 | Tool iterates through remaining uncategorized/unactioned tests continuously until terminal state is reached | Batch loop design (Architecture Patterns section); state-driven iteration using load-state/save-state; activity-set payload design per loop step |
| ITER-02 | Loop terminates when: all tests classified, no progress in last 5 batches, or configurable iteration cap reached | Three-condition termination guard logic (Architecture Patterns section); iteration_count and last_unresolved_count fields already in state schema |
| INTG-01 | Tool disables QGSD circuit breaker at run start and re-enables on completion or interruption | `npx qgsd --disable-breaker` / `--enable-breaker` commands verified in install.js (lines 2081–2122); circuit-breaker-state.json schema documented |
| INTG-03 | `/qgsd:fix-tests` is implemented as execution-only — not added to `quorum_commands` | quorum_commands list in qgsd.json verified; fix-tests must NOT appear there; R2.1 compliance verified |
</phase_requirements>

---

## Summary

Phase 20 delivers two artifacts: (1) the `/qgsd:fix-tests` Claude command file at `commands/qgsd/fix-tests.md`, and (2) a workflow document at `get-shit-done/workflows/fix-tests.md` that the command invokes. The command file is a thin entry point (same pattern as `quick.md`, `resume-work.md`); all substantive orchestration logic lives in the workflow file to keep the command stub small and the logic versioned separately.

The mechanical primitives are all in place from Phases 18 and 19: `maintain-tests discover`, `maintain-tests batch`, `maintain-tests run-batch --batch-index N`, `maintain-tests save-state`, `maintain-tests load-state`, and `activity-set/clear`. Phase 20's job is to wire these into a sequential loop with correct termination, circuit breaker lifecycle, progress banners, and stub categorization (placeholder that marks all confirmed failures as "real_bug" for now — Phase 21 replaces with real AI classification). The loop must terminate on three conditions: all tests classified, no progress in 5 consecutive batches, or iteration cap reached (default 5).

The circuit breaker is managed via `npx qgsd --disable-breaker` at loop start and `npx qgsd --enable-breaker` at loop exit (including error/interrupt exit). The disable-breaker command writes `{disabled: true, active: false}` to `.claude/circuit-breaker-state.json`; enable-breaker writes `{disabled: false, active: false}` on the same file. Both commands are confirmed working in install.js (lines 2081–2122). INTG-03 (R2.1 compliance) requires that `fix-tests` must NOT appear in `quorum_commands` in `~/.claude/qgsd.json` or any other config file.

**Primary recommendation:** Implement fix-tests as a command stub that delegates to a workflow file. The workflow file contains the full loop logic: check for existing state (resume or fresh start), disable breaker, discover, batch, iterate batches, update activity state at each step, print progress banner, evaluate termination conditions, stub-categorize, re-enable breaker, and clear activity state on exit.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gsd-tools.cjs | Local | Mechanical CLI layer (discover, batch, run-batch, save-state, load-state, activity-set/clear) | Already implemented Phases 18–19; zero new deps needed |
| node (Bash in workflow) | v25.6.1 (local) | Shell invocation of gsd-tools subcommands | Workflow orchestration pattern used by all QGSD workflows |
| npx qgsd | Installed | Circuit breaker lifecycle commands (--disable-breaker, --enable-breaker) | Confirmed working in install.js; no alternative |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| maintain-tests save-state / load-state | Phase 19 | Persist and resume loop state | Every batch completion and every loop iteration boundary |
| activity-set / activity-clear | Phase 14 | Route /qgsd:resume-work to correct step | Set at each workflow stage; clear at normal completion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Workflow file pattern (command + workflow) | Inline all logic in command file | Inline command files become 300+ lines and are harder to patch with the existing installer (copyWithPathReplacement). Workflow file separation is the QGSD standard — quick.md delegates to quick.md in workflows/ |
| npx qgsd --disable-breaker | Direct JSON write to circuit-breaker-state.json | Direct JSON write bypasses the install.js code path; breaks if the file format changes. Use the official flag. |
| Placeholder categorization ("stub") | Full AI categorization in Phase 20 | CATG-01/02/03 are deferred to Phase 21. Phase 20 stub marks all confirmed failures as "real_bug" so the loop terminates and the state is valid for Phase 21 to replace. |

**Installation:** No new packages. All dependencies are already present.

---

## Architecture Patterns

### Recommended New Files

```
commands/qgsd/
  fix-tests.md                     # NEW: command stub (thin entry point, ~30 lines)

get-shit-done/workflows/
  fix-tests.md                     # NEW: workflow logic (~200 lines)
```

The installer's `copyWithPathReplacement` picks up `fix-tests.md` from `commands/qgsd/` automatically — no installer change needed. The workflow file is installed alongside other workflows.

**Both source and installed copies must be created** (same pattern as all other commands/workflows):
- Source: `commands/qgsd/fix-tests.md` and `get-shit-done/workflows/fix-tests.md`
- Installed: `~/.claude/commands/qgsd/fix-tests.md` and `~/.claude/qgsd/workflows/fix-tests.md`

The installer syncs these on reinstall. For Phase 20 (mid-development), write both copies directly — do not rely on the installer to propagate them mid-session.

---

### Pattern 1: Command Stub (fix-tests.md command file)

**What:** Thin Claude command file that sets the objective and delegates to the workflow.
**When to use:** Every new QGSD command follows this pattern.

```markdown
---
name: qgsd:fix-tests
description: Autonomously discover, batch, run, categorize, and fix test failures across large suites
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
---

<objective>
Discover all test failures in the project, batch them, run them with flakiness detection,
categorize each confirmed failure, dispatch fix tasks, and iterate until terminal state.

This command is execution-only — it does NOT invoke quorum workers (R2.1 / INTG-03).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md
</execution_context>

<process>
Follow the fix-tests workflow from @/Users/jonathanborduas/.claude/qgsd/workflows/fix-tests.md end-to-end.
</process>
```

Note: The `@` path references are rewritten by `copyWithPathReplacement` during install. The source file uses `~/.claude/qgsd/...`; the installer rewrites them to absolute paths in the installed copy.

---

### Pattern 2: Workflow Loop Structure

**What:** The fix-tests workflow implements a discover-batch-execute-categorize-fix-iterate loop.
**When to use:** Core orchestration logic.

```
Step 1: Check for existing state (load-state)
  → null: fresh start
  → existing: resume from state.batches_complete

Step 2: Disable circuit breaker
  npx qgsd --disable-breaker

Step 3: Discover tests (if fresh start OR no manifest_path in state)
  node gsd-tools.cjs maintain-tests discover --output-file .planning/maintain-tests-discover.json
  activity-set {activity: maintain_tests, sub_activity: discovering_tests, ...}

Step 4: Batch tests (if fresh start OR no manifest_path in state)
  node gsd-tools.cjs maintain-tests batch --input-file .planning/maintain-tests-discover.json \
    --manifest-file .planning/maintain-tests-manifest.json

Step 5: Initialize state if fresh start
  node gsd-tools.cjs maintain-tests save-state \
    --state-json '{ schema_version: 1, session_id: <timestamp>, ... }'

Step 6: Batch loop (iterate from batches_complete to total_batches)
  For each batch index B:
    a. Set activity: running_batch
    b. Execute batch:
       node gsd-tools.cjs maintain-tests run-batch \
         --batch-file .planning/maintain-tests-manifest.json \
         --batch-index B \
         --output-file .planning/maintain-tests-batch-result.json
    c. Set activity: categorizing_batch
    d. Stub-categorize confirmed failures (mark as real_bug in state)
    e. Print progress banner
    f. Update state (save-state)
    g. Check termination conditions:
       - All tests classified? → TERMINAL
       - No progress in last 5 batches? → TERMINAL (progress guard)
       - Iteration cap reached? → TERMINAL

Step 7: Re-enable circuit breaker
  npx qgsd --enable-breaker

Step 8: Clear activity state
  node gsd-tools.cjs activity-clear

Step 9: Print terminal summary
```

---

### Pattern 3: Three-Condition Loop Termination

**What:** Loop exits on the first terminal condition that fires.
**When to use:** End of each batch iteration.

State fields involved (all in maintain-tests-state.json schema from Phase 19):
- `iteration_count` — incremented after each full pass through all batches
- `last_unresolved_count` — previous iteration's unresolved count; compared to current
- `results_by_category` — counts classified tests; when all tests appear here, exit

```
ITERATION_CAP = qgsd.json maintain_tests.iteration_cap OR default 5
PROGRESS_GUARD = 5 batches with no change in unresolved count

At end of each batch:
  unresolved = total_tests - sum(all categorized tests across all categories)

  IF unresolved == 0:
    → TERMINAL: all tests classified

  consecutive_no_progress += 1 if unresolved == last_unresolved_count else 0
  last_unresolved_count = unresolved

  IF consecutive_no_progress >= 5:
    → TERMINAL: no progress in last 5 batches

  IF iteration_count >= ITERATION_CAP and B == total_batches - 1:
    → TERMINAL: iteration cap reached
```

Note: "No progress in last 5 batches" means unresolved count did NOT decrease in 5 consecutive batches. The state schema's `last_unresolved_count` field supports this — Phase 20 must also track a `consecutive_no_progress` field (either in state or as a workflow variable). Recommendation: add it to the state JSON so it survives interruption.

---

### Pattern 4: Circuit Breaker Lifecycle Management

**What:** Disable breaker before loop, re-enable on every exit path.
**When to use:** fix-tests workflow start and all exit paths.

```bash
# At workflow start (Step 2):
npx qgsd --disable-breaker

# At normal completion (Step 7):
npx qgsd --enable-breaker

# At error/interrupt handling:
# The workflow must explicitly catch errors and call --enable-breaker before surfacing the error.
# Pattern: wrap loop in try/finally analog using sequential Bash commands with exit traps
```

The disable/enable commands write to `.claude/circuit-breaker-state.json`:
- `--disable-breaker`: `{ ...existing, disabled: true, active: false }`
- `--enable-breaker`: `{ ...existing, disabled: false, active: false }`

**Verification** (from INTG-01 success criterion): Read `.claude/circuit-breaker-state.json` before the run to confirm it does not exist or `disabled: false`. After run: confirm `disabled: false`.

---

### Pattern 5: Progress Banner

**What:** After each batch completion, print a human-readable progress banner.
**When to use:** End of Step 6e in the batch loop.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► FIX-TESTS: Batch 5 / 210 complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Passed:    95  |  Failed: 3  |  Flaky: 2  |  Skipped: 0
 Total classified: 250 / 21000
 Iteration: 1 / 5
```

---

### Pattern 6: Placeholder Categorization (Phase 20 Stub)

**What:** Phase 20 must produce a working loop, but real AI categorization (CATG-01/02/03) is deferred to Phase 21. The stub categorizes all confirmed failures (status='failed' after 3-run flakiness check) as "real_bug" in the state's `results_by_category`.

**Why real_bug for stub:** The success criteria say "placeholder categorization" — marking everything as real_bug is conservative (never auto-actions), valid for state schema, and gives Phase 21 a correct state field to replace. DO NOT dispatch quick tasks in Phase 20 (those are CATG-03 actions, Phase 21).

```
In Step 6d (categorizing_batch):
  For each result with status == 'failed':
    state.results_by_category.real_bug.push(result.file)
  For each result with status == 'flaky':
    state.results_by_category.flaky.push(result.file)
  (passed, skipped: add to processed_files only — no category assignment)
```

---

### Anti-Patterns to Avoid

- **Invoking quorum workers in fix-tests:** fix-tests is execution-only (INTG-03). No calls to MCP tools (mcp__gemini-cli__, etc.) or quorum dispatch. Violates R2.1.
- **Using inline logic in the command file:** All orchestration logic belongs in the workflow file. The command stub must be under 40 lines.
- **Forgetting to re-enable the circuit breaker on error paths:** The breaker stays disabled forever if the workflow crashes before the enable step. The workflow must call `npx qgsd --enable-breaker` on every exit, including error exits.
- **Writing maintain-tests to quorum_commands:** INTG-03. Never. Not even in project-level overrides.
- **Rediscovering tests on resume:** Resume path must use `state.manifest_path` to skip re-discovery and re-batching. Re-batching with a different seed scrambles the batch order and invalidates `processed_files`.
- **Treating flaky as categorized:** Flaky tests are not "classified" for termination purposes — they are removed from the categorization queue but not counted as resolved. The progress guard compares `results_by_category` (excl. flaky) against `total_tests - flaky_count`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker toggling | Direct JSON write to circuit-breaker-state.json | `npx qgsd --disable-breaker` / `--enable-breaker` | Official command tested in install.js; format may change |
| Test discovery | Glob-based file finding | `maintain-tests discover` (already built Phase 18) | Framework CLI invocation, dedup, monorepo safety |
| Batch splitting / shuffling | Custom split logic | `maintain-tests batch` (already built Phase 18) | Seeded shuffle, manifest disk write before execution, resume support |
| Per-batch execution | Direct test runner invocation | `maintain-tests run-batch --batch-index N` (Phase 18+19) | spawn (not exec), flakiness pre-check, per-file isolation, timeout |
| State persistence | In-memory JS object | `maintain-tests save-state` / `load-state` (Phase 19) | SQLite/JSON branching, crash-safe, resume support |
| Activity tracking | Direct file write | `activity-set / activity-clear` (Phase 14) | Idempotent, correct JSON schema, routing table integration |

**Key insight:** Phase 20 is pure orchestration — the hard mechanical work is already done. The workflow file should contain ~200 lines of step sequencing, state updates, and condition checks, not new I/O primitives.

---

## Common Pitfalls

### Pitfall 1: Circuit Breaker Left Disabled After Workflow Crash

**What goes wrong:** If the fix-tests workflow crashes between Step 2 (disable) and Step 7 (enable), the circuit breaker stays disabled permanently. All subsequent iterative commits are unprotected from oscillation detection.

**Why it happens:** No finally-block equivalent in Claude command workflows — errors skip subsequent steps.

**How to avoid:** Structure the workflow so --enable-breaker is called at the earliest possible error exit point. Print the re-enable command to the user if the workflow aborts mid-run. The Phase 22 Integration Test will verify this (INTG-01 success criterion).

**Warning signs:** circuit-breaker-state.json shows `"disabled": true` in a project where fix-tests is not actively running.

---

### Pitfall 2: Duplicate Test Classification from Re-runs

**What goes wrong:** On resume, the orchestrator re-runs batches that were already completed, double-counting test results in `results_by_category`.

**Why it happens:** The loop starts from batch 0 instead of `state.batches_complete`.

**How to avoid:** Load state first. If `state !== null`, start the batch loop from `state.batches_complete` (the next un-completed batch index). `processed_files` in the state tracks which tests have already been run.

**Warning signs:** `results_by_category` sums exceed `total_tests`; duplicate file paths in category arrays.

---

### Pitfall 3: load-state stderr Corrupting JSON Parse

**What goes wrong:** `RESULT=$(node gsd-tools.cjs maintain-tests load-state 2>&1)` — the node:sqlite ExperimentalWarning on stderr contaminates the JSON parse if stderr is merged with stdout.

**Why it happens:** node:sqlite emits `(node:PID) ExperimentalWarning: SQLite is an experimental feature...` to stderr automatically on Node >= 22.5.0.

**How to avoid:** Always redirect stderr: `RESULT=$(node gsd-tools.cjs maintain-tests load-state 2>/dev/null)`. Documented in Phase 19 Research but bears repeating as Phase 20 will make this call.

**Warning signs:** `SyntaxError: Unexpected token '('` when parsing load-state output.

---

### Pitfall 4: fix-tests Appearing in quorum_commands

**What goes wrong:** fix-tests is added to `quorum_commands` in qgsd.json (or any other config), causing the Stop hook to block every response for missing quorum on an execution-only command.

**Why it happens:** Misapplying the QGSD pattern — planning commands require quorum, execution-only commands do not.

**How to avoid:** INTG-03 prohibits this explicitly. Verification step for Phase 20: `grep -r 'fix-tests' ~/.claude/qgsd.json` should return nothing.

**Warning signs:** fix-tests invocations blocked by Stop hook requiring quorum that was never dispatched.

---

### Pitfall 5: Progress Guard Counts Flaky Tests as Unresolved

**What goes wrong:** Flaky tests are excluded from the categorization queue but are not in `results_by_category`. If the progress guard computes `unresolved = total_tests - categorized`, flaky tests appear "unresolved" forever, preventing the loop from terminating.

**How to avoid:** Progress guard formula: `unresolved = total_tests - classified - flaky_count`. Where `classified = sum(results_by_category.valid_skip, .adapt, .isolate, .real_bug, .fixture)` — NOT including `.flaky` (flaky is an execution outcome, not a category).

**Warning signs:** Loop never terminates despite all non-flaky tests being classified; last_unresolved_count stuck > 0 even when all real failures are in real_bug.

---

### Pitfall 6: Source vs. Installed Copy Mismatch

**What goes wrong:** fix-tests.md is created in `~/.claude/commands/qgsd/` (installed) but not in `commands/qgsd/` (source), or vice versa. Next installer run clobbers or misses the file.

**How to avoid:** Always create BOTH files:
1. `commands/qgsd/fix-tests.md` — source copy, committed to git
2. `~/.claude/commands/qgsd/fix-tests.md` — installed copy, written directly for immediate availability

Same for the workflow file:
1. `get-shit-done/workflows/fix-tests.md` — source copy
2. `~/.claude/qgsd/workflows/fix-tests.md` — installed copy

The installed copies use absolute paths (`/Users/jonathanborduas/.claude/...`); source copies use tilde paths (`~/.claude/...`). Do NOT `cp` source to installed — rewrite path references.

---

## Code Examples

### Circuit Breaker State Verification (Bash)

```bash
# Source: live inspection of install.js lines 2092-2097 and 2114-2118
# Before run — check not already disabled
BREAKER_FILE="$(git rev-parse --show-toplevel)/.claude/circuit-breaker-state.json"
if [ -f "$BREAKER_FILE" ]; then
  cat "$BREAKER_FILE"  # Should show disabled: false or no file
fi

# Disable
npx qgsd --disable-breaker
# Writes: { "disabled": true, "active": false }

# Enable (after completion)
npx qgsd --enable-breaker
# Writes: { "disabled": false, "active": false }
```

### Load State (Bash, with stderr suppression)

```bash
# Source: Phase 19 Research, Pitfall 2 — ExperimentalWarning suppression
STATE_JSON=$(node /Users/jonathanborduas/.claude/qgsd/bin/gsd-tools.cjs maintain-tests load-state 2>/dev/null)
# If null: fresh start
# If {...}: extract batches_complete for resume point
```

### Activity Set Payloads for Each Loop Stage

```bash
# Source: Phase 19 Research Pattern 5 — activity-set payloads
# discovering_tests:
node gsd-tools.cjs activity-set '{"activity":"maintain_tests","sub_activity":"discovering_tests","state_file":".planning/maintain-tests-state.json"}'

# running_batch (B is 1-based batch number, TOTAL is total_batches):
node gsd-tools.cjs activity-set '{"activity":"maintain_tests","sub_activity":"running_batch","batch":B,"batch_total":TOTAL,"state_file":".planning/maintain-tests-state.json"}'

# categorizing_batch:
node gsd-tools.cjs activity-set '{"activity":"maintain_tests","sub_activity":"categorizing_batch","batch":B,"batch_total":TOTAL,"state_file":".planning/maintain-tests-state.json"}'

# complete:
node gsd-tools.cjs activity-set '{"activity":"maintain_tests","sub_activity":"complete","state_file":".planning/maintain-tests-state.json"}'
# Then activity-clear after printing summary
```

### run-batch with --batch-index

```bash
# Source: Phase 19 Summary, Phase 18-19 live code in gsd-tools.cjs lines 6047-6073
# B is zero-based (array subscript) — convert from 1-based batch_id as needed
node gsd-tools.cjs maintain-tests run-batch \
  --batch-file .planning/maintain-tests-manifest.json \
  --batch-index $((B - 1)) \
  --output-file .planning/maintain-tests-batch-result.json
# Writes batch output JSON to --output-file; stdout returns {written: true, ...}
```

### run-batch Output Schema (for categorization stub)

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
      "file": "path/to/test.test.js",
      "runner": "jest",
      "status": "passed|failed|skipped|flaky|timeout|error",
      "duration_ms": 1234,
      "error_summary": "...",
      "flaky": false,
      "flaky_pass_count": 0
    }
  ]
}
```

### Save State After Each Batch (key fields to update)

```bash
# Source: Phase 19 Research Schema Definition, Pattern 4
# STATE is the current state object; update fields and save
node gsd-tools.cjs maintain-tests save-state \
  --state-json '{"schema_version":1,"session_id":"...","batches_complete":5,"batch_status":{"5":"complete"},"results_by_category":{"real_bug":["test1.test.js"]},"iteration_count":1,"last_unresolved_count":150,"consecutive_no_progress":0,...}'
```

### INTG-03 Verification (quorum_commands check)

```bash
# Source: live inspection of ~/.claude/qgsd.json — quorum_commands list
grep -r 'fix-tests' ~/.claude/qgsd.json 2>/dev/null  # Should return empty
grep -r 'fix-tests' ~/.claude/qgsd.json ~/.claude/settings.json 2>/dev/null  # All clear expected
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline command logic (monolithic .md) | Command stub + separate workflow file | Phase 13+ (oscillation-resolution-mode.md, quick.md, etc.) | Commands stay small; logic is versioned separately and patched by installer |
| Hardcoded circuit breaker JSON writes | `npx qgsd --disable-breaker` / `--enable-breaker` | Phase 6/7 (circuit breaker implementation) | Format changes in install.js are automatically picked up by the flag |
| Single-pass test execution | Batch loop with iteration cap + progress guard | Phase 20 (this phase) | Handles suites where first pass doesn't fix all failures |

---

## Open Questions

1. **Should `consecutive_no_progress` be stored in state or as a workflow variable?**
   - What we know: `last_unresolved_count` is in the state schema (Phase 19). An interruption between batches that resets the progress counter would cause incorrect termination decisions on resume.
   - What's unclear: Whether the Phase 20 workflow should track this as a local counter or add it to the state JSON.
   - Recommendation: Add `consecutive_no_progress` to the state JSON alongside `last_unresolved_count`. The field is not in the Phase 19 schema — the save-state command accepts arbitrary JSON (it serializes the full state object), so this is a non-breaking schema addition under schema_version: 1.

2. **Should fix-tests take any arguments (e.g., --runner, --dir)?**
   - What we know: The success criteria say "Typing `/qgsd:fix-tests` starts the full loop" — no argument mentioned. The maintain-tests discover command accepts --runner and --dir flags.
   - What's unclear: Whether a narrowed run (e.g., `--runner pytest`) is in scope for Phase 20.
   - Recommendation: No arguments in Phase 20. The command runs discover with runner auto-detection (Phase 18 default). Arguments can be added in Phase 22 (Integration Test) if needed.

3. **How does the workflow handle `batch_timed_out: true` in run-batch output?**
   - What we know: run-batch can set `batch_timed_out: true` when the batch-level timeout fires mid-batch. Timed-out tests get status `"timeout"` in results.
   - What's unclear: Whether timeout should count as "no progress" or be treated like a failed run.
   - Recommendation: Timed-out batches do NOT advance `batches_complete`. The batch's status in state stays "running". On resume, the batch is re-run from the start (file-level idempotency is not guaranteed, but the 3-run flakiness check makes re-runs safe for pass/fail accuracy). Update `batch_status[B]` to "timed_out" in state so resume logic can identify it.

---

## Sources

### Primary (HIGH confidence)
- Live inspection of `commands/qgsd/quick.md` (installed) — command stub pattern: frontmatter, execution_context, process delegation
- Live inspection of `commands/qgsd/resume-work.md` (installed) — command stub pattern for simple workflow delegation
- Live inspection of `bin/install.js` lines 2081–2122 — `--disable-breaker` and `--enable-breaker` exact behavior and circuit-breaker-state.json format
- Live inspection of `bin/install.js` lines 1781–1784 — `quorum_commands` list confirming fix-tests is NOT there and must not be added
- Live inspection of `~/.claude/qgsd.json` — confirmed `quorum_commands` list contains only planning commands
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 5351–5426 — maintain-tests dispatch (save-state, load-state, run-batch --batch-index, discover, batch)
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 6040–6164 — run-batch output schema (`batchOutput` object)
- Live inspection of `get-shit-done/bin/gsd-tools.cjs` lines 6168–6195 — activity-set/clear/get patterns
- `.planning/phases/19-state-schema-activity-integration/19-01-SUMMARY.md` — Phase 19 deliverables confirmed: save-state, load-state, --batch-index, runner field all complete
- `.planning/phases/19-state-schema-activity-integration/19-02-SUMMARY.md` — resume-work routing rows for all maintain_tests sub-activities confirmed installed
- `.planning/phases/19-state-schema-activity-integration/19-RESEARCH.md` — State schema full field definitions; activity-set payloads for all loop stages; Pitfall 2 (SQLite ExperimentalWarning)

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` Phase 20 success criteria — defines the four measurable outcomes this phase must achieve
- `.planning/REQUIREMENTS.md` ITER-01, ITER-02, INTG-01, INTG-03 — requirement descriptions directly transcribed into `<phase_requirements>` table above

### Tertiary (LOW confidence)
- None — all critical findings directly verified from live source code inspection.

---

## Metadata

**Confidence breakdown:**
- Command file structure: HIGH — verified from quick.md and resume-work.md patterns
- Circuit breaker lifecycle (disable/enable commands): HIGH — verified from install.js lines 2081–2122
- Loop termination logic (three conditions): HIGH — requirements are precise; ITER-02 exact, state schema supports all fields
- Stub categorization pattern: HIGH — run-batch output schema confirmed; Phase 21 deferred by design
- INTG-03 compliance (not in quorum_commands): HIGH — live qgsd.json verified
- `consecutive_no_progress` state field: MEDIUM — not in Phase 19 schema; recommended addition; no blocker

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable internal APIs; no external dependencies)
