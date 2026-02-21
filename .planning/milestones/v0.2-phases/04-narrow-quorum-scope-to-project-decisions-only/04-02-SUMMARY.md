---
phase: 04-narrow-quorum-scope-to-project-decisions-only
plan: 02
subsystem: hooks
tags: [prompt-hook, quorum, decision-marker, injection, behavioral-backstop]

# Dependency graph
requires:
  - phase: 04-narrow-quorum-scope-to-project-decisions-only
    provides: GUARD 5 in qgsd-stop.js with DECISION_MARKER constant '<!-- GSD_DECISION -->' and hasDecisionMarker() detection

provides:
  - DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK step 5: instructs Claude to include <!-- GSD_DECISION --> in FINAL output only
  - Behavioral input to GUARD 5 hasDecisionMarker() for non-artifact decision turns (e.g. /gsd:verify-work)
  - SCOPE-04 requirement satisfied

affects:
  - qgsd-stop.js GUARD 5 (now has behavioral input via injected instruction)
  - any future plans that modify DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK or quorum_instructions config

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Decision marker injection: DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK instructs Claude to include <!-- GSD_DECISION --> in FINAL output only — not intermediate messages"
    - "Token consistency: exact same string as DECISION_MARKER constant in qgsd-stop.js ensures Stop hook and Prompt hook are coupled by value"
    - "Config-override gap: user-customized quorum_instructions in qgsd.json bypass the fallback; documented as acceptable (fail-open philosophy)"

key-files:
  created: []
  modified:
    - hooks/qgsd-prompt.js

key-decisions:
  - "DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK only: users with custom quorum_instructions in qgsd.json will not receive step 5 automatically — this is acceptable and matches the existing fail-open philosophy documented in the hook"
  - "Injection mechanism unchanged: hookSpecificOutput.additionalContext path, cmdPattern logic, and config-loading behavior are all unmodified"

patterns-established:
  - "Marker-in-FINAL pattern: step 5 explicitly scopes the token to FINAL delivery turn, preventing false positives from intermediate status messages"

requirements-completed: [SCOPE-04]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 04 Plan 02: Decision Marker Injection into UserPromptSubmit Hook Summary

**`DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` updated with step 5 instructing Claude to include `<!-- GSD_DECISION -->` in FINAL output only, activating the behavioral backstop signal for GUARD 5's `hasDecisionMarker()` detection path**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T23:08:31Z
- **Completed:** 2026-02-20T23:09:15Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added step 5 to `DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK` with the exact token `<!-- GSD_DECISION -->`
- Token matches `DECISION_MARKER` constant in `qgsd-stop.js` character-for-character, coupling detection and injection by value
- Instruction explicitly scopes the token to FINAL output (not intermediate messages or status updates), preventing false positives
- All tests pass: config-loader (10/10) and qgsd-stop (19/19)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add decision marker instruction to UserPromptSubmit injection** - `07e78df` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified

- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` - Added step 5 to DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK with `<!-- GSD_DECISION -->` token and FINAL-output-only clarification

## Decisions Made

- DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK only: users with a custom `quorum_instructions` in their `qgsd.json` bypass the fallback and will not automatically receive step 5. This is acceptable — matches the fail-open philosophy. Documentation note in the plan acknowledges this.
- Injection mechanism (hookSpecificOutput.additionalContext, cmdPattern logic, config-loading path) is completely unchanged per plan directive.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — single targeted string addition; module loads cleanly; both test suites pass without modification.

## User Setup Required

None — no external service configuration required. Hook changes are self-contained in `hooks/qgsd-prompt.js`.

## Next Phase Readiness

- Phase 04 Plan 02 complete: behavioral backstop signal now has a source
- GUARD 5 two-signal detection (artifact commit + decision marker) is fully wired end-to-end:
  - Stop hook detects `<!-- GSD_DECISION -->` via `hasDecisionMarker()` (Plan 01)
  - Prompt hook instructs Claude to include `<!-- GSD_DECISION -->` via step 5 injection (Plan 02)
- Phase 04 is now fully complete (2/2 plans)
- Requirements SCOPE-01 through SCOPE-07 all satisfied

## Self-Check: PASSED

- hooks/qgsd-prompt.js: FOUND
- GSD_DECISION token count in qgsd-prompt.js: 1 (correct — exactly once)
- commit 07e78df (feat): FOUND
- node --test hooks/config-loader.test.js: 10/10 passing
- node --test hooks/qgsd-stop.test.js: 19/19 passing

---
*Phase: 04-narrow-quorum-scope-to-project-decisions-only*
*Completed: 2026-02-20*
