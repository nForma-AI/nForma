# Requirements: QGSD

**Defined:** 2026-02-24
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.9 Requirements

Requirements for the GSD Sync milestone. Ports GSD 1.20.6 improvements into QGSD.

### Hooks — Context Window Monitor

- [ ] **CTX-01**: Context window monitor hook (`hooks/gsd-context-monitor.js`) created and registered as PostToolUse in `bin/install.js`
- [ ] **CTX-02**: Hook injects WARNING into `additionalContext` when context usage exceeds configurable threshold (default: 70%)
- [ ] **CTX-03**: Hook injects CRITICAL into `additionalContext` when context usage exceeds configurable threshold (default: 90%)
- [ ] **CTX-04**: Thresholds configurable via `qgsd.json` (`context_monitor.warn_pct`, `context_monitor.critical_pct`); two-layer merge applies
- [ ] **CTX-05**: Hook copied to `hooks/dist/` and global install sync run (`node bin/install.js --claude --global`)

### Plan — Nyquist Validation Layer

- [ ] **NYQ-01**: `get-shit-done/templates/VALIDATION.md` template created with per-task test-map structure
- [ ] **NYQ-02**: `plan-phase.md` step 5.5 inserted after research step — generates `VALIDATION.md` for the phase before roadmap creation
- [ ] **NYQ-03**: VALIDATION.md structure includes: per-task test-map (what to test per plan), Wave 0 pre-execution requirements, sampling rate spec
- [ ] **NYQ-04**: `nyquist_validation_enabled` field appears in `gsd-tools.cjs init plan-phase` JSON output (boolean, defaults true)
- [ ] **NYQ-05**: Plan-phase step 5.5 includes an explicit adoption verification step — if `nyquist_validation_enabled` is true and `VALIDATION.md` is absent after step 5.5 executes, the workflow halts with a clear error before proceeding to plan creation

### Discuss — UX Improvements

- [ ] **DSC-01**: In `discuss-phase.md` `present_gray_areas` step, each option includes a recommended choice with brief reasoning explaining why
- [ ] **DSC-02**: After all selected areas conclude, user sees "Explore more gray areas" option instead of hard-stopping at "I'm ready for context"
- [ ] **DSC-03**: Gray-area loop re-runs `present_gray_areas` with 2-4 newly identified areas on each re-entry (not the same ones already explored)
- [ ] **DSC-04**: Gray-area loop has an explicit termination rule — after 3 re-entry loops or when no new areas can be identified, the workflow exits to "I'm ready for context" automatically

### Fixes — Tier 3

- [ ] **FIX-01**: `plan-phase.md` Task spawn points include a "do NOT use the Skill tool" guard note
- [ ] **FIX-02**: `discuss-phase.md` Task spawn points include a "do NOT use the Skill tool" guard note
- [ ] **FIX-03**: QGSD Gemini quorum templates checked for TOML conversion issue; fix applied if affected (Gemini is a quorum slot — matters for quorum consistency)
- [ ] **FIX-04**: `gsd-tools.cjs` decimal phase number parsing (N.M format) consistent with integer format across all subcommands

## Deferred

### Carry-forward

- npm publish qgsd@0.2.0 — run `npm publish --access public` when user decides (RLS-04)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Installer 11-module refactor | GSD's module split doesn't map to QGSD's surface (keychain, quorum slots, circuit breaker); would need QGSD-native refactor |
| Pending quick tasks (74, 77, 78, 81, 82, 89) | Addressed opportunistically as quick tasks, not milestone phases |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTX-01 | v0.9-01 | Pending |
| CTX-02 | v0.9-01 | Pending |
| CTX-03 | v0.9-01 | Pending |
| CTX-04 | v0.9-01 | Pending |
| CTX-05 | v0.9-01 | Pending |
| NYQ-01 | v0.9-02 | Pending |
| NYQ-02 | v0.9-02 | Pending |
| NYQ-03 | v0.9-02 | Pending |
| NYQ-04 | v0.9-02 | Pending |
| NYQ-05 | v0.9-02 | Pending |
| DSC-01 | v0.9-03 | Pending |
| DSC-02 | v0.9-03 | Pending |
| DSC-03 | v0.9-03 | Pending |
| DSC-04 | v0.9-03 | Pending |
| FIX-01 | v0.9-04 | Pending |
| FIX-02 | v0.9-04 | Pending |
| FIX-03 | v0.9-04 | Pending |
| FIX-04 | v0.9-04 | Pending |

**Coverage:**
- v0.9 requirements: 18 total (16 original + NYQ-05 + DSC-04 added post-quorum)
- Mapped to phases: 18 (roadmap complete)
- Unmapped: 0

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 — traceability filled after v0.9 roadmap creation*
