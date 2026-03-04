# Project Research Summary: v0.27 Production Feedback Loop

**Project:** QGSD (Quorum Gets Shit Done)
**Domain:** Formal verification with production observability integration
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

v0.27 closes the gap between QGSD's formal verification pipeline and production reality by adding a production feedback loop architecture: a **unified observe skill** that pulls signals from production tools (Sentry, Prometheus, Grafana, GitHub, Logstash), a **fingerprint-deduplicating debt ledger** that aggregates and tracks production issues with formal parameter linkage, and a **P→F residual layer** in solve that compares formal model thresholds against observed production metrics.

The research consensus is clear: production feedback loops in formal verification contexts *must* follow a specific pattern—observe sources, deduplicate by fingerprinting (similar to Sentry's approach), route through human triage gates, then feed acknowledged debt into solve as an 8th residual layer. This requires minimal new stack (primarily prom-client, @elastic/elasticsearch, fastest-levenshtein for fingerprinting) and integrates cleanly into existing QGSD patterns (pluggable sources like triage, frozen artifacts like requirements.json, residual computation like the 7-layer solver).

However, integrating production signals into formal verification is a high-risk domain with **six critical pitfalls**: false positive floods from noisy sources, unbounded debt ledger growth, fingerprint collisions/splits that hide real issues, solve layer instability from adding P→F as a new residual, source abstraction leaks creating tight coupling, and human gate bypass where high-confidence observations skip quorum approval. The architecture survives only if each pitfall is prevented *during the initial build phase*, not retrofitted later.

## Key Findings

### Recommended Stack

Research across four implementation patterns (Sentry for error grouping, Prometheus for metrics, Elasticsearch for logs, custom observability stacks) converges on a minimal dependency approach:

**Core observability clients:**
- **prom-client** ^15.0.0 — Prometheus PromQL query HTTP client; official library with PromQL support, metric instrumentation, and full TypeScript types
- **@elastic/elasticsearch** ^8.17.0 — Official Elasticsearch JavaScript client; requires Node 20+ (matches QGSD v0.26 engines); one-to-one REST API mapping
- **@sentry/node** ^8.0.0 — Official Sentry SDK; includes issue fetching API and event ingestion
- **fastest-levenshtein** ^1.0.0 — 78k ops/sec fuzzy string matching for fingerprint deduplication; critical for real-time clustering of 1000+ issues

**Fingerprinting & deduplication:**
- **node-fetch** ^3.4.0 — Lightweight HTTP client for Grafana API (lightweight fallback if built-in fetch unavailable on Node 16)
- **crypto** (Node.js built-in) — SHA256 hashing for deterministic fingerprints (no external dependency)
- **ajv** ^8.12.0 (already installed in v0.26) — JSON Schema validation for debt ledger

**What NOT to add:** axios (too heavy), joi/yup (wrong pattern), ORM libraries (overkill for JSON), winston loggers (adds bloat).

### Expected Features

**Must have (table stakes):**
- Unified observe skill with pluggable sources (Sentry, Prometheus, GitHub, bash) — formal verification systems *require* production ground truth; without it, specs are disconnected from reality
- Debt ledger with fingerprint deduplication — production issues occur in multiples; grouping them (like Sentry's issue fingerprinting) is essential to avoid alert fatigue
- Human triage gate (acknowledge/schedule before solve) — users must review production signals before formal specs change; bypassing this violates R3 quorum protocol
- Formal parameter linkage in debt entries — solve can't generate targeted fixes without knowing which formal constants the breach violates
- P→F residual layer in solve — without feeding acknowledged debt into solve, the feedback loop is a read-only dashboard

**Should have (competitive advantage):**
- Configurable fingerprinting strategies and similarity thresholds — allows teams to tune grouping sensitivity per source type
- Real Prometheus/Grafana/Elasticsearch integration (vs stubs) — enables detection of SLA drifts, performance regressions, resource saturation directly in formal context
- Poisson binomial threshold breach detection integrated with formal sensitivity sweeps — re-run PRISM when production drift triggers threshold breach

**Defer (v1+):**
- Streaming real-time metric ingest — polling + user-driven acknowledge is sufficient for MVP
- Cross-source root cause synthesis — requires NLP or rule-based correlation; deferred until debt patterns stabilize
- Debt archive & retention policy — operational feature, deferred until ledger volume justifies it

### Architecture Approach

v0.27 extends QGSD's existing three-layer architecture (Plugin Interface → Skills/Orchestration → Diagnostics/Scripts → Configuration/State → Hook Enforcement) with three integrated production layers:

1. **Unified Observe Skill** — `/qgsd:observe` command replaces static triage with pluggable parallel-fetching sources (GitHub, Sentry, Prometheus, Grafana, Logstash, bash). Sources return standardized schema `{source, issue_id, title, severity, formal_signal}`. Fingerprinting happens before merge to deduplicate cross-source duplicates (same error from both Sentry and Prometheus = one aggregated debt entry).

2. **Debt Ledger** (`.formal/debt.json`) — New frozen artifact mirroring requirements.json pattern. Tracks observations with fingerprinting, occurrence counts, state transitions (open → acknowledged → resolving → resolved), formal parameter linkage, and linked issues. Immutable between observations; atomic replace like requirements.json.

3. **Solve P→F Residual** — `bin/qgsd-solve.cjs` gains 8th layer: Production-to-Formal comparison. Scans acknowledged debt entries; compares formal model thresholds (@threshold annotations) against observed values; surfaces divergences for remediation dispatch. Operates *only* on human-acknowledged debt (prevents automatic spec changes).

Integration pattern: Observe writes debt.json → User acknowledges entries → Solve reads debt.json (acknowledged only) → Computes P→F residual → Dispatches /qgsd:quick or /qgsd:debug for fixes → Re-diagnose and report.

**Key components:**
- `bin/observe.cjs` — Parallel source fetch + consolidation
- `bin/fingerprint-issue.cjs` — Hierarchical fingerprinting: source#type#category#scope
- `bin/merge-observations.cjs` — Deduplication by fingerprint match + occurrence aggregation
- `bin/extract-formal-thresholds.cjs` — Parse @threshold annotations from formal specs
- `commands/qgsd/observe.md` — Skill that orchestrates observe + triage gate
- `commands/qgsd/solve.md` Step 3h — New dispatch for P→F gap remediation

### Critical Pitfalls

Research identifies **six cascading pitfalls** that, if not prevented during initial build, make the system unstable:

1. **False Positive Floods from Noisy Observe Sources** — Sentry/GitHub/bash emit noise at scale; naïve aggregation creates 10x duplication, triage table grows from 4 to 47 items in one day, users stop using the system.
   - **Prevention:** Per-source deduplication before aggregation; noise filter gate (signal quality score >0.3); output limits per source (Sentry: top 10 by event count, GitHub: last 3 days, Bash: <50 lines); configurable --dedupe-strict mode using embeddings.
   - **Risk level:** CRITICAL — blocker if not addressed in Observe phase.

2. **Debt Ledger Grows Unbounded** — Without retention policies, ledger grows ~100 items/sprint; after 12 sprints, 1,200 items, solve command slows from 2s to 45s, users disable debt tracking.
   - **Prevention:** Automatic cleanup policies (max_age_days: 90, max_entries: 500); archive resolved debt to separate file; fingerprint stability tracking (variant_count>3 triggers manual review); auto-transition to FIXED_IN_PRODUCTION if no occurrence seen for 7 days + code fix deployed; `--gc-debt` flag in solve.
   - **Risk level:** HIGH — affects solver performance after first sprint.

3. **Fingerprint Collision or Splitting Hides Real Issues** — Algorithm too coarse → all network errors collapse to one issue; too fine → same bug from 20 components creates 20 entries.
   - **Prevention:** Configurable fingerprinting strategies (semantic, hash, rules-based, AI-embedding); automatic collision/split detection with user alerting; AI similarity check (cosine embedding distance); publish fingerprint health metrics in solver output.
   - **Risk level:** CRITICAL — triage table becomes either empty or 100+ duplicates.

4. **Solve Layer Instability When Adding P→F Residual** — Adding 8th layer destabilizes convergence; solver oscillates between states instead of converging to zero residual.
   - **Prevention:** Integrate P→F into layer ordering (observe triage → promotion → R→F remediation → rest); per-layer change detection instead of total residual check; freeze observations during solve run (new observations queue for next run); add oscillation detection to circuit breaker.
   - **Risk level:** HIGH — solve loop diverges/oscillates after first real debt observations arrive.

5. **Source Abstraction Leaks** — Framework-specific patterns (Prometheus labels, Sentry fingerprinting rules, GitHub label semantics) bleed into domain logic; adding new sources requires deep patches.
   - **Prevention:** Abstract sources behind `interface { async fetch(config) }` with source-specific handlers (SentryHandler, PrometheusHandler, etc.); validate config schema per source; route source-specific transform logic to separate modules.
   - **Risk level:** MEDIUM — becomes critical when third source type added (Prometheus).

6. **Human Gate Bypass** — Automatic promotion of high-confidence observations to requirements violates R3 quorum protocol.
   - **Prevention:** Require explicit `/qgsd:observe acknowledge <fingerprint>` action before entry enters solve; never auto-promote to requirements without quorum vote; triage gate is mandatory.
   - **Risk level:** CRITICAL — violates formal verification architecture.

## Implications for Roadmap

Research suggests a **6-phase v0.27 roadmap** structured by feature dependencies and pitfall prevention:

### Phase 1: Debt Ledger Foundation (Blocks everything else)
**Rationale:** Schema validation must come first — prevents corrupted data from entering the system before any skill runs.
**Delivers:** `.formal/debt.schema.json`, `bin/validate-debt-ledger.cjs`, empty seed debt.json, pre-commit hook gate.
**Avoids pitfalls:** #2 (unbounded growth) — retention policy + schema defined upfront; #3 (collisions) — fingerprint structure validated in schema.
**Complexity:** LOW (1 phase) — simple JSON structure, reuses ajv pattern from requirements.json.

### Phase 2: Observe Infrastructure & Fingerprinting (Core observe flow)
**Rationale:** Observation fetching and deduplication must be stable before hitting production sources.
**Delivers:** `bin/observe.cjs` skeleton (GitHub, Sentry, bash agents), `bin/fingerprint-issue.cjs`, `bin/merge-observations.cjs`, extend `.planning/triage-sources.md`.
**Avoids pitfalls:** #1 (false positives) — per-source dedup logic implemented; #3 (collisions) — hierarchical fingerprinting configured; #5 (abstraction leaks) — source interface abstraction designed.
**Complexity:** MEDIUM (1-2 phases) — parallel fetch proven pattern from triage, fingerprinting algorithm from Sentry research.
**Research flag:** None — fingerprinting pattern is well-established (Sentry's approach is industry standard).

### Phase 3: Triage Gate & State Machine (Human approval layer)
**Rationale:** Cannot feed data to solve until human gates it; prevents pitfall #6 (gate bypass).
**Delivers:** Human triage command, state transitions (open → acknowledged → resolving → resolved), `/qgsd:observe` skill orchestration.
**Avoids pitfalls:** #6 (auto-promotion) — gate is mandatory before solve; #1 (false positives) — user filters obvious noise during triage.
**Complexity:** LOW (0.5-1 phase) — standard UI (table + dropdown), reuses existing acknowledge workflow pattern.

### Phase 4: Formal Parameter Linkage & Solve Integration (Connect production to specs)
**Rationale:** Solve can't fix P→F gaps without knowing which formal parameters to adjust.
**Delivers:** Debt schema extended with `formal_parameters[]`, `bin/extract-formal-thresholds.cjs` (parse @threshold annotations), extend `bin/qgsd-solve.cjs` with P→F layer computation.
**Avoids pitfalls:** #4 (solve instability) — P→F layer integrated into layer ordering; #1 (false positives) — formal parameter linkage allows smart routing (formal_signal match → suggest /qgsd:solve P→F).
**Complexity:** MEDIUM (1-1.5 phases) — requires JSON navigation + mapping, no novel algorithms, per-layer change detection in solve.
**Research flag:** Requires annotation of all formal specs with @threshold comments — may need deeper review of which specs are targetable.

### Phase 5: Solve P→F Dispatch & Remediation (Close the feedback loop)
**Rationale:** Acknowledged debt must flow into solve and trigger fixes; without this, feedback loop is incomplete.
**Delivers:** Extended `bin/qgsd-solve.cjs` (P→F layer), updated `commands/qgsd/solve.md` Step 3h (P→F dispatch to /qgsd:quick or /qgsd:debug), oscillation detection in circuit breaker.
**Avoids pitfalls:** #4 (solve instability) — change detection prevents oscillation, observation freezing during solve run prevents mid-run requirement mutations.
**Complexity:** MEDIUM (1-1.5 phases) — integrates with existing solve orchestration, reuses residual computation pattern.

### Phase 6: Production Sources & Testing (Real integration)
**Rationale:** Stubs prove MVP works; real sources (Prometheus, Grafana, Elasticsearch) deferred to validation phase.
**Delivers:** `bin/observe.cjs` extended with PrometheusAgent, GrafanaAgent, LogstashAgent; test suites for fingerprint, dedup, observe agents; user guide (debt-ledger-guide.md); end-to-end integration test.
**Avoids pitfalls:** #1 (false positives) — real source integrations tested at scale before production; #3 (collisions) — fingerprinting stability verified across real data.
**Complexity:** MEDIUM-HIGH (2-3 phases) — requires HTTP client auth (OAuth, API keys), query API research per source type, metric schema normalization.
**Research flag:** **YES** — Real Prometheus/Grafana/Elasticsearch integration requires phase-specific research into authentication, query APIs, metric cardinality, and performance tuning. Initial MVP uses HTTP stubs; real sources validated separately.

### Phase Ordering Rationale

1. **Debt ledger schema first** — All downstream phases depend on valid data structure. Prevents corruption before any skill runs.
2. **Observe + fingerprinting second** — Must be stable before human triage gates it. Fingerprinting prevents false positive floods (pitfall #1).
3. **Triage gate third** — Human approval is mandatory before formal specs change. Prevents automatic promotion (pitfall #6).
4. **Formal parameter linkage fourth** — Only valuable once triage gates are operational; enables targeted fixes.
5. **Solve P→F integration fifth** — Closes feedback loop; requires stable debt ledger + parameter linkage. Prevents solve instability (pitfall #4).
6. **Real production sources last** — MVP proves architecture works with stubs; real sources are phase-specific deep dives (Prometheus PromQL complexity, Elasticsearch version brittleness, OAuth flows).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 6 (Real Production Sources):** Requires protocol-specific research (Prometheus PromQL query performance on high-cardinality labels, Elasticsearch API breaking changes between v7/v8, Grafana OAuth + API key rotation). Each source type may require custom metric normalization. Recommend /qgsd:research-phase.
- **Phase 4 (Formal Specs Annotation):** Requires audit of which formal specs (TLA+, PRISM, Alloy) currently have threshold constants and how to annotate them with @threshold comments. May reveal specs that can't be auto-linked to production metrics. Recommend /qgsd:research-phase if >20 specs need annotation.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Debt Schema):** JSON Schema validation is well-established (reuses ajv pattern). No research needed.
- **Phase 2 (Fingerprinting):** Sentry's fingerprinting approach is industry-standard and well-documented. No research needed.
- **Phase 3 (Triage Gate):** Human approval workflow is standard UI pattern. No research needed.
- **Phase 5 (Solve Integration):** Residual layer computation follows existing pattern. Oscillation detection is standard algorithm. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | prom-client, @elastic/elasticsearch, @sentry/node are official libraries with stable APIs (v15+, v8.17+, v8.0+). Levenshtein perf benchmarked (78k ops/sec verified). No version brittleness expected. |
| **Features** | HIGH | Sentry fingerprinting, debt ledger patterns, human-in-the-loop approval are industry standard (Jira, GitHub, Datadog all use these patterns). MVP feature set is conservative and proven. |
| **Architecture** | HIGH | Extends existing QGSD patterns (pluggable sources like triage, frozen artifacts like requirements.json, residual computation like 7-layer solver). Non-breaking integration. No novel architecture required. |
| **Pitfalls** | HIGH | Six critical pitfalls derived from observability systems literature (Sentry posts, Prometheus best practices, Netflix chaos engineering), formal verification research (TLA+ integration papers), and QGSD's existing 7-layer solver pattern. Prevention strategies are concrete and testable. |

**Overall confidence:** HIGH — All four research areas converge on clear recommendations. Primary uncertainty is production source integration (Phase 6), which is deferred with explicit research flag.

### Gaps to Address

**During planning phase:**

1. **Formal spec annotation strategy** — Which specs get @threshold annotations? How to handle specs without clear numeric thresholds (e.g., liveness properties)? Recommend quick audit in Phase 4 planning.

2. **Fingerprint collision recovery** — When AI similarity check detects a collision, what's the manual merge workflow? Recommend prototype in Phase 2 testing.

3. **Solve layer convergence proof** — With P→F layer added, does the 8-layer solver still converge? Recommend formal verification or empirical testing with 100+ synthesized debt entries.

4. **Production source API auth** — How to securely rotate Prometheus scrape targets, Grafana API keys, Elasticsearch credentials in `.planning/triage-sources.md`? Recommend vault integration design in Phase 6.

5. **Debt ledger size limits** — At what debt count does solve command become unacceptably slow? Recommend performance testing in Phase 2 with 1000+ synthesized entries.

## Sources

### Primary Research (HIGH confidence)
- **STACK.md** — Technology research verified against official library docs (prom-client GitHub, @elastic/elasticsearch docs, @sentry/node SDK, fastest-levenshtein benchmarks). Official Prometheus, Elasticsearch, Sentry client library documentation checked (2026-03-04).
- **FEATURES.md** — Feature prioritization based on Sentry issue grouping patterns (industry standard), human-in-the-loop workflows (Datadog/New Relic practices), formal verification integration (TLA+ papers). High confidence in MVP feature set.
- **ARCHITECTURE.md** — Architecture reuses proven QGSD patterns: pluggable sources from v0.22 triage, frozen artifacts from v0.24 requirements envelope, residual computation from v0.26 solve layer. Non-breaking integration confirmed by dependency analysis.
- **PITFALLS.md** — Six critical pitfalls derived from observability literature (Sentry fingerprinting rules, Prometheus high-cardinality label handling, Netflix chaos engineering), formal verification integration (convergence proofs, oscillation detection), and QGSD existing patterns (7-layer residual stability).

### Secondary Research (MEDIUM confidence)
- Sentry: Issue Grouping & Fingerprints — Fingerprinting strategy applied to QGSD's debt ledger.
- Prometheus Best Practices — PromQL query performance on high-cardinality labels.
- PRISM Probabilistic Model Checker — Sensitivity sweep integration (deferred to v0.27+).

### Tertiary (LOW confidence, needs validation)
- Cross-source root cause synthesis patterns — Deferred; requires NLP research.
- Streaming metric ingest — Deferred; QGSD uses polling for MVP.

---

*Research completed: 2026-03-04*
*Ready for roadmap: yes*
