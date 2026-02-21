# Phase 7: Enforcement & Config Integration - Research

**Researched:** 2026-02-21
**Domain:** Claude Code PreToolUse hook blocking, config-loader extension, two-layer config merge
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ENFC-01 | When circuit breaker is active, hook returns `{ "decision": "block", "reason": "..." }` blocking Bash execution | PreToolUse blocking uses `hookSpecificOutput.permissionDecision: 'deny'` — NOT top-level `decision` field. Phase 6 RESEARCH.md (Pattern 2) confirmed this. State file `active: true` is the gate condition. |
| ENFC-02 | Block reason names the oscillating file set, confirms breaker is active, lists allowed operations (read-only Bash) | Block reason is a string in `hookSpecificOutput.permissionDecisionReason`. Must include: file set list, "circuit breaker active" confirmation, allowed commands list. |
| ENFC-03 | Block reason instructs Claude to perform root cause analysis and map dependencies before resuming; explicitly instructs the user to manually commit the fix (since Claude cannot run git commit while blocked) | Message content requirement — no technical constraint. Must name the two obligations: (1) root cause analysis + dependency mapping, (2) user must manually commit because git commit is blocked. |
| CONF-06 | qgsd.json schema extended with `circuit_breaker.oscillation_depth` (integer, default: 3) | config-loader.js needs new `circuit_breaker` key in DEFAULT_CONFIG and validateConfig(). Shallow merge applies at top level; circuit_breaker is a nested object. |
| CONF-07 | qgsd.json schema extended with `circuit_breaker.commit_window` (integer, default: 6) | Same as CONF-06 — both keys live in the `circuit_breaker` sub-object. |
| CONF-08 | Circuit breaker config values validated on load; invalid values fall back to defaults with stderr warning | validateConfig() must check `oscillation_depth` and `commit_window` are positive integers; fall back to 3 and 6 respectively with `[qgsd] WARNING:` message to stderr. |
| CONF-09 | Two-layer config merge (global + project) applies to `circuit_breaker` settings identically to existing merge behavior | Existing shallow merge `{ ...DEFAULT_CONFIG, ...global, ...project }` will carry the `circuit_breaker` object through. CRITICAL: current shallow merge means a project that sets `circuit_breaker` entirely replaces the global `circuit_breaker` — consistent with existing behavior for `required_models`. |
</phase_requirements>

---

## Summary

Phase 7 has two distinct workstreams that build on Phase 6's completed foundation. The first is **enforcement**: the circuit breaker hook (`hooks/qgsd-circuit-breaker.js`) must be modified so that when it reads an existing state file with `active: true` and the incoming command is NOT read-only, it outputs a blocking JSON decision instead of silently passing. The second is **config integration**: `hooks/config-loader.js` must be extended to add a `circuit_breaker` sub-object to `DEFAULT_CONFIG` and validate its two integer keys; the hook then reads `oscillation_depth` and `commit_window` from the loaded config instead of from hardcoded constants.

Both workstreams are changes to existing files, not new files. The hook already has the correct control flow skeleton from Phase 6 — the `if (state && state.active)` branch currently exits 0 (pass) and must be changed to emit a deny decision when the command is not read-only. The config-loader already has a validated `validateConfig()` function and a `DEFAULT_CONFIG` export; adding a new key follows the exact same pattern as existing keys.

**CRITICAL PreToolUse blocking format:** Phase 6 research explicitly identified that PreToolUse uses `hookSpecificOutput.permissionDecision: 'deny'` (NOT the top-level `{ "decision": "block" }` format used by Stop hooks). Using the wrong format silently fails — the command proceeds as if no hook was registered. This distinction is the single most dangerous pitfall for Phase 7.

**Primary recommendation:** Modify `hooks/qgsd-circuit-breaker.js` to emit `hookSpecificOutput.permissionDecision: 'deny'` when `state.active && !isReadOnly(command)`. Extend `config-loader.js` with `circuit_breaker: { oscillation_depth: 3, commit_window: 6 }` in `DEFAULT_CONFIG` and corresponding validation. Both changes are covered by TDD — Phase 6 tests need minimal additions; config-loader tests need new TCs for the new key.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` | built-in | State file read (already in hook) | Existing dependency — no change |
| `node:path` | built-in | Path construction (already in hook) | Existing dependency — no change |
| `node:child_process` | built-in | `spawnSync` for git commands (already in hook) | Phase 6 switched from execSync to spawnSync — keep as-is |
| `./config-loader` | local | Load `oscillation_depth` and `commit_window` from config | Already imported in hook; Phase 7 adds new keys to it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert/strict` | built-in | TDD test suite for config-loader and hook changes | Existing pattern — add new TCs to existing files |
| `child_process.spawnSync` | built-in | Hook invocation in tests | Same as Phase 6 test pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `hookSpecificOutput.permissionDecision: 'deny'` | `{ "decision": "block" }` top-level | Top-level format is for Stop/PostToolUse. PreToolUse requires hookSpecificOutput. Wrong format silently allows the command — never use for PreToolUse |
| Nested `circuit_breaker` object in config | Flat `oscillation_depth` / `commit_window` top-level keys | Nested is cleaner (groups related keys, less namespace pollution, matches Phase 8 installer plan which writes a `circuit_breaker` block). Consistency with REQUIREMENTS.md CONF-06/07 naming. |
| Deep merge of `circuit_breaker` sub-object | Shallow merge (current behavior) | Shallow merge is existing design decision — project `circuit_breaker` fully replaces global `circuit_breaker`. Consistent with how `required_models` works. Do not introduce deep merge in Phase 7. |

**Installation:** No new packages. All changes are to existing files using Node.js stdlib.

---

## Architecture Patterns

### Recommended File Changes

```
hooks/
  qgsd-circuit-breaker.js         -- MODIFY: add enforcement output when state.active
  qgsd-circuit-breaker.test.js    -- MODIFY: update CB-TC7 + add new enforcement TCs
  config-loader.js                -- MODIFY: add circuit_breaker to DEFAULT_CONFIG + validateConfig()
  config-loader.test.js           -- MODIFY: add TCs for circuit_breaker config key
  (No new files)
```

### Pattern 1: PreToolUse Blocking Output Format

**What:** How to block a Bash command from a PreToolUse hook.
**When to use:** When circuit breaker is active and command is not read-only.

Source: https://code.claude.com/docs/en/hooks (PreToolUse decision control) + Phase 6 RESEARCH.md Pattern 2

```js
// CORRECT: PreToolUse blocking format
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: 'Circuit breaker active: ...'
  }
}));
process.exit(0);
```

**WRONG (do NOT use for PreToolUse):**
```js
// INCORRECT: this is Stop/PostToolUse format — silently fails for PreToolUse
process.stdout.write(JSON.stringify({ decision: 'block', reason: '...' }));
```

### Pattern 2: Block Reason Message Format

**What:** The required content for `permissionDecisionReason` per ENFC-02 and ENFC-03.
**Source:** REQUIREMENTS.md ENFC-02, ENFC-03

The block reason message MUST include all of these:
1. The oscillating file set (from `state.file_set[]`)
2. Confirmation that the circuit breaker is active
3. The list of allowed operations (read-only Bash: git log, git diff, grep, cat, ls, head, tail, find)
4. Instruction to perform root cause analysis and dependency mapping before resuming
5. Explicit instruction to the user to manually commit the fix (Claude cannot run git commit while blocked)

```js
function buildBlockReason(state) {
  const fileList = state.file_set.join(', ');
  return (
    `CIRCUIT BREAKER ACTIVE: Oscillating file set detected: [${fileList}]. ` +
    `The same file set has been modified in ${state.commit_window_snapshot.length} recent commits, ` +
    `indicating a fix/revert cycle. ` +
    `\n\nAllowed operations (read-only Bash only): git log, git diff, grep, cat, ls, head, tail, find. ` +
    `All other Bash commands are blocked until the circuit breaker is cleared. ` +
    `\n\nClaude MUST: (1) Perform root cause analysis to understand why the fix/revert pattern occurred. ` +
    `(2) Map dependencies between the coupled components before attempting any fix. ` +
    `Design a unified solution that resolves both components simultaneously. ` +
    `\n\nUser action required: Once the fix is designed and applied manually, ` +
    `run 'npx qgsd --reset-breaker' to clear the circuit breaker. ` +
    `Claude cannot run git commit while the breaker is active — you must commit the fix manually.`
  );
}
```

**Note:** The exact wording is illustrative — the planner should finalize wording to meet ENFC-02/03. The structure above is the minimum required content.

### Pattern 3: Updated Hook Control Flow

**What:** The full control flow for the Phase 7 hook (state.active now triggers block, not pass).

```
stdin -> parse JSON
  -> extract cwd, command
  -> getGitRoot(cwd)
      -> null? -> exit 0 (DETECT-05: no git repo)
  -> readState(gitRoot)
      -> state.active?
          -> isReadOnly(command)?
              -> yes -> exit 0 (read-only commands allowed even when blocked)
              -> no  -> BLOCK: emit hookSpecificOutput.permissionDecision: 'deny' (ENFC-01/02/03)
  -> isReadOnly(command)?
      -> yes -> exit 0 (DETECT-04)
  -> getCommitFileSets(gitRoot, config.circuit_breaker.commit_window)
  -> detectOscillation(sets, config.circuit_breaker.oscillation_depth)
      -> oscillating? -> writeState(gitRoot, { active:true, ... })
                      -> exit 0 (detection-only pass; no block on first detection turn)
      -> not oscillating? -> exit 0
```

**Critical ordering:** Read-only check happens AFTER the active-state check. Read-only commands are allowed even when the circuit breaker is active (per ENFC-01: "any non-read-only Bash command returns block").

### Pattern 4: config-loader Extension

**What:** How to add `circuit_breaker` to DEFAULT_CONFIG and validateConfig().
**Source:** `hooks/config-loader.js` — existing pattern for existing keys.

```js
// DEFAULT_CONFIG addition
const DEFAULT_CONFIG = {
  quorum_commands: [...],
  fail_mode: 'open',
  required_models: {...},
  circuit_breaker: {
    oscillation_depth: 3,
    commit_window: 6,
  },
};

// validateConfig() addition — validate AFTER the shallow merge
function validateConfig(config) {
  // ... existing validations ...

  // Validate circuit_breaker block
  if (!config.circuit_breaker || typeof config.circuit_breaker !== 'object') {
    process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker must be an object; using defaults\n');
    config.circuit_breaker = { ...DEFAULT_CONFIG.circuit_breaker };
  } else {
    // Validate oscillation_depth
    if (!Number.isInteger(config.circuit_breaker.oscillation_depth) || config.circuit_breaker.oscillation_depth < 1) {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.oscillation_depth invalid; using default 3\n');
      config.circuit_breaker.oscillation_depth = DEFAULT_CONFIG.circuit_breaker.oscillation_depth;
    }
    // Validate commit_window
    if (!Number.isInteger(config.circuit_breaker.commit_window) || config.circuit_breaker.commit_window < 1) {
      process.stderr.write('[qgsd] WARNING: qgsd.json: circuit_breaker.commit_window invalid; using default 6\n');
      config.circuit_breaker.commit_window = DEFAULT_CONFIG.circuit_breaker.commit_window;
    }
  }

  return config;
}
```

### Pattern 5: Config Integration in the Hook

**What:** How the hook reads `oscillation_depth` and `commit_window` from config.
**Source:** `hooks/qgsd-circuit-breaker.js` — Phase 6 hardcoded these as constants.

Phase 6 hook has:
```js
const OSCILLATION_DEPTH = 3;
const COMMIT_WINDOW = 6;
```

Phase 7 hook replaces these with config-driven values:
```js
// In main(), after getting gitRoot:
const config = loadConfig(gitRoot);
const oscillationDepth = config.circuit_breaker.oscillation_depth;
const commitWindow = config.circuit_breaker.commit_window;

// Then use oscillationDepth and commitWindow in place of hardcoded constants
const hashes = getCommitHashes(gitRoot, commitWindow);
const { detected, fileSet } = detectOscillation(fileSets, oscillationDepth);
```

`loadConfig(gitRoot)` uses the git root as the project directory — this is correct because the per-project `.claude/qgsd.json` lives at `gitRoot/.claude/qgsd.json`, which is exactly where the circuit breaker state file lives.

### Pattern 6: How Existing CB-TC7 Must Change

**What:** CB-TC7 currently asserts that active state + write command = exit 0 with empty stdout. Phase 7 inverts this.

Phase 6 CB-TC7 (must be updated):
```js
// CB-TC7 OLD: Phase 6 passes through — test expects stdout: ''
assert.strictEqual(stdout, '', 'stdout must be empty (Phase 6 passes)');
```

Phase 7 CB-TC7 (updated version):
```js
// CB-TC7 NEW: Phase 7 blocks — test expects hookSpecificOutput JSON in stdout
assert.ok(stdout.length > 0, 'stdout must contain block decision');
const decision = JSON.parse(stdout);
assert.ok(decision.hookSpecificOutput, 'must use hookSpecificOutput format');
assert.strictEqual(decision.hookSpecificOutput.permissionDecision, 'deny');
assert.ok(decision.hookSpecificOutput.permissionDecisionReason.includes('CIRCUIT BREAKER'));
```

### Anti-Patterns to Avoid

- **Wrong blocking format for PreToolUse:** Using `{ decision: 'block' }` instead of `{ hookSpecificOutput: { permissionDecision: 'deny' } }` silently allows the command. This is the single most dangerous error in Phase 7.
- **Blocking read-only commands when circuit breaker is active:** ENFC-01 specifies "any non-read-only Bash command" is blocked. Read-only commands (git log, git diff, grep, etc.) MUST still pass through even when `state.active === true`. This enables Claude to perform the required root cause analysis.
- **Using top-level process.cwd() for loadConfig():** Use `loadConfig(gitRoot)` so the project-level `.claude/qgsd.json` is found at the right path (relative to git root, not hook process cwd).
- **Deep-merging `circuit_breaker`:** The existing config system uses shallow merge. Do not introduce deep merge for the circuit_breaker sub-object. Project config that sets `circuit_breaker` replaces the entire global `circuit_breaker` object.
- **Changing validation flow:** `validateConfig()` is called after merge in `loadConfig()` — do not call it separately or in the hook. The existing flow already handles it.
- **Forgetting to update CB-TC7:** The Phase 6 test explicitly asserts `stdout === ''` when active state is present. Phase 7 must update this test case or it will fail.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config loading | Custom JSON reader for circuit_breaker | `loadConfig()` from `./config-loader` | Already handles two-layer merge, validation, and stderr warnings. Just add the new key. |
| Validation error format | Custom error output format | Existing `[qgsd] WARNING:` pattern | All warnings use this prefix; consistency enables grep-based log filtering. |
| Integer validation | Custom type checker | `Number.isInteger(v) && v >= 1` | Standard JS — no library needed. Matches the spirit of existing string/array checks. |

**Key insight:** Phase 7 is modifications to two existing files following established patterns. Every new behavior has a precedent in the existing codebase. The most important constraint is the PreToolUse output format — get that right and the rest is straightforward.

---

## Common Pitfalls

### Pitfall 1: Wrong PreToolUse Output Format

**What goes wrong:** Hook uses top-level `{ "decision": "block" }` instead of `{ "hookSpecificOutput": { "permissionDecision": "deny" } }`. The command executes normally — no error, no block, no feedback.
**Why it happens:** The Stop hook uses top-level `decision: 'block'`. It is easy to copy that pattern to PreToolUse. But they are different hook types with different output schemas.
**How to avoid:** Always use `hookSpecificOutput.permissionDecision: 'deny'` for PreToolUse. Test that blocked commands in CB-TC7 actually produce non-empty stdout with parseable JSON containing the `hookSpecificOutput` key.
**Warning signs:** CB-TC7 test asserts stdout is non-empty but the hook still exits 0 with empty stdout — means the output format was wrong and Claude Code silently ignored it.

### Pitfall 2: Blocking Read-Only Commands Under Active Circuit Breaker

**What goes wrong:** The `if (state && state.active)` block runs before `isReadOnly()` and blocks everything including git log, grep, cat.
**Why it happens:** Logical ordering error — active check comes before read-only check.
**How to avoid:** In the `state.active` branch, check `isReadOnly(command)` first. If read-only, exit 0. Only then emit the block decision. The control flow in Pattern 3 above shows the correct ordering.
**Warning signs:** Claude cannot run `git log` to perform root cause analysis — the breaker becomes a dead-end that violates ENFC-02's stated allowed operations.

### Pitfall 3: Shallow Merge Erases Global `circuit_breaker` When Project Sets Any Key

**What goes wrong:** A project config with `{ "circuit_breaker": { "oscillation_depth": 5 } }` replaces the entire global `circuit_breaker` object, losing `commit_window`.
**Why it happens:** This is by design — shallow merge is the existing behavior. `required_models` behaves the same way. This is NOT a bug.
**How to avoid:** Document it in the config template (Phase 8 concern). Validation in `validateConfig()` will detect missing keys and fall back to defaults for individual missing sub-keys. Design the validator to check each sub-key independently, not just whether the parent object exists.
**Warning signs:** After setting `oscillation_depth: 5` in project config, `commit_window` reverts to default 6 — this is correct behavior, not a bug.

### Pitfall 4: `loadConfig(gitRoot)` vs `loadConfig()` in the Hook

**What goes wrong:** Calling `loadConfig()` without arguments uses `process.cwd()` as the project directory. In the hook, `process.cwd()` is unreliable (depends on how Claude Code spawns the hook process).
**Why it happens:** Same pitfall as using `process.cwd()` instead of `input.cwd` — hook process cwd is not the project dir.
**How to avoid:** Always call `loadConfig(gitRoot)` where `gitRoot` was resolved from `input.cwd` via `getGitRoot(cwd)`. This ensures per-project config is read from the right location.
**Warning signs:** Project-specific `circuit_breaker` settings in `.claude/qgsd.json` are ignored — hook always uses global or default values.

### Pitfall 5: Config-Loader Validation Must Handle Missing Sub-Keys Within a Valid Object

**What goes wrong:** Project sets `{ "circuit_breaker": { "oscillation_depth": 5 } }` — the merged object is `{ oscillation_depth: 5 }` (missing `commit_window`). If validator only checks that `circuit_breaker` is an object (not that each sub-key is valid), `commit_window` is `undefined` and `getCommitHashes(gitRoot, undefined)` runs `git log -undefined` which fails.
**How to avoid:** Validate each sub-key individually after checking the parent object exists. Assign defaults for any missing or invalid sub-keys. The code example in Pattern 4 shows the correct two-level validation.
**Warning signs:** Hook errors with git arguments like `-undefined` or oscillation detection never triggers because the window is NaN.

### Pitfall 6: test suite regression — CB-TC7 must be updated before GREEN phase

**What goes wrong:** CB-TC7 asserts `stdout === ''` for an active-state + write-command scenario. Phase 7 hook emits blocking JSON — CB-TC7 fails immediately.
**Why it happens:** Phase 6 deliberately constrained Phase 7 behavior in that test comment ("Phase 6 passes"). Phase 7 must update the test before running.
**How to avoid:** Update CB-TC7 at the start of RED phase (before implementing the hook change). The RED phase should show CB-TC7 failing with "wrong stdout" before the hook changes, then passing after.

---

## Code Examples

### Enforcement: Blocking a Write Command When Breaker Is Active

```js
// In main(), after getting gitRoot and reading state:
const state = readState(statePath);
if (state && state.active) {
  if (!isReadOnly(command)) {
    // ENFC-01/02/03: Block non-read-only commands, emit structured reason
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: buildBlockReason(state),
      }
    }));
  }
  // Read-only commands pass through even when breaker is active
  process.exit(0);
}
```

Source: Phase 6 RESEARCH.md Pattern 2 (official docs reference) + REQUIREMENTS.md ENFC-01/02/03

### Config-Loader: DEFAULT_CONFIG Extension

```js
const DEFAULT_CONFIG = {
  quorum_commands: [
    'plan-phase', 'new-project', 'new-milestone',
    'discuss-phase', 'verify-work', 'research-phase',
  ],
  fail_mode: 'open',
  required_models: {
    codex:    { tool_prefix: 'mcp__codex-cli__',  required: true },
    gemini:   { tool_prefix: 'mcp__gemini-cli__', required: true },
    opencode: { tool_prefix: 'mcp__opencode__',   required: true },
  },
  circuit_breaker: {
    oscillation_depth: 3,
    commit_window: 6,
  },
};
```

Source: REQUIREMENTS.md CONF-06, CONF-07 (defaults specified explicitly)

### Config-Loader: Test Case Pattern for New Key

```js
// New TC for circuit_breaker defaults
test('TC-CB1: DEFAULT_CONFIG includes circuit_breaker with correct defaults', () => {
  assert.ok(DEFAULT_CONFIG.circuit_breaker, 'circuit_breaker must be present');
  assert.strictEqual(DEFAULT_CONFIG.circuit_breaker.oscillation_depth, 3);
  assert.strictEqual(DEFAULT_CONFIG.circuit_breaker.commit_window, 6);
});

// New TC for invalid oscillation_depth
test('TC-CB2: invalid circuit_breaker.oscillation_depth falls back to default with warning', () => {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-cb2-'));
  const stderrChunks = [];
  // ... capture stderr ...
  try {
    writeTempConfig(projectDir, JSON.stringify({ circuit_breaker: { oscillation_depth: 'not-a-number', commit_window: 4 } }));
    const config = loadConfig(projectDir);
    assert.strictEqual(config.circuit_breaker.oscillation_depth, 3); // falls back
    assert.strictEqual(config.circuit_breaker.commit_window, 4);     // valid, kept
    assert.ok(stderrOutput.includes('[qgsd] WARNING:'));
  } finally {
    // cleanup
  }
});
```

Source: `hooks/config-loader.test.js` — existing test pattern adapted for new key

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `OSCILLATION_DEPTH = 3`, `COMMIT_WINDOW = 6` constants in hook | Config-driven via `loadConfig(gitRoot).circuit_breaker.oscillation_depth` | Phase 7 (this phase) | Users can tune thresholds per-project or globally without code changes |
| Phase 6 hook always exits 0 (no blocking) | Hook emits `hookSpecificOutput.permissionDecision: 'deny'` when `state.active && !isReadOnly` | Phase 7 (this phase) | Structural enforcement: Claude cannot execute write Bash when breaker is active |
| Top-level `decision: 'block'` for Stop hook | `hookSpecificOutput.permissionDecision: 'deny'` for PreToolUse hook | Existing distinction, confirmed in Phase 6 research | Different hook types have different output schemas — PreToolUse is NOT Stop hook |

**Deprecated/outdated:**
- Hardcoded `OSCILLATION_DEPTH` and `COMMIT_WINDOW` constants: replaced by `config.circuit_breaker.*` after Phase 7. Remove the constants from the hook.

---

## TDD Test Plan

### New/Modified Test Cases for `hooks/qgsd-circuit-breaker.test.js`

| TC# | Type | Description | Expected |
|-----|------|-------------|----------|
| CB-TC7 (update) | Modified | Write command with existing active state, non-read-only | stdout contains `hookSpecificOutput.permissionDecision: 'deny'`; block reason includes file set, "CIRCUIT BREAKER", allowed operations list, user commit instruction |
| CB-TC16 (new) | New | Read-only command (git log) with active state | exit 0, stdout empty — read-only passes even when breaker is active |
| CB-TC17 (new) | New | Active state, block reason message content | Verify reason includes oscillating file set names, allowed ops list, root cause analysis instruction, user-commit instruction |
| CB-TC18 (new) | New | Config: hook reads oscillation_depth from config | Create repo with 2 oscillation commits (below default depth=3), but hook config sets depth=2 → breaker activates |
| CB-TC19 (new) | New | Config: hook reads commit_window from config | Verify hook uses commit_window from config (via temp project config) |

**Note on CB-TC18/CB-TC19:** Testing config integration in the hook requires a way to supply a test config. Options: (a) create a `.claude/qgsd.json` in the temp repo (since `loadConfig(gitRoot)` will find it), or (b) use an env var override if one is added. Option (a) is cleanest — it tests the real path without mocking.

### New Test Cases for `hooks/config-loader.test.js`

| TC# | Description | Expected |
|-----|-------------|----------|
| TC-CB1 | DEFAULT_CONFIG includes circuit_breaker with correct defaults | `oscillation_depth: 3`, `commit_window: 6` |
| TC-CB2 | Valid `circuit_breaker` in project config overrides defaults | Values from config used |
| TC-CB3 | `circuit_breaker.oscillation_depth` is non-integer (string) | Falls back to 3, stderr WARNING |
| TC-CB4 | `circuit_breaker.commit_window` is negative integer | Falls back to 6, stderr WARNING |
| TC-CB5 | `circuit_breaker` is null (not an object) | Entire block falls back to defaults, stderr WARNING |
| TC-CB6 | `circuit_breaker` has only `oscillation_depth` (missing `commit_window`) | `oscillation_depth` used, `commit_window` falls back to 6 (shallow merge leaves it missing) |
| TC-CB7 | `loadConfig()` never writes to stdout when circuit_breaker is invalid | stdout remains empty |

---

## Open Questions

1. **Exact block reason wording**
   - What we know: ENFC-02/03 specifies required content (file set, active confirmation, allowed ops, root cause instruction, user commit instruction)
   - What's unclear: Exact phrasing and ordering of components in the message
   - Recommendation: Planner finalizes wording as long as all five content elements are present. The test should check for key phrases (e.g., "CIRCUIT BREAKER", "root cause", "manually commit") rather than exact string equality.

2. **CB-TC18/CB-TC19 test implementation**
   - What we know: `loadConfig(gitRoot)` reads `.claude/qgsd.json` from `gitRoot` — creating this file in the temp repo will supply custom config
   - What's unclear: Whether this requires any additional test helper
   - Recommendation: Write a helper `writeTempProjectConfig(repoDir, content)` that creates `.claude/qgsd.json` inside the temp repo. Same pattern as existing `writeTempConfig()` in `config-loader.test.js`.

3. **Whether `permissionDecisionReason` length limit exists**
   - What we know: Block reason must be fairly long (five required content elements)
   - What's unclear: Whether Claude Code truncates `permissionDecisionReason` at some length
   - Recommendation: Proceed with the full message. If truncation is discovered in live testing, the message can be condensed. No evidence of truncation in official docs.

---

## Sources

### Primary (HIGH confidence)

- `hooks/qgsd-circuit-breaker.js` (project file, Phase 6 output) — exact control flow to modify; `isReadOnly()`, `readState()`, `getGitRoot()`, module structure
- `hooks/config-loader.js` (project file) — `DEFAULT_CONFIG` shape, `validateConfig()` pattern, `loadConfig()` API
- `hooks/config-loader.test.js` (project file) — TC pattern: temp dir, stderr capture, cleanup in finally blocks
- `hooks/qgsd-circuit-breaker.test.js` (project file) — CB-TC7 to update, spawnSync runner, git temp repo helpers
- `.planning/REQUIREMENTS.md` — ENFC-01/02/03/CONF-06/07/08/09 exact specifications
- `.planning/phases/06-circuit-breaker-detection-and-state/06-RESEARCH.md` — Pattern 2 (PreToolUse blocking format), Pattern 3 (control flow), Anti-patterns section
- `.planning/phases/06-circuit-breaker-detection-and-state/06-01-SUMMARY.md` — confirmed Phase 6 delivered: detection only (pass-through), hardcoded defaults, state persistence

### Secondary (MEDIUM confidence)

- `templates/qgsd.json` — existing template structure; Phase 7 does NOT modify this (that is Phase 8)
- `scripts/build-hooks.js` — Phase 7 does NOT modify this (build wiring unchanged)
- Phase 6 RESEARCH.md cites: https://code.claude.com/docs/en/hooks — PreToolUse `hookSpecificOutput.permissionDecision` format

### Tertiary (LOW confidence)

- None. All critical findings verified against existing project code and Phase 6 research.

---

## Metadata

**Confidence breakdown:**
- PreToolUse blocking format: HIGH — confirmed from official docs in Phase 6 research + existing code reference
- Config-loader extension pattern: HIGH — verified against `config-loader.js` source code directly
- Control flow ordering (read-only before block): HIGH — derived from ENFC-01 spec ("non-read-only Bash command")
- Shallow merge behavior: HIGH — confirmed from existing code and Phase 2 decision log in STATE.md
- Test case patterns: HIGH — copied directly from existing test files in project
- Block reason exact wording: MEDIUM — content requirements are HIGH confidence (from REQUIREMENTS.md), exact wording is LOW (no prescribed format)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (Claude Code hook API stable; config-loader pattern stable)
