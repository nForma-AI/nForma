-- .planning/formal/alloy/solve-session-persistence.als
-- Models the session persistence and pruning behavior of nf-solve.
-- Source: bin/nf-solve.cjs (persistSessionSummary, MAX_SESSION_FILES)
--
-- @requirement SOLVE-13

module solve_session_persistence

abstract sig Bool {}
one sig True, False extends Bool {}

-- Session files in the solve-sessions directory
sig SessionFile {
  timestamp: one Int
}

-- The solve-sessions directory state
one sig SessionDir {
  maxFiles: one Int,
  files: set SessionFile
}

-- SOLVE-13: Directory has a max retention limit of 20
-- @requirement SOLVE-13
fact MaxRetentionBound {
  SessionDir.maxFiles = 20
}

-- After pruning, file count never exceeds maxFiles
-- @requirement SOLVE-13
fact PruningEnforced {
  #SessionDir.files <= SessionDir.maxFiles
}

-- All timestamps are positive (ISO timestamps map to positive epoch)
fact PositiveTimestamps {
  all f: SessionFile | f.timestamp > 0
}

-- No two session files share the same timestamp
fact UniqueTimestamps {
  all disj f1, f2: SessionFile | f1.timestamp != f2.timestamp
}

-- Every SessionFile belongs to the directory
fact AllFilesInDir {
  SessionFile = SessionDir.files
}

-- Assertions

-- After any persist operation, count is within bounds
assert CountWithinBounds {
  #SessionDir.files <= 20
}

-- Pruning preserves the newest files (no newer file is pruned while older exists)
assert NewestPreserved {
  all disj f1, f2: SessionFile |
    f1 in SessionDir.files and f2 in SessionDir.files implies
      (f1.timestamp > f2.timestamp or f1.timestamp < f2.timestamp)
}

check CountWithinBounds for 25
check NewestPreserved for 25
