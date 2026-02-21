---
phase: 01-hook-enforcement
plan: 02
subsystem: infra
tags: [hooks, node, quorum, UserPromptSubmit, additionalContext]

# Dependency graph
requires: []
provides:
  - hooks/qgsd-prompt.js — UserPromptSubmit hook that detects 6 GSD planning commands and injects quorum instructions via hookSpecificOutput.additionalContext
affects:
  - 01-hook-enforcement (plan 03+: build script and installer integration read this hook)
  - Phase 2 config: qgsd.json config key (quorum_commands, quorum_instructions) established here

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node.js stdin-buffering hook pattern (matches gsd-statusline.js exactly)"
    - "Anchored allowlist regex: ^\\s*\\/gsd:(cmd1|cmd2)(\\s|$) — requires /gsd: prefix + word boundary"
    - "Fail-open: try/catch wrapping entire hook body, process.exit(0) on any error"
    - "hookSpecificOutput.additionalContext for context injection (NOT systemMessage)"
    - "loadConfig() returns null on missing/malformed file; caller falls back to hardcoded defaults"

key-files:
  created:
    - hooks/qgsd-prompt.js
  modified: []

key-decisions:
  - "Config file is ~/.claude/qgsd.json (matches plan spec and STATE.md decision from 01-01)"
  - "Regex uses mandatory /gsd: prefix with no optional group — matches stop hook pattern exactly"
  - "loadConfig() returns null (not default values) so caller controls fallback logic"
  - "Allowlist is exactly 6 commands: plan-phase, new-project, new-milestone, discuss-phase, verify-work, research-phase"

patterns-established:
  - "Pattern: stdin-buffering with process.stdin.on('data') + process.stdin.on('end') — identical to gsd-statusline.js"
  - "Pattern: anchored allowlist regex prevents false matches on /gsd:execute-phase and substring matches"
  - "Pattern: hookSpecificOutput.additionalContext is the sole injection mechanism"

requirements-completed: [UPS-01, UPS-02, UPS-03, UPS-04, UPS-05]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 01 Plan 02: UserPromptSubmit Hook Summary

**UserPromptSubmit hook that injects named quorum tool instructions (mcp__codex-cli__review, mcp__gemini-cli__gemini, mcp__opencode__opencode) via additionalContext on the 6 GSD planning commands, with silent pass for all other commands**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-20T19:33:19Z
- **Completed:** 2026-02-20T19:35:27Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- hooks/qgsd-prompt.js created: 75 lines, shebang, Node stdlib only (fs, path, os)
- All 6 planning commands produce hookSpecificOutput.additionalContext JSON on stdout
- Non-planning commands (execute-phase, any non-GSD text) produce no stdout and exit 0
- Injected additionalContext names all three MCP tools by exact call name
- Fail-open: process.exit(0) on any error, never blocks Claude

## Task Commits

Each task was committed atomically:

1. **Task 1: Write qgsd-prompt.js (UserPromptSubmit hook)** - `4e6738a` (feat)

**Plan metadata:** [pending final commit] (docs: complete plan)

## Files Created/Modified
- `hooks/qgsd-prompt.js` - UserPromptSubmit hook: detects 6 GSD planning commands, injects quorum instructions via hookSpecificOutput.additionalContext, reads ~/.claude/qgsd.json with fallback to hardcoded defaults

## Decisions Made
- Config file is `~/.claude/qgsd.json` (not `qgsd-config.json`) as specified in plan and confirmed in STATE.md decision from plan 01-01
- Regex pattern requires mandatory `/gsd:` prefix (no optional `(gsd:)?` group) matching the stop hook regex exactly — prevents false matches on bare command names
- loadConfig() returns null on missing/malformed config so caller controls fallback (cleaner separation than returning defaults from config loader)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Python 3.14 and Node.js 25 strict JSON parsers rejected inline one-liner test commands when `$result` shell variable expansion broke the literal em dash in the additionalContext value. The hook JSON output itself is valid RFC 7159 JSON. Worked around by writing output to a temp file and parsing from there for verification. Not a hook bug — test harness issue only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- hooks/qgsd-prompt.js is ready to be included in the build script (scripts/build-hooks.js) and installer (bin/install.js) in plans 03 and 04
- Plan 01-01 (Stop hook) and plan 01-02 (UserPromptSubmit hook) are both complete — the two-hook quorum enforcement layer is fully implemented at source level
- Remaining work: build/dist copy, installer registration, integration tests

## Self-Check: PASSED

- hooks/qgsd-prompt.js: FOUND
- 01-02-SUMMARY.md: FOUND
- Commit 4e6738a: FOUND

---
*Phase: 01-hook-enforcement*
*Completed: 2026-02-20*
