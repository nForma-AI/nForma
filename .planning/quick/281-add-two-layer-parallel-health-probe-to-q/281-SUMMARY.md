---
phase: quick-281
plan: 01
subsystem: quorum-preflight
tags: [health-probe, quorum, parallel, cache]
dependency_graph:
  requires: [providers.json, check-provider-health.cjs]
  provides: [two-layer-health-probe, pre-dispatch-slot-filtering]
  affects: [quorum-preflight.cjs]
tech_stack:
  added: []
  patterns: [TTL-cache, URL-normalization, parallel-spawn, two-layer-probe]
key_files:
  created:
    - test/quorum-preflight-probe.test.cjs
  modified:
    - bin/quorum-preflight.cjs
decisions:
  - Reused TTL cache pattern from check-provider-health.cjs with shared cache file
  - saveCache auto-creates ~/.claude/ directory if missing
  - Layer2 skipped (not failed) when ANTHROPIC_BASE_URL missing for ccr slots
  - URL normalization prevents duplicate probes for same provider
metrics:
  duration: 3m 5s
  completed: 2026-03-12
  tasks_completed: 2
  tasks_total: 2
  test_results: 7 pass / 0 fail
---

# Quick 281: Add Two-Layer Parallel Health Probe to quorum-preflight.cjs Summary

Two-layer parallel health probe behind --probe flag: Layer 1 spawns CLI binaries (3s timeout), Layer 2 hits GET /models for ccr-backed slots (5s timeout, shared TTL cache with dedup URL normalization)

## What Was Done

### Task 1: Add two-layer parallel health probe to quorum-preflight.cjs
**Commit:** c9427b7e

Added the `--probe` flag to `bin/quorum-preflight.cjs`. When `--all --probe` is passed:

- **Layer 1 (Binary probe):** Spawns each provider's CLI binary with `health_check_args` using `child_process.spawn` with 3000ms timeout. Detects ENOENT (binary not found), non-zero exit codes, and timeouts.
- **Layer 2 (Upstream API probe):** For `display_type === "claude-code-router"` slots, reads `~/.claude.json` to extract `ANTHROPIC_BASE_URL` + `ANTHROPIC_API_KEY`, then hits `GET /models` with 5000ms timeout. HTTP 200/401/403/404/422 = healthy.
- **URL normalization:** `normalizeBaseUrl()` helper lowercases hostname, strips trailing slash, removes default ports (443/80) before dedup grouping.
- **TTL cache:** Shared cache file (`~/.claude/nf-provider-cache.json`) with UP=3min, DOWN=5min TTL. `saveCache()` auto-creates parent directory with `fs.mkdirSync(dir, { recursive: true })`.
- **Graceful degradation:** Missing/malformed `~/.claude.json` logs warning to stderr, treats all ccr slots as layer2-skipped (no crash). Missing `ANTHROPIC_BASE_URL` for ccr slot = skipped with warning reason.
- **Parallel execution:** Both layers run in parallel within each slot; all slots probed in parallel via `Promise.all`.
- **Backward compatibility:** `--all` without `--probe` returns identical output as before.

Output gains `health` (per-slot map), `available_slots` (array), `unavailable_slots` (array with name + reason) fields.

### Task 2: Add unit tests for probe logic
**Commit:** fcc2e04f

Created `test/quorum-preflight-probe.test.cjs` with 7 test cases:

1. Backward compatibility (no --probe = no health keys)
2. Probe output shape (health + available_slots + unavailable_slots present, cover all team slots)
3. Health entry structure (healthy, layer1.ok/reason, layer2.ok/reason)
4. Layer2 skipped for non-ccr slots (codex, gemini, opencode, copilot)
5. Execution time under 8s
6. Missing/malformed ~/.claude.json graceful handling
7. cacheAge field validation ("fresh" or "cached" for non-skipped layer2)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. `node bin/quorum-preflight.cjs --all` output unchanged (backward compatible) - PASS
2. `node bin/quorum-preflight.cjs --all --probe` returns health data with per-slot verdicts - PASS
3. `node --test test/quorum-preflight-probe.test.cjs` passes all 7 tests - PASS
4. Total --probe execution time ~1.8s (well under 5s target) - PASS

## Self-Check: PASSED

- [x] bin/quorum-preflight.cjs modified with probeHealth function
- [x] test/quorum-preflight-probe.test.cjs created (159 lines, exceeds 40 line minimum)
- [x] Commit c9427b7e exists
- [x] Commit fcc2e04f exists
- [x] All 7 tests pass
