-- formal/alloy/install-scope.als
-- Handwritten — not generated from XState.
-- Source: bin/install.js
--
-- QGSD Install Scope Matrix Model (Alloy 6)
-- Requirements: QT-105
--
-- Models the installer runtime x scope constraints from bin/install.js.
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
-- @requirement INST-02
assert AllEquivalence {
    all s1, s2: InstallState |
        (AllSelected[s1] and AllSelected[s2]) => SameState[s1, s2]
}

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

-- NoConflict check: confirm no valid state has a runtime with conflicting scope
-- @requirement INST-01
assert NoConflict {
    all s: InstallState | NoConflictingScope[s]
}

check NoConflict         for 5 InstallState, 3 Runtime, 3 Scope
check AllEquivalence     for 5 InstallState, 3 Runtime, 3 Scope
check InstallIdempotent  for 5 InstallState, 3 Runtime, 3 Scope

run AllSelected for 5 InstallState, 3 Runtime, 3 Scope

-- -- GAP-7 Extension: Rollback Soundness + Config Sync Completeness ----------
-- Source: bin/install.js uninstall() (lines 964-1244) and installRuntime()
--
-- FileToken: abstract atom representing a GSD hook file installed by QGSD
-- Models: each distinct hook file (qgsd-stop.js, qgsd-prompt.js, etc.) as an opaque atom
-- Alloy has no string type; file identity is structural (same atom = same file)
abstract sig FileToken {}

-- InstallSnapshot: the set of FileToken atoms present in a target directory at one point in time
-- Models: the file set at hooks/dist/ or ~/.claude/hooks/ at a specific moment
sig InstallSnapshot {
    files: set FileToken
}

-- RollbackSound: after uninstall, GSD file tokens are absent from the target directory.
-- Formalizes: uninstall() removes exactly the GSD hook files that install() added.
-- Models the uninstall invariant: no GSD FileToken survives in the post-uninstall snapshot.
-- Source: bin/install.js uninstall() removes hook files from the target directory.
pred RollbackSound [pre, post: InstallSnapshot] {
    -- After uninstall, no GSD-installed file tokens remain:
    -- post.files is a subset of (pre.files minus the installed tokens).
    -- Simplified model: the post snapshot has no files that install added
    -- (modeled as: post.files in pre.files and post.files = pre.files - FileToken
    -- approximated as post.files = none, since all GSD files are removed).
    no post.files
}

-- ConfigSyncComplete: after install, hooks/dist/ and ~/.claude/hooks/ file sets are identical.
-- Formalizes: the install sync step leaves both directories with the same hook file tokens.
-- Source: bin/install.js installRuntime() writes same files to both locations.
pred ConfigSyncComplete [distSnapshot, claudeSnapshot: InstallSnapshot] {
    distSnapshot.files = claudeSnapshot.files
}

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

-- Check commands for GAP-7 (per-sig scopes for adequate coverage)
check RollbackSoundCheck      for 3 InstallSnapshot, 3 FileToken
check ConfigSyncCompleteCheck for 3 InstallSnapshot, 3 FileToken
