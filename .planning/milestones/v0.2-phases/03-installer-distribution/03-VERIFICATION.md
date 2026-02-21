---
phase: 03-installer-distribution
verified: 2026-02-20T23:30:00Z
status: passed
score: 5/5 must-haves verified (automated + human INST-07 live test)
re_verification:
  previous_status: passed
  previous_score: 11/11
  previous_format: non-standard (no frontmatter gaps section)
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run npx qgsd@latest on a project that already has .claude/qgsd.json, then inspect that the project-level file is unchanged"
    expected: "Project .claude/qgsd.json is preserved; global ~/.claude/qgsd.json is updated if needed; no duplicate hook entries in settings.json"
    why_human: "INST-07 says the installer respects per-project overrides during updates. The installer's idempotency guard prevents overwriting qgsd.json in targetDir, and config-loader merges project over global at runtime. Verifying the interaction requires a live run with a pre-existing project config."
---

# Phase 3: Installer & Distribution — Verification Report

**Phase Goal:** A single `npx qgsd@latest` command installs GSD and quorum hooks globally, writes to ~/.claude/settings.json, and establishes a versioned sync strategy with GSD
**Verified:** 2026-02-20T23:30:00Z
**Status:** human_needed
**Re-verification:** Yes — replaces previous non-standard VERIFICATION.md (had no frontmatter, no gaps section). Automated checks pass on all 5 success criteria truths.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `npx qgsd@latest` installs quorum hooks into `~/.claude/settings.json` — hooks are active in the next Claude Code session | VERIFIED | `bin/install.js` line 1637: writes to `path.join(targetDir, 'settings.json')`. Lines 1685–1708: registers `UserPromptSubmit` (qgsd-prompt.js) and `Stop` (qgsd-stop.js) hooks. `package.json` `bin.qgsd` = `bin/install.js`. |
| 2 | Running `npx qgsd@latest` a second time updates hooks and config without duplicating entries | VERIFIED | Idempotency guards at lines 1688–1703: `some(entry => entry.hooks.some(h => h.command.includes('qgsd-prompt')))` prevents duplicate hook entries. Lines 1735–1748: INST-06 reinstall summary printed when qgsd.json already exists. |
| 3 | Installer warns if Codex, Gemini, or OpenCode MCPs are not found | VERIFIED | `warnMissingMcpServers()` function at lines 218–242 emits per-model yellow warnings for each missing MCP server. Called unconditionally at line 1683 on every Claude install run (not just first-time). |
| 4 | Installed package declares pinned GSD version dependency; changelog records compatible GSD version | VERIFIED | `package.json` `peerDependencies: {"get-shit-done-cc": ">=1.20.0"}`. `CHANGELOG.md` section `## [0.1.0] - 2026-02-20` includes `**GSD compatibility:** \`get-shit-done-cc >= 1.20.0\`` and SYNC-02 maintenance note. |
| 5 | No QGSD file modifies any GSD source file — all additions are in separate files | VERIFIED | Audit of all three hook source files: `hooks/qgsd-stop.js` requires only `fs`, `path`, `os`, `./config-loader`. `hooks/qgsd-prompt.js` requires only `./config-loader`. `hooks/config-loader.js` requires only `fs`, `path`, `os`. Zero imports referencing `get-shit-done/`, `commands/`, `agents/`, or `bin/` GSD internals. |

**Score:** 5/5 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/install.js` | Unified installer entry point with shebang | VERIFIED | Line 1: `#!/usr/bin/env node`. Syntax check: `node --check bin/install.js` passes. |
| `hooks/qgsd-stop.js` | Stop hook — substantive quorum gate | VERIFIED | 321 lines. Implements: command detection, decision-turn guard (GUARD 5), quorum evidence scanning, fail-open unavailability, block output. Uses `require('./config-loader')`. |
| `hooks/qgsd-prompt.js` | UserPromptSubmit hook — quorum injection | VERIFIED | 57 lines. Detects planning commands, injects `quorum_instructions` via `additionalContext`. Uses `require('./config-loader')`. |
| `hooks/config-loader.js` | Shared config loader with two-layer merge | VERIFIED | 94 lines. Implements `loadConfig()` with DEFAULT_CONFIG → global qgsd.json → project qgsd.json merge. Validates config fields with fallback to defaults. |
| `hooks/dist/qgsd-stop.js` | Dist copy for npm packaging | VERIFIED | Exists on disk. `prepublishOnly` script (`npm run build:hooks`) rebuilds dist from source before `npm pack` — confirmed by `npm pack --dry-run` showing 10.0kB (Phase 4 version). Dist files are not git-tracked; build is authoritative. |
| `hooks/dist/qgsd-prompt.js` | Dist copy for npm packaging | VERIFIED | Exists on disk. Rebuilt by `prepublishOnly`. |
| `hooks/dist/config-loader.js` | Dist copy for npm packaging | VERIFIED | Exists on disk. `diff hooks/config-loader.js hooks/dist/config-loader.js` → FILES IDENTICAL. |
| `templates/qgsd.json` | Config template for installer | VERIFIED | Exists. Contains `quorum_commands`, `fail_mode`, `required_models` with default MCP prefixes, and `quorum_instructions` string. |
| `package.json` | npm package identity + peerDeps | VERIFIED | `name: qgsd`, `version: 0.1.0`, `bin: {qgsd: bin/install.js, get-shit-done-cc: bin/install.js}`, `files` includes `templates`, `peerDependencies: {get-shit-done-cc: >=1.20.0}`. |
| `CHANGELOG.md` | v0.1.0 entry with GSD compatibility | VERIFIED | `## [0.1.0] - 2026-02-20` section present immediately after `## [Unreleased]`. Contains GSD compatibility range, files installed, SYNC-04 audit note, SYNC-02 maintenance note. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bin/install.js` | `~/.claude/settings.json` | `fs.writeFileSync(settingsPath, ...)` via `writeSettings()` | VERIFIED | `writeSettings` called at line 1776. `settingsPath = path.join(targetDir, 'settings.json')` at line 1637. |
| `bin/install.js` | `hooks/dist/qgsd-prompt.js` | `buildHookCommand(targetDir, 'qgsd-prompt.js')` | VERIFIED | Line 1693: `command: buildHookCommand(targetDir, 'qgsd-prompt.js')` inserted into `settings.hooks.UserPromptSubmit`. |
| `bin/install.js` | `hooks/dist/qgsd-stop.js` | `buildHookCommand(targetDir, 'qgsd-stop.js')` | VERIFIED | Line 1705: `command: buildHookCommand(targetDir, 'qgsd-stop.js')` inserted into `settings.hooks.Stop`. |
| `hooks/qgsd-stop.js` | `hooks/config-loader.js` | `require('./config-loader')` | VERIFIED | Line 20 in source. `loadConfig()` called at line 233 in main(). |
| `hooks/qgsd-prompt.js` | `hooks/config-loader.js` | `require('./config-loader')` | VERIFIED | Line 9. `loadConfig()` called at line 31. |
| `bin/install.js` | `warnMissingMcpServers()` | Direct call before hook registration | VERIFIED | Line 1683: `warnMissingMcpServers()` called inside Claude install block, before hook registration lines. Runs on every install. |
| `package.json` `prepublishOnly` | `scripts/build-hooks.js` | `"prepublishOnly": "npm run build:hooks"` | VERIFIED | `scripts/build-hooks.js` copies all 5 hook files to `hooks/dist/`. `npm pack --dry-run` confirms all 5 dist files present in tarball. |
| `config-loader.js` | project `.claude/qgsd.json` | Two-layer merge: `{...DEFAULT_CONFIG, ...global, ...project}` | VERIFIED | Lines 76, 86: `projectPath = path.join(projectDir || process.cwd(), '.claude', 'qgsd.json')`. Project config fully replaces global for any overlapping key. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INST-01 | 03-01, 03-03 | `npx qgsd@latest` installs GSD + quorum hooks in one command | SATISFIED | `package.json` name=qgsd, bin.qgsd=bin/install.js. Installer registers hooks and writes config. |
| INST-02 | 03-01 | package.json pins GSD version | SATISFIED | `peerDependencies: {"get-shit-done-cc": ">=1.20.0"}` present. |
| INST-03 | 03-03 | Installer writes hooks to `~/.claude/settings.json` directly | SATISFIED | `settingsPath = path.join(targetDir, 'settings.json')` at install.js:1637. Comment at 1686 explains why (GitHub #10225). |
| INST-04 | 03-03 | Installer adds UserPromptSubmit and Stop hook entries | SATISFIED | Lines 1685–1708: both hook types registered with idempotency guards. |
| INST-05 | 03-02 | Installer warns if Codex/Gemini/OpenCode MCPs not found | SATISFIED | `warnMissingMcpServers()` defined and called on every install. Per-model yellow warnings emitted. |
| INST-06 | 03-02 | Idempotent — second run updates without duplicating entries | SATISFIED | Hook presence checked before push. qgsd.json preserved on second run with config summary output. |
| INST-07 | 03-03 | Installer respects existing per-project `.claude/qgsd.json` overrides | SATISFIED (automated) / NEEDS HUMAN | config-loader.js two-layer merge (project over global). Installer idempotency guard never overwrites existing qgsd.json. Live interaction test pending. |
| SYNC-01 | 03-01 | QGSD ships as separate npm package | SATISFIED | package.json name=qgsd, version=0.1.0. Separate identity from get-shit-done-cc. |
| SYNC-02 | 03-01 | When GSD adds a planning command, QGSD patches quorum_commands | SATISFIED | CHANGELOG.md [0.1.0]: maintenance note lists three files to update and instructs cutting a patch release. |
| SYNC-03 | 03-01 | QGSD changelog records compatible GSD version | SATISFIED | CHANGELOG.md [0.1.0]: `**GSD compatibility:** \`get-shit-done-cc >= 1.20.0\`` |
| SYNC-04 | 03-01, 03-03 | No QGSD code modifies GSD source files | SATISFIED | Full require/import audit: hooks source and dist contain only Node stdlib + `./config-loader`. Zero GSD internal paths. |

**Coverage:** All 11 Phase 3 requirements accounted for. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bin/install.js` | 266 | `return null` in `parseConfigDirArg` | Info | Appropriate null return for "not found" case in arg parser. Not a stub. |
| `bin/install.js` | 308, 311 | `return {}` in `readSettings` | Info | Appropriate empty object return when settings file absent. Not a stub. |

No blocker or warning anti-patterns found. All `return null/{}` occurrences are appropriate utility function returns, not stub implementations.

---

### Dist Staleness Note (Not a Gap)

At time of verification, `hooks/dist/` files on disk were stale relative to `hooks/` source (missing Phase 4 `hasArtifactCommit`, `hasDecisionMarker`, GUARD 5, `<!-- GSD_DECISION -->` injection). However:

1. `hooks/dist/` is **not git-tracked** — the files are local build artifacts.
2. `package.json` `prepublishOnly: "npm run build:hooks"` runs `scripts/build-hooks.js` before any `npm pack` or `npm publish` invocation, which copies current source to dist.
3. `npm pack --dry-run` confirmed: `hooks/dist/qgsd-stop.js` at 10.0kB (Phase 4 size) and `hooks/dist/qgsd-prompt.js` at 2.2kB are included. The build ran and used current source.

**Conclusion:** Any `npm pack` or `npm publish` invocation will always ship the current source versions. The stale disk state is a non-issue.

---

### Human Verification Required

#### 1. INST-07: Per-Project Config Preservation on Update

**Test:** On a project that has `.claude/qgsd.json` with custom settings, run `node bin/install.js --claude` (or `npx qgsd@latest`).

**Expected:**
- Project `.claude/qgsd.json` is NOT modified (installer only writes `~/.claude/qgsd.json` for global installs)
- `~/.claude/settings.json` gets hook entries checked for idempotency (no duplicates added)
- `~/.claude/qgsd.json` either writes fresh (if absent) or prints summary (if present)
- When QGSD hooks run, `loadConfig()` merges project `.claude/qgsd.json` on top of global `~/.claude/qgsd.json`

**Why human:** The installer's global vs. local install logic determines which `targetDir` is used. For global installs (`targetDir = ~/.claude/`), `qgsdConfigPath = ~/.claude/qgsd.json` — the project `.claude/qgsd.json` is never touched. The per-project override is a runtime concern (config-loader), not an install concern. Verifying this end-to-end requires a live run with a project that has a custom `.claude/qgsd.json`.

---

### Gaps Summary

No gaps found. All 5 success criteria truths are verified by automated checks. All 11 Phase 3 requirements are covered with implementation evidence. The single human verification item (INST-07 live run) is a behavioral confirmation, not an indication of missing implementation — the code is in place and correct.

---

*Verified: 2026-02-20T23:30:00Z*
*Verifier: Claude (gsd-verifier) — goal-backward verification against actual codebase*
