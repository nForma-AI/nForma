---
phase: 08-installer-integration
verified: 2026-02-21
verifier: gsd-verifier (spawned from Phase 10 Plan 03)
status: passed
requirements_verified: [INST-08, INST-09, INST-10, RECV-01]
bug_fixes_verified:
  - "INST-08 uninstall: uninstall() now removes PreToolUse hook (Plan 10-01)"
  - "RECV-01 path mismatch: --reset-breaker now uses git root (Plan 10-01)"
  - "INST-10 sub-key backfill: reinstall now backfills missing sub-keys (Plan 10-01)"
---

# Phase 8 Verification Report

**Verified by:** gsd-verifier agent (Phase 10 Plan 03)
**Source:** bin/install.js
**Dependencies confirmed:** Plan 10-01 bug fixes applied before this verification

---

## Requirements

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| INST-08 (install) | Installer registers PreToolUse circuit breaker hook in ~/.claude/settings.json inside !isOpencode guard | PASS | Lines 1695-1757: `if (!isOpencode)` block at line 1695; INST-08 comment at line 1747; idempotency guard at lines 1749-1751; push at lines 1753-1755 |
| INST-08 (uninstall fix) | uninstall() removes the PreToolUse hook entry (Plan 10-01 bug fix) | PASS | Lines 1109-1118: filters entries where command includes 'qgsd-circuit-breaker'; node -e confirms `has PreToolUse removal: true` and `has circuit-breaker filter: true` |
| INST-09 | Fresh install writes circuit_breaker: { oscillation_depth: 3, commit_window: 6 } to qgsd.json | PASS | Lines 1780-1784: INST-09 comment at 1780, circuit_breaker block written with oscillation_depth:3, commit_window:6 on first install (when !fs.existsSync(qgsdConfigPath)) |
| INST-10 (sub-key fix) | Reinstall backfills missing circuit_breaker block AND missing individual sub-keys without overwriting user values (Plan 10-01 bug fix) | PASS | Lines 1800-1820: if !existingConfig.circuit_breaker adds full block; else branch individually checks oscillation_depth === undefined and commit_window === undefined; node -e confirms both backfill checks present |
| RECV-01 (path fix) | --reset-breaker resolves state file path from git root (not raw cwd), deletes .claude/circuit-breaker-state.json, logs confirmation (Plan 10-01 bug fix) | PASS | Lines 2051-2069: spawnSync('git', ['rev-parse', '--show-toplevel']); projectRoot = gitResult.stdout.trim() on success, fallback to process.cwd(); path.join(projectRoot, '.claude', 'circuit-breaker-state.json'); functional test PASSED |

---

## Test Suite

| Suite | Tests | Status |
|-------|-------|--------|
| npm test (all suites) | 141/141 | PASS |

Test output: `ℹ pass 141 / ℹ fail 0 / ℹ duration_ms 4884.537292`

---

## Key Evidence

### INST-08 Install — grep evidence

```
1747:    // INST-08: Register QGSD circuit breaker hook (PreToolUse — Claude Code only)
1748:    if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
1749:    const hasCircuitBreakerHook = settings.hooks.PreToolUse.some(entry =>
1750:      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-circuit-breaker'))
1751:    );
1752:    if (!hasCircuitBreakerHook) {
1753:      settings.hooks.PreToolUse.push({
1754:        hooks: [{ type: 'command', command: buildHookCommand(targetDir, 'qgsd-circuit-breaker.js'), timeout: 10 }]
1755:      });
1756:      console.log(`  ✓ Configured QGSD circuit breaker hook (PreToolUse)`);
1757:    }
```

Context: entire block is inside `if (!isOpencode)` guard at line 1695 — Claude Code only, not OpenCode.

### INST-08 Uninstall — node -e output (Plan 10-01 fix confirmed)

```
has PreToolUse removal: true
has circuit-breaker filter: true
```

Source lines 1109-1118:
```js
if (settings.hooks && settings.hooks.PreToolUse) {
  const before = settings.hooks.PreToolUse.length;
  settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter(entry =>
    !(entry.hooks && entry.hooks.some(h => h.command && h.command.includes('qgsd-circuit-breaker')))
  );
  if (settings.hooks.PreToolUse.length < before) {
    settingsModified = true;
    console.log(`  ✓ Removed QGSD circuit breaker hook`);
  }
  if (settings.hooks.PreToolUse.length === 0) delete settings.hooks.PreToolUse;
}
```

### INST-09 — fresh install config block

```
// INST-09: Must match DEFAULT_CONFIG.circuit_breaker in hooks/config-loader.js
circuit_breaker: {
  oscillation_depth: 3,
  commit_window: 6,
},
```

Located at lines 1780-1784, within the `if (!fs.existsSync(qgsdConfigPath))` branch — writes only on first install.

### INST-10 — sub-key backfill (Plan 10-01 fix confirmed)

```
has sub-key backfill oscillation_depth: true
has sub-key backfill commit_window: true
```

Source lines 1800-1820: Two-tier backfill logic:
- If `!existingConfig.circuit_breaker` — adds full block `{ oscillation_depth: 3, commit_window: 6 }`
- Else — individually checks `oscillation_depth === undefined` and `commit_window === undefined`, adds missing sub-keys without touching user-set values

Example scenario: a user config with `{ oscillation_depth: 5 }` enters the else branch, keeps oscillation_depth:5, gets commit_window:6 added.

### RECV-01 — git root resolution (Plan 10-01 fix confirmed)

```
uses git rev-parse: true
uses projectRoot: true
state file from projectRoot: true
fallback to cwd: true
```

Source lines 2051-2070:
```js
if (hasResetBreaker) {
  const { spawnSync } = require('child_process');
  const gitResult = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 5000,
  });
  const projectRoot = (gitResult.status === 0 && !gitResult.error)
    ? gitResult.stdout.trim()
    : process.cwd();
  const stateFile = path.join(projectRoot, '.claude', 'circuit-breaker-state.json');
  ...
  process.exit(0);
}
```

### RECV-01 — Functional test result

Test: create temp git repo, write `.claude/circuit-breaker-state.json` at git root, create `src/` subdirectory, run `node bin/install.js --reset-breaker` from `src/`.

```
state cleared from subdir: true
stdout includes cleared message: true
stdout: [includes banner + "✓ Circuit breaker state cleared. Claude can resume Bash execution." +
         "    Removed: /tmp/qgsd-recv01-.../. claude/circuit-breaker-state.json"]
```

Git root resolution from subdirectory works correctly — state file deleted at project root, not in cwd (src/).

---

## Bug Fixes Verified

All three bugs identified in the v0.2 audit and fixed by Plan 10-01 are confirmed present in bin/install.js:

### 1. INST-08 Uninstall Gap (Plan 10-01)

**Original bug:** `uninstall()` function removed UserPromptSubmit and Stop hooks but never touched PreToolUse — the circuit breaker hook remained in settings.json after uninstall.

**Fix confirmed:** Lines 1109-1118 in `uninstall()` now filter `settings.hooks.PreToolUse` entries where command includes 'qgsd-circuit-breaker'. Sets `settingsModified = true` and logs "Removed QGSD circuit breaker hook". Deletes the key if array becomes empty.

### 2. RECV-01 Path Mismatch (Plan 10-01)

**Original bug:** `--reset-breaker` used `process.cwd()` directly for the state file path. When invoked from a subdirectory of a git repo, it constructed the wrong path and could not find or delete the state file (which lives at project root).

**Fix confirmed:** Lines 2053-2060 now call `git rev-parse --show-toplevel` first. `projectRoot` is set to the git root on success, falling back to `process.cwd()` only if git command fails (non-git directory). State file path is built from `projectRoot`. Functional test confirms state cleared correctly from a subdirectory.

### 3. INST-10 Sub-Key Backfill (Plan 10-01)

**Original bug:** Reinstall idempotency only checked `!existingConfig.circuit_breaker` at the top level. If a user had a config with `circuit_breaker: { oscillation_depth: 5 }` (missing `commit_window`), reinstall would detect the top-level key, enter the else branch, and do nothing — leaving `commit_window` missing.

**Fix confirmed:** Lines 1806-1819 add an else branch that individually checks `oscillation_depth === undefined` and `commit_window === undefined`. Missing sub-keys are added with defaults; present sub-keys are untouched. File is written only if at least one sub-key was added (`subKeyAdded` flag).

---

## Verdict

**PASSED (4/4 requirements verified)**

All Phase 8 requirements are satisfied:
- INST-08: PreToolUse circuit breaker hook is registered on install (inside !isOpencode guard) and removed on uninstall
- INST-09: Fresh install writes circuit_breaker: { oscillation_depth: 3, commit_window: 6 } to qgsd.json
- INST-10: Reinstall backfills missing circuit_breaker block AND individual missing sub-keys without overwriting user values
- RECV-01: --reset-breaker uses git rev-parse --show-toplevel for path resolution; functional test confirms state cleared from subdirectory

All 3 bug fixes from Plan 10-01 are confirmed in the source and validated by static analysis + functional test.
Test suite: 141/141 pass, 0 failures.
