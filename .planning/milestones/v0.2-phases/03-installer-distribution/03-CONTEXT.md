# Phase 3: Installer & Distribution - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Package QGSD as a standalone npm package (`npx qgsd@latest`) that installs the quorum hooks and config into `~/.claude/` with a single command. Establish version sync strategy with GSD. No new quorum behavior — Phases 1 and 2 shipped all enforcement logic. Phase 3 is purely about packaging, publication, and distribution.

**What is already done (do NOT re-implement):**
- `bin/install.js` already writes hooks to `~/.claude/settings.json` with idempotency guards
- Hook registration for UserPromptSubmit and Stop already implemented (INST-03, INST-04)
- `qgsd.json` write with MCP auto-detection already implemented (Phase 2, MCP-01 through MCP-05)
- `hooks/dist/` build already works via `scripts/build-hooks.js`
- `hooks/config-loader.js` already ships to `hooks/dist/` via `HOOKS_TO_COPY`

**What Phase 3 must deliver:**
1. A separate npm package entry point (`npx qgsd@latest` as a standalone command, distinct from `get-shit-done-cc`)
2. Package.json for the standalone QGSD package with GSD version pinning
3. Installer validation: check that quorum MCPs are configured before registering hooks (INST-05)
4. CHANGELOG.md tracking GSD version compatibility (SYNC-03)
5. Confirmation that no GSD source files are modified (SYNC-04 audit)

</domain>

<decisions>
## Implementation Decisions

### Package identity and entry point
- The QGSD package is separate from `get-shit-done-cc` — it is published as its own npm package
- Package name: `qgsd` (short, memorable, matches the binary name)
- Binary entry: `qgsd` → `bin/install.js` (already the installer)
- The `npx qgsd@latest` invocation runs `bin/install.js` directly — no new wrapper script needed
- The package `files` array includes: `bin/`, `hooks/dist/`, `templates/`, `scripts/` — same pattern as the existing package.json

### GSD version pinning strategy (SYNC-01, SYNC-02)
- QGSD does NOT install GSD itself — it installs alongside GSD
- `package.json` `peerDependencies` declares the compatible GSD version range: `"get-shit-done-cc": ">=1.20.0"`
- CHANGELOG.md format: one entry per QGSD release, records which GSD version range it is tested against
- When GSD adds a new planning command: QGSD patch release updates `DEFAULT_CONFIG.quorum_commands` in `hooks/config-loader.js`

### Installer validation (INST-05)
- Before registering hooks, installer checks that at least one quorum MCP (Codex, Gemini, or OpenCode) exists in `~/.claude.json` mcpServers
- If none found: installer warns "No quorum MCP servers found in ~/.claude.json — quorum enforcement will be inactive until MCPs are configured" but does NOT abort (fail-open, matches existing philosophy)
- Warning is prominent (yellow, not buried in output)
- This reuses `buildRequiredModelsFromMcp()` logic already written in Phase 2

### Idempotency behavior on reinstall (INST-06)
- Already implemented in `bin/install.js` — hook entries checked before inserting, qgsd.json skipped if exists
- Phase 3 adds: on reinstall, if `qgsd.json` already exists, installer prints current config summary so user knows what prefix values are active
- If user wants to update detected MCPs: `npx qgsd@latest --redetect-mcps` flag (Phase 3 scope: define the flag and its behavior, even if implementation is simple)

### No GSD source modification audit (SYNC-04)
- Phase 3 includes an explicit audit step: grep QGSD hooks directory for any imports from GSD internals
- Document the result in a note in CHANGELOG.md: "QGSD adds: hooks/qgsd-stop.js, hooks/qgsd-prompt.js, hooks/config-loader.js. No GSD source files modified."

### Claude's Discretion
- Exact CHANGELOG.md format and versioning scheme (semver patch for MCP updates, minor for behavior changes)
- Whether to add a `qgsd --status` command showing currently active config (nice-to-have, not required)
- npm publish workflow details (CI vs manual) — out of scope for this phase, just ensure the package is publishable

</decisions>

<specifics>
## Specific Ideas

- The existing `bin/install.js` already handles the full install flow — Phase 3 is about wrapping it correctly as a standalone package, not rewriting it
- The `buildRequiredModelsFromMcp()` function written in Phase 2 is the right foundation for INST-05 validation — it already logs detected vs. defaulted models
- `npx qgsd@latest` with no args should print a help message similar to the existing GSD banner + usage
- CHANGELOG.md should be in the repo root (not `.planning/`) — it ships with the npm package

</specifics>

<deferred>
## Deferred Ideas

- `qgsd --status` command showing active config (nice-to-have v2 — REL-03 drift detection)
- `npx qgsd@latest --dry-run` flag (REL-02 — v2 requirement)
- Scheduled quorum model health check (not in scope)
- Per-project install support (explicitly out of scope for v1)

</deferred>

---

*Phase: 03-installer-distribution*
*Context gathered: 2026-02-20*
