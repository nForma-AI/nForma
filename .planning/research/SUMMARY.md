# Project Research Summary: QGSD v0.26 Operational Completeness

**Project:** QGSD — Quorum Gets Shit Done (v0.26)
**Domain:** Claude Code plugin with multi-model quorum enforcement, formal verification, and operational tooling
**Researched:** 2026-03-03
**Overall Confidence:** HIGH

---

## Executive Summary

v0.26 targets six operational features that transform QGSD from a formal verification research tool into a production-ready plugin: portable cross-platform installation (no hardcoded paths), secure credential lifecycle management with rotation support, policy-as-code YAML configuration (driving PRISM parameters and quorum behavior), real-time terminal dashboards for observability, architecture constraint enforcement (preventing SDK bundling), and cross-model formal decomposition analysis (parallelizing TLA+ model checking).

The recommended approach is **phase-based delivery with strict dependency ordering**: start with policy configuration (foundation for all downstream features), then credential management (foundations for secure state), portable installer (enabling deployment), followed by dashboard and architecture enforcement (operational visibility and CI gates), deferring cross-model decomposition to v0.27+ due to high formal methods complexity. This ordering avoids integration pitfalls identified in research: hardcoded paths break everything downstream, shallow config merges lose nested policy settings silently, and hook installation missyncs create divergence between source and production.

Critical risks: portable installers require platform-specific testing (macOS/Linux/Windows); credential rotation must be async (synchronous rotation blocks quorum); policy configuration can violate R3 quorum protocol constraints if not validated; dashboard state can diverge from hook layer causing user confusion; formal model annotations drift from implementation as code evolves. All risks are documented with prevention strategies in the pitfalls research.

---

## Key Findings

### Recommended Stack

v0.26 leverages **existing patterns already in QGSD** plus minimal new dependencies:

**Core technologies:**
- **caxa** (^4.1.0): Cross-platform Node.js binary packaging
- **js-yaml** (^4.1.0): YAML parsing for policy.yaml (replaces regex)
- **ajv** (^8.12.0): JSON Schema validation for policy structure
- **dependency-cruiser** (^10.0.0): Architecture linting (no SDK bundling)
- **blessed** (^0.1.81, existing): Terminal dashboard UI
- **keytar** (^7.9.0, existing + @napi-rs/keyring fallback): OS keychain storage

**Critical caveat:** Chalk pinned to ^4.x (CommonJS); do NOT upgrade to v5 (ESM-only) until codebase migrates.

### Expected Features

**Must have for v0.26 (table stakes):**
- **PORT-01..03:** Portable installer (macOS/Linux/Windows without hardcoded paths)
- **PRST-01..02:** Persistent config (survives npm upgrades)
- **CRED-01..02:** Credential rotation (async, without downtime)
- **PLCY-01..03:** Policy configuration (YAML-driven PRISM parameters)
- **DASH-01..03:** Real-time dashboard (live quorum status)

**Should have for v0.27+ (differentiators):**
- **ARCH-10:** Architecture enforcement (prevent SDK bundling in CI)
- **DECOMP-05:** Cross-model decomposition (parallel TLC, deferred)

### Architecture Approach

v0.26 extends hook-based enforcement layer (3 hooks + config loader) without breaking changes. Major integration points: policy → PRISM/dispatch, credentials → secure state, scoreboard → dashboard, dependency-cruiser → CI gate.

### Critical Pitfalls

**Top 3 blocking risks:**

1. **Hardcoded paths break portable installs** — Provider unavailability on different machines. Prevention: Dynamic resolve-cli.cjs + template expansion ({HOME}, {HOMEBREW_PREFIX}).

2. **Shallow config merge loses nested policy** — User partial override silently replaces entire policy object. Prevention: Flat config keys OR deep-merge validator with backfill.

3. **Dashboard state diverges from hook layer** — Display shows "APPROVED" while Stop hook hasn't seen consensus. Prevention: Versioned scoreboard + fs.watch() (not polling).

4. **Credential rotation blocks quorum** — Sync rotation hangs slot worker, quorum timeout exceeded. Prevention: Async background rotation + offline fallback token.

5. **Policy violates R3 protocol** — User sets impossible thresholds (0.99 votes in 4-model quorum). Prevention: validatePolicyAgainstR3() with CRITICAL error on violation.

6. **Hook sync omitted** — Edit hooks/config-loader.js without syncing to ~/.claude/hooks/. Prevention: Mandatory install-sync step in every plan that modifies hooks.

See PITFALLS.md for 12 total critical pitfalls + 11 technical debt patterns + 9 integration gotchas + prevention strategies.

---

## Implications for Roadmap

**Phase 1: Policy Configuration (PLCY-01..03)** — Foundation; no dependencies
- Delivers: policy.schema.json, edit-policy.cjs (blessed menu), validatePolicyAgainstR3()
- Avoids: Pitfalls 2, 5 (shallow merge, R3 violation)
- Effort: 2–3 days

**Phase 2: Credential Management (CRED-01..02)** — Depends on Phase 1
- Delivers: credential-manager.cjs (keytar wrapper), async rotation, audit logging
- Avoids: Pitfalls 4, 10 (rotation deadlock, credentials in Git)
- Effort: 3–4 days
- Testing: Simulate provider down during rotation; verify fallback

**Phase 3: Portable Installer (PORT-01..03)** — Depends on Phase 2
- Delivers: export-roster.cjs, import-roster.cjs, caxa binary build, template path expansion
- Avoids: Pitfalls 1, 9 (hardcoded paths)
- Effort: 2–3 days
- Testing: Fresh Linux install; verify no hardcoded paths

**Phase 4: Dashboard (DASH-01..03)** — Can parallel with Phase 3
- Delivers: dashboard.cjs (blessed TUI), fs.watch() sync, version field in scoreboard, TTY fallback
- Avoids: Pitfalls 3, 11 (state divergence, TTY crash)
- Effort: 4–5 days
- Testing: Dashboard display matches scoreboard version

**Phase 5: Architecture Enforcement (ARCH-10)** — Pure CI gate
- Delivers: check-bundled-sdks.cjs, scoped linting rules, baseline reporting
- Avoids: Pitfall 6 (false positives)
- Effort: 1 day

**Phase 6: Cross-Model Decomposition (DECOMP-05)** — OPTIONAL, deferrable to v0.27+
- Delivers: analyze-state-space.cjs (SCC analysis), run-decomposed-tlc.cjs (parallel TLC)
- Avoids: Pitfall 7 (TLC timeout)
- Effort: 3–5 days
- Research flag: Validate state space estimates and TLC budget before shipping

### Phase Ordering Rationale

1. Policy first — No dependencies; non-negotiable R3 validation
2. Credentials second — Enables secure export/import (Phase 3)
3. Portable installer third — Requires credential-manager; enables distribution
4. Dashboard parallel — Read-only; explicit sync prevents divergence
5. Architecture fifth — Pure CI; no runtime risk
6. Decomposition deferrable — Highest complexity; formal methods expertise needed

---

## Research Flags

**Phases needing deeper research:**
- Phase 3 (Portable Installer): Platform testing (macOS/Linux/Windows binary builds, path resolution)
- Phase 4 (Dashboard): Blessed TUI state sync with concurrent writes, render performance at 10+ rounds/sec
- Phase 6 (Decomposition): TLA+ state space estimates, SCC analysis correctness, 5-min budget calibration

**Phases with standard patterns (skip research):**
- Phase 1 (Policy): JSON Schema + YAML parsing well-established
- Phase 2 (Credentials): Keytar + async rotation documented best practices
- Phase 5 (Architecture): Dependency-cruiser mature; focus on scoping rules

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs verified (caxa GitHub, js-yaml v4.1.0, ajv v8 stable, blessed fork maintained, keytar archive + @napi-rs/keyring fallback) |
| Features | HIGH | 10/10 shipped features analyzed; ecosystem patterns verified; dependencies mapped to existing QGSD infrastructure |
| Architecture | HIGH | All six features integrate without breaking changes; component boundaries documented; backward compatibility verified |
| Pitfalls | HIGH | 12 critical pitfalls from live source analysis + prior v0.18 research; prevention strategies documented; recovery costs estimated |

**Overall: HIGH confidence. Ready for roadmap planning.**

---

## Gaps to Address During Planning

1. **Caxa binary size:** Empirical measurement needed (estimate ~30MB vs. pkg ~60MB)
2. **TLC decomposition budget:** Validate 5-min assumption with merged model timings
3. **Dashboard render performance:** Test with 10k+ lines in scoreboard JSONL
4. **Keytar on CI:** Test @napi-rs/keyring on GitHub Actions; document env var fallback
5. **Cross-platform path resolution:** Validate resolve-cli.cjs on Linux (homebrew paths), Windows (.cmd wrappers)

---

## Sources

**STACK.md (HIGH):** caxa, js-yaml, ajv, dependency-cruiser, blessed, keytar, chalk version constraints
**FEATURES.md (HIGH):** 10 shipped features, ecosystem patterns, feature dependencies, MVP definition
**ARCHITECTURE.md (HIGH):** Hook layer, config layer, quorum dispatch, formal verification, data flows, build order
**PITFALLS.md (HIGH):** 12 critical + 11 technical debt + 9 integration + prevention strategies + recovery costs
**QGSD context:** PROJECT.md, requirements.json, prior milestones v0.1–v0.25

---

*Research synthesis completed: 2026-03-03*
*Ready for roadmap creation: YES*
