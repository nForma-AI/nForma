# Phase 2: Config & MCP Detection - Research

**Researched:** 2026-02-20
**Domain:** Node.js config layering, Claude Code MCP server discovery, JSON merge strategies
**Confidence:** HIGH — current hook source verified, Claude Code MCP docs fetched from official source, live `~/.claude.json` inspected

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONF-01 | Global config at `~/.claude/qgsd.json` — installed once, applies to all projects | Already in place from Phase 1: `loadConfig()` in both hooks reads this path. Phase 2 formalizes it as the canonical global config. |
| CONF-02 | Per-project override at `.claude/qgsd.json` — merged with global, project values take precedence | New. Hook must load both files, shallow-merge with project overriding global on all overlapping keys. The merge must be key-by-key, not full-object replace. |
| CONF-03 | Config contains: `quorum_commands` (array of command names), `quorum_models` (array of MCP tool name patterns), `fail_mode` (open\|closed, default: open) | Existing schema uses `quorum_commands`, `required_models` (dict), `fail_mode`. Phase 2 must reconcile: `quorum_models` in CONF-03 maps to `required_models` dict in current schema. The planner must decide whether to rename the field or clarify that CONF-03 uses a logical name. |
| CONF-04 | Fail-open behavior: when a quorum model is unavailable, Stop hook passes and logs reduced quorum notification | Partially implemented: `fail_mode: "open"` is read from config but the Stop hook currently blocks on ANY missing required model. CONF-04 requires the hook to distinguish "required but not called" (block) from "required but unavailable" (pass with note). Phase 2 must add availability detection. |
| CONF-05 | Config validates on read — malformed config falls back to hardcoded defaults with warning | Partially implemented: both hooks catch JSON parse errors and return `null`/`DEFAULT_CONFIG`. Warning surfacing is missing — errors are silently swallowed. Phase 2 adds a warning output channel. |
| MCP-01 | Installer reads `~/.claude.json` to auto-detect MCP server names for Codex, Gemini, OpenCode | VERIFIED: `~/.claude.json` is the correct file. Top-level `mcpServers` key contains server names. Live system shows: `{ "codex-cli": {...}, "gemini-cli": {...}, "opencode": {...} }`. |
| MCP-02 | Detection matches server names containing "codex", "gemini", "opencode" (case-insensitive keyword match) | Straightforward: iterate `Object.keys(mcpServers)`, apply `serverName.toLowerCase().includes(keyword)` for each keyword. |
| MCP-03 | Detected names written to `~/.claude/qgsd.json` as `quorum_models` on install | Requires mapping server name → tool prefix: `"codex-cli"` → `"mcp__codex-cli__"`, `"gemini-cli"` → `"mcp__gemini-cli__"`, `"opencode"` → `"mcp__opencode__"`. The transform is `"mcp__" + serverName + "__"`. |
| MCP-04 | If detection finds no matching servers, installer falls back to hardcoded defaults: `mcp__codex-cli__`, `mcp__gemini-cli__`, `mcp__opencode__` | Matches existing DEFAULT_CONFIG in qgsd-stop.js. Fallback is already defined — just needs to be used in installer detection path. |
| MCP-05 | User can manually edit `qgsd.json` to override detected names | Handled by CONF-05 validation + idempotency in INST-07 (Phase 3). Phase 2 just needs to never overwrite an existing config without user consent — consistent with current install.js behavior. |
| MCP-06 | Stop hook matches tool_use names by prefix (e.g. `mcp__codex-cli__` matches both `mcp__codex-cli__codex` and `mcp__codex-cli__review`) | ALREADY IMPLEMENTED: `findQuorumEvidence()` uses `block.name.startsWith(modelDef.tool_prefix)`. This is already correct. Phase 2 confirms this behavior and ensures the prefix format is preserved in config after detection. |

</phase_requirements>

---

## Summary

Phase 2 has two workstreams that intersect at `qgsd.json`: (1) the config system (loading, merging, validation, fallback) that both hooks consume, and (2) the MCP auto-detection that the installer uses to populate `qgsd.json` on install.

The existing hooks already implement a single-file config load from `~/.claude/qgsd.json` with a hardcoded DEFAULT_CONFIG fallback. Phase 2 extends this to a two-layer merge (global then per-project), adds warning output on malformed config, and formalizes the fail-open path for unavailable models. The Stop hook already implements prefix-based matching (MCP-06 is already done). The main hook change is distinguishing "model not called" from "model unavailable" for CONF-04.

The MCP detection side is new. Claude Code stores user-scoped MCP servers in `~/.claude.json` under a top-level `mcpServers` object. Each key is the server name (e.g., `"codex-cli"`, `"gemini-cli"`, `"opencode"`). The installer reads this file, keyword-matches server names to identify quorum candidates, and writes the detected prefixes (`"mcp__codex-cli__"`, etc.) into `~/.claude/qgsd.json` as `required_models` entries. If no servers are detected, it writes hardcoded defaults. Detecting that a model is "unavailable" at runtime requires reading this same `~/.claude.json` — a server present in `required_models` but absent from `~/.claude.json` `mcpServers` is unavailable.

**Primary recommendation:** Implement in order: (1) config loader refactor (global + project merge, validation warning), (2) Stop hook fail-open enhancement (unavailability detection), (3) installer MCP detection. No new npm dependencies. All stdlib.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=16.7.0 | Hook and installer runtime | Matches existing engine requirement; zero additional dependency |
| `fs` (built-in) | built-in | Read `~/.claude.json`, `~/.claude/qgsd.json`, `.claude/qgsd.json` | Already used in both hooks and installer |
| `path` (built-in) | built-in | Resolve config file paths across home and project directories | Already used |
| `os` (built-in) | built-in | `os.homedir()` for home directory resolution | Already used |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:process` (built-in) | built-in | `process.stderr.write()` for config warnings | Use only for surfacing malformed-config warnings in hooks — never for normal operation output |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deep merge of config objects | Shallow merge (key-by-key) | Deep merge is correct for nested objects like `required_models` — but adds complexity. Shallow merge is correct for top-level keys but wrong for `required_models` (project would fully replace global model list). Use per-key merge: arrays and objects merge individually; scalars override. See Architecture Patterns. |
| Reading `~/.claude.json` at hook runtime for unavailability detection | Caching the mcpServers list in `qgsd.json` | Caching in `qgsd.json` (writing detected servers at install time) is simpler and correct: server list doesn't change between installs. Hook doesn't need to read `~/.claude.json` — it only reads `qgsd.json`. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. Modifications only to:

```
hooks/
├── qgsd-stop.js          # Extend: two-layer config load, fail-open unavailability path
└── qgsd-prompt.js        # Extend: two-layer config load
bin/
└── install.js            # Extend: MCP detection on install, write detected config
templates/
└── qgsd.json             # Update: document quorum_models field (currently required_models)
```

### Pattern 1: Two-Layer Config Merge

**What:** Load `~/.claude/qgsd.json` (global) then `.claude/qgsd.json` (project), merge with project taking precedence.

**When to use:** Both hooks need this on every invocation.

**Merge semantics (per-key, not whole-object replace):**

```javascript
// Source: derived from requirements analysis
function loadConfig(projectDir) {
  const globalPath = path.join(os.homedir(), '.claude', 'qgsd.json');
  const projectPath = path.join(projectDir || process.cwd(), '.claude', 'qgsd.json');

  let global = readConfigFile(globalPath);   // returns parsed object or null
  let project = readConfigFile(projectPath); // returns parsed object or null

  if (!global && !project) {
    // Both missing/malformed — use DEFAULT_CONFIG, warn once
    return { config: DEFAULT_CONFIG, warnings: ['qgsd.json not found; using defaults'] };
  }

  const base = global || DEFAULT_CONFIG;
  if (!project) return { config: base, warnings: [] };

  // Per-key merge: project overrides global on each key
  // Arrays and objects: project value replaces global (not appended)
  return {
    config: { ...base, ...project },
    warnings: [],
  };
}
```

**Key insight on `required_models` merge:** If the project config specifies `required_models`, it replaces the global `required_models` entirely. This is correct — a project that needs only Codex should be able to declare `{ required_models: { codex: {...} } }` and have that override the global 3-model requirement. The shallow spread `{ ...base, ...project }` achieves this.

### Pattern 2: Config Validation + Warning Surfacing

**What:** Validate required fields after load. Surface warnings to stderr (not stdout — stdout is the block decision channel).

**When to use:** On every config read. Must not crash hook if field is wrong type.

```javascript
// Source: derived from CONF-05 requirement
function validateConfig(config) {
  const warnings = [];

  if (!Array.isArray(config.quorum_commands)) {
    warnings.push('qgsd.json: quorum_commands must be an array; using defaults');
    config.quorum_commands = DEFAULT_CONFIG.quorum_commands;
  }

  if (typeof config.required_models !== 'object' || config.required_models === null) {
    warnings.push('qgsd.json: required_models must be an object; using defaults');
    config.required_models = DEFAULT_CONFIG.required_models;
  }

  if (!['open', 'closed'].includes(config.fail_mode)) {
    warnings.push(`qgsd.json: fail_mode "${config.fail_mode}" invalid; defaulting to "open"`);
    config.fail_mode = 'open';
  }

  return { config, warnings };
}

// Warnings surface on stderr — never on stdout
function emitWarnings(warnings) {
  for (const w of warnings) {
    process.stderr.write(`[qgsd] WARNING: ${w}\n`);
  }
}
```

**Why stderr, not stdout:** The Stop hook's stdout channel is the block-decision channel. Any unexpected content in stdout would corrupt the JSON decision output. Stderr is safe for diagnostic output and does not interfere with Claude Code's hook processing.

### Pattern 3: Fail-Open Unavailability Detection (CONF-04)

**What:** Distinguish "model configured but not called" (block) from "model configured but unavailable" (pass with note).

**The challenge:** The Stop hook runs after Claude's turn completes. At that point, we can only observe tool_use blocks in the transcript — we cannot ask Claude "did you try to call Codex?" We need a different signal for "unavailable."

**Recommended signal: check `~/.claude.json` `mcpServers` at hook runtime.** If a configured model's `tool_prefix` has no corresponding entry in `mcpServers`, treat the model as unavailable.

```javascript
// Source: derived from MCP-01 findings (mcpServers in ~/.claude.json)
function getAvailableMcpPrefixes() {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  if (!fs.existsSync(claudeJsonPath)) return null; // unknown → do not use for unavailability
  try {
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    const servers = d.mcpServers || {};
    // Derive prefixes from server names: "codex-cli" → "mcp__codex-cli__"
    return Object.keys(servers).map(name => `mcp__${name}__`);
  } catch {
    return null; // parse failure → fail-open, do not block on unavailability
  }
}

// In main() after findQuorumEvidence():
const availablePrefixes = getAvailableMcpPrefixes(); // null = unknown

const missingKeys = Object.entries(config.required_models)
  .filter(([modelKey, modelDef]) => {
    if (!modelDef.required) return false;
    if (foundModels.has(modelKey)) return false; // called — not missing
    // Check unavailability
    if (availablePrefixes !== null) {
      const isConfigured = availablePrefixes.some(p => p === modelDef.tool_prefix);
      if (!isConfigured) return false; // unavailable → fail-open, skip
    }
    return true; // required, not called, and either available or unknown
  })
  .map(([modelKey]) => modelKey);
```

**Unavailability note in block reason:** When some models are skipped as unavailable, the block reason for remaining missing models should note the absent ones:

```
QUORUM REQUIRED: Before completing this /gsd:plan-phase response, call mcp__gemini-cli__gemini with your current plan. Present their responses, then deliver your final output. [Note: mcp__opencode__ was unavailable and skipped per fail-open policy]
```

### Pattern 4: MCP Auto-Detection in Installer

**What:** Read `~/.claude.json`, extract server names, keyword-match to identify quorum candidates, derive tool prefixes, write to `qgsd.json`.

**Where `~/.claude.json` stores MCP servers:**

```
~/.claude.json → { "mcpServers": { "codex-cli": {...}, "gemini-cli": {...}, "opencode": {...} } }
```

The top-level `mcpServers` key holds user-scoped servers (across all projects). Project-scoped servers live in `.mcp.json` at the project root — not relevant for the installer.

**Detection algorithm:**

```javascript
// Source: ~/.claude.json mcpServers structure verified from live system (2026-02-20)
const KEYWORD_MAP = {
  codex:    { keywords: ['codex'],    defaultPrefix: 'mcp__codex-cli__'  },
  gemini:   { keywords: ['gemini'],   defaultPrefix: 'mcp__gemini-cli__' },
  opencode: { keywords: ['opencode'], defaultPrefix: 'mcp__opencode__'   },
};

function detectMcpServers(claudeJsonPath) {
  let mcpServers = {};
  try {
    const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
    mcpServers = d.mcpServers || {};
  } catch {
    // File missing or unparseable — use defaults
  }

  const requiredModels = {};
  for (const [modelKey, { keywords, defaultPrefix }] of Object.entries(KEYWORD_MAP)) {
    // Find first server name matching any keyword (case-insensitive)
    const matched = Object.keys(mcpServers).find(serverName =>
      keywords.some(kw => serverName.toLowerCase().includes(kw))
    );
    if (matched) {
      requiredModels[modelKey] = { tool_prefix: `mcp__${matched}__`, required: true };
    } else {
      // No match → fall back to hardcoded default
      requiredModels[modelKey] = { tool_prefix: defaultPrefix, required: true };
    }
  }
  return requiredModels;
}
```

**Result for live system:**

```
"codex-cli"   matches "codex"    → tool_prefix: "mcp__codex-cli__"
"gemini-cli"  matches "gemini"   → tool_prefix: "mcp__gemini-cli__"
"opencode"    matches "opencode" → tool_prefix: "mcp__opencode__"
```

This matches the current DEFAULT_CONFIG — detection is correct on the live system.

### Anti-Patterns to Avoid

- **Replacing the whole config object on merge:** `{ ...global, ...project }` is correct for top-level key merge but do NOT deep-merge `required_models` — project's `required_models` should replace global entirely (per-key semantics, not field-recursive).
- **Writing detection output on every hook invocation:** MCP detection is an install-time operation. The Stop hook must never read `~/.claude.json` for detection (it reads it only for unavailability check, which is a separate concern). Detection runs once at install.
- **Surfacing warnings on stdout in the Stop hook:** Stdout is the decision channel. All diagnostic output goes to stderr.
- **Blocking on unavailable models in fail-open mode:** When `fail_mode: "open"` (default), the hook must pass if a model is absent from `~/.claude.json` mcpServers. Only block when the model is configured AND present in mcpServers AND not called.
- **Overwriting existing user-edited `qgsd.json` on reinstall:** The installer currently skips writing qgsd.json if it already exists. This is correct — INST-07 (Phase 3) formalizes this. Phase 2 must maintain this behavior.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep JSON merge | Custom recursive merge | Shallow per-key spread `{ ...base, ...project }` | Required_models is intentionally replaced per-project; recursive merge would merge individual model entries, preventing project from removing a global model |
| Config schema validation library | `ajv`, `zod`, `joi` | Manual field-by-field checks with defaults | Zero new dependencies is a firm constraint; the schema has 3 fields — manual validation is 15 lines |
| MCP server name normalization | Custom string manipulation | `serverName.toLowerCase().includes(keyword)` | The detection is intentionally simple — complex normalization adds fragility |

**Key insight:** The config schema is intentionally minimal. Do not add a validation library — the manual approach is correct for this scale.

---

## Common Pitfalls

### Pitfall 1: stdout Pollution from Warnings

**What goes wrong:** Warning messages written to stdout corrupt the Stop hook's JSON decision output. Claude Code parses stdout as the decision — any non-JSON prefix causes a parse error and the hook may fail unpredictably.

**Why it happens:** Developers reach for `console.log()` or `console.warn()` which both write to stdout in many contexts. `console.warn()` actually writes to stderr, but `console.log()` writes to stdout.

**How to avoid:** Use `process.stderr.write()` explicitly. Never use `console.log()` in hook code. Audit every warning path.

**Warning signs:** Hook produces non-JSON output in stdout when config is malformed.

### Pitfall 2: Project CWD Assumption

**What goes wrong:** The Stop hook is invoked by Claude Code from the project directory — but the CWD during hook execution is the Claude Code process's CWD, which may differ from the project root on some systems or invocations.

**Why it happens:** Claude Code hooks run as child processes. The CWD is Claude Code's working directory, which is typically the project root but is not guaranteed to be `.` in all configurations.

**How to avoid:** For per-project config, prefer reading the `transcript_path`'s directory as a proxy for the project root, or derive the project path from the Stop event payload. Alternatively, accept that per-project config is best-effort and only applies when CWD is the project root.

**Recommendation:** Use `process.cwd()` for `.claude/qgsd.json` lookup. This is correct for the typical case (Claude Code sets CWD to project root). Document the limitation.

### Pitfall 3: `~/.claude.json` Parse Failure Cascades

**What goes wrong:** `~/.claude.json` is a large file (the live system shows it has `numStartups`, `projects`, etc.) and may have unexpected structure. A parse failure or structural mismatch causes unavailability detection to fail, triggering a false block in fail-closed mode.

**Why it happens:** The file is Claude Code's internal state file and its schema is not guaranteed to be stable.

**How to avoid:** Always wrap `~/.claude.json` reads in try-catch. On failure, return `null` from the availability check function, and treat `null` as "unknown" (do not use it to determine unavailability). Only treat a model as unavailable when `availablePrefixes` is a non-null array that does not include the model's prefix.

### Pitfall 4: Config Schema Mismatch (CONF-03 vs. Existing Schema)

**What goes wrong:** REQUIREMENTS.md CONF-03 says `quorum_models` (array), but the existing hook code uses `required_models` (dict with `tool_prefix` and `required` fields). A planner who takes CONF-03 literally would rename the field, breaking all existing installs.

**Why it happens:** CONF-03 was written before Phase 1 implemented the schema. The requirement uses a logical field name; Phase 1 implemented a richer structure.

**How to avoid:** Treat CONF-03's `quorum_models` as the logical intent — "which MCP tool patterns count as quorum evidence." The existing `required_models` dict satisfies this intent with richer semantics (per-model `required` flag, named model keys). Phase 2 should NOT rename the field. If forward-compatibility requires both names, add an alias. Document this in the plan.

### Pitfall 5: Fail-Open vs. Fail-Closed Semantics Under Schema Ambiguity

**What goes wrong:** The Stop hook conflates two failure modes: (A) "Claude didn't call the model" and (B) "the model isn't configured/available." Both result in `foundModels` missing the model key, but they require different responses.

**Why it happens:** The current implementation treats both as "missing quorum" → block. This is incorrect for CONF-04 when `fail_mode: "open"`.

**How to avoid:** Implement explicit unavailability detection (Pattern 3 above). The detection is a best-effort read of `~/.claude.json`. When unavailability is confirmed, emit a note but do not block. When unavailability is unknown, block (conservative default).

---

## Code Examples

### Config Load (Two-Layer)

```javascript
// Two-layer config load: global → project → merge
// Source: derived from existing loadConfig() in qgsd-stop.js + CONF-01/02 requirements
function loadConfig() {
  const globalPath = path.join(os.homedir(), '.claude', 'qgsd.json');
  const projectPath = path.join(process.cwd(), '.claude', 'qgsd.json');

  const warnings = [];

  function readFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      warnings.push(`Malformed config at ${filePath}: ${e.message}; using defaults for this layer`);
      return null;
    }
  }

  const global = readFile(globalPath);
  const project = readFile(projectPath);

  let config;
  if (!global && !project) {
    warnings.push('No qgsd.json found at ~/.claude/qgsd.json or .claude/qgsd.json; using hardcoded defaults');
    config = { ...DEFAULT_CONFIG };
  } else {
    config = { ...DEFAULT_CONFIG, ...(global || {}), ...(project || {}) };
  }

  // Emit warnings to stderr (never stdout — stdout is the decision channel)
  for (const w of warnings) {
    process.stderr.write(`[qgsd] WARNING: ${w}\n`);
  }

  return config;
}
```

### MCP Detection in Installer

```javascript
// Detect MCP server names from ~/.claude.json and build required_models for qgsd.json
// Source: ~/.claude.json mcpServers structure verified 2026-02-20
function buildRequiredModelsFromMcp() {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  let mcpServers = {};

  try {
    if (fs.existsSync(claudeJsonPath)) {
      const d = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      mcpServers = d.mcpServers || {};
    }
  } catch (e) {
    console.warn(`  ⚠ Could not read ~/.claude.json: ${e.message}`);
  }

  const KEYWORD_MAP = {
    codex:    { keywords: ['codex'],    defaultPrefix: 'mcp__codex-cli__'  },
    gemini:   { keywords: ['gemini'],   defaultPrefix: 'mcp__gemini-cli__' },
    opencode: { keywords: ['opencode'], defaultPrefix: 'mcp__opencode__'   },
  };

  const requiredModels = {};
  let anyDetected = false;

  for (const [modelKey, { keywords, defaultPrefix }] of Object.entries(KEYWORD_MAP)) {
    const matched = Object.keys(mcpServers).find(serverName =>
      keywords.some(kw => serverName.toLowerCase().includes(kw))
    );
    if (matched) {
      requiredModels[modelKey] = { tool_prefix: `mcp__${matched}__`, required: true };
      anyDetected = true;
      console.log(`  ✓ Detected ${modelKey} MCP server: ${matched} → prefix: mcp__${matched}__`);
    } else {
      requiredModels[modelKey] = { tool_prefix: defaultPrefix, required: true };
      console.warn(`  ⚠ No ${modelKey} MCP server found in ~/.claude.json; using default prefix: ${defaultPrefix}`);
    }
  }

  if (!anyDetected) {
    console.warn('  ⚠ No quorum MCP servers detected — using hardcoded defaults');
  }

  return requiredModels;
}
```

### Prefix-Based Matching (Already Implemented — MCP-06)

```javascript
// Source: hooks/qgsd-stop.js findQuorumEvidence() — already implemented, do not change
for (const [modelKey, modelDef] of Object.entries(requiredModels)) {
  if (block.name && block.name.startsWith(modelDef.tool_prefix)) {
    found.add(modelKey);
  }
}
// This correctly matches mcp__codex-cli__review AND mcp__codex-cli__codex
// for tool_prefix: "mcp__codex-cli__"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP config in `claude_desktop_config.json` | MCP config in `~/.claude.json` under `mcpServers` key | Sometime in 2025 (Claude Code separated from Claude Desktop) | Installer must read `~/.claude.json`, not `claude_desktop_config.json` |
| Project-scoped MCPs in `.claude/settings.json` | Project-scoped MCPs in `.mcp.json` (project root) | 2025 (Claude Code MCP scoping formalized) | Per-project MCP detection not needed — user-scoped servers in `~/.claude.json` are the correct detection target |
| MCP scope called "global" | MCP scope renamed to "user" | Late 2025 | Documentation refers to "user scope" for `~/.claude.json` entries; installer uses user scope |

**Deprecated/outdated:**
- `claude_desktop_config.json` for MCP server config: replaced by `~/.claude.json` in Claude Code context.
- `settings.json` (at `~/.claude/settings.json`) does not contain `mcpServers`: verified from live system. Hooks and detection must use `~/.claude.json`.

---

## Open Questions

1. **CONF-03 field name: `quorum_models` vs. `required_models`**
   - What we know: Existing hooks use `required_models` (dict). CONF-03 says `quorum_models` (array). The dict structure is richer and already works.
   - What's unclear: Whether to rename, alias, or leave as-is. Renaming breaks any existing user configs. Aliasing adds complexity. Leaving as-is misaligns with written requirement.
   - Recommendation: Leave `required_models` as the canonical field name. Update REQUIREMENTS.md CONF-03 to reflect the dict schema. The requirement was written before the schema was finalized.

2. **Project CWD reliability for `.claude/qgsd.json` lookup**
   - What we know: `process.cwd()` in hooks returns Claude Code's working directory, typically the project root.
   - What's unclear: Whether Claude Code explicitly sets CWD to the project root for all hook invocations in all versions.
   - Recommendation: Use `process.cwd()` with a note that per-project config is best-effort. Validate in Phase 1's live testing checkpoint (already pending).

3. **Fail-open note delivery mechanism**
   - What we know: When a model is unavailable and skipped, CONF-04 says "the block message notes which models were absent." But if all other models are found, there is no block — so the note cannot be in a block reason.
   - What's unclear: How to surface the "X was unavailable and skipped" note when the hook passes (no block output).
   - Recommendation: Write the note to stderr when passing. Stderr output from hooks is displayed in Claude Code's debug output but does not interfere with the session. This is the same pattern as config warnings. If a block does occur (some models required and not called), include the unavailability note in the block reason.

---

## Sources

### Primary (HIGH confidence)

- Official Claude Code MCP docs (`https://code.claude.com/docs/en/mcp`) — fetched 2026-02-20. Confirmed: `~/.claude.json` is the correct file for user-scoped MCP servers; `mcpServers` is the top-level key.
- Live `~/.claude.json` inspection (2026-02-20) — `mcpServers`: `{ "codex-cli": {...}, "gemini-cli": {...}, "opencode": {...} }`. Prefix derivation confirmed: `mcp__<serverName>__`.
- `hooks/qgsd-stop.js` (2026-02-20) — `loadConfig()`, `findQuorumEvidence()`, `DEFAULT_CONFIG` — all verified. MCP-06 prefix matching already implemented.
- `hooks/qgsd-prompt.js` (2026-02-20) — `loadConfig()` pattern, `quorum_instructions` from config.
- `templates/qgsd.json` (2026-02-20) — Current config schema baseline.
- `bin/install.js` (2026-02-20) — `qgsdConfigPath` write pattern at line 1606–1613 (skips if file exists).

### Secondary (MEDIUM confidence)

- WebSearch result (2026-02-20): Claude Code MCP configuration docs confirm `~/.claude.json` as primary storage location for user-scoped MCP servers.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all stdlib
- Architecture: HIGH — patterns derived from verified existing code + official docs
- Pitfalls: HIGH — pitfalls identified from code inspection and official doc reading; no speculation
- MCP detection: HIGH — `~/.claude.json` structure verified from live system

**Research date:** 2026-02-20
**Valid until:** 2026-03-22 (30 days — stable Claude Code MCP storage format)
