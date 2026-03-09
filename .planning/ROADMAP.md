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

> **v0.2 through v0.31 phase details archived to respective milestone ROADMAP files in** `.planning/milestones/`

---

## v0.32 — Documentation & README Overhaul

**Coverage:** 14/14 requirements mapped

### Phases

- [x] **Phase v0.32-01: README Above-the-Fold Restructure** - Promote TUI hero, add value props, metrics, changelog, and nav to the top of README (completed 2026-03-09)
- [x] **Phase v0.32-02: README Deep Sections** - Add architecture diagram, community section, rebalance Getting Started, fix broken table (completed 2026-03-09)
- [x] **Phase v0.32-03: User Guide Overhaul** - Update User Guide with TUI screenshots and improved Getting Started walkthrough (completed 2026-03-09)
- [ ] **Phase v0.32-04: Visual Asset Regeneration** - Regenerate all TUI screenshots and harden VHS tape for CI

### Phase Details

#### Phase v0.32-01: README Above-the-Fold Restructure
**Goal**: A visitor landing on the README immediately sees what nForma does, who it helps, how it compares, and what it looks like -- all without scrolling
**Depends on**: Nothing (first phase)
**Requirements**: RDME-01, RDME-02, RDME-03, RDME-04, RDME-06, RDME-07
**Success Criteria** (what must be TRUE):
  1. The TUI section with a hero screenshot is visible without expanding any collapsible element
  2. "Who This Is For" lists 3-4 concrete problems (blind spots, context rot, oscillation, manual tracking) a reader can self-identify with
  3. A "With vs. Without" comparison table appears directly after "Who This Is For" showing Claude Code alone vs. with nForma
  4. A "By the Numbers" section shows at least 5 quantified metrics (agents, commands, requirements, hooks, milestones)
  5. Nav bar contains anchor links for TUI, Configuration, and Star History sections
**Plans:** 1/1 plans complete
Plans:
- [ ] v0.32-01-01-PLAN.md — Restructure README above-the-fold with TUI hero, value props, comparison table, metrics, changelog, and expanded nav bar

#### Phase v0.32-02: README Deep Sections
**Goal**: The README's deeper sections are complete, well-structured, and free of rendering bugs
**Depends on**: Phase v0.32-01
**Requirements**: RDME-05, RDME-08, RDME-09, RDME-10
**Success Criteria** (what must be TRUE):
  1. "How It Works" contains a visible architecture/flow diagram showing prompt to dispatch to consensus to execute
  2. A Community/Contributing section appears before Star History with Discord CTA and contribution guidelines
  3. Getting Started shows install, quorum setup, and first command visible by default; advanced options are collapsed
  4. The Observability section table renders correctly with no broken markdown (solve screenshot outside table rows)
**Plans:** 1/1 plans complete
Plans:
- [ ] v0.32-02-01-PLAN.md — Add architecture diagram, community section, rebalance Getting Started, fix Observability table

#### Phase v0.32-03: User Guide Overhaul
**Goal**: A new user can follow the User Guide from install to first successful quorum command using screenshots as visual anchors
**Depends on**: Phase v0.32-01 (TUI section structure established)
**Requirements**: GUIDE-01, GUIDE-02
**Success Criteria** (what must be TRUE):
  1. Each major User Guide feature section includes at least one TUI screenshot cross-referenced to the feature description
  2. The Getting Started walkthrough proceeds step-by-step from install through first command with screenshots at each stage
**Plans:** 1/1 plans complete
Plans:
- [ ] v0.32-03-01-PLAN.md — Add Getting Started walkthrough with screenshots and embed TUI screenshots in feature sections

#### Phase v0.32-04: Visual Asset Regeneration
**Goal**: All TUI screenshots reflect the final state of README and User Guide content, generated reliably via automation
**Depends on**: Phase v0.32-01, Phase v0.32-02, Phase v0.32-03
**Requirements**: VIS-01, VIS-02
**Success Criteria** (what must be TRUE):
  1. All TUI screenshots embedded in README and User Guide are regenerated and match current TUI output
  2. VHS tape runs successfully with zsh shell, explicit PATH export, and CLAUDECODE unset
  3. Running the VHS tape twice produces identical screenshot output (deterministic)
**Plans**: TBD

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| v0.32-01. README Above-the-Fold Restructure | 1/1 | Complete    | 2026-03-09 |
| v0.32-02. README Deep Sections | 1/1 | Complete    | 2026-03-09 |
| v0.32-03. User Guide Overhaul | 1/1 | Complete   | 2026-03-09 |
| v0.32-04. Visual Asset Regeneration | 0/? | Not started | - |

---
*Roadmap created: 2026-03-09*
*Last updated: 2026-03-09*
