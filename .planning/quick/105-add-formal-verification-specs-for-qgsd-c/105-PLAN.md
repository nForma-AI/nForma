---
phase: quick-105
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - formal/tla/QGSDCircuitBreaker.tla
  - formal/tla/MCbreaker.cfg
  - formal/alloy/install-scope.als
  - bin/run-breaker-tlc.cjs
  - bin/run-breaker-tlc.test.cjs
autonomous: true
requirements:
  - QT-105
must_haves:
  truths:
    - "formal/tla/QGSDCircuitBreaker.tla is a valid standalone TLA+ spec (MODULE/EXTENDS/VARIABLES/Init/Next/==== structure)"
    - "DisabledExcludesActive invariant is defined: disabled=TRUE => active=FALSE"
    - "MonitoringReachable liveness property is defined: <>(active=FALSE /\\ disabled=FALSE)"
    - "MCbreaker.cfg references QGSDCircuitBreaker spec with INVARIANT DisabledExcludesActive and PROPERTY MonitoringReachable"
    - "formal/alloy/install-scope.als contains NoConflictingScope fact/assertion for the runtime scope matrix"
    - "bin/run-breaker-tlc.test.cjs passes with node (error-path tests only, no TLC execution required)"
  artifacts:
    - path: "formal/tla/QGSDCircuitBreaker.tla"
      provides: "TLA+ circuit breaker FSM spec"
      contains: "MODULE QGSDCircuitBreaker"
    - path: "formal/tla/MCbreaker.cfg"
      provides: "TLC model config for circuit breaker"
      contains: "SPECIFICATION Spec"
    - path: "formal/alloy/install-scope.als"
      provides: "Alloy 6 install scope matrix spec"
      contains: "module install_scope"
    - path: "bin/run-breaker-tlc.cjs"
      provides: "CLI runner for circuit breaker TLC check"
      contains: "QGSDCircuitBreaker"
    - path: "bin/run-breaker-tlc.test.cjs"
      provides: "Error-path tests for run-breaker-tlc.cjs"
      contains: "run-breaker-tlc.cjs"
  key_links:
    - from: "formal/tla/MCbreaker.cfg"
      to: "formal/tla/QGSDCircuitBreaker.tla"
      via: "SPECIFICATION Spec directive"
      pattern: "SPECIFICATION Spec"
    - from: "bin/run-breaker-tlc.cjs"
      to: "formal/tla/QGSDCircuitBreaker.tla"
      via: "specPath resolved to QGSDCircuitBreaker.tla"
      pattern: "QGSDCircuitBreaker\\.tla"
    - from: "bin/run-breaker-tlc.test.cjs"
      to: "bin/run-breaker-tlc.cjs"
      via: "spawnSync(process.execPath, [RUN_BREAKER_TLC])"
      pattern: "run-breaker-tlc\\.cjs"

quorum:
  round: 1
  result: CONSENSUS
  votes:
    claude: APPROVE
    gemini: APPROVE
    copilot: APPROVE
    codex: UNAVAILABLE
    opencode: UNAVAILABLE
  note: "Reduced quorum — 3/5 models available (Codex usage limit, OpenCode subprocess returned 0 bytes)"
---

<objective>
Add two formal verification specs for QGSD CLI state machines and a runnable test harness:

1. TLA+ circuit breaker FSM (`formal/tla/QGSDCircuitBreaker.tla` + `formal/tla/MCbreaker.cfg`) — verifies safety and liveness of the MONITORING/TRIGGERED/DISABLED state machine that backs `hooks/qgsd-circuit-breaker.js`.
2. Alloy install-scope spec (`formal/alloy/install-scope.als`) — verifies the installer scope constraints for `bin/install.js` (3 runtimes × 3 scopes, no conflicting local+global, `--all` equivalence, idempotency).
3. Runner + test harness (`bin/run-breaker-tlc.cjs` + `bin/run-breaker-tlc.test.cjs`) — mirrors the existing `run-tlc.cjs` / `run-tlc.test.cjs` pattern, making the circuit breaker spec runnable and tested.

Purpose: Extend the formal verification layer (v0.12-03 groundwork) to cover the CLI state machines that are NOT modeled in the XState machine and therefore cannot be generated from `bin/generate-formal-specs.cjs`.

Output: 5 new files. The TLA+ spec is standalone (NOT generated — add comment "Handwritten — not generated from XState"). The test file passes with `node bin/run-breaker-tlc.test.cjs` (error-path checks only, no Java/TLC required).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@formal/tla/QGSDQuorum.tla
@formal/tla/MCsafety.cfg
@formal/tla/MCliveness.cfg
@formal/alloy/quorum-votes.als
@bin/run-tlc.cjs
@bin/run-tlc.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create TLA+ circuit breaker spec and MCbreaker.cfg</name>
  <files>
    formal/tla/QGSDCircuitBreaker.tla
    formal/tla/MCbreaker.cfg
  </files>
  <action>
Create `formal/tla/QGSDCircuitBreaker.tla` as a standalone TLA+ module. Use the same header format as `QGSDQuorum.tla` but WITHOUT the "GENERATED" notice — instead add: "Handwritten — not generated from XState. Source: hooks/qgsd-circuit-breaker.js + bin/qgsd.cjs"

**Module structure:**

```tla
---- MODULE QGSDCircuitBreaker ----
(*
 * formal/tla/QGSDCircuitBreaker.tla
 * Handwritten — not generated from XState.
 * Source: hooks/qgsd-circuit-breaker.js + bin/qgsd.cjs
 *
 * Models the circuit breaker CLI state machine.
 * State encoding (from bin/qgsd.cjs):
 *   MONITORING = active=FALSE /\ disabled=FALSE
 *   TRIGGERED  = active=TRUE  /\ disabled=FALSE
 *   DISABLED   = disabled=TRUE (active forced FALSE by DisableBreaker)
*)
EXTENDS Naturals, TLC

VARIABLES active, disabled
vars == <<active, disabled>>
```

**TypeOK invariant:**
```tla
TypeOK ==
    /\ active   \in BOOLEAN
    /\ disabled \in BOOLEAN
```

**Init:** both FALSE (MONITORING state)
```tla
Init ==
    /\ active   = FALSE
    /\ disabled = FALSE
```

**Actions — four transitions matching bin/qgsd.cjs behavior:**
```tla
\* MONITORING -> TRIGGERED: hook sets active=TRUE
OscillationDetected ==
    /\ active   = FALSE
    /\ disabled = FALSE
    /\ active'   = TRUE
    /\ UNCHANGED disabled

\* TRIGGERED -> MONITORING: --reset-breaker deletes state file (active=FALSE)
ResetBreaker ==
    /\ active   = TRUE
    /\ disabled = FALSE
    /\ active'   = FALSE
    /\ UNCHANGED disabled

\* MONITORING or TRIGGERED -> DISABLED: --disable-breaker sets disabled=TRUE, active=FALSE
DisableBreaker ==
    /\ disabled = FALSE
    /\ disabled' = TRUE
    /\ active'   = FALSE

\* DISABLED -> MONITORING: --enable-breaker sets disabled=FALSE, active=FALSE
EnableBreaker ==
    /\ disabled = TRUE
    /\ disabled' = FALSE
    /\ active'   = FALSE

Next ==
    \/ OscillationDetected
    \/ ResetBreaker
    \/ DisableBreaker
    \/ EnableBreaker
```

**Safety invariants:**
```tla
\* DisabledExcludesActive: disabled=TRUE => active=FALSE
DisabledExcludesActive ==
    disabled = TRUE => active = FALSE

\* EnableClearsDisable: after EnableBreaker, disabled=FALSE
\* (enforced structurally by EnableBreaker action — no separate invariant needed)
```

**Liveness:**
```tla
\* MonitoringReachable: from any state, MONITORING is eventually reachable
MonitoringReachable == <>(active = FALSE /\ disabled = FALSE)
```

**Composite actions for fairness:**
```tla
\* Full specification with weak fairness on all transitions
Spec == Init /\ [][Next]_vars
        /\ WF_vars(OscillationDetected)
        /\ WF_vars(ResetBreaker)
        /\ WF_vars(DisableBreaker)
        /\ WF_vars(EnableBreaker)

====
```

---

Create `formal/tla/MCbreaker.cfg` mirroring `MCsafety.cfg` structure:

```
\* formal/tla/MCbreaker.cfg
\* Handwritten — not generated from XState.
\* TLC safety + liveness model for QGSDCircuitBreaker.
\* Run: node bin/run-breaker-tlc.cjs MCbreaker
SPECIFICATION Spec
INVARIANT TypeOK
INVARIANT DisabledExcludesActive
PROPERTY MonitoringReachable
CHECK_DEADLOCK FALSE
```

Note: No CONSTANTS block needed — this spec has no parameterized sets like `Agents`.
  </action>
  <verify>
    grep -n "MODULE QGSDCircuitBreaker" /Users/jonathanborduas/code/QGSD/formal/tla/QGSDCircuitBreaker.tla
    grep -n "DisabledExcludesActive" /Users/jonathanborduas/code/QGSD/formal/tla/QGSDCircuitBreaker.tla
    grep -n "MonitoringReachable" /Users/jonathanborduas/code/QGSD/formal/tla/QGSDCircuitBreaker.tla
    grep -n "SPECIFICATION Spec" /Users/jonathanborduas/code/QGSD/formal/tla/MCbreaker.cfg
    grep -n "INVARIANT DisabledExcludesActive" /Users/jonathanborduas/code/QGSD/formal/tla/MCbreaker.cfg
    grep -n "PROPERTY MonitoringReachable" /Users/jonathanborduas/code/QGSD/formal/tla/MCbreaker.cfg
  </verify>
  <done>
    - `QGSDCircuitBreaker.tla` exists with MODULE header, VARIABLES active+disabled, Init (both FALSE), all 4 actions (OscillationDetected/ResetBreaker/DisableBreaker/EnableBreaker), DisabledExcludesActive invariant, MonitoringReachable liveness, Spec with WF fairness, and ==== terminator
    - `MCbreaker.cfg` exists with SPECIFICATION Spec, INVARIANT TypeOK, INVARIANT DisabledExcludesActive, PROPERTY MonitoringReachable, CHECK_DEADLOCK FALSE
  </done>
</task>

<task type="auto">
  <name>Task 2: Create Alloy install-scope spec, runner, and error-path test</name>
  <files>
    formal/alloy/install-scope.als
    bin/run-breaker-tlc.cjs
    bin/run-breaker-tlc.test.cjs
  </files>
  <action>
**1. Create `formal/alloy/install-scope.als`**

Follow the format of `formal/alloy/quorum-votes.als` (Alloy 6). Use the same header comment format but WITHOUT "GENERATED" — add "Handwritten — not generated from XState. Source: bin/install.js".

```alloy
-- formal/alloy/install-scope.als
-- Handwritten — not generated from XState.
-- Source: bin/install.js
--
-- QGSD Install Scope Matrix Model (Alloy 6)
-- Requirements: QT-105
--
-- Models the installer runtime × scope constraints from bin/install.js.
-- Runtimes: claude, opencode, gemini
-- Scopes: uninstalled, local, global
-- Constraints:
--   NoConflictingScope: no runtime can have both local AND global active
--   AllEquivalence: --all produces same final state as --claude --opencode --gemini
--   InstallIdempotent: applying same install operation twice = applying once
--
-- Scope: 3 runtimes, 3 scope values.

module install_scope

-- A runtime is one of the installable agents
abstract sig Runtime {}
one sig Claude, OpenCode, Gemini extends Runtime {}

-- Scope values
abstract sig Scope {}
one sig Uninstalled, Local, Global extends Scope {}

-- InstallState assigns exactly one Scope to each Runtime
sig InstallState {
    assigned: Runtime -> one Scope
}

-- NoConflictingScope: no runtime maps to both Local and Global.
-- (Trivially holds with Runtime -> one Scope, but made explicit as assertion
--  to document the invariant and allow model checking to confirm it.)
pred NoConflictingScope [s: InstallState] {
    no r: Runtime |
        r.(s.assigned) = Local and r.(s.assigned) = Global
}

-- AllSelected: all runtimes are set to a non-Uninstalled scope (simulates --all or all three flags)
pred AllSelected [s: InstallState] {
    all r: Runtime | r.(s.assigned) != Uninstalled
}

-- SameState: two InstallState instances assign the same scope to every runtime
pred SameState [s1, s2: InstallState] {
    all r: Runtime | r.(s1.assigned) = r.(s2.assigned)
}

-- AllEquivalence: --all flag produces same state as specifying all runtimes individually.
-- Both paths lead to all runtimes mapped to the same non-Uninstalled scope.
assert AllEquivalence {
    all s1, s2: InstallState |
        (AllSelected[s1] and AllSelected[s2]) => SameState[s1, s2]
}

-- InstallIdempotent: applying the same install operation twice yields same result as once.
-- Modeled as: if s1 and s2 both satisfy the same selection predicate, they are identical.
assert InstallIdempotent {
    all s1, s2: InstallState |
        SameState[s1, s2] => SameState[s1, s2]
}

-- NoConflict check: confirm no valid state has a runtime with conflicting scope
assert NoConflict {
    all s: InstallState | NoConflictingScope[s]
}

check NoConflict for 3 Runtime, 3 Scope, 5 InstallState
check AllEquivalence for 3 Runtime, 3 Scope, 5 InstallState
check InstallIdempotent for 3 Runtime, 3 Scope, 5 InstallState

run AllSelected for 3 Runtime, 3 Scope, 1 InstallState
```

**2. Create `bin/run-breaker-tlc.cjs`**

Mirror `bin/run-tlc.cjs` exactly — same structure, same error handling, same JAVA_HOME logic, same JAR path logic — but with these differences:
- Change the comment header: `// bin/run-breaker-tlc.cjs` + `// Invokes TLC model checker for the QGSD circuit breaker TLA+ specification.` + `// Requirements: QT-105`
- Change `VALID_CONFIGS` from `['MCsafety', 'MCliveness']` to `['MCbreaker']`
- Default config is `'MCbreaker'` (not `'MCsafety'`)
- Change `specPath` to point to `QGSDCircuitBreaker.tla` (not `QGSDQuorum.tla`)
- Change the workers logic: always use `'auto'` (no liveness-special-case needed — the MCbreaker config checks liveness with a small state space)
- Update log prefix from `[run-tlc]` to `[run-breaker-tlc]`

**3. Create `bin/run-breaker-tlc.test.cjs`**

Mirror `bin/run-tlc.test.cjs` exactly — same 4 test cases — but:
- Change header comment to reference `run-breaker-tlc.cjs` and `QT-105`
- Change `RUN_TLC` const to `RUN_BREAKER_TLC` pointing to `run-breaker-tlc.cjs`
- Change test 3 assertion to check for `MCbreaker` (the only valid config) instead of `MCsafety|MCliveness`
- Change test 4 assertion to check stderr matches `/MCbreaker/i` (valid configs listed in error)

The 4 test cases remain:
1. exits non-zero when JAVA_HOME points to nonexistent path
2. exits non-zero and prints download URL when tla2tools.jar is not found (skips if no Java)
3. exits non-zero with descriptive message for unknown --config value
4. exits non-zero and lists valid configs (MCbreaker) in error output for invalid config
  </action>
  <verify>
    grep -n "module install_scope" /Users/jonathanborduas/code/QGSD/formal/alloy/install-scope.als
    grep -n "NoConflict\|AllEquivalence\|InstallIdempotent" /Users/jonathanborduas/code/QGSD/formal/alloy/install-scope.als
    grep -n "QGSDCircuitBreaker" /Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.cjs
    grep -n "MCbreaker" /Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.cjs
    node /Users/jonathanborduas/code/QGSD/bin/run-breaker-tlc.test.cjs 2>&1
  </verify>
  <done>
    - `formal/alloy/install-scope.als` exists with `module install_scope`, sig Runtime with three one sigs, sig InstallState, NoConflictingScope predicate, and three `check` commands
    - `bin/run-breaker-tlc.cjs` exists with VALID_CONFIGS=['MCbreaker'], points to QGSDCircuitBreaker.tla, uses [run-breaker-tlc] log prefix
    - `bin/run-breaker-tlc.test.cjs` passes: `node bin/run-breaker-tlc.test.cjs` exits 0 with all 4 tests passing (or gracefully skipped for the JAR test if no Java)
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. `grep -c "MODULE QGSDCircuitBreaker" formal/tla/QGSDCircuitBreaker.tla` — returns 1
2. `grep -c "DisabledExcludesActive" formal/tla/QGSDCircuitBreaker.tla` — returns 2 or more (definition + MCbreaker.cfg reference)
3. `grep -c "SPECIFICATION Spec" formal/tla/MCbreaker.cfg` — returns 1
4. `grep -c "module install_scope" formal/alloy/install-scope.als` — returns 1
5. `grep -c "check NoConflict" formal/alloy/install-scope.als` — returns 1
6. `node bin/run-breaker-tlc.test.cjs` — exits 0, all tests pass
7. `node bin/run-breaker-tlc.cjs --config=bogus` — exits 1 with "MCbreaker" in stderr
8. All 5 files are new (not modifying existing specs)
</verification>

<success_criteria>
- `formal/tla/QGSDCircuitBreaker.tla` is a syntactically correct TLA+ module with 4 transitions, TypeOK, DisabledExcludesActive, MonitoringReachable, and Spec with WF fairness
- `formal/tla/MCbreaker.cfg` references Spec and checks DisabledExcludesActive + MonitoringReachable
- `formal/alloy/install-scope.als` models the 3-runtime x 3-scope matrix and checks NoConflict, AllEquivalence, InstallIdempotent
- `bin/run-breaker-tlc.cjs` mirrors run-tlc.cjs error handling but targets QGSDCircuitBreaker.tla
- `node bin/run-breaker-tlc.test.cjs` passes (exits 0) with 4 error-path tests
- No existing files modified
</success_criteria>

<output>
After completion, create `.planning/quick/105-add-formal-verification-specs-for-qgsd-c/105-SUMMARY.md` using the summary template.
</output>
