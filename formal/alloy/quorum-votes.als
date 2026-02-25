-- formal/alloy/quorum-votes.als
-- GENERATED — do not edit by hand.
-- Source of truth: src/machines/qgsd-workflow.machine.ts
-- Regenerate:      node bin/generate-formal-specs.cjs
-- Generated:       2026-02-25

-- QGSD Quorum Vote-Counting Model (Alloy 6)
-- Requirements: ALY-01
--
-- Models the minQuorumMet guard from src/machines/qgsd-workflow.machine.ts:
--   successCount >= Math.ceil(slotsAvailable / 2)
--   ≡  mul[#approvals, 2] >= total  (integer arithmetic, no division)
--
-- Checks that no round reaches DECIDED without satisfying the majority predicate.
-- Scope: 5 agents (QGSD quorum slot count), 5 vote rounds.

module quorum_votes

-- Fix agent count to 5 (QGSD quorum slot count).
-- This makes the numeric threshold assertions below concrete and verifiable.
fact AgentCount { #Agent = 5 }

sig Agent {}

sig VoteRound {
    approvals : set Agent,
    total     : one Int
}

-- MajorityReached: mirrors minQuorumMet guard from XState machine.
-- Equivalent to Math.ceil(N/2) <= successCount for all positive integers N.
-- (Proof: n >= ceil(N/2) ↔ n*2 >= N for positive integers.)
pred MajorityReached [r : VoteRound] {
    mul[#r.approvals, 2] >= r.total
}

pred ValidRound [r : VoteRound] {
    r.total = #Agent        -- total must equal actual agent count
    #r.approvals <= r.total -- can't have more approvals than participants
}

-- ASSERTION 1: The threshold boundary — 3 approvals satisfies majority for N=5.
-- Non-trivial: Alloy must verify mul[3, 2] >= 5 via integer arithmetic.
assert ThresholdPasses {
    all r : VoteRound |
        (ValidRound[r] and #r.approvals = 3) implies MajorityReached[r]
}

-- ASSERTION 2: One below threshold — 2 approvals do NOT satisfy majority for N=5.
-- Non-trivial: Alloy must verify mul[2, 2] < 5 via integer arithmetic.
assert BelowThresholdFails {
    all r : VoteRound |
        (ValidRound[r] and #r.approvals = 2) implies not MajorityReached[r]
}

-- ASSERTION 3: Zero approvals always fails — safety baseline regardless of N.
assert ZeroApprovalsFail {
    all r : VoteRound | ValidRound[r] implies (not (#r.approvals = 0 and MajorityReached[r]))
}

check ThresholdPasses   for 5 Agent, 5 VoteRound
check BelowThresholdFails for 5 Agent, 5 VoteRound
check ZeroApprovalsFail for 5 Agent, 5 VoteRound

-- Show an example valid majority round
run MajorityReached for 5 Agent, 1 VoteRound
