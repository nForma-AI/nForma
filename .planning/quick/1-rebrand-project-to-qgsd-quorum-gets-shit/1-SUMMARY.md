---
phase: quick
plan: 1
subsystem: branding
tags: [rebrand, commands, installer, markdown, qgsd]

# Dependency graph
requires: []
provides:
  - commands/qgsd/ directory with all 34 command files (renamed from commands/gsd/)
  - bin/install.js updated to install from commands/qgsd and use qgsd- prefix throughout
  - All /gsd: command references replaced with /qgsd: across 62 markdown files
  - README H1: "QGSD: Quorum Gets Shit Done" with updated tagline and closing line
  - package.json description starts with "QGSD: Quorum Gets Shit Done —"
  - docs/USER-GUIDE.md title: "# QGSD User Guide" with full GSD → QGSD branding update
affects: [all-phases, installer, commands]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - commands/qgsd/ (renamed from commands/gsd/, 34 files)
    - bin/install.js
    - README.md
    - package.json
    - docs/USER-GUIDE.md
    - agents/*.md (10 agent files)
    - get-shit-done/workflows/*.md (27 workflow files)
    - get-shit-done/templates/*.md (7 template files)
    - get-shit-done/references/*.md (3 reference files)
    - CLAUDE.md

key-decisions:
  - "CHANGELOG.md left unchanged — historical record must remain as authored"
  - ".planning/ directory excluded from /gsd: → /qgsd: replacement — working state files"
  - "gsd- agent file names (e.g. gsd-executor.md) left unchanged — internal implementation files, not command references"
  - "gsd-statusline.js, gsd-check-update.js and other upstream GSD hook names left as-is — they belong to base GSD infrastructure"
  - "writeManifest() path corrected from commands/gsd to commands/qgsd (Rule 1 bug fix — function would fail to find installed directory after rename)"

patterns-established: []

requirements-completed: [REBRAND-01, REBRAND-02]

# Metrics
duration: 5min
completed: 2026-02-20
---

# Quick Task 1: Rebrand to QGSD Summary

**Commands renamed from /gsd:* to /qgsd:*, installer updated, and all user-facing copy rebranded to "QGSD: Quorum Gets Shit Done" — GSD and QGSD can now coexist side-by-side.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-20T23:41:35Z
- **Completed:** 2026-02-20T23:46:53Z
- **Tasks:** 3 (+ 1 fix-up commit)
- **Files modified:** 66+ across commands/, agents/, docs/, get-shit-done/, bin/

## Accomplishments

- Renamed `commands/gsd/` to `commands/qgsd/` via git mv — all 34 command files tracked correctly
- Updated `bin/install.js` with 10+ targeted changes: OpenCode prefix, uninstall paths, install paths, manifest path, completion message
- Replaced `/gsd:` with `/qgsd:` across 62 markdown files (CHANGELOG.md and .planning/ excluded)
- Updated README H1, tagline, and closing line for QGSD identity
- Updated `package.json` description to start with "QGSD: Quorum Gets Shit Done —"
- Updated `docs/USER-GUIDE.md` title and all product GSD references to QGSD

## Task Commits

1. **Task 1: Rename commands directory and update bin/install.js** - `e63c919` (feat)
2. **Task 2: Global /gsd: → /qgsd: replacement in all markdown files** - `f977e80` (feat)
3. **Task 3: Update branding copy — README headline, package.json, USER-GUIDE title** - `e5b1180` (feat)
4. **Fix-up: Remaining gsd refs in install.js — comments and manifest path** - `77ac38e` (fix)

## Files Created/Modified

- `commands/qgsd/` — renamed from `commands/gsd/` (34 files, all command .md files)
- `bin/install.js` — 10+ targeted changes for qgsd prefix and paths
- `README.md` — H1, tagline, closing line updated
- `package.json` — description field updated
- `docs/USER-GUIDE.md` — title and all GSD product references updated
- `agents/gsd-*.md` (10 files) — /gsd: command references → /qgsd:
- `get-shit-done/workflows/*.md` (27 files) — /gsd: → /qgsd: throughout
- `get-shit-done/templates/*.md` (7 files) — /gsd: → /qgsd: throughout
- `get-shit-done/references/*.md` (3 files) — /gsd: → /qgsd: throughout
- `CLAUDE.md` — R3.1 command list updated to /qgsd: prefix

## Decisions Made

- CHANGELOG.md left unchanged — historical record, must remain as authored
- .planning/ directory excluded from replacement — working state files
- Agent file names (`gsd-executor.md`, `gsd-planner.md`, etc.) left unchanged — internal implementation names, not user-facing command references
- Upstream GSD hook file names (`gsd-statusline.js`, `gsd-check-update.js`) left as-is — they belong to base GSD infrastructure
- `writeManifest()` path corrected from `commands/gsd` to `commands/qgsd` — bug fix found during verification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] writeManifest() read wrong path after rename**
- **Found during:** Task 3 verification pass (comprehensive gsd grep)
- **Issue:** `writeManifest()` at line 1362 still used `path.join(configDir, 'commands', 'gsd')` as the source for manifest generation. After the rename, this path would not exist, so manifest generation would silently skip the commands directory.
- **Fix:** Updated to `path.join(configDir, 'commands', 'qgsd')`
- **Files modified:** `bin/install.js`
- **Verification:** Final grep confirms no `commands/gsd` references remain in install.js
- **Committed in:** `77ac38e` (fix commit)

**2. [Rule 1 - Bug] JSDoc comment examples still referenced gsd paths**
- **Found during:** Task 3 verification pass
- **Issue:** `copyFlattenedCommands` JSDoc and inline example comments still said `commands/gsd/`, `gsd-help.md`, etc.
- **Fix:** Updated all 5 comment occurrences to qgsd variants
- **Files modified:** `bin/install.js`
- **Committed in:** `77ac38e` (fix commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bug fixes found during verification)
**Impact on plan:** Both fixes necessary for correctness; the manifest path fix prevents silent data loss on first post-rebrand install. No scope creep.

## Issues Encountered

None — sed replacement completed cleanly; all 6 plan verification checks passed after fix-ups.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- QGSD rebrand complete; commands install as `/qgsd:*` instead of `/gsd:*`
- Users running `npx get-shit-done-cc@latest` will install to `commands/qgsd/` and receive `/qgsd:help`
- GSD and QGSD can now coexist side-by-side (GSD: `commands/gsd/`, QGSD: `commands/qgsd/`)

---
*Phase: quick-1*
*Completed: 2026-02-20*
