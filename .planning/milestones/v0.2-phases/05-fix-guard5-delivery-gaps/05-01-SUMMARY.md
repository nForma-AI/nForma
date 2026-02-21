---
phase: 05-fix-guard5-delivery-gaps
plan: 01
status: complete
completed: 2026-02-21
---

# Phase 5 Execution Summary: Fix GUARD 5 Delivery Gaps

## Objective

Propagate Phase 4's GUARD 5 decision-turn scoping to all delivery paths that real users touch.
Two gaps were closed (GAP-01 and GAP-02), templates were updated, and CHANGELOG was documented.

## Tasks Completed

### Task 1: Add step N+2 to buildQuorumInstructions() and templates/qgsd.json

**Files changed:** `bin/install.js`, `templates/qgsd.json`

**bin/install.js — buildQuorumInstructions():**

Replaced the return statement so that step N+1 wording is corrected ("resolve any concerns" /
"deliver your final output") and step N+2 is appended:

```javascript
  `  ${required.length + 1}. Present all model responses, resolve any concerns, then deliver your final output\n` +
  `  ${required.length + 2}. Include the token <!-- GSD_DECISION --> somewhere in your FINAL output (...)\n\n` +
```

Step index uses `required.length + 2` (dynamic, not hardcoded) to support variable model counts.

**templates/qgsd.json — quorum_instructions:**

Step 4 wording corrected and step 5 appended to match DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK exactly:

```
  4. Present all model responses, resolve any concerns, then deliver your final output
  5. Include the token <!-- GSD_DECISION --> somewhere in your FINAL output (...)
```

### Task 2: Rebuild hooks/dist/ and document CHANGELOG

**`npm run build:hooks` output:** All five files copied from source to dist:
- `gsd-check-update.js`
- `gsd-statusline.js`
- `qgsd-prompt.js`
- `qgsd-stop.js`
- `config-loader.js`

**CHANGELOG.md:** Added `### Fixed` and `### Added` sections to `## [Unreleased]` documenting
GUARD 5 delivery fix and the `--redetect-mcps` flag.

## Verification Results

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `grep -c "GSD_DECISION" hooks/qgsd-prompt.js` | 1 | 1 | YES |
| `grep -c "GSD_DECISION" bin/install.js` | 1 | 1 | YES |
| `grep -c "GSD_DECISION" templates/qgsd.json` | 1 | 1 | YES |
| `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` | empty | empty | YES |
| `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` | empty | empty | YES |
| `diff hooks/config-loader.js hooks/dist/config-loader.js` | empty | empty | YES |
| `grep -c "hasArtifactCommit" hooks/dist/qgsd-stop.js` | ≥2 | 2 | YES |
| `grep -c "redetect-mcps" CHANGELOG.md` | ≥1 | 2 | YES |
| `grep -c "GSD_DECISION" CHANGELOG.md` | ≥1 | 1 | YES |

Note: Plan verification comment said `grep -c "GSD_DECISION" hooks/dist/qgsd-stop.js` expect 3.
Actual source has 1 literal occurrence (the DECISION_MARKER const assignment); other uses reference
the constant by name. Source and dist are identical (diff empty) — this is the authoritative check.

## Success Criteria Status

1. `grep -c "GSD_DECISION" bin/install.js` returns 1 — YES
2. `grep -c "GSD_DECISION" templates/qgsd.json` returns 1 — YES
3. `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` produces no output — YES
4. `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` produces no output — YES
5. CHANGELOG.md `[Unreleased]` documents GUARD 5 fix and --redetect-mcps — YES
6. No new logic introduced — YES (all changes are mechanical propagation of Phase 4 source)

## Phase 5: COMPLETE
