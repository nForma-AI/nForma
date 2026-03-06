# Cleanup Report: v0.28-02 Data Pipeline -- Quorum Cache + Pass@k Metrics

**Date:** 2026-03-06
**Phase:** v0.28-02-data-pipeline-quorum-cache-pass-at-k-metrics
**Files reviewed:** 12 (as listed in phase context)

---

## 1. Redundancy

### R1. Duplicate `conformance-schema.cjs` (CONFIRMED IDENTICAL)

`hooks/conformance-schema.cjs` and `bin/conformance-schema.cjs` are byte-for-byte identical (verified via `diff`). Two copies of the same 12-line module exist so hooks can `require('./conformance-schema.cjs')` relative to their own directory while `bin/` scripts do the same. The duplication is intentional for deploy isolation (hooks install to `~/.claude/hooks/` with no symlink support), but any future schema change must update both files in lockstep. No action needed now, but a sync-check assertion in the test suite would prevent silent drift.

### R2. Duplicate `appendConformanceEvent` function

The same function body appears in three files:
- `hooks/nf-prompt.js` (line 52)
- `hooks/nf-stop.js` (line 33)
- `hooks/nf-circuit-breaker.js` (line 395)

Each copy is ~8 lines and performs the same `planning-paths.cjs` require, `resolve()`, and `appendFileSync()` call. These cannot trivially be shared at runtime (hooks are standalone scripts installed to `~/.claude/hooks/`), but they could be generated from a single source during the `cp hooks/* hooks/dist/` build step.

**Severity:** Low. Maintenance cost if the conformance log format changes.

### R3. Duplicate `parseQuorumSizeFlag` function

Identical implementations in `hooks/nf-prompt.js` (line 111) and `hooks/nf-stop.js` (line 401). Both parse `--n N` from a string. Same rationale as R2 -- standalone hook constraint prevents sharing.

**Severity:** Low.

### R4. Duplicate text-extraction boilerplate in `nf-stop.js`

The pattern `typeof content === 'string' ? content : Array.isArray(content) ? content.find(c => c?.type === 'text')...` appears 7 times in `nf-stop.js` across `hasCacheHitMarker`, `extractCacheKey`, `extractPromptText`, `hasQuorumCommand`, `extractCommand`, and `extractCommandTag`. A local `extractText(entry)` helper would collapse these to one-liners.

**Severity:** Medium. The repetition increases surface area for inconsistent changes.

---

## 2. Dead Code

### D1. `VALID_ACTIONS`, `VALID_PHASES`, `VALID_OUTCOMES` arrays unused in hooks

`hooks/nf-prompt.js` and `hooks/nf-stop.js` both `require('./conformance-schema.cjs')` but only destructure `schema_version`. The `VALID_ACTIONS`, `VALID_PHASES`, and `VALID_OUTCOMES` arrays are never referenced. The import is not harmful (tiny module), but the destructure could be narrowed for clarity.

**Severity:** Trivial.

### D2. `pendingEntry` variable in `nf-stop.js` cache backfill (line 651)

```js
const pendingEntry = cacheModule.readCache(cKey, cacheDir);
```

This variable is assigned but never read. The code immediately falls through to the raw `fs.readFileSync` path because `readCache` returns `null` for pending entries (no `completed` field). The `readCache` call is a wasted I/O operation and the variable is pure dead code.

**Severity:** Low. One unnecessary file read per quorum approval.

### D3. `DECIDING` phase value used but not in `VALID_PHASES` enum

Both hooks emit conformance events with `phase: 'DECIDING'`, but `VALID_PHASES` in `conformance-schema.cjs` lists `['IDLE', 'COLLECTING_VOTES', 'DELIBERATING', 'DECIDED']`. The `DECIDING` value is not validated anywhere at write time (hooks do not validate against the enum), but `validate-traces.cjs` and `mismatch-register` already handle it via special-case methodology-skip logic. This is a schema gap, not dead code per se, but it means the enum is incomplete.

**Severity:** Medium. The enum should either include `DECIDING` or the hooks should use `DECIDED`.

---

## 3. Over-Defensive Patterns

### O1. Double TTL validation in cache read path (`nf-prompt.js` line 477)

```js
const cachedEntry = cacheModule.readCache(cacheKey, cacheDir);
if (cachedEntry && cacheModule.isCacheValid(cachedEntry, cacheModule.getGitHead(), config.quorum_active || [])) {
```

`readCache` (quorum-cache.cjs line 93-94) already performs a TTL check: `if (age > entry.ttl_ms) return null`. Then `isCacheValid` (line 138-139) performs the same TTL check again. The git-HEAD and quorum-composition checks in `isCacheValid` are genuinely additional, but the TTL portion is redundant.

**Severity:** Low. One extra `Date.now()` call per cache hit.

### O2. Triple `getGitHead()` invocation on cache miss path

In `nf-prompt.js`, `getGitHead()` is called:
1. Line 474 -- `computeCacheKey` argument
2. Line 477 -- `isCacheValid` argument
3. Line 688 -- pending entry `git_head` field

Each call spawns `git rev-parse HEAD` (3s timeout). The HEAD is extremely unlikely to change within a single hook execution. A single `const gitHead = cacheModule.getGitHead()` at the top of the cache block would eliminate two subprocess spawns.

**Severity:** Medium. Two unnecessary `spawnSync` calls per quorum dispatch.

### O3. `var` declarations for cache state in `nf-prompt.js` (lines 507-515)

```js
var _nfCacheKey = cacheKey;
var _nfCacheModule = cacheModule;
var _nfCacheDir = cacheDir;
```

Using `var` to hoist these out of the try/catch block into the enclosing function scope. This works but is the only `var` usage in an otherwise `const/let` codebase. A `let` declaration before the try block would be cleaner and consistent.

**Severity:** Trivial. Style-only.

### O4. `fs.existsSync` before `readFileSync` in multiple locations

Throughout `nf-prompt.js` (e.g., `getRecentlyTimedOutSlots`, `getAvailableSlots`, `sortBySuccessRate`, `getDownProviderSlots`) the pattern is:
```js
if (!fs.existsSync(path)) return default;
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
```

Since the entire block is already wrapped in a try/catch that returns the default value, the `existsSync` call is redundant -- `readFileSync` would throw `ENOENT` and the catch would handle it identically. The hooks do this intentionally for fail-open clarity, so this is stylistic rather than harmful.

**Severity:** Trivial. Consistent with the project's fail-open documentation style.

### O5. Scoreboard read repeated in both `getAvailableSlots` and `sortBySuccessRate`

Both functions independently `require('planning-paths.cjs')`, resolve the scoreboard path, `existsSync` it, and `JSON.parse(readFileSync(...))` it. They are called sequentially at lines 464 and 468 of `nf-prompt.js`. A single scoreboard read passed as an argument would halve the I/O.

**Severity:** Low. Two file reads of the same JSON file in one hook invocation.

---

## 4. Summary of Recommended Actions

| ID  | Category    | Severity | Action |
|-----|------------|----------|--------|
| R4  | Redundancy | Medium   | Extract `extractText(entry)` helper in `nf-stop.js` |
| D2  | Dead code  | Low      | Remove unused `pendingEntry` line in `nf-stop.js:651` |
| D3  | Schema gap | Medium   | Add `'DECIDING'` to `VALID_PHASES` in both `conformance-schema.cjs` copies |
| O2  | Over-defensive | Medium | Cache `getGitHead()` result in a single variable |
| O3  | Style      | Trivial  | Replace `var _nf*` with `let` declarations before try block |
| O5  | Over-defensive | Low  | Pass scoreboard data as argument to avoid double read |
| R1  | Redundancy | Low      | Add a test asserting the two `conformance-schema.cjs` copies match |

Total findings: 12 items (3 redundancy, 3 dead code, 5 over-defensive, 1 schema gap).
No blocking issues. All findings are safe to defer to a future cleanup sprint.
