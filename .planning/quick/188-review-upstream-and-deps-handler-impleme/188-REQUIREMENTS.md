# Candidate Requirements for Elevation

From review of upstream and deps observe handlers (quick-188).

---

## OBS-SCHEMA: Standard Handler Return Schema

**Description:** All observe handlers MUST return `{ source_label, source_type, status: 'ok'|'error', issues: Array, error?: string }`. Each issue MUST include `{ id, title, severity, url, age, created_at, meta, source_type, issue_type }`.

**Rationale:** Currently enforced by convention — no runtime validation exists. The renderer silently handles missing fields with fallbacks, which masks handler bugs. A schema check at dispatch would catch issues before they reach the render pipeline.

**Evidence:**
- All 8 handlers follow this pattern: `observe-handlers.cjs` (github, sentry, sentry-feedback, bash), `observe-handler-prometheus.cjs`, `observe-handler-grafana.cjs`, `observe-handler-logstash.cjs`, `observe-handler-internal.cjs`, `observe-handler-upstream.cjs`, `observe-handler-deps.cjs`
- The render module (`observe-render.cjs`) relies on `issue_type` field for table routing — a handler omitting this field would cause the issue to appear in the wrong table

**Priority:** HIGH — prevents subtle bugs as more handlers are added

**Suggested requirement text:**
> Observe handlers return the standard schema `{ source_label, source_type, status, issues[], error? }` with all issue fields populated. The dispatch layer validates the return shape before passing to the renderer.

---

## OBS-DEDUP: Shared Utility Functions

**Description:** Common utility functions used across observe handlers (parseDuration, formatAge) MUST be defined in one canonical location and imported, not duplicated.

**Rationale:** `formatAge` is duplicated in 6 files with 3 different null-handling behaviors (`'unknown'`, `''`, `'new'` vs `'future'`). This drift already causes visual inconsistency in observe output. `parseDuration` is duplicated in 2 files.

**Evidence:**
- `formatAge` in: observe-handlers.cjs, observe-handler-upstream.cjs, observe-render.cjs, observe-handler-prometheus.cjs, observe-handler-grafana.cjs, observe-handler-logstash.cjs
- `parseDuration` in: observe-handlers.cjs, observe-handler-upstream.cjs
- Null return inconsistency: `'unknown'` (3 files), `''` (2 files)
- Future date return inconsistency: `'future'` (2 files), `'new'` (1 file)

**Priority:** HIGH — active drift already causing inconsistency

**Suggested requirement text:**
> Observe utility functions (formatAge, parseDuration, classifySeverity) are defined in a single canonical module and imported by all handlers. No handler duplicates these functions.

---

## OBS-FAILOPEN: Fail-Open Handler Convention

**Description:** All observe handlers MUST catch errors and return `{ status: 'error', error: string, issues: [] }` instead of throwing. No handler failure blocks other handlers from running.

**Rationale:** Already followed by all handlers and enforced at the dispatch layer via `Promise.allSettled`, but not formalized. Critical for handler authors to know — a throwing handler would be caught by dispatchSource but the error message would be less informative than a handler-formatted error.

**Evidence:**
- All handlers wrap their logic in try/catch and return error schema
- `observe-registry.cjs:dispatchAll` uses `Promise.allSettled` as a safety net
- Documented in observe.md as "OBS-08" but not in requirements.json

**Priority:** MEDIUM — already working, but should be codified for new handler authors

**Suggested requirement text:**
> Observe handlers catch all errors internally and return status: 'error' with a descriptive error string. No handler throws — the dispatch layer's Promise.allSettled is a safety net, not the primary error boundary.

---

## OBS-DI: Dependency Injection for Testability

**Description:** All observe handlers MUST accept `execFn` (for subprocess calls) and `basePath` (for filesystem operations) in their options parameter, enabling unit testing without real CLI/filesystem access.

**Rationale:** Both new handlers and most existing handlers follow this pattern. It enables the 47 unit tests to run in <100ms without requiring gh, npm, pip, or real git repos. Codifying this ensures new handlers are testable from day one.

**Evidence:**
- `handleUpstream`: accepts `options.execFn`, `options.basePath`
- `handleDeps`: accepts `options.execFn`, `options.basePath`
- `handleGitHub`: accepts `options.execFn`
- `handleBash`: accepts `options.execFn`
- Test files mock these via function injection: `observe-handler-upstream.test.cjs`, `observe-handler-deps.test.cjs`

**Priority:** MEDIUM — already a strong convention, codifying prevents regression

**Suggested requirement text:**
> Observe handlers accept execFn and basePath options for dependency injection. All subprocess calls use the injected execFn (defaulting to execFileSync) and all filesystem paths resolve relative to basePath.

---

## OBS-STATE: Persistent State Cursor Pattern

**Description:** Handlers that track state between observe runs (e.g., upstream `last_checked` cursor) MUST persist state as JSON in `.planning/`, include a `last_checked` ISO8601 timestamp, and use atomic write (temp file + rename) to prevent corruption.

**Rationale:** The upstream handler introduces a new pattern — persistent state across observe runs. Currently uses `fs.writeFileSync` which is not atomic. As more stateful handlers are added (e.g., a "changelog since last check" handler), the pattern should be standardized and safe.

**Evidence:**
- `observe-handler-upstream.cjs:saveUpstreamState` — writes `.planning/upstream-state.json` via `fs.writeFileSync` (non-atomic)
- State structure: `{ [repo]: { last_checked, last_release_tag, coupling } }`
- No other handler currently uses persistent state (all are stateless)

**Priority:** LOW — only one handler uses state currently, but atomic write should be added proactively

**Suggested requirement text:**
> Stateful observe handlers persist their cursor in `.planning/` as JSON with a `last_checked` ISO8601 field. State writes use atomic write (write to temp file + rename) to prevent corruption from interrupted runs.

---

## OBS-UPSTREAM-EVAL: Upstream Changes Require Quality Comparison

**Description:** When a user selects an upstream item from observe, the system MUST perform a quality comparison (SKIP/CANDIDATE/INCOMPATIBLE) before suggesting any port. Upstream changes are evaluation candidates, not sync obligations.

**Rationale:** Even for tight fork parents, nForma may have intentionally diverged with better implementations. Blindly porting upstream changes would regress quality. The evaluation routing in observe.md Step 7 implements this but it's not a formal requirement.

**Evidence:**
- `commands/nf/observe.md` Step 7: "Upstream evaluation routing" section
- Handler tags: `[Evaluate]` for tight coupling, `[Inspiration]` for loose
- Evaluation table: SKIP (ours is better) / CANDIDATE (theirs adds something) / INCOMPATIBLE (architectural mismatch)

**Priority:** HIGH — core design philosophy of the upstream tracking feature

**Suggested requirement text:**
> Upstream changes surfaced by observe are evaluated against existing code before porting. The system compares overlapping areas and classifies each as SKIP (our implementation is equivalent or better), CANDIDATE (upstream introduces something we lack), or INCOMPATIBLE (conflicts with our architecture). No upstream change is ported without this evaluation.

---

## Summary

| ID | Title | Priority | Action |
|----|-------|----------|--------|
| OBS-SCHEMA | Standard Handler Return Schema | HIGH | Add via `/nf:add-requirement` |
| OBS-DEDUP | Shared Utility Functions | HIGH | Add + create `bin/observe-utils.cjs` in follow-up |
| OBS-FAILOPEN | Fail-Open Handler Convention | MEDIUM | Add via `/nf:add-requirement` |
| OBS-DI | Dependency Injection for Testability | MEDIUM | Add via `/nf:add-requirement` |
| OBS-STATE | Persistent State Cursor Pattern | LOW | Add after implementing atomic write |
| OBS-UPSTREAM-EVAL | Upstream Quality Comparison | HIGH | Add via `/nf:add-requirement` |

**Recommended immediate elevation (HIGH priority):** OBS-SCHEMA, OBS-DEDUP, OBS-UPSTREAM-EVAL
