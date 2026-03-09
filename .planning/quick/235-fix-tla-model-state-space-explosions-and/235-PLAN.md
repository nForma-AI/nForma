---
phase: quick-235
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/tla/QGSDSessionPersistence.tla
  - .planning/formal/tla/MCSessionPersistence.cfg
autonomous: true
formal_artifacts: none
requirements: [NAV-04]

must_haves:
  truths:
    - "QGSDSessionPersistence TLC model checking completes without state space explosion"
    - "All safety invariants (PersistenceIntegrity, CounterRestored, CounterBounded) still hold"
    - "Liveness property RestoreComplete_Prop still holds"
    - "State space is reduced by orders of magnitude from set-based to counter-based tracking"
  artifacts:
    - path: ".planning/formal/tla/QGSDSessionPersistence.tla"
      provides: "Counter-based session persistence model"
      contains: "activeCount"
    - path: ".planning/formal/tla/MCSessionPersistence.cfg"
      provides: "TLC config for counter-based model"
      contains: "MaxSessions"
  key_links:
    - from: ".planning/formal/tla/MCSessionPersistence.cfg"
      to: ".planning/formal/tla/QGSDSessionPersistence.tla"
      via: "SPECIFICATION Spec references the module"
      pattern: "SPECIFICATION Spec"
---

<objective>
Fix TLA+ QGSDSessionPersistence model state space explosion by converting set-based session tracking to counter-based tracking.

Purpose: The current model uses `activeSessions \subseteq 0..9` and `persistedSessions \subseteq 0..9`, each producing 2^10=1024 subsets. Combined with other variables this creates billions of reachable states, making TLC model checking impractical. Counter-based tracking (activeCount, persistedCount as bounded Nat) preserves all invariant semantics while shrinking the type space by ~16,000x.

Note: The NFQuorum cfg bugs (missing MaxSize, invalid MinQuorumMet invariant) mentioned in the original analysis have already been resolved — MCsafety.cfg and MCliveness.cfg both contain `MaxSize = 3` and correct invariants. This plan focuses solely on the SessionPersistence state space issue.

Output: Updated QGSDSessionPersistence.tla with counter-based model, updated MCSessionPersistence.cfg if needed.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/formal/tla/QGSDSessionPersistence.tla
@.planning/formal/tla/MCSessionPersistence.cfg
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert QGSDSessionPersistence from set-based to counter-based tracking</name>
  <files>
    .planning/formal/tla/QGSDSessionPersistence.tla
    .planning/formal/tla/MCSessionPersistence.cfg
  </files>
  <action>
Rewrite QGSDSessionPersistence.tla to use counter-based tracking instead of set-based tracking. The goal is to preserve all invariant semantics while eliminating the combinatorial explosion from SUBSET types.

**Variable changes:**
- Replace `activeSessions` (SUBSET of Nat) with `activeCount` (Nat in 0..MaxSessions)
- Replace `persistedSessions` (SUBSET of Nat) with `persistedCount` (Nat in 0..MaxSessions)
- Keep `idCounter`, `persistedCounter`, `restartCount`, `state`, `algorithmDone` unchanged

**TypeOK update:**
- `activeCount \in 0..MaxSessions`
- `persistedCount \in 0..MaxSessions`
- `idCounter \in 0..MaxCounter` (unchanged)
- `persistedCounter \in 0..MaxCounter` (unchanged)
- All other type constraints unchanged

**Action updates:**
- `Init`: `activeCount = 0`, `persistedCount = 0` (instead of empty sets)
- `CreateSession`: Guard `activeCount < MaxSessions`, then `activeCount' = activeCount + 1` and `idCounter' = idCounter + 1`. No UNCHANGED for persistedSessions — use persistedCount instead.
- `SaveSessions`: `persistedCount' = activeCount`, `persistedCounter' = idCounter`. State transition unchanged.
- `SaveComplete`: Unchanged (only touches state).
- `InitiateRestart`: `activeCount' = 0`, `idCounter' = 0`. Rest unchanged.
- `RestoreFromDisk`: `activeCount' = persistedCount`, `idCounter' = persistedCounter`. Rest unchanged.
- `RestoreComplete`: Unchanged (only touches state and algorithmDone).

**Invariant updates:**
- `PersistenceIntegrity`: Change from `persistedSessions = activeSessions` to `persistedCount = activeCount` (same semantic: after save, persisted state matches in-memory state)
- `CounterRestored`: Unchanged (references idCounter and persistedCounter which are kept)
- `CounterBounded`: Unchanged (references idCounter and persistedCounter)

**Liveness:** `RestoreComplete_Prop` unchanged (references state variable only).

**Update vars tuple:** Replace activeSessions/persistedSessions with activeCount/persistedCount.

**Update MCSessionPersistence.cfg:** No changes needed — it only references CONSTANTS (MaxSessions, MaxRestarts) and named invariants/properties, all of which are preserved.

**Preserve:** All `@requirement NAV-04` annotations. The "Handwritten" header comment. The module name. The EXTENDS clause (remove FiniteSets since Cardinality is no longer needed — activeCount replaces Cardinality(activeSessions)).

**State space impact:** Before: activeSessions in SUBSET 0..9 = 1024 values, persistedSessions in SUBSET 0..9 = 1024 values. After: activeCount in 0..3 = 4 values, persistedCount in 0..3 = 4 values. Reduction factor: ~65,000x for these two variables alone.
  </action>
  <verify>
1. Verify the file compiles by checking syntax: `grep -c 'activeCount' .planning/formal/tla/QGSDSessionPersistence.tla` returns >= 5 (variable decl, TypeOK, Init, CreateSession, SaveSessions, RestoreFromDisk)
2. Verify no set-based references remain: `grep -c 'activeSessions\|persistedSessions' .planning/formal/tla/QGSDSessionPersistence.tla` returns 0
3. Verify FiniteSets removed from EXTENDS: `grep 'EXTENDS' .planning/formal/tla/QGSDSessionPersistence.tla` shows only Naturals (no FiniteSets)
4. Verify all invariants preserved: `grep 'INVARIANT' .planning/formal/tla/MCSessionPersistence.cfg` still shows TypeOK, PersistenceIntegrity, CounterRestored, CounterBounded
5. Verify requirement annotations preserved: `grep '@requirement' .planning/formal/tla/QGSDSessionPersistence.tla` returns >= 4 matches
  </verify>
  <done>
QGSDSessionPersistence.tla uses counter-based tracking (activeCount, persistedCount) instead of set-based tracking (activeSessions, persistedSessions). All safety invariants and liveness properties are semantically preserved. EXTENDS no longer includes FiniteSets. State space reduced from ~billions to manageable size. MCSessionPersistence.cfg unchanged and compatible.
  </done>
</task>

</tasks>

<verification>
- QGSDSessionPersistence.tla contains no SUBSET types for session tracking
- All four invariants (TypeOK, PersistenceIntegrity, CounterRestored, CounterBounded) are defined
- RestoreComplete_Prop liveness property is defined
- MCSessionPersistence.cfg references all invariants and properties correctly
- No references to activeSessions or persistedSessions remain in the .tla file
- @requirement NAV-04 annotations preserved throughout
</verification>

<success_criteria>
- Counter-based model compiles and is syntactically valid TLA+
- State space reduced from SUBSET-based (2^10 per set variable) to bounded Nat (0..MaxSessions)
- All invariant semantics preserved (persistence integrity, counter monotonicity, counter bounds)
- Liveness property preserved (RestoreComplete_Prop)
</success_criteria>

<output>
After completion, create `.planning/quick/235-fix-tla-model-state-space-explosions-and/235-SUMMARY.md`
</output>
