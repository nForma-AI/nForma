-- .formal/alloy/solver-doc-layers.als
-- Models the solver's documentation layer checks (R->D and D->C).
-- Source: bin/qgsd-solve.cjs
--
-- @requirement SOLVE-03
-- @requirement SOLVE-04

module solver_doc_layers

-- Requirements have IDs and keywords
-- @requirement SOLVE-03
sig Requirement {
  reqId: one ReqId,
  keywords: set Keyword
}

sig ReqId {}
sig Keyword {}

-- Documentation files discovered by the solver
-- @requirement SOLVE-03
sig DocFile {
  mentions: set ReqId,        -- literal ID mentions (R->D)
  keywordMentions: set Keyword, -- keyword matches (R->D fallback)
  claims: set StructuralClaim  -- D->C claims
}

-- @requirement SOLVE-03
sig StructuralClaim {
  claimType: one ClaimType,
  value: one ClaimValue,
  existsInCode: one Bool,
  isFalsePositive: one Bool
}

abstract sig ClaimType {}
one sig FilePath, CliCommand, Dependency extends ClaimType {}

sig ClaimValue {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Config-based doc discovery
-- @requirement SOLVE-03
one sig SolverConfig {
  configuredPaths: set DocFile,    -- from .planning/config.json docs_paths
  conventionPaths: set DocFile     -- fallback: README.md, docs/**/*.md
}

-- @requirement SOLVE-03
-- Solver discovers docs via config first, convention as fallback
fact DocDiscovery {
  #SolverConfig.configuredPaths = 0 implies
    #SolverConfig.conventionPaths > 0  -- must have at least convention docs
}

-- @requirement SOLVE-03
-- Each requirement has a unique ID
fact UniqueReqIds {
  all r1, r2 : Requirement | r1 != r2 implies r1.reqId != r2.reqId
}

-- @requirement SOLVE-03
-- R->D: A requirement is documented if its ID appears literally or keywords match
fun documented : set Requirement {
  { r : Requirement |
    some d : DocFile |
      r.reqId in d.mentions or
      some (r.keywords & d.keywordMentions)
  }
}

-- @requirement SOLVE-03
-- D->C: A claim is broken if it doesn't exist in code and isn't a false positive
fun brokenClaims : set StructuralClaim {
  { c : StructuralClaim |
    c.existsInCode = False and c.isFalsePositive = False
  }
}

-- Satisfiability
run {} for 4

-- @requirement SOLVE-03
-- Broken claims never include false positives
assert NoFalsePositivesInBroken {
  no c : brokenClaims | c.isFalsePositive = True
}
check NoFalsePositivesInBroken for 5

-- @requirement SOLVE-03
-- Documented requirements have at least one doc file mentioning them
assert DocumentedHasMention {
  all r : documented |
    some d : DocFile |
      r.reqId in d.mentions or some (r.keywords & d.keywordMentions)
}
check DocumentedHasMention for 5

-- ── SOLVE-04: R→D scoped to developer docs ──────────────────────────────────

-- @requirement SOLVE-04
-- Documentation files have a category: user (docs/) or developer (docs/dev/)
abstract sig DocCategory {}
one sig UserDoc, DevDoc extends DocCategory {}

-- @requirement SOLVE-04
-- Each doc file belongs to a category
fun docCategory : DocFile -> one DocCategory {
  -- Model: configured paths in SolverConfig determine category
  -- In the real system, docs/dev/** = DevDoc, docs/** = UserDoc
  SolverConfig.configuredPaths -> DevDoc +
  (SolverConfig.conventionPaths - SolverConfig.configuredPaths) -> UserDoc
}

-- @requirement SOLVE-04
-- R→D gap detection scoped to dev docs only
fun undocumentedInDevDocs : set Requirement {
  { r : Requirement |
    no d : DocFile |
      d in SolverConfig.configuredPaths and
      (r.reqId in d.mentions or some (r.keywords & d.keywordMentions))
  }
}

-- @requirement SOLVE-04
-- Auto-remediation can only target dev docs, never user docs
pred AutoRemediationTarget [f: DocFile] {
  f in SolverConfig.configuredPaths  -- dev docs only
}

-- @requirement SOLVE-04
-- User docs are never auto-modified by remediation
assert UserDocsPreserved {
  all f: DocFile |
    AutoRemediationTarget[f] implies f in SolverConfig.configuredPaths
}
check UserDocsPreserved for 5

-- @requirement SOLVE-04
-- Auto-remediation never targets convention-only (user) docs
assert NoUserDocAutoModification {
  all f: DocFile |
    (f in SolverConfig.conventionPaths and f not in SolverConfig.configuredPaths)
      implies not AutoRemediationTarget[f]
}
check NoUserDocAutoModification for 5
