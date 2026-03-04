# Feature Research: Production Feedback Loop (v0.27)

**Domain:** Formal verification with production observability integration
**Researched:** 2026-03-04
**Confidence:** HIGH

## Executive Summary

The v0.27 milestone closes the loop between QGSD's formal verification pipeline and production reality. Based on ecosystem research, production feedback loops in formal verification contexts follow a layered pattern: an observe layer surfaces issues and metric drifts from production tools via pluggable sources (Sentry, Prometheus, Grafana, custom APIs); a debt ledger aggregates and deduplicates these signals using fingerprinting similar to Sentry's issue grouping; a human triage gate classifies observed debt as acknowledged/unacknowledged; and solve gains a P→F residual layer that remediates acknowledged debt by comparing formal model thresholds against production measurements. This architecture enables production signals to feed formal verification: if production shows an SLA breach, the debt ledger captures it; if multiple occurrences establish a pattern, fingerprinting groups them; once acknowledged by humans, solve can generate fixes that bring production back in line with formal guarantees.

The three key features (unified observe skill, debt ledger with fingerprinting, P→F residual layer) build on existing QGSD infrastructure: triage already fetches from multiple sources; solve already has R→F, F→T, C→F, T→C, F→C, R→D, D→C residuals; the formal model registry and requirements envelope are in place. What's missing is pluggable production sources, hierarchical fingerprinting, state tracking for acknowledged vs. unacknowledged debt, and threshold comparison between formal parameters and production metrics.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete in a formal verification context.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Unified observe skill | Formal verification tools need production ground truth; fetching from multiple sources is industry standard (Datadog, New Relic, Prometheus+Grafana stacks). Without it, formal specs are disconnected from reality. | MEDIUM | Extends existing `/qgsd:triage` infrastructure; requires pluggable source abstraction similar to how triage sources work |
| Debt ledger with fingerprint deduplication | SLA/threshold breaches in production can occur thousands of times; grouping them (like Sentry's issue grouping) is essential to avoid alert fatigue and human triage drowning. Default Sentry pattern: group by exception type → function → message pattern. | MEDIUM | Sentry's fingerprinting scheme is proven; hierarchical hashing (flat + hierarchical secondary hashes) matches industry practice |
| Production→Formal residual layer in solve | Solve currently handles Requirements→Formal→Tests→Code→Docs residuals. Production debt must fit into the same convergence loop to be actionable (otherwise debt ledger is a read-only dashboard). | MEDIUM | New 8th residual layer; uses existing solve scaffolding (residual vector, gap detection, remediation dispatch) |
| State tracking for debt (open/acknowledged/resolving/resolved) | Humans need to distinguish between "newly observed" debt vs. "we're already working on it" vs. "fixed, waiting for deploy." Without state tracking, acknowledge gates are invisible and solved issues resurface as noise. | LOW | Standard issue lifecycle; mirrors GitHub/Sentry/Jira state models |
| Formal parameter linkage in debt | When formal model says "consensus within 3 rounds," solve needs to know which formal parameters the breach violates (e.g., `MaxRounds=3`, `TP_rate=0.95`). Without linkage, solve can't generate targeted fixes. | MEDIUM | Requires mapping between debt fingerprints and `.formal/requirements.json` requirement IDs, then to model parameters in `.formal/model-registry.json` |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Config-driven source framework with real Prometheus/Grafana/ELK integration | Most formal verification systems are isolated from production. QGSD can surface not just errors but SLA drifts, performance regressions, and resource saturation directly in formal parameter context. Teams can see "consensus hit 0.92 (model says 0.95) because CPU throttled at 12:04 UTC." | MEDIUM-HIGH | Initial MVP uses stub sources (fake Prometheus response, etc.); real integrations (OAuth, Grafana API, ELK query) deferred to phase-specific work. HTTP client in place; auth scaffolding ready. |
| Hierarchical fingerprinting with configurable similarity thresholds | Sentry uses fixed patterns; QGSD can let users tune grouping sensitivity (strict: group only identical messages; lenient: group by function only; custom: regex patterns). Enables teams to adapt debt ledger granularity. | MEDIUM | Requires fingerprint score calculation; default hierarchical model (type → function → message pattern for issues; parameter key for drifts) from research. User configuration in `.planning/debt-sources.md` similar to `triage-sources.md` |
| Poisson binomial threshold breach detection integrated with formal sensitivity sweeps | When production drift triggers a threshold breach, an optional feature can re-run PRISM sensitivity sweep to see if the breach would violate formal properties at the new parameter values. Surfaces second-order impact of production anomalies. | HIGH | Requires PRISM integration with `.planning/debt.json` parameter linkage; deferred to v0.27-x phases; not MVP. |
| Cross-source correlation & root cause synthesis | If Sentry shows "consensus failed" AND Prometheus shows "CPU at 100%," the system can synthesize a root-cause hypothesis: "consensus failed due to CPU contention." Enables solve to target the actual cause (e.g., optimize quorum timeout vs. just retrying). | HIGH | NLP synthesis or simple rule-based correlation; deferred to post-MVP, useful for roadmap prioritization in v0.28+. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time streaming of ALL production metrics into debt ledger | "We want to see every metric deviation instantly." | Creates overwhelming noise; formal verification works on convergence horizons (per-phase), not per-event. Metrics that spike for 10s then recover don't warrant formal model changes. | Configurable aggregation windows (e.g., "report if SLA breached for ≥5 min" vs. "iff SLA breached for ≥1h") — allow users to set noise floor. Initial MVP uses manual debt acknowledgment to filter. |
| Automatic solve remediation without human triage gate | "If debt is observed, solve should just fix it." | Solve's remediation dispatch (code changes, formal parameter edits) needs human judgment — wrong fixes can be worse than bugs. QGSD's quorum gate (v0.23) enforces this; bypassing it violates the architecture. | Keep triage gate mandatory. Solve operates only on human-acknowledged debt. Optionally add confidence tiers (high-confidence: suggest auto-fix; low-confidence: require review). |
| Infinite history in debt ledger | "Track every debt occurrence forever." | `.formal/debt.json` would grow unbounded; query performance degrades; storage costs spike for high-cardinality systems. Formal specs don't need 5-year history; they need "is this still broken?" | Configurable retention (e.g., 30d by default; users can trim via `--prune-before <date>`). Archive resolved debt to `.formal/debt-archive.jsonl` for post-mortem analysis. |
| Strict 1:1 mapping between debt and requirements | "Every debt item must link to exactly one requirement." | Real-world production issues often span multiple requirements (e.g., "consensus failed AND docs are wrong"). Forcing 1:1 creates artificial issue splitting. | Allow debt items to link to multiple requirements (array in schema); link to zero if unmappable (flag for manual triage later). |
| Per-source customizable fingerprinting logic | "Let users define custom fingerprinting for each source." | Exponential complexity explosion; users will fingerprint inconsistently across sources; cross-source correlation breaks. | Single canonical fingerprinting model with configurable sensitivity thresholds. Custom matchers for specific sources (e.g., regex filter for Sentry events) available, but fingerprinting logic is unified. |

## Feature Dependencies

```
[Unified observe skill]
    └──requires──> [Pluggable source abstraction (extends triage)]
    └──requires──> [Production metric source types schema]

[Debt ledger with fingerprinting]
    └──requires──> [Unified observe skill]
    └──requires──> [Hierarchical fingerprint engine]
    └──requires──> [State tracking (open/acknowledged/resolving/resolved)]

[Formal parameter linkage]
    └──requires──> [Debt ledger schema with requirement_id array]
    └──requires──> [.formal/requirements.json bidirectional link to model-registry.json]

[P→F residual layer in solve]
    └──requires──> [Debt ledger with acknowledged state]
    └──requires──> [Formal parameter linkage]
    └──requires──> [Solve orchestrator refactor to add 8th residual]

[Human triage gate]
    └──requires──> [Debt ledger with state tracking]
    └──enhances──> [Formal verification feedback loop] (gates which debt enters solve)

[Config-driven source framework]
    └──requires──> [Pluggable source abstraction]
    └──enhances──> [Unified observe skill] (enables real Prometheus/Grafana/ELK)

[Poisson binomial threshold breach detection]
    └──requires──> [P→F residual layer]
    └──requires──> [PRISM auto-calibration from scoreboard] (already shipped v0.21)
    └──enhances──> [Formal parameter linkage]

[Cross-source root cause synthesis]
    └──enhances──> [Solve remediation dispatch]
    └──conflicts──> [Strict 1:1 debt-to-requirement mapping] (requires many-to-many model)
```

### Dependency Notes

- **Unified observe skill requires pluggable source abstraction:** The existing `/qgsd:triage` command hardcodes GitHub, Sentry, Sentry Feedback, and Bash handlers. Debt ledger needs the same handlers PLUS production metric sources (Prometheus, Grafana, ELK). Abstracting sources into a plugin interface (interface with `fetch()` method + source config schema) enables both.
- **Debt ledger requires fingerprinting:** Without deduplication, a sustained SLA breach across 1000 API calls creates 1000 debt items. Sentry's pattern (group by exception type → stack frame function → message pattern) reduces noise by 100–1000×. QGSD's debt must use the same principle.
- **P→F residual requires acknowledged state:** Solve's existing R→F residual finds requirements without formal coverage. The P→F residual finds acknowledged production debt without fixes. If debt isn't acknowledged (state=open), it's noise, not a signal to solve.
- **Human triage gate conflicts with auto-solve:** QGSD's architecture (v0.23 formal gates) requires quorum approval for remediation dispatch. Triage gate is a pre-solve filter, not a post-solve validation. Gate must be mandatory.
- **Poisson binomial detection requires sensitivity sweep linkage:** Only valuable if PRISM knows which parameters drive the threshold breach. Requires mapping debt parameters back to formal model constants (e.g., `TP_rate` → Sentry issue threshold), then re-run sensitivity sweep. Medium complexity, deferred to v0.27-03 or later.

## MVP Definition

### Launch With (v0.27, six 1-phase modules)

Minimum viable product — what's needed to validate the concept: observe production issues, group them, get human approval, feed into solve.

- [ ] **Unified observe skill (v0.27-01)** — Pluggable source abstraction; initial sources: GitHub, Sentry, Sentry Feedback, Bash (reuse from triage); Prometheus/Grafana/ELK stubs for compatibility. Parallel fetch, 5-source scale test (parallel Bash script + mock HTTP). Why essential: without this, can't fetch production signals.
- [ ] **Debt ledger schema (v0.27-02)** — `.formal/debt.json` with fields: `id`, `source`, `title`, `description`, `fingerprint`, `requirement_ids[]`, `state` (open|acknowledged|resolving|resolved), `created_at`, `acknowledged_at`, `first_seen`, `occurrences`, `last_seen`, `severity`, `production_parameters{}`. Why essential: data structure for debt tracking; enables state tracking without this, acknowledge gates don't work.
- [ ] **Hierarchical fingerprinting engine (v0.27-03)** — `bin/fingerprint-debt.cjs` with hierarchical hashing (exceptions: type→function→message; drifts: parameter_key); flat + secondary hierarchical hashes per Sentry pattern; configurable similarity thresholds via `.planning/debt-sources.md`. Why essential: deduplicates noise, without this triage is overwhelmed.
- [ ] **Human triage gate (v0.27-04)** — `/qgsd:triage-debt` command fetches from observe sources, deduplicates via fingerprinting, renders prioritized table (severity, age, occurrence count), routes selected items to acknowledge workflow. User runs `acknowledge <fingerprint>` to set state=acknowledged. Why essential: humans must approve debt before it enters solve; gates the feedback loop.
- [ ] **Formal parameter linkage (v0.27-05)** — Debt schema includes `requirement_ids[]` (human-assigned during triage); `bin/link-debt-to-parameters.cjs` maps requirement IDs to formal model constants in `.formal/model-registry.json`. Enabled during `/qgsd:triage-debt` via dropdown (suggest requirements matching debt keywords). Why essential: solve can't generate targeted fixes without knowing which parameters to tune.
- [ ] **P→F residual layer in solve (v0.27-06)** — `bin/qgsd-solve.cjs` gains 8th residual: `P→F: production debt without formal fixes`. Scan `.formal/debt.json` for `state=acknowledged` items; for each, run requirement-to-property lookup; if property not yet in formal specs, flag as P→F gap. Why essential: closes the feedback loop; without this, acknowledged debt sits in a dashboard forever.

### Add After Validation (v1.x, Phase-Specific Research)

Features to add once core is working.

- [ ] **Config-driven source framework (v0.28+)** — Real Prometheus/Grafana/ELK integration. Requires phase-specific research into auth (OAuth), query APIs, metric schema normalization. Initial stubs prove architecture; real sources deferred.
- [ ] **Poisson binomial threshold breach detection (v0.28+)** — Integrates with PRISM; re-runs sensitivity sweep when debt parameters drift. HIGH complexity; deferred until debt ledger is stable and P→F residual is operational.
- [ ] **Cross-source root cause synthesis (v0.29+)** — Correlates Sentry anomalies with Prometheus CPU/memory spikes. NLP/rule-based correlation. Nice-to-have, enable better solve remediation targeting, deferred.
- [ ] **Debt archive & retention policy (v0.28+)** — Configurable retention, trim old debt, archive to `.formal/debt-archive.jsonl`. Operational feature; deferred until debt volume justifies it.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Streaming debt ingest (v2+)** — Real-time metrics from Prometheus without polling. Requires event bus, backpressure handling. Deferred; MVP uses polling + user-driven acknowledge.
- [ ] **AI-powered root cause attribution (v2+)** — LLM-based synthesis of cross-source anomalies. High token cost, uncertain ROI. Deferred until debt correlation patterns are mature.
- [ ] **Predictive threshold adjustment (v2+)** — Use PRISM + historical drift data to auto-suggest formal parameter changes. Deferred; requires substantial PRISM integration.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| Unified observe skill | HIGH | MEDIUM | P1 | Unblocks entire feedback loop; reuses triage infrastructure |
| Hierarchical fingerprinting | HIGH | MEDIUM | P1 | Deduplicates noise; enables triage at scale |
| Debt ledger schema | HIGH | LOW | P1 | Simple JSON; required for all downstream features |
| Human triage gate | HIGH | LOW | P1 | Already in place for triage; adapting for debt is straightforward |
| Formal parameter linkage | MEDIUM-HIGH | MEDIUM | P1 | Required for P→F residual; low complexity once debt schema exists |
| P→F residual layer | HIGH | MEDIUM | P1 | Closes the feedback loop; integrates debt into solve convergence |
| Config-driven source framework | MEDIUM | HIGH | P2 | Nice-to-have; real integrations deferred; stubs prove MVP works |
| Poisson binomial detection | MEDIUM | HIGH | P2 | Integrates production metrics with formal sensitivity; high complexity |
| Cross-source correlation | MEDIUM | HIGH | P2 | Improves solve targeting; deferred until debt ledger is stable |
| Streaming ingest | LOW | HIGH | P3 | Polling + on-demand acknowledge suffices; streaming adds complexity |

## Complexity Assessment

| Feature | Complexity | Why | Effort |
|---------|-----------|-----|--------|
| Unified observe skill | MEDIUM | Extends existing triage; pluggable abstraction is straightforward; parallel Task fanout proven | 1–2 phases |
| Fingerprinting engine | MEDIUM | Hierarchical hashing algorithm is well-defined; Sentry pattern is established; implementation is ~300 lines | 1 phase |
| Debt ledger schema | LOW | Simple JSON structure; atomicity already proven (current-activity.json); no novel data structures | 0.5 phase |
| Triage gate | LOW | UI is standard table + dropdown; requires no new algorithms; integrates with existing acknowledge workflow | 0.5 phase |
| Parameter linkage | MEDIUM | Requires JSON navigation + mapping; no novel algorithms; validation is straightforward | 0.5–1 phase |
| P→F residual | MEDIUM | Integrates with existing solve orchestration; same pattern as R→F/F→T residuals; no novel algorithms | 1–1.5 phases |
| Config-driven sources | MEDIUM-HIGH | HTTP client + auth (OAuth, API keys) for real sources; stubs can ship MVP; real implementations deferred | 2–3 phases (deferred) |
| Poisson binomial detection | HIGH | Requires PRISM integration + sensitivity sweep re-runs + parameter drift detection; algorithmic complexity | 2+ phases (deferred) |

**Total MVP effort:** 6–7 phases (one 1-phase module per feature, some can parallelize)

## Ecosystem Positioning

**Sentry (error tracking):** Fingerprinting by exception type → function → message; doesn't formally verify
**Grafana + Prometheus:** Metrics dashboards; doesn't formally verify
**Datadog:** Unified observability; doesn't formally verify
**TLA+/Alloy/PRISM:** Formal verification; no production integration

QGSD's differentiator: Bridges formal verification ↔ production gap with quorum-gated convergence loop.

## Sources

- [Sentry: Issue Grouping & Fingerprints](https://docs.sentry.io/concepts/data-management/event-grouping/)
- [Sentry: Fingerprint Rules (current docs)](https://docs.sentry.io/concepts/data-management/event-grouping/fingerprint-rules/)
- [Building Complete Monitoring Stack: Prometheus, Grafana, Sentry](https://medium.com/@virgilliayeala/building-a-complete-monitoring-stack-using-prometheus-grafana-and-sentry-d452bdbfd67b)
- [Observability in Event-Driven Architectures (Datadog)](https://www.datadoghq.com/architecture/observability-in-event-driven-architecture/)
- [Human-in-the-Loop Workflows in AIOps (2026)](https://dzone.com/articles/agentic-aiops-human-in-the-loop-workflows)
- [PRISM Probabilistic Model Checker (Oxford)](https://www.prismmodelchecker.org/)
- [Self-Admitted Technical Debt Detection (arXiv 2312.15020)](https://arxiv.org/html/2312.15020v3)
- [Top Technical Debt Management Tools (Zenhub 2025)](https://www.zenhub.com/blog-posts/the-top-technical-debt-management-tools-2025)

---

*Feature research for: Production Feedback Loop (v0.27)*
*Researched: 2026-03-04*
*Confidence: HIGH*
