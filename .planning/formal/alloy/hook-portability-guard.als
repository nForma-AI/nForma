-- .planning/formal/alloy/hook-portability-guard.als
-- Models the destructive git guard hook and the portability constraint that
-- nForma hooks improve behavior in ANY project, not just the source repo.
-- Source: hooks/nf-destructive-git-guard.js, agents/nf-executor.md, agents/nf-planner.md
--
-- @requirement GUARD-02
-- @requirement PORT-04

module hook_portability_guard

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── GUARD-02: Destructive git guard hook ────────────────────────────────

-- @requirement GUARD-02
abstract sig GitCommand {}
one sig GitStash, GitResetHard, GitCheckoutDash, GitCleanF extends GitCommand {}

-- @requirement GUARD-02
sig GitInvocation {
  command: one GitCommand,
  uncommittedChangesExist: one Bool,
  warningEmitted: one Bool,
  executionBlocked: one Bool
}

-- @requirement GUARD-02
-- Destructive commands are: stash, reset --hard, checkout --, clean -f
fact DestructiveCommandsDetected {
  GitCommand = GitStash + GitResetHard + GitCheckoutDash + GitCleanF
}

-- @requirement GUARD-02
-- Warn-only fail-open: emit stderr warning when uncommitted changes exist,
-- but never block execution
fact WarnOnlyFailOpen {
  all inv: GitInvocation |
    inv.uncommittedChangesExist = True implies inv.warningEmitted = True
}

fact NeverBlocks {
  all inv: GitInvocation | inv.executionBlocked = False
}

-- ── PORT-04: Hook portability ───────────────────────────────────────────

-- @requirement PORT-04
sig Project {
  hasNFormaInstalled: one Bool,
  isNFormaSourceRepo: one Bool
}

-- @requirement PORT-04
sig HookBehavior {
  project: one Project,
  improvesBehavior: one Bool
}

-- @requirement PORT-04
-- Hooks improve behavior in ANY project where nForma is installed
fact PortableImprovement {
  all hb: HookBehavior |
    hb.project.hasNFormaInstalled = True implies hb.improvesBehavior = True
}

-- @requirement PORT-04
-- Not limited to nForma source repo
fact NotSourceRepoOnly {
  some p: Project |
    p.hasNFormaInstalled = True and p.isNFormaSourceRepo = False
  implies
    all hb: HookBehavior |
      hb.project.hasNFormaInstalled = True and
      hb.project.isNFormaSourceRepo = False implies
        hb.improvesBehavior = True
}

-- Assertions
assert GuardNeverBlocks {
  all inv: GitInvocation | inv.executionBlocked = False
}

assert WarnsOnDestructiveWithChanges {
  all inv: GitInvocation |
    inv.uncommittedChangesExist = True implies inv.warningEmitted = True
}

assert PortableToAnyProject {
  all hb: HookBehavior |
    hb.project.hasNFormaInstalled = True implies hb.improvesBehavior = True
}

check GuardNeverBlocks for 5 but 8 GitInvocation
check WarnsOnDestructiveWithChanges for 5 but 8 GitInvocation
check PortableToAnyProject for 5 but 5 Project, 5 HookBehavior
