---
phase: quick-78
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/check-provider-health.cjs
  - agents/qgsd-quorum-orchestrator.md
  - commands/qgsd/quorum.md
autonomous: true
requirements: [QUORUM-HARDEN-01]

must_haves:
  truths:
    - "Quorum is blocked (with a clear error) if fewer than 3 models are available, unless --force-quorum is passed"
    - "Each slot in providers.json has a quorum_timeout_ms field; orchestrator reads it (fallback 30000ms)"
    - "Pre-flight auto-skips UNAVAIL slots before any MCP call; logs 'Pre-flight skip: <slot> (<provider> DOWN)'"
    - "check-provider-health.cjs writes/reads a TTL cache at ~/.claude/qgsd-provider-cache.json (5min DOWN, 3min UP); pre-flight uses cache when fresh"
  artifacts:
    - path: "bin/providers.json"
      provides: "Per-slot quorum_timeout_ms values"
      contains: "quorum_timeout_ms"
    - path: "bin/check-provider-health.cjs"
      provides: "TTL cache read/write for provider health results"
      contains: "qgsd-provider-cache.json"
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "min_quorum_size guard + UNAVAIL pre-skip + per-slot timeout"
      contains: "min_quorum_size"
    - path: "commands/qgsd/quorum.md"
      provides: "Same min_quorum_size guard in inline fallback path"
      contains: "min_quorum_size"
  key_links:
    - from: "bin/check-provider-health.cjs"
      to: "~/.claude/qgsd-provider-cache.json"
      via: "fs.writeFileSync on probe completion, fs.readFileSync on cache hit"
      pattern: "qgsd-provider-cache"
    - from: "agents/qgsd-quorum-orchestrator.md Step 1"
      to: "check-provider-health.cjs --json"
      via: "bash call; result drives UNAVAIL skip list and min_quorum guard"
      pattern: "min_quorum_size"
---

<objective>
Harden the QGSD quorum system with four immediate improvements identified by 10-model deliberation:

1. Fix #9 — min_quorum_size guard: block quorum verdict if fewer than 3 models available (configurable in qgsd.json; --force-quorum bypasses).
2. Fix #4 — Per-slot quorum_timeout_ms in providers.json: tuned values replace hardcoded 30s default.
3. Fix #5 — Auto-skip UNAVAIL slots pre-flight before any MCP call; log each skip; reorder healthy first.
4. Fix #3 — Provider health TTL cache in check-provider-health.cjs: 5min DOWN / 3min UP; pre-flight uses cache when fresh.

Purpose: Prevent silent quorum degradation (too few models), reduce timeout waste (skip dead slots immediately, use cached health), and make timeout tuning per-slot rather than global.
Output: Updated bin/providers.json, bin/check-provider-health.cjs, agents/qgsd-quorum-orchestrator.md, commands/qgsd/quorum.md; installed to ~/.claude/qgsd-bin/ via install sync.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/bin/providers.json
@/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs
@/Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
@/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add per-slot quorum_timeout_ms to providers.json (Fix #4)</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/providers.json</files>
  <action>
Add a `quorum_timeout_ms` field to every entry in the `providers` array in `bin/providers.json`.

The quorum consensus prescribed these tuned values (based on observed provider latency):
- Subprocess providers (codex-1, codex-2, gemini-1, gemini-2, opencode-1, copilot-1): `quorum_timeout_ms: 30000`
- claude-1 (DeepSeek AkashML): `quorum_timeout_ms: 20000`
- claude-2 (MiniMax AkashML): `quorum_timeout_ms: 20000`
- claude-3 (Qwen Together): `quorum_timeout_ms: 30000`
- claude-4 (Kimi Fireworks): `quorum_timeout_ms: 30000`
- claude-5 (Llama4 Together): `quorum_timeout_ms: 10000` (fast model, strict timeout)
- claude-6 (GLM-5 Fireworks): `quorum_timeout_ms: 8000` (fast model, strict timeout)

The existing `timeout_ms` field (subprocess exec timeout) is SEPARATE from `quorum_timeout_ms` (MCP call timeout guard). Do NOT remove or change `timeout_ms`. Add `quorum_timeout_ms` as a new sibling field.
  </action>
  <verify>
Run: `node -e "const p = require('./bin/providers.json'); p.providers.forEach(s => { if (!s.quorum_timeout_ms) throw new Error('Missing quorum_timeout_ms on ' + s.name); }); console.log('OK');"` from `/Users/jonathanborduas/code/QGSD/`

Expected: prints `OK`.
  </verify>
  <done>Every entry in providers.json has a `quorum_timeout_ms` field with a tuned value. No existing field is removed.</done>
</task>

<task type="auto">
  <name>Task 2: Add TTL cache to check-provider-health.cjs (Fix #3)</name>
  <files>/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs</files>
  <action>
Add a TTL cache layer to `bin/check-provider-health.cjs`. The cache file lives at `~/.claude/qgsd-provider-cache.json`.

Cache schema:
```json
{
  "entries": {
    "<baseUrl>": {
      "healthy": true,
      "statusCode": 200,
      "latencyMs": 150,
      "cachedAt": 1740000000000
    }
  }
}
```

TTL rules:
- DOWN entries (healthy: false): TTL = 5 minutes (300000ms)
- UP entries (healthy: true): TTL = 3 minutes (180000ms)

Logic to add:

1. At startup, load the cache file (fail-open: if missing or corrupt, start with empty cache).

2. Before calling `probeUrl(baseUrl, apiKey)`, check if `cache.entries[baseUrl]` exists and is fresh:
   - Fresh = `Date.now() - entry.cachedAt < TTL`
   - If fresh: skip the HTTP probe, use cached result. Log to stderr (or skip logging if `--json` mode to avoid polluting JSON output): `[cache] <providerName> = UP/DOWN (cached, expires in Ns)`
   - If stale or missing: run the probe as normal.

3. After a probe completes, write the result into `cache.entries[baseUrl]` with `cachedAt: Date.now()`. Write the full cache back to `~/.claude/qgsd-provider-cache.json` atomically (write to temp file then rename, or just writeFileSync — either is fine for this use case).

4. Add a `--no-cache` flag: if present, skip cache reads entirely (always probe). Still write fresh results to cache.

5. Add a `--cache-status` flag: print the cache file contents and exit (for debugging).

Do NOT change the existing HTTP probe logic, JSON output format, or human-readable display format. Cache hits must produce identical JSON structure to probe results so callers cannot distinguish.

Note: The cache directory `~/.claude/` is guaranteed to exist (qgsd.json already lives there). No need to mkdir.
  </action>
  <verify>
Run these sequential checks from `/Users/jonathanborduas/code/QGSD/`:

1. `node bin/check-provider-health.cjs --json --no-cache 2>/dev/null | node -e "const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); if (!Array.isArray(d)) throw new Error('not array'); console.log('JSON OK, entries:', d.length);"` — verifies JSON output still valid.

2. `ls ~/.claude/qgsd-provider-cache.json && echo "cache file created"` — verifies cache was written.

3. `node bin/check-provider-health.cjs --cache-status` — verifies --cache-status flag works and prints entries.
  </verify>
  <done>check-provider-health.cjs reads/writes ~/.claude/qgsd-provider-cache.json with TTL (5min DOWN, 3min UP). --no-cache bypasses reads. JSON output format unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: Add min_quorum_size guard + UNAVAIL pre-skip to orchestrator and quorum.md; install sync (Fix #9, #5)</name>
  <files>
    /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md
    /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md
  </files>
  <action>
Make three targeted edits across two files, then run install sync.

--- EDIT A: agents/qgsd-quorum-orchestrator.md ---

In Step 1 (Provider pre-flight), after building `$CLAUDE_MCP_SERVERS`, add two new blocks:

**Block 1 — Pre-flight UNAVAIL skip with logging** (add after the "$CLAUDE_MCP_SERVERS" building paragraph, before the "$QUORUM_ACTIVE" section):

```
**Pre-flight slot skip:** After building `$CLAUDE_MCP_SERVERS`, immediately filter the list for the quorum run:
- For each server with `available: false`, log: `Pre-flight skip: <serverName> (<providerName> DOWN)`
- Remove these servers from the working list for all subsequent steps (team capture, Round 1, deliberation).
- Reorder the remaining working list: healthy servers first (preserving discovery order within each group).
- Log the final working list as: `Active slots: <slot1>, <slot2>, ...`
```

**Block 2 — min_quorum_size guard** (add after the pre-flight skip block, before the display line):

```
**min_quorum_size check:** Read `min_quorum_size` from `~/.claude/qgsd.json` (project config takes precedence; default: 3 if absent):
```bash
node -e "
const fs = require('fs'), os = require('os'), path = require('path');
const globalCfg = path.join(os.homedir(), '.claude', 'qgsd.json');
const projCfg   = path.join(process.cwd(), '.claude', 'qgsd.json');
let cfg = {};
for (const f of [globalCfg, projCfg]) {
  try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch(_){}
}
console.log(cfg.min_quorum_size ?? 3);
"
```
Count available slots (those not marked UNAVAIL and passing $QUORUM_ACTIVE filter). Include Claude itself as +1.
If `availableCount < min_quorum_size`:
  - If $ARGUMENTS contains `--force-quorum`: log warning `[WARN] Quorum below min_quorum_size (N available, min M) — proceeding due to --force-quorum` and continue.
  - Otherwise: stop with:
    ```
    QUORUM BLOCKED: Only N model(s) available (min_quorum_size = M).
    Available: [list slots]
    UNAVAIL:   [list skipped slots with reason]
    Re-run with --force-quorum to override, or wait for providers to recover.
    ```
```

**Block 3 — Per-slot timeout reading:** In Step 2 (Team identity capture), update the "Timeout guard" sentence to:
```
**Timeout guard:** Each `mcp__unified-1__<slotName>` call must complete within the slot's `quorum_timeout_ms` value from `providers.json` (fallback: 30000ms if field absent). Read the full providers.json once at the start of Step 2 and build a lookup map `$SLOT_TIMEOUTS: { slotName: quorum_timeout_ms }`. Apply the slot's timeout to every subsequent call to that slot (Steps 2, Mode A, Mode B, deliberation).
```

Also update the hardcoded "30 seconds" references in Mode A and Mode B deliberation timeout guard paragraphs to read: "the slot's `quorum_timeout_ms` from `$SLOT_TIMEOUTS` (fallback: 30000ms)".

--- EDIT B: commands/qgsd/quorum.md ---

In the "Provider pre-flight (run once before team capture)" section, after the block that builds `$CLAUDE_MCP_SERVERS`, add the same two blocks:

**Block 1 — Pre-flight UNAVAIL skip with logging** (identical wording as Edit A Block 1).

**Block 2 — min_quorum_size guard** (identical wording as Edit A Block 2, including the bash inline read).

In the "Team identity capture" section, update the timeout guard sentence for claude-mcp-server instances to use per-slot `quorum_timeout_ms` from providers.json (fallback 30s), same as Edit A Block 3.

--- INSTALL SYNC ---

After editing both files, run:
```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

This copies the updated agents/ and commands/ into ~/.claude/qgsd/ and ~/.claude/qgsd-bin/. Confirm the command exits 0.
  </action>
  <verify>
Run each check separately:

1. `grep -c "min_quorum_size" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must return >= 2.

2. `grep -c "min_quorum_size" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return >= 2.

3. `grep -c "Pre-flight skip" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must return >= 1.

4. `grep -c "quorum_timeout_ms" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must return >= 1.

5. `grep -c "force-quorum" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — must return >= 1.

6. Confirm install sync ran (exit 0 from `node bin/install.js --claude --global`).
  </verify>
  <done>
- qgsd-quorum-orchestrator.md: min_quorum_size guard blocks quorum if available count below threshold, --force-quorum bypasses; UNAVAIL slots pre-skipped with log lines; per-slot quorum_timeout_ms replaces hardcoded 30s.
- quorum.md: same min_quorum_size guard and pre-skip logic in inline fallback path.
- Install sync completed: installed copies in ~/.claude/qgsd/ match source.
  </done>
</task>

</tasks>

<verification>
After all tasks complete:

1. `node -e "const p = require('./bin/providers.json'); p.providers.forEach(s => { if (!s.quorum_timeout_ms) throw new Error('Missing on ' + s.name); }); console.log('providers.json OK');"` — all slots have quorum_timeout_ms.

2. `node bin/check-provider-health.cjs --cache-status` — cache file exists and is readable.

3. `grep "min_quorum_size" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — both files contain the guard.

4. `grep "Pre-flight skip" /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md` — UNAVAIL skip log exists.

5. `ls /Users/jonathanborduas/.claude/qgsd/` — installed copy updated (check mtime is recent).
</verification>

<success_criteria>
- providers.json: every slot has `quorum_timeout_ms` with quorum-consensus-tuned value.
- check-provider-health.cjs: TTL cache at ~/.claude/qgsd-provider-cache.json is written after probe; --no-cache and --cache-status flags work; JSON output format unchanged.
- qgsd-quorum-orchestrator.md: UNAVAIL slots are pre-skipped with log lines; min_quorum_size check blocks quorum below threshold (--force-quorum bypasses); per-slot quorum_timeout_ms read from providers.json replaces hardcoded 30s.
- quorum.md inline fallback: same min_quorum_size guard and pre-skip logic present.
- Install sync ran successfully.
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/78-improve-the-qgsd-quorum-system-harden-fa/78-SUMMARY.md`
</output>
