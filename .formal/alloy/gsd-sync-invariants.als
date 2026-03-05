-- .formal/alloy/gsd-sync-invariants.als
-- Models the GSD/QGSD package relationship invariants.
-- Source: package.json, hooks/qgsd-stop.js, hooks/qgsd-prompt.js
--
-- @requirement SYNC-01
-- @requirement SYNC-02
-- @requirement SYNC-03
-- @requirement SYNC-04

module gsd_sync_invariants

abstract sig Bool {}
one sig True, False extends Bool {}

-- Package artifacts
abstract sig Package {
  files: set SourceFile
}

-- SYNC-01: QGSD is a separate package wrapping GSD
-- @requirement SYNC-01
one sig GSDPackage extends Package {}
one sig QGSDPackage extends Package {
  wraps: one Package
} {
  wraps = GSDPackage
}

sig SourceFile {
  owner: one Package,
  modifiedByQGSD: one Bool
}

-- SYNC-04: No QGSD code modifies GSD source files
-- @requirement SYNC-04
fact NoGSDModification {
  all f : SourceFile |
    f.owner = GSDPackage implies f.modifiedByQGSD = False
}

-- QGSD-only files
sig QGSDOnlyFile extends SourceFile {} {
  owner = QGSDPackage
}

-- SYNC-04: All QGSD additions are in separate files
-- @requirement SYNC-04
fact QGSDAdditionsSeparate {
  all f : SourceFile |
    f.modifiedByQGSD = True implies f.owner = QGSDPackage
}

-- Planning commands
sig PlanningCommand {}

-- SYNC-02: quorum_commands list tracks GSD commands
-- @requirement SYNC-02
one sig QuorumCommandsList {
  commands: set PlanningCommand
}

one sig GSDCommandSet {
  commands: set PlanningCommand
}

-- SYNC-02: Every GSD planning command appears in quorum_commands
-- @requirement SYNC-02
fact CommandsTracked {
  GSDCommandSet.commands in QuorumCommandsList.commands
}

-- Version compatibility
-- SYNC-03: Changelog tracks GSD version compatibility
-- @requirement SYNC-03
one sig Changelog {
  tracksGSDVersion: one Bool
} {
  tracksGSDVersion = True
}

-- Satisfiability
run {} for 3 but 4 SourceFile, 2 QGSDOnlyFile, 3 PlanningCommand

-- @requirement SYNC-04
-- GSD files are never modified by QGSD
assert GSDFilesUntouched {
  all f : SourceFile |
    f.owner = GSDPackage implies f.modifiedByQGSD = False
}
check GSDFilesUntouched for 3 but 5 SourceFile, 2 QGSDOnlyFile, 3 PlanningCommand

-- @requirement SYNC-02
-- All GSD commands in quorum list
assert AllGSDCommandsInQuorum {
  GSDCommandSet.commands in QuorumCommandsList.commands
}
check AllGSDCommandsInQuorum for 3 but 4 SourceFile, 2 QGSDOnlyFile, 5 PlanningCommand

-- @requirement SYNC-01
-- QGSD wraps GSD (not the other way around)
assert QGSDWrapsGSD {
  QGSDPackage.wraps = GSDPackage
}
check QGSDWrapsGSD for 3 but 4 SourceFile, 2 QGSDOnlyFile, 3 PlanningCommand
