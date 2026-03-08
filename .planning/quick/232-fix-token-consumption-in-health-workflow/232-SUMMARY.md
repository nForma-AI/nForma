---
phase: quick-232
plan: 01
status: complete
---

# Quick Task 232: Fix token consumption display in nf:health

## What changed

### Bug 1: Wrong file path in health.md
- `core/workflows/health.md` inline script read from `.planning/token-usage.jsonl`
- Canonical path is `.planning/telemetry/token-usage.jsonl` (per `bin/planning-paths.cjs`)
- Fix: Updated path in the inline script

### Bug 2: isSidechain filter discarded all token data (ROOT CAUSE)
- `hooks/nf-token-collector.js` filtered out entries with `isSidechain === true`
- Claude Code marks ALL subagent transcript entries as `isSidechain: true`
- This silently discarded every assistant message that contained `message.usage` data
- Result: 856 records with `input_tokens: 0, output_tokens: 0`
- Fix: Removed isSidechain filter, added explanatory comment

### Bug 3: Hex slot IDs in token records
- Slot resolution fell back to raw `agent_id` hex strings when both correlation file and `last_assistant_message` regex failed
- Thin slot workers output raw responses (e.g., "Four") without `slot:` prefix in their last assistant message
- Fix: Added transcript-based slot resolution — parses `slot: <name>` from the first user message in the transcript

### Bug 4: Tests silently broken since v0.31-01-01
- `validateHookInput` was wired into all hooks but test payloads were never updated with `hook_event_name: 'SubagentStop'`
- Tests defaulted to PostToolUse validation schema, failed required field check, and exited 0 (fail-open) — producing no output
- Fix: Added `hook_event_name: 'SubagentStop'` to all test payloads

## Files modified
- `core/workflows/health.md` — Fixed token-usage.jsonl path
- `hooks/nf-token-collector.js` — Removed isSidechain filter, added transcript slot resolution
- `hooks/nf-token-collector.test.js` — Updated all tests, added transcript slot resolution test
- `hooks/dist/nf-token-collector.js` — Synced from source

## Test results
- 8/8 tests pass (was 1/7 before fix — 6 silently broken by missing hook_event_name)

## Verification
- Manual hook test confirms: `input_tokens: 3, output_tokens: 5, cache_creation_input_tokens: 10379, slot: "claude-1"` — real token data captured for the first time
