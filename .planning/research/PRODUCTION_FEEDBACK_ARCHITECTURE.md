# Architecture Patterns: v0.27 Production Feedback Loop

**Domain:** Production observability integration with formal verification feedback

**Researched:** 2026-03-04

## System Architecture

### High-Level Data Flow

```
Production Systems                  QGSD Processing                    Formal Models
──────────────────                  ──────────────────                  ──────────────

Prometheus (metrics)  ──┐
Sentry (errors)       ──┤──> Observe Skill ─────> Fingerprinting ────> Debt Ledger
Elasticsearch (logs)  ──┤        (parallel)         Engine              (deduplicated)
Grafana (dashboards)  ──┘        (error recovery)   (hierarchical)      (aggregated)
GitHub (issues)
Bash script output

                                                                         ↓
                                                         Solve Convergence Loop
                                                         ──────────────────────
                                                         Layer 1: R→F (requirements)
                                                         Layer 2: F→T (formal→test)
                                                         Layer 3: T→C (test→code)
                                                         Layer 4: C→F (code→formal)
                                                         Layer 5: R→D (requirements→docs)
                                                         Layer 6: D→C (docs→claims)
                                                         Layer 7: (existing layers)
                                                         Layer 8: P→F (PRODUCTION→FORMAL)
                                                         ↓
                                                         Remediation Tasks
                                                         (only if acknowledged)
```

### Component Boundaries

| Component | Responsibility | Inputs | Outputs | Error Handling |
|-----------|---------------|--------|---------|-----------------|
| **Observe Skill** | Fetch metrics/issues from production sources in parallel | Pluggable config (Prometheus URL, ES endpoint, Sentry token, etc.) | `.planning/observe-raw.jsonl` (one JSON per line: {source, type, value, threshold, severity, ...}) | Per-source error recovery; one source failure doesn't block others; log errors to stderr, continue |
| **Fingerprinting Engine** | Group issues by exception_type + function, then fuzzy-match by message | `.planning/observe-raw.jsonl` | `.planning/observe-fingerprinted.jsonl` (adds fingerprint hash + layers) | Collision handling: if Levenshtein fails, store full message for manual review |
| **Deduplication Engine** | Merge identical issues by primary_hash + Levenshtein bucket | `.planning/observe-fingerprinted.jsonl` | `.formal/debt-raw.json` (array of {fingerprint, occurrences, first_seen, last_seen, issues[]}) | Levenshtein threshold configurable (default 0.85); clusters stored with each member |
| **Debt Ledger** | Maintain immutable log of issues, state transitions, remediation | `.formal/debt-raw.json` + user input | `.formal/debt.json` (immutable, version-controlled) | Schema validation (ajv); prevents invalid state transitions |
| **State Machine** | Enforce debt lifecycle (open → acknowledged → resolving → resolved) | `.formal/debt.json` + user acknowledge/mark-resolving/mark-resolved | Updated `.formal/debt.json` | Atomic writes; each state transition requires supporting data (e.g., plan_id for resolving) |
| **P→F Integration** | Compare formal thresholds against production measurements; generate remediation | Formal parameters (PRISM values, policy.yaml) + acknowledged debt + production measurements | New remediation tasks in solve status | Only processes acknowledged items; skips unknown formal parameters |

### Data Structures

#### Observe Output (`.planning/observe-raw.jsonl`)

```json
{
  "source": "prometheus",
  "type": "latency_drift",
  "metric": "http_request_duration_seconds",
  "value": 0.75,
  "threshold": 0.5,
  "severity": "high",
  "timestamp": "2026-03-04T12:34:56Z",
  "tags": ["endpoint:/api/v1", "method:POST"],
  "raw_issue": {
    "query_time_ms": 234,
    "data_source": "prometheus.example.com:9090"
  }
}
```

#### Fingerprinted Issue

```json
{
  "source": "sentry",
  "exception_type": "NullPointerException",
  "function_name": "processPayment",
  "message": "Cannot read property 'amount' of null at processPayment (src/handlers.js:234:15)",
  "message_normalized": "Cannot read property NUM of null at processPayment (src/handlers.js:NUM:NUM)",
  "fingerprint": {
    "primary_hash": "abc123def456...",
    "layers": ["NullPointerException", "processPayment"],
    "normalized_message": "Cannot read property NUM of null at processPayment (src/handlers.js:NUM:NUM)"
  },
  "timestamp": "2026-03-04T12:34:56Z",
  "severity": "high"
}
```

#### Deduplicated Debt Entry (`.formal/debt.json`)

```json
{
  "id": "DEBT-001",
  "fingerprint": "abc123def456...",
  "type": "error",
  "exception_type": "NullPointerException",
  "function": "processPayment",
  "message_pattern": "Cannot read property * of null at processPayment",
  "occurrences": {
    "total": 127,
    "first_seen": "2026-02-28T08:00:00Z",
    "last_seen": "2026-03-04T12:34:56Z",
    "by_hour": [
      {"timestamp": "2026-03-04T12:00:00Z", "count": 5},
      {"timestamp": "2026-03-04T11:00:00Z", "count": 3}
    ]
  },
  "state": "acknowledged",
  "acknowledged_by": "jonathan@example.com",
  "acknowledged_at": "2026-03-04T10:00:00Z",
  "resolving_plan_id": "v0.27-03",
  "formal_parameters": [
    {
      "model": "QGSDSolve.tla",
      "parameter": "MAX_ERROR_RATE",
      "threshold": 0.01,
      "actual": 0.035,
      "breach": true
    }
  ],
  "severity": "critical",
  "tags": ["payment", "user-facing"],
  "cluster_members": [
    "Cannot read property 'amount' of null",
    "Cannot read property 'userId' of null",
    "Cannot read property 'timestamp' of null"
  ]
}
```

#### P→F Integration Task (added to solve status)

```json
{
  "layer": "P→F",
  "type": "production_formal_breach",
  "status": "open",
  "debt_id": "DEBT-001",
  "formal_parameter": "QGSDSolve.MAX_ERROR_RATE",
  "threshold": 0.01,
  "actual_value": 0.035,
  "remediation": "Reduce error rate from 3.5% to <1%; acknowledged debt DEBT-001 (NullPointerException in processPayment); suggested fix: add null checks in payment handler",
  "severity": "critical",
  "task_id": "P-F-DEBT-001"
}
```

## Patterns to Follow

### Pattern 1: Pluggable Observation Sources

**What:** Each production data source (Prometheus, Sentry, ES, Grafana, bash) is a subclass of `ObserveSource`.

**When:** Use when adding new production sources; don't hardcode API calls in main observe loop.

**Example:**

```javascript
class ObserveSource {
  async fetch(config) {
    throw new Error('Subclasses must implement fetch()');
  }
}

class PrometheusSource extends ObserveSource {
  async fetch(config) {
    // config.prometheus_url, config.queries[], config.timeout_ms
    const results = [];
    for (const query of config.queries) {
      try {
        const response = await fetch(`${config.prometheus_url}/api/v1/query?query=${encodeURIComponent(query.expr)}`);
        const data = await response.json();
        if (data.status === 'success') {
          results.push({
            source: 'prometheus',
            type: query.type,
            value: data.data.result[0].value[1],
            threshold: query.threshold,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`Prometheus query failed: ${query.expr}`, err);
        // Continue to next query; don't fail entire observe
      }
    }
    return results;
  }
}

class ElasticsearchSource extends ObserveSource {
  async fetch(config) {
    // Similar pattern: config.elasticsearch_host, config.index, config.queries[]
    const es = new ElasticsearchClient({ node: config.elasticsearch_host });
    const results = [];
    for (const query of config.queries) {
      try {
        const response = await es.search({
          index: config.index,
          body: query.body
        });
        // Parse response; add to results
      } catch (err) {
        console.error(`Elasticsearch query failed`, err);
      }
    }
    return results;
  }
}

// Main observe orchestrator
async function observeProduction(config) {
  const sources = [
    new PrometheusSource(),
    new ElasticsearchSource(),
    new SentrySource(),
    // ... more sources
  ];

  // Parallel dispatch: all sources run concurrently
  const results = await Promise.all(
    sources.map(s => s.fetch(config[s.constructor.name.replace('Source', '').toLowerCase()]))
  );

  // Flatten results
  const allObservations = results.flat();
  fs.writeFileSync('.planning/observe-raw.jsonl', allObservations.map(o => JSON.stringify(o)).join('\n'));
}
```

### Pattern 2: Hierarchical Fingerprinting with Collision Fallback

**What:** Use deterministic hashing (SHA256) for primary grouping, then fuzzy matching within buckets.

**When:** Grouping issues that may have variation in message but same root cause.

**Example:**

```javascript
function fingerprintIssue(issue) {
  // Layer 1: Deterministic hash
  const layers = [
    issue.exception_type || 'unknown',
    issue.function_name || 'unknown'
  ];

  // Normalize message: remove numbers, UUIDs, timestamps
  const msg = (issue.message || '').toLowerCase();
  const normalized = msg
    .replace(/\d{4}-\d{2}-\d{2}T[\d:\.Z]+/g, 'TIMESTAMP')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/g, 'UUID')
    .replace(/\d+/g, 'NUM');

  // Hash the combined key
  const combined = layers.join('|') + '|' + normalized;
  const primaryHash = crypto.createHash('sha256').update(combined).digest('hex');

  return {
    primary_hash: primaryHash,
    layers: layers,
    normalized_message: normalized,
    full_message: msg,
    collision_fallback: msg  // If Levenshtein fails, use full message
  };
}

function deduplicateWithinBucket(issues) {
  // Group by primary hash first (O(n))
  const buckets = {};
  for (const issue of issues) {
    const fp = fingerprintIssue(issue);
    if (!buckets[fp.primary_hash]) buckets[fp.primary_hash] = [];
    buckets[fp.primary_hash].push({ ...issue, fingerprint: fp });
  }

  // Within each bucket, fuzzy-match (O(m²) where m = bucket size, usually small)
  const clusters = [];
  for (const [hash, bucket] of Object.entries(buckets)) {
    const subClusters = [[]];
    for (const issue of bucket) {
      let matched = false;
      for (const cluster of subClusters) {
        if (cluster.length === 0) continue;

        // Try Levenshtein matching
        const dist = levenshtein.distance(
          issue.message,
          cluster[0].message
        );
        const maxLen = Math.max(issue.message.length, cluster[0].message.length);
        const similarity = 1 - (dist / maxLen);

        if (similarity > 0.85) {  // Configurable threshold
          cluster.push(issue);
          matched = true;
          break;
        }
      }

      // If no fuzzy match found, start new cluster
      if (!matched) subClusters.push([issue]);
    }

    clusters.push(...subClusters);
  }

  return clusters;
}
```

### Pattern 3: State Machine with Atomic Transitions

**What:** Debt ledger states are (open → acknowledged → resolving → resolved); transitions require supporting data.

**When:** Modifying debt state; always validate before writing.

**Example:**

```javascript
const DebtStateMachine = {
  open: {
    allowedTransitions: ['acknowledged'],
    requiredFor: []
  },
  acknowledged: {
    allowedTransitions: ['resolving', 'open'],  // Can un-acknowledge
    requiredFor: ['resolving']
  },
  resolving: {
    allowedTransitions: ['resolved', 'acknowledged'],  // Can revert
    requiredFor: ['plan_id']  // Must have plan_id to resolve
  },
  resolved: {
    allowedTransitions: [],  // Terminal state
    requiredFor: ['completion_proof']
  }
};

function validateStateTransition(currentState, newState, data) {
  const transition = DebtStateMachine[currentState];
  if (!transition || !transition.allowedTransitions.includes(newState)) {
    throw new Error(`Invalid transition: ${currentState} → ${newState}`);
  }

  // Check required data
  for (const required of transition.requiredFor) {
    if (!data[required]) {
      throw new Error(`Transition to ${newState} requires ${required}`);
    }
  }

  return true;
}

// Usage: acknowledge debt
async function acknowledgeBet(debtId, acknowledgedBy) {
  const debt = loadDebt(debtId);
  validateStateTransition(debt.state, 'acknowledged', { acknowledged_by: acknowledgedBy });

  debt.state = 'acknowledged';
  debt.acknowledged_by = acknowledgedBy;
  debt.acknowledged_at = new Date().toISOString();

  // Atomic write
  fs.writeFileSync('.formal/debt.json', JSON.stringify(debt, null, 2), 'utf8');
}
```

### Pattern 4: P→F Integration Gate

**What:** Before adding P→F tasks to solve, verify that debt is acknowledged (human has signed off).

**When:** Running solve convergence loop, after existing 7 layers.

**Example:**

```javascript
async function solvePFLayer() {
  // Load formal parameters and production measurements
  const formalParams = loadFormalParameters();  // From PRISM, policy.yaml
  const debt = JSON.parse(fs.readFileSync('.formal/debt.json', 'utf8'));
  const lastObservations = fs.readFileSync('.planning/observe-raw.jsonl', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);

  const tasks = [];

  // Only process acknowledged debt
  const acknowledgedDebt = debt.filter(d => d.state === 'acknowledged');

  for (const debtItem of acknowledgedDebt) {
    // Find corresponding formal parameter
    for (const param of debtItem.formal_parameters || []) {
      const actualValue = lastObservations.find(
        o => o.metric === param.metric && o.value
      )?.value;

      if (actualValue && actualValue > param.threshold) {
        tasks.push({
          layer: 'P→F',
          type: 'production_formal_breach',
          debt_id: debtItem.id,
          formal_parameter: param.parameter,
          threshold: param.threshold,
          actual_value: actualValue,
          severity: debtItem.severity,
          remediation: `Reduce ${param.parameter} from ${actualValue} to < ${param.threshold}`
        });
      }
    }
  }

  return tasks;
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking Observe on Single Source Failure

**What goes wrong:** Prometheus is down; entire observe skill fails; no debt update happens.

**Why bad:** Defeats the purpose of production observability; one slow API blocks all sources.

**Instead:**
- Wrap each source in try-catch
- Log errors to stderr
- Continue to next source
- Aggregate whatever results succeed

### Anti-Pattern 2: Debt Ledger Without State Machine

**What goes wrong:** Mark issue as "resolved" without completing the actual fix; solve converges spuriously.

**Why bad:** Debt tracking becomes meaningless; acknowledged issues disappear from radar.

**Instead:**
- Enforce state machine via schema validation (ajv)
- Require plan_id before allowing "resolving"
- Require completion proof before "resolved"
- Prevent transitions that skip states

### Anti-Pattern 3: P→F Layer Processing Unacknowledged Debt

**What goes wrong:** Mark a production issue as a formal violation without human review; solve auto-fixes something human hasn't approved.

**Why bad:** Formal models become divorced from operational reality; humans lose control.

**Instead:**
- Only process debt in "acknowledged" state
- Require explicit human acknowledgment before P→F processes
- Log which debt items triggered P→F tasks

### Anti-Pattern 4: Fingerprinting Without Collision Handling

**What goes wrong:** Two unrelated NullPointerExceptions in different files get same hash; grouped together; dedup removes needed information.

**Why bad:** Critical bugs get deduped away; search visibility lost.

**Instead:**
- Hierarchical approach: primary hash (type+function) → fuzzy match (message) → fallback (full message)
- Store all cluster members so human can review variations
- Log collisions for future tuning

## Scalability Considerations

| Concern | At 100 issues/run | At 10K issues/run | At 100K issues/run |
|---------|---|---|---|
| **Observe fetch time** | <5s per source; parallel OK | ~10s per source; may hit rate limits | >30s; need batching + caching |
| **Fingerprinting latency** | <100ms (100 × SHA256) | <500ms (10K × SHA256 + Levenshtein) | >5s; need bucketing + indexing |
| **Levenshtein within bucket** | O(m²) acceptable if bucket <100 | Bucket size ~10-50; cost O(10K² / 100) = 1M ops OK | Need pre-filtering by length/prefix |
| **Debt JSON size** | <100 KB | <5 MB | >50 MB; consider sharding or DB |
| **P→F comparisons** | ~10 tasks | ~100-200 tasks | >1K tasks; parallelize comparisons |

**Recommendation:** For v0.27 MVP, optimize for 10K issues/run. Cache PromQL queries if running observe multiple times in same hour. Add benchmarks to catch regressions.

## Integration Points with Existing QGSD Systems

### With Solve Convergence Loop
- P→F is layer 8, inserted after existing 7 layers
- Doesn't change R→F, F→T, T→C, C→F, R→D, D→C layers
- Uses existing task aggregation mechanism
- Respects existing `--batch` and per-layer gating flags

### With Formal Verification Pipeline
- PRISM models export thresholds via `export-prism-constants.cjs`
- P→F layer reads those constants as "formal parameters"
- No changes to TLA+, Alloy, PRISM runner code
- New inputs: production measurements + acknowledged debt

### With Debt Ledger State Tracking
- State transitions validated via `ajv` (same pattern as requirements envelope)
- Immutable once written to `.formal/debt.json`
- Schema versioning allows evolution without breaking old entries

### With Dashboard
- Debt ledger view shows fingerprint clusters
- State transition timeline visible
- P→F violation count + severity distribution
- Reuses existing blessed TUI framework

## Sources

- [prom-client GitHub - Example code patterns](https://github.com/siimon/prom-client)
- [Elasticsearch JS Client - Query DSL](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/search_examples.html)
- [Sentry API - Issue listing and filtering](https://docs.sentry.io/api/events/)
- [fastest-levenshtein - Benchmarks](https://www.npmjs.com/package/fastest-levenshtein)
- [Ajv - Schema validation patterns](https://ajv.js.org/)

---

*Architecture patterns for: QGSD v0.27 Production Feedback Loop*
*Researched: 2026-03-04*
