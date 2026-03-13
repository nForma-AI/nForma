---
phase: quick-281
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/quorum-preflight.cjs
  - test/quorum-preflight-probe.test.cjs
autonomous: true
requirements: [QUICK-281]
formal_artifacts: none

must_haves:
  truths:
    - "Running --all --probe returns health object with per-slot healthy/layer1/layer2/reason fields"
    - "Running --all without --probe returns same output as before (backward compatible)"
    - "Binary probe detects missing CLI binaries and marks slot unhealthy"
    - "Upstream API probe hits GET /models for ccr-backed slots and marks unhealthy on timeout/error"
    - "Both probe layers run in parallel across all slots, total time under 5s"
    - "Base URLs are normalized (strip trailing slash, lowercase host, normalize port) before dedup grouping to prevent duplicate probes"
    - "Layer 2 response includes cacheAge field indicating 'fresh' or 'cached' with TTL remaining"
    - "When ANTHROPIC_BASE_URL is missing for a ccr slot, layer2 is skipped with warning reason, not treated as failure"
    - "saveCache() auto-creates cache file and parent directory if missing"
    - "Test covers missing/malformed ~/.claude.json gracefully (no crash, slots marked layer2 skipped)"
  artifacts:
    - path: "bin/quorum-preflight.cjs"
      provides: "Two-layer health probe behind --probe flag"
      contains: "probeHealth"
    - path: "test/quorum-preflight-probe.test.cjs"
      provides: "Unit tests for probe logic"
      min_lines: 40
  key_links:
    - from: "bin/quorum-preflight.cjs"
      to: "bin/providers.json"
      via: "findProviders() reads cli + health_check_args"
      pattern: "health_check_args"
    - from: "bin/quorum-preflight.cjs"
      to: "~/.claude.json"
      via: "reads ANTHROPIC_BASE_URL from mcpServers env for upstream probes"
      pattern: "ANTHROPIC_BASE_URL"
    - from: "core/workflows/quick.md"
      to: "bin/quorum-preflight.cjs"
      via: "calls --all (consumers can add --probe)"
      pattern: "quorum-preflight.cjs --all"
---

<objective>
Add a two-layer parallel health probe to bin/quorum-preflight.cjs behind a `--probe` flag. Layer 1 spawns each provider's CLI binary with its health_check_args (3s timeout). Layer 2 hits GET /models on ANTHROPIC_BASE_URL for ccr-backed slots (5s timeout, with TTL cache). A slot is HEALTHY only if all applicable layers pass. The --all output gains health, available_slots, and unavailable_slots fields when --probe is used.

Purpose: Enable pre-dispatch filtering of dead slots so quorum doesn't waste time on unreachable providers.
Output: Updated quorum-preflight.cjs with probe capability + unit tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/quorum-preflight.cjs
@bin/providers.json
@bin/check-provider-health.cjs
@bin/call-quorum-slot.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add two-layer parallel health probe to quorum-preflight.cjs</name>
  <files>bin/quorum-preflight.cjs</files>
  <action>
Add the --probe flag support to quorum-preflight.cjs. When --all --probe is passed, run health probes before outputting. The probe logic:

**Layer 1 — Binary probe (all slots):**
For each provider entry from providers.json, spawn `provider.cli` with `provider.health_check_args` (e.g., `codex --version`) using child_process.spawn. Timeout: 3000ms. Success = exit code 0. Failure = non-zero exit, timeout, or ENOENT (binary not found). Run all slots in parallel via Promise.all.

**Layer 2 — Upstream API probe (ccr/HTTP slots only):**
For slots where `display_type === "claude-code-router"`, read ~/.claude.json to find the matching MCP server entry (match by slot name) and extract ANTHROPIC_BASE_URL + ANTHROPIC_API_KEY from its env. If ANTHROPIC_BASE_URL is missing for a ccr slot, skip layer2 with `{ ok: true, skipped: true, reason: "ANTHROPIC_BASE_URL not configured" }` (treat as warning, not failure). Hit GET `${ANTHROPIC_BASE_URL}/models` with a 5000ms timeout. Reuse the TTL cache pattern from check-provider-health.cjs (cache file: `~/.claude/nf-provider-cache.json`, UP=3min TTL, DOWN=5min TTL). Success = HTTP 200/401/403/404/422. Normalize base URLs before dedup grouping: strip trailing slash, lowercase the host component, normalize default ports (`:443` for https, `:80` for http) — this prevents duplicate probes when the same provider is configured with minor URL formatting differences (e.g., `https://API.akashml.com/v1/` vs `https://api.akashml.com/v1`).

**Implementation approach:**
- Add a `normalizeBaseUrl(url)` helper: `new URL(url)` → lowercase host, strip trailing slash from pathname, remove default port (443/80). Use this before grouping URLs for dedup.
- Add a `probeHealth(providers)` async function that returns `Map<slotName, { healthy, layer1: {ok, reason}, layer2: {ok, reason, skipped?, cacheAge?} }>`.
- Layer 1 and Layer 2 run in parallel for each slot (Promise.all at the slot level, both layers also in parallel within each slot).
- For non-ccr slots (codex, gemini, opencode, copilot), layer2 is `{ ok: true, skipped: true, reason: "no upstream API" }`.
- A slot is healthy only if layer1.ok AND layer2.ok.

**Output shape when --probe is passed with --all:**
```json
{
  "quorum_active": [...],
  "max_quorum_size": 3,
  "team": { ... },
  "health": {
    "slotName": { "healthy": true, "layer1": { "ok": true, "reason": "exit 0" }, "layer2": { "ok": true, "reason": "HTTP 200", "latencyMs": 150, "cacheAge": "fresh" } }
  },
  "available_slots": ["codex-1", "gemini-1", ...],
  "unavailable_slots": [{ "name": "claude-5", "reason": "layer2: timeout after 5000ms" }]
}
```

**Without --probe:** Output is unchanged (backward compatible). The `health`, `available_slots`, `unavailable_slots` fields are absent.

**Key details:**
- Parse --probe flag: `const PROBE = process.argv.includes('--probe');`
- For the binary spawn, use `{ timeout: 3000 }` option and listen for 'error' event (ENOENT).
- For the HTTP probe, reuse the exact probeUrl pattern from check-provider-health.cjs (copy the function, don't require it — these are standalone scripts).
- Load ~/.claude.json MCP server env to get ANTHROPIC_BASE_URL per slot. Match slot name to mcpServers key. Only probe unique base URLs (dedup).
- Cache: reuse loadCache/saveCache/getCachedResult from check-provider-health.cjs pattern. Same cache file so probes from either script share results. saveCache() must auto-create the cache file and parent directory (`~/.claude/`) if they don't exist (use `fs.mkdirSync(dir, { recursive: true })` before writing). When returning a cached result, set `cacheAge: "cached"` with the remaining TTL; for fresh probes set `cacheAge: "fresh"`.
- Wrap ~/.claude.json reading in try/catch: if the file is missing or contains malformed JSON, log a warning and treat all ccr slots as layer2-skipped (do not crash).
  </action>
  <verify>
Run `node bin/quorum-preflight.cjs --all` (no --probe) and confirm output is unchanged JSON with quorum_active, max_quorum_size, team keys only.
Run `node bin/quorum-preflight.cjs --all --probe` and confirm output includes health, available_slots, unavailable_slots keys. Verify total execution time is under 5s.
  </verify>
  <done>
--all without --probe returns backward-compatible output. --all --probe returns enriched output with per-slot health verdicts including layer1 and layer2 results. Binary probes detect missing CLIs. HTTP probes hit upstream APIs for ccr slots. Both layers run in parallel.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add unit tests for probe logic</name>
  <files>test/quorum-preflight-probe.test.cjs</files>
  <action>
Create test/quorum-preflight-probe.test.cjs using the project's test pattern (Node assert + describe/it via node --test).

**Tests to write:**

1. **Backward compatibility:** Run `node bin/quorum-preflight.cjs --all` and parse JSON output. Assert it has keys quorum_active, max_quorum_size, team. Assert it does NOT have keys health, available_slots, unavailable_slots.

2. **Probe output shape:** Run `node bin/quorum-preflight.cjs --all --probe` and parse JSON output. Assert it has all standard keys PLUS health (object), available_slots (array), unavailable_slots (array). Assert available_slots + unavailable_slots names cover all team keys.

3. **Health entry structure:** For each entry in the health object, assert it has: healthy (boolean), layer1 (object with ok + reason), layer2 (object with ok + reason).

4. **Layer2 skipped for non-ccr slots:** For slots like codex-1, gemini-1, assert layer2.skipped === true.

5. **Execution time:** Measure wallclock time of --all --probe invocation. Assert it completes in under 8s (generous for CI, target is 5s).

6. **Missing/malformed ~/.claude.json:** Temporarily rename ~/.claude.json (if it exists) to ~/.claude.json.bak, run `node bin/quorum-preflight.cjs --all --probe`, parse output. Assert it doesn't crash (exit 0), and all ccr slots have layer2.skipped === true. Restore the file in a finally block. If ~/.claude.json doesn't exist, skip the rename and just verify the no-crash behavior.

7. **cacheAge field present:** For each layer2 entry in the health object (that isn't skipped), assert it has a `cacheAge` field that is either "fresh" or "cached".

Use `const { execSync } = require('child_process')` to invoke the script. Set `{ timeout: 15000, encoding: 'utf8' }`.
  </action>
  <verify>Run `node --test test/quorum-preflight-probe.test.cjs` and confirm all tests pass.</verify>
  <done>All 7 test cases pass. Backward compatibility verified. Probe output shape validated. Layer2 skip logic confirmed for non-ccr slots. Missing ~/.claude.json handled gracefully. cacheAge field validated.</done>
</task>

</tasks>

<verification>
1. `node bin/quorum-preflight.cjs --all` output is unchanged (backward compatible)
2. `node bin/quorum-preflight.cjs --all --probe` returns health data with per-slot verdicts
3. `node --test test/quorum-preflight-probe.test.cjs` passes all tests
4. Total --probe execution time is under 5s in normal conditions
</verification>

<success_criteria>
- --all --probe returns JSON with health map, available_slots, unavailable_slots
- Each health entry shows layer1 (binary) and layer2 (upstream API) results
- Layer2 includes cacheAge field ("fresh" or "cached") for non-skipped entries
- Non-ccr slots skip layer2 with skipped: true
- ccr slots with missing ANTHROPIC_BASE_URL skip layer2 with warning (not failure)
- Base URLs are normalized before dedup grouping (no duplicate probes for same provider)
- saveCache() auto-creates cache file and parent directory if missing
- Missing/malformed ~/.claude.json does not crash — ccr slots get layer2 skipped
- Backward compatibility: --all without --probe is unchanged
- All unit tests pass (7 cases)
</success_criteria>

<output>
After completion, create `.planning/quick/281-add-two-layer-parallel-health-probe-to-q/281-SUMMARY.md`
</output>
