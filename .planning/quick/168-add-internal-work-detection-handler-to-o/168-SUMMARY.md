# Quick Task 168: Add Internal Work Detection Handler to Observe

**Date:** 2026-03-04
**Status:** Completed
**Requirement:** INTERNAL-OBSERVE-01

## Summary

Added internal work detection handler to `/qgsd:observe` that scans local project state for unfinished quick tasks, stale debug sessions, and active milestone phases without verification. The handler surfaces these as always-on issues without requiring external configuration.

## Implementation

### Task 1: Internal Work Detection Handler

Created `bin/observe-handler-internal.cjs` implementing `handleInternal(sourceConfig, options)` function that:

1. **Unfinished quick tasks**: Scans `.planning/quick/` for directories with `{N}-PLAN.md` but no `{N}-SUMMARY.md`
   - Issue ID: `internal-quick-{N}`
   - Severity: warning
   - Routing: `/qgsd:quick "{slug}"`

2. **Stale debug sessions**: Checks `.planning/quick/quorum-debug-latest.md` for unresolved status less than 7 days old
   - Issue ID: `internal-debug-latest`
   - Severity: info
   - Routing: `/qgsd:debug --resume`

3. **Active unverified phases**: Reads `STATE.md` Phase value and checks if `.planning/phases/{phase}/` has any `*-VERIFICATION.md` file
   - Issue ID: `internal-milestone-{phase}`
   - Severity: warning
   - Routing: `/qgsd:solve`

Handler returns standard observe schema with `source_type: 'internal'`, all issues include `_route` metadata for downstream routing. Implements fail-open error handling with explicit `fs.existsSync` guards and sanitized phase path construction.

Updated `bin/observe-handlers.cjs` to import and export `handleInternal` alongside other handlers.

### Task 2: Register Handler as Always-On

Updated `commands/qgsd/observe.md`:

1. **Step 3 (Handler Registration)**: Added `handleInternal` import and registration
   ```javascript
   const { handleInternal } = require('./bin/observe-handlers.cjs');
   registerHandler('internal', handleInternal);
   ```

2. **Step 2 (Internal Source Injection)**: Added always-on internal source injection
   - Internal source added unconditionally regardless of config file or `--source` filter
   - Critical ordering: "no sources" early-exit check moved AFTER internal source injection so internal issues surface even without external config

3. **Step 7 (Routing)**: Added internal-aware routing
   - Issues with `source_type: 'internal'` and `_route` metadata use the `_route` value as suggested action
   - New "solve" option in prompt that routes all internal issues to `/qgsd:solve`
   - Updated argument-hint to include "internal" source type

## Verification

All success criteria met:

- handleInternal scans `.planning/quick/` for PLAN-without-SUMMARY tasks
- Detects stale debug sessions (unresolved, < 7 days old)
- Detects active unverified phases from STATE.md
- Returns standard observe schema: `{ source_label, source_type, status, issues[] }`
- All issues include `_route` metadata for skill-specific routing
- observe.md injects internal source unconditionally (no config needed)
- observe.md Step 7 offers "solve" option and routes via `_route` metadata
- argument-hint includes "internal" source type

## Files Modified

- `bin/observe-handler-internal.cjs` — Created, 186 lines
- `bin/observe-handlers.cjs` — Updated, added import and export
- `commands/qgsd/observe.md` — Updated, registered handler, added injection, updated routing

## Deviations

None — plan executed exactly as written.

## Testing

```bash
node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {}); console.log(r.status, r.issues.length + ' issues');"
# Output: ok 5 issues

node -e "const h = require('./bin/observe-handlers.cjs'); console.log(Object.keys(h).filter(k => k.includes('Internal')))"
# Output: [ 'handleInternal' ]

grep -c 'handleInternal' commands/qgsd/observe.md
# Output: 2

grep -c 'solve' commands/qgsd/observe.md
# Output: 7
```

All verification criteria met.
