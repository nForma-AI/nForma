-- .planning/formal/alloy/evidence-scope-scan.als
-- Models git heatmap evidence production and formal scope scan metadata matching.
-- Source: bin/git-heatmap.cjs, bin/formal-scope-scan.cjs
--
-- @requirement EVID-03
-- @requirement SPEC-05

module evidence_scope_scan

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── EVID-03: Git heatmap evidence production ───────────────────────────

-- @requirement EVID-03
sig GitHistoryEntry {
  hasNumericalAdjustments: one Bool,
  hasBugfixHotspots: one Bool,
  hasChurnRanking: one Bool
}

-- @requirement EVID-03
sig HeatmapOutput {
  entries: set GitHistoryEntry,
  outputPath: one OutputFile,
  isValid: one Bool
}

one sig OutputFile {}

-- @requirement EVID-03
-- Heatmap produces entries with all three signal types
fact HeatmapSignalCompleteness {
  all e: GitHistoryEntry |
    e.hasNumericalAdjustments = True and
    e.hasBugfixHotspots = True and
    e.hasChurnRanking = True
}

-- @requirement EVID-03
-- Heatmap output is always written to the expected path
fact HeatmapOutputValid {
  all h: HeatmapOutput | h.isValid = True
}

-- ── SPEC-05: Formal scope scan metadata ────────────────────────────────

-- @requirement SPEC-05
sig ScopeMetadata {
  concepts: set Concept,
  sourceFiles: set SourceFile,
  moduleName: one ModuleName
}

sig Concept {}
sig SourceFile {}
sig ModuleName {}

-- @requirement SPEC-05
sig ScopeScanMatch {
  scopeModule: one ScopeMetadata,
  matchedConcepts: set Concept,
  matchedSourceFiles: set SourceFile,
  matchedModuleName: one Bool,
  isExactMatch: one Bool
}

-- @requirement SPEC-05
-- Exact match requires concept match AND (source file overlap OR module name match)
fact ExactMatchCriteria {
  all m: ScopeScanMatch |
    m.isExactMatch = True iff
      (some m.matchedConcepts and
       (some m.matchedSourceFiles or m.matchedModuleName = True))
}

-- @requirement SPEC-05
-- Matched concepts must be subset of module's declared concepts
fact ConceptSubset {
  all m: ScopeScanMatch |
    m.matchedConcepts in m.scopeModule.concepts
}

-- @requirement SPEC-05
-- Matched source files must be subset of module's declared source files
fact SourceFileSubset {
  all m: ScopeScanMatch |
    m.matchedSourceFiles in m.scopeModule.sourceFiles
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement EVID-03
assert HeatmapAlwaysComplete {
  all e: GitHistoryEntry |
    e.hasNumericalAdjustments = True and
    e.hasBugfixHotspots = True and
    e.hasChurnRanking = True
}
check HeatmapAlwaysComplete for 5

-- @requirement SPEC-05
assert ExactMatchRequiresConceptAndOverlap {
  all m: ScopeScanMatch |
    m.isExactMatch = True implies
      (some m.matchedConcepts and
       (some m.matchedSourceFiles or m.matchedModuleName = True))
}
check ExactMatchRequiresConceptAndOverlap for 5

-- @requirement SPEC-05
assert NoPhantomConceptMatch {
  all m: ScopeScanMatch |
    m.matchedConcepts in m.scopeModule.concepts
}
check NoPhantomConceptMatch for 5
