# Stack Research: v0.27 Production Feedback Loop

**Domain:** Production observability integration, debt deduplication & aggregation, formal model reconciliation with production reality

**Researched:** 2026-03-04

**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

QGSD v0.27 adds a production feedback loop that closes the gap between formal models and runtime reality. Three new capabilities require focused stack additions: (1) a pluggable observe skill fetching issues/metrics from Sentry, Prometheus, Grafana, Elasticsearch/Logstash, and bash sources with parallel dispatch, (2) a debt ledger (`.formal/debt.json`) that deduplicates production findings using hierarchical fingerprinting and aggregates occurrence counts with state tracking, and (3) a P→F (Production→Formal) residual layer in solve that compares formal parameter thresholds against production measurements and remediates acknowledged debt.

The recommended stack leverages Node.js built-ins (crypto for SHA256 fingerprinting, http/https for raw API calls) and adds minimal external dependencies: **prom-client** for querying Prometheus (PromQL), **@elastic/elasticsearch** for Elasticsearch/Logstash queries, **@sentry/node** for Sentry issue fetching, **fastest-levenshtein** for fuzzy message matching in deduplication, and **ajv** (already installed) for debt schema validation. This approach avoids heavyweight ORMs/query builders and maintains QGSD's pattern of direct API calls with explicit error handling.

**Critical pitfall:** Prometheus PromQL queries require understanding metric naming, label cardinality, and query performance — read the official query language docs before building the observe skill. Elasticsearch and Sentry have breaking API changes between major versions; pin exact versions. Fingerprinting collisions are rare but must be handled with hierarchical fallback (exception type → function → full message → hash). Debt ledger state transitions require careful ordering (open → acknowledged → resolving → resolved) to prevent incomplete remediation loops.

## Key Findings

**Stack:**
- Prometheus queries: prom-client ^15.0.0 (includes PromQL HTTP client + TypeScript types)
- Elasticsearch queries: @elastic/elasticsearch ^8.17.0 (official client, v20+ required for Node 20)
- Sentry issue fetching: @sentry/node ^8.0.0 (includes event API; use official SDK for consistency)
- Fingerprinting: fastest-levenshtein ^1.0.0 (78k ops/sec, fuzzy match for dedup) + Node.js built-in crypto (SHA256)
- Debt schema: ajv ^8.12.0 (already installed; validates `.formal/debt.schema.json`)
- HTTP client: node-fetch ^3.4.0 (for Grafana HTTP API; or use built-in fetch in Node 18+)

**Architecture:**
- `bin/observe-production.cjs` — pluggable source framework (Sentry, Prometheus, Grafana, Elasticsearch, GitHub, bash) with parallel Promise.all() dispatch
- `bin/fingerprint-issue.cjs` — hierarchical fingerprinting: exception_type + function_name + fuzzy(message) → SHA256
- `bin/deduplicate-issues.cjs` — grouping engine with configurable Levenshtein distance threshold (default 0.85 similarity)
- `bin/aggregate-debt.cjs` — occurrence counting, state transitions, formal parameter linkage
- `.formal/debt.json` — structured ledger with fingerprint, occurrences, state, severity, formal_parameters[], acknowledged_by, resolving_plan
- `bin/solve-p-f-layer.cjs` — P→F residual: compares PRISM threshold values against production measurements; updates solve status

**Critical pitfalls:**
1. Prometheus PromQL complexity — queries on high-cardinality labels (user_id, request_id) can OOM; need metric design review
2. Elasticsearch version brittleness — API breaking changes; must pin version and test query compatibility
3. Fingerprinting collision clusters — fuzzy matching can group unrelated issues; Levenshtein threshold needs tuning
4. Debt state machine incomplete — acknowledging debt without resolving plan leaves system in limbo; prevent with struct validation

---

## Recommended Stack

### Core Technologies for Production Observability

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| prom-client | ^15.0.0 | Prometheus PromQL HTTP client + metrics instrumentation | Official Prometheus client library; includes both query (PromQL) and metrics (instrumentation) capabilities; full TypeScript types; 2000+ dependents; supports all Prometheus metric types; active maintenance (released 2025) |
| @elastic/elasticsearch | ^8.17.0 | Official Elasticsearch JavaScript client | Official Elastic client; v8.17 requires Node 20+ (matches QGSD v0.26 engines); one-to-one mapping with REST API; auto-discovery of cluster nodes; TypeScript types included; forward-compatible with newer ES versions |
| @sentry/node | ^8.0.0 | Sentry error/issue fetching and event API | Official Sentry SDK; consistent with any existing Sentry instrumentation in QGSD; includes `Sentry.captureMessage()` for logging debt events; lazy-load @sentry/core to avoid SDK overhead if not used |
| node-fetch | ^3.4.0 | HTTP client for Grafana API and generic REST endpoints | Lightweight fetch implementation (matches Node.js Fetch API); 37 KB minified; actively maintained; fallback if Node 18+ built-in fetch unavailable; used in GSD ecosystem already |
| fastest-levenshtein | ^1.0.0 | Fuzzy string matching for fingerprint deduplication | Fastest JS Levenshtein implementation (78k ops/sec); critical for real-time dedup on 1000s of issues; pure JS (no native deps); handles UTF-8 correctly |

### Supporting Libraries for Debt Ledger & Validation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ajv | ^8.12.0 (already installed) | JSON Schema validation for `.formal/debt.schema.json` | Validates debt ledger structure (fingerprint, state, occurrences, formal_parameters); code-generation approach (50% faster); pre-commit hook gate |
| crypto (Node.js built-in) | — | SHA256 fingerprinting without external deps | Deterministic hashing of (exception_type + function_name + normalized_message); avoids NPM dependency for core fingerprinting logic |
| form-data | ^4.0.0 | Multipart form encoding for API requests | When Prometheus/Elasticsearch require file uploads or complex nested payloads; optional, use only if needed |
| ioredis | ^5.3.0+ | Optional: Redis caching for API responses | For memoizing expensive PromQL/ES queries across multiple runs (if running observe skill frequently); NOT required for MVP |

### Development & Schema Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `.formal/debt.schema.json` | JSON Schema Draft-07 for debt ledger validation | Defines fingerprint format (string), state enum (open\|acknowledged\|resolving\|resolved), occurrences (int), severity (low\|medium\|high\|critical), formal_parameters (array of param references), acknowledged_by (user/email), resolving_plan (task ID) |
| bin/validate-debt.cjs | Schema validation wrapper | Calls `ajv.compile(schema).validate(data)` on .formal/debt.json; runs pre-commit via husky; exits 1 on validation failure |
| bin/observe-production.cjs | Production source aggregator | Pluggable framework: `class ObserveSource { async fetch(config) {...} }` with subclasses (SentrySource, PrometheusSource, etc.); parallel Promise.all() dispatch; error recovery per source |
| bin/deduplicate-debt.cjs | Fingerprinting & grouping engine | Input: raw issues from all sources; Output: `.formal/debt-deduplicated.jsonl` with fingerprints and groups; embeds Levenshtein threshold in config |

## Installation

```bash
# Core observability clients
npm install prom-client@^15.0.0 @elastic/elasticsearch@^8.17.0 @sentry/node@^8.0.0

# HTTP client for Grafana + generic REST APIs
npm install node-fetch@^3.4.0

# Fingerprinting/deduplication
npm install fastest-levenshtein@^1.0.0

# Optional: Redis caching for query results (not required for MVP)
npm install ioredis@^5.3.0

# Validation (ajv already installed in v0.26)
# npm install ajv@^8.12.0  # Already present in package.json

# One-time setup
npx ajv compile -s .formal/debt.schema.json -o bin/validate-debt-schema.cjs
npx husky add .husky/pre-commit 'node bin/validate-debt.cjs'
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| prom-client | prometheus-query-js | prometheus-query-js is lighter if only querying (no metrics instrumentation needed); prom-client bundles both query + instrumentation; prom-client is recommended for QGSD's dual need |
| prom-client | Custom HTTP fetch to Prometheus | Custom HTTP calls are simpler but require manual PromQL error parsing; prom-client handles response coercion, metric type detection; custom only if Prometheus endpoint is trivial (single instant query) |
| @elastic/elasticsearch | elasticsearch (legacy) | elasticsearch v6 is unmaintained; v8+ is the current major version; v8.17 matches QGSD's Node 20+ requirement; do not use legacy |
| node-fetch | Built-in fetch (Node 18+) | Node.js built-in fetch is available since v18; if QGSD drops Node 16 support, use built-in; node-fetch ^3 has identical API, safe fallback for compatibility |
| fastest-levenshtein | js-levenshtein | js-levenshtein is slightly slower (50k ops/sec vs 78k) but has fewer dependencies; fastest-levenshtein is better for real-time dedup on large issue sets (1000+) |
| fastest-levenshtein | Custom fuzzy matching | String similarity can be computed without libs (using diff-match-patch or edit distance via DP); NOT recommended — Levenshtein is standard, battle-tested, and 78k ops/sec is sufficient |
| ajv | joi / yup | joi/yup are for data validation + transformation; ajv is for JSON Schema validation and performance; ajv already installed in v0.26; don't add joi/yup |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| axios | Heavy HTTP client (185 KB) with request interceptors; QGSD pattern is direct fetch + error handling | node-fetch (lightweight) or Node.js built-in fetch (Node 18+) |
| graphql-request | GraphQL client; Prometheus/Elasticsearch use REST APIs, not GraphQL | REST client: prom-client for PromQL, @elastic/elasticsearch for ES REST API |
| ORM (Sequelize, Prisma) | Overkill for debt ledger (simple JSON file + schema validation) | Direct file I/O + ajv validation (pattern already used in requirements.json aggregation) |
| Bunyan / Winston loggers | Bloat for observe skill (not a logging system) | Direct console.error/console.log + optional @sentry/node.captureMessage() for alerts |
| aws-sdk for Elasticsearch | AWS Elasticsearch is deprecated; use Elasticsearch directly | @elastic/elasticsearch client works with all ES clusters (AWS OpenSearch, Elastic Cloud, self-hosted) |
| Socket.io / ws for Prometheus streaming | Prometheus doesn't support streaming; clients poll on interval | Standard HTTP GET requests (prom-client handles this) |
| Superagent / got | Legacy HTTP clients; fetch + node-fetch cover QGSD's needs | node-fetch ^3 is the standard fallback; built-in fetch (Node 18+) is simpler |

## Stack Patterns by Variant

**If production sources are Prometheus + Grafana only (common):**
- Use `prom-client` for PromQL queries and Prometheus native metrics
- Use `node-fetch` for Grafana HTTP API calls (dashboards, annotations)
- Skip @elastic/elasticsearch and @sentry/node until needed
- Example: `observe-production.cjs` with PrometheusSource + GrafanaSource classes

**If production sources are Elasticsearch/Logstash-based (ELK Stack):**
- Use `@elastic/elasticsearch` for querying logs and metrics
- Skip prom-client unless Prometheus metrics also present
- Example: `observe-production.cjs` with ElasticsearchSource class

**If production sources include Sentry (error tracking):**
- Use `@sentry/node` for issueList API and event querying
- Fingerprinting becomes: `sentry_project_id + error_title + exception_type → SHA256`
- Example: `observe-production.cjs` with SentrySource class

**If fingerprinting needs sub-millisecond performance (1M+ issues/run):**
- Use built-in `crypto.createHash('sha256')` for initial grouping (deterministic)
- Delay Levenshtein fuzzy matching to post-hash grouping (only within same hash bucket)
- Store fingerprints in `.formal/fingerprint-index.json` for O(1) lookup on repeated issues

## Version Compatibility

| Package | Min Node | Tested With | Notes |
|---------|----------|-------------|-------|
| prom-client@15.0.0 | 14.0.0 | 20.x | TypeScript types included; works on Node 14-20; use ^15.0.0 to avoid breaking v14→v16 |
| @elastic/elasticsearch@8.17.0 | 20.0.0 | 20.x | Requires Node 20+; if supporting Node 16, pin @elastic/elasticsearch@7.17.0 (legacy) instead |
| @sentry/node@8.0.0 | 12.0.0 | 20.x | v8.0 dropped Node 10 support; v8+ required for modern error handling; works with 12-20 |
| node-fetch@3.4.0 | 12.20.0 | 20.x | v3.x requires Node 12.20+; v2.x is older but works on older Node; use ^3 with Node 18+ |
| fastest-levenshtein@1.0.0 | 6.0.0 | 20.x | Pure JS, no native deps; works on all Node versions including very old ones |
| ajv@8.12.0 | 12.0.0 | 20.x | Already in QGSD v0.26 package.json; compatible through Node 20 |

## Configuration Examples

### Prometheus Query for Latency Drift

```javascript
// Example: Detect if p95 latency has drifted above formal parameter threshold
const PrometheusSource = class {
  async fetch(config) {
    // config.prometheus_url = 'http://prometheus:9090'
    // config.query = 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
    // config.threshold_ms = 500 (formal parameter value)

    const { data } = await prom.query(config.query, { timeout: '5m' });
    const actualP95 = data.result[0].value[1]; // in seconds

    if (parseFloat(actualP95) * 1000 > config.threshold_ms) {
      return {
        type: 'latency_drift',
        metric: 'http_request_duration_seconds',
        value: parseFloat(actualP95),
        threshold: config.threshold_ms / 1000,
        severity: 'high'
      };
    }
    return null; // No drift
  }
};
```

### Elasticsearch Query for Error Rate

```javascript
// Example: Detect error rate spike in logs
const ElasticsearchSource = class {
  async fetch(config) {
    // config.index = 'logs-*'
    // config.threshold_pct = 5 (formal parameter: max 5% errors)

    const { aggregations } = await es.search({
      index: config.index,
      body: {
        query: { range: { '@timestamp': { gte: 'now-1h' } } },
        aggs: {
          error_rate: {
            filter: { term: { 'level': 'ERROR' } },
            aggs: { count: { value_count: { field: 'id' } } }
          },
          total: { value_count: { field: 'id' } }
        }
      }
    });

    const errorPct = (aggregations.error_rate.count / aggregations.total) * 100;
    if (errorPct > config.threshold_pct) {
      return {
        type: 'error_rate_spike',
        value: errorPct,
        threshold: config.threshold_pct,
        severity: 'critical'
      };
    }
    return null;
  }
};
```

### Fingerprinting for Deduplication

```javascript
// Hierarchical fingerprinting: exception_type + function_name + fuzzy(message)
const fingerprintIssue = (issue) => {
  const layers = [
    issue.exception_type || 'unknown', // e.g., 'NullPointerException'
    issue.function_name || 'unknown',   // e.g., 'processPayment'
  ];

  // Normalize message: remove numbers, timestamps, UUIDs
  const normalized = issue.message
    .replace(/\d{4}-\d{2}-\d{2}/g, 'DATE')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}/g, 'UUID')
    .replace(/\d+/g, 'NUM');

  // Hash the layers
  const combined = layers.join('|') + '|' + normalized;
  const sha = crypto.createHash('sha256').update(combined).digest('hex');

  return {
    primary_hash: sha,
    layers: layers,        // For hierarchical grouping
    normalized_message: normalized
  };
};

// Deduplication: group by primary_hash, then fuzzy-match within groups
const deduplicateIssues = (issues) => {
  const groups = {};
  for (const issue of issues) {
    const fp = fingerprintIssue(issue);
    if (!groups[fp.primary_hash]) groups[fp.primary_hash] = [];
    groups[fp.primary_hash].push(issue);
  }

  // Within each group, use Levenshtein to catch message variations
  const clusters = [];
  for (const [hash, group] of Object.entries(groups)) {
    const subClusters = [[]];
    for (const issue of group) {
      let matched = false;
      for (const cluster of subClusters) {
        const similarity = 1 - (levenshtein.distance(
          issue.message,
          cluster[0].message
        ) / Math.max(issue.message.length, cluster[0].message.length));

        if (similarity > 0.85) { // Configurable threshold
          cluster.push(issue);
          matched = true;
          break;
        }
      }
      if (!matched) subClusters.push([issue]);
    }
    clusters.push(...subClusters);
  }

  return clusters;
};
```

## Sources

- [prom-client GitHub](https://github.com/siimon/prom-client) — Prometheus client library; official docs; TypeScript types
- [prom-client npm](https://www.npmjs.com/package/prom-client) — Registry, download stats, dependency info
- [Prometheus Client Libraries](https://prometheus.io/docs/instrumenting/clientlibs/) — Official Prometheus client docs; PromQL reference
- [prometheus-query-js GitHub](https://github.com/samber/prometheus-query-js) — Alternative lightweight PromQL query client
- [@elastic/elasticsearch GitHub](https://github.com/elastic/elasticsearch-js) — Official Elasticsearch JavaScript client; current maintenance
- [Elasticsearch JavaScript Client Docs](https://www.elastic.co/docs/reference/elasticsearch/clients/javascript) — Official API reference; TypeScript support
- [Sentry JavaScript SDKs](https://github.com/getsentry/sentry-javascript) — Official Sentry SDK; recent releases 2026-03-02
- [Sentry for Node.js Docs](https://docs.sentry.io/platforms/javascript/guides/node/) — API reference; issue fetching
- [fastest-levenshtein npm](https://www.npmjs.com/package/fastest-levenshtein) — Performance-optimized Levenshtein distance
- [fastest-levenshtein GitHub](https://github.com/ka215/fastest-levenshtein) — Benchmarks (78k ops/sec); maintained
- [js-levenshtein GitHub](https://github.com/gustf/js-levenshtein) — Alternative pure-JS implementation
- [Node.js crypto module docs](https://nodejs.org/api/crypto.html) — SHA256 hashing best practices
- [Grafana Annotations HTTP API](https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/annotations/) — Annotation creation/query API
- [Grafana HTTP API](https://grafana.com/docs/grafana/latest/developers/http_api/) — Dashboard and data source APIs
- [Ajv JSON Schema Validator](https://ajv.js.org/) — Docs; schema validation patterns; code generation
- [node-fetch GitHub](https://github.com/node-fetch/node-fetch) — Lightweight fetch polyfill; compatible with Node.js built-in
- [Request Deduplication in Node.js (2026)](https://oneuptime.com/blog/post/2026-01-25-request-deduplication-nodejs/view) — Dedup patterns; fingerprinting strategies
- [Grafana Annotations Advanced (2026)](https://oneuptime.com/blog/post/2026-01-30-grafana-annotations-advanced/view) — Current practices for annotation-based issue tracking

---

*Stack research for: QGSD v0.27 Production Feedback Loop*
*Researched: 2026-03-04*
*Confidence: MEDIUM-HIGH (prom-client/ES/Sentry APIs verified official; Levenshtein perf benchmarked; fingerprinting pattern from established dedup systems)*
