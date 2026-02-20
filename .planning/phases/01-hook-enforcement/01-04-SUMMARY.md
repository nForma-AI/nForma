---
phase: 01-hook-enforcement
plan: 04
subsystem: infra
tags: [node, hooks, installer, build, claude-code, settings-json, qgsd-prompt, qgsd-stop]

# Dependency graph
requires:
  - plan: 01-01
    provides: "hooks/qgsd-stop.js source file"
  - plan: 01-02
    provides: "hooks/qgsd-prompt.js source file"
provides:
  - "scripts/build-hooks.js: Extended to copy qgsd-prompt.js and qgsd-stop.js into hooks/dist/"
  - "bin/install.js: Registers UserPromptSubmit (qgsd-prompt) and Stop (qgsd-stop) hooks in settings.json"
  - "bin/install.js: Writes ~/.claude/qgsd.json from templates/ on first install"
  - "bin/install.js: Uninstall path removes QGSD hook entries and cleans up empty objects"
affects:
  - "01-05: Integration test (exercises the full install path including new hook registrations)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent hook registration: some() check on hook command string before push — prevents duplicates on re-install"
    - "Config copy guard: fs.existsSync() before copyFileSync — never overwrites user-customized qgsd.json"
    - "Empty-object cleanup: delete hooks[type] when filtered array is empty, then delete hooks if no keys remain"

key-files:
  created: []
  modified:
    - scripts/build-hooks.js
    - bin/install.js

key-decisions:
  - "QGSD hooks added to HOOKS_TO_COPY in build-hooks.js — no changes to the build() loop needed, it already handles all entries generically"
  - "UserPromptSubmit and Stop blocks placed inside existing if (!isOpencode) block — QGSD hooks are Claude Code only in v1"
  - "timeout: 30 on Stop hook — Stop hook reads transcript synchronously; 30s conservative budget prevents hang on I/O stall"
  - "hooks/dist/ is gitignored — only scripts/build-hooks.js is committed; dist files are built artifacts produced at install time"

patterns-established:
  - "Uninstall mirrors install: every hook registered in install() has a matching filter() + empty-cleanup block in uninstall()"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 01 Plan 04: Build + Installer Wiring Summary

**npm run build:hooks now copies qgsd-prompt.js and qgsd-stop.js to hooks/dist/, and npx . --claude --global registers both QGSD hooks in ~/.claude/settings.json and writes the default qgsd.json config**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T19:42:25Z
- **Completed:** 2026-02-20T19:43:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended `scripts/build-hooks.js` HOOKS_TO_COPY array with `qgsd-prompt.js` and `qgsd-stop.js`; build produces all four hooks in `hooks/dist/` including both QGSD hooks
- Extended `bin/install.js` install path with UserPromptSubmit hook registration (qgsd-prompt.js), Stop hook registration with timeout:30 (qgsd-stop.js), and qgsd.json copy-if-absent guard
- Extended `bin/install.js` uninstall path with QGSD hook removal for UserPromptSubmit and Stop arrays, with empty-array and empty-object cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend build-hooks.js to include QGSD hooks** - `9b1a0de` (feat)
2. **Task 2: Extend installer with UserPromptSubmit + Stop hook registration and config write** - `8167c67` (feat)

## Files Created/Modified
- `scripts/build-hooks.js` - Two new entries added to HOOKS_TO_COPY: qgsd-prompt.js and qgsd-stop.js
- `bin/install.js` - Three install blocks added (UserPromptSubmit, Stop, qgsd.json); two uninstall blocks added (qgsd-prompt removal, qgsd-stop removal)

## Decisions Made
- QGSD hooks placed inside existing `if (!isOpencode)` block — in v1 these hooks are Claude Code specific, consistent with the UserPromptSubmit constraint documented in STATE.md (GitHub #10225)
- `hooks/dist/` is gitignored — dist files are build artifacts produced by `npm run build:hooks`, not versioned directly; only the build script change is committed
- `timeout: 30` on Stop hook matches ARCHITECTURE.md recommendation for synchronous transcript read budget

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

`hooks/dist/` is gitignored, so Task 1's git add targeted only `scripts/build-hooks.js`. The dist files are build artifacts correctly excluded from version control; the build verification (running `node scripts/build-hooks.js` and checking `hooks/dist/`) confirmed correctness without committing them.

## User Setup Required

None — no external service configuration required. The build and install wiring is complete. Users run `npm run build:hooks` to populate `hooks/dist/`, then `npx . --claude --global` to register the hooks in `~/.claude/settings.json`.

## Next Phase Readiness
- Full hook pipeline wired: stop hook built in Plan 01, prompt hook built in Plan 02, both now buildable via `npm run build:hooks` and installable via `npx . --claude --global`
- Plan 05 integration test can now exercise the full install path end-to-end

---
*Phase: 01-hook-enforcement*
*Completed: 2026-02-20*
