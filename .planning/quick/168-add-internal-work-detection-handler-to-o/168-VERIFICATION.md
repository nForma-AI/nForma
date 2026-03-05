---
phase: quick-168
verified: 2026-03-04T23:45:00Z
status: passed
score: 6/6 must-haves verified
requirements_satisfied:
  - INTERNAL-OBSERVE-01
---

# Quick Task 168: Add Internal Work Detection Handler — Verification Report

**Task Goal:** Add internal work detection handler to observe — scan for unfinished quick tasks, debug sessions, and milestones as issues

**Verified:** 2026-03-04T23:45:00Z

**Status:** PASSED

**Score:** 6/6 must-haves verified

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `/qgsd:observe` surfaces unfinished quick tasks (have PLAN.md but no SUMMARY.md) as issues | ✓ VERIFIED | Handler scans `.planning/quick/` for directories with PLAN but no SUMMARY; found 4 unfinished tasks: #124, #167, #170, #80 with correct routing metadata |
| 2 | Running `/qgsd:observe` surfaces stale debug sessions (quorum-debug-latest.md) as issues | ✓ VERIFIED | Handler checks if debug session exists AND file is <7 days old AND contains "unresolved" or "status: open"; gracefully skips when file is older or resolved |
| 3 | Running `/qgsd:observe` surfaces active milestone phases with no VERIFICATION.md as issues | ✓ VERIFIED | Handler reads STATE.md Phase value, sanitizes with `replace(/[^a-z0-9-]/g, '')`, checks `.planning/phases/{phase}` for VERIFICATION.md files |
| 4 | Internal work issues appear in observe output without any user configuration (always-on) | ✓ VERIFIED | observe.md Step 2 injects internal source unconditionally after checking `!$SOURCE_FILTER || $SOURCE_FILTER === 'internal'`, runs even with no observe-sources.md |
| 5 | Step 7 routing suggests `/qgsd:quick` for unfinished tasks, `/qgsd:debug --resume` for debug, `/qgsd:solve` for consistency gaps | ✓ VERIFIED | Each issue includes `_route` metadata; observe.md Step 7 checks `source_type: 'internal'` and `_route` to suggest skill-specific actions |
| 6 | Handler can be imported and used directly from observe-handlers.cjs | ✓ VERIFIED | `const { handleInternal } = require('./bin/observe-handlers.cjs')` returns function; handler exported at line 430 |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/observe-handler-internal.cjs` | Internal work detection handler returning standard observe schema | ✓ VERIFIED | Exists, 189 lines, exports `{ handleInternal }`, implements all three detection categories (quick tasks, debug sessions, milestone phases) with fail-open error handling |
| `bin/observe-handlers.cjs` | Re-exports handleInternal from handler module | ✓ VERIFIED | Line 416: `const { handleInternal } = require('./observe-handler-internal.cjs');` Line 430: `handleInternal` in module.exports |
| `commands/qgsd/observe.md` | Internal handler registration, always-on injection, solve routing | ✓ VERIFIED | Lines 83-89: import and registerHandler; Lines 57-75: internal source injection with critical ordering; Lines 220-245: solve routing and _route-based dispatch |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/observe-handler-internal.cjs` | `.planning/quick/*/PLAN.md and SUMMARY.md` | `fs.readdirSync` + `fs.existsSync` scan | ✓ WIRED | Line 49: `fs.readdirSync(quickDir)` with isDirectory check; Lines 61-62: explicit existsSync checks for PLAN and SUMMARY paths |
| `bin/observe-handler-internal.cjs` | `.planning/quick/quorum-debug-latest.md` | `fs.existsSync` guard before read | ✓ WIRED | Line 90: explicit `fs.existsSync(debugPath)` guard; Line 99: only reads if guard passes; fail-open try/catch at lines 88-121 |
| `bin/observe-handler-internal.cjs` | `.planning/STATE.md` | read and regex extract | ✓ WIRED | Line 127: reads STATE.md; Line 130: regex extracts Phase value; Line 137: sanitizes with `replace(/[^a-z0-9-]/g, '')` |
| `commands/qgsd/observe.md` → `bin/observe-handlers.cjs` | Handler import and registry | Line 83: import statement | ✓ WIRED | Line 83 imports handleInternal; Line 89 registers with `registerHandler('internal', handleInternal)` |
| Internal source injection | Early-exit check ordering | Critical ordering: inject BEFORE check | ✓ WIRED | Lines 57-75: internal source injected at lines 61-65; empty check occurs at line 68 AFTER injection; comment at line 67 documents critical ordering |
| Step 7 routing | _route metadata dispatch | Severity-based default routing | ✓ WIRED | Lines 225-230: checks `source_type: 'internal'` and `_route` metadata; Line 228: uses `_route` value if present; Lines 241-245: "solve" option invokes `/qgsd:solve` |

---

## Handler Schema Verification

All issues returned by handleInternal include the required fields in the standard observe schema:

```
✓ source_label: string
✓ source_type: 'internal'
✓ status: 'ok' | 'error'
✓ issues: Array of:
  - id: string (internal-quick-N, internal-debug-latest, internal-milestone-*)
  - title: string
  - severity: 'warning' | 'info'
  - url: string (empty for internal issues)
  - age: string (e.g., "5m", "2h", "3d")
  - created_at: ISO timestamp
  - meta: string
  - source_type: 'internal'
  - issue_type: 'issue'
  - _route: string (e.g., "/qgsd:quick \"slug\"", "/qgsd:debug --resume", "/qgsd:solve")
```

**Sample test execution:**

```
Status: ok
Issues count: 4
Schema keys: [ 'issues', 'source_label', 'source_type', 'status' ]
```

Found 4 unfinished quick tasks (Categories 1), no recent unresolved debug sessions (Category 2), no active unverified phases (Category 3 — em-dash sanitizes to empty string correctly).

---

## Task Completion Details

### Task 1: Create internal work detection handler

**Status:** PASSED

- `bin/observe-handler-internal.cjs` exists with 189 lines
- Implements three detection categories:
  1. **Unfinished quick tasks** (lines 45-85): Scans `.planning/quick/` for `{N}-{slug}/` directories, checks for PLAN-without-SUMMARY pattern, emits issues with `/qgsd:quick` routing
  2. **Stale debug sessions** (lines 88-121): Checks if debug session exists, <7 days old, contains "unresolved"/"status: open", emits issues with `/qgsd:debug --resume` routing
  3. **Active milestone phases** (lines 124-170): Reads STATE.md Phase value, sanitizes with regex, checks for VERIFICATION.md in phase directory, emits issues with `/qgsd:solve` routing
- All three categories wrapped in fail-open try/catch (lines 82-170)
- Explicit `fs.existsSync` guard before debug session file read (line 90)
- Phase sanitization prevents path traversal: `phase.replace(/[^a-z0-9-]/g, '')` (line 137)
- Returns standard observe schema with status "ok" or "error"
- Exported: `module.exports = { handleInternal };` (line 189)

**Verification command result:**
```
node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs');
const r = handleInternal({ label: 'test' }, {});
console.log('Status:', r.status, 'Issues:', r.issues.length);"
→ Status: ok Issues: 4
```

### Task 2: Register internal handler and add solve routing

**Status:** PASSED

#### Step 3 — Register handler

observe.md line 83: `const { handleGitHub, handleSentry, handleSentryFeedback, handleBash, handleInternal } = require('./bin/observe-handlers.cjs');`

observe.md line 89: `registerHandler('internal', handleInternal);`

#### Step 2 — Always-on injection

observe.md lines 57-75:
```
**Always-on internal source:** Regardless of config or filters, inject an internal work detection source:

const internalSource = { type: 'internal', label: 'Internal Work', issue_type: 'issue' };
if (!$SOURCE_FILTER || $SOURCE_FILTER === 'internal') {
  config.sources.push(internalSource);
}

// Critical: check for empty sources AFTER internal injection
if (config.sources.length === 0) {
  // Display "no sources" message only if sources is empty AFTER internal source injection
  ...
}
```

**Critical ordering verified:** Internal source injection at lines 61-65, then empty check at line 68. This ensures internal detection runs even with no observe-sources.md config file.

#### Step 7 — Solve routing and internal-aware dispatch

observe.md lines 225-245:
- Lines 225-230: "If the issue has `source_type: 'internal'` and `_route` metadata: use the `_route` value as the suggested action"
- Lines 242-245: "If user enters 'solve': Collect all issues with `source_type: 'internal'`, Display `Routing all internal issues to /qgsd:solve...`, Invoke `/qgsd:solve`"

#### Argument hint update

observe.md line 4: `argument-hint: "[--source github|sentry|sentry-feedback|bash|internal] [--since 24h|7d] [--limit N]"`

Includes "internal" in source list.

---

## Anti-Patterns Scan

| File | Pattern | Status |
|------|---------|--------|
| `bin/observe-handler-internal.cjs` | TODO/FIXME/placeholder | ✓ CLEAN |
| `bin/observe-handler-internal.cjs` | Empty implementations (return null/\{\}/\[\]) | ✓ CLEAN |
| `bin/observe-handler-internal.cjs` | console.log-only implementations | ✓ CLEAN (uses console.warn for fail-open logging only) |
| `bin/observe-handlers.cjs` | Stub exports of handleInternal | ✓ CLEAN (properly exported at line 430) |
| `commands/qgsd/observe.md` | Incomplete routing logic | ✓ CLEAN (both _route-based and "solve" routing documented) |

No blockers detected.

---

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| INTERNAL-OBSERVE-01 | ✓ SATISFIED | Handler scans three categories (quick tasks, debug sessions, milestone phases); observe.md registers as always-on; Step 7 provides skill-specific routing via _route metadata and "solve" option |

---

## Summary

The internal work detection handler for `/qgsd:observe` has been fully implemented and verified:

1. **Handler** (`bin/observe-handler-internal.cjs`): Scans `.planning/quick/` for unfinished tasks, checks for stale debug sessions, detects active milestone phases without verification. Returns standard observe schema. All categories include `_route` metadata for downstream routing. Fail-open on errors.

2. **Export** (`bin/observe-handlers.cjs`): Imports and re-exports `handleInternal` at line 430, making it available to observe.md.

3. **Registration** (`commands/qgsd/observe.md`):
   - Step 3: Imports and registers with `registerHandler('internal', handleInternal)`
   - Step 2: Injects internal source unconditionally (always-on, no config needed)
   - Step 7: Routes internal issues via `_route` metadata; offers "solve" command to batch-process all internal consistency issues via `/qgsd:solve`

4. **Verification**: Manual test confirms handler returns correct schema with detected issues; observe.md correctly documents critical ordering (internal injection before empty check) and skill-specific routing.

All 6 must-haves verified. Task goal achieved. Ready for deployment.

---

_Verified: 2026-03-04T23:45:00Z_
_Verifier: Claude (qgsd-verifier)_
