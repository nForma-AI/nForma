# Formal Model Audit Report

**Date:** 2026-03-07
**Scope:** All TLA+ specs (33, excluding TTrace files) and all Alloy models (61)
**Total models audited:** 94

## Summary Table

| # | File | Category | Severity | Description | Fix Status |
|---|------|----------|----------|-------------|------------|
| 1 | install-scope.als:62-65 | A | Critical | `InstallIdempotent` is tautology: `SameState[s1,s2] => SameState[s1,s2]` (P => P) | Fixed in Task 2 |
| 2 | scoreboard-recompute.als:53-56 | A | Critical | `RecomputeIdempotent` is tautology: `computeScore[m,rounds] = computeScore[m,rounds]` (x = x) | Fixed in Task 2 |
| 3 | scoreboard-recompute.als:61-73 | A | Moderate | `NoVoteLoss` and `NoDoubleCounting` have identical assertion bodies | Fixed in Task 2 |
| 4 | baseline-merge-idempotent.als:46-55 | A | Low | `MergeIsIdempotent` asserts `DoubleMerge.reqs = AfterMerge.reqs` but this is already forced by the `DoubleIsIdempotent` fact on line 47 — the assertion is trivially true due to the fact | Documented (not a real tautology — the fact establishes the model constraint; the assertion verifies it holds under all instances) |
| 5 | QGSDSessionPersistence.tla:44 | B | Moderate | `idCounter \in Nat` is unbounded in TypeOK; TLC must enumerate Nat values | Fixed in Task 2 |
| 6 | QGSDSessionPersistence.tla:46 | B | Moderate | `persistedCounter \in Nat` is unbounded in TypeOK | Fixed in Task 2 |
| 7 | QGSDQuorum_xstate.tla:32-37 | B | Low | 6 variables use `\in Nat` with FIXME comments acknowledging unbounded domains | Documented — auto-generated from XState; should be tightened in next xstate-to-tla generation |
| 8 | QGSDStopHook.tla:30 | B | Low | `MaxTurnLines=500` is declared as CONSTANT but never referenced in any variable domain or guard — dead constant | Documented — code quality only, no state space impact |
| 9 | install-scope.als:73-75,128-129 | C | Moderate | All `check` commands use overall scope `for 5`; should use per-sig scopes for adequate coverage | Fixed in Task 2 |
| 10 | install-scope.als:116-119 | C | Moderate | `RollbackSoundCheck` uses existential — only checks empty snapshot exists in universe, not that uninstall produces it | Fixed in Task 2 |
| 11 | install-scope.als:123-125 | C | Moderate | `ConfigSyncCompleteCheck` asserts ALL pairs have equal files — vacuously true with 1 snapshot or trivially false with 2 distinct | Fixed in Task 2 |
| 12 | install-scope.als:59-65 | F | Critical | Alloy has no operation predicates — idempotency ("apply twice = once") cannot be expressed without pre/post state transition modeling | Fixed in Task 2 (InstallOp predicate added) |
| 13 | scoreboard-recompute.als:49-56 | F | Critical | Pure function idempotency `f(x) = f(x)` is definitional in Alloy — not a verifiable property | Fixed in Task 2 (assertion removed, gap documented) |
| 14 | scoreboard-recompute.als:82 | E | Low | `7 Int` gives range -64..63; max possible score = 5 rounds * 7 (TNplus) = 35, fits but fragile if rounds increase | Documented — adequate for current scope (5 rounds) |

## Category A: Trivially True Assertions (Tautologies)

### Finding 1: install-scope.als — InstallIdempotent (CRITICAL)

**File:** `.planning/formal/alloy/install-scope.als`, lines 62-65
**Assertion:**
```alloy
assert InstallIdempotent {
    all s1, s2: InstallState |
        SameState[s1, s2] => SameState[s1, s2]
}
```

This is a pure tautology (P => P). The assertion name claims to verify idempotency but verifies nothing. Compare with the correct pattern in `QGSDInstallerIdempotency.tla` where `IdempotentHooks` checks `installCount > 0 => hooksInstalled = TRUE` — a real property relating install actions to post-conditions.

**Root cause:** Alloy's purely relational structure makes temporal idempotency (apply-twice-equals-once) non-trivial to express. The author fell into the trap of using the same predicate on both sides of the implication.

**Fix:** Add `InstallOp` predicate modeling pre->post state transition, rewrite assertion to verify `InstallOp[pre,mid] /\ InstallOp[mid,post] => SameState[mid,post]`. Applied in Task 2.

### Finding 2: scoreboard-recompute.als — RecomputeIdempotent (CRITICAL)

**File:** `.planning/formal/alloy/scoreboard-recompute.als`, lines 53-56
**Assertion:**
```alloy
assert RecomputeIdempotent {
    all m: Model, rounds: set Round |
        computeScore[m, rounds] = computeScore[m, rounds]
}
```

This is identity comparison (x = x). `computeScore` is a pure function — `f(x) = f(x)` is definitional in any language. The `check RecomputeIdempotent` on line 82 will always pass, giving false confidence.

**Fix:** Remove assertion and check command entirely. Document the expressiveness gap. Applied in Task 2.

### Finding 3: scoreboard-recompute.als — Duplicate NoVoteLoss/NoDoubleCounting (MODERATE)

**File:** `.planning/formal/alloy/scoreboard-recompute.als`, lines 61-73
Both `NoVoteLoss` and `NoDoubleCounting` have identical bodies:
```alloy
computeScore[m, rounds] = (sum r: rounds | scoreDelta[r.votes[m]])
```

One assertion is redundant. They claim to verify distinct properties (all votes counted vs. no vote counted twice) but the assertion body is the same.

**Fix:** Differentiate `NoDoubleCounting` to verify set-subtraction additivity: removing any single round reduces the score by exactly that round's delta. Applied in Task 2.

### Finding 4: baseline-merge-idempotent.als — MergeIsIdempotent (LOW)

**File:** `.planning/formal/alloy/baseline-merge-idempotent.als`, lines 46-55
The `DoubleIsIdempotent` fact (line 47) forces `DoubleMerge.reqs = AfterMerge.reqs`, and then the `MergeIsIdempotent` assertion (line 53) checks the same equality. The assertion is trivially true because the fact already constrains it.

**Assessment:** While technically a tautology within the model (assertion restates fact), this pattern is defensible in Alloy — the fact establishes the model constraint, and the assertion documents it for `check` to verify no other facts contradict it. Severity is low because the assertion is not misleading about what it verifies. No fix applied.

## Category B: State Space Explosion Risks

### Finding 5: QGSDSessionPersistence.tla — Unbounded idCounter (MODERATE)

**File:** `.planning/formal/tla/QGSDSessionPersistence.tla`, line 44
```tla
idCounter \in Nat
```

`CreateSession` increments `idCounter` without bound. Although the cfg constants (MaxSessions=3, MaxRestarts=2) limit reachable states, TLC must enumerate Nat values for TypeOK verification, creating potential state space explosion.

**Fix:** Bound to `0..MaxCounter` where `MaxCounter == MaxSessions * (MaxRestarts + 1) + 1 = 10`. Applied in Task 2.

### Finding 6: QGSDSessionPersistence.tla — Unbounded persistedCounter (MODERATE)

**File:** `.planning/formal/tla/QGSDSessionPersistence.tla`, line 46
Same issue as Finding 5 for `persistedCounter`.

**Fix:** Bound to `0..MaxCounter`. Applied in Task 2.

### Finding 7: QGSDQuorum_xstate.tla — 6 Unbounded Variables (LOW)

**File:** `.planning/formal/tla/QGSDQuorum_xstate.tla`, lines 32-37
```tla
/\ slotsAvailable \in Nat     \* FIXME: tighten bound if needed
/\ successCount \in Nat        \* FIXME: tighten bound if needed
/\ deliberationRounds \in Nat  \* FIXME: tighten bound if needed
/\ maxDeliberation \in Nat     \* FIXME: tighten bound if needed
/\ maxSize \in Nat             \* FIXME: tighten bound if needed
/\ polledCount \in Nat         \* FIXME: tighten bound if needed
```

All have FIXME comments acknowledging the issue. This file is auto-generated from XState machine definitions. The fix belongs in the xstate-to-tla generator, not manual editing.

**Recommendation:** Next xstate-to-tla generation should derive bounds from CONSTANTS (e.g., `slotsAvailable \in 0..MaxSlots`).

### Finding 8: QGSDStopHook.tla — Dead Constant MaxTurnLines (LOW)

**File:** `.planning/formal/tla/QGSDStopHook.tla`, line 30
`MaxTurnLines` (value 500 in cfg) is declared as a CONSTANT but never referenced in any variable domain, guard, or invariant. It is a dead constant — misleading but not a state space issue since TLC never needs to enumerate its values.

**Recommendation:** Either remove the constant or add a guard condition using it (e.g., bounding a transcript length variable).

## Category C: Alloy Scope Issues

### Finding 9: install-scope.als — Overall Scope in Check Commands (MODERATE)

**File:** `.planning/formal/alloy/install-scope.als`, lines 73-75, 128-129
```alloy
check NoConflict for 5
check AllEquivalence for 5
check InstallIdempotent for 5
check RollbackSoundCheck for 5
check ConfigSyncCompleteCheck for 5
```

Using overall scope `for 5` means at most 5 atoms total shared across ALL sigs (`InstallState`, `Runtime`, `Scope`, `FileToken`, `InstallSnapshot`). With `Runtime(3)` + `Scope(3)` already consuming 6 atoms (but these are `one sig` so exactly 1 each), the scope limits `InstallState` and `InstallSnapshot` exploration.

**Fix:** Use per-sig scopes: `for 5 InstallState, 3 Runtime, 3 Scope`. Applied in Task 2.

### Finding 10: install-scope.als — RollbackSoundCheck Existential (MODERATE)

**File:** `.planning/formal/alloy/install-scope.als`, lines 116-119
```alloy
assert RollbackSoundCheck {
    all pre: InstallSnapshot | some pre.files =>
        (some post: InstallSnapshot | no post.files)
}
```

This only checks that an `InstallSnapshot` with no files exists *somewhere in the universe*. It does not verify that uninstall (as an operation on `pre`) *produces* a post-state with no files. If the scope contains at least one empty snapshot atom, this passes regardless of any operational semantics.

**Fix:** Add `RollbackOp` predicate and rewrite assertion to verify operational post-condition. Applied in Task 2.

### Finding 11: install-scope.als — ConfigSyncCompleteCheck Universal (MODERATE)

**File:** `.planning/formal/alloy/install-scope.als`, lines 123-125
```alloy
assert ConfigSyncCompleteCheck {
    all dist, claude: InstallSnapshot | ConfigSyncComplete[dist, claude]
}
```

This asserts ALL pairs of `InstallSnapshot` have equal file sets. With scope > 1 snapshot, any two distinct snapshots will have different files, making this trivially false. The assertion is broken — it should scope to pairs related by a sync operation.

**Fix:** Add `SyncOp` predicate and rewrite assertion to verify operation-scoped post-condition. Applied in Task 2.

## Category D: Missing Inductive Patterns

The reference pattern for bounded induction is `QGSDInstallerIdempotency.tla`:
- Bounded `installCount \in 0..MaxInstalls` (checked for N=3)
- Invariants are inductive: `installCount > 0 => hooksInstalled = TRUE` holds for Init and is preserved by every Next step
- The bound is sufficient because `MaxInstalls` limits the `Install` action's enabling condition

**Models following this pattern correctly:**
- `QGSDInstallerIdempotency.tla` — reference model, bounded `installCount`
- Most handwritten TLA+ specs — use CONSTANTS for loop bounds with cfg setting small values

**Models NOT following this pattern:**
- `QGSDSessionPersistence.tla` — unbounded counters (Findings 5-6, fixed in Task 2)
- `QGSDQuorum_xstate.tla` — auto-generated, 6 unbounded variables (Finding 7, deferred to generator fix)

**Recommendation:** All future TLA+ specs should follow the installer pattern: derive variable bounds from CONSTANTS, verify bounds as explicit invariants.

## Category E: Integer Overflow Risks (Alloy)

### Finding 14: scoreboard-recompute.als — Integer Bitwidth (LOW)

**File:** `.planning/formal/alloy/scoreboard-recompute.als`, line 82
```alloy
check RecomputeIdempotent for 5 Round, 5 Model, 7 VoteCode, 7 Int
```

`7 Int` gives range -64..63 (7-bit two's complement). Maximum possible score: 5 rounds * 7 (TNplus) = 35, which fits. Minimum possible score: 5 * -3 (FP) = -15, which fits. Current scope is adequate.

**Risk:** If round count increases beyond 9 (9 * 7 = 63), integer overflow would silently wrap, causing false counterexamples or missed bugs. The `7 Int` should be documented as requiring review if round scope increases.

**No other Alloy models use Int in ways that risk overflow.** The `transcript-scan.als` uses `4 Int` (-8..7) which is adequate for its count-based assertions.

## Category F: Temporal Idempotency Expressiveness Gap

### Finding 12: install-scope.als — Alloy Cannot Express Temporal Idempotency (CRITICAL)

**File:** `.planning/formal/alloy/install-scope.als`, lines 59-65

Alloy is a purely relational, non-temporal language. It models static snapshots of structures, not sequences of operations. The concept of idempotency ("apply operation twice, get same result") is inherently temporal — it requires:
1. A pre-state
2. Applying an operation to get a mid-state
3. Applying the same operation again to get a post-state
4. Verifying mid-state = post-state

Without an operation predicate, Alloy cannot distinguish "same state because of idempotent operation" from "same state by coincidence." The original `InstallIdempotent` assertion `SameState[s1,s2] => SameState[s1,s2]` fell into this trap — it has no operation concept at all.

**The correct location for temporal idempotency verification is TLA+.** `QGSDInstallerIdempotency.tla` demonstrates this: it models an `Install` action with pre/post state transition and verifies `installCount > 0 => hooksInstalled = TRUE` — a real temporal property.

**Fix applied in Task 2:** Added `InstallOp` predicate to install-scope.als, enabling Alloy to express idempotency via relational pre/post pairs. While this is not true temporal logic, it captures the essential structure (pre -> mid -> post with same operation).

### Finding 13: scoreboard-recompute.als — Pure Function Idempotency is Definitional (CRITICAL)

**File:** `.planning/formal/alloy/scoreboard-recompute.als`, lines 49-56

`computeScore` is defined as a pure function (`fun`). In Alloy, functions are deterministic by construction — `f(x) = f(x)` is a language-level tautology, not a verifiable property. The `RecomputeIdempotent` assertion does not test anything about the scoreboard recomputation algorithm's correctness.

The actual idempotency property ("calling `recomputeStats()` twice yields same result") is verified by the JavaScript test suite (`bin/update-scoreboard.test.cjs`), which tests the real mutable implementation.

**Fix applied in Task 2:** Assertion removed entirely. Comment block documents the expressiveness gap and points to the JS tests for actual idempotency verification.

## Statistics

| Metric | Count |
|--------|-------|
| Total models audited | 94 (61 Alloy + 33 TLA+) |
| Total findings | 14 |
| Critical findings | 4 (Findings 1, 2, 12, 13) |
| Moderate findings | 5 (Findings 3, 5, 6, 9, 10, 11) |
| Low findings | 4 (Findings 4, 7, 8, 14) |
| Fixes applied in Task 2 | 9 (Findings 1, 2, 3, 5, 6, 9, 10, 11, 12, 13) |
| Documented only (no fix) | 5 (Findings 4, 7, 8, 14) |
| Files modified | 4 (install-scope.als, scoreboard-recompute.als, QGSDSessionPersistence.tla, MCSessionPersistence.cfg) |

## Models with No Findings

The remaining 88 models (57 Alloy + 31 TLA+) were audited and found to have:
- No tautological assertions
- No unbounded state variables (in handwritten specs)
- Adequate Alloy scopes for their signature hierarchies
- No integer overflow risks

Notable well-structured models:
- `QGSDInstallerIdempotency.tla` — reference pattern for bounded induction
- `account-pool-structure.als` — proper per-sig scopes, meaningful operation predicates
- `traceability-annotations.als` — per-sig scopes with adequate coverage
- `evidence-triage.als` — per-sig scopes with tight bounds
