# Review: Upstream and Deps Observe Handlers

## Executive Summary

Both handlers are well-structured and follow the observe handler pattern correctly. The main concerns are: (1) utility function duplication across 6+ files creating drift risk (already manifested), (2) an unreliable Node.js version detection method, and (3) a hardcoded Python version threshold. Integration pipeline is fully consistent.

---

## 1. Schema Compliance

| Handler | Status | Notes |
|---------|--------|-------|
| `observe-handler-upstream.cjs` | PASS | Returns `{ source_label, source_type, status, issues[], error? }`. Each issue has all required fields. Adds `_upstream` metadata. |
| `observe-handler-deps.cjs` | PASS | Returns standard schema. Each issue has all required fields. Adds `_deps` metadata. |

Both handlers include `issue_type` on every issue object (upstream/deps respectively), which is required for the renderer to route to the correct table.

---

## 2. Code Quality Issues

### CQ-1: `formatAge` duplicated across 6 files (WARNING)

`formatAge` is copy-pasted in:
- `bin/observe-handlers.cjs` (returns `'unknown'` for null, `'future'` for negative)
- `bin/observe-handler-upstream.cjs` (returns `''` for null, `'new'` for negative)
- `bin/observe-render.cjs` (returns `''` for null, `'future'` for negative)
- `bin/observe-handler-prometheus.cjs` (returns `'unknown'`)
- `bin/observe-handler-grafana.cjs` (returns `'unknown'`)
- `bin/observe-handler-logstash.cjs` (returns `'unknown'`)

**Inconsistent null handling already observed:** Three different return values for null input. This will cause visual inconsistency in observe tables.

**Recommendation:** Extract to a shared `bin/observe-utils.cjs` module. All handlers import from there.

### CQ-2: `parseDuration` duplicated in 2 files (NIT)

Exists in both `observe-handlers.cjs` and `observe-handler-upstream.cjs` with identical implementation. Should share from a common location.

### CQ-3: Unreliable Node.js version detection (WARNING)

`checkNodeVersion` uses `npm view node version` which queries the npm registry for a package literally named "node" — this is an npm shim package, NOT the actual Node.js release schedule. Its version may not match the latest LTS.

**Better approaches:**
- Fetch `https://nodejs.org/dist/index.json` and filter for LTS entries
- Use `nvm ls-remote --lts` if nvm is available
- Hardcode a known LTS major (like Python handler does) with a comment

### CQ-4: Hardcoded Python version threshold (NIT)

`checkPythonVersion` hardcodes `curMin < 12` as the "outdated" threshold. This will go stale as Python releases 3.13, 3.14, etc. The comment says "3.13.x as of 2026" but the code checks `< 12`.

**Recommendation:** Either bump to match the comment, or accept the heuristic with a `// TODO: bump periodically` marker.

### CQ-5: bumpType computed twice in deps handler (NIT)

In `checkNpmOutdated` and `checkPipOutdated`, `bumpType` is computed in an IIFE that re-calls `parseSemver(current)` even though it was already destructured above. Minor inefficiency but not harmful.

### CQ-6: Silent error swallowing in nested try/catch (WARNING)

`checkNpmOutdated` has a nested try/catch structure:
```javascript
try {
  // outer
  try {
    output = execFile('npm', ['outdated', '--json'], ...);
  } catch (err) {
    output = err.stdout || ''; // catches exit code 1 (expected)
  }
  // ...JSON.parse(output)...
} catch {
  // catches everything including JSON parse errors — silently
}
```

If `err.stdout` contains malformed JSON (npm CLI bug, version mismatch), the parse error is silently swallowed. Consider logging to debug or returning an error status for non-empty but unparseable output.

Same pattern exists in `checkNpmAudit`.

---

## 3. Edge Cases

### EC-1: Unauthenticated `gh` CLI (LOW RISK)

If `gh auth status` would fail, `fetchReleases` and `fetchNotablePRs` silently return `[]`. The upstream handler then reports 0 issues — not visibly an error. User may not realize their gh CLI isn't authenticated.

**Mitigation:** Consider checking `gh auth status` once at handler start and including a note in the result if not authenticated.

### EC-2: Missing npm/pip CLIs (LOW RISK)

The deps handler silently returns `[]` when CLI tools are missing. Acceptable for optional ecosystems, but if a `package.json` exists and npm isn't available, the user might expect to see dep info.

**Mitigation:** Could return a single "info" issue: "npm CLI not found — skipping outdated check"

### EC-3: fetchNotablePRs fetches `limit * 3` (LOW RISK)

For a limit of 10, this fetches 30 PRs. The `gh pr list` command defaults to sorting by recency, so this is bounded. Not a real problem, but the multiplier should be documented.

### EC-4: Upstream state file race condition (VERY LOW RISK)

If two `/nf:observe` runs happen concurrently, `saveUpstreamState` uses non-atomic `writeFileSync`. A crash mid-write could corrupt the file. In practice, concurrent observe runs are unlikely since it's interactive.

### EC-5: Deps handler `execFile` not passed to sub-functions consistently (NIT)

`handleDeps` receives `options.execFn` but stores it as `execFile`, then passes `execFile` to `checkNpmOutdated(basePath, execFile)`. This works but is slightly confusing since the parameter name is `execFn` in the sub-functions.

---

## 4. Test Coverage Gaps

| # | Gap | File | Severity |
|---|-----|------|----------|
| TC-1 | No test for `handleUpstream` when `gh release list` succeeds but `gh pr list` fails mid-execution | upstream.test.cjs | LOW |
| TC-2 | No test for `sinceOverride` option being passed through `handleUpstream` options | upstream.test.cjs | LOW |
| TC-3 | No test for `handleDeps` top-level error path (e.g., `detectEcosystems` throws) | deps.test.cjs | LOW |
| TC-4 | No test for `checkPipOutdated` when pip returns invalid JSON | deps.test.cjs | LOW |
| TC-5 | No test for `checkNodeVersion` when `npm view` fails (inner catch) | deps.test.cjs | LOW |
| TC-6 | No integration test verifying config type inference + handler dispatch + render routing end-to-end for upstream/deps | N/A | MEDIUM |

All marked LOW because the happy paths and primary error paths are well-covered (24 upstream tests, 23 deps tests — all passing).

---

## 5. Integration Consistency

| Check | Status | File | Detail |
|-------|--------|------|--------|
| Config type inference: `UPSTREAM_TYPES` | PASS | observe-config.cjs:14 | `['upstream']` → infers `issue_type: 'upstream'` |
| Config type inference: `DEPS_TYPES` | PASS | observe-config.cjs:16 | `['deps']` → infers `issue_type: 'deps'` |
| Handler re-export: `handleUpstream` | PASS | observe-handlers.cjs:416 | Re-exported from observe-handler-upstream.cjs |
| Handler re-export: `handleDeps` | PASS | observe-handlers.cjs:418 | Re-exported from observe-handler-deps.cjs |
| Render routing: upstream table | PASS | observe-render.cjs:83 | `item.issue_type === 'upstream'` filters correctly |
| Render routing: deps table | PASS | observe-render.cjs:84 | `item.issue_type === 'deps'` filters correctly |
| Render: issues excludes upstream+deps | PASS | observe-render.cjs:82 | `!['drift', 'upstream', 'deps'].includes(...)` |
| Handler registration: observe.md | PASS | observe.md Step 3 | Both `registerHandler('upstream', ...)` and `registerHandler('deps', ...)` present |
| Config examples: observe-sources.md | PASS | observe-sources.md | Working examples for GSD (tight), everything-claude-code (loose), and deps |
| Upstream evaluation routing | PASS | observe.md Step 7 | References `issue_type: 'upstream'` and `_upstream` metadata for SKIP/CANDIDATE/INCOMPATIBLE evaluation |
| Header summary includes upstream+deps | PASS | observe-render.cjs:105 | `${upstreamNote}${depsNote}` in header line |
| All-clear check includes all types | PASS | observe-render.cjs:91 | Checks `totalUpstreams === 0 && totalDeps === 0` |
