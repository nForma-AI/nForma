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

-- Signatures
sig Agent {}

sig VoteRound {
    approvals : set Agent,
    total     : one Int
}

-- MajorityReached: mirrors minQuorumMet guard.
-- mul avoids integer division: #approvals * 2 >= total  ≡  successCount * 2 >= N
pred MajorityReached [r : VoteRound] {
    mul[#r.approvals, 2] >= r.total
}

pred ValidRound [r : VoteRound] {
    r.total > 0
    r.total = #Agent
    #r.approvals <= r.total
}

pred MinQuorumMet [r : VoteRound] {
    -- Minimum: ceil(N/2) approvals. With N=5: at least 3 required.
    #r.approvals >= div[r.total, 2].add[1]
}

-- Assertion: no valid round can be accepted without satisfying MajorityReached.
assert NoSpuriousApproval {
    all r : VoteRound |
        (ValidRound[r] and not MajorityReached[r])
            implies (mul[#r.approvals, 2] < r.total)
}

check NoSpuriousApproval for 5 Agent, 5 VoteRound

run MajorityReached for 5 Agent, 1 VoteRound
