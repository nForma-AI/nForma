---
phase: quick-204
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/alloy/install-scope.als
  - .planning/formal/alloy/scoreboard-recompute.als
  - .planning/formal/tla/QGSDSessionPersistence.tla
  - .planning/formal/tla/MCSessionPersistence.cfg
  - .planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md
autonomous: true
formal_artifacts: update
requirements: []

must_haves:
  truths:
    - "Every assertion in every Alloy model verifies a non-trivial property (no tautologies kept as assertions)"
    - "Every TLA+ variable used in TypeOK has a bounded domain for TLC model checking"
    - "Alloy check commands use per-sig scopes that adequately cover the signature hierarchy"
    - "All findings are documented in a formal-model-audit.md report with severity and fix status"
    - "MCSessionPersistence.cfg includes CounterBounded invariant to validate derived bound across all reachable states"
  artifacts:
    - path: ".planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md"
      provides: "Comprehensive audit report of all formal models"
      min_lines: 80
    - path: ".planning/formal/alloy/install-scope.als"
      provides: "Temporal idempotency gap documented, RollbackSoundCheck/ConfigSyncCompleteCheck with concrete assertion bodies"
      contains: "RollbackSoundCheck"
    - path: ".planning/formal/alloy/scoreboard-recompute.als"
      provides: "RecomputeIdempotent removed (not kept as tautological assertion), NoDoubleCounting differentiated from NoVoteLoss"
      contains: "NoDoubleCounting"
    - path: ".planning/formal/tla/QGSDSessionPersistence.tla"
      provides: "Bounded idCounter and persistedCounter in TypeOK, CounterBounded invariant"
      contains: "MaxCounter"
    - path: ".planning/formal/tla/MCSessionPersistence.cfg"
      provides: "CounterBounded invariant line for TLC checking"
      contains: "CounterBounded"
  key_links:
    - from: ".planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md"
      to: ".planning/formal/alloy/install-scope.als"
      via: "Documents findings and fixes applied"
      pattern: "install-scope"
    - from: ".planning/formal/tla/QGSDSessionPersistence.tla"
      to: ".planning/formal/tla/MCSessionPersistence.cfg"
      via: "TLA+ spec defines MaxCounter and CounterBounded; cfg must declare CounterBounded as INVARIANT"
      pattern: "CounterBounded"
---

<objective>
Audit all TLA+ and Alloy formal models for state space explosion risks, trivially true assertions, and missing inductive property patterns. Fix all issues found and document findings in a comprehensive report.

Purpose: The mcinstaller fix (QGSDInstallerIdempotency.tla with bounded MaxInstalls) demonstrated how unbounded variables and tautological assertions can hide real bugs. This audit applies those lessons across all 15+ TLA+ specs and 50+ Alloy models.

Output: Fixed model files + formal-model-audit.md report documenting all findings.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/formal/tla/QGSDInstallerIdempotency.tla
@.planning/formal/tla/MCinstaller.cfg
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit all formal models and produce findings report</name>
  <files>
    .planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md
  </files>
  <action>
Systematically audit every TLA+ spec (.planning/formal/tla/*.tla, excluding *_TTrace_* files) and every Alloy model (.planning/formal/alloy/*.als) for the following categories of defects:

**Category A: Trivially True Assertions (tautologies)**
Check every `assert` block in Alloy and every named invariant/property in TLA+ for logical tautologies where the conclusion is identical to or implied by the premise. Known findings to document:

1. `install-scope.als` line 62-65: `InstallIdempotent` asserts `SameState[s1,s2] => SameState[s1,s2]` -- pure tautology (P => P). The assertion name claims to verify idempotency but verifies nothing. Compare with the correct pattern in QGSDInstallerIdempotency.tla where IdempotentHooks checks `installCount > 0 => hooksInstalled = TRUE`.

2. `scoreboard-recompute.als` line 53-56: `RecomputeIdempotent` asserts `computeScore[m,rounds] = computeScore[m,rounds]` -- identity comparison (x = x). Claims to verify deterministic recomputation but is trivially true for any function.

3. `scoreboard-recompute.als` lines 59-65 vs 68-73: `NoVoteLoss` and `NoDoubleCounting` have identical assertion bodies (`computeScore[m,rounds] = (sum r: rounds | scoreDelta[r.votes[m]])`). One assertion is redundant -- they should verify distinct properties.

**Category B: State Space Explosion Risks**
Check every TLA+ TypeOK for unbounded domains (`\in Nat`, `\in Int`, sequences without length bounds). Known findings:

1. `QGSDSessionPersistence.tla` line 44: `idCounter \in Nat` is unbounded. CreateSession increments idCounter without bound. Although the cfg constants (MaxSessions=3, MaxRestarts=2) limit reachable states, TLC must enumerate Nat values for TypeOK verification, creating potential state space explosion. Should be bounded to `0..MaxCounter` where MaxCounter = MaxSessions * (MaxRestarts + 1) + 1.

2. `QGSDSessionPersistence.tla` line 46: `persistedCounter \in Nat` -- same issue.

3. `QGSDStopHook.tla`: MaxTurnLines=500 is declared as a CONSTANT but never referenced in any variable domain or guard -- dead constant, misleading but not a state space issue. Document as a code quality finding.

**Category C: Alloy Scope Issues**
Check every `check ... for N` command for scope adequacy. Known findings:

1. `install-scope.als` lines 73-78: `check ... for 5` uses overall scope. With Runtime(3) + Scope(3) + FileToken + InstallSnapshot sigs, the `for 5` means at most 5 atoms total shared across ALL sigs, which may not explore enough InstallState or InstallSnapshot combinations. Should use per-sig scopes like `for 5 InstallState, 3 Runtime, 3 Scope, 3 FileToken, 3 InstallSnapshot`.

2. `install-scope.als` line 116-119: `RollbackSoundCheck` asserts that for any pre with files, there exists a post with no files. This is trivially satisfiable if the scope allows at least one empty InstallSnapshot atom -- it does not actually verify that uninstall produces the empty state, only that an empty state exists somewhere in the universe.

3. `install-scope.als` line 123-125: `ConfigSyncCompleteCheck` asserts ALL pairs of InstallSnapshot have equal files. This is either vacuously true (1 snapshot in scope) or trivially false (any 2 distinct snapshots). The assertion is broken -- it should check a pre/post pair related by an operation.

**Category D: Missing Inductive Patterns**
Scan for models where bounded induction could simplify or strengthen verification. The installer model's pattern (check for N=3, inductive for all N) should be documented as the reference pattern.

**Category E: Integer Overflow Risks (Alloy)**
Check Alloy models using Int for potential overflow. `scoreboard-recompute.als` uses `7 Int` (range -64..63) with max possible score of 5*7=35, which fits but is fragile.

**Category F: Temporal Idempotency Expressiveness Gap**
Document which models attempt to verify idempotency in Alloy (a purely relational, non-temporal language) vs TLA+ (which can model pre/post temporal operations). Specifically:
- `install-scope.als` `InstallIdempotent`: Alloy's relational structure cannot express "apply operation twice, get same result" because there is no operation predicate -- only static snapshots. The TLA+ spec `QGSDInstallerIdempotency.tla` is the correct place for temporal idempotency verification.
- `scoreboard-recompute.als` `RecomputeIdempotent`: Alloy pure functions are trivially idempotent by language semantics -- `f(x) = f(x)` is definitional, not verifiable.

For EACH finding, document:
- File path and line number(s)
- Category (A/B/C/D/E/F)
- Severity (critical/moderate/low)
- Description of the defect
- Fix applied or recommended
- Whether the fix was applied in Task 2

Scan ALL .als and .tla files systematically -- do not stop at the known findings above. There may be additional tautologies or scope issues in the other ~50 Alloy models.

Write the report to `.planning/quick/204-audit-formal-models-for-state-space-expl/formal-model-audit.md` with sections for each category, a summary table of all findings, and a statistics section showing total models audited vs findings count.
  </action>
  <verify>
    The report file exists and contains:
    - `grep -c 'Category' formal-model-audit.md` shows at least 6 category references (A through F)
    - `grep -c 'Severity' formal-model-audit.md` shows findings with severity ratings
    - Every known finding listed above appears in the report
    - Summary statistics section exists
    - Category F section documents the Alloy temporal expressiveness gap
  </verify>
  <done>
    formal-model-audit.md contains a complete audit of all TLA+ and Alloy models with categorized findings, severity ratings, and fix recommendations. All findings reference specific file paths and line numbers. Category F explicitly documents which idempotency assertions belong in TLA+ (temporal) vs Alloy (relational).
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix critical and moderate defects in formal models</name>
  <files>
    .planning/formal/alloy/install-scope.als
    .planning/formal/alloy/scoreboard-recompute.als
    .planning/formal/tla/QGSDSessionPersistence.tla
    .planning/formal/tla/MCSessionPersistence.cfg
  </files>
  <action>
Apply fixes to the models with critical/moderate defects. Each fix must preserve existing requirement annotations (@requirement tags) and file header comments.

**Fix 1: install-scope.als -- InstallIdempotent tautology (CRITICAL)**

The current `InstallIdempotent` assertion (line 62-65) is `SameState[s1,s2] => SameState[s1,s2]` -- a pure tautology. The fundamental problem is that install-scope.als has no operation predicate modeling a temporal install action (pre-state -> post-state). Without an operation predicate, true idempotency ("apply operation twice, get same result") cannot be expressed in Alloy's purely relational structure.

The fix has two parts:

(a) **Add an `InstallOp` predicate** that models the install operation as a pre->post state transition, then verify idempotency as "applying InstallOp twice yields same result as applying once":

```alloy
-- InstallOp: models applying install with a target scope to a pre-state, producing a post-state.
-- Each runtime in the target set gets assigned the given scope; others are unchanged.
pred InstallOp [pre, post: InstallState, targets: set Runtime, sc: Scope] {
    -- Targeted runtimes get the new scope
    all r: targets | r.(post.assigned) = sc
    -- Non-targeted runtimes keep their pre-state scope
    all r: Runtime - targets | r.(post.assigned) = r.(pre.assigned)
}

-- InstallIdempotent: applying the same install operation twice yields the same result as once.
-- If pre->mid via InstallOp and mid->post via same InstallOp, then post = mid.
-- @requirement INST-03
assert InstallIdempotent {
    all pre, mid, post: InstallState, targets: set Runtime, sc: Scope |
        (InstallOp[pre, mid, targets, sc] and InstallOp[mid, post, targets, sc])
        implies SameState[mid, post]
}
```

This is NOT a tautology because InstallOp constrains the relationship between states -- two applications of the same operation on different pre-states could theoretically produce different results if the predicate had side-channel dependencies.

(b) **Fix RollbackSoundCheck with concrete assertion body.** The current assertion uses an existential (`some post: InstallSnapshot | no post.files`) which only checks that an empty snapshot exists in the universe, not that uninstall produces it. Add a `RollbackOp` predicate and rewrite the assertion:

```alloy
-- RollbackOp: models uninstall removing all GSD file tokens from a snapshot
pred RollbackOp [pre, post: InstallSnapshot] {
    -- After rollback, post contains no GSD files (all removed)
    no post.files
    -- pre must have had some files to roll back
    some pre.files
}

-- RollbackSoundCheck: for every pre-state with files, applying RollbackOp produces
-- a post-state with no files. This is universally quantified over ALL valid pre/post pairs.
-- @requirement INST-04
assert RollbackSoundCheck {
    all pre, post: InstallSnapshot |
        RollbackOp[pre, post] implies no post.files
}
```

(c) **Fix ConfigSyncCompleteCheck with concrete assertion body.** The current assertion checks ALL pairs which is broken. Scope it to pairs related by a sync operation:

```alloy
-- SyncOp: models the install sync step that copies files from dist to claude hooks dir
pred SyncOp [dist, claude: InstallSnapshot] {
    -- After sync, claude hooks dir has exactly the same files as dist
    claude.files = dist.files
}

-- ConfigSyncCompleteCheck: after a SyncOp, the two snapshots have identical file sets.
-- @requirement INST-05
assert ConfigSyncCompleteCheck {
    all dist, claude: InstallSnapshot |
        SyncOp[dist, claude] implies ConfigSyncComplete[dist, claude]
}
```

(d) **Update all check commands to use per-sig scopes:**
```alloy
check NoConflict         for 5 InstallState, 3 Runtime, 3 Scope
check AllEquivalence     for 5 InstallState, 3 Runtime, 3 Scope
check InstallIdempotent  for 5 InstallState, 3 Runtime, 3 Scope
check RollbackSoundCheck      for 3 InstallSnapshot, 3 FileToken
check ConfigSyncCompleteCheck for 3 InstallSnapshot, 3 FileToken
```

**Fix 2: scoreboard-recompute.als -- RecomputeIdempotent tautology + duplicate assertion (CRITICAL)**

The `RecomputeIdempotent` assertion (`computeScore[m,rounds] = computeScore[m,rounds]`) is a tautology. Since Alloy pure functions are trivially idempotent by language semantics, keeping it as a "documentation assertion" still gives false confidence to `check` output -- a passing `check RecomputeIdempotent` looks like verification of a real property when it verifies nothing. **Remove the assertion entirely** and replace with a comment block documenting the gap:

```alloy
-- NOTE: RecomputeIdempotent assertion REMOVED (was SCBD-01).
-- Alloy pure functions are trivially idempotent by language semantics:
-- f(x) = f(x) is definitional, not a verifiable property.
-- True temporal idempotency (apply operation twice, get same result) requires
-- modeling a mutable state machine, which is done in TLA+ (see QGSDInstallerIdempotency.tla).
-- The scoreboard recompute operation's idempotency is verified by the JavaScript test suite
-- (bin/update-scoreboard.test.cjs) which tests recomputeStats() called twice yields same result.
-- @requirement SCBD-01 — verified via JS tests, not Alloy (expressiveness gap)
```

Remove the `check RecomputeIdempotent` command as well.

Differentiate `NoVoteLoss` from `NoDoubleCounting` -- currently they have identical bodies. Fix `NoDoubleCounting` to verify subset-monotonicity (adding rounds can only increase or match the score when deltas are non-negative, and removing a round reduces by exactly that round's delta):

```alloy
-- NoDoubleCounting: removing any single round from the set reduces the score
-- by exactly that round's delta. This verifies additivity/linearity: no round's
-- contribution is counted more than once or less than once.
-- @requirement SCBD-03
assert NoDoubleCounting {
    all m: Model, rs: set Round, r: rs |
        some r.votes[m] implies
        computeScore[m, rs] = plus[computeScore[m, rs - r], scoreDelta[r.votes[m]]]
}
```

This is NOT a tautology because it asserts a structural property about `computeScore`'s decomposition that Alloy must verify holds for the `sum` reduction -- specifically that `sum` over a set equals `sum` over (set minus element) plus the element's value.

**Fix 3: QGSDSessionPersistence.tla -- unbounded idCounter (MODERATE)**

Add a `MaxCounter` derived operator and bound both counters. Also add an explicit `CounterBounded` invariant for TLC to check that the derived bound holds across all reachable states:

1. Add `MaxCounter` as a derived operator (NOT a CONSTANT -- it is computed from existing constants):
```tla
MaxCounter == MaxSessions * (MaxRestarts + 1) + 1
```

2. Update TypeOK to bound both counters:
```tla
/\ idCounter \in 0..MaxCounter
/\ persistedCounter \in 0..MaxCounter
```

3. Add an explicit `CounterBounded` invariant for TLC to verify the derived bound holds:
```tla
(* CounterBounded: explicit check that idCounter never exceeds MaxCounter.
   While TypeOK includes 0..MaxCounter, this standalone invariant makes the
   bound visible in TLC output and catches any off-by-one in the derivation. *)
CounterBounded ==
  /\ idCounter <= MaxCounter
  /\ persistedCounter <= MaxCounter
```

4. **Update MCSessionPersistence.cfg** to add the CounterBounded invariant:
Add this line after the existing INVARIANT lines:
```
INVARIANT CounterBounded
```

This ensures TLC explicitly validates that the derived bound `MaxCounter = MaxSessions * (MaxRestarts + 1) + 1` (= 10 for MaxSessions=3, MaxRestarts=2) holds across ALL reachable states, catching any off-by-one errors in the derivation.

5. Verify the bound is sufficient: MaxSessions=3, MaxRestarts=2 gives MaxCounter = 3*3+1 = 10. Each restart cycle can create up to MaxSessions new sessions, and there are MaxRestarts+1 total cycles (initial + restarts). The +1 accounts for the counter starting at 1 rather than 0.
  </action>
  <verify>
    Run these checks:
    1. `grep 'SameState\[s1, s2\] => SameState\[s1, s2\]' .planning/formal/alloy/install-scope.als` returns NO matches (tautology removed)
    2. `grep 'InstallOp' .planning/formal/alloy/install-scope.als` returns at least 3 matches (pred definition + assertion usage)
    3. `grep 'RollbackOp' .planning/formal/alloy/install-scope.als` returns at least 2 matches (pred + assertion)
    4. `grep 'SyncOp' .planning/formal/alloy/install-scope.als` returns at least 2 matches (pred + assertion)
    5. `grep 'computeScore\[m, rounds\] = computeScore\[m, rounds\]' .planning/formal/alloy/scoreboard-recompute.als` returns NO matches (tautology removed)
    6. `grep 'assert RecomputeIdempotent' .planning/formal/alloy/scoreboard-recompute.als` returns NO matches (assertion removed entirely, not kept as documentation assertion)
    7. `grep 'check RecomputeIdempotent' .planning/formal/alloy/scoreboard-recompute.als` returns NO matches (check command removed)
    8. `grep 'rs - r' .planning/formal/alloy/scoreboard-recompute.als` returns at least 1 match (NoDoubleCounting uses set subtraction)
    9. `grep 'MaxCounter' .planning/formal/tla/QGSDSessionPersistence.tla` returns at least 3 matches (definition + TypeOK usage + CounterBounded)
    10. `grep 'idCounter \\in Nat' .planning/formal/tla/QGSDSessionPersistence.tla` returns NO matches (unbounded removed)
    11. `grep 'CounterBounded' .planning/formal/tla/MCSessionPersistence.cfg` returns 1 match (invariant added to cfg)
    12. `grep 'CounterBounded' .planning/formal/tla/QGSDSessionPersistence.tla` returns at least 1 match (invariant defined in spec)
    13. All @requirement annotations are preserved in modified files
  </verify>
  <done>
    Four model files are fixed:
    - install-scope.als has InstallOp predicate enabling true temporal idempotency checking, concrete RollbackOp/SyncOp predicates for RollbackSoundCheck/ConfigSyncCompleteCheck, and per-sig scopes
    - scoreboard-recompute.als has RecomputeIdempotent assertion REMOVED (not kept as tautological documentation assertion), NoDoubleCounting differentiated via set-subtraction additivity property
    - QGSDSessionPersistence.tla has bounded counters via derived MaxCounter operator and explicit CounterBounded invariant
    - MCSessionPersistence.cfg includes INVARIANT CounterBounded to validate the derived bound across all reachable states
    All requirement annotations preserved.
  </done>
</task>

</tasks>

<verification>
1. formal-model-audit.md exists with categorized findings for all audited models (Categories A-F)
2. No tautological assertions remain as `assert` blocks in install-scope.als or scoreboard-recompute.als
3. install-scope.als has InstallOp, RollbackOp, and SyncOp predicates with concrete assertion bodies
4. scoreboard-recompute.als has RecomputeIdempotent fully removed (comment block only, no assert/check)
5. QGSDSessionPersistence.tla TypeOK uses bounded domains only (0..MaxCounter)
6. QGSDSessionPersistence.tla defines CounterBounded invariant
7. MCSessionPersistence.cfg includes INVARIANT CounterBounded
8. All @requirement annotations in modified files are preserved
9. All check commands in install-scope.als use per-sig scopes
</verification>

<success_criteria>
- Audit report covers all TLA+ specs (excluding TTrace files) and all Alloy models
- All critical findings (tautologies, unbounded state spaces) have fixes applied
- No tautological assertion is kept as a "documentation assertion" with `check` command -- tautologies are either replaced with real properties or removed entirely with comment documenting the gap
- Modified model files preserve existing requirement annotations
- Report documents which fixes were applied vs which are recommendations only
- MCSessionPersistence.cfg has CounterBounded invariant for TLC to validate derived bound
</success_criteria>

<output>
After completion, create `.planning/quick/204-audit-formal-models-for-state-space-expl/204-SUMMARY.md`
</output>
