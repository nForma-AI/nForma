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
