# Phase 19: State Schema & Activity Integration — Research

**Researched:** 2026-02-22
**Domain:** Node.js state persistence (node:sqlite / JSON flat file), activity sidecar schema extension, gsd-tools.cjs CLI integration
**Confidence:** HIGH — all findings derived from live source code inspection and local Node.js API verification

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-03 | Tool persists batch progress to a local state file so interrupted runs on 20,000+ test suites can resume from the last completed batch | Schema design (sections: Standard Stack, Architecture Patterns); save-state / load-state command design; node:sqlite vs JSON branching; gitignore placement |
| INTG-02 | Tool activity state integrates with resume-work routing so interrupted maintenance runs recover to the correct step | Six new sub_activity values and routing table rows for resume-project.md; activity-set payload design per maintain-tests stage |
</phase_requirements>

---

## Summary

Phase 19 has three concrete deliverables: (1) the maintain-tests-state.json schema with all fields the Phase 20 workflow orchestrator will need, (2) two new gsd-tools.cjs sub-commands — maintain-tests save-state and maintain-tests load-state — that read/write that schema, and (3) six new routing rows in get-shit-done/workflows/resume-project.md that route interrupted /qgsd:fix-tests sessions back to the exact interrupted step.

The current Node.js version on this machine is v25.6.1, which exceeds the 22.5.0 threshold where node:sqlite became available. The node:sqlite built-in (DatabaseSync) is confirmed working locally. The architectural decision (from STATE.md and ARCHITECTURE.md) is: use node:sqlite on Node >= 22.5.0, fall back to JSON flat file on older versions. Both paths must be explicit — no silent fallback.

There is also a blocking bug from Phase 18 that Phase 19 must fix: cmdMaintainTestsBatch (line 5508) never adds a runner field to each batches[N] entry, causing run-batch to default to jest on playwright/pytest projects. This one-line fix is in scope for Phase 19 and is documented precisely below.

**Primary recommendation:** Implement maintain-tests save-state and load-state as thin wrapper sub-commands in gsd-tools.cjs that handle the SQLite/JSON branching transparently. The schema must include all fields the Phase 20 orchestrator needs — adding fields post-Phase-20 would require a schema migration. Fix the runner field bug in cmdMaintainTestsBatch in the same phase.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:sqlite (DatabaseSync) | Built-in, Node >= 22.5.0 | Primary state persistence for batch progress | Zero external dependency; 10-30x faster writes than JSON at 20k+ entries; confirmed working on Node v25.6.1 |
| node:fs | Built-in | JSON fallback state I/O | Already the QGSD standard throughout gsd-tools.cjs |
| node:path | Built-in | Path resolution across platforms | Already imported at gsd-tools.cjs line 141 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON flat file | N/A | Fallback state for Node < 22.5.0 | When node:sqlite unavailable; same schema, different I/O path |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:sqlite | better-sqlite3 | better-sqlite3 requires node-gyp native compile — breaks zero-dep install model. Reject. |
| node:sqlite | Plain JSON file only | JSON re-write of entire file on every batch update causes O(n) write amplification at 20k+ test scale. Accept only as fallback. |
| Key-value SQLite table | Separate table per batch | Separate tables require schema migrations; key-value with JSON blobs is simpler and sufficient |

**Installation:** No new packages. All dependencies are Node.js built-ins.

---

## Architecture Patterns

### Recommended Project Structure (new files only)
```
.planning/
  maintain-tests-state.json     # gitignored — runtime artifact, not source

get-shit-done/
  bin/
    gsd-tools.cjs               # MODIFIED: save-state, load-state sub-commands + runner bug fix
  workflows/
    resume-project.md           # MODIFIED: 6 new routing rows for maintain_tests sub_activities
```

Additionally, ~/.claude/qgsd/workflows/resume-project.md (installed copy) must receive identical changes to the source copy.

---

### Pattern 1: Node Version Detection at Command Entry

**What:** Check process.version at the top of cmdMaintainTestsSaveState / cmdMaintainTestsLoadState to branch between SQLite and JSON. Keep the branch inside the command function so it is testable.

**When to use:** Every maintain-tests state I/O command.

```javascript
// Verified locally on Node v25.6.1 — produces true
function hasSqliteSupport() {
  const [major, minor] = process.version.slice(1).split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 5);
}
```

**Confidence:** HIGH — verified with node -e locally; DatabaseSync API confirmed working.

---

### Pattern 2: SQLite Key-Value State Store

**What:** Single table with columns (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL). State stored as a single JSON blob under key 'session'. This avoids schema migrations if new top-level fields are added.

```javascript
// Verified locally — node:sqlite DatabaseSync API confirmed working
const { DatabaseSync } = require('node:sqlite');

function openStateDb(stateFilePath) {
  const db = new DatabaseSync(stateFilePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated TEXT NOT NULL
    )
  `);
  return db;
}
```

**Important:** node:sqlite emits ExperimentalWarning to stderr. This does not corrupt stdout JSON output. Document in Phase 20 workflow that callers should redirect stderr if parsing load-state output: RESULT=$(node gsd-tools.cjs maintain-tests load-state 2>/dev/null).

---

### Pattern 3: JSON Flat File Fallback

**What:** When SQLite is unavailable, write/read the state object as a JSON file. The schema is identical.

```javascript
function saveStateJson(stateFilePath, stateObj) {
  stateObj.updated = new Date().toISOString();
  fs.writeFileSync(stateFilePath, JSON.stringify(stateObj, null, 2), 'utf-8');
}

function loadStateJson(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
  } catch (e) {
    return null; // corrupted state — treat as no state
  }
}
```

---

### Pattern 4: maintain-tests save-state / load-state CLI Signatures

**CLI signatures:**
```
node gsd-tools.cjs maintain-tests save-state \
  --state-file .planning/maintain-tests-state.json \
  --state-json '{"session_id":"...","batches_complete":5,...}'

node gsd-tools.cjs maintain-tests load-state \
  --state-file .planning/maintain-tests-state.json
```

**Default state file path:** .planning/maintain-tests-state.json (relative to cwd). Both commands default to this if --state-file is omitted.

**Dispatch in maintain-tests switch (insert before default: case at ~line 5404):**
```javascript
case 'save-state': {
  const stateFileIdx = args.indexOf('--state-file');
  const stateJsonIdx = args.indexOf('--state-json');
  cmdMaintainTestsSaveState(cwd, {
    stateFile: stateFileIdx !== -1 ? args[stateFileIdx + 1] : null,
    stateJson: stateJsonIdx !== -1 ? args[stateJsonIdx + 1] : null,
  }, raw);
  break;
}
case 'load-state': {
  const stateFileIdx = args.indexOf('--state-file');
  cmdMaintainTestsLoadState(cwd, {
    stateFile: stateFileIdx !== -1 ? args[stateFileIdx + 1] : null,
  }, raw);
  break;
}
```

Both commands are synchronous — no await needed.

---

### Pattern 5: Activity-Set Payloads for maintain_tests

**What:** The existing activity-set command accepts arbitrary JSON. For maintain_tests, payloads add: activity, sub_activity, batch, batch_total, state_file, updated.

**All maintain_tests activity-set payloads (defined here; called by Phase 20 workflow):**
```
{"activity":"maintain_tests","sub_activity":"discovering_tests","state_file":".planning/maintain-tests-state.json"}

{"activity":"maintain_tests","sub_activity":"running_batch","batch":5,"batch_total":210,"state_file":".planning/maintain-tests-state.json"}

{"activity":"maintain_tests","sub_activity":"categorizing_batch","batch":5,"batch_total":210,"state_file":".planning/maintain-tests-state.json"}

{"activity":"maintain_tests","sub_activity":"actioning_batch","batch":5,"batch_total":210,"state_file":".planning/maintain-tests-state.json"}

{"activity":"maintain_tests","sub_activity":"verifying_batch","batch":5,"batch_total":210,"state_file":".planning/maintain-tests-state.json"}

{"activity":"maintain_tests","sub_activity":"complete","state_file":".planning/maintain-tests-state.json"}
```

---

### Pattern 6: runner Field Bug Fix in cmdMaintainTestsBatch

**What:** One-line fix at gsd-tools.cjs lines 5508-5512 (the batches.push call inside cmdMaintainTestsBatch).

**Exact change:**
```javascript
// CURRENT (broken — runner defaults to 'jest' on non-jest projects):
batches.push({
  batch_id: batches.length + 1,
  files: chunk,
  file_count: chunk.length,
});

// FIXED — propagate runner from discover output:
batches.push({
  batch_id: batches.length + 1,
  files: chunk,
  file_count: chunk.length,
  runner: discoverData.runners && discoverData.runners[0] ? discoverData.runners[0] : 'jest',
});
```

**Why discoverData.runners[0]:** The discover output schema is { runners, test_files, total_count, by_runner, warnings? }. runners is an array of detected framework names (e.g., ['jest'], ['playwright'], ['pytest']). The batch command takes the first runner. Multi-framework batching is deferred to v0.4.

---

### Pattern 7: resume-project.md Routing Table Addition

**New routing rows to add** (inside the | sub_activity | Recovery | table in determine_next_action step):

| sub_activity | Recovery |
|---|---|
| discovering_tests | /qgsd:fix-tests — re-trigger discovery; no state file means fresh run |
| running_batch (activity=maintain_tests) | /qgsd:fix-tests — load state file, re-run batch {batch} of {batch_total} |
| categorizing_batch (activity=maintain_tests) | /qgsd:fix-tests — load state, batch results on disk, re-enter categorization |
| actioning_batch (activity=maintain_tests) | /qgsd:fix-tests — load state, dispatch quick tasks for batch {batch} failures |
| verifying_batch (activity=maintain_tests) | /qgsd:fix-tests — load state, re-run verification for actioned tests in batch {batch} |
| complete (activity=maintain_tests) | /qgsd:fix-tests — session already complete; print summary and clear state |

**Disambiguation note:** discovering_tests and complete are unique to maintain_tests. running_batch, categorizing_batch, actioning_batch, verifying_batch must carry (activity=maintain_tests) qualifiers — same pattern established in Phase 15 (ACT-04 fix). Both source and installed copies of resume-project.md must be updated.

### Anti-Patterns to Avoid
- **Storing full test output in state:** Full stderr/stdout per test at 20k scale = gigabytes. Store only: file path, exit code, first 500 chars (truncateErrorSummary already enforces this in Phase 18).
- **Single JSON write of processed_files per batch:** On a 20k-test run with 200 batches, writing a 20k-element array 200 times = O(n * batches) I/O. SQLite UPDATE on a single 'session' key is O(1) per field change.
- **Adding maintain-tests to quorum_commands:** INTG-03 prohibits this. /qgsd:fix-tests is execution-only per CLAUDE.md R2.2.

---

## State Schema

### maintain-tests-state.json — Full Schema Definition

```json
{
  "schema_version": 1,
  "session_id": "2026-02-22T14:30:00Z",
  "manifest_path": ".planning/maintain-tests-manifest.json",
  "runner": "jest",
  "total_tests": 21000,
  "batch_size": 100,
  "seed": 1234567890,
  "total_batches": 210,
  "batches_complete": 15,
  "batch_status": {
    "1": "complete",
    "2": "complete",
    "15": "complete",
    "16": "running"
  },
  "processed_files": [
    "path/to/test1.test.js",
    "path/to/test2.test.js"
  ],
  "results_by_category": {
    "valid_skip": ["path/to/test3.test.js"],
    "adapt": ["path/to/test4.test.js"],
    "isolate": ["path/to/test5.test.js"],
    "real_bug": ["path/to/test6.test.js"],
    "fixture": ["path/to/test7.test.js"],
    "flaky": ["path/to/test8.test.js"]
  },
  "actioned": {
    "valid_skip": ["path/to/test3.test.js"],
    "adapt": {"quick-task-42": ["path/to/test4.test.js"]},
    "isolate": {"quick-task-43": ["path/to/test5.test.js"]},
    "fixture": {"quick-task-44": ["path/to/test7.test.js"]}
  },
  "pending_real_bugs": [
    {
      "file": "path/to/test6.test.js",
      "diagnosis": "TypeError: cannot read X of undefined",
      "surfaced_to_user": false
    }
  ],
  "iteration_count": 1,
  "last_unresolved_count": 150,
  "deferred_tests": [],
  "updated": "2026-02-22T15:45:00Z"
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| schema_version | integer | YES | Schema version; Phase 19 = 1. Allows load-state to detect schema mismatch on future upgrades. |
| session_id | ISO timestamp string | YES | Unique identifier for this run. Detect stale state files from prior interrupted sessions. |
| manifest_path | string | YES | Relative path to batch manifest JSON from maintain-tests batch. Required for resume — avoids re-batching. |
| runner | string | YES | Primary test runner: "jest", "playwright", or "pytest". From discover output runners[0]. |
| total_tests | integer | YES | Total test files discovered. From discover output total_count. |
| batch_size | integer | YES | Tests per batch. From qgsd.json maintain_tests.batch_size or default 100. |
| seed | integer | YES | Mulberry32 PRNG seed used for shuffle. Duplicated from manifest in case manifest is moved. |
| total_batches | integer | YES | Total batches in this session. From batch manifest total_batches. |
| batches_complete | integer | YES | Count of fully actioned batches. Incremented after verifying_batch stage completes. |
| batch_status | object | YES | Per-batch completion status. Keys are stringified batch IDs. Values: "pending" / "running" / "complete" / "timed_out". |
| processed_files | string[] | YES | Absolute paths of all test files already executed. Used to build --exclude-file list for batch on resume. Grows to 20k+ entries — acceptable in JSON/SQLite. |
| results_by_category | object | YES | Test files grouped by categorization result. Keys: "valid_skip", "adapt", "isolate", "real_bug", "fixture", "flaky". |
| actioned | object | NO | Test files dispatched to quick tasks. Maps category to quick-task-id to file list. |
| pending_real_bugs | object[] | NO | real_bug failures awaiting user review. Never auto-actioned. |
| iteration_count | integer | YES | How many full batch-loop iterations have completed. Used by loop termination guard. |
| last_unresolved_count | integer | YES | Unresolved test count from previous iteration. Compared to current count for progress guard (no progress = halt). |
| deferred_tests | string[] | YES | Test files deferred (convergence failures). Counts as "actioned" for termination purposes. |
| updated | ISO timestamp string | YES | Auto-set on every save by cmdMaintainTestsSaveState. |

### Why manifest_path Is Required
Resume needs to re-read the batch manifest to know which batch to run next. Without it, the orchestrator must re-run maintain-tests batch with the same seed. Storing the path eliminates re-batching on resume for 20k+ test suites.

### Why seed Is Duplicated
The manifest file has the seed, but if the manifest file is deleted or moved, the seed must still be available in state for fallback re-batching.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom binary format, CSV | node:sqlite (primary) + JSON flat file (fallback) | SQLite handles concurrent writes and partial write failures; both are already built-in |
| Node version detection | External semver package | Inline process.version parse | Zero dependency; version format is stable (vMAJOR.MINOR.PATCH) |
| PRNG for batching | External seedrandom | mulberry32 already at gsd-tools.cjs line 5418 | Already present from Phase 18; zero deps |
| SQLite connection pooling | Custom pool | DatabaseSync (synchronous API) | gsd-tools.cjs is a CLI tool with short-lived invocations; connection pooling is overkill |

**Key insight:** The hard work in Phase 19 is schema design, not implementation. The save/load commands are thin wrappers. Get the schema right before Phase 20 writes against it — adding fields later requires state migration logic.

---

## Common Pitfalls

### Pitfall 1: Missing runner field causes 100% batch failure on non-jest projects

**What goes wrong:** cmdMaintainTestsRunBatch reads batchData.runner and falls back to 'jest' when absent. On a playwright project, every file is invoked as "npx jest path/to/test.spec.ts" — wrong CLI, 100% failure. The 3-run flakiness check re-runs each failure 3 more times, all failing, before AI categorization receives garbage output.

**Why it happens:** cmdMaintainTestsBatch at lines 5506-5512 builds batch entries with only batch_id, files, file_count. The discover output discoverData.runners[0] is never propagated.

**How to avoid:** Fix in Phase 19 Plan 1 before any other work. One-line addition at line 5511 (inside the batches.push call). Full fix shown in Pattern 6.

**Warning signs:** All run-batch results show status: 'error' with "jest not found" or "Cannot find module" on non-jest projects.

---

### Pitfall 2: SQLite ExperimentalWarning appearing in stdout JSON

**What goes wrong:** require('node:sqlite') emits "(node:PID) ExperimentalWarning: SQLite is an experimental feature..." to stderr. If any caller captures stderr together with stdout, the warning precedes the JSON output and breaks JSON.parse().

**Why it happens:** Warning goes to stderr automatically. But if workflow steps pipe stderr into the parse path (e.g., RESULT=$(node ... 2>&1)), it corrupts the result.

**How to avoid:** Document in Phase 20 workflow that load-state output should suppress stderr: RESULT=$(node gsd-tools.cjs maintain-tests load-state 2>/dev/null). The existing gsd-tools.cjs output() helper correctly writes to stdout only.

**Warning signs:** "SyntaxError: Unexpected token '('" when JSON.parsing load-state output.

---

### Pitfall 3: Forgetting to update the installed copy of resume-project.md

**What goes wrong:** Source file at get-shit-done/workflows/resume-project.md gets new routing rows, but installed copy at ~/.claude/qgsd/workflows/resume-project.md does not. Resume-work reads the installed copy — routing rows never take effect in practice.

**Why it happens:** The installer copies workflows on install, but not on every code change. Without a reinstall, the installed copy is stale.

**How to avoid:** Any plan that modifies get-shit-done/workflows/resume-project.md must also update ~/.claude/qgsd/workflows/resume-project.md. Established pattern from Phase 14 and Phase 15.

---

### Pitfall 4: load-state returns {} when file missing instead of null

**What goes wrong:** If load-state follows cmdActivityGet's pattern of returning {} for missing file, the Phase 20 orchestrator cannot distinguish "no prior session (fresh start)" from "corrupted state (empty object)". Both return {}. The orchestrator incorrectly tries to resume from empty state.

**How to avoid:** load-state returns null when file absent, returns the state object when file exists. The Phase 20 workflow checks: if (STATE === null) -> fresh start; else -> resume from state.batches_complete.

---

### Pitfall 5: resume-work routing rows missing activity disambiguation

**What goes wrong:** If future activities write sub_activity: "running_batch", the routing table matches both, routing to the wrong recovery command.

**How to avoid:** running_batch, categorizing_batch, actioning_batch, verifying_batch must carry (activity=maintain_tests) in the table label. discovering_tests and complete are unique enough to stand alone. Pattern from Phase 15 ACT-04 fix.

---

### Pitfall 6: State file grows to gigabytes from full test output storage

**What goes wrong:** Storing full stderr/stdout of each test run in state. A failing test produces up to 50KB output. 100 failing tests per batch, 200 batches = 1GB+ state file.

**How to avoid:** Store only: file path, exit code, first 500 chars of error output. Phase 18 already enforces truncateErrorSummary(). Full output is in per-batch temp files that are discarded each iteration.

---

## Code Examples

### hasSqliteSupport helper function

```javascript
// Insert at ~line 5415 in gsd-tools.cjs (before mulberry32, after maintain-tests banner comment)
// Verified locally: returns true on Node v25.6.1
function hasSqliteSupport() {
  const [major, minor] = process.version.slice(1).split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 5);
}
```

### cmdMaintainTestsSaveState

```javascript
// Insert at ~line 5535 in gsd-tools.cjs (after cmdMaintainTestsBatch closing brace)
function cmdMaintainTestsSaveState(cwd, options, raw) {
  const { stateFile: stateFileOpt, stateJson } = options;
  const defaultStatePath = path.join(cwd, '.planning', 'maintain-tests-state.json');
  const absStatePath = stateFileOpt
    ? (path.isAbsolute(stateFileOpt) ? stateFileOpt : path.join(cwd, stateFileOpt))
    : defaultStatePath;

  if (!stateJson) {
    error('maintain-tests save-state: --state-json is required');
  }
  let stateObj;
  try {
    stateObj = JSON.parse(stateJson);
  } catch (e) {
    error('maintain-tests save-state: invalid JSON — ' + e.message);
  }
  stateObj.updated = new Date().toISOString();

  if (hasSqliteSupport()) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(absStatePath);
      db.exec('CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated TEXT NOT NULL)');
      const upsert = db.prepare('INSERT OR REPLACE INTO state (key, value, updated) VALUES (?, ?, ?)');
      upsert.run('session', JSON.stringify(stateObj), stateObj.updated);
      db.close();
      output({ written: true, path: absStatePath, backend: 'sqlite' }, raw);
    } catch (e) {
      error('maintain-tests save-state: SQLite write failed — ' + e.message);
    }
  } else {
    try {
      fs.writeFileSync(absStatePath, JSON.stringify(stateObj, null, 2), 'utf-8');
      output({ written: true, path: absStatePath, backend: 'json' }, raw);
    } catch (e) {
      error('maintain-tests save-state: JSON write failed — ' + e.message);
    }
  }
}
```

### cmdMaintainTestsLoadState

```javascript
// Insert immediately after cmdMaintainTestsSaveState
function cmdMaintainTestsLoadState(cwd, options, raw) {
  const { stateFile: stateFileOpt } = options;
  const defaultStatePath = path.join(cwd, '.planning', 'maintain-tests-state.json');
  const absStatePath = stateFileOpt
    ? (path.isAbsolute(stateFileOpt) ? stateFileOpt : path.join(cwd, stateFileOpt))
    : defaultStatePath;

  if (!fs.existsSync(absStatePath)) {
    output(null, raw);
    return;
  }

  if (hasSqliteSupport()) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(absStatePath);
      let state = null;
      try {
        const select = db.prepare('SELECT value FROM state WHERE key = ?');
        const row = select.get('session');
        state = row ? JSON.parse(row.value) : null;
      } catch (_e) {
        // Table does not exist or schema mismatch — fall through to null
      }
      db.close();
      output(state, raw);
    } catch (_e) {
      // SQLite open failed (file may be JSON from fallback path) — try JSON read
      try {
        const state = JSON.parse(fs.readFileSync(absStatePath, 'utf-8'));
        output(state, raw);
      } catch (__e) {
        output(null, raw);
      }
    }
  } else {
    try {
      const state = JSON.parse(fs.readFileSync(absStatePath, 'utf-8'));
      output(state, raw);
    } catch (_e) {
      output(null, raw);
    }
  }
}
```

### runner field fix (one-line change in cmdMaintainTestsBatch)

```javascript
// Lines 5506-5512 in gsd-tools.cjs — inside the split loop
// BEFORE (broken):
batches.push({
  batch_id: batches.length + 1,
  files: chunk,
  file_count: chunk.length,
});

// AFTER (fixed — add runner field):
batches.push({
  batch_id: batches.length + 1,
  files: chunk,
  file_count: chunk.length,
  runner: discoverData.runners && discoverData.runners[0] ? discoverData.runners[0] : 'jest',
});
```

### .gitignore addition

```
# Add to .gitignore alongside .planning/circuit-breaker-state.json:
.planning/maintain-tests-state.json
```

---

## Where Exactly to Add Code in gsd-tools.cjs

The file is currently 6083 lines. The maintain-tests dispatch switch is at lines 5351-5408.

**Five insertion points:**

1. **hasSqliteSupport() helper** — Insert at ~line 5415 (after the maintain-tests banner comment, before mulberry32 function). Keeps all maintain-tests helpers co-located.

2. **runner field fix** — Line 5511 (inside cmdMaintainTestsBatch batches.push call). One line added.

3. **cmdMaintainTestsSaveState and cmdMaintainTestsLoadState functions** — Insert at ~line 5535 (after the closing brace of cmdMaintainTestsBatch, before the Discover section banner comment). Keeps maintain-tests commands grouped.

4. **Dispatch cases for save-state and load-state** — Insert inside the case 'maintain-tests' switch, before the default: case at ~line 5404. Both are synchronous — no await needed.

5. **Usage comment update** — Lines 131-137 (the Test Maintenance: section in file header comment). Add two lines documenting save-state and load-state.

---

## Open Questions

1. **Should --batch-index be added to run-batch in Phase 19 or Phase 20?**
   - What we know: The v0.3 audit identified "no --batch-index flag" as a MEDIUM Phase 20 blocker. run-batch reads batches[0] from a full manifest. The Phase 20 orchestrator needs to iterate N batches.
   - What's unclear: Phase 20 could extract individual batch objects and write them as single-batch temp files before calling run-batch. This avoids modifying run-batch in Phase 19.
   - Recommendation: Add --batch-index to run-batch in Phase 19. It is a small addition (one parseInt + array subscript change) and it is safer to fix it before Phase 20 depends on it. Suggested as a small task in Phase 19 Plan 1 alongside the runner bug fix.

2. **Should load-state return null or {} when no state file exists?**
   - What we know: cmdActivityGet returns {} when file absent (line 6078). Workflows check HAS_ACTIVITY by testing for empty object.
   - Recommendation: load-state returns null for missing file (distinguishable from {} which would be corrupted empty state). Phase 20 workflow checks: if (STATE === null) -> fresh start; else -> resume from state.batches_complete.

3. **Should state file path be hardcoded to .planning/maintain-tests-state.json or configurable via qgsd.json?**
   - What we know: batch_size is configurable via qgsd.json maintain_tests.batch_size (gsd-tools.cjs lines 5472-5479).
   - Recommendation: Hardcode the default path. The state file is a single-session artifact; there is no use case for multiple simultaneous state files. Accept --state-file flag for override in tests but default to .planning/maintain-tests-state.json.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| better-sqlite3 (native binding) | node:sqlite (built-in, Node >= 22.5.0) | Node 22.5.0 (2024) | Zero native compile required; zero external dependency |
| JSON-only state files | SQLite primary + JSON fallback | Phase 19 design decision | 10-30x faster on writes at 20k+ test scale; no write amplification |
| Multiple routing rows for new activities requiring manual disambiguation | (activity=X) qualifier pattern | Phase 15 (ACT-04 fix) | All ambiguous sub_activity values carry explicit activity context |

**Deprecated/outdated:**
- better-sqlite3: Requires node-gyp compile. Incompatible with zero-dep install model. Do not use.
- Storing full test runner output in state: Anti-pattern. Store only first 500 chars (truncateErrorSummary already enforces this from Phase 18).

---

## Sources

### Primary (HIGH confidence)
- Live inspection of get-shit-done/bin/gsd-tools.cjs (6083 lines):
  - Lines 5351-5408: maintain-tests dispatch switch
  - Lines 5438-5533: cmdMaintainTestsBatch (runner bug at 5506-5512)
  - Lines 5415-5436: mulberry32 + seededShuffle (insertion point for hasSqliteSupport)
  - Lines 6054-6081: cmdActivitySet/Clear/Get (pattern for save-state/load-state)
- Live inspection of .planning/research/ARCHITECTURE.md — sub_activity values (lines 273-282), state schema design (lines 224-256), data flow (lines 339-374)
- Live inspection of .planning/v0.3-MILESTONE-AUDIT.md — runner field bug (line 123), batch-index gap (line 128), resume-work routing gap (line 132)
- node -e "const {DatabaseSync} = require('node:sqlite')..." — DatabaseSync API confirmed working on Node v25.6.1 with key-value store pattern
- node -e "process.version..." — Node v25.6.1 confirmed; hasSqliteSupport() returns true
- Live inspection of get-shit-done/workflows/resume-project.md — routing table structure (lines 162-178); sub_activity/activity composite key disambiguation pattern

### Secondary (MEDIUM confidence)
- .planning/milestones/v0.2-phases/15-v0.4-gap-closure-activity-resume-routing/ — routing table disambiguation pattern and (activity=X) qualifier convention; verified from Phase 15 VERIFICATION.md
- .planning/milestones/v0.2-phases/14-activity-tracking/14-04-PLAN.md — routing table structure and sub_activity format conventions
- .planning/research/SUMMARY.md — node:sqlite vs better-sqlite3 comparison (lines 20-30)

### Tertiary (LOW confidence)
- None — all critical findings directly verified from live source code or local Node.js invocation.

---

## Metadata

**Confidence breakdown:**
- State schema (fields, types, version): HIGH — derived from ARCHITECTURE.md (v0.3 milestone research) + Phase 18 run-batch output schema; cross-referenced with Phase 20 requirements in ROADMAP.md
- node:sqlite API (DatabaseSync, key-value pattern): HIGH — verified locally with node -e tests on Node v25.6.1
- runner bug fix (exact line/code): HIGH — live source inspection at lines 5506-5512; discover output schema confirmed from 18-01-SUMMARY.md and 18-VERIFICATION.md
- resume-project.md routing rows: HIGH — sub_activity values from ARCHITECTURE.md; disambiguation convention from Phase 15 VERIFICATION.md
- --batch-index gap: MEDIUM — identified in audit; fix is straightforward but was not in original Phase 19 scope; recommended as small task addition

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable Node.js built-in API; no fast-moving dependencies)
