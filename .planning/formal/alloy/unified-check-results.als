-- .formal/alloy/unified-check-results.als
-- Models unified check result pipeline: checkers → NDJSON → triage → CI
-- Source: bin/run-formal-verify.cjs, check-results.ndjson
--
-- @requirement UNIF-01
-- @requirement UNIF-02
-- @requirement UNIF-03
-- @requirement UNIF-04

module unified_check_results

-- Formal verification tools
abstract sig FVTool {}
one sig TLC, AlloyChecker, PRISM extends FVTool {}

-- UNIF-01: Each checker produces normalized JSON entries
-- @requirement UNIF-01
sig CheckEntry {
  tool: one FVTool,
  result: one CheckResult,
  inNdjson: one Bool
}

abstract sig CheckResult {}
one sig Pass, Fail, Skip extends CheckResult {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- UNIF-02: run-formal-verify.cjs generates NDJSON as canonical output
-- @requirement UNIF-02
one sig NDJSONFile {
  entries: set CheckEntry
}

-- UNIF-03: Triage reads from NDJSON, not tool stdout
-- @requirement UNIF-03
one sig TriageBundle {
  source: set CheckEntry
}

-- CI enforcement step
-- @requirement UNIF-04
one sig CIStep {
  exitCode: one Int
}

-- All checker entries flow into NDJSON
-- @requirement UNIF-01
fact AllEntriesInNDJSON {
  all e : CheckEntry | e in NDJSONFile.entries
  all e : CheckEntry | e.inNdjson = True
}

-- UNIF-03: Triage reads from NDJSON only
-- @requirement UNIF-03
fact TriageReadsNDJSON {
  TriageBundle.source = NDJSONFile.entries
}

-- UNIF-04: CI exits non-zero when any fail exists
-- @requirement UNIF-04
fact CIExitOnFail {
  (some e : NDJSONFile.entries | e.result = Fail) implies CIStep.exitCode != 0
  (no e : NDJSONFile.entries | e.result = Fail) implies CIStep.exitCode = 0
}

run {} for 6 CheckEntry, 4 int

-- @requirement UNIF-01
assert AllEntriesNormalized {
  all e : CheckEntry | e.inNdjson = True
}
check AllEntriesNormalized for 6 CheckEntry, 4 int

-- @requirement UNIF-03
assert TriageFromNDJSONOnly {
  TriageBundle.source = NDJSONFile.entries
}
check TriageFromNDJSONOnly for 6 CheckEntry, 4 int

-- @requirement UNIF-04
assert CIFailsOnFailure {
  (some e : NDJSONFile.entries | e.result = Fail) implies CIStep.exitCode != 0
}
check CIFailsOnFailure for 6 CheckEntry, 4 int
