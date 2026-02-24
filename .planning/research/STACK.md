# Stack Research

**Domain:** Node.js CLI tool — agent roster management UI additions (v0.10 Roster Toolkit)
**Researched:** 2026-02-24
**Confidence:** HIGH

## Context: What Already Exists (Do NOT Re-Research)

The following capabilities are validated and out of scope for this research:

- `inquirer@8.2.7` (CommonJS, confirmed installed — `type: "commonjs"` in package, `new inquirer.Separator()` API works as-is)
- `keytar@7.9.0` with `qgsd-key-index.json` sidecar — secrets storage
- `node:child_process` `spawnSync` — CLI updates
- `node:test` suite — pure function testing

**Confirmed installed inquirer version: 8.2.7.** All new code must stay CJS (`require()`-only).
Inquirer v9 is ESM-only — upgrading would break every existing `require('inquirer')` call.
No ESM migration is in scope for v0.10.

---

## Feature 1: Live Auto-Refreshing Terminal Status Dashboard

### Decision: Pure `node:readline` — zero new dependencies

**Rationale:** Node.js `readline` module (stdlib, no install) exposes `readline.cursorTo()`,
`readline.moveCursor()`, `readline.clearLine()`, and `readline.clearScreenDown()` for in-place
terminal redraws. Combined with `setInterval()`, this gives a live-refresh dashboard with no deps.
Verified present in Node.js v25.6.1 (the runtime in this environment).

**Why not `log-update`:** `log-update` (sindresorhus) went ESM-only starting at v4.
It cannot be `require()`'d from CJS. Pinning to v3 would add a dep for functionality stdlib already
provides. Confirmed ESM-only from v4+ via GitHub issue #54 and sindresorhus's ESM migration gist.

**Why not `ansi-escapes`:** Went ESM-only at v5.0.0 (released April 2020). Last CJS version was
4.3.2 — a 5-year-old pinned release is not an acceptable dep. `readline` covers all needed cursor
ops. The only ANSI sequences NOT in readline are hide/show cursor (`\x1b[?25l` / `\x1b[?25h`),
which are safe to inline as 4-byte literal strings.

**Why not `blessed` or `ink`:** Both take full stdin ownership, which conflicts with inquirer's
stdin takeover when the user returns from the dashboard to the main menu. Multiple Inquirer.js
GitHub issues document that concurrent stdin raw mode management causes raw mode conflicts, silent
character swallowing, and prompt hangs. The dashboard must fully release stdin before handing
control back to `inquirer.prompt()`.

**Implementation pattern (no external deps):**

```javascript
const readline = require('readline');

const REFRESH_MS = 5000; // 5s default — fast enough to feel live, slow enough for no flicker

async function liveDashboard(fetchRows) {
  // Hide cursor
  process.stdout.write('\x1b[?25l');
  readline.cursorTo(process.stdout, 0, 0);
  readline.clearScreenDown(process.stdout);

  const render = () => {
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    const rows = fetchRows(); // synchronous or cached async result
    for (const row of rows) process.stdout.write(row + '\n');
    process.stdout.write('\n  [any key to return to menu]\n');
  };

  render();
  const timer = setInterval(render, REFRESH_MS);

  await new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.once('keypress', () => {
      clearInterval(timer);
      process.stdin.setRawMode(false);
      process.stdin.removeAllListeners('keypress');
      process.stdout.write('\x1b[?25h'); // restore cursor
      resolve();
    });
  });
  // Control returns here — inquirer.prompt() will re-acquire stdin cleanly
}
```

**Inquirer compatibility note:** The dashboard MUST call `process.stdin.setRawMode(false)` and
remove all keypress listeners before returning. Inquirer v8 sets raw mode internally on each
prompt call; leaving it set causes input to swallow characters silently. The `once` listener
pattern plus explicit `removeAllListeners` is the safe teardown sequence.

### Recommended Stack — Feature 1

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:readline` | Node.js stdlib | Cursor movement, line clearing, emitKeypressEvents | Built-in; all needed methods present; zero CJS/ESM issues |
| `setInterval` / `clearInterval` | Node.js stdlib | Periodic refresh loop | Standard timer; no external dep |
| Raw ANSI strings `\x1b[?25l` / `\x1b[?25h` | N/A | Hide/show cursor | Only 2 sequences not in readline; inline as literals |

---

## Feature 2: JSON Import/Export of Agent Roster Config

### Decision: Pure `node:fs` + `JSON.parse` / `JSON.stringify` — zero new dependencies

The existing codebase already uses `fs.readFileSync` + `JSON.parse` + `writeFileSync` with
tmp-file atomic write (`renameSync`) for `~/.claude.json` and `providers.json`. The same pattern
applies directly to import/export. No schema validation library is needed.

**Export sources:** Two structures must be combined into a single portable file:
- `mcpServers` entries from `~/.claude.json`
- Matching provider entries from `providers.json`

**Import targets:** Read the portable file, validate the version sentinel, merge or replace
existing entries, write atomically to both files.

**API keys are NOT exported.** Keys live in keytar (OS keychain), which is machine-local.
The export file documents the config shape; the user re-enters keys on the target machine via
"Edit agent". Exporting keytar values would require the keytar native addon and matching
OS keychain access on the target machine — cannot be assumed. This is the correct security posture.

**Portable file format:**

```json
{
  "qgsd_roster_version": 1,
  "exported_at": "2026-02-24T00:00:00Z",
  "mcpServers": {},
  "providers": []
}
```

**Schema validation:** Simple inline `typeof` + field-presence checks are sufficient. `ajv` or
`zod` are overkill for a flat JSON shape with 8-10 known fields. Adding a validation library
for a one-time import path violates the zero-dep philosophy.

**Collision handling in import:** When a slot name in the import file already exists in
`~/.claude.json`, prompt with inquirer `list`: "Skip / Overwrite / Rename incoming". This uses
the existing inquirer flow — no new library needed.

### Recommended Stack — Feature 2

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `node:fs` | Node.js stdlib | Read/write export file | Already used for ~/.claude.json; identical pattern |
| `JSON.stringify(data, null, 2)` | Node.js stdlib | Human-readable export | Matches existing codebase style (all existing JSON writes use 2-space indent) |
| `fs.renameSync` (tmp → target) | Node.js stdlib | Atomic write on import | Already used in `writeClaudeJson()` and `writeProvidersJson()` |
| `inquirer` list prompt | 8.2.7 (existing) | Collision resolution UI | Already in use; single new prompt for import collision |

---

## Feature 3: API Key Expiry Detection via 401 Responses

### Decision: Extend existing `probeProviderUrl()` — zero new dependencies

`probeProviderUrl()` (lines 88–133 of `bin/manage-agents.cjs`) already returns
`{ healthy, latencyMs, statusCode, error }`. The `statusCode` field is already there.
Key expiry detection is a **pure logic change**, not a library addition.

**Current behaviour:**

```javascript
// Line 119 — current:
const healthy = [200, 401, 403, 404, 422].includes(res.statusCode);
```

All of these status codes are treated as "provider reachable". This is correct for connectivity
checks but loses the 401 signal needed for key expiry detection.

**New behaviour needed:** A call site that reads `probe.statusCode === 401` separately from the
`probe.healthy` boolean. The existing probe already sends `Authorization: Bearer <key>`, so a
401 from `/models` definitively means the key is rejected by that provider.

**Key expiry state storage:** Persist `key_status` per slot in `qgsd.json` under
`agent_config[slot].key_status`. Values: `"ok"` | `"invalid"` | `"unknown"`.
The manage-agents list view reads this field and renders a `[key invalid]` badge in ANSI red
next to the slot. No new file, no new database — piggybacks the existing `agent_config` structure
already read by `listAgents()` and `editAgent()`.

**Probe trigger points (opportunistic, not polling):**
1. Manual — user selects "Check agent health" in the menu (already exists; extend output to show key status).
2. Passive — during live dashboard refresh loop, 401 from any slot updates `key_status` in qgsd.json.

**No polling daemon, no file watcher, no background process.** 401 detection is opportunistic: it
runs whenever the user opens the health check or dashboard. This matches the fail-open design
philosophy of the broader QGSD project.

**Edge cases:**
- Empty or missing key → set `key_status: "unknown"` (cannot distinguish from "valid key not
  yet tested"). Do not set `"invalid"` when the key field is empty.
- 401 with non-empty key → set `key_status: "invalid"`.
- 200 → set `key_status: "ok"` (clear any prior invalid flag).
- Network error / timeout → leave `key_status` unchanged (don't clobber valid status with a
  transient connectivity failure).

### Recommended Stack — Feature 3

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `probeProviderUrl()` (existing) | — | HTTP probe returning statusCode | Already implemented; read `probe.statusCode` at call site |
| `qgsd.json` `agent_config[slot].key_status` | — | Persist expiry state per slot | Existing config structure; no new file or schema |
| `node:fs` (existing) | stdlib | Read/write qgsd.json for status update | Already used throughout codebase |

---

## Feature 4: Provider Preset Library (Curated Name → URL Map)

### Decision: Static `bin/provider-presets.json` — zero new dependencies

A provider preset library is a curated mapping of human-readable provider names to base URLs,
recommended models, and metadata. It is a **data file**, not a runtime library. No library is
needed to implement it.

**Shipping mechanism:** `bin/provider-presets.json` alongside the existing `bin/providers.json`.
Include in `package.json` `"files"` array (already covers `"bin"`). Read-only at runtime — users
select from presets but cannot edit the preset list directly.

**Preset schema:**

```json
{
  "presets": [
    {
      "name": "AkashML",
      "base_url": "https://api.akashml.com/v1",
      "notes": "Multiple open-source models; free tier available",
      "featured_models": ["deepseek-ai/DeepSeek-V3.2", "MiniMaxAI/MiniMax-M2.5"],
      "auth": "api_key"
    },
    {
      "name": "Together.xyz",
      "base_url": "https://api.together.xyz/v1",
      "notes": "Large open-source model catalog; /v1/models endpoint available",
      "featured_models": ["Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8"],
      "auth": "api_key"
    },
    {
      "name": "Fireworks",
      "base_url": "https://api.fireworks.ai/inference/v1",
      "notes": "Fast inference; serverless function format",
      "featured_models": ["accounts/fireworks/models/kimi-k2p5"],
      "auth": "api_key"
    },
    {
      "name": "Custom",
      "base_url": "",
      "notes": "Enter a custom base URL",
      "featured_models": [],
      "auth": "api_key"
    }
  ]
}
```

**Integration with Add Agent flow:** In `addAgent()`, before the current manual URL prompt,
add a new inquirer `list` prompt that shows preset names. Selecting a preset pre-fills
`ANTHROPIC_BASE_URL` and sets `featured_models` as a `list` prompt for `CLAUDE_DEFAULT_MODEL`.
The "Custom" sentinel skips to the existing manual input prompt unchanged.

**Why not a remote-fetched preset list:** Network dependency in a management CLI is a worse UX
issue than a slightly stale preset URL. Presets ship with the package. User can always override
any pre-filled field. Freshness can be addressed in a future version (v0.11 feature flag).

**Loading in CJS:** `require('./provider-presets.json')` works natively in CommonJS Node.js
for JSON files. No `fs.readFileSync` needed for the preset file specifically.

### Recommended Stack — Feature 4

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `bin/provider-presets.json` (new static file) | — | Curated preset data | Data-only; zero runtime library needed |
| `require('./provider-presets.json')` | Node.js CJS | Load preset file | Native JSON require in CJS; no fs.readFileSync needed |
| `inquirer` list prompt | 8.2.7 (existing) | Preset selector UI | Single new prompt step before existing URL input |

---

## Net New Dependencies: 0

All four features are implementable with Node.js stdlib and extensions to existing code.
No new packages are added to `package.json`.

| Technology | Version | New? | Feature |
|------------|---------|------|---------|
| `node:readline` cursor methods | stdlib | No (stdlib) | Live dashboard |
| `setInterval` / `clearInterval` | stdlib | No (stdlib) | Live dashboard |
| Raw ANSI hide/show cursor | N/A | No | Live dashboard |
| `node:fs` read/write/rename | stdlib | No (already used) | Import/export |
| `JSON.stringify` / `JSON.parse` | stdlib | No (already used) | Import/export |
| `probeProviderUrl()` extension | — | No (existing function) | 401 key expiry |
| `qgsd.json` `key_status` field | — | No (existing config file) | 401 key expiry |
| `bin/provider-presets.json` | — | Yes (data file, no npm dep) | Provider presets |
| `require('./provider-presets.json')` | CJS | No (native CJS JSON require) | Provider presets |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `log-update@4+` | ESM-only from v4; `require()` throws `ERR_REQUIRE_ESM` | `node:readline` cursor control |
| `log-update@3` (pinned) | Last CJS version; adds dep for stdlib-covered functionality | `node:readline` |
| `ansi-escapes@5+` | ESM-only from v5.0.0 (April 2020) | `node:readline` + inline `\x1b` strings |
| `ansi-escapes@4.3.2` (pinned) | 5-year-old release pin; adds dep for 2 escape sequences | Inline `\x1b[?25l` / `\x1b[?25h` as string literals |
| `blessed` / `neo-blessed` | Takes full stdin ownership; confirmed conflict with inquirer raw mode | `node:readline` in-place rewrite pattern |
| `ink` (React terminal) | ESM + JSX; completely incompatible with CJS codebase | `node:readline` |
| `inquirer@^9` | ESM-only; breaks all existing `require('inquirer')` calls | Stay on `8.2.7` — no upgrade path without full ESM migration |
| `ajv` / `zod` for import validation | Overkill for flat JSON with 8-10 known fields | Inline `typeof` + field presence checks |
| Background polling process for 401 detection | Adds complexity; daemon requires process management | Opportunistic probe on user action (health check / dashboard) |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `node:readline` for dashboard | `log-update@3` (last CJS) | Only if codebase migrates fully to ESM and wants cleaner log-update API |
| Static `provider-presets.json` | Remote-fetched preset list | If preset freshness becomes user pain point — add as v0.11 opt-in with `--refresh-presets` flag |
| Opportunistic 401 detection | LLM health_check call (deep probe) | If shallow HTTP /models probe produces too many false positives; make deep check opt-in, not default |
| `agent_config[slot].key_status` in `qgsd.json` | Separate `key-status.json` file | Never — one more config file adds reader complexity with no benefit |
| Inline collision handling in import | Separate "dry run" import mode | Add as `--dry-run` flag on the import subcommand in a later phase |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `inquirer@8.2.7` | Node.js >=12 (CJS) | Confirmed installed; `new inquirer.Separator()` API works as-is |
| `keytar@7.9.0` | Node.js >=10; macOS Keychain, libsecret on Linux | Confirmed installed; no change needed for any v0.10 feature |
| `node:readline` cursor methods | Node.js >=0.7.7 | `cursorTo`, `moveCursor`, `clearLine`, `clearScreenDown`, `emitKeypressEvents` all verified present in Node v25.6.1 |
| `node:readline` `emitKeypressEvents` | Node.js >=0.7.7 | Required for keypress exit from dashboard; verified present |
| CJS `require('./file.json')` | All Node.js versions | Native JSON require in CJS; works without `fs.readFileSync` |

---

## Stack Patterns by Feature

**If building the live dashboard:**
- Implement as a self-contained async function; caller is `mainMenu()` `try` block (already wraps async calls)
- Use `readline.cursorTo(process.stdout, 0, 0)` + `readline.clearScreenDown(process.stdout)` for full-screen rewrite on each tick
- Default refresh interval: 5000ms (5s) — fast enough to feel live, slow enough to avoid flicker
- Exit key: `process.stdin.once('keypress', ...)` with `setRawMode(false)` teardown before returning
- TTY guard: check `process.stdout.isTTY` before entering dashboard mode; fall back to a static one-time print if not a TTY

**If building import/export:**
- Export: `JSON.stringify({ qgsd_roster_version: 1, exported_at: new Date().toISOString(), mcpServers, providers }, null, 2)`
- Strip secrets: delete any `ANTHROPIC_API_KEY` env fields before stringifying; document in export file header comment
- Import: read file → check `qgsd_roster_version === 1` → iterate slots → inquirer collision prompt → `writeClaudeJson()` + `writeProvidersJson()` (existing atomic writers)

**If adding provider presets:**
- Load: `const { presets } = require('./provider-presets.json');`
- Display: inquirer `list` prompt with preset names + `notes` in choice labels; `Custom` is last choice
- Pre-fill: set `ANTHROPIC_BASE_URL = preset.base_url`; if `featured_models.length > 0`, offer them as a `list` for model selection

**If adding 401 key expiry detection:**
- Call `probeProviderUrl(baseUrl, apiKey)` → read `result.statusCode`
- `statusCode === 401 && apiKey` → write `agent_config[slot].key_status = "invalid"` to `qgsd.json`
- `statusCode === 200` → write `agent_config[slot].key_status = "ok"`
- Network error / timeout → leave `key_status` unchanged
- Display in `listAgents()`: read `agent_config[slot].key_status`; render `\x1b[31m[key invalid]\x1b[0m` if `"invalid"`

---

## Sources

- Node.js readline official docs (https://nodejs.org/api/readline.html) — `cursorTo`, `moveCursor`, `clearLine`, `clearScreenDown`, `emitKeypressEvents` all confirmed present. Confidence: HIGH.
- `node -e` runtime verification against Node v25.6.1 — confirmed all four readline cursor methods are `function` type. Confidence: HIGH (direct runtime check).
- GitHub sindresorhus/log-update issue #54 (https://github.com/sindresorhus/log-update/issues/54) — confirmed ESM-only from v4, `require()` throws `ERR_REQUIRE_ESM`. Confidence: HIGH.
- GitHub sindresorhus/ansi-escapes releases (https://github.com/sindresorhus/ansi-escapes/releases) — confirmed ESM-only from v5.0.0 (April 2020); v4.3.2 last CJS. Confidence: HIGH.
- GitHub SBoudrias/Inquirer.js discussion #1126 (https://github.com/SBoudrias/Inquirer.js/discussions/1126) — confirmed v9 is ESM-only, v8 is CJS. Confidence: HIGH.
- `node_modules/inquirer/package.json` direct read — confirmed installed version is `8.2.7`, `type: "commonjs"`. Confidence: HIGH (first-party).
- `bin/manage-agents.cjs` lines 88–133 direct read — confirmed `probeProviderUrl` already returns `{ healthy, latencyMs, statusCode, error }`; `statusCode` is in the return value. Confidence: HIGH (first-party).
- `bin/manage-agents.cjs` lines 196–219 direct read — confirmed `agent_config` structure already read from `qgsd.json` in `listAgents()`. Confidence: HIGH (first-party).
- Multiple Inquirer.js GitHub issues (#495, #1358, #811, #870) — confirmed stdin raw mode conflicts when TUI libraries run alongside inquirer; `setRawMode` must be explicitly released. Confidence: MEDIUM.
- `bin/providers.json` direct read — confirmed existing provider data structure; `provider-presets.json` schema designed to complement it. Confidence: HIGH (first-party).

---
*Stack research for: QGSD v0.10 Roster Toolkit — new feature additions to bin/manage-agents.cjs*
*Researched: 2026-02-24*
