---
phase: 04-narrow-quorum-scope-to-project-decisions-only
plan: 01
subsystem: hooks
tags: [stop-hook, quorum, tdd, jsonl, transcript-analysis, turn-classification]

# Dependency graph
requires:
  - phase: 01-hook-enforcement
    provides: qgsd-stop.js guard chain (GUARD 1-4), JSONL-authoritative quorum evidence scanning
  - phase: 02-config-mcp-detection
    provides: config-loader, required_models, fail-open unavailability detection (TC11-TC13)

provides:
  - GUARD 5 in qgsd-stop.js: two-signal decision turn detection (hasArtifactCommit + hasDecisionMarker)
  - ARTIFACT_PATTERNS constant: 7 planning artifact patterns that distinguish decisions from GSD-internal ops
  - DECISION_MARKER constant: '<!-- GSD_DECISION -->' shared between detection and injection logic
  - TC14-TC19: 6 new test cases covering all new signal paths
  - TC6/TC9/TC12 updated: now include decision-turn signals, preserving invariant correctness

affects:
  - future phases using qgsd-stop.js (any hook behavior changes)
  - qgsd-prompt.js (should inject <!-- GSD_DECISION --> instruction for non-artifact decision turns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-signal decision turn detection: primary structural (artifact commit) + behavioral backstop (decision marker)"
    - "Both gsd-tools.cjs commit AND artifact pattern must appear in same Bash block to prevent false positives"
    - "hasDecisionMarker scans only the last assistant entry (reverse scan, break on first found)"
    - "GUARD ordering: 1 (loop) > 2 (subagent) > 3 (transcript) > 4 (command) > 5 (decision turn) > quorum scan"

key-files:
  created: []
  modified:
    - hooks/qgsd-stop.js
    - hooks/qgsd-stop.test.js

key-decisions:
  - "GUARD 5 position: after GUARD 4 (hasQuorumCommand) but before findQuorumEvidence — quorum command is prerequisite; decision turn is the narrowing gate"
  - "ARTIFACT_PATTERNS requires BOTH gsd-tools.cjs commit AND artifact pattern in same Bash block — prevents false positives from ls/cat/grep that mention artifact names"
  - "hasDecisionMarker scans only the last assistant entry — older text blocks are irrelevant; break on first found (from reverse)"
  - "TC6/TC9/TC12 updated (step 1a) to include artifact commit signals — they continue to assert decision:block with same core invariant: quorum-command + decision-turn + missing quorum = block"
  - "DECISION_MARKER defined as module-level constant (not inline string) for consistency between detection and injection"

patterns-established:
  - "Positive detection (artifact OR marker) vs. negative exclusion — more robust because only explicit signals trigger quorum"
  - "TDD with step 1a regression maintenance: update existing tests before adding new ones when adding a new guard that changes existing semantics"

requirements-completed: [SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-05, SCOPE-06, SCOPE-07]

# Metrics
duration: 8min
completed: 2026-02-20
---

# Phase 04 Plan 01: GUARD 5 — Decision Turn Detection Summary

**GUARD 5 added to qgsd-stop.js: two-signal turn classification (artifact commit + decision marker) eliminates false-positive quorum blocks on intermediate GSD-internal operation turns**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-20T00:00:00Z
- **Completed:** 2026-02-20T00:08:00Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Eliminated false-positive quorum blocks on all GSD-internal operation turns (agent spawning, routing, questioning, status banners, map-codebase commits)
- Quorum enforcement now fires only when a planning artifact is committed (PLAN.md, RESEARCH.md, CONTEXT.md, UAT.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md) OR when the decision marker `<!-- GSD_DECISION -->` appears in the last assistant text block
- TC6/TC9/TC12 updated (step 1a) to include artifact commit signals, preserving their `decision:block` invariant correctly after GUARD 5 is added
- All 19 test cases pass (TC1-TC13 preserved/updated + TC14-TC19 new)

## Task Commits

Each task was committed atomically (TDD):

1. **RED phase: TC14-TC19 + step 1a updates** - `8f9f699` (test)
2. **GREEN phase: GUARD 5 implementation** - `e3efbb0` (feat)

**Plan metadata:** (to be added in final commit)

_Note: TDD tasks have two commits (test → feat); no REFACTOR needed — code was already clean_

## Files Created/Modified

- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` - Added ARTIFACT_PATTERNS, hasArtifactCommit(), DECISION_MARKER, hasDecisionMarker(), GUARD 5 wiring in main()
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.test.js` - Added bashCommitBlock() helper; updated TC6/TC9/TC12 (step 1a); added TC14-TC19

## Decisions Made

- GUARD 5 position: after GUARD 4 (hasQuorumCommand) but before findQuorumEvidence. A quorum command is prerequisite; the decision turn gate is the narrowing condition. This preserves the existing guard ordering contract.
- Both `gsd-tools.cjs commit` AND an artifact pattern must appear in the same Bash block input serialization. This prevents false positives from any Bash calls (ls, cat, grep) that happen to mention artifact file names in their output.
- hasDecisionMarker scans only the last assistant entry (reverse scan, break on first match). Older text blocks from earlier in the turn are irrelevant for determining if the final output is a decision delivery.
- TC6/TC9/TC12 updated (step 1a) to include artifact commit signals before adding GUARD 5. This preserves the key invariant: `quorum-command + decision-turn + missing quorum = block`. Without step 1a, those tests would pass vacuously (GUARD 5 exits 0 before reaching quorum check), masking the regression.
- DECISION_MARKER defined as module-level constant `'<!-- GSD_DECISION -->'` for consistency between the Stop hook detection and future Prompt hook injection.

## Deviations from Plan

None — plan executed exactly as written, including all step 1a details and TDD order.

## Issues Encountered

None — RED/GREEN/REFACTOR proceeded cleanly. No REFACTOR commit needed; implementation was clean as written.

## User Setup Required

None — no external service configuration required. Hook changes are self-contained in `hooks/qgsd-stop.js`.

## Next Phase Readiness

- Phase 04 Plan 01 complete: GUARD 5 implemented and all 19 tests pass
- No further plans in Phase 04 per ROADMAP — phase is complete after this plan
- Future work: qgsd-prompt.js should inject the `<!-- GSD_DECISION -->` instruction so Claude knows to include it in non-artifact decision outputs (SCOPE-04, currently not in plan scope)

## Self-Check: PASSED

- hooks/qgsd-stop.js: FOUND
- hooks/qgsd-stop.test.js: FOUND
- 04-01-SUMMARY.md: FOUND
- commit 8f9f699 (RED phase): FOUND
- commit e3efbb0 (GREEN phase): FOUND
- node --test hooks/qgsd-stop.test.js: 19/19 passing

---
*Phase: 04-narrow-quorum-scope-to-project-decisions-only*
*Completed: 2026-02-20*
