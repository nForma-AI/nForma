# Requirements: QGSD v0.15 Health & Tooling Modernization

**Defined:** 2026-02-26
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.15 Requirements

### HLTH — Health Checker Accuracy

Root cause: `gsd-tools.cjs` validate health uses regex patterns designed for GSD's legacy `NN-name` numeric phase naming. QGSD uses `v0.X-YY-name` versioned naming — causing 33 W005 + 22 W007 false positives that mask real issues.

- [x] **HLTH-01**: Health checker W005 dir-naming validation recognizes QGSD versioned format `v0.X-YY-name` — zero false positives for all versioned phase dirs
- [x] **HLTH-02**: Health checker W007 ROADMAP extractor matches `### Phase v0.X-YY:` versioned headers — no phases appearing as "on disk but not in ROADMAP" when they are in ROADMAP
- [x] **HLTH-03**: Health checker W002 STATE.md parser extracts versioned phase references (`Phase v0.14-01`) — position reported correctly without false "invalid phase" warnings

### SAFE — Safety & Data Integrity

Root cause: `--repair`'s `regenerateState` action replaces STATE.md with a 15-line blank template without checking current content; tested this session when it wiped the full QGSD state file.

- [ ] **SAFE-01**: `--repair` action shows a content-length warning and requires explicit `--force` flag before overwriting a STATE.md with more than 50 lines — prevents silent data loss
- [ ] **SAFE-02**: Legacy numeric phase dirs 18–39 archived to `.planning/archive/legacy/` — W007 orphan noise for pre-versioning era dirs eliminated

### VIS — Visibility

Root cause: quick-112 added `quorum-failures.json` failure logging but the patterns are only surfaced by `check-provider-health.cjs`. The primary `/qgsd:health` workflow has no visibility into recurring slot failures.

- [ ] **VIS-01**: `/qgsd:health` output includes quorum slot failure warnings from `.planning/quorum-failures.json` when recurring patterns detected (slot count ≥ 3) — surfaced as health warnings alongside standard W/E/I items

## Future Requirements

### Deeper health checks (defer to v0.16+)

- **HLTH-04**: Health checker validates ROADMAP.md phase goal and success criteria fields are populated
- **HLTH-05**: Health checker detects PLAN.md files without matching SUMMARY.md (beyond current I001)
- **SAFE-03**: `--repair` dry-run mode shows all changes without applying

## Out of Scope

| Feature | Reason |
|---------|--------|
| GSD upstream patch | QGSD is additive only — no GSD source modifications; regex fix stays in QGSD wrapper |
| Per-project health config | Global install pattern; single config sufficient for v0.15 |
| Interactive repair wizard | `--force` flag is sufficient safety gate for v0.15 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HLTH-01 | v0.15-01 | Complete |
| HLTH-02 | v0.15-01 | Complete |
| HLTH-03 | v0.15-01 | Complete |
| SAFE-01 | v0.15-02 | Pending |
| SAFE-02 | v0.15-03 | Pending |
| VIS-01 | v0.15-04 | Pending |

**Coverage:**
- v0.15 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-26*
*Last updated: 2026-02-26 after initial definition*
