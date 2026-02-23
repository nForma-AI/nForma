---
phase: quick-78
plan: 01
subsystem: quorum
tags: [quorum, providers, health-check, cache, min-quorum, pre-flight, timeout]
dependency_graph:
  requires: []
  provides: [per-slot-quorum-timeout, provider-health-ttl-cache, min-quorum-guard, unavail-pre-skip]
  affects: [agents/qgsd-quorum-orchestrator.md, commands/qgsd/quorum.md, bin/check-provider-health.cjs, bin/providers.json]
tech_stack:
  added: [~/.claude/qgsd-provider-cache.json (TTL cache file)]
  patterns: [per-slot timeout config, fail-open TTL cache, min-quorum guard with --force-quorum bypass, UNAVAIL pre-skip with logging]
key_files:
  created: []
  modified:
    - bin/providers.json
    - bin/check-provider-health.cjs
    - agents/qgsd-quorum-orchestrator.md
    - commands/qgsd/quorum.md
decisions:
  - "per-slot quorum_timeout_ms is a new field alongside existing timeout_ms (subprocess exec); semantically separate: quorum_timeout_ms = MCP call deadline, timeout_ms = subprocess exec budget"
  - "Cache TTL: 5min for DOWN entries (known bad, safe to trust longer), 3min for UP entries (providers can go down, refresh more often)"
  - "min_quorum_size defaults to 3 (Claude + 2 others minimum); --force-quorum bypasses with logged warning rather than silently proceeding"
  - "Pre-flight skip happens before any MCP call and before min_quorum check, so the guard uses the accurate post-skip count"
metrics:
  duration: "~6 minutes"
  completed: "2026-02-23T16:12:15Z"
  tasks_completed: 3
  files_modified: 4
---

# Phase quick-78 Plan 01: Harden QGSD Quorum — min_quorum guard, TTL cache, pre-flight skip, per-slot timeout

**One-liner:** Four hardening fixes: per-slot `quorum_timeout_ms` in providers.json, 5min/3min TTL provider health cache, UNAVAIL pre-flight skip with logging, and `min_quorum_size` guard (default 3) with `--force-quorum` bypass.

## What Was Built

### Fix #4 — Per-slot quorum_timeout_ms (Task 1)

Added `quorum_timeout_ms` to every entry in `bin/providers.json`:
- Subprocess slots (codex-1/2, gemini-1/2, opencode-1, copilot-1): 30000ms
- claude-1 (DeepSeek AkashML): 20000ms
- claude-2 (MiniMax AkashML): 20000ms
- claude-3 (Qwen Together): 30000ms
- claude-4 (Kimi Fireworks): 30000ms
- claude-5 (Llama4 Together): 10000ms (fast model — strict deadline)
- claude-6 (GLM-5 Fireworks): 8000ms (fast model — strict deadline)

The existing `timeout_ms` field (subprocess exec budget) is untouched.

### Fix #3 — Provider health TTL cache (Task 2)

Added cache layer to `bin/check-provider-health.cjs`:
- Cache file: `~/.claude/qgsd-provider-cache.json`
- TTL: 5 minutes for DOWN entries, 3 minutes for UP entries
- `loadCache()` / `saveCache()`: fail-open (missing or corrupt = empty cache, not crash)
- Before each probe: check cache — if fresh, use cached result (log to stderr in human mode only)
- After each probe: write result back to cache
- `--no-cache` flag: bypass cache reads entirely (still writes fresh results)
- `--cache-status` flag: print all cached entries with remaining TTL, then exit
- JSON output format (`--json`) is unchanged — cache hits produce identical structure

### Fix #9 + #5 — min_quorum_size guard + UNAVAIL pre-skip (Task 3)

**agents/qgsd-quorum-orchestrator.md:**
- Pre-flight slot skip: after building `$CLAUDE_MCP_SERVERS`, immediately log and remove UNAVAIL slots; reorder so healthy slots come first; log `Active slots: ...`
- min_quorum_size check: read from `~/.claude/qgsd.json` (project over global, default 3); count available + Claude as +1; if below threshold, stop with `QUORUM BLOCKED` message listing available/UNAVAIL slots; `--force-quorum` in `$ARGUMENTS` bypasses with warning
- Step 2 timeout guard: read providers.json once at start, build `$SLOT_TIMEOUTS` map; per-slot `quorum_timeout_ms` applied to every call (Steps 2, Mode A, Mode B, deliberation)

**commands/qgsd/quorum.md:**
- Identical pre-flight slot skip block added after `$QUORUM_ACTIVE` section
- Identical min_quorum_size guard added
- Team identity capture: per-slot `quorum_timeout_ms` timeout guard added to claude-mcp-server iteration

**Install sync:** `node bin/install.js --claude --global` ran successfully (exit 0) — updated agents and commands installed to `~/.claude/qgsd/`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 1e1a8ca | feat(quick-78): add per-slot quorum_timeout_ms to providers.json |
| 2 | 65fd1c6 | feat(quick-78): add TTL cache to check-provider-health.cjs |
| 3 | 2222f2f | feat(quick-78): add min_quorum_size guard + UNAVAIL pre-skip + per-slot timeout |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `bin/providers.json` — FOUND (12 entries, all with quorum_timeout_ms verified)
- `bin/check-provider-health.cjs` — FOUND (TTL cache added, --no-cache and --cache-status flags working)
- `~/.claude/qgsd-provider-cache.json` — FOUND (written after first probe run)
- `agents/qgsd-quorum-orchestrator.md` — FOUND (min_quorum_size: 5 hits, Pre-flight skip: 1 hit, quorum_timeout_ms: 4 hits, force-quorum: 2 hits)
- `commands/qgsd/quorum.md` — FOUND (min_quorum_size: 5 hits, Pre-flight skip: 1 hit)
- Install sync — exit 0 confirmed
- Commits: 1e1a8ca, 65fd1c6, 2222f2f — all verified in git log
