---
phase: quick-19
plan: 19
subsystem: hooks
tags: [stop-hook, quorum, false-positive, xml-tag, regression-test]
dependency_graph:
  requires: []
  provides:
    - "XML-tag-first command matching in qgsd-stop.js hasQuorumCommand and extractCommand"
    - "TC20/TC20b/TC20c regression tests covering @file-expansion false positive"
  affects:
    - "hooks/qgsd-stop.js — hasQuorumCommand, extractCommand now use <command-name> tag"
    - "hooks/dist/qgsd-stop.js — rebuilt to match source"
tech_stack:
  added: []
  patterns:
    - "XML-tag-first matching: read <command-name> tag before body scan to avoid false positives from @file-expanded content"
    - "300-char text fallback: limits body scan to first 300 chars when no XML tag present"
key_files:
  created:
    - path: "hooks/qgsd-stop.test.js (TC20/TC20b/TC20c appended)"
      purpose: "Regression tests for @file-expansion false positive scenario"
  modified:
    - path: "hooks/qgsd-stop.js"
      purpose: "Added extractCommandTag(); rewrote hasQuorumCommand and extractCommand with XML-tag-first strategy"
    - path: "hooks/dist/qgsd-stop.js"
      purpose: "Rebuilt from source (gitignored, on-disk authoritative)"
decisions:
  - id: "QUICK-19-01"
    summary: "XML-tag-first strategy: <command-name> tag takes priority over body scan; tag-present-but-wrong-command skips body (do not fall through)"
    rationale: "Claude Code injects <command-name> tag only for real invocations. @file-expanded workflow content never has this tag. Testing tag first and not falling through to body scan when tag is present prevents false positives."
  - id: "QUICK-19-02"
    summary: "300-char text fallback when no tag: avoids full JSON.stringify body scan that could match commands in large @file-expanded bodies"
    rationale: "Real slash commands appear at the very start of the user message. Limiting fallback to first 300 chars preserves backward compatibility for clients not injecting the XML tag while still avoiding matching deep body content."
metrics:
  duration: "3 min"
  completed: "2026-02-21"
  tasks_completed: 2
  files_modified: 3
---

# Quick Task 19: Fix Stop Hook False Positive on New Project Summary

**One-liner:** XML-tag-first command matching in qgsd-stop.js — reads `<command-name>` tag before body scan to prevent `@file-expanded` workflow content from triggering false-positive quorum blocks.

## What Was Built

Fixed a false-positive quorum block in `hooks/qgsd-stop.js` where `hasQuorumCommand()` matched `/qgsd:new-project` text embedded inside `@file-expanded` workflow content rather than the actual invoked command.

**Root cause:** The old implementation used `cmdPattern.test(JSON.stringify(entry.message))` which serialized the entire message to JSON (including the large `@file-expanded` body) and scanned all of it. When a user ran `/qgsd:quick`, the expanded `quick.md` workflow content mentioned `/qgsd:new-project` — causing GUARD 4 to falsely fire.

**Fix:** Claude Code injects a `<command-name>` XML tag for real slash command invocations. This tag is never present in `@file-expanded` content. The new `extractCommandTag()` helper reads this tag; `hasQuorumCommand()` and `extractCommand()` test the tag first and short-circuit when it is present (correct command → match, wrong command → `continue` without falling through to body scan). When no tag is present (legacy fallback), only the first 300 characters of message text are scanned.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add extractCommandTag; XML-tag-first strategy | 1af8766 | hooks/qgsd-stop.js, hooks/dist/qgsd-stop.js |
| 2 | Add regression tests TC20/TC20b/TC20c | 02b73bf | hooks/qgsd-stop.test.js |

## Verification Results

1. `grep -n "extractCommandTag\|command-name" hooks/qgsd-stop.js` — 7 hits: helper definition at lines 59/62/71, call sites at lines 84 and 115
2. `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` — empty (dist rebuilt matches source)
3. `grep -n "TC20" hooks/qgsd-stop.test.js` — 3 test descriptions (TC20, TC20b, TC20c) plus inline comments
4. `npm test` — 144 tests, 0 failures (up from 141 before this task)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `hooks/qgsd-stop.js` exists with `extractCommandTag` function: FOUND
- `hooks/dist/qgsd-stop.js` rebuilt (gitignored, on-disk): FOUND
- Commit `1af8766` exists: FOUND
- Commit `02b73bf` exists: FOUND
- `npm test` exit 0: CONFIRMED (144/144 pass)
