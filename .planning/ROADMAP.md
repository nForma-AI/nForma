# Roadmap: nForma

## Milestones

- ✅ **v0.2 — Gap Closure & Activity Resume Routing** — Phases 1-17 (shipped 2026-02-21)
- ✅ **v0.3 — Test Suite Maintenance Tool** — Phases 18-22 (shipped 2026-02-22)
- ✅ **v0.4 — MCP Ecosystem** — Phases 23-31 (shipped 2026-02-22)
- ✅ **v0.5 — MCP Setup Wizard** — Phases 32-38 (shipped 2026-02-23)
- ✅ **v0.6 — Agent Slots & Quorum Composition** — Phase 39 (shipped 2026-02-23)
- ✅ **v0.7 — Composition Config & Multi-Slot** — Phases v0.7-01..v0.7-04 (shipped 2026-02-23)
- ✅ **v0.8 — fix-tests ddmin Pipeline** — Phase v0.8-01 (shipped 2026-02-23)
- ✅ **v0.9 — GSD Sync** — Phases v0.9-01..v0.9-09 (shipped 2026-02-27)
- ✅ **v0.10 — Roster Toolkit** — Phases v0.10-01..v0.10-08 (shipped 2026-02-25)
- ✅ **v0.11 — Parallel Quorum** — Phase v0.11-01 (shipped 2026-02-24)
- ✅ **v0.13 — Autonomous Milestone Execution** — Phases v0.13-01..v0.13-06 (shipped 2026-02-25)
- ✅ **v0.14 — FV Pipeline Integration** — Phases v0.14-01..v0.14-05 (shipped 2026-02-26)
- ✅ **v0.15 — Health & Tooling Modernization** — Phases v0.15-01..v0.15-04 (shipped 2026-02-27)
- ✅ **v0.19 — FV Pipeline Hardening** — Phases v0.19-01..v0.19-11 (completed 2026-02-28)
- ✅ **v0.20 — FV as Active Planning Gate** — Phases v0.20-01..v0.20-09 (shipped 2026-03-01)
- ✅ **v0.21 — FV Closed Loop** — Phases v0.21-01..v0.21-06 (shipped 2026-03-01)
- ✅ **v0.23 — Formal Gates** — Phases v0.23-01..v0.23-04 (shipped 2026-03-02)
- ✅ **v0.24 — Quorum Reliability Hardening** — Phases v0.24-01..v0.24-05 (shipped 2026-03-03)
- ✅ **v0.25 — Formal Traceability & Coverage** — Phases v0.25-01..v0.25-07 (shipped 2026-03-03)
- ✅ **v0.26 — Operational Completeness** — Phases v0.26-01..v0.26-06 (shipped 2026-03-04)
- ✅ **v0.27 — Production Feedback Loop** — Phases v0.27-01..v0.27-05 (shipped 2026-03-04)
- ✅ **v0.28 — Agent Harness Optimization** — Phases v0.28-01..v0.28-04 (shipped 2026-03-06)
- ✅ **v0.29 — Three-Layer Formal Verification Architecture** — Phases v0.29-01..v0.29-06 (shipped 2026-03-06)
- ✅ **v0.30 — Advanced Agent Patterns** — Phases v0.30-01..v0.30-09 (shipped 2026-03-08)
- ✅ **v0.31 — Ruflo-Inspired Hardening** — Phases v0.31-01..v0.31-03 (shipped 2026-03-08)
- ✅ **v0.32 — Documentation & README Overhaul** — Phases v0.32-01..v0.32-04 (shipped 2026-03-09)
- ✅ **v0.33 — Outer-Loop Convergence Guarantees** — Phases v0.33-01..v0.33-06 (shipped 2026-03-10)
- ✅ **v0.34 — Semantic Gate Validation & Auto-Promotion** — Phases v0.34-01..v0.34-06 (shipped 2026-03-11)

> **v0.2 through v0.34 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.35 — Install & Setup Bug Fixes

**Milestone Goal:** Fix four user-facing bugs (GitHub #4-#7) that break install, setup, cross-platform paths, and TUI agent configuration.

### Phases

- [x] **Phase v0.35-01: Install hooks/dist rebuild** - Auto-rebuild hooks/dist on source checkout so install works without manual build step (completed 2026-03-12)
- [x] **Phase v0.35-02: MCP Setup slot classification** - Fix slot type detection to use auth_type from providers.json instead of name-prefix inference (completed 2026-03-12)
- [x] **Phase v0.35-03: Cross-platform provider paths** - Replace hardcoded /opt/homebrew/bin/ with runtime CLI resolution for macOS, Linux, and WSL (completed 2026-03-13)
- [x] **Phase v0.35-04: TUI CLI Agent MCP entry** - Fix TUI "Add Agent" to generate correct MCP entries matching mcp-setup output (completed 2026-03-13)

### Phase Details

#### Phase v0.35-01: Install hooks/dist rebuild
**Goal**: Users can install nForma from a source checkout without manually running `npm run build:hooks` first
**Depends on**: Nothing (first phase)
**Requirements**: INST-01, INST-02
**Success Criteria** (what must be TRUE):
  1. Running `node bin/install.js --claude --global` on a fresh clone (no hooks/dist/) succeeds without error
  2. If hooks/dist/ is missing or stale, install either auto-rebuilds it or prints a clear actionable message telling the user exactly what command to run
  3. After install completes, all hooks in `~/.claude/hooks/` are functional (not empty or stale copies)
**Plans**: 1 plan
Plans:
- [ ] v0.35-01-01-PLAN.md -- Auto-rebuild hooks/dist and add fresh-clone test

#### Phase v0.35-02: MCP Setup slot classification
**Goal**: `/nf:mcp-setup` correctly identifies all slot types including native CLI agents like codex-1
**Depends on**: Nothing (independent)
**Requirements**: SETUP-01, SETUP-02
**Success Criteria** (what must be TRUE):
  1. Running `/nf:mcp-setup` re-run shows codex-1 classified as "subscription" (CLI agent), not "api" or "provider-backed"
  2. Slot classification reads `auth_type` field from providers.json for every slot, not inferring type from the slot name prefix
  3. All slot types in providers.json (subscription CLI, API-backed, provider-hosted) display their correct category in the setup wizard menu
**Plans**: 1 plan
Plans:
- [ ] v0.35-02-01-PLAN.md -- Add auth_type to providers.json and wire through mcp-setup workflow

#### Phase v0.35-03: Cross-platform provider paths
**Goal**: Provider CLI binary paths resolve correctly on macOS, Linux, and WSL without manual user configuration
**Depends on**: Nothing (independent)
**Requirements**: XPLAT-01, XPLAT-02
**Status**: COMPLETE
**Success Criteria** (what must be TRUE):
  1. ✓ Provider definitions no longer contain hardcoded `/opt/homebrew/bin/` paths in runtime spawn code
  2. ✓ CLI binary paths are resolved at runtime using `which`/`resolve-cli.cjs` multi-strategy discovery
  3. ✓ A user on Linux (apt/snap installed CLIs) or WSL can run nForma without manually editing provider paths
**Plans**: 1 plan (completed 2026-03-13)
Plans:
- [x] v0.35-03-01-PLAN.md -- Wire resolveCli into unified-mcp-server and call-quorum-slot dispatch pipelines (2 tasks, 3 files, 30 tests pass)

#### Phase v0.35-04: TUI CLI Agent MCP entry
**Goal**: TUI "Add Agent -> CLI Agent" produces working MCP configuration entries that match what mcp-setup generates
**Depends on**: Phase v0.35-03 (uses resolved CLI paths)
**Requirements**: TUI-01, TUI-02
**Status**: COMPLETE
**Success Criteria** (what must be TRUE):
  1. ✓ TUI "Add Agent -> CLI Agent" for any supported slot type generates an MCP entry with correct binary path and args
  2. ✓ The generated MCP entry format is identical to what `/nf:mcp-setup` wizard produces
  3. ✓ Executable validation prevents non-executable paths from being written
**Plans**: 1 plan (completed 2026-03-13)
Plans:
- [x] v0.35-04-01-PLAN.md -- Integrate resolveCli into TUI CLI Agent handler with validation and format parity tests (2 tasks, 2 files, 8 tests pass)

### Progress

**Execution Order:**
Phases execute in sequence: v0.35-01 -> v0.35-02 -> v0.35-03 -> v0.35-04
(v0.35-01 and v0.35-02 are independent; v0.35-04 depends on v0.35-03)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.35-01. Install hooks/dist rebuild | 1/1 | Complete   | 2026-03-12 |
| v0.35-02. MCP Setup slot classification | 1/1 | Complete   | 2026-03-12 |
| v0.35-03. Cross-platform provider paths | 1/1 | Complete    | 2026-03-13 |
| v0.35-04. TUI CLI Agent MCP entry | 1/1 | Complete    | 2026-03-13 |

**Milestone Complete**: v0.35 — Install & Setup Bug Fixes (all 4 GitHub issues #4-#7 resolved)

---

*Roadmap created: 2026-02-20*
*Last updated: 2026-03-13 after v0.35-04 execution*
