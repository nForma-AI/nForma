# Research Summary: v0.27 Production Feedback Loop

**Domain:** Production observability integration, debt deduplication, formal model reconciliation with runtime

**Researched:** 2026-03-04

**Overall confidence:** MEDIUM-HIGH

## Executive Summary

QGSD v0.27 closes the critical gap between formal models (TLA+, Alloy, PRISM) and production reality by adding three capabilities: (1) a unified observe skill that fetches issues and metrics from production sources (Sentry, Prometheus, Grafana, Elasticsearch/Logstash, GitHub, bash) in parallel, (2) a debt ledger that deduplicates findings using hierarchical fingerprinting and aggregates occurrence counts with state tracking, and (3) a P→F residual layer in solve that compares formal model thresholds against production measurements and remediates acknowledged debt.

The stack is intentionally minimal: Node.js built-ins (crypto, http/https, fs) provide core functionality, and five focused libraries handle production APIs (prom-client for Prometheus PromQL, @elastic/elasticsearch for ELK, @sentry/node for Sentry, node-fetch for Grafana HTTP API, fastest-levenshtein for fuzzy dedup). This avoids heavyweight frameworks and maintains QGSD's pattern of explicit error handling and direct API integration.

**Key implication:** The observe skill becomes the bridge between formal verification and operational validation — formal specs can now verify against empirical production behavior, not just against test suites. Debt ledger fingerprinting prevents alert fatigue from duplicate issues being remediated separately. P→F integration enables solve to prioritize remediation of acknowledged debt that breaks formal properties.

## Key Findings

### Stack Summary

**Core technologies:**
- **prom-client@15.0.0** — Prometheus PromQL queries + metrics instrumentation; TypeScript types; 2000+ dependents
- **@elastic/elasticsearch@8.17.0** — Official ES client; requires Node 20+ (matches QGSD v0.26); forward-compatible
- **@sentry/node@8.0.0** — Official Sentry SDK for issue fetching; includes event API
- **node-fetch@3.4.0** — Lightweight HTTP client for Grafana API; 37 KB minified
- **fastest-levenshtein@1.0.0** — Fuzzy string matching (78k ops/sec) for dedup fingerprinting
- **ajv@8.12.0** (already installed) — Schema validation for debt.json

**No heavy ORM, no GraphQL, no streaming.** Direct API calls with explicit error handling (existing QGSD pattern).

### Architecture Implications

**Pluggable observe framework:**
Each production source (Sentry, Prometheus, etc.) becomes a class implementing `async fetch(config)`. Parallel `Promise.all()` dispatch allows fetching from all sources concurrently. Error recovery per source: one dead Prometheus instance doesn't block Sentry fetching.

**Hierarchical fingerprinting:**
- **Layer 1:** Exception type + function name → SHA256 (deterministic grouping)
- **Layer 2:** Fuzzy message matching via Levenshtein within same hash bucket (catches message variations)
- **Collision handling:** Falls back to full message if Levenshtein match fails (rare but required)

**Debt ledger state machine:**
```
open → acknowledged (human triage) → resolving (plan_id assigned) → resolved (plan completed)
```
Validation ensures transitions are one-way and require supporting data (e.g., no transition to "resolving" without a plan_id).

**P→F integration in solve:**
New residual layer after existing 7 layers (R→F, F→T, T→C, C→F, R→D, D→C):
- Input: formal parameter thresholds (from PRISM models, policy.yaml)
- Measure: actual values from production (from observe skill)
- Output: remediation tasks for any breach (e.g., "latency p95 drifted 200ms above threshold")
- Gate: only processes acknowledged debt (human has signed off)

### Pitfalls & Mitigations

| Pitfall | Why It Matters | Mitigation |
|---------|----------------|-----------|
| **Prometheus PromQL complexity** | High-cardinality labels can OOM on queries | Pre-design metrics with low cardinality; test queries in Prometheus console first; add per-query timeout (5m default) |
| **Elasticsearch version brittleness** | API breaking changes between major versions | Pin @elastic/elasticsearch to exact version (8.17.0); test query compatibility in CI; don't auto-upgrade |
| **Fingerprinting collisions** | Unrelated issues grouped together due to fuzzy matching | Hierarchical fallback: try hash-bucket first, then Levenshtein, then full message; threshold tuning (0.85 similarity) |
| **Debt state machine incompleteness** | Acknowledging debt without resolving plan leaves system stuck | Schema validation enforces: no "resolving" without plan_id; no "resolved" without completion proof |
| **Alert fatigue from duplicates** | Same issue reported 1000× creates 1000 tickets | Deduplication essential; fingerprinting groups by type+function, then Levenshtein catches message variations |
| **False positives in metric drift detection** | Noisy metrics trigger false P→F violations | Add hysteresis: require 3 consecutive violations before triggering remediation; store last 10 measurements |
| **API rate limiting** | Observe skill slams production APIs on every run | Implement exponential backoff; use production API rate limits in config; optional Redis caching for repeated queries |

### Feature Dependencies

```
Observe Skill (fetch from production sources)
├── requires── Prometheus client (prom-client) when querying Prometheus
├── requires── Elasticsearch client when querying ELK
├── requires── Sentry client when fetching issues
├── requires── HTTP client (node-fetch) for Grafana API
└── requires── Error recovery per source (partial failures OK)

Fingerprinting Engine
├── requires── SHA256 hashing (Node.js crypto)
├── requires── Levenshtein matching (fastest-levenshtein)
└── requires── Hierarchical fallback logic (on collision)

Debt Ledger
├── requires── Fingerprinting Engine (to group issues)
├── requires── State machine validation (ajv + debt.schema.json)
├── requires── Occurrence aggregation logic
└── requires── Formal parameter linkage (reference PRISM/policy thresholds)

P→F Integration in Solve
├── requires── Observe Skill (fetch production measurements)
├── requires── Debt Ledger (filter to acknowledged items only)
├── requires── Formal parameters (PRISM values, policy.yaml)
├── requires── Comparison logic (actual vs threshold)
└── requires── Existing solve residual chain (insert P→F as 8th layer)

Dashboard Updates
└── optionally── Debt ledger display showing fingerprint clusters, state transitions, remediation progress
```

## Implications for Roadmap

Based on research, suggested phase structure for v0.27:

### Phase 1: Pluggable Observe Skill Foundation
- **Goal:** Establish pluggable source architecture and fetch from Prometheus (common case)
- **Deliverables:**
  - `bin/observe-production.cjs` with `ObserveSource` base class
  - `PrometheusSource` subclass (queries histogram_quantile, rate, etc.)
  - Config schema for Prometheus endpoint + PromQL query list
  - Error recovery per source; partial failures don't block other sources
- **Rationale:** Prometheus is the highest-adoption monitoring tool; defer Elasticsearch/Sentry to phase 2
- **Size:** ~300 lines, ~2-3 days

### Phase 2: Sentry + Elasticsearch Sources
- **Goal:** Add issue fetching (Sentry) and log querying (ELK)
- **Deliverables:**
  - `SentrySource` subclass
  - `ElasticsearchSource` subclass
  - Integration tests for each source
  - Parallel dispatch test (all sources called concurrently)
- **Rationale:** Error tracking + log analysis are next most common; most teams use at least one
- **Size:** ~400 lines, ~3-4 days

### Phase 3: Fingerprinting & Deduplication Engine
- **Goal:** Group issues by exception type/function, then fuzzy-match by message
- **Deliverables:**
  - `bin/fingerprint-issue.cjs` — hierarchical SHA256 + Levenshtein
  - `bin/deduplicate-issues.cjs` — output `.formal/debt-raw.jsonl`
  - Configuration for Levenshtein threshold (default 0.85)
  - Collision handling tests
- **Rationale:** Dedup must happen before aggregation, else debt ledger has 1000 identical issues
- **Size:** ~250 lines, ~2-3 days
- **Formal verification input:** Fingerprinting correctness can be verified with sample issue sets

### Phase 4: Debt Ledger Schema & Validation
- **Goal:** Design and validate the immutable debt ledger structure
- **Deliverables:**
  - `.formal/debt.schema.json` (JSON Schema Draft-07)
  - `bin/aggregate-debt.cjs` — occurrence counting, state transitions
  - `bin/validate-debt.cjs` — ajv-based pre-commit hook
  - State machine tests (open→acknowledged→resolving→resolved)
- **Rationale:** Schema must be right before P→F integration depends on it; use formal verification to check state transitions
- **Size:** ~200 lines, ~2 days

### Phase 5: P→F Residual Layer in Solve
- **Goal:** Compare formal thresholds against production measurements; remediate acknowledged debt
- **Deliverables:**
  - `bin/solve-p-f-layer.cjs` — new layer 8 in solve convergence loop
  - PRISM parameter extraction + production value comparison
  - Gating: only processes acknowledged debt
  - Remediation task generation (add to solve status)
- **Rationale:** This is the closure: formal models now validate against production reality
- **Size:** ~300 lines, ~3 days
- **Formal verification requirement:** TLA+ spec for state transitions (open→acknowledged→resolving→resolved) must be checked

### Phase 6: Dashboard & Observability
- **Goal:** Visualize debt ledger state and remediation progress
- **Deliverables:**
  - Debt ledger display in existing dashboard (blessed TUI)
  - Fingerprint cluster view (group issues by primary hash)
  - State transition timeline
  - P→F violation summary
- **Rationale:** Operators need visibility into which production issues are blocking formal properties
- **Size:** ~250 lines, ~2-3 days

**Total: 6 phases, ~1700 lines, ~15-18 days (3-4 weeks)**

### Phase Ordering Rationale

1. **Observe first** — can't have debt ledger without production data
2. **Dedup second** — raw data is unusable without grouping
3. **Schema/validation third** — debt.json must be well-formed before integration
4. **P→F fourth** — can now close the formal→production loop
5. **Dashboard last** — nice-to-have for visibility, not blocking
6. **All together** — each phase builds on the previous; no reordering possible

## Research Flags for Phases

| Phase | Likely Needs Deeper Research | Reason |
|-------|------------------------------|--------|
| 1 (Prometheus) | **Moderate** | PromQL query design; need to understand metric naming conventions, label cardinality, query performance; recommend Prometheus console testing before implementation |
| 2 (Sentry/ES) | **Moderate** | Sentry API breaking changes; Elasticsearch query DSL learning curve; recommend API endpoint testing in curl first |
| 3 (Fingerprint) | **Low** | Levenshtein is well-established; only need to tune similarity threshold (default 0.85 should work) |
| 4 (Debt schema) | **Moderate** | State machine ordering (open→ackd→resolving→resolved); need to verify transitions are one-way and require supporting data; formal verification can help here |
| 5 (P→F solve) | **Moderate** | Integration with existing 7-layer solve loop; need to ensure P→F layer doesn't break existing remediation; recommend formal spec of state transitions |
| 6 (Dashboard) | **Low** | Reuse existing blessed TUI patterns from v0.26 dashboard |

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (Prometheus/ES/Sentry APIs) | HIGH | All three are official libraries; APIs verified stable; TypeScript types present; 2000+ dependents on prom-client |
| Fingerprinting approach | MEDIUM-HIGH | Levenshtein for fuzzy matching is standard; performance (78k ops/sec) verified; collision handling requires testing but pattern is sound |
| Debt ledger schema | MEDIUM | State machine ordering needs formal verification; initial design sound but may need iteration on what data is required for each state |
| P→F integration | MEDIUM | Concept is sound; integration point with existing 7-layer solve loop needs careful testing; no major blockers anticipated |
| Production deployment | MEDIUM | All libraries have active maintenance; breaking changes unlikely in near term; version pinning + changelog review required |

## Gaps to Address

1. **Prometheus query design** — no internal expertise on optimal metric naming; recommend review with Prometheus-experienced ops engineer
2. **Elasticsearch DSL tuning** — query performance on large indexes needs load testing; may need query optimization phase
3. **Sentry API rate limits** — unknown if querying 1000s of issues will hit rate limits; need to test with real Sentry instance
4. **Fingerprinting threshold tuning** — 0.85 Levenshtein similarity is a guess; needs calibration on real issue corpus (10k+ samples)
5. **State machine completeness** — debt ledger states seem complete (open→ackd→resolving→resolved) but may need "ignored" or "wont_fix" states
6. **Performance under scale** — observe skill must complete in reasonable time (5-10 minutes) even with 1000s of issues; parallelization helps but needs benchmarking

## Next Steps for Implementation

1. **Start with Prometheus-only** (Phase 1) — gain confidence on pluggable architecture before adding more sources
2. **Test PromQL queries first** — write queries in Prometheus console UI; verify performance before coding
3. **Mock production sources in tests** — don't depend on real Prometheus/ES/Sentry for unit tests
4. **Fingerprinting corpus** — collect 10k+ real issue examples to calibrate Levenshtein threshold
5. **State machine formal spec** — write a TLA+ spec of debt ledger state transitions; run TLC to verify no deadlocks
6. **P→F integration tests** — verify that P→F layer doesn't interfere with existing solve layers (regression test all 8 layers together)

---

**Stack research for: QGSD v0.27 Production Feedback Loop**
**Researched: 2026-03-04**
**Confidence: MEDIUM-HIGH (official APIs verified; established patterns; gaps identified for deeper work)**
