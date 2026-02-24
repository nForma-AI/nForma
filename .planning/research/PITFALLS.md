# Pitfalls Research

**Domain:** Extending an existing Node.js CJS inquirer-based CLI with 10 roster management features (v0.10 Roster Toolkit)
**Researched:** 2026-02-24
**Confidence:** HIGH — based on direct inspection of `bin/manage-agents.cjs`, `bin/secrets.cjs`, `bin/unified-mcp-server.mjs`, `bin/update-agents.cjs`, `~/.claude-code-router/config.json`, and existing key/timeout/scoreboard plumbing

---

## Critical Pitfalls

### Pitfall 1: Live Health Dashboard — setInterval Corrupts inquirer stdin Ownership

**What goes wrong:**
A `setInterval`-based redraw loop calls `process.stdout.write()` or `console.log()` while inquirer holds an active readline instance. inquirer@8 (actual installed version — `package.json` says `^8.2.7`, confirmed at 8.2.7) uses `readline.createInterface` on `process.stdin`. Any concurrent write to stdout mid-prompt tears the display: partial ANSI escape sequences, duplicated prompt lines, or the terminal dropping into a corrupted state requiring `reset`.

**Why it happens:**
inquirer owns stdin's raw mode during a prompt. It paints its own cursor-control sequences. A parallel timer writing `\x1b[H\x1b[J` (clear-screen) races with inquirer's own writes, causing sequence interleaving. Developers reach for `setInterval` assuming stdout is a simple stream — it is not while inquirer is active.

**How to avoid:**
Two safe patterns for this codebase:

Pattern A (simplest, fits existing mainMenu loop — recommended):
```javascript
async function liveHealthDashboard() {
  // 1. Run all health probes in parallel (Promise.all with shared 5s timeout)
  // 2. Print static table with "Last updated: HH:MM:SS" footer
  // 3. Prompt: "Press Enter to refresh, q to exit"
  // No setInterval — user triggers refresh explicitly
}
```

Pattern B (full-screen TUI): Exit inquirer entirely before starting any refresh loop. Never call `inquirer.prompt()` while a timer has write access to stdout. The invariant is: inquirer.prompt() must never be active while setInterval or setTimeout writes to stdout.

**Warning signs:**
- Terminal displays garbled ANSI after "refreshing" the health view
- Backspace on inquirer prompts shows double characters
- `process.stdout.write` calls appear in stack traces alongside inquirer internals

**Phase to address:**
Live health dashboard phase. Enforce as a pre-condition: assert no active inquirer readline before starting any timed refresh.

---

### Pitfall 2: Export Leaking API Keys from keytar Fallback Path

**What goes wrong:**
The import/export feature serializes slot configs. `addAgent()` (manage-agents.cjs lines 397–399) has a keytar-unavailable fallback that writes `ANTHROPIC_API_KEY` directly into the `env` block inside `~/.claude.json`. If export walks `mcpServers[slot].env` verbatim, it includes plaintext API keys for any slot where keytar was unavailable during setup.

A second vector: `syncToClaudeJson()` in secrets.cjs (lines 117–127) deliberately patches `env[envKey]` with live keytar values for env keys that appear in the block. Any export that reads `~/.claude.json` after a sync call will find live API key values in plaintext JSON.

**Why it happens:**
Export author focuses on the happy path (keytar stores keys, env block is clean) and misses the fallback path. The fallback is hard to trigger manually, so it goes untested.

**How to avoid:**
The export serializer must strip all credential-bearing env keys unconditionally:

```javascript
const CREDENTIAL_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'AKASHML_API_KEY',
  'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY',
];

function sanitizeEnvForExport(env) {
  const safe = Object.assign({}, env);
  for (const k of CREDENTIAL_ENV_KEYS) delete safe[k];
  // Defense-in-depth: strip any key with credential-like suffix
  for (const k of Object.keys(safe)) {
    if (/_KEY$|_SECRET$|_TOKEN$|_PASSWORD$/i.test(k)) delete safe[k];
  }
  return safe;
}
```

Never call `syncToClaudeJson()` before reading for export. Read raw from disk without the sync step.

**Warning signs:**
- `grep -i "api_key" <exported_file>` returns non-empty results
- Exported file contains `ANTHROPIC_API_KEY` at any nesting level

**Phase to address:**
Import/export phase. The sanitizer must be written before the serializer. A test must assert that a round-trip export of a slot with a keytar-fallback plaintext key produces a file with zero credential keys.

---

### Pitfall 3: Batch Key Rotation — keytar Concurrency Errors and Index Race

**What goes wrong:**
Calling `secretsLib.set()` concurrently via `Promise.all` for multiple slots triggers macOS Security framework calls to the same keychain service (`qgsd`). macOS keychain allows concurrent reads but serializes writes with an internal lock. Under concurrent `setPassword` calls, some calls receive `OSStatus error -25293` and silently fail because `set()` has no retry logic.

The index file race is a second failure mode. `writeIndex()` in secrets.cjs (lines 18–21) is a synchronous file write. Two concurrent `set()` calls execute: `readIndex()` → `idx.add()` → `writeIndex()`. If both `readIndex()` calls return the same pre-write state, the second write clobbers the first, dropping one key from the index even though it was stored in keychain.

**Why it happens:**
Batch rotation naturally reaches for `Promise.all` to speed things up. The index race is a classic read-modify-write without any lock or queue.

**How to avoid:**
Implement batch rotation sequentially with explicit serial iteration:

```javascript
async function batchRotateKeys(slotKeyPairs) {
  const results = [];
  for (const { slot, key } of slotKeyPairs) {
    process.stdout.write(`  Rotating ${slot}...`);
    try {
      await secretsLib.set('qgsd', deriveKeytarAccount(slot), key);
      process.stdout.write(' done\n');
      results.push({ slot, status: 'ok' });
    } catch (err) {
      process.stdout.write(` FAILED: ${err.message}\n`);
      results.push({ slot, status: 'error', message: err.message });
    }
  }
  return results;
}
```

Never use `Promise.all` with keytar write operations. Print per-slot progress after each `await` so the user sees forward motion.

**Warning signs:**
- After batch rotation, `qgsd-key-index.json` is missing entries for some rotated slots
- macOS Keychain Access app shows partial updates
- Some slots still fail health checks after rotation despite "success" message

**Phase to address:**
Batch key rotation phase. Must include a test that verifies sequential execution order and that all entries appear in the index after a multi-slot rotation.

---

### Pitfall 4: CCR Config Mapping Fragility — Provider Name Mismatch

**What goes wrong:**
`ccr-secure-config.cjs` (line 69–73) maps keytar CCR keys to CCR `config.json` providers by lowercasing `provider.name` and checking it against a hardcoded map with keys `akashml`, `together`, `fireworks`. The live `~/.claude-code-router/config.json` (confirmed from direct read) uses those exact names — but:

1. CCR config is user-editable. Users rename providers (`akashml-v2`, `AkashML`, `akash`), breaking the match silently.
2. The CCR visibility feature must show which CCR provider each QGSD slot uses. The chain is: QGSD slot → `PROVIDER_SLOT` env var → `providers.json` entry → CCR config provider name. No validation exists at any step in this chain.
3. If a new provider is added to CCR config with a name not in `CCR_KEY_NAMES` (manage-agents.cjs lines 1295–1299), the key management UI will never surface it.

**How to avoid:**
Read `~/.claude-code-router/config.json` dynamically rather than hardcoding provider names:

```javascript
function readCcrProviders() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CCR_CONFIG_PATH, 'utf8'));
    return (cfg.providers || []).map(p => ({ name: p.name, displayName: p.name }));
  } catch (_) {
    return [];
  }
}
```

For key management: replace `CCR_KEY_NAMES` with a dynamic read. Derive the keytar account from the CCR provider name rather than maintaining a parallel hardcoded list. Show a warning when no keytar key exists for a CCR provider rather than silently skipping it.

**Warning signs:**
- CCR column in slot list shows `—` for all slots despite CCR being configured
- `ccr-secure-config.cjs` logs `Populated 0 provider key(s)` despite keys being stored
- Key management UI has fewer entries than CCR config has providers

**Phase to address:**
CCR routing visibility phase. Read CCR config dynamically. Never hardcode provider name lists.

---

### Pitfall 5: Import Schema Validation — Silent Partial Apply

**What goes wrong:**
Import reads a JSON file and applies slot configs. Missing fields create partial slots: a slot with `command` but no `env` renders as model `?`; a slot with `env.PROVIDER_SLOT` pointing to a non-existent local `providers.json` entry renders as model `—` in `listAgents()` (lines 253–279 confirm `providerMap[slot]` returns null = fallback path).

A second variant: imported file came from a different machine. The `args` array contains absolute paths (`/Users/other-user/.claude/qgsd-bin/unified-mcp-server.mjs`) that don't exist locally. The MCP entry is written, Claude Code tries to start it on reconnect, and the agent silently fails to launch.

**Why it happens:**
Import logic copies objects without checking if local environment satisfies the slot's dependencies. The problem is invisible until the user tries to use the imported slot.

**How to avoid:**
Validate before applying; report all errors before writing anything:

```javascript
function validateImportSlot(name, cfg, localProviders) {
  const errors = [];
  if (!cfg.command) errors.push('missing command');
  if (!cfg.env) errors.push('missing env block');
  const slot = cfg.env && cfg.env.PROVIDER_SLOT;
  if (slot && !localProviders.find(p => p.name === slot)) {
    errors.push(`PROVIDER_SLOT "${slot}" not in local providers.json`);
  }
  for (const arg of (cfg.args || [])) {
    if (/^\/Users\/|^\/home\//.test(String(arg))) {
      errors.push(`arg "${arg}" looks like a non-portable absolute path`);
    }
  }
  return errors;
}
```

Show all validation errors grouped by slot. Prompt: "3 slots have warnings — import anyway? Slots with errors will be skipped." Zero partial applies.

**Warning signs:**
- Newly imported slots show `—` in the Model column of listAgents
- `check agent health` on imported slot throws "No HTTP endpoint to probe" for a slot that should be MCP-based
- Claude Code shows agent connection errors after import + restart

**Phase to address:**
Import/export phase. Validation runs before any write. Test with a deliberately malformed import file.

---

### Pitfall 6: Health Dashboard Staleness — Missing Timestamp

**What goes wrong:**
The live health dashboard shows probe results but no "Last updated" timestamp. Users who leave the view open or re-open it after returning from another menu action cannot tell if data is 10 seconds old or 10 minutes old. Acting on stale health data causes misdiagnosis: routing work to a slot that went down after the last probe.

**Why it happens:**
Health display is built as a pure data table. The timestamp is an easy-to-forget metadata field that feels optional during development.

**How to avoid:**
Embed the timestamp as a non-optional footer line in the render function:

```javascript
const timestamp = new Date().toLocaleTimeString();
const ageMs = Date.now() - lastProbeAt;
const staleWarning = ageMs > 60000 ? ' \x1b[33m[data may be stale]\x1b[0m' : '';
console.log(`\n  Last updated: ${timestamp}${staleWarning}`);
```

If `lastProbeAt` is more than 60 seconds ago, show a yellow stale warning inline.

**Warning signs:**
- Health table has no timestamp row
- User reports acting on incorrect health status
- Dashboard re-renders without re-probing, showing old latency values

**Phase to address:**
Live health dashboard phase. Timestamp is a required element of the render output, not optional.

---

### Pitfall 7: Timeout Config Propagation — Running Server Ignores qgsd.json Changes

**What goes wrong:**
Per-agent timeout is configured via the manage-agents UI, which writes `quorum_timeout_ms` to `providers.json`. The `unified-mcp-server.mjs` (lines 22–27) reads `providers.json` once at startup into the `providers` variable. A running server instance never re-reads the file. The user sets a new timeout, the UI confirms the change, but the agent continues using the old timeout until Claude Code restarts the MCP connection.

This is not a bug in the current codebase — it is a correct architectural decision (server reads config at startup). The pitfall is that the UI must communicate this constraint and not imply the change is immediately active.

**Why it happens:**
Developers assume config changes take effect immediately without considering the server lifecycle. The UI says "Updated" with a green checkmark, which implies success including runtime propagation.

**How to avoid:**
After writing a timeout change, display:

```
  Updated "codex-1" quorum_timeout_ms to 20000ms
  Note: restart the MCP server to apply (Manage > restart, or Claude Code reconnect)
```

Optionally offer to call the `pkill -f unified-mcp-server` pattern from the same flow. Do not imply the change is live until the server has restarted.

**Warning signs:**
- User reports timeout still hitting old value after change
- UI shows "Updated" but agent times out at the old threshold during the next quorum call
- No restart prompt appears after timeout edit

**Phase to address:**
Per-agent timeout phase. The confirmation message must always include the restart note.

---

### Pitfall 8: Auto-Update Silent Failures — Background Installs with No Audit Trail

**What goes wrong:**
Auto-update policy runs `npm install -g <pkg>@latest` (via `spawnSync` in `runUpdate()`) in the background or on a schedule. If the install fails (npm registry timeout, permission error, breaking change in new version), the failure is swallowed: `runUpdate()` logs to console but in a background context there is no console visible to the user. The agent starts failing silently — not because of a key or provider issue, but because the CLI binary was updated to a broken version or the update failed mid-install.

**Why it happens:**
Developers model "automatic" as fire-and-forget. The existing `runUpdate()` already has minimal error reporting (line 272–276 in update-agents.cjs). In a scheduled/automatic context, that console output goes nowhere.

**How to avoid:**
Auto-update must write an audit log:

```javascript
const UPDATE_LOG = path.join(os.homedir(), '.claude', 'qgsd-update.log');

function logUpdateResult(name, status, detail) {
  const line = `${new Date().toISOString()} [${status}] ${name}: ${detail}\n`;
  try { fs.appendFileSync(UPDATE_LOG, line); } catch (_) {}
}
```

On the next `listAgents()` render, check if the log has any ERROR entries since last check and surface a banner: "1 auto-update failed — see ~/.claude/qgsd-update.log". Do not rely on console output from a background spawn.

**Warning signs:**
- Agent stops responding after auto-update policy runs
- `npm list -g <pkg>` shows an older version than expected
- No update log file exists at `~/.claude/qgsd-update.log`

**Phase to address:**
Auto-update policy phase. Audit log is a mandatory component, not optional.

---

### Pitfall 9: Scoreboard File Missing on Fresh Install — Crash Instead of Empty State

**What goes wrong:**
The scoreboard inline feature reads `.planning/quorum-scoreboard.json` to show win/loss stats per slot. This file is gitignored (confirmed in `.gitignore`) and is only created after the first quorum round completes. On a fresh install or in a new project directory, the file does not exist. Code that calls `JSON.parse(fs.readFileSync(...))` without an `existsSync` guard throws `ENOENT`, crashing `listAgents()`.

The existing `update-scoreboard.cjs` handles this by initializing an empty object when the file doesn't exist (lines 30–40 of that file). But new code reading the scoreboard for display may not follow the same pattern.

**Why it happens:**
Developer tests against their own machine where quorum has been run. The edge case (no scoreboard yet) is invisible during development.

**How to avoid:**
All scoreboard reads in manage-agents.cjs must use a safe reader:

```javascript
function readScoreboardSafe(path) {
  try {
    if (!fs.existsSync(path)) return { slots: {} };
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch (_) {
    return { slots: {} };
  }
}
```

The display code then gets `{}` for `slots` and renders `—` for all win/loss cells rather than crashing.

**Warning signs:**
- `listAgents()` throws `ENOENT` on first run in a new project directory
- Scoreboard column shows nothing (blank, not `—`) for a project that hasn't run quorum yet
- Error reported by user: "manage-agents crashes immediately after install"

**Phase to address:**
Scoreboard inline phase (first phase that reads the scoreboard from manage-agents). Must include a test with no scoreboard file present.

---

### Pitfall 10: inquirer@8 vs @9 ESM/CJS — Do Not Upgrade During This Milestone

**What goes wrong:**
The codebase uses inquirer `^8.2.7` (confirmed: actual version 8.2.7, CJS-compatible). inquirer@9 is ESM-only — it has no `main` field and cannot be `require()`'d from a CJS file. If any new dependency added during v0.10 pulls in inquirer@9 as a peer or if a developer upgrades inquirer to resolve an unrelated advisory, the entire `manage-agents.cjs` breaks at startup with `ERR_REQUIRE_ESM`.

The version constraint is `^8.2.7`, so `npm install` will not automatically upgrade to @9. But manual `npm install inquirer` without a version pin will install @9.

**Why it happens:**
ESM/CJS boundary is invisible until runtime. The error `require() of ES Module` only fires when the file is actually loaded, not at install time.

**How to avoid:**
Pin inquirer to `8.x` explicitly in `package.json`:
```json
"inquirer": "~8.2.7"
```
Using `~` instead of `^` prevents minor-version upgrades that could shift behavior. Document the pin reason in a comment. Any new dependency that lists inquirer as a peer dep must be audited before install.

If a new dep genuinely needs ESM-style interaction patterns, do not use inquirer's `@inquirer/` scoped packages (all ESM) — they are incompatible with this CJS context.

**Warning signs:**
- `require('inquirer')` throws `ERR_REQUIRE_ESM`
- `node_modules/inquirer/package.json` shows `"type": "module"`
- Any dependency audit shows inquirer@9 in the dependency tree

**Phase to address:**
Every phase that adds new npm dependencies. Check `npm ls inquirer` after any `npm install` to confirm version stays at 8.x.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding `CCR_KEY_NAMES` array | No file I/O at startup | Breaks silently when user edits CCR config | Never — dynamic read is a one-liner |
| No timestamp on health dashboard | Simpler display code | Users act on stale data | Never for any "live" data view |
| `Promise.all` for keytar writes | Faster batch rotation | Keychain concurrency errors + index race | Never — keytar writes must be sequential |
| Export without sanitizing env block | Simpler serialization | API key leak in exported file | Never — security invariant |
| Auto-update with no audit log | Simpler background logic | Silent failures with no recovery path | Never for any install operation |
| No `existsSync` guard on scoreboard read | Less code | ENOENT crash on fresh install | Never — guard is 2 lines |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| keytar + index file | Concurrent writes race on `qgsd-key-index.json` | Sequential write loop; single writer pattern |
| CCR `config.json` | Assuming provider names match QGSD keytar key names | Read CCR config dynamically; normalize to lowercase before matching |
| `syncToClaudeJson()` before export | Patches live API keys back into env block before serialization | Export must read raw `mcpServers` without calling sync; strip credentials explicitly |
| `unified-mcp-server.mjs` at runtime | Editing `providers.json` and expecting the running server to pick it up | Server reads providers.json at startup only — UI must communicate restart requirement |
| inquirer@8 + new deps | New dep pulls in inquirer@9 (ESM-only) transitively | Audit `npm ls inquirer` after every `npm install`; pin to `~8.2.7` |
| scoreboard file | Reading `.planning/quorum-scoreboard.json` without `existsSync` guard | Always use `readScoreboardSafe()` pattern; return empty state on missing file |
| slot cloning | Cloning config without checking if source has a keytar key | After clone, check `secretsLib.hasKey(deriveKeytarAccount(sourceName))`; prompt to copy key |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Health probes run sequentially in dashboard | 7s × 10 agents = 70s wait before display | Run all probes in `Promise.all` with shared 5s race timeout; display as results arrive | With 10+ agents |
| `setInterval` redraw while inquirer is active | Terminal corruption; display garbled | Use explicit user-triggered refresh only | Every time a timer fires during a prompt |
| Version detection (`npm list -g --json`) called on every list render | 8s+ freeze when opening listAgents | `getUpdateStatuses()` is already lazy-loaded; do not move it into the render hot path | With 5+ CLIs to check |
| `spawnSync` for auto-update install blocks event loop | Menu freezes during update; user cannot cancel | `spawnSync` is acceptable for user-triggered updates (matches existing pattern); for auto-update use async spawn | During any auto-triggered update |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Export serializes `env` block verbatim | API key leak in shared export file | Always run sanitizeEnvForExport() before any file write |
| CCR `config.json` export includes `api_key` fields | Full provider credentials in portable export | Strip `api_key` from all CCR provider entries before writing |
| Import allows arbitrary `command` + `args` | Malicious import could inject a command that Claude Code runs on reconnect | Whitelist: `command` must be one of `node`, `npx`; reject imports with other commands |
| Key expiry [invalid] badge cached to disk | Stale badge survives valid key rotation | Badge must derive from live probe on each render, never from a persisted cache file |
| Auto-update log contains full error messages | Error messages might include path info or env context | Log only: timestamp, pkg name, exit code, first 200 chars of stderr |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Health dashboard with no "Last updated" timestamp | User acts on stale data | Always show `Last updated: HH:MM:SS`; dim data older than 60s |
| Scoreboard inline shows all-time stats only | Slot that failed 200x last month but is healthy today reads as "bad" | Show 7-day win rate alongside all-time; label the recency window |
| Batch key rotation shows no per-slot progress | User waits silently during 10-slot rotation | Print `  Rotating claude-1... done` inline after each sequential set() |
| Auto-update "automatic" mode with no visible log | Broken update invisible until quorum fails | Surface update log status in listAgents banner |
| Import overwrites existing slot without confirmation | User loses production slot settings | Confirm before overwrite: "claude-3 already exists — replace?" |
| Provider preset list shows unreachable providers | User picks preset, probe fails, stuck in edit flow | Show latency badge on preset; probe on selection before entering edit flow |
| Slot cloning silently omits keytar key | Cloned slot shows [no key] with no explanation | After clone, prompt: "Copy API key from source slot to new slot?" |
| Timeout change shows green checkmark without restart note | User expects change is live immediately | Always append restart note to timeout confirmation |

---

## "Looks Done But Isn't" Checklist

- [ ] **Live health dashboard:** Renders table but has no "Last updated" timestamp — verify timestamp appears in footer and stale warning shows after 60s.
- [ ] **Import/export:** Export completes without error but `grep -i "api_key" <file>` returns matches — verify sanitizeEnvForExport() strips all credential-bearing keys.
- [ ] **Batch key rotation:** All slots report "ok" but `qgsd-key-index.json` has fewer entries than expected — verify index contains every rotated slot after sequential run.
- [ ] **Slot cloning:** Clone succeeds but cloned slot shows `—` model because PROVIDER_SLOT value has no matching providers.json entry — verify model resolves in listAgents() after clone.
- [ ] **Per-agent timeout:** qgsd.json updated, UI shows green checkmark, but running server still uses old timeout — verify UI shows restart-required note after every timeout change.
- [ ] **Key expiry warnings:** [key invalid] badge appears but persists after valid key is stored — verify badge derives from live probe on each render, not from any cached state.
- [ ] **Scoreboard inline:** Stats display correctly on developer machine but crash with ENOENT on fresh install — verify readScoreboardSafe() is used and handles missing file as empty state.
- [ ] **Auto-update policy:** "automatic" mode set but no update log created — verify `~/.claude/qgsd-update.log` exists with a timestamped entry after any auto-install.
- [ ] **CCR visibility column:** Shows `—` for all slots because CCR config has provider names that differ by case — verify case-normalized matching; test with `AkashML` vs `akashml`.
- [ ] **Provider preset library:** Preset applied successfully but the underlying provider is unreachable at apply time — verify pre-flight probe runs before writing the slot config.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| setInterval corrupts terminal | LOW | `reset` command restores terminal; no data loss; fix is static-redraw pattern |
| Export leaked API key | HIGH | Revoke all leaked keys immediately; rotate all affected slots; delete exported file; patch sanitizer before next export |
| Batch rotation left some slots with old keys | MEDIUM | Re-run batch rotation (sequential); verify with `secretsLib.hasKey()` for each slot; check Keychain Access.app |
| Import overwrote production slot config | HIGH | `~/.claude.json` write uses `.tmp` + `renameSync` pattern (writeClaudeJson already does this) — add pre-import backup to `~/.claude.json.pre-import.<timestamp>` |
| Timeout change not picked up by running server | LOW | `pkill -f unified-mcp-server.mjs` + Claude Code auto-reconnects; same pattern as existing mcp-restart |
| Scoreboard ENOENT crash | LOW | Add `existsSync` guard; empty object is correct fallback; 5-minute fix |
| Auto-update installed broken version | MEDIUM | Roll back: `npm install -g <pkg>@<previous-version>`; check update log for exact version that was installed |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| setInterval / inquirer stdin conflict | Live health dashboard phase | Test: open dashboard, navigate main menu while "refresh" logic runs — no garbled output |
| Export leaks API keys | Import/export phase | Test: export slot with known keytar-fallback plaintext key; assert output file has zero credential-bearing keys |
| Batch rotation keychain concurrency + index race | Batch key rotation phase | Test: rotate 5 slots; verify all 5 appear in qgsd-key-index.json; verify sequential execution via log |
| CCR config name mismatch | CCR routing visibility phase | Test: rename CCR provider in config.json; verify CCR column still resolves; test uppercase vs lowercase |
| Import partial apply | Import/export phase | Test: import file with missing PROVIDER_SLOT; assert validation error shown; assert no partial slot written |
| Missing scoreboard on fresh install | Scoreboard inline phase | Test: delete quorum-scoreboard.json; open listAgents; assert no crash; assert `—` displayed for all stats |
| Timeout not hot-reloaded by running server | Per-agent timeout phase | Test: change timeout; assert UI shows restart-required note; assert server uses old timeout until restart |
| Auto-update silent failure | Auto-update policy phase | Test: simulate npm install failure (network off); assert error written to qgsd-update.log; assert banner on next listAgents |
| Key expiry badge stale after rotation | Key expiry warnings phase | Test: set known-bad key, observe badge; rotate to valid key; observe badge clears on next render |
| Cloned slot missing keytar key | Slot cloning phase | Test: clone slot with stored key; assert key-copy prompt appears; assert clone without copy shows [no key] |
| inquirer@9 ESM/CJS break | Every phase adding new npm deps | Check: `npm ls inquirer` after each npm install; assert version stays at 8.x |

---

## Sources

- Direct inspection of `bin/manage-agents.cjs` (1569 lines) — confirmed keytar fallback path at lines 394–399; index write at secrets.cjs lines 18–21; CCR_KEY_NAMES hardcoded list at lines 1295–1299
- Direct inspection of `bin/secrets.cjs` — confirmed `syncToClaudeJson()` patches env blocks with live credentials (lines 117–127), creating export risk; index is a plain JSON file with read-modify-write pattern
- Direct inspection of `bin/ccr-secure-config.cjs` — confirmed hardcoded providerKeyMap with 3 names; live `~/.claude-code-router/config.json` shows matching names (akashml, together, fireworks) but mismatch risk is real
- Direct inspection of `bin/unified-mcp-server.mjs` lines 22–39 — confirmed providers.json loaded once at startup via `fs.readFileSync`; no watch/reload mechanism
- Direct inspection of `bin/update-agents.cjs` — confirmed `spawnSync` for installs (blocking); `getUpdateStatuses()` correctly uses async; no audit log exists
- `package.json` — confirmed `"inquirer": "^8.2.7"` (actual: 8.2.7, CJS); inquirer@9 is ESM-only and incompatible with CJS require()
- `.gitignore` — confirmed `quorum-scoreboard.json` is gitignored; fresh-install crash is a real risk
- Live `~/.claude-code-router/config.json` — confirmed provider names `akashml`, `together`, `fireworks` and `api_key` fields present in plaintext in this local file
- Live `~/.claude/qgsd.json` — confirmed `agent_config` structure and slot naming convention

---
*Pitfalls research for: v0.10 Roster Toolkit — extending bin/manage-agents.cjs with 10 features*
*Researched: 2026-02-24*
