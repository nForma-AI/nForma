-- .planning/formal/alloy/solve-legacy-merge.als
-- Models the legacy .formal/ directory detection and merge behavior.
-- Source: bin/qgsd-solve.cjs (Step 0 legacy merge)
--
-- @requirement SOLVE-8

module solve_legacy_merge

abstract sig Bool {}
one sig True, False extends Bool {}

-- Directories the solver checks
sig Directory {
  exists: one Bool,
  isEmpty: one Bool
}

one sig LegacyFormalDir, CanonicalFormalDir extends Directory {}

-- A file that may exist in either directory
sig FormalFile {
  inLegacy: one Bool,
  inCanonical: one Bool,
  mergedToCanonical: one Bool
}

-- Merge operation state
one sig MergeOperation {
  legacyDetected: one Bool,
  mergeExecuted: one Bool,
  conflictResolution: one ConflictPolicy
}

abstract sig ConflictPolicy {}
one sig CanonicalWins, LegacyWins extends ConflictPolicy {}

-- SOLVE-8: Solver detects legacy .formal/ before sweep
-- @requirement SOLVE-8
fact DetectionBeforeSweep {
  LegacyFormalDir.exists = True implies MergeOperation.legacyDetected = True
  LegacyFormalDir.exists = False implies MergeOperation.legacyDetected = False
}

-- SOLVE-8: Merge uses canonical-wins conflict resolution
-- @requirement SOLVE-8
fact CanonicalWinsPolicy {
  MergeOperation.conflictResolution = CanonicalWins
}

-- SOLVE-8: Files only in legacy get merged
-- @requirement SOLVE-8
fact LegacyOnlyFilesMerged {
  all f: FormalFile |
    (f.inLegacy = True and f.inCanonical = False) implies f.mergedToCanonical = True
}

-- SOLVE-8: Conflicts resolved by keeping canonical version
fact ConflictsKeepCanonical {
  all f: FormalFile |
    (f.inLegacy = True and f.inCanonical = True) implies f.mergedToCanonical = False
}

-- SOLVE-8: No merge if legacy doesn't exist
fact NoMergeWithoutLegacy {
  LegacyFormalDir.exists = False implies MergeOperation.mergeExecuted = False
  LegacyFormalDir.exists = False implies (all f: FormalFile | f.mergedToCanonical = False)
}

-- Assertions
assert LegacyAlwaysDetected {
  LegacyFormalDir.exists = True implies MergeOperation.legacyDetected = True
}

assert CanonicalNeverOverwritten {
  all f: FormalFile |
    (f.inCanonical = True and f.inLegacy = True) implies f.mergedToCanonical = False
}

assert LegacyUniquesMerged {
  all f: FormalFile |
    (f.inLegacy = True and f.inCanonical = False and LegacyFormalDir.exists = True)
      implies f.mergedToCanonical = True
}

check LegacyAlwaysDetected for 5
check CanonicalNeverOverwritten for 5 but 8 FormalFile
check LegacyUniquesMerged for 5 but 8 FormalFile
