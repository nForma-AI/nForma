---
phase: 02-config-mcp-detection
status: passed
verified: 2026-02-20
verifier: orchestrator + human checkpoint
---

# Phase 2: Config & MCP Detection — Verification Report

**Phase goal:** Quorum enforcement is configurable by the user and resilient to renamed or absent MCP servers — no silent failures.

**Verdict: PASSED** — All 5 success criteria verified. Human checkpoint approved (all 6 checks).

---

## Success Criteria Verification

### SC-1: User-editable config respected by hooks

**Claim:** A user can edit `~/.claude/qgsd.json` to change which commands require quorum and which MCP tool prefixes count as evidence, and the hooks respect those values without code changes.

**Verification:**
- `hooks/config-loader.js` `loadConfig()` reads `~/.claude/qgsd.json` as the global layer on every invocation
- `hooks/qgsd-stop.js` and `hooks/qgsd-prompt.js` both call `loadConfig()` from the shared module — no cached or hardcoded values used post-load
- `validateConfig()` corrects invalid fields with defaults but does not overwrite user values for valid entries
- TC2, TC3 in `config-loader.test.js`: project config with custom `quorum_commands` and `fail_mode` respected

**Evidence:**
- `hooks/config-loader.js` line 75-77: reads global path `~/.claude/qgsd.json`
- `hooks/qgsd-stop.js` line 20: `const { loadConfig, DEFAULT_CONFIG } = require('./config-loader')`
- `hooks/qgsd-prompt.js` line 9: `const { loadConfig, DEFAULT_CONFIG } = require('./config-loader')`
- All 10 `config-loader.test.js` tests pass

**Status: VERIFIED**

---

### SC-2: Per-project config override

**Claim:** A per-project `.claude/qgsd.json` overrides the global config for that project, with project values taking precedence on all overlapping keys.

**Verification:**
- `hooks/config-loader.js` `loadConfig(projectDir)` reads `.claude/qgsd.json` in `projectDir` as the project layer
- Merge: `{ ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) }` — project always wins
- Shallow merge: project `required_models` replaces global entirely (no deep merge)
- TC3: project `fail_mode: "closed"` overrides global/default `"open"`
- TC10: project `required_models` replaces `DEFAULT_CONFIG.required_models` entirely
- Human Check 3 confirmed: `fail_mode`, `quorum_commands` from project; `required_models` from default (not in project config)

**Evidence:**
- `hooks/config-loader.js` lines 71-86: two-layer merge logic
- TC3, TC10 in `config-loader.test.js`

**Status: VERIFIED**

---

### SC-3: Fail-open for unavailable models

**Claim:** When one or more quorum models are unavailable (no matching tool_use found), the Stop hook passes (fail-open) and the block message notes which models were absent.

**Verification:**
- `hooks/qgsd-stop.js` `getAvailableMcpPrefixes()` reads `~/.claude.json` mcpServers at runtime
- Models whose `tool_prefix` is absent from `availablePrefixes` are added to `unavailableKeys` and skipped from `missingKeys`
- When `missingKeys.length === 0` and `unavailableKeys` is non-empty: passes with stderr INFO note
- When `missingKeys.length > 0` and `unavailableKeys` is non-empty: blocks with note in `blockReason`
- TC11: unavailable model → pass; TC12: partial availability — unavailable skipped, available+missing blocks; TC13: renamed prefix works

**Evidence:**
- `hooks/qgsd-stop.js` lines 127-149: `getAvailableMcpPrefixes()`
- `hooks/qgsd-stop.js` lines 195-235: updated missingKeys filter with unavailability detection
- All 13 `qgsd-stop.test.js` tests pass

**Status: VERIFIED**

---

### SC-4: Malformed config fallback with warning

**Claim:** When `qgsd.json` is malformed or missing, the hooks fall back to hardcoded defaults and surface a warning — no crash, no silent pass without reason.

**Verification:**
- `readConfigFile()` catches JSON parse errors and emits `[qgsd] WARNING: Malformed config at <path>: <error>` to stderr
- `loadConfig()` emits `[qgsd] WARNING: No qgsd.json found...` when both layers missing
- `validateConfig()` emits warnings for each invalid field corrected
- All warnings use `process.stderr.write()` — never stdout (hook decision channel)
- TC4: malformed config → stderr warning, valid DEFAULT_CONFIG returned
- TC5-TC7: invalid field types corrected with warnings
- TC8: zero stdout across all scenarios

**Evidence:**
- `hooks/config-loader.js` lines 36-43: `readConfigFile()` malformed-JSON warning
- `hooks/config-loader.js` lines 45-64: `validateConfig()` field warnings
- `hooks/config-loader.js` lines 79-81: no-files warning
- TC4, TC5, TC6, TC7, TC8 in `config-loader.test.js`
- Human Check 4 confirmed: malformed config produces `[qgsd] WARNING:` on stderr, no crash

**Status: VERIFIED**

---

### SC-5: Prefix-based tool_use matching (MCP-06)

**Claim:** Stop hook matches MCP tool names by prefix so that both `mcp__codex-cli__codex` and `mcp__codex-cli__review` satisfy the Codex quorum requirement.

**Verification:**
- `findQuorumEvidence()` uses `block.name.startsWith(modelDef.tool_prefix)` — already implemented in Phase 1, preserved through Phase 2 migration
- `config-loader.js` `DEFAULT_CONFIG` and the installer-generated config both write `tool_prefix` as `mcp__<serverName>__` format, maintaining startsWith semantics
- TC13: renamed prefix `mcp__my-custom-codex__` with tool call `mcp__my-custom-codex__review` → pass

**Evidence:**
- `hooks/qgsd-stop.js` line 104: `block.name.startsWith(modelDef.tool_prefix)`
- TC13 in `qgsd-stop.test.js`

**Status: VERIFIED**

---

## Requirements Coverage

| Req ID | Description | Plan | Status |
|--------|-------------|------|--------|
| CONF-01 | Global config at `~/.claude/qgsd.json` | 02-01 | Verified — loadConfig() reads this path |
| CONF-02 | Per-project override at `.claude/qgsd.json` | 02-01 | Verified — TC3, TC10, SC-2 above |
| CONF-03 | Config schema: quorum_commands, required_models, fail_mode | 02-01 | Verified — DEFAULT_CONFIG in config-loader.js; REQUIREMENTS.md corrected to required_models |
| CONF-04 | Fail-open: unavailable model → pass + note | 02-02 | Verified — TC11, TC12, SC-3 above |
| CONF-05 | Malformed config → fallback + warning | 02-01 | Verified — TC4-TC8, SC-4 above |
| MCP-01 | Installer reads `~/.claude.json` for MCP detection | 02-03 | Verified — buildRequiredModelsFromMcp() reads ~/.claude.json |
| MCP-02 | Case-insensitive keyword matching | 02-03 | Verified — `serverName.toLowerCase().includes(kw)` |
| MCP-03 | Detected names written as `required_models` on install | 02-03 | Verified — qgsd.json write block uses buildRequiredModelsFromMcp() result |
| MCP-04 | No detected servers → hardcoded defaults | 02-03 | Verified — defaultPrefix fallback in QGSD_KEYWORD_MAP |
| MCP-05 | Existing qgsd.json never overwritten | 02-03 | Verified — `if (!fs.existsSync(qgsdConfigPath))` guard preserved |
| MCP-06 | Prefix-based matching | 02-02 | Verified — startsWith() preserved, TC13 regression test |

**11/11 requirements verified.**

---

## Human Verification

Checkpoint approved by user on 2026-02-20.

All 6 checks passed:
1. `node --test hooks/config-loader.test.js` → all tests pass
2. `node --test hooks/qgsd-stop.test.js` → 13/13 pass (TC1-TC10 regression + TC11-TC13 fail-open)
3. Two-layer merge: project `fail_mode`/`quorum_commands` override; `required_models` from DEFAULT_CONFIG when not in project config
4. Malformed config: `[qgsd] WARNING: Malformed config at...` on stderr, no crash
5. `~/.claude.json` has `codex-cli`, `gemini-cli`, `opencode` — auto-detection would match all three
6. Live enforcement: Stop hook blocks when quorum incomplete, passes when all required models called

---

## Phase Summary

**What shipped in Phase 2:**

1. `hooks/config-loader.js` — shared two-layer config loader (global + project merge), field validation, stderr-only warnings
2. `hooks/config-loader.test.js` — 10 TDD tests covering all load/validate/warn scenarios
3. `hooks/qgsd-prompt.js` — migrated to shared config-loader (removed inline `loadConfig()`)
4. `hooks/qgsd-stop.js` — migrated to shared config-loader + `getAvailableMcpPrefixes()` fail-open detection; 13 tests
5. `scripts/build-hooks.js` — `config-loader.js` added to `HOOKS_TO_COPY`
6. `bin/install.js` — `buildRequiredModelsFromMcp()`, `buildQuorumInstructions()`, detection-aware qgsd.json write
7. `templates/qgsd.json` — `_comment` schema documentation array added
8. `.planning/REQUIREMENTS.md` — MCP-01/CONF-03/MCP-03 corrections recorded

**Ready for Phase 3:** Installer & Distribution — all hooks are self-contained, config-aware, and tested. Phase 3 can package and distribute them.
