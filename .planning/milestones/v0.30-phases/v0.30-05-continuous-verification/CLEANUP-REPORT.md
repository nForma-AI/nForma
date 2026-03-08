# Cleanup Report: v0.30-05 Continuous Verification

**Date:** 2026-03-08
**Reviewer:** Claude Opus 4.6
**Files reviewed:** 9

---

## Summary

The phase introduced two new bin scripts (`continuous-verify.cjs`, `execution-progress.cjs`), integrated continuous verification into the `gsd-context-monitor.js` PostToolUse hook, added the `continuous_verify_enabled` config key, wired `done_conditions` into the execute-plan workflow, and added comprehensive test coverage for all new code. The code is generally well-structured with consistent fail-open patterns.

**Findings:** 5 redundancies, 2 dead-code items, 1 over-defensive pattern.

---

## Findings

### 1. Dead code: unreachable `undefined` checks after validation in `config-loader.js`

**File:** `hooks/config-loader.js` (lines 212-213, 218-219, 308-313, 345-353, 378-385, 404-409)

In `validateConfig()`, several sub-object validators first check and correct invalid values (setting them to a default integer), then separately check `=== undefined` for the same keys. The `undefined` checks are unreachable because:
- The preceding `Number.isInteger()` check already catches `undefined` (it returns `false`) and sets the value to the default.
- The value can never be `undefined` by the time the `=== undefined` guard runs.

Affected sub-objects: `circuit_breaker` (oscillation_depth, commit_window, haiku_reviewer, haiku_model), `context_monitor` (warn_pct, critical_pct), `budget` (session_limit_tokens, warn_pct, downgrade_pct), `stall_detection` (timeout_s, consecutive_threshold, check_commits), `smart_compact` (enabled, context_warn_pct).

**Recommendation:** Remove all the "Fill missing sub-keys with defaults" blocks that follow a validator that already handles `undefined`. Roughly 30 lines of dead code.

**Risk:** None. The preceding validators already cover the `undefined` case. Removing these lines changes no behavior.

---

### 2. Redundancy: `smart_compact.context_warn_pct` vs `smart_compact_threshold_pct`

**Files:** `hooks/config-loader.js` (lines 131, 159), `hooks/gsd-context-monitor.js` (line 164)

Two config keys control the compact threshold:
- `smart_compact.context_warn_pct` (default 60) -- validated in config-loader
- `smart_compact_threshold_pct` (default 65) -- flat key in DEFAULT_CONFIG, not validated

The hook reads only `smart_compact_threshold_pct` (line 164) and ignores `smart_compact.context_warn_pct` entirely. The nested key exists in config, gets validated, but is never consumed.

**Recommendation:** Remove `smart_compact.context_warn_pct` from DEFAULT_CONFIG and its validation block, OR consolidate into one key. The flat key (`smart_compact_threshold_pct`) is the one actually used and should be kept.

**Risk:** Low. Only removes an unused config path.

---

### 3. Over-defensive: double-fallback for `timeoutMs` in `continuous-verify.cjs`

**File:** `bin/continuous-verify.cjs` (lines 107, 132, 160)

`runChecks()` defaults `timeoutMs` with `|| 5000` at each spawn call, but every caller already passes an explicit timeout:
- Hook integration (gsd-context-monitor.js:211) passes `verifyState.timeout_ms || 5000`
- CLI (continuous-verify.cjs:244) passes hardcoded `5000`
- `evaluateCondition()` defaults to `30000` at line 160 with `|| 30000`

The fallback is applied twice in the chain: once by the caller and once inside the function. This is harmless but obscures intent.

**Recommendation:** Accept `timeoutMs` as-is inside `runChecks()` and `evaluateCondition()` (remove the `|| default` inside the function body). The caller is responsible for providing a value. Or document that the function has its own default.

**Risk:** None if callers always pass a value (they do today).

---

### 4. Redundancy: `loadContinuousVerify()` in `execution-progress.cjs` vs top-level require

**File:** `bin/execution-progress.cjs` (lines 45-47)

`loadContinuousVerify()` wraps a try/catch around `require()` to make the dependency optional. This is correct for resilience, but the function is only called from `completeTask()` and the result is used once. The pattern could be simplified to a top-level optional require (identical to how `gsd-context-monitor.js` handles it at lines 22-25).

**Recommendation:** Replace `loadContinuousVerify()` with a top-level `const continuousVerify = (() => { try { return require(...); } catch { return null; } })();` for consistency with gsd-context-monitor.js. Eliminates repeated require on every `completeTask()` call.

**Risk:** None. Both approaches are fail-open.

---

### 5. Redundancy: `(files || [])` repeated in `runChecks()`

**File:** `bin/continuous-verify.cjs` (lines 98-99, 150)

`files` is checked with `(files || [])` three times in `runChecks()`: lines 98, 99, and 150. A single normalization at the top of the function would suffice.

**Recommendation:** Add `files = files || [];` at the start of `runChecks()` and remove the inline guards.

**Risk:** None.

---

### 6. Dead code: `BLOCKED_STATUS` constant test is a tautology

**File:** `bin/execution-progress.test.cjs` (lines 369-371)

The test "BLOCKED_STATUS constant is exported" asserts `BLOCKED_STATUS === 'blocked'`, which is already exercised by the "completeTask with failing done_conditions sets blocked status" test that checks `result.tasks[0].status === BLOCKED_STATUS`. The dedicated constant test adds no coverage.

**Recommendation:** Remove the tautological constant assertion test. Keep the behavioral test that already validates the constant's value through actual usage.

**Risk:** None.

---

### 7. Redundancy: `evaluateAllConditions` null/undefined tests overlap

**File:** `bin/continuous-verify.test.cjs` (lines 182-191)

Two separate tests verify `evaluateAllConditions` with `null` and `undefined`. Both exercise the same guard (`!conditions || !Array.isArray(conditions) || conditions.length === 0`). One test with a parameterized input would suffice.

**Recommendation:** Merge into a single test with multiple assertions, or keep one and remove the other. Minor -- test bloat, not a bug.

**Risk:** None.

---

## No Issues Found

- **Fail-open pattern:** Consistently applied across all new code. Every try/catch exits 0 or returns a safe default.
- **Hook stdout discipline:** No debug output to stdout; all diagnostics go to stderr.
- **CommonJS compliance:** All new files use `require`/`module.exports` as required.
- **Test coverage:** Both new bin scripts have thorough test suites covering happy path, edge cases, and fail-open behavior.
- **Config integration:** `continuous_verify_enabled` follows the flat-key pattern and is correctly consumed.

---

## Action Priority

| # | Finding | LOC Impact | Priority |
|---|---------|-----------|----------|
| 1 | Dead unreachable undefined checks in config-loader | ~30 lines | Medium |
| 2 | Redundant smart_compact threshold keys | ~15 lines | Medium |
| 3 | Double timeout fallback | ~3 lines | Low |
| 4 | Inline loadContinuousVerify vs top-level | ~3 lines | Low |
| 5 | Repeated `(files \|\| [])` | ~2 lines | Low |
| 6 | Tautological constant test | ~3 lines | Low |
| 7 | Overlapping null/undefined tests | ~5 lines | Low |

**Total removable lines:** ~61
