-- .formal/alloy/evidence-triage.als
-- Models the evidence confidence and triage bundle structure.
-- Source: bin/validate-traces.cjs, bin/generate-triage-bundle.cjs
--
-- @requirement EVID-01
-- @requirement EVID-02
-- @requirement TRIAGE-01
-- @requirement TRIAGE-02

module evidence_triage

-- Confidence levels for never_observed paths
abstract sig Confidence {}
one sig ConfLow, ConfMedium, ConfHigh extends Confidence {}

-- Check result in NDJSON
abstract sig CheckResult {
  result: one ResultType,
  hasTriageTags: one Bool
}

abstract sig ResultType {}
one sig Pass, Fail, Warn, Inconclusive extends ResultType {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- EVID-01: Evidence entry with confidence
-- @requirement EVID-01
sig EvidenceEntry extends CheckResult {
  pathType: one PathType,
  confidence: one Confidence,
  traceVolume: one Int,
  windowDays: one Int
} {
  traceVolume >= 0
  windowDays >= 0
}

-- EVID-01: Confidence derived from volume and window
-- @requirement EVID-01
fact ConfidenceRules {
  all e : EvidenceEntry |
    e.pathType = NeverObserved implies (
      (e.traceVolume =< 10 or e.windowDays =< 1) implies e.confidence = ConfLow
    )
}

abstract sig PathType {}
one sig Observed, NeverObserved extends PathType {}

-- EVID-02: Observation window metadata
-- @requirement EVID-02
sig ObservationWindow {
  entry: one EvidenceEntry,
  windowStart: one Int,
  windowEnd: one Int,
  nTraces: one Int,
  nEvents: one Int,
  windowDays: one Int
} {
  windowStart =< windowEnd
  nTraces >= 0
  nEvents >= 0
  windowDays >= 0
}

-- Each evidence entry has exactly one observation window
fact OneWindowPerEntry {
  all e : EvidenceEntry | one w : ObservationWindow | w.entry = e
}

-- TRIAGE-01: Triage bundle output structure
-- @requirement TRIAGE-01
sig TriageBundle {
  diffReport: one DiffReport,
  suspects: set CheckResult
}

sig DiffReport {
  deltas: set CheckResult
}

-- TRIAGE-01: Suspects are checks with fail or triage_tags
-- @requirement TRIAGE-01
fact SuspectsAreFails {
  all tb : TriageBundle |
    all s : tb.suspects |
      s.result = Fail or s.hasTriageTags = True
}

-- TRIAGE-02: Triage runs as final step (structural: bundle always exists if results exist)
-- @requirement TRIAGE-02
fact TriageBundleExists {
  some CheckResult implies some TriageBundle
}

-- Satisfiability
run {} for 3 but 3 EvidenceEntry, 3 ObservationWindow, 1 TriageBundle, 1 DiffReport, 4 int

-- @requirement EVID-01
-- Never-observed paths with low volume have low confidence
assert LowVolumeIsLowConfidence {
  all e : EvidenceEntry |
    (e.pathType = NeverObserved and e.traceVolume =< 10 and e.windowDays =< 1)
      implies e.confidence = ConfLow
}
check LowVolumeIsLowConfidence for 3 but 3 EvidenceEntry, 3 ObservationWindow, 1 TriageBundle, 1 DiffReport, 4 int

-- @requirement TRIAGE-01
-- All suspects are fails or tagged
assert SuspectsAreFailOrTagged {
  all tb : TriageBundle, s : tb.suspects |
    s.result = Fail or s.hasTriageTags = True
}
check SuspectsAreFailOrTagged for 3 but 3 EvidenceEntry, 3 ObservationWindow, 1 TriageBundle, 1 DiffReport, 4 int
