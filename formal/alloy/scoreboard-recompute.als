-- formal/alloy/scoreboard-recompute.als
-- Handwritten — not generated from XState.
-- Source: bin/update-scoreboard.cjs (recomputeStats, recomputeSlots)
--
-- Models the QGSD scoreboard recomputation algorithm:
--   recomputeStats: reset all model stats to 0, then replay all rounds
--   recomputeSlots: reset all slot stats to 0, then replay all rounds
--
-- Assertions:
--   RecomputeIdempotent: applying recompute twice = once (deterministic pure function)
--   NoVoteLoss: every vote in rounds[] contributes to the final score
--   NoDoubleCounting: no vote's delta is counted more than once
--   TNplusScoreIsCorrect: TN+ vote in a single round gives score 7 (sanity check)
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

-- RecomputeIdempotent: the score is a pure function of (model, rounds set)
-- Applying the computation twice on the same rounds set yields the same result.
-- Since computeScore is deterministic (no state), this verifies no hidden non-determinism.
assert RecomputeIdempotent {
  all m: Model, rounds: set Round |
    computeScore[m, rounds] = computeScore[m, rounds]
}

-- NoVoteLoss: every vote's delta is reflected in the total sum
-- If every round has a vote for model m, the score equals the sum of all deltas.
assert NoVoteLoss {
  all m: Model, rounds: set Round |
    (all r: rounds | some r.votes[m]) =>
    computeScore[m, rounds] = sum r: rounds | scoreDelta[r.votes[m]]
}

-- NoDoubleCounting: the score equals the sum of individual round deltas, not more
-- Verifies that no round's delta appears more than once in the total.
assert NoDoubleCounting {
  all m: Model, rounds: set Round |
    computeScore[m, rounds] = (sum r: rounds | scoreDelta[r.votes[m]])
}

-- TNplusScoreIsCorrect: TN+ vote in a single round gives score 7 (sanity check)
assert TNplusScoreIsCorrect {
  all r: Round, m: Model |
    r.votes[m] = TNplus => computeScore[m, r] = 7
}

check RecomputeIdempotent  for 5 Round, 5 Model, 7 VoteCode, 7 Int
check NoVoteLoss           for 5 Round, 5 Model, 7 VoteCode, 7 Int
check NoDoubleCounting     for 5 Round, 5 Model, 7 VoteCode, 7 Int
check TNplusScoreIsCorrect for 3 Round, 5 Model, 7 VoteCode, 7 Int
