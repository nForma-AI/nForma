# Architecture Research: v0.27 Production Feedback Loop

**Project:** QGSD — Quorum Gets Shit Done
**Domain:** Plugin architecture for multi-model quorum enforcement with production observability
**Researched:** 2026-03-04
**Milestone:** v0.27 (Production Feedback Loop)
**Confidence:** HIGH (extends existing proven patterns; integrates with well-documented v0.26 architecture)

---

## Executive Summary

v0.27 adds a three-layer production observability system to QGSD's existing formal verification and quorum infrastructure:

1. **Unified Observe Skill** — Replaces static triage sources with pluggable, parallel-fetching production sources (Sentry, Prometheus, Grafana, GitHub issues, Logstash, bash commands)
2. **Debt Ledger** — New `.formal/debt.json` artifact with fingerprint-based deduplication, occurrence aggregation, state transitions (open → acknowledged → resolving → resolved), and formal parameter linkage
3. **Solve P→F Residual Layer** — New production-to-formal comparison in `bin/qgsd-solve.cjs` that measures formal model thresholds against production reality, operating only on human-acknowledged debt

The architecture is **non-breaking**: all three layers integrate into existing QGSD workflows as optional opt-in features. The debt ledger schema mimics the existing `requirements.json` envelope pattern; solve adds a new residual layer without modifying the 7 existing R→F→T→C→F→R→D→C transitions.

---

## Current Architecture Context

### Existing System Layers

```
┌──────────────────────────────────────────────────────────────────┐
│                      QGSD Plugin Interface                        │
│  User: /qgsd:triage, /qgsd:solve, /qgsd:debug, /qgsd:quick      │
├──────────────────────────────────────────────────────────────────┤
│                    Skills & Orchestration Layer                   │
│  commands/qgsd/{triage,solve,debug,quick,close-formal-gaps}.md   │
├──────────────────────────────────────────────────────────────────┤
│                  Diagnostic & Remediation Scripts                 │
│  bin/qgsd-solve.cjs (7-layer residual)                           │
│  bin/formal-test-sync.cjs (F→T stub generation)                  │
│  bin/run-formal-verify.cjs (FV execution)                        │
│  bin/generate-traceability-matrix.cjs (model ↔ req links)        │
├──────────────────────────────────────────────────────────────────┤
│                   Configuration & State Artifacts                 │
│  .formal/requirements.json (frozen requirement envelope)         │
│  .formal/model-registry.json (spec metadata + versions)          │
│  .formal/policy.yaml (PRISM + per-slot behavior)                 │
│  .formal/check-results.ndjson (FV evidence)                      │
│  .planning/quorum-scoreboard.json (quorum telemetry)             │
│  .planning/triage-sources.md (YAML frontmatter config)           │
├──────────────────────────────────────────────────────────────────┤
│                      Hook Enforcement Layer                       │
│  hooks/qgsd-prompt.js (quorum inject)                            │
│  hooks/qgsd-stop.js (quorum gate)                                │
│  hooks/qgsd-circuit-breaker.js (oscillation detection)           │
└──────────────────────────────────────────────────────────────────┘
```

### Key Existing Patterns (Reused by v0.27)

| Pattern | Example | Reused By |
|---------|---------|-----------|
| **Frozen envelope artifact** | `.formal/requirements.json` with schema version + content hash | `.formal/debt.json` — same immutability model |
| **Metadata sidecar** | `.formal/model-registry.json` {version, last_updated, requirements[], description} | Debt entries carry metadata: {fingerprint, occurrences[], state, formal_params} |
| **Configuration frontmatter** | `.planning/triage-sources.md` with YAML block | Extend for production sources (Prometheus, Grafana endpoints) |
| **Bin script + Skill orchestration** | `bin/qgsd-solve.cjs` → `commands/qgsd/solve.md` | Observe script → Observe skill (same pattern) |
| **Parallel fetch + consolidation** | `/qgsd:triage` spawns parallel fetch agents | `/qgsd:observe` reuses exact same pattern |
| **Residual vector computation** | `qgsd-solve.cjs` computes 7-layer residual | Observe→Debt adds 8th: Production→Formal |
| **Skill dispatch loop** | `solve.md` iterates residuation + remediation | New `observe.md` skill integrated into solve loop |

---

## v0.27 Architecture: Three Integrated Layers

### Layer 1: Unified Observe Skill

**What it replaces:** Static `/qgsd:triage` (GitHub + Sentry only) → Dynamic `/qgsd:observe` (pluggable sources + real-time production signals)

**Architecture:**

```
┌──────────────────────────────────────────────────────────────────┐
│                    /qgsd:observe Skill                           │
│                  (commands/qgsd/observe.md)                      │
├──────────────────────────────────────────────────────────────────┤
│  Step 1: Parse .planning/triage-sources.md (extends to include  │
│          Prometheus, Grafana, Logstash endpoints + filters)      │
│                    ↓                                              │
│  Step 2: Parallel dispatch fetch agents (one per source)         │
│          ├─→ Agent(fetch-github) — existing /qgsd:triage logic  │
│          ├─→ Agent(fetch-sentry) — existing /qgsd:triage logic  │
│          ├─→ Agent(fetch-prometheus) — new, JSON + PromQL       │
│          ├─→ Agent(fetch-grafana) — new, dashboard query        │
│          ├─→ Agent(fetch-logstash) — new, Elasticsearch         │
│          └─→ Agent(fetch-bash) — existing /qgsd:triage logic    │
│                    ↓                                              │
│  Step 3: Consolidate results → deduplicate → standardize schema  │
│  {source, issue_id, title, severity, age, meta, formal_signal}  │
│                    ↓                                              │
│  Step 4: Fingerprint each issue (hierarchical):                  │
│          {source_type}#{issue_type}#{category}#{scope}          │
│                    ↓                                              │
│  Step 5: Merge with existing .formal/debt.json entries          │
│          (match by fingerprint, aggregate occurrence counts)      │
│                    ↓                                              │
│  Step 6: Render triage table + route to action                  │
│          ├─→ error/bug → /qgsd:debug                             │
│          ├─→ warning/info → /qgsd:quick                          │
│          └─→ formal_signal match → suggest /qgsd:solve P→F       │
└──────────────────────────────────────────────────────────────────┘
```

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `commands/qgsd/observe.md` | Skill: fetch + deduplicate production signals | Parallel agents, debt.json schema |
| `bin/observe.cjs` | Diagnostic: fetch sources, compute fingerprints | triage-sources.md (extended), debt.json |
| `bin/fingerprint-issue.cjs` | Utility: hierarchical fingerprinting engine | Issue schema, source metadata |
| `bin/merge-observations.cjs` | Utility: deduplicate + aggregate occurrences | debt.json schema, fingerprint matching |

**Data Flow:**

```
Production Sources (Sentry, Prometheus, GitHub, Grafana, Logstash)
    ↓ (parallel fetch via agents)
Consolidated Issues []{source, issue_id, title, severity, formal_signal}
    ↓ (compute fingerprints)
Fingerprinted Issues []{fingerprint, sources[], occurrences[], metadata}
    ↓ (merge with existing debt.json)
Updated .formal/debt.json (deduplicated, aggregated)
    ↓ (optional: route to triage/debug/solve)
User Action (acknowledge, schedule for solving, view details)
```

**Source Configuration Evolution:**

Current `.planning/triage-sources.md` YAML:
```yaml
sources:
  - type: github
    label: "GitHub Issues"
    filter: { state: open, labels: [bug], since: 7d }

  - type: sentry
    label: "Sentry Errors"
    filter: { status: unresolved, since: 24h }
```

**Extended v0.27 format:**
```yaml
sources:
  # Existing sources (unchanged)
  - type: github
    label: "GitHub Issues"
    filter: { state: open, labels: [bug], since: 7d }

  # New production sources
  - type: prometheus
    label: "Prometheus Metrics"
    endpoint: "http://prometheus:9090"
    queries:
      - {
          name: "error_rate",
          query: "rate(http_requests_total{status=~'5..'}[5m])",
          threshold: 0.05,
          formal_param: "ERROR_THRESHOLD"  # link to formal model
        }
      - {
          name: "latency_p99",
          query: "histogram_quantile(0.99, http_request_duration_seconds_bucket)",
          threshold: 500,
          formal_param: "LATENCY_THRESHOLD_MS"
        }
    filter: { since: 24h }

  - type: grafana
    label: "Grafana Dashboards"
    endpoint: "http://grafana:3000"
    api_key: "${GRAFANA_API_KEY}"
    dashboards: ["ops-health", "platform-performance"]
    alert_states: [firing]
    filter: { since: 6h }

  - type: logstash
    label: "Application Logs (Elasticsearch)"
    endpoint: "http://elasticsearch:9200"
    index_pattern: "logs-app-*"
    query_filter: "level:ERROR OR level:CRITICAL"
    group_by: "service.name"
    filter: { since: 2h }

  # Existing bash source for custom checks
  - type: bash
    label: "Health Checks"
    command: "bash ./bin/health-check.sh"
    parser: json
```

**Backward Compatibility:** ✅ New sources are opt-in; existing github/sentry/bash sources work unchanged.

---

### Layer 2: Debt Ledger (.formal/debt.json)

**What it is:** Immutable artifact like `requirements.json`, tracking production issues + metrics with state and formal parameter linkage.

**Schema:**

```json
{
  "schema_version": "1",
  "source": "v0.27-observe-skill",
  "aggregated_at": "2026-03-04T12:00:00.000Z",
  "content_hash": "sha256:abc123...",
  "frozen_at": "2026-03-04T12:00:00.000Z",
  "debt_entries": [
    {
      "id": "PROD-001",
      "fingerprint": "sentry#http_error#500#user_auth_service",
      "title": "User authentication service returns 500 errors",
      "category": "production_error",
      "state": "open",
      "first_observed": "2026-02-28T14:30:00Z",
      "last_observed": "2026-03-04T12:00:00Z",
      "occurrences": [
        {
          "source": "sentry",
          "source_id": "sentry-12345",
          "timestamp": "2026-03-04T12:00:00Z",
          "count": 47,
          "url": "https://sentry.io/issues/12345",
          "metadata": {
            "error_type": "InternalServerError",
            "stack_trace_root": "auth-service/validate.js:89",
            "affected_users": 23,
            "events": 47
          }
        }
      ],
      "formal_parameters": [
        {
          "parameter": "AUTH_ERROR_THRESHOLD",
          "formal_spec": ".formal/tla/QGSDQuorum.tla",
          "property": "AuthServiceHealthy",
          "current_threshold": 0.05,
          "observed_rate": 0.12,
          "divergence": 0.07,
          "recommendation": "Increase AUTH_ERROR_THRESHOLD to 0.15 or fix underlying issue"
        }
      ],
      "linked_issues": [
        {
          "source": "github",
          "id": "gh-456",
          "title": "Auth service intermittent failures"
        }
      ],
      "action_status": "acknowledged",
      "acknowledged_by": "jonathan",
      "acknowledged_at": "2026-03-04T10:30:00Z",
      "scheduling_note": "Schedule for P1 review in next quorum round",
      "formal_model_update_needed": true
    },
    {
      "id": "PROD-002",
      "fingerprint": "prometheus#latency#p99#api_gateway",
      "title": "API Gateway P99 latency exceeds threshold",
      "category": "production_metric_drift",
      "state": "open",
      "first_observed": "2026-03-03T08:00:00Z",
      "last_observed": "2026-03-04T11:45:00Z",
      "occurrences": [
        {
          "source": "prometheus",
          "source_id": "prometheus:latency_p99",
          "timestamp": "2026-03-04T11:45:00Z",
          "value": 850,
          "unit": "ms",
          "url": "http://prometheus:9090/graph?expr=histogram_quantile(...)",
          "metadata": {
            "threshold": 500,
            "percentile": 99,
            "observation_window": "5m"
          }
        }
      ],
      "formal_parameters": [
        {
          "parameter": "LATENCY_THRESHOLD_MS",
          "formal_spec": ".formal/prism/api-performance.pm",
          "property": "LatencyBoundSatisfied",
          "current_threshold": 500,
          "observed_value": 850,
          "divergence": 350,
          "recommendation": "Investigate root cause (infra scaling or code regression); update PRISM threshold if new SLA intended"
        }
      ],
      "linked_issues": [],
      "action_status": "open",
      "acknowledged_by": null,
      "formal_model_update_needed": false
    }
  ]
}
```

**Key Design Decisions:**

| Decision | Rationale |
|----------|-----------|
| **Immutable artifact like requirements.json** | Formal verification gate: no silent debt mutations; changes require user consent |
| **Fingerprinting over IDs** | Deduplicates cross-source duplicates (same error reported by both Sentry and Prometheus) |
| **occurrence[] array** | Tracks when an issue appears across sources; allows "first seen" vs "recently observed" distinction |
| **state transitions** | open → acknowledged → resolving → resolved; only acknowledged debt enters solve loop |
| **formal_parameters[]** | Bridges production reality to formal thresholds; solver uses this for P→F residual computation |
| **linked_issues[]** | Cross-references between Sentry, GitHub, Prometheus (all describe same root cause) |
| **observation_window** | Timestamps + windows allow "this is stale" detection; metrics drift detection |

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `.formal/debt.json` | Immutable debt ledger (artifact) | Schema + content hash validation |
| `.formal/debt.schema.json` | JSON Schema for debt.json | standard JSON Schema v7 |
| `bin/validate-debt-ledger.cjs` | Pre-commit hook: syntax + schema validation | debt.schema.json, fs |
| `bin/update-debt-ledger.cjs` | Merges observations into debt.json | fingerprint matching, atomic replace |

**Integration with Existing Patterns:**

- **Like requirements.json:** Frozen envelope, schema-versioned, content-hashed
- **Like model-registry.json:** Per-entry metadata (first_observed, last_observed, versions)
- **Like check-results.ndjson:** Linked to formal verification (formal_parameters field)
- **Unlike check-results.ndjson:** Mutable (transitions through states) but immutable between observations (atomic replace like requirements.json)

**Backward Compat:** ✅ Entirely new artifact; existing workflows unaffected.

---

### Layer 3: Solve P→F Residual Layer

**What it adds:** An 8th layer transition to `bin/qgsd-solve.cjs`'s existing 7-layer residual computation.

**Current solve.cjs residual vector:**
```
R→F: Requirements without formal specs
F→T: Formal specs without test backing
C→F: Code constants vs formal specs
T→C: Failing tests
F→C: Failing formal verification
R→D: Requirements not in developer docs
D→C: Docs with broken claims
```

**New v0.27 addition:**
```
P→F: Production metrics/errors diverging from formal thresholds
     (computed ONLY from human-acknowledged debt entries)
```

**Architecture:**

```
bin/qgsd-solve.cjs (existing)
├─ Step 1: Load .formal/requirements.json
├─ Step 2: Load .formal/model-registry.json
├─ Step 3: Sweep 7 layers (R→F, F→T, C→F, T→C, F→C, R→D, D→C)
├─ Step 4: Compute residual vector [7 numbers]
└─ Step 5: Output residual_vector + detail

bin/qgsd-solve.cjs (v0.27 enhanced)
├─ Step 1-5: [unchanged]
├─ Step 6: Load .formal/debt.json (NEW)
├─ Step 7: Filter to acknowledged entries (state: acknowledged) (NEW)
├─ Step 8: For each formal_parameter in acknowledged entries:
│          Compute divergence = observed_value - current_threshold
│          Aggregate divergence count across all parameters (NEW)
├─ Step 9: Add P→F layer to residual_vector (NEW)
│          residual_vector.p_to_f = { divergence_count, detail }
└─ Step 10: Output residual_vector [8 numbers] (CHANGED)

Output JSON:
{
  "residual_vector": {
    "r_to_f": { "residual": N, "detail": {...} },
    "f_to_t": { "residual": N, "detail": {...} },
    "c_to_f": { "residual": N, "detail": {...} },
    "t_to_c": { "residual": N, "detail": {...} },
    "f_to_c": { "residual": N, "detail": {...} },
    "r_to_d": { "residual": N, "detail": {...} },
    "d_to_c": { "residual": N, "detail": {...} },
    "p_to_f": { "residual": N, "detail": {...} },  // NEW
    "total": N  // includes P→F
  }
}
```

**P→F Detail Structure:**

```json
{
  "p_to_f": {
    "residual": 3,
    "detail": {
      "acknowledged_debt_entries": 5,
      "entries_with_formal_divergence": 3,
      "divergences": [
        {
          "debt_id": "PROD-001",
          "parameter": "AUTH_ERROR_THRESHOLD",
          "formal_spec": ".formal/tla/QGSDQuorum.tla",
          "property": "AuthServiceHealthy",
          "current_threshold": 0.05,
          "observed_value": 0.12,
          "divergence": 0.07
        },
        {
          "debt_id": "PROD-002",
          "parameter": "LATENCY_THRESHOLD_MS",
          "formal_spec": ".formal/prism/api-performance.pm",
          "property": "LatencyBoundSatisfied",
          "current_threshold": 500,
          "observed_value": 850,
          "divergence": 350
        }
      ],
      "remediation_suggestions": [
        "Update LATENCY_THRESHOLD_MS in formal specs to reflect new SLA",
        "Fix AUTH_ERROR_THRESHOLD enforcement or root cause in auth service"
      ]
    }
  }
}
```

**New Components:**

| File | Purpose | Depends On |
|------|---------|-----------|
| `bin/qgsd-solve.cjs` (extended) | Add Step 6-10 for P→F computation | debt.json, formal specs with @threshold annotations |
| `bin/extract-formal-thresholds.cjs` | Parse @threshold annotations from specs | TLA+/PRISM/Alloy files, regex/AST |

**Integration with solve.md skill:**

Current `commands/qgsd/solve.md` Step 3 dispatch order:
```
3a. R→F gaps → /qgsd:close-formal-gaps
3b. F→T gaps → formal-test-sync → /qgsd:quick batches
3c. T→C gaps → /qgsd:fix-tests
3d. C→F gaps → /qgsd:quick
3e. F→C gaps → /qgsd:quick (for fixable failures)
3f. R→D gaps → [manual review, no skill]
3g. D→C gaps → [manual review, no skill]
```

**v0.27 Addition to solve.md:**
```
3h. P→F gaps → [NEW]
    If p_to_f.residual > 0:
    - Check each divergence
    - If root cause is known (code/infra fix):
      Dispatch /qgsd:quick to patch code or docs
    - If root cause is unknown:
      Dispatch /qgsd:debug with divergence analysis + links to production sources
    - Optionally dispatch /qgsd:quick to update formal specs (threshold adjustment)
      (marked as intentional divergence if SLA changed)
```

**Backward Compat:** ✅ P→F layer is optional (computed only if debt.json exists); existing solve loop unaffected.

---

## Data Flow Integration

### Observe → Debt → Solve Pipeline

```
1. /qgsd:observe Skill (commands/qgsd/observe.md)
   ├─ Reads .planning/triage-sources.md (extended config)
   ├─ Spawns parallel fetch agents (GitHub, Sentry, Prometheus, Grafana, Logstash)
   └─ Consolidates results → []{source, issue_id, title, severity, formal_signal}
                                   ↓
2. bin/observe.cjs Diagnostic
   ├─ Computes fingerprints (hierarchical: source#type#category#scope)
   ├─ Merges with existing .formal/debt.json
   ├─ Aggregates occurrences (same fingerprint from multiple sources = one entry)
   └─ Atomic replace .formal/debt.json
                                   ↓
3. User Actions in /qgsd:observe triage table
   ├─ View issue details
   ├─ Acknowledge issue (state: open → acknowledged)
   ├─ Schedule for solving (scheduling_note field)
   └─ Route to /qgsd:debug, /qgsd:quick, or /qgsd:solve
                                   ↓
4. /qgsd:solve Skill (commands/qgsd/solve.md)
   ├─ Step 1-5: Compute 7-layer residual (existing)
   ├─ Step 6-9: Load debt.json, compute P→F residual (NEW)
   ├─ Step 3h: Dispatch remediation for P→F gaps
   │           ├─ Code/infra fixes → /qgsd:quick
   │           ├─ Unknown root cause → /qgsd:debug
   │           └─ Threshold updates → /qgsd:quick (mark as intentional)
   └─ Step 4-6: Re-diagnose & report before/after
```

### Formal Integration Points

**Where production data enters formal specs:**

1. **Observation capture:**
   - Prometheus queries include `formal_param` field (links to spec)
   - Each metric/error occurrence has `formal_parameters[]` populated by observe skill
   - Sentry errors auto-matched to formal parameters via fingerprint heuristics

2. **Threshold linking:**
   - Formal specs (.tla/.pm/.als) carry `@threshold` annotations
   - `extract-formal-thresholds.cjs` parses these
   - `update-debt-ledger.cjs` matches formal_parameters[] to @threshold entries

3. **Residual computation:**
   - P→F gap = acknowledged debt with divergence > tolerance
   - Tolerance is the "threshold" from the spec
   - Residual count = # of acknowledged entries exceeding their thresholds

4. **Remediation dispatch:**
   - P→F gaps surface in solve.md Step 3h
   - Dispatch routes to fix code, infra, or formal specs
   - Success = P→F residual → 0 (either fix production or update threshold)

---

## File Organization

### Existing Structure (Pre-v0.27)

```
QGSD/
├── bin/
│   ├── qgsd-solve.cjs                    # 7-layer residual solver
│   ├── run-formal-verify.cjs             # FV execution
│   ├── formal-test-sync.cjs              # F→T stub generation
│   ├── generate-traceability-matrix.cjs  # req ↔ model links
│   └── ...
├── commands/qgsd/
│   ├── solve.md                          # /qgsd:solve orchestrator skill
│   ├── triage.md                         # /qgsd:triage → issue sources
│   ├── debug.md                          # /qgsd:debug → hypothesis space
│   └── ...
├── hooks/
│   ├── qgsd-prompt.js                    # UserPromptSubmit: quorum inject
│   ├── qgsd-stop.js                      # Stop: quorum gate
│   └── qgsd-circuit-breaker.js           # PreToolUse: oscillation
├── .formal/
│   ├── requirements.json                 # frozen requirement envelope
│   ├── model-registry.json               # spec metadata
│   ├── policy.yaml                       # PRISM config + governance
│   ├── check-results.ndjson              # FV evidence
│   ├── requirements.schema.json          # schema for requirements.json
│   └── ...
├── .planning/
│   ├── triage-sources.md                 # source config (YAML frontmatter)
│   ├── quorum-scoreboard.json            # quorum telemetry
│   └── ...
└── docs/
    └── triage-sources.example.md         # example config
```

### New v0.27 Structure

```
QGSD/
├── bin/
│   ├── qgsd-solve.cjs                    # [MODIFIED] add P→F layer
│   ├── observe.cjs                       # [NEW] fetch + deduplicate sources
│   ├── fingerprint-issue.cjs             # [NEW] hierarchical fingerprinting
│   ├── merge-observations.cjs            # [NEW] deduplicate + aggregate
│   ├── extract-formal-thresholds.cjs     # [NEW] parse @threshold annotations
│   ├── update-debt-ledger.cjs            # [NEW] merge observations into debt.json
│   ├── validate-debt-ledger.cjs          # [NEW] schema validation
│   └── ...
├── commands/qgsd/
│   ├── observe.md                        # [NEW] /qgsd:observe skill
│   ├── solve.md                          # [MODIFIED] add Step 3h (P→F)
│   ├── triage.md                         # [UNCHANGED] for backward compat
│   └── ...
├── .formal/
│   ├── debt.json                         # [NEW] production issue ledger
│   ├── debt.schema.json                  # [NEW] schema for debt.json
│   ├── requirements.json                 # [UNCHANGED]
│   ├── model-registry.json               # [UNCHANGED]
│   ├── policy.yaml                       # [UNCHANGED]
│   └── ...
├── .planning/
│   ├── triage-sources.md                 # [EXTENDED] add production sources
│   │   # Old: github, sentry, bash
│   │   # New: prometheus, grafana, logstash
│   ├── quorum-scoreboard.json            # [UNCHANGED]
│   └── ...
├── docs/
│   ├── triage-sources.example.md         # [EXTENDED] show new source types
│   ├── debt-ledger-guide.md              # [NEW] explain debt lifecycle
│   └── ...
└── hooks/
    ├── qgsd-prompt.js                    # [UNCHANGED]
    ├── qgsd-stop.js                      # [UNCHANGED]
    └── qgsd-circuit-breaker.js           # [UNCHANGED]
```

### New Files Added

| File | Purpose | Type |
|------|---------|------|
| `bin/observe.cjs` | Fetch + deduplicate production sources | Script (20–30 lines per source type handler) |
| `bin/fingerprint-issue.cjs` | Compute hierarchical fingerprints | Script (utility, reusable) |
| `bin/merge-observations.cjs` | Merge new observations into debt.json | Script (atomic file replace) |
| `bin/extract-formal-thresholds.cjs` | Parse @threshold annotations from specs | Script (regex-based or AST) |
| `bin/update-debt-ledger.cjs` | Orchestrate observe + merge + validation | Script (CLI wrapper) |
| `bin/validate-debt-ledger.cjs` | Schema validation + pre-commit hook | Script (validation only) |
| `commands/qgsd/observe.md` | Skill: fetch sources, triage, route | Skill (.md with YAML front) |
| `.formal/debt.json` | Production issue ledger (artifact) | JSON (immutable envelope) |
| `.formal/debt.schema.json` | JSON Schema for debt.json | Schema (v7) |
| `docs/debt-ledger-guide.md` | User guide: debt lifecycle + formal linking | Doc (guide) |

---

## Architectural Patterns

### Pattern 1: Fingerprint-Based Deduplication

**What:** Hierarchical fingerprints (source#type#category#scope) allow merging cross-source duplicates without brittle ID matching.

**When to use:** When the same issue/metric appears in multiple monitoring systems.

**Trade-offs:**
- ✅ Deduplicates Sentry errors + Prometheus alerts for same root cause
- ✅ Configurable via fingerprint function (could be ML later)
- ❌ Misconfigurations create false positives/negatives (separate entries for same issue)

**Example:**
```javascript
// fingerprint-issue.cjs
function computeFingerprint(issue, source) {
  const sourceType = source.type;           // 'sentry', 'prometheus', etc.
  const issueType = issue.category;         // 'error', 'metric_drift', 'alert'
  const category = issue.service || 'general';
  const scope = issue.operation || 'unscoped';

  return `${sourceType}#${issueType}#${category}#${scope}`;
  // Result: "sentry#error#auth#validate" or "prometheus#latency#api#gateway"
}

// Sentry error:
// {source: 'sentry', category: 'error', service: 'auth', operation: 'validate', title: '...'}
// → fingerprint: "sentry#error#auth#validate"

// Prometheus alert for same root cause:
// {source: 'prometheus', category: 'error_rate', service: 'auth', operation: 'validate', ...}
// → fingerprint: "prometheus#error_rate#auth#validate"
//
// These won't auto-deduplicate (different issueType) unless custom config allows it.
```

**Config Extension:**
```yaml
fingerprinting:
  # Group Prometheus error_rate with Sentry errors for auth service
  equivalences:
    - { fingerprints: ['sentry#error#auth#*', 'prometheus#error_rate#auth#*'],
        deduplicate_as: 'auth#validate_errors' }
```

### Pattern 2: State Machine Transitions for Debt Entries

**What:** Debt entries progress through states (open → acknowledged → resolving → resolved) controlled by user actions and solve completion.

**When to use:** When you need auditability of when/why debt was addressed.

**Trade-offs:**
- ✅ Clear audit trail: who acknowledged, when, why
- ✅ Prevents accidental solve on unreviewed production issues
- ❌ Extra ceremony (4 states); simpler systems use 2 (open/resolved)

**State Diagram:**
```
┌──────────┐
│   open   │ ← New observation merged from sources
└─────┬────┘
      │ User: acknowledge()
      ↓
┌──────────────┐
│ acknowledged │ ← Can now enter /qgsd:solve P→F layer
└─────┬────────┘
      │ solve.md 3h: dispatch /qgsd:quick or /qgsd:debug
      ↓
┌──────────┐
│ resolving│ ← Remediation in progress (optional; auto-set by solve)
└─────┬────┘
      │ /qgsd:solve converges P→F residual to 0
      ↓
┌──────────┐
│ resolved │ ← Final state, no further solve action
└──────────┘
```

### Pattern 3: Formal Parameter Linkage

**What:** Production metrics/errors carry references to formal model parameters (thresholds, invariants). This creates an observable bridge between production reality and formal specs.

**When to use:** When you want formal verification to react to production signals.

**Trade-offs:**
- ✅ Solve can auto-detect spec violations from prod data
- ✅ Grounds formal models in real-world constraints
- ❌ Requires annotating formal specs with @threshold/@metric markers

**Example:**
```
Production observation:
  PROD-002: "API Gateway P99 latency = 850ms"

Formal parameter linkage:
  {
    parameter: "LATENCY_THRESHOLD_MS",
    formal_spec: ".formal/prism/api-performance.pm",
    property: "LatencyBoundSatisfied",
    current_threshold: 500,
    observed_value: 850,
    divergence: 350
  }

Formal spec annotation:
  // api-performance.pm
  const LATENCY_THRESHOLD_MS = 500;  // @threshold metric=latency_p99 tolerance=10ms
```

---

## Integration Boundaries

### Boundary 1: Observe Skill ↔ Debt Ledger

**Communication:** One-way write
- Observe skill reads debt.json (existing entries for dedup)
- Observe skill writes updated debt.json (new + merged entries)
- No feedback from debt.json to observe skill

**Consistency:** Atomic file replace (like requirements.json)
- Multiple concurrent observe runs: file-level locking via atomic rename
- Pre-validation: schema check before atomic replace

### Boundary 2: Debt Ledger ↔ Solve

**Communication:** One-way read
- Solve reads debt.json (acknowledged entries only)
- Solve computes P→F residual
- Solve does NOT mutate debt.json (state transitions are manual or via /qgsd:observe)

**Consistency:** No writes from solve
- Solve uses debt.json for P→F diagnostics only
- User (or future automation) changes state via /qgsd:observe "acknowledge" action

### Boundary 3: Solve ↔ Remediation Skills (/qgsd:quick, /qgsd:debug)

**Communication:** Skill dispatch (existing pattern)
- Solve.md Step 3h: dispatches /qgsd:quick or /qgsd:debug
- Remediation skills do NOT directly mutate debt.json
- After remediation: user re-runs /qgsd:observe to fetch fresh data, then /qgsd:solve to recompute

**Rationale:** Keeps solve as a diagnostic/orchestrator, not a mutator.

### Boundary 4: Config (.planning/triage-sources.md) ↔ Observe

**Communication:** One-way read
- Observe script reads triage-sources.md at startup
- Config changes take effect immediately (no caching)
- New sources can be added/removed without restarting Claude Code

**Configuration Format:** YAML frontmatter (existing pattern from /qgsd:triage)
```yaml
---
sources:
  - type: prometheus
    label: "..."
    endpoint: "..."
---
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–10 acknowledged debt entries** | Observe + solve run in < 5s; no optimization needed |
| **10–100 entries** | Consider lazy-loading formal parameter extraction; fingerprint computation stays O(n) |
| **100–1000 entries** | Index fingerprints by prefix (source#type#category) for O(1) dedup lookup |
| **1000+ entries** | Split debt.json by source type or age; observe becomes multi-file merge |

**First Bottleneck:** Formal threshold extraction
- Current: `extract-formal-thresholds.cjs` parses all specs each time
- Fix: Cache @threshold annotations in model-registry.json (already versioned)

**Second Bottleneck:** Fingerprint computation
- Current: O(n) per new observation
- Fix: Parallel fingerprinting in observe agents (already parallel source fetches)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Silent Debt Mutation

**What people do:** Solve.md silently closes P→F gaps by updating formal specs, without user acknowledgment of the production issue.

**Why it's wrong:** Formal specs become misaligned with production reality; later formal checks fail unexpectedly.

**Do this instead:** Require user to explicitly acknowledge debt entry in /qgsd:observe before solve dispatches remediation.

### Anti-Pattern 2: Unbounded Fingerprint Collisions

**What people do:** Use overly broad fingerprints (source#type only) → 100 distinct production issues collapse into 1 debt entry.

**Why it's wrong:** User can't distinguish which specific error needs fixing; solve gets one giant P→F gap instead of 5 discrete ones.

**Do this instead:** Use hierarchical fingerprints (source#type#category#scope) and make scope configurable per source type.

### Anti-Pattern 3: Formal Specs Without @threshold Annotations

**What people do:** Add formal thresholds (const THRESHOLD = X) but no metadata linking them to production metrics.

**Why it's wrong:** Observe skill can't auto-populate formal_parameters[] → P→F residual computation is manual/incomplete.

**Do this instead:** Annotate every threshold constant with @threshold (or @metric) comments; extract-formal-thresholds.cjs parses these.

### Anti-Pattern 4: Observe Without Deduplication

**What people do:** Every source fetch creates a new debt entry, no fingerprinting.

**Why it's wrong:** Same error from Sentry + Prometheus + GitHub = 3 debt entries instead of 1 aggregated entry; debt ledger bloats, user confusion.

**Do this instead:** Always fingerprint before merging; use merge-observations.cjs to deduplicate.

### Anti-Pattern 5: Solve Mutating Debt State

**What people do:** After fixing a P→F gap, solve.md automatically sets debt entry state to "resolved".

**Why it's wrong:** User didn't review/acknowledge the fix; spec is now inconsistent with production and formal model.

**Do this instead:** Solve dispatches remediation but does NOT change debt state. User reviews fix, then manually transitions state in /qgsd:observe or it auto-transitions after production signals confirm resolution.

---

## Build Order & Dependencies

### Phase 1: Foundation (Week 1)

**Deliverables:** debt.json schema, validation, basic observe infrastructure

| Task | Depends On | Outputs |
|------|-----------|---------|
| Create `.formal/debt.schema.json` | Nothing | Schema file |
| Create `bin/fingerprint-issue.cjs` | Nothing | Utility script |
| Create `bin/validate-debt-ledger.cjs` | debt.schema.json | Validation script |
| Seed `.formal/debt.json` (empty) | schema | Artifact |

**Rationale:** Foundation first — schema validation prevents corruption before any skill runs.

### Phase 2: Observe Infrastructure (Week 1–2)

**Deliverables:** Parallel fetch, deduplication, config parsing

| Task | Depends On | Outputs |
|------|-----------|---------|
| Extend `.planning/triage-sources.md` template | Nothing | Config example |
| Create `bin/observe.cjs` (skeleton) | triage-sources.md | Script (GitHub, Sentry, bash agents) |
| Create `bin/merge-observations.cjs` | fingerprint-issue.cjs, debt.schema.json | Merge script |
| Create `bin/update-debt-ledger.cjs` | observe.cjs, merge-observations.cjs, validate-debt-ledger.cjs | Orchestrator |
| Create `commands/qgsd/observe.md` skill | update-debt-ledger.cjs | Skill |

**Rationale:** Observe agents built incrementally (GitHub/Sentry first, Prometheus/Grafana later).

### Phase 3: Formal Integration (Week 2–3)

**Deliverables:** Threshold annotation parsing, P→F residual computation

| Task | Depends On | Outputs |
|------|-----------|---------|
| Annotate formal specs with @threshold | Nothing | Updated .tla/.pm/.als files |
| Create `bin/extract-formal-thresholds.cjs` | Annotated specs | Threshold extraction script |
| Extend `bin/qgsd-solve.cjs` (P→F layer) | extract-formal-thresholds.cjs, debt.json | Updated solver |
| Update `commands/qgsd/solve.md` (Step 3h) | Extended solve.cjs | Updated skill |

**Rationale:** Formal integration depends on specs being annotated; solve.md changes depend on solve.cjs working.

### Phase 4: Testing & Documentation (Week 3–4)

**Deliverables:** Test suites, user guides, integration tests

| Task | Depends On | Outputs |
|------|-----------|---------|
| Create test suites (fingerprint, dedup, observe agents) | Phase 1–3 components | .test.cjs files |
| Create `docs/debt-ledger-guide.md` | debt.json schema, observe.md, solve.md | User guide |
| Integration test: /qgsd:observe → /qgsd:solve → /qgsd:quick | Phase 1–3 | Test script |
| Add Prometheus/Grafana/Logstash agent types to observe.cjs | Phase 2 base | Extended observe |

**Rationale:** Testing and docs last (less rework); agent types are Phase 2.5 (optional for MVP).

---

## Backward Compatibility

### ✅ Fully Backward Compatible

| Existing Feature | v0.27 Impact | Notes |
|------------------|-------------|-------|
| `/qgsd:triage` | Unchanged | Still works; new `/qgsd:observe` is parallel |
| `/qgsd:solve` (7-layer) | Extended, not broken | 8th layer (P→F) is additive; backward compat via feature flag if debt.json missing |
| `.formal/requirements.json` | Unchanged | Reads alongside new debt.json |
| `.formal/model-registry.json` | Unchanged | May reference debt entries later, but no mutations |
| `.planning/triage-sources.md` | Extended | New source types opt-in; old GitHub/Sentry untouched |
| `bin/qgsd-solve.cjs` | Backward compat gate | If debt.json missing, P→F layer outputs { residual: 0, detail: {...} } |

### Deployment Strategy

1. **PR 1:** Add debt.json schema + validation (no impact on existing code)
2. **PR 2:** Add observe infrastructure (new skill, doesn't touch solve.md)
3. **PR 3:** Extend solve.cjs with P→F layer (has backward compat gate for missing debt.json)
4. **PR 4:** Update solve.md Step 3h (dispatches P→F remediation; existing steps unchanged)

All PRs can land independently; no breaking changes to existing workflows.

---

## Key Integration Files

### Modified Files

| File | Changes | Lines | Risk |
|------|---------|-------|------|
| `bin/qgsd-solve.cjs` | Add Step 6–10 (P→F computation) | +80–120 | LOW (guarded by debt.json existence check) |
| `commands/qgsd/solve.md` | Add Step 3h (P→F dispatch) | +60–80 | LOW (new step, doesn't affect 3a–g) |
| `.planning/triage-sources.md` | Add prometheus, grafana, logstash sections | +50–80 | LOW (new sections, old sections unchanged) |

### New Files

| File | Purpose | Lines | Complexity |
|------|---------|-------|------------|
| `bin/observe.cjs` | Main orchestrator | 200–300 | Medium (parallel agents) |
| `bin/fingerprint-issue.cjs` | Fingerprint computation | 80–120 | Low |
| `bin/merge-observations.cjs` | Merge + deduplicate | 150–200 | Medium |
| `bin/extract-formal-thresholds.cjs` | Parse @threshold annotations | 120–180 | Medium (regex or AST) |
| `bin/update-debt-ledger.cjs` | Orchestrate observe + merge + validate | 100–150 | Low |
| `bin/validate-debt-ledger.cjs` | Schema validation | 50–80 | Low |
| `commands/qgsd/observe.md` | Skill | 150–250 | Medium (like triage.md structure) |
| `.formal/debt.json` | Artifact | 50–100 (initial) | N/A |
| `.formal/debt.schema.json` | Schema | 200–300 | N/A |

**Total new code:** ~1500–2200 lines (similar scale to v0.25 traceability feature).

---

## Sources

**Existing Architecture:** QGSD codebase (`.planning/PROJECT.md`, v0.26 shipped implementation)

**Pattern References:**
- `requirements.json` schema → debt.json design pattern
- `model-registry.json` metadata → debt entry metadata structure
- `/qgsd:triage` parallel agents → `/qgsd:observe` reuses exact pattern
- `bin/qgsd-solve.cjs` 7-layer residual → 8-layer extension pattern

**Production Integration Patterns:**
- Sentry MCP integration (existing in `/qgsd:triage`)
- GitHub API integration (existing in `/qgsd:triage`)
- Prometheus/Grafana APIs (standard OAuth + bearer token auth)
- Elasticsearch/Logstash APIs (standard HTTP + query DSL)

---

## Summary: Integration Checklist

- [ ] `debt.schema.json` created, reviewed, versioned
- [ ] `bin/fingerprint-issue.cjs` passes unit tests
- [ ] `bin/validate-debt-ledger.cjs` validates schema + catches test cases
- [ ] `bin/observe.cjs` runs GitHub + Sentry agents, consolidates output
- [ ] `bin/merge-observations.cjs` deduplicates by fingerprint, passes test cases
- [ ] `bin/extract-formal-thresholds.cjs` parses @threshold annotations from specs
- [ ] `bin/qgsd-solve.cjs` extended: P→F layer computes correctly, backward compat gate works
- [ ] `commands/qgsd/observe.md` skill tested end-to-end
- [ ] `commands/qgsd/solve.md` Step 3h tested with debt entries
- [ ] `/qgsd:observe` → acknowledge → `/qgsd:solve` → /qgsd:quick full flow works
- [ ] Backward compat verified: existing /qgsd:triage and /qgsd:solve unchanged
- [ ] Documentation: debt-ledger-guide.md + triage-sources.example.md extended

---

*Architecture research for v0.27 Production Feedback Loop*
*Researched: 2026-03-04*
