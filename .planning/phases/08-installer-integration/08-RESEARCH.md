# Phase 8: Installer Integration - Research

**Researched:** 2026-02-21
**Domain:** Node.js CLI installer modification — hook registration + idempotent config extension + CLI flag handling
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INST-08 | Installer registers PreToolUse circuit breaker hook in `~/.claude/settings.json` alongside existing hooks | Pattern for registering Stop/UserPromptSubmit hooks in `install()` is the exact template; same idempotency guard applies. |
| INST-09 | Installer writes default `circuit_breaker` config block to qgsd.json on first install | qgsdConfig object is built in-memory then written with `fs.writeFileSync`; adding `circuit_breaker` key to that object is the only change needed. |
| INST-10 | Reinstall (idempotent) adds missing `circuit_breaker` config block without overwriting user-modified values | Existing reinstall path reads, parses, and prints active config but never updates it; new branch must check for missing key and merge only that key. |
| RECV-01 | `npx qgsd --reset-breaker` CLI flag clears `.claude/circuit-breaker-state.json` and logs confirmation | No `--reset-breaker` arg handling exists today; new top-level arg parse + action needed before the main install routing block. |
</phase_requirements>

---

## Summary

Phase 8 integrates the circuit breaker hook (built in Phases 6–7) into the installer (`bin/install.js`). There are exactly four changes needed: (1) register `qgsd-circuit-breaker.js` as a PreToolUse hook in `~/.claude/settings.json`, (2) add the `circuit_breaker` block to the qgsdConfig object written on first install, (3) on reinstall, check whether an existing `qgsd.json` is missing `circuit_breaker` and patch only that key, and (4) implement the `--reset-breaker` CLI flag that deletes `.claude/circuit-breaker-state.json` in the current working directory.

The hook is already compiled into `hooks/dist/qgsd-circuit-breaker.js` (done in Phase 7's final build step). The installer already copies all files from `hooks/dist/` to `~/.claude/hooks/` (the `hooksSrc` block in `install()`). The only missing steps are the settings.json registration and the config-file updates. No new dependencies, no new files.

The `--reset-breaker` flag operates on the project-level state file (`.claude/circuit-breaker-state.json` relative to `process.cwd()`), not on the global config directory. It is a pure fs.rm operation — it does not trigger an install and does not require a runtime selection.

**Primary recommendation:** Extend `bin/install.js` with minimal, surgical changes: one idempotent PreToolUse hook registration block, one `circuit_breaker` key in the new-install config, one idempotent patch for the reinstall path, and one top-level `--reset-breaker` handler that exits before the install routing logic.

---

## Standard Stack

### Core
| Component | Version/Source | Purpose | Why Standard |
|-----------|---------------|---------|--------------|
| Node.js `fs` | stdlib | Read/write settings.json and qgsd.json | Already used throughout `bin/install.js` |
| Node.js `path` + `os` | stdlib | Resolve config directory paths | Already used throughout `bin/install.js` |
| Existing `readSettings()` / `writeSettings()` | `bin/install.js` helpers | Parse and persist settings.json | Already proven idempotent by Stop/UPS hook registration pattern |
| `buildHookCommand(targetDir, hookName)` | `bin/install.js` helper | Construct `node "/path/hooks/file.js"` command string | Ensures cross-platform path formatting matches existing hooks |

### No New Dependencies
This phase requires zero new npm packages. All logic is pure fs/path operations using existing installer helpers.

---

## Architecture Patterns

### Existing Hook Registration Pattern (from install.js lines 1686–1709)

The UserPromptSubmit and Stop hooks are registered with this exact structure — PreToolUse follows the same pattern:

```javascript
// Source: bin/install.js (existing UserPromptSubmit pattern)
if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
const hasQgsdPromptHook = settings.hooks.UserPromptSubmit.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-prompt'))
);
if (!hasQgsdPromptHook) {
  settings.hooks.UserPromptSubmit.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-prompt.js') }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD quorum injection hook (UserPromptSubmit)`);
}
```

PreToolUse follows the identical structure:

```javascript
// Pattern for INST-08 (PreToolUse circuit breaker hook)
if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
const hasCircuitBreakerHook = settings.hooks.PreToolUse.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-circuit-breaker'))
);
if (!hasCircuitBreakerHook) {
  settings.hooks.PreToolUse.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-circuit-breaker.js') }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD circuit breaker hook (PreToolUse)`);
}
```

**Placement:** Insert immediately after the Stop hook registration block (around line 1709), still inside the `if (!isOpencode)` guard (circuit breaker is Claude Code-only in v0.2).

### New-Install Config Pattern (INST-09)

The qgsdConfig object is built at line 1723 and written at line 1734. Add `circuit_breaker` to this object:

```javascript
// Source: bin/install.js (existing qgsdConfig construction, lines 1723-1732)
const qgsdConfig = {
  quorum_commands: [...],
  fail_mode: 'open',
  required_models: detectedModels,
  quorum_instructions: buildQuorumInstructions(detectedModels),
  // INST-09: Add circuit_breaker defaults
  circuit_breaker: {
    oscillation_depth: 3,
    commit_window: 6,
  },
};
```

These values mirror `DEFAULT_CONFIG.circuit_breaker` in `hooks/config-loader.js` exactly. No magic numbers.

### Idempotent Reinstall Patch Pattern (INST-10)

The reinstall path (the `else` branch at line 1736) currently only reads the existing config to print a summary. It must also check for a missing `circuit_breaker` key and add it only if absent:

```javascript
// Source: bin/install.js reinstall path (lines 1736-1749)
} else {
  try {
    const existingConfig = JSON.parse(fs.readFileSync(qgsdConfigPath, 'utf8'));
    // ... existing summary print ...

    // INST-10: Idempotent circuit_breaker backfill
    if (!existingConfig.circuit_breaker) {
      existingConfig.circuit_breaker = { oscillation_depth: 3, commit_window: 6 };
      fs.writeFileSync(qgsdConfigPath, JSON.stringify(existingConfig, null, 2) + '\n', 'utf8');
      console.log(`  ${green}✓${reset} Added circuit_breaker config block to qgsd.json`);
    }
  } catch {
    console.log(`  ${dim}↳ ~/.claude/qgsd.json already exists — skipping (user config preserved)${reset}`);
  }
}
```

**Critical constraint:** Only the presence of `circuit_breaker` key is checked. If the key exists (even with user-modified values), it is left entirely untouched. This satisfies INST-10's "existing block is left intact" requirement.

### `--reset-breaker` CLI Flag Pattern (RECV-01)

The flag is handled at the top of the file before the main routing block. It is a project-level operation — it acts on the _current working directory_, not the global install directory:

```javascript
// Source: new top-level handler (before main logic at line 1976)
const hasResetBreaker = args.includes('--reset-breaker');

// In main routing:
if (hasResetBreaker) {
  const stateFile = path.join(process.cwd(), '.claude', 'circuit-breaker-state.json');
  if (fs.existsSync(stateFile)) {
    fs.rmSync(stateFile);
    console.log(`  ${green}✓${reset} Circuit breaker state cleared. Claude can resume Bash execution.`);
    console.log(`    Removed: ${stateFile.replace(os.homedir(), '~')}`);
  } else {
    console.log(`  ${dim}No active circuit breaker state found at ${stateFile.replace(os.homedir(), '~')}${reset}`);
  }
  process.exit(0);
}
```

**Placement:** Parse `hasResetBreaker` alongside other args at the top (line 28-30 block). Add the routing handler at the top of the main logic block (before the `hasGlobal && hasLocal` check), so `--reset-breaker` exits before any install logic runs.

### Recommended Project Structure (no changes)

```
bin/
└── install.js      # All 4 changes in this single file
hooks/
└── dist/
    └── qgsd-circuit-breaker.js  # Already built (Phase 7)
templates/
└── qgsd.json       # No change needed (template is documentation-only; install.js builds config in-memory)
```

The `templates/qgsd.json` file is not used by the installer — the installer builds the config object in memory. The template is only documentation/reference. It SHOULD be updated in this phase to include `circuit_breaker` for completeness, but the installer does not read it.

### Anti-Patterns to Avoid

- **Updating `circuit_breaker` if it exists:** INST-10 requires a missing block be added. An existing block (even with different values) must be left intact. Never deep-merge or overwrite.
- **Applying `--reset-breaker` to the global config dir:** The state file lives at `.claude/circuit-breaker-state.json` relative to the project (process.cwd()), not `~/.claude/`. Clearing the wrong file would have no effect.
- **Registering PreToolUse inside the OpenCode guard:** Circuit breaker is Claude Code-only in v0.2. The existing `if (!isOpencode)` guard correctly scopes Stop + UPS hooks. PreToolUse registration must be inside the same guard.
- **Omitting the `isOpencode` guard check:** The `isOpencode` local variable is set by `runtime === 'opencode'`. PreToolUse registration belongs inside `if (!isOpencode)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hook command path construction | Custom string concat | `buildHookCommand(targetDir, hookName)` | Handles Windows backslash → forward slash, proper quoting |
| Settings read/write | Direct `fs.readFileSync` | `readSettings()` / `writeSettings()` | Handles missing file gracefully, writes with consistent 2-space indent + newline |
| Idempotency check | Hash comparison or deep diff | `.some(entry => entry.hooks.some(h => h.command.includes('...')))` | Exact same pattern as all other hook registrations; consistent, proven |

---

## Common Pitfalls

### Pitfall 1: `--reset-breaker` path resolves to global dir, not project dir
**What goes wrong:** Developer uses `getGlobalDir()` or `targetDir` for the state file path instead of `process.cwd()`.
**Why it happens:** The install code is full of `targetDir` references. The state file is project-relative, not install-relative.
**How to avoid:** Use `path.join(process.cwd(), '.claude', 'circuit-breaker-state.json')` explicitly.
**Warning signs:** The confirmation message shows `~/.claude/circuit-breaker-state.json` instead of the project path.

### Pitfall 2: PreToolUse hook registered outside `if (!isOpencode)` guard
**What goes wrong:** Circuit breaker hook gets registered for OpenCode installs, but OpenCode does not support PreToolUse hooks in the same format.
**Why it happens:** Copy-pasting the hook registration block without noticing the guard scope.
**How to avoid:** Verify the PreToolUse block is inside `if (!isOpencode)` by checking the closing brace at line 1750.
**Warning signs:** No visible failure at install time, but OpenCode installs get a spurious settings.json entry.

### Pitfall 3: `circuit_breaker` values diverge from `config-loader.js` defaults
**What goes wrong:** `install.js` hardcodes `oscillation_depth: 3, commit_window: 6` but `DEFAULT_CONFIG` in `config-loader.js` uses different values (or vice versa after future changes).
**Why it happens:** The constants exist in two places without a shared source.
**How to avoid:** Document the source of truth in a comment. The defaults are: oscillation_depth=3, commit_window=6. Both files should use these identical values.
**Warning signs:** A fresh install produces a qgsd.json that contradicts the hook's behavior.

### Pitfall 4: Reinstall path overwrites user-modified `circuit_breaker` block
**What goes wrong:** Developer uses `Object.assign` or spread to merge the entire qgsdConfig into existingConfig, replacing user values.
**Why it happens:** Merge-on-reinstall is a natural instinct for "add missing defaults."
**How to avoid:** Only add the `circuit_breaker` key when `!existingConfig.circuit_breaker`. Never touch sub-keys if the parent key exists.
**Warning signs:** A user who set `oscillation_depth: 5` sees it reset to 3 after `npx qgsd@latest`.

### Pitfall 5: `--reset-breaker` runs interactively or prompts for runtime
**What goes wrong:** The handler falls through to `promptRuntime()` because it's not early-exited before the routing block.
**Why it happens:** Placing the `--reset-breaker` check after the main routing instead of before.
**How to avoid:** `--reset-breaker` must call `process.exit(0)` before the `if (hasGlobal && hasLocal)` block at line 1976.
**Warning signs:** `npx qgsd --reset-breaker` asks "Which runtime?" or starts installing files.

---

## Code Examples

### Full idempotency check pattern for PreToolUse (verified from install.js source)

```javascript
// Source: bin/install.js (existing Stop hook registration — identical structure for PreToolUse)
if (!settings.hooks.Stop) settings.hooks.Stop = [];
const hasQgsdStopHook = settings.hooks.Stop.some(entry =>
  entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-stop'))
);
if (!hasQgsdStopHook) {
  settings.hooks.Stop.push({
    hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-stop.js'), timeout: 30 }]
  });
  console.log(`  ${green}✓${reset} Configured QGSD quorum gate hook (Stop)`);
}
```

Note: The Stop hook has a `timeout: 30` field. The circuit breaker hook may benefit from a timeout too (git operations can block). A `timeout: 10` is appropriate — detection involves `spawnSync` calls to git with 5s timeouts internally, so a 10s wall-clock budget is safe.

### `fs.rmSync` for state file deletion

```javascript
// Source: Node.js stdlib — fs.rmSync available since Node 14.14
fs.rmSync(stateFile);  // For files, no options needed (not recursive)
```

`fs.unlinkSync` is equivalent for a single file and is also acceptable. `fs.rmSync` without `{ recursive: true }` is identical to `fs.unlinkSync` for files.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `--reset-breaker` not implemented | New top-level flag, exits before install logic | RECV-01 |
| `qgsdConfig` lacks `circuit_breaker` | Add key to new-install config object | INST-09 |
| Reinstall path is read-only summary | Reinstall path adds missing `circuit_breaker` key | INST-10 |
| PreToolUse not registered | New idempotent registration block | INST-08 |
| `hooks/dist/qgsd-circuit-breaker.js` absent | Already present (Phase 7 build) | No action needed |
| `templates/qgsd.json` lacks `circuit_breaker` | Should be updated for documentation completeness | Low priority, no functional impact |

---

## Open Questions

1. **Should PreToolUse hook have a `timeout` field?**
   - What we know: The circuit breaker hook does `spawnSync` git calls with internal 5s timeouts. The Stop hook has `timeout: 30`. The UPS hook has no timeout.
   - What's unclear: Whether Claude Code's PreToolUse timeout behavior differs from Stop timeout behavior.
   - Recommendation: Add `timeout: 10` for safety (git operations + JSON parse should complete in under 10s). The planner can verify against Claude Code docs and adjust.

2. **Should `--reset-breaker` accept a `--project-dir` override?**
   - What we know: The state file is at `.claude/circuit-breaker-state.json` relative to `process.cwd()`. RECV-01 only requires clearing the file and logging confirmation.
   - What's unclear: Whether users would need to clear a breaker from a different directory.
   - Recommendation: Not in scope for v0.2. Use `process.cwd()` only. Future work if needed.

3. **Should `templates/qgsd.json` be updated?**
   - What we know: The installer builds qgsdConfig in-memory; the template is never read by install.js. The template is documentation.
   - What's unclear: Whether any user-facing doc references the template.
   - Recommendation: Update `templates/qgsd.json` to include `circuit_breaker` block in this phase for completeness. Low cost, good practice.

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `/Users/jonathanborduas/code/QGSD/bin/install.js` — full installer code; hook registration patterns, qgsdConfig construction, arg parsing
- Direct source read: `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — DEFAULT_CONFIG.circuit_breaker values (oscillation_depth: 3, commit_window: 6)
- Direct source read: `/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js` — state file path: `.claude/circuit-breaker-state.json` (relative to gitRoot)
- Direct source read: `.planning/REQUIREMENTS.md` — INST-08, INST-09, INST-10, RECV-01 definitions
- Direct source read: `.planning/phases/07-enforcement-config-integration/07-02-SUMMARY.md` — confirmed hooks/dist is up to date, circuit breaker enforcement live

### Secondary (MEDIUM confidence)
- None required — all research drawn from in-repo source code

### Tertiary (LOW confidence)
- None — no web search needed; all required information is in the existing codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — entire stack is Node.js stdlib + existing install.js helpers
- Architecture: HIGH — patterns traced directly from existing working code in install.js
- Pitfalls: HIGH — derived from reading actual code paths and INST-10's idempotency requirement
- Open questions: LOW — minor details (timeout value) that planner can specify

**Research date:** 2026-02-21
**Valid until:** Stable (install.js is unlikely to change before Phase 8 execution)
