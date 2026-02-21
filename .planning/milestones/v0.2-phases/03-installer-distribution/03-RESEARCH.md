# Phase 3: Installer & Distribution — Research

**Gathered:** 2026-02-20
**Status:** Complete

## Quorum

Research reviewed by: Claude + Codex + Gemini + OpenCode (Copilot unavailable — reduced quorum, proceeding per R6)
Consensus reached after Round 1 (all 4 models agreed on plan shape and all design decisions).

---

## Current State Audit

### package.json
- Name: `get-shit-done-cc` (must change to `qgsd`)
- Version: `1.20.5` (must reset to `0.1.0` for QGSD's own versioning)
- bin: `{ "get-shit-done-cc": "bin/install.js" }` — must add `"qgsd": "bin/install.js"`
- files: `["bin", "commands", "get-shit-done", "agents", "hooks/dist", "scripts"]` — must add `"templates"`
- peerDependencies: missing — must add `{ "get-shit-done-cc": ">=1.20.0" }`
- test script: `node --test get-shit-done/bin/gsd-tools.test.js` — file is actually `gsd-tools.test.cjs`, not `.js`; this is a pre-existing bug in the repo, out of Phase 3 scope unless explicitly fixing

### CHANGELOG.md
- Already exists at repo root
- Uses Keep-a-Changelog format
- Currently tracks GSD changes
- Phase 3 must ADD a QGSD v0.1.0 section (not create a new file)

### hooks/dist/ — CRITICAL FINDING
`hooks/dist/` is STALE relative to `hooks/` source:
- `config-loader.js` is MISSING from dist entirely
- `qgsd-stop.js` in dist is Phase 1 version (inline DEFAULT_CONFIG, no getAvailableMcpPrefixes(), no fail-open logic)
- `qgsd-prompt.js` in dist is Phase 1 version (inline loadConfig, no config-loader import)
- `npm run build:hooks` (or `node scripts/build-hooks.js`) must be run before any install attempt
- The installer copies hooks from `hooks/dist/` (bin/install.js line ~1571) — stale dist = broken install

### bin/install.js — INST-05 gap
- MCP validation (`buildRequiredModelsFromMcp()`) currently runs ONLY when writing qgsd.json for the first time (line ~1680: inside `if (!fs.existsSync(qgsdConfigPath))`)
- On reinstall when qgsd.json already exists, no MCP validation warning fires
- INST-05 requires warning before hook registration — must run every time, not just first-time

### bin/install.js — INST-06 gap
- When qgsd.json already exists, installer currently prints: `↳ ~/.claude/qgsd.json already exists — skipping (user config preserved)`
- INST-06 requires: print current config summary (active required_models prefixes)

### bin/install.js — no --redetect-mcps flag
- Flag not present
- Behavior: delete qgsd.json + rerun detection on next install pass

### SYNC-02 risk — quorum_commands duplicated
- Hardcoded in 3 places: `hooks/config-loader.js:18` (DEFAULT_CONFIG), `bin/install.js:1684` (qgsd config write), `templates/qgsd.json:26`
- When GSD adds a new planning command, all 3 must be updated
- Phase 3 scope: document this in CHANGELOG.md as a known maintenance note; deduplification is v2

### SYNC-04 pre-audit
- `hooks/qgsd-stop.js` imports: `fs`, `path`, `os` (Node stdlib), `./config-loader` (QGSD's own module)
- `hooks/qgsd-prompt.js` imports: `./config-loader` (QGSD's own module)
- `hooks/config-loader.js` imports: `fs`, `path`, `os` (Node stdlib)
- NO imports from GSD internals (get-shit-done/, bin/, agents/, commands/)
- SYNC-04 status: PASSES (no GSD source modifications — pre-verified)

---

## Implementation Findings

### Plan 03-01: Package Identity + Changelog
Files to modify:
- `package.json`: name, version, bin, peerDependencies, files (in-place edit — single package.json)
- `CHANGELOG.md`: add QGSD v0.1.0 section with GSD compatibility note and SYNC-04 audit result

Key decisions (consensus):
- Edit `package.json` in-place (do not create a separate file)
- Set version to `0.1.0` (QGSD starts fresh versioning)
- Keep `get-shit-done-cc` bin entry so existing GSD users are unaffected; add `qgsd` bin entry
- `peerDependencies` not `dependencies` — QGSD does not install GSD, it installs alongside it
- CHANGELOG.md entry documents: files added by QGSD, GSD compatibility range, SYNC-04 audit note

### Plan 03-02: Installer Enhancements
Target: `bin/install.js`

INST-05 — MCP validation warning:
- Run on EVERY install (before hook registration), not just first-time
- Per-model warning: check each of codex/gemini/opencode separately
- Reuse `buildRequiredModelsFromMcp()` output — if a model used its default prefix (not detected), emit yellow warning
- Do NOT abort installation — fail-open always
- Warning text: `⚠ No [model] MCP server found in ~/.claude.json — quorum enforcement for [model] may be inactive`

INST-06 — Reinstall config summary:
- If qgsd.json exists, read it and print active `required_models` prefixes before skipping
- Format: `↳ Active quorum config: codex → mcp__codex-cli__, gemini → mcp__gemini-cli__, opencode → mcp__opencode__`

--redetect-mcps flag:
- Parse flag in args array
- If present: delete qgsd.json (if exists), then fall through to fresh detection/write
- Print: `◆ Re-detecting MCP prefixes...`

### Plan 03-03: Human Verify Checkpoint
Verification steps:
1. Run `npm run build:hooks` — verify `hooks/dist/config-loader.js` now exists, check all 3 QGSD files present and current
2. Run `npm pack --dry-run` — verify tarball includes: `bin/install.js`, `hooks/dist/qgsd-stop.js`, `hooks/dist/qgsd-prompt.js`, `hooks/dist/config-loader.js`, `templates/qgsd.json`
3. Simulate install: run `node bin/install.js --claude` and verify: (a) hooks registered in ~/.claude/settings.json, (b) qgsd.json written, (c) MCP validation warnings appear if MCPs absent
4. SYNC-04 audit: grep `hooks/qgsd-*.js hooks/config-loader.js` for any `require` that references GSD internals
5. Verify `npx qgsd@latest` entry point: confirm `bin.qgsd` in package.json maps to `bin/install.js`
6. Mark all Phase 3 requirements complete in REQUIREMENTS.md

---

## Risks

| Risk | Mitigation |
|------|-----------|
| hooks/dist stale — install copies old versions | Plan 03-03 must run build before verify; consider adding `prepack` to npm scripts |
| quorum_commands drift (SYNC-02) | Document in CHANGELOG.md; flag as maintenance checklist item |
| test script broken (`.js` vs `.cjs`) | Pre-existing bug; out of Phase 3 scope; do not modify |
| Renaming package breaks existing `npx get-shit-done-cc` users | Keep `get-shit-done-cc` bin entry in package.json |

---

*Phase: 03-installer-distribution*
*Research completed: 2026-02-20*
*Quorum: Claude + Codex + Gemini + OpenCode (Copilot unavailable)*
