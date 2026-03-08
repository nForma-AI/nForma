# Cleanup Report: v0.31-02 Runtime Safety Boundaries

Reviewed files:
- `hooks/nf-circuit-breaker.js`
- `hooks/dist/nf-circuit-breaker.js`
- `bin/call-quorum-slot.cjs`
- `bin/quorum-slot-dispatch.cjs`
- `bin/providers.json`
- `hooks/nf-prompt.js`
- `hooks/dist/nf-prompt.js`

Source/dist drift: none detected (both pairs are identical).

---

## Findings

### 1. `var` declarations leaking scope in nf-prompt.js — **medium**

`hooks/nf-prompt.js` lines 501, 553-555, 559-561 use `var` to hoist `_nfClassification`, `_nfCacheKey`, `_nfCacheModule`, and `_nfCacheDir` out of nested block scopes. This circumvents `'use strict'` block-scoping expectations. Refactor to declare these with `let` at the top of the outer function scope and assign inside the blocks.

### 2. Redundant alias `const MAX_RETRIES = maxRetries` in call-quorum-slot.cjs — **low**

`bin/call-quorum-slot.cjs` line 161: `retryWithBackoff` accepts `maxRetries` as a parameter then immediately aliases it to `const MAX_RETRIES`. One of these is unnecessary. Use the parameter name directly or rename the parameter to `MAX_RETRIES`.

### 3. Underscore-prefixed validation variables used immediately in nf-circuit-breaker.js — **low**

Lines 623-626: `_eventType` and `_validation` are declared with leading underscores (convention for unused variables) but are immediately used. Drop the underscores to match their actual usage.

### 4. Same pattern in nf-prompt.js — **low**

Lines 338-342: identical `_eventType`/`_validation` underscore-prefix pattern. Same fix: drop underscores.

### 5. Duplicated error-type classification logic — **medium**

`bin/call-quorum-slot.cjs` has error-type classification in two places: `writeFailureLog` (lines 99-108) and the catch block in `main` (lines 542-551). Both map the same string patterns to the same categories (`CLI_SYNTAX`, `TIMEOUT`, `AUTH`, `UNKNOWN`). Extract to a shared `classifyErrorType(msg)` function.

### 6. `typeof module !== 'undefined'` guard in quorum-slot-dispatch.cjs — **low**

Line 1051: This guard is unnecessary in a CommonJS `.cjs` file. `module` is always defined in Node CJS. The `require.main === module` guard on line 1069 is sufficient and correct. Replace with plain `module.exports = { ... }`.

### 7. Redundant `latency_budget_ms: null` across providers.json — **low**

`bin/providers.json`: 10 of 12 providers set `"latency_budget_ms": null`. The null value has no effect (the consumer already defaults to null via `?? null` on line 481 of call-quorum-slot.cjs). Remove the field from providers that do not use it; only keep it on `claude-5` and `claude-6` where it has a real value.

### 8. Double check of `latencyBudget` in call-quorum-slot.cjs — **low**

Lines 484-486 and 493-495: `latencyBudget !== null && latencyBudget > 0` is checked twice. The first branch sets `effectiveTimeout`, the second emits a stderr log. Combine into a single conditional block.

### 9. Duplicated `findProviders` function — **medium**

`hooks/nf-prompt.js` (lines 152-165) and `bin/call-quorum-slot.cjs` (lines 207-231) both implement `findProviders()` with slightly different search paths. The nf-prompt version omits the `~/.claude.json` MCP server derivation path. Extract to a shared utility or have nf-prompt require it from call-quorum-slot.cjs.

### 10. `console.error` used alongside `process.stderr.write` in nf-prompt.js — **low**

Lines 204, 259, 445, 572 use `console.error` while the rest of the hook consistently uses `process.stderr.write`. Mixing output methods can cause ordering issues in buffered environments. Standardize on `process.stderr.write`.

### 11. Dead `hookEvent` re-extraction in nf-circuit-breaker.js — **low**

Line 631: `const hookEvent = input.hook_event_name || input.hookEventName || 'PreToolUse'` duplicates the extraction already done on line 623 as `_eventType`. One variable is sufficient.

---

Total: 11 findings
