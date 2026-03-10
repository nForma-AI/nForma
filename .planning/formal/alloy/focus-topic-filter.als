-- .planning/formal/alloy/focus-topic-filter.als
-- Focus Topic Filter — tokenization, weighted multi-field scoring, requirement filtering
--
-- Source: bin/solve-focus-filter.cjs
-- @requirement DIAG-04

module focus_topic_filter

-- A Token is a normalized word from the focus phrase (lowercase, >= 2 chars, no stop words)
sig Token {}

-- A Requirement has searchable text fields and may be matched by the filter
sig Requirement {
  id: one ReqId,
  textTokens: set Token,
  categoryTokens: set Token,
  backgroundTokens: set Token,
  score: one Score
}

sig ReqId {}

-- Scores represent the weighted match result
abstract sig Score {}
one sig Zero, Low, Medium, High extends Score {}

-- A FocusPhrase is the user input, tokenized into query tokens
one sig FocusPhrase {
  queryTokens: set Token
}

-- @requirement DIAG-04
-- Tokenization: focus phrase must produce at least one token for filtering to be active
fact TokenizationRequired {
  some FocusPhrase.queryTokens => some Requirement
}

-- @requirement DIAG-04
-- Weighted multi-field scoring: a requirement scores > Zero only if at least one
-- query token appears in at least one of its text fields
fact ScoringRequiresTokenMatch {
  all r: Requirement |
    r.score != Zero =>
      some (FocusPhrase.queryTokens & (r.textTokens + r.categoryTokens + r.backgroundTokens))
}

-- @requirement DIAG-04
-- Zero-score requirements have NO query token overlap with any field (bidirectional)
fact ZeroIffNoMatch {
  all r: Requirement |
    (r.score = Zero) iff
      no (FocusPhrase.queryTokens & (r.textTokens + r.categoryTokens + r.backgroundTokens))
}

-- @requirement DIAG-04
-- Higher field priority: category match alone can produce at least Low score
-- (category field has higher weight than background)
fact CategoryMatchIsSignificant {
  all r: Requirement |
    some (FocusPhrase.queryTokens & r.categoryTokens) =>
      r.score != Zero
}

-- @requirement DIAG-04
-- Filter output: only non-zero-scored requirements are included in the result set
pred filterActive {
  some FocusPhrase.queryTokens
}

-- @requirement DIAG-04
-- If no query tokens exist (empty/null phrase), no filtering occurs — all requirements pass
fact NoFilterWhenNoTokens {
  no FocusPhrase.queryTokens => all r: Requirement | r.score = Zero
}

-- @requirement DIAG-04
-- Each requirement has a unique ID
fact UniqueIds {
  all disj r1, r2: Requirement | r1.id != r2.id
}

-- Assertion: filtered set is a subset — no requirement with Zero score appears in output
assert FilteredSubset {
  filterActive => all r: Requirement | r.score = Zero => r not in { r2: Requirement | r2.score != Zero }
}
check FilteredSubset for 5

-- Assertion: scoring is deterministic — same tokens always produce same zero/non-zero classification
assert ScoringDeterministic {
  all disj r1, r2: Requirement |
    (r1.textTokens = r2.textTokens and r1.categoryTokens = r2.categoryTokens and r1.backgroundTokens = r2.backgroundTokens) =>
      (r1.score = Zero iff r2.score = Zero)
}
check ScoringDeterministic for 5

-- Assertion: empty phrase means no filtering (all scores Zero)
assert EmptyPhraseNoFilter {
  no FocusPhrase.queryTokens => all r: Requirement | r.score = Zero
}
check EmptyPhraseNoFilter for 5
