# Requirements: QGSD v0.23 Formal Gates

**Defined:** 2026-03-02
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.23 Requirements — Formal Gates

TLC/Alloy/PRISM become actual enforcing gates in every major QGSD workflow step. Not specs that Claude reads — tools that run, produce output, and hard-block on violations. An integration test suite proves the chain is live.

### Workflow Integration

- [ ] **WFI-01**: `plan-phase` workflow performs formal scope scan before planner spawns — discovers `formal/spec/*/invariants.md` for keyword-matched modules and populates `$FORMAL_SPEC_CONTEXT`
- [ ] **WFI-02**: `plan-phase` requires `formal_artifacts:` declaration in PLAN.md frontmatter when `$FORMAL_SPEC_CONTEXT` is non-empty; planner receives invariants in `<files_to_read>`
- [ ] **WFI-03**: `execute-phase` runs `bin/run-formal-check.cjs` after executor wave completes and before verifier fires; `FORMAL_CHECK_RESULT` passed to verifier
- [ ] **WFI-04**: `qgsd-verifier` agent invokes `run-formal-check.cjs` and incorporates actual TLC/Alloy/PRISM output as ground truth in verification pass — not LLM eyeballing
- [ ] **WFI-05**: `qgsd-roadmapper` reads `formal/spec/*/invariants.md` for keyword-matched modules when designing phases; invariant constraints visible in phase planning context

### Enforcement

- [ ] **ENF-01**: TLC/Alloy/PRISM counterexample (`run-formal-check.cjs` exit 1) causes hard verification failure — workflow blocked, not warned; verifier status set to `counterexample_found`
- [ ] **ENF-02**: User can explicitly override a counterexample block with acknowledgment logged to VERIFICATION.md (audit trail preserved)
- [ ] **ENF-03**: Fail-open preserved across all wired workflows — missing java, missing jars, missing PRISM binary → skip with warning, never block

### Integration Validation

- [ ] **IVL-01**: Integration test script (`bin/test-formal-integration.cjs` or equivalent) proves formal tools actually ran by checking stdout/exit codes — not just that workflow text says they should
- [ ] **IVL-02**: Test covers the full chain: plan-phase scan → `FORMAL_SPEC_CONTEXT` populated → executor → `run-formal-check` fires → verifier receives `FORMAL_CHECK_RESULT` with real TLC output
- [ ] **IVL-03**: All existing TLA+ specs (`QGSDDeliberation.tla`, `MCbreaker.cfg`, `MCliveness.cfg`, etc.) pass TLC clean after integration — no regressions introduced

## Already Delivered (quick-130, 2026-03-02)

- `bin/run-formal-check.cjs` — lightweight per-module runner, fail-open, emits `FORMAL_CHECK_RESULT` JSON
- Step 6.3 in `quick --full` — post-execution formal check, guard on `$FORMAL_SPEC_CONTEXT`, hard-fail on counterexample
- Installed copy synced to `~/.claude/qgsd/workflows/quick.md`

## Out of Scope

| Feature | Reason |
|---------|--------|
| New TLA+/Alloy/PRISM spec authoring | v0.22+ covers spec generation; v0.23 is about running existing specs |
| GUI/dashboard for FV results | Out of scope for CLI-first tool |
| Parallel TLC workers | Single-threaded TLC sufficient; parallelism is a future perf optimization |
| Automatic counterexample repair | Counterexample should surface to human/quorum for diagnosis, not auto-fixed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WFI-01 | v0.23-01 | Pending |
| WFI-02 | v0.23-01 | Pending |
| WFI-03 | v0.23-02 | Pending |
| WFI-04 | v0.23-02 | Pending |
| WFI-05 | v0.23-03 | Pending (gap closure) |
| ENF-01 | v0.23-02 | Pending |
| ENF-02 | v0.23-02 | Pending |
| ENF-03 | v0.23-01 | Pending |
| IVL-01 | v0.23-04 | Pending (gap closure) |
| IVL-02 | v0.23-04 | Pending (gap closure) |
| IVL-03 | v0.23-04 | Pending (gap closure) |

**Coverage:**
- v0.23 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓
- Gap closure phases: v0.23-03 (WFI-05 + ISSUE-1/2), v0.23-04 (IVL-01 + IVL-02 + IVL-03)

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 — gap closure phases assigned (plan-milestone-gaps v0.23)*
