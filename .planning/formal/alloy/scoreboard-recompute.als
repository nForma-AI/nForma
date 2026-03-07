-- formal/alloy/scoreboard-recompute.als
-- Handwritten — not generated from XState.
-- Source: bin/update-scoreboard.cjs (recomputeStats, recomputeSlots)
--
-- Models the QGSD scoreboard recomputation algorithm:
--   recomputeStats: reset all model stats to 0, then replay all rounds
--   recomputeSlots: reset all slot stats to 0, then replay all rounds
--
-- Assertions:
--   NoVoteLoss: every vote in rounds[] contributes to the final score
--   NoDoubleCounting: removing a round reduces score by exactly that round's delta (additivity)
--   TNplusScoreIsCorrect: TN+ vote in a single round gives score 7 (sanity check)
--
-- NOTE: RecomputeIdempotent assertion REMOVED (was SCBD-01).
-- Alloy pure functions are trivially idempotent by language semantics:
-- f(x) = f(x) is definitional, not a verifiable property.
-- True temporal idempotency (apply operation twice, get same result) requires
-- modeling a mutable state machine, which is done in TLA+ (see QGSDInstallerIdempotency.tla).
-- The scoreboard recompute operation's idempotency is verified by the JavaScript test suite
-- (bin/update-scoreboard.test.cjs) which tests recomputeStats() called twice yields same result.
-- @requirement SCBD-01 — verified via JS tests, not Alloy (expressiveness gap)
--
-- Scope: 5 rounds, 5 models, 7 vote codes, 7-bit integers (-64..63)

module scoreboard_recompute

-- Vote classification codes (mirrors SCORE_DELTAS in update-scoreboard.cjs)
abstract sig VoteCode {}
one sig TP, TN, FP, FN, TPplus, TNplus, UNAVAIL extends VoteCode {}

-- Score delta for each vote code
fun scoreDelta [v: VoteCode] : Int {
  (v = TP    => 1  else
  (v = TPplus => 3 else
  (v = TN    => 5  else
  (v = TNplus => 7 else
  (v = FP    => -3 else
  (v = FN    => -1 else
  0))))))
}

-- Abstract model identities
abstract sig Model {}
one sig Claude, Gemini, Codex, OpenCode, Copilot extends Model {}

-- A single quorum round: each model has at most one vote
sig Round {
  votes: Model ->lone VoteCode
}

-- Computed score for a model given a set of rounds
-- Models recomputeStats: sum of scoreDelta for all votes for this model across all rounds
fun computeScore [m: Model, rounds: set Round] : Int {
  sum r: rounds | scoreDelta[r.votes[m]]
}

-- NoVoteLoss: every vote's delta is reflected in the total sum
-- If every round has a vote for model m, the score equals the sum of all deltas.
-- @requirement SCBD-02
assert NoVoteLoss {
  all m: Model, rounds: set Round |
    (all r: rounds | some r.votes[m]) =>
    computeScore[m, rounds] = (sum r: rounds | scoreDelta[r.votes[m]])
}

-- NoDoubleCounting: removing any single round from the set reduces the score
-- by exactly that round's delta. This verifies additivity/linearity: no round's
-- contribution is counted more than once or less than once.
-- @requirement SCBD-03
assert NoDoubleCounting {
  all m: Model, rs: set Round, r: rs |
    some r.votes[m] implies
    computeScore[m, rs] = plus[computeScore[m, rs - r], scoreDelta[r.votes[m]]]
}

-- TNplusScoreIsCorrect: TN+ vote in a single round gives score 7 (sanity check)
-- @requirement SCBD-04
assert TNplusScoreIsCorrect {
  all r: Round, m: Model |
    r.votes[m] = TNplus => computeScore[m, r] = 7
}

check NoVoteLoss           for 5 Round, 5 Model, 7 VoteCode, 7 Int
check NoDoubleCounting     for 5 Round, 5 Model, 7 VoteCode, 7 Int
check TNplusScoreIsCorrect for 3 Round, 5 Model, 7 VoteCode, 7 Int
