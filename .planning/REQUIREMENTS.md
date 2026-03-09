# Requirements: nForma

**Defined:** 2026-03-09
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## Milestone v0.32 Requirements

Requirements for README & Documentation Overhaul. Each maps to roadmap phases.

### README Structure

- [ ] **RDME-01**: TUI section promoted from `<details>` to visible section with hero screenshot above the fold
- [ ] **RDME-02**: "Who This Is For" expanded to 3-4 bullet points framing concrete problems nForma solves (single-model blind spots, context rot, oscillation loops, manual tracking)
- [ ] **RDME-03**: "With vs. Without" comparison table added after "Who This Is For" showing Claude Code alone vs. with nForma
- [ ] **RDME-04**: "By the Numbers" quantified metrics section added near top (agents, commands, requirements, hooks, formal models, milestones)
- [ ] **RDME-05**: Architecture/quorum flow diagram added to "How It Works" intro showing prompt → dispatch → consensus → execute flow
- [ ] **RDME-06**: "What's New in v0.32" changelog section added near top of README
- [ ] **RDME-07**: Nav bar expanded with additional anchor links (TUI, Configuration, Star History)
- [ ] **RDME-08**: Community/Contributing section added before Star History with Discord CTA and contribution guidelines
- [ ] **RDME-09**: Getting Started collapsible sections rebalanced — critical path (install → quorum setup → first command) visible by default, advanced options collapsed
- [ ] **RDME-10**: Broken table in Observability section fixed (solve screenshot moved outside table rows)

### User Guide

- [ ] **GUIDE-01**: User Guide updated with TUI screenshots cross-referenced to feature descriptions
- [ ] **GUIDE-02**: User Guide "Getting Started" walkthrough improved with step-by-step flow and screenshots

### Visual Assets

- [ ] **VIS-01**: All TUI screenshots regenerated via VHS tape automation after README structural changes
- [ ] **VIS-02**: VHS tape hardened for CI reliability (zsh shell, explicit PATH export, CLAUDECODE unset)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New TUI features | This is a docs-only milestone; code changes limited to VHS tape |
| Roadmap preview in README | Exceeds docs focus, adds maintenance burden |
| Video/GIF demos | High production cost, low ROI for v0.32 |
| Internationalization | Not relevant to current user base |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RDME-01 | TBD | Pending |
| RDME-02 | TBD | Pending |
| RDME-03 | TBD | Pending |
| RDME-04 | TBD | Pending |
| RDME-05 | TBD | Pending |
| RDME-06 | TBD | Pending |
| RDME-07 | TBD | Pending |
| RDME-08 | TBD | Pending |
| RDME-09 | TBD | Pending |
| RDME-10 | TBD | Pending |
| GUIDE-01 | TBD | Pending |
| GUIDE-02 | TBD | Pending |
| VIS-01 | TBD | Pending |
| VIS-02 | TBD | Pending |

**Coverage:**
- v0.32 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after initial definition*
