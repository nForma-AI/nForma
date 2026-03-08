# Cleanup Report: v0.30-01 Dynamic Model Selection

**Date:** 2026-03-07
**Reviewer:** Claude Opus 4.6
**Phase files reviewed:** 15

---

## Summary

The phase is well-structured with clean separation of concerns. Test coverage is thorough. Most findings are minor. Two items warrant attention: a dual-threshold config redundancy and `var` hoisting used for cross-scope communication in nf-prompt.js.

**Findings:** 8 items (1 medium, 7 low)

---

## Findings

### F-01 [MEDIUM] Redundant compact threshold config keys

**Files:** `hooks/config-loader.js` (L127, L155), `hooks/gsd-context-monitor.js` (L158)

Two separate config paths control the same behavior:
- `smart_compact.context_warn_pct` (default 60) -- defined in DEFAULT_CONFIG, validated in validateConfig
- `smart_compact_threshold_pct` (default 65) -- flat key added in this phase

The hook (`gsd-context-monitor.js` L158) reads only `smart_compact_threshold_pct`, making `smart_compact.context_warn_pct` dead config. The validation code for `context_warn_pct` (config-loader.js L393-403) runs but its output is never consumed by any hook.

**Recommendation:** Deprecate `smart_compact.context_warn_pct` with a comment, or remove its validation block and update DEFAULT_CONFIG to drop the key. The phase summary documents the intentional split ("separate from smart_compact.context_warn_pct to avoid breaking existing configs"), so this is by-design for backward compat -- but the validation code for the dead key is wasted work.

---

### F-02 [LOW] `var` hoisting for cross-block communication in nf-prompt.js

**File:** `hooks/nf-prompt.js` (L494, L546-548, L552-554)

`var _nfClassification`, `var _nfCacheKey`, `var _nfCacheModule`, `var _nfCacheDir` use `var` to hoist values out of nested blocks. This is intentional (the variables are set inside `if` blocks and consumed later), but it is the only place in the codebase using `var` -- all other code uses `const`/`let`.

**Recommendation:** Hoist the declarations to the top of the `activeSlots` branch as `let` variables initialized to `null`. This removes the implicit `var` hoisting without changing behavior.

---

### F-03 [LOW] Unused `agentConfig` parameter in computeBudgetStatus

**File:** `bin/budget-tracker.cjs` (L16, L19)

The third parameter `agentConfig` is accepted but never read. The JSDoc marks it as "reserved for sub exclusion." All callers pass `config.agent_config || {}`.

**Recommendation:** Keep the parameter for now (it is documented as reserved), but add an explicit `void agentConfig;` or `// eslint-disable-next-line no-unused-vars` to signal intent. Alternatively, remove it and add it back when the feature ships.

---

### F-04 [LOW] Unreachable undefined-fill guards after validation in config-loader.js

**File:** `hooks/config-loader.js` (L207-218, L302-308, L339-348, L372-380, L399-403)

Multiple validation blocks follow this pattern:
1. Validate field X -- if invalid, reset to default.
2. Then check `if (X === undefined)` and fill default.

Step 2 is unreachable when step 1 already handled the invalid case. For example, `circuit_breaker.oscillation_depth` is validated at L197-199 (reset to 3 if invalid), then L207 checks `if (oscillation_depth === undefined)` -- but the validation at L197 already catches `undefined` via `!Number.isInteger(undefined)`.

This pattern appears for: `circuit_breaker.*`, `context_monitor.*`, `budget.*`, `stall_detection.*`, `smart_compact.*`.

**Recommendation:** Remove the unreachable `=== undefined` fill blocks. They add ~40 lines of dead code to validateConfig.

---

### F-05 [LOW] `fs` import unused in task-classifier.cjs

**File:** `bin/task-classifier.cjs` (L3)

`const fs = require('fs')` is imported but only used inside `readTaskEnvelope`. The `path` module is also imported at top level but only used inside `readTaskEnvelope`. Both are fine for readability, but `fs` could be a lazy require inside `readTaskEnvelope` to match the pattern used elsewhere (e.g., the lazy `require` of task-classifier in nf-prompt.js L27).

**Recommendation:** No action needed -- this is standard Node.js style. Noted for completeness only.

---

### F-06 [LOW] Double `computeBudgetStatus` call in gsd-context-monitor.js cooldown path

**File:** `hooks/gsd-context-monitor.js` (L124, L135)

Line 124 calls `computeBudgetStatus(usedPct, config.budget, config.agent_config, cooldownStatus.active)`.
Line 135 calls `computeBudgetStatus(usedPct, config.budget, config.agent_config)` again (without cooldownActive) to check if a downgrade _would have_ fired.

The second call is only used to emit a conformance event. The result is discarded after the event write.

**Recommendation:** This is intentional (audit logging for suppressed downgrades). Could be simplified by checking `status.budgetUsedPct >= (config.budget.downgrade_pct || 85)` directly instead of re-calling the function, but the current approach is more readable.

---

### F-07 [LOW] `COST_PER_M` does not include `claude` tier breakdown

**File:** `bin/token-dashboard.cjs` (L13)

The `claude` entry uses a single rate ($15/$75 per M). This conflates Opus, Sonnet, and Haiku under one key. Since `slotFamily` strips `-N` suffixes, all `claude-1` through `claude-6` map to the same rate regardless of actual model.

**Recommendation:** Acceptable for an estimation dashboard. If per-model accuracy matters later, the token-usage.jsonl records could carry a `model` field and COST_PER_M could key on model ID.

---

### F-08 [LOW] `formatBudgetWarning` computes limit from percentages inline

**File:** `bin/budget-tracker.cjs` (L157)

The warning message reconstructs the token limit with:
```js
(status.budgetUsedPct > 0 ? Math.round(status.estimatedTokens * 100 / status.budgetUsedPct) : 0)
```

This reverse-engineers the limit from the percentage, but `computeBudgetStatus` already had access to `budgetConfig.session_limit_tokens`. The limit could be passed through in the status object to avoid the fragile reverse calculation.

**Recommendation:** Add `sessionLimit` to the status object returned by `computeBudgetStatus` and use it directly in `formatBudgetWarning`.

---

## No Issues Found

The following areas were reviewed and found clean:

- **hooks/dist/ sync**: All three modified hooks (config-loader.js, nf-prompt.js, gsd-context-monitor.js) are byte-identical between `hooks/` and `hooks/dist/`.
- **Test coverage**: task-classifier (17 tests), token-dashboard (12 tests), budget-tracker (16 tests), gsd-context-monitor (17 tests) -- all cover fail-open, boundary conditions, and config override paths.
- **commands/nf/tokens.md**: Clean, minimal, correctly documents CLI flags.
- **CommonJS style**: All files use `'use strict'` and `require`/`module.exports` per coding-style rules.
- **Security**: No secrets, no stdout debug output, all hooks fail-open with try/catch.
- **Dead exports**: All exported functions from new modules are consumed by at least one caller or test.
