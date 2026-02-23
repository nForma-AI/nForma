# Phase 40: Composition Architecture - Research

**Researched:** 2026-02-23
**Domain:** Configuration architecture — runtime agent list derivation, scoreboard data model, installer auto-population
**Confidence:** HIGH

## Summary

Phase 40 replaces every hardcoded agent list in the QGSD codebase with a single source of truth: a `quorum.active` array in `qgsd.json`. This is a pure refactor + data-model change with no new third-party dependencies; all code involved is plain Node.js reading/writing JSON files. The surface area is well-defined: four files contain hardcoded agent arrays or agent-key vocabularies that must be driven from `quorum.active` instead.

The scoreboard change (SCBD-01..03) extends the existing `update-scoreboard.cjs` schema: the stable key becomes `<slot-name>` (e.g., `claude-1`), the current model loaded in that slot becomes a context field stored alongside the key, and when a model changes a new row is created rather than overwriting the prior one. The existing `rounds[]` array and `models{}` cumulative-stats map need to be rethought — the current `models{}` map is keyed by logical model family (`claude`, `gemini`, etc.) which conflicts with the new slot-keyed design.

The phase also closes two pieces of tech debt from Phase 39: INT-04 (Mode B of `quorum.md` still uses the old "strip `claude-` prefix" derivation instead of the `health_check` `model` field) and INT-05 (`copilot` is absent from `QGSD_KEYWORD_MAP` in `bin/install.js`, so the installer never auto-writes `copilot-1` to `qgsd.json`).

**Primary recommendation:** Add `quorum.active` as an array field to `qgsd.json` (template + config-loader DEFAULT_CONFIG), write a `readActiveSlots()` helper that loads it, replace every hardcoded agent array with calls to this helper, extend the installer to populate `quorum.active` from `~/.claude.json` mcpServers, and update the scoreboard schema to use slot-name rows.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | User can define a `quorum.active` array in `qgsd.json` listing which slots participate in quorum | New config field; config-loader must recognize and validate it; template + DEFAULT_CONFIG updated |
| COMP-02 | Quorum orchestrator reads `quorum.active` from config instead of hardcoded agent list; only active slots are called | `quorum.md` and `qgsd-quorum-orchestrator.md` must load active slots from config at runtime; fallback instructions in `qgsd-prompt.js` DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK must also reflect dynamic list |
| COMP-03 | `check-provider-health.cjs` and scoreboard tooling derive agent list from `quorum.active` rather than hardcoded arrays | `check-provider-health.cjs` already reads `~/.claude.json` dynamically; it must additionally filter by `quorum.active`; `update-scoreboard.cjs` VALID_MODELS list must accommodate slot-name keys |
| COMP-04 | Default `quorum.active` is auto-populated at install/migration time based on discovered slots in `~/.claude.json` | `bin/install.js` `buildRequiredModelsFromMcp()` logic extended; `bin/migrate-to-slots.cjs` extended to write `quorum.active` on migration |
| SCBD-01 | Scoreboard tracks performance by slot name (`claude-1`, `copilot-1`) — slot is the stable key | `update-scoreboard.cjs` schema change: slot-name as key in a new `slots{}` map; `--slot` argument added |
| SCBD-02 | Each scoreboard entry displays the current model loaded in that slot as context | `model` field stored per row derived from `health_check` response |
| SCBD-03 | When a slot's model changes, a new scoreboard row is created for that slot | New row = `{ slot, model, rounds[] }`; history preserved per slot+model combination |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`, `os`) | Bundled | Config file I/O, path resolution | Already the project's only dependency for config/install code |
| `node:test` + `node:assert` | Bundled | Unit tests for scoreboard/config changes | Established test runner across the project (see `update-scoreboard.test.cjs`, `review-mcp-logs.test.cjs`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | Already in devDeps | Haiku auto-classification in scoreboard | Already present; no new dep needed |
| `crypto` (built-in) | Bundled | Team fingerprint in `init-team` | Already used |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JSON config field `quorum.active` | Separate `quorum-composition.json` file | Single file is simpler; consistent with how `required_models`, `circuit_breaker` are stored |
| Slot-keyed `slots{}` map in scoreboard | Reusing existing `models{}` map with new keys | `models{}` is keyed by model family (`claude`, `gemini`) — incompatible with `claude-1`, `claude-2` as distinct entries; new `slots{}` structure is required |

**Installation:** No new packages. All changes are code-only.

## Architecture Patterns

### Recommended Project Structure

No new directories needed. All changes are in existing files:

```
bin/
├── install.js                  # Add copilot to QGSD_KEYWORD_MAP (INT-05); write quorum.active on install
├── migrate-to-slots.cjs        # Add quorum.active population step
├── check-provider-health.cjs   # Filter server list by quorum.active
├── update-scoreboard.cjs       # New slots{} schema, --slot argument, slot+model row creation
hooks/
├── config-loader.js            # Add quorum.active to DEFAULT_CONFIG, validate it
commands/qgsd/
├── quorum.md                   # Fix INT-04 (Mode B scoreboard key), read quorum.active for active slots
templates/
├── qgsd.json                   # Add quorum.active array
agents/
├── qgsd-quorum-orchestrator.md # Read quorum.active; dynamic agent list
```

### Pattern 1: `quorum.active` Config Field

**What:** A string array of slot names that defines which MCP servers participate in quorum. The orchestrator, stop hook enforcement, and health tooling all read this at runtime.

**When to use:** Everywhere an agent list is currently hardcoded.

**Example schema in `qgsd.json`:**
```json
{
  "quorum.active": ["codex-cli-1", "gemini-cli-1", "opencode-1", "copilot-1", "claude-1"]
}
```

**Config-loader handling:**
```javascript
// In DEFAULT_CONFIG (config-loader.js)
const DEFAULT_CONFIG = {
  // ... existing fields ...
  'quorum.active': [],  // empty = all configured MCP servers participate (fail-open)
};

// Validation in validateConfig():
if (!Array.isArray(config['quorum.active'])) {
  process.stderr.write('[qgsd] WARNING: qgsd.json: quorum.active must be an array; using []\n');
  config['quorum.active'] = [];
}
// Each element must be a non-empty string
config['quorum.active'] = config['quorum.active'].filter(s => typeof s === 'string' && s.trim().length > 0);
```

**Key design decision:** An empty `quorum.active` array means "all configured slots participate" (fail-open, backward compatible). A non-empty array is an explicit allowlist. This preserves existing behavior for users who don't yet have the field.

### Pattern 2: Runtime Active-Slot Derivation

**What:** A helper function that reads `quorum.active` and intersects it with available MCP servers from `~/.claude.json`.

**When to use:** In `check-provider-health.cjs` and any tooling that needs the active slot list.

```javascript
// In check-provider-health.cjs (or a shared util)
function getActiveSlots(mcpServers, quorumActive) {
  // quorumActive = [] means all slots
  const allSlots = Object.keys(mcpServers);
  if (!quorumActive || quorumActive.length === 0) return allSlots;
  return quorumActive.filter(slot => allSlots.includes(slot));
}
```

**For `check-provider-health.cjs`:** Currently it reads `~/.claude.json` and groups by `ANTHROPIC_BASE_URL`. It must additionally read `~/.claude/qgsd.json` to get `quorum.active`, then filter the server list before building the `providers` map.

### Pattern 3: Installer Auto-Population of `quorum.active`

**What:** At install time, discover all slot names from `~/.claude.json` mcpServers and write them into `quorum.active` in `qgsd.json`.

**When to use:** On fresh install (no existing `qgsd.json`) and on migration run (`migrate-to-slots.cjs`).

**Implementation in `install.js`:**
```javascript
// After buildRequiredModelsFromMcp() builds required_models:
function buildActiveSlots(mcpServers) {
  // Return all server names discovered — the full set as default composition
  return Object.keys(mcpServers);
}

// In the qgsd.json write block:
const qgsdConfig = {
  // ... existing fields ...
  'quorum.active': buildActiveSlots(mcpServers),
};
```

**INT-05 fix — add `copilot` to `QGSD_KEYWORD_MAP`:**
```javascript
const QGSD_KEYWORD_MAP = {
  codex:    { keywords: ['codex'],    defaultPrefix: 'mcp__codex-cli-1__'  },
  gemini:   { keywords: ['gemini'],   defaultPrefix: 'mcp__gemini-cli-1__' },
  opencode: { keywords: ['opencode'], defaultPrefix: 'mcp__opencode-1__'   },
  copilot:  { keywords: ['copilot'],  defaultPrefix: 'mcp__copilot-1__'    }, // INT-05: was missing
};
```

**Migration script extension (`migrate-to-slots.cjs`):**
```javascript
function populateActiveSlots(qgsdJsonPath, claudeJsonPath, dryRun = false) {
  // Read current ~/.claude.json mcpServers keys
  // Read or create qgsd.json
  // Write quorum.active = all discovered slot names (if not already set)
  // idempotent: skip if quorum.active already present and non-empty
}
```

### Pattern 4: Scoreboard Slot-Keyed Schema (SCBD-01..03)

**What:** Replace the existing `models{}` flat map (keyed by model family) with a `slots{}` map (keyed by `slot-name:model-id` composite or by slot-name with a nested model field).

**Current schema (pre-Phase 40):**
```json
{
  "models": {
    "claude":    { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 },
    "gemini":    { "score": 0, ... },
    "opencode":  { "score": 0, ... }
  },
  "rounds": [
    { "date": "02-23", "task": "quick-56", "round": 1, "votes": { "claude": "TP", "gemini": "TP" }, "verdict": "APPROVE" }
  ]
}
```

**New schema (post-Phase 40):**

The SCBD requirements specify:
- SCBD-01: Slot name (`claude-1`, `copilot-1`) is the **stable key**
- SCBD-02: Current model appears as a **context field** (not the key)
- SCBD-03: When a slot's model changes, a **new row** is created — historical rows preserved

This means the composite key must incorporate model. Two viable designs:

**Option A — Composite key `slot:model` in `slots{}` map:**
```json
{
  "slots": {
    "claude-1:deepseek-ai/DeepSeek-V3": { "score": 12, "tp": 3, "model": "deepseek-ai/DeepSeek-V3", "slot": "claude-1", ... },
    "claude-1:Qwen/Qwen2.5-72B":        { "score": 5,  "tp": 1, "model": "Qwen/Qwen2.5-72B",       "slot": "claude-1", ... }
  }
}
```

**Option B — Slot-name key with an array of model-keyed rows:**
```json
{
  "slots": {
    "claude-1": [
      { "model": "deepseek-ai/DeepSeek-V3", "score": 12, "tp": 3, ... },
      { "model": "Qwen/Qwen2.5-72B",        "score": 5,  "tp": 1, ... }
    ]
  }
}
```

**Recommendation: Option A (composite key).** The existing `models{}` structure is a flat map and `recomputeStats()` iterates over all keys in `VALID_MODELS`. Option A is a direct analog — replace `VALID_MODELS` (a fixed list of model families) with a dynamic key set derived from `slots{}`. Option B adds nesting that complicates the recompute pass.

**New `--slot` and `--model-id` arguments for `update-scoreboard.cjs`:**
```bash
node bin/update-scoreboard.cjs \
  --slot claude-1 \
  --model-id "deepseek-ai/DeepSeek-V3" \
  --result TP \
  --task "plan-ph40" \
  --round 1 \
  --verdict APPROVE
```

The `--model` argument (model family key like `claude`, `gemini`) is retained for backward compat with native CLI agents (codex, gemini, opencode, copilot) that don't have slot names. For claude-mcp-server instances, `--slot` + `--model-id` are used instead.

**INT-04 fix in `quorum.md` Mode B (line 433):**

Current (incorrect):
```
`--model` for claude-mcp servers: strip the `claude-` prefix from the server name
```

Correct (matching Mode A line 116):
```
`--model` for claude-mcp servers: use the `model` field returned by the `health_check` response
to derive the scoreboard key (e.g., `deepseek-ai/DeepSeek-V3` → `deepseek`)
```

### Anti-Patterns to Avoid

- **Hardcoded agent arrays in new code:** Every place that currently has `['codex-cli-1', 'gemini-cli-1', ...]` literally written must be replaced. Do not introduce new literals; always read from `quorum.active`.
- **Removing the old `models{}` map without a migration:** Existing scoreboards have `models{}` data. The schema change should be additive — add `slots{}`, keep `models{}` for backward compat, or write a one-time migration that converts existing data.
- **Writing `quorum.active` on reinstall when it already exists:** Treat it like `circuit_breaker` backfill — only write if absent; do not overwrite user-configured composition.
- **Making `quorum.active` required:** Keep it optional with an empty-array default meaning "all discovered slots" — preserves backward compat for existing installs that predate Phase 40.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config file merging | Custom merge logic | Extend existing `loadConfig()` in `config-loader.js` | Existing two-layer merge is well-tested; just add `quorum.active` to DEFAULT_CONFIG and the validation function |
| Slot discovery from `~/.claude.json` | New file reader | Reuse the same pattern already in `qgsd-stop.js` `getAvailableMcpPrefixes()` and `check-provider-health.cjs` | Same file, same pattern — consistency matters |
| Atomic JSON writes | Custom temp-file + rename | Existing pattern: `fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8')` | Simple, consistent with the rest of the codebase; scoreboard is single-writer |
| Test infrastructure | New test framework | `node:test` + `node:assert/strict` + subprocess spawn pattern | Already established in `update-scoreboard.test.cjs` |

**Key insight:** The existing codebase already has all the plumbing — file readers, JSON writers, validation patterns. Phase 40 is a configuration wiring change, not infrastructure building.

## Common Pitfalls

### Pitfall 1: Shallow Merge Surprises with `quorum.active`
**What goes wrong:** A project-level `qgsd.json` that sets only `quorum.active` replaces the global `quorum.active` entirely (no merge of arrays). A user with a per-project composition override loses the global list.
**Why it happens:** The config-loader does a shallow spread: `{ ...DEFAULT_CONFIG, ...global, ...project }`. Arrays are not merged.
**How to avoid:** Document this clearly in the template comment (as done for `circuit_breaker`). Do not attempt array merging — keeping the merge strategy simple is an explicit project design decision.
**Warning signs:** User reports fewer agents being called than expected after adding a project config.

### Pitfall 2: `quorum.active` Contains Slots Not in `~/.claude.json`
**What goes wrong:** A user removes a slot from `~/.claude.json` but leaves it in `quorum.active`. The orchestrator tries to call it and gets a tool-not-found error.
**Why it happens:** `quorum.active` is a durable config; `~/.claude.json` is modified independently.
**How to avoid:** The orchestrator and `check-provider-health.cjs` must always intersect `quorum.active` with the actual available servers from `~/.claude.json`. A slot in `quorum.active` but not in `~/.claude.json` = unavailable (fail-open per R6). Never block quorum for a slot that isn't even registered.
**Warning signs:** "tool not found" errors for slots in `quorum.active`.

### Pitfall 3: Scoreboard `models{}` vs `slots{}` Recompute Conflict
**What goes wrong:** `recomputeStats()` iterates `VALID_MODELS` (a fixed list of model family names). If slots are added as keys, the recompute silently ignores them.
**Why it happens:** `VALID_MODELS` is a static array — `claude`, `gemini`, etc. `claude-1`, `claude-2` are not in it.
**How to avoid:** Either (a) make `recomputeStats()` derive its key set dynamically from `data.rounds[].votes` + `data.slots` rather than `VALID_MODELS`, or (b) keep `models{}` for native agent families and add `slots{}` for MCP instances with its own recompute loop. Option (b) is lower risk and backward compatible.
**Warning signs:** Scoreboard shows 0 score for all slot-based entries after calling `update-scoreboard.cjs`.

### Pitfall 4: `install.js` `quorum.active` Population Overwriting Existing Config
**What goes wrong:** On reinstall (`npx qgsd@latest`), the existing `qgsd.json` already exists. The current code skips writing (INST-06 pattern). But if `quorum.active` is absent from an older config, the installer must backfill it without overwriting other fields.
**Why it happens:** The install code has two branches: create-new vs backfill-missing-keys. The `circuit_breaker` backfill is the precedent.
**How to avoid:** Follow the same pattern as `circuit_breaker` backfill (lines 1866–1885 in `install.js`): check if `quorum.active` is absent or empty in the existing config; if so, discover slots from `~/.claude.json` and write only that field back.
**Warning signs:** Reinstall overwrites a user's custom `quorum.active` composition.

### Pitfall 5: INT-04 Mode B Scoreboard Key — Native Agents vs MCP Servers
**What goes wrong:** Mode B in `quorum.md` (line 433) currently says to strip the `claude-` prefix from the server name. After Phase 39, slot names are `claude-1`, `claude-2`... Stripping `claude-` would give `1`, `2` — invalid model keys.
**Why it happens:** Mode B text was not updated in Phase 39 (identified as INT-04 tech debt).
**How to avoid:** Fix line 433 to match Mode A's language: derive `--model` key from the `model` field of the `health_check` response (e.g., `"deepseek-ai/DeepSeek-V3"` → use VALID_MODELS derivation or a new `--slot`/`--model-id` argument).
**Warning signs:** Scoreboard entries for claude-mcp servers show as numeric keys or fail validation.

## Code Examples

### Reading `quorum.active` from config

```javascript
// Source: existing config-loader.js pattern + new quorum.active field
const config = loadConfig(cwd);
const activeSlots = config['quorum.active'];  // [] = all slots (fail-open)

// Intersect with actual mcpServers from ~/.claude.json
const claudeJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
const allSlots = Object.keys(claudeJson.mcpServers || {});

const participatingSlots = (activeSlots.length === 0)
  ? allSlots
  : activeSlots.filter(slot => allSlots.includes(slot));
```

### Adding `quorum.active` to DEFAULT_CONFIG and validation

```javascript
// Source: hooks/config-loader.js (extend existing DEFAULT_CONFIG)
const DEFAULT_CONFIG = {
  quorum_commands: [...],
  fail_mode: 'open',
  required_models: {...},
  circuit_breaker: {...},
  model_preferences: {},
  'quorum.active': [],  // NEW: empty = all discovered slots
};

// In validateConfig():
if (!Array.isArray(config['quorum.active'])) {
  process.stderr.write('[qgsd] WARNING: qgsd.json: quorum.active must be an array; using []\n');
  config['quorum.active'] = [];
} else {
  // Filter out any non-string or empty entries
  config['quorum.active'] = config['quorum.active'].filter(
    s => typeof s === 'string' && s.trim().length > 0
  );
}
```

### New scoreboard `--slot` usage (update-scoreboard.cjs)

```bash
# For claude-mcp-server instances (slot-keyed):
node bin/update-scoreboard.cjs \
  --slot claude-1 \
  --model-id "deepseek-ai/DeepSeek-V3" \
  --result TP \
  --task "plan-ph40" \
  --round 1 \
  --verdict APPROVE

# For native agents (family-keyed, backward compat):
node bin/update-scoreboard.cjs \
  --model gemini \
  --result TP \
  --task "plan-ph40" \
  --round 1 \
  --verdict APPROVE
```

### quorum.active in quorum.md / orchestrator (pseudocode)

```markdown
# In quorum.md — replace hardcoded native agent list for claude-mcp instances:

**claude-mcp instances** (dynamic — read from `quorum.active` config):

Read `quorum.active` from `~/.claude/qgsd.json`:
```bash
node -e "const c=require('fs').readFileSync(require('os').homedir()+'/.claude/qgsd.json','utf8');
         const j=JSON.parse(c); console.log(JSON.stringify(j['quorum.active']||[]));"
```

Intersect with `$CLAUDE_MCP_SERVERS` from provider pre-flight.
For each slot in the intersection (skip if not in `$CLAUDE_MCP_SERVERS` or `available: false`):
- Call `mcp__<slotName>__claude` with the query prompt
```

### Installer backfill pattern (following circuit_breaker precedent)

```javascript
// In install.js — inside the "qgsd.json exists" branch (line 1854+):
if (!existingConfig['quorum.active'] || existingConfig['quorum.active'].length === 0) {
  const mcpServers = readMcpServers();  // reads ~/.claude.json
  existingConfig['quorum.active'] = Object.keys(mcpServers);
  fs.writeFileSync(qgsdConfigPath, JSON.stringify(existingConfig, null, 2) + '\n', 'utf8');
  console.log(`  ${green}✓${reset} Backfilled quorum.active from ~/.claude.json (${existingConfig['quorum.active'].length} slots)`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded agent names in hooks and tooling | `required_models` config dict (Phase 2) | v0.2 | Agent set became configurable but still required manual config edit |
| Model-based server names (claude-deepseek etc.) | Slot-based names (claude-1, claude-2) | Phase 39 (v0.6) | Stable identifiers that survive model changes |
| Fixed `VALID_MODELS` list in scoreboard | Slot-keyed `slots{}` map (Phase 40) | This phase | Scoreboard tracks per-slot-per-model performance, not per-family |
| `QGSD_KEYWORD_MAP` missing copilot | Copilot added to keyword map (INT-05) | This phase | Installer now auto-detects and writes copilot-1 to quorum config |

**Deprecated/outdated:**
- Hardcoded agent arrays in `check-provider-health.cjs` (currently uses `~/.claude.json` dynamically but doesn't filter by `quorum.active` — Phase 40 adds this filter)
- Mode B scoreboard key derivation in `quorum.md` line 433 ("strip `claude-` prefix") — replaced by model-field derivation (INT-04)

## Open Questions

1. **Scoreboard backward compatibility — keep `models{}` or migrate?**
   - What we know: `update-scoreboard.cjs` has `emptyData()` which initializes `models{}` with fixed keys. Tests assert on `data.models.claude.score`. Existing scoreboards on disk have `models{}` data.
   - What's unclear: Should Phase 40 (a) add `slots{}` alongside `models{}` (additive, no migration needed), or (b) replace `models{}` with `slots{}` and migrate existing data?
   - Recommendation: Option (a) — add `slots{}` as a new map alongside `models{}`. Native agents (codex, gemini, opencode, copilot) continue to use `models{}` via `--model`. claude-mcp-server instances use `slots{}` via `--slot` + `--model-id`. This is the lowest-risk path: no migration needed, existing tests pass unchanged, new tests cover the slots path.

2. **`quorum.active` field name: dot notation or underscore?**
   - What we know: All existing config fields use underscore: `quorum_commands`, `fail_mode`, `required_models`, `model_preferences`, `circuit_breaker`. The requirements spec says `quorum.active` with a dot.
   - What's unclear: Is the dot intentional (namespacing) or should it be `quorum_active` for consistency?
   - Recommendation: Use `quorum_active` (underscore) for JSON key consistency with the rest of the config — JSON object keys with dots are legal but unusual and require bracket notation in JS. The requirement text uses `quorum.active` as a conceptual name; the implementation key should be `quorum_active`. Confirm with Jonathan if dot notation is intentional.

3. **`quorum.md` mode B — which `--model` flag format to use for slots?**
   - What we know: The existing `--model` flag accepts model family names from `VALID_MODELS`. Claude-mcp-server instances are tracked by model family derived from `health_check` (e.g., `deepseek`, `minimax`). Phase 40 introduces slot-based tracking via a new `--slot` + `--model-id` path.
   - What's unclear: Should `quorum.md` continue using `--model deepseek` (family-based, existing) for claude-mcp servers, or switch to `--slot claude-1 --model-id "deepseek-ai/DeepSeek-V3"` (new slot-based)?
   - Recommendation: Use the new `--slot` + `--model-id` path for claude-mcp servers in `quorum.md` Mode B (and Mode A). The INT-04 fix naturally moves in this direction. The existing `--model` path is retained only for native agents (codex, gemini, opencode, copilot) for backward compat.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — DEFAULT_CONFIG structure, validation patterns, two-layer merge
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — scoreboard schema, recomputeStats(), VALID_MODELS, init-team
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/bin/check-provider-health.cjs` — provider grouping, server list derivation from `~/.claude.json`
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/bin/install.js` (lines 153–252, 1824–1889) — QGSD_KEYWORD_MAP, buildRequiredModelsFromMcp(), install/reinstall config write logic
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — INT-04 confirmed at line 433 vs line 116
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — AGENT_TOOL_MAP hardcoded, fallback quorum instructions
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — required_models usage in quorum evidence scanning
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/templates/qgsd.json` — current config schema
- Direct source code inspection: `/Users/jonathanborduas/code/QGSD/.planning/phases/39-rename-and-migration/39-VERIFICATION.md` — Phase 39 deliverables and remaining tech debt
- Project requirements: `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — COMP-01..04, SCBD-01..03 definitions
- Project roadmap: `/Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md` — Phase 40 success criteria

### Secondary (MEDIUM confidence)
- Pattern inference from existing `circuit_breaker` backfill in `install.js` — same install-time backfill pattern will be used for `quorum.active`

### Tertiary (LOW confidence)
- None — all findings are from direct source inspection of the current codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all code is existing Node.js patterns
- Architecture: HIGH — all patterns derived from direct code inspection; no external dependencies
- Pitfalls: HIGH — all pitfalls identified from concrete code discrepancies found in the source (INT-04 line 433, VALID_MODELS static list, install.js branch logic)

**Research date:** 2026-02-23
**Valid until:** 2026-04-23 (config architecture is stable; no fast-moving dependencies)
