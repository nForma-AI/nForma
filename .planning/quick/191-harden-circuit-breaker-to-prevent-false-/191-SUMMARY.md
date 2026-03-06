---
phase: quick-191
status: complete
date: 2026-03-06
---

# Quick Task 191: Harden circuit breaker to prevent false positives on monotonic workflow progression

## What changed

### `hooks/nf-circuit-breaker.js` — `hasReversionInHashes` function

Added `hasNegativePair` boolean tracking to the reversion check. The return condition changed from:

```js
return totalNetChange <= 0;
```

to:

```js
return totalNetChange <= 0 && hasNegativePair;
```

This requires at least one diff pair to show net content removal before classifying a pattern as oscillation. Pure zero-net substitutions (e.g., template → TBD → real data) are no longer misclassified as oscillation.

### `hooks/nf-circuit-breaker.test.js`

- **CB-TC23**: Reproduces the VALIDATION.md false-positive scenario (template → linter substitution → population). Confirms monotonic substitution workflows do NOT trigger the breaker.
- **CB-TC24**: Confirms true oscillation with content reversions (line additions followed by removals) STILL triggers correctly.
- Updated `createAlternatingCommits` helper to produce content with line-count oscillation (1 line ↔ 2 lines) for realistic true-oscillation simulation.
- Updated CB-TC18 and CB-TC21 to use content with actual line-count reversions.

### Sync & install

- `hooks/dist/` synced from source
- `node bin/install.js --claude --global` deployed fix to `~/.claude/hooks/`

## Test results

27/27 tests pass (0 regressions, 2 new tests).

## Root cause

The circuit breaker's `hasReversionInHashes` used `totalNetChange <= 0` as the sole oscillation signal. Monotonic workflow progression with substitutions (replacing placeholders with values) produces `net ≈ 0` per pair, which was indistinguishable from true oscillation. The fix adds a second condition: at least one pair must show actual content removal (`additions - deletions < 0`).
