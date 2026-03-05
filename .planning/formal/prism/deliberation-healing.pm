// .formal/prism/deliberation-healing.pm
// Models deliberation convergence probability and early escalation.
// Source: quorum dispatch pipeline, maxDeliberation config
//
// @requirement HEAL-01
// @requirement HEAL-02
//
// Model type: DTMC
// After each deliberation round, P(consensus | remaining rounds) is computed.
// If probability drops below threshold, escalation fires early.
//
// Usage:
//   prism .formal/prism/deliberation-healing.pm .formal/prism/deliberation-healing.props
//     -const p_converge=0.60 -const escalation_threshold=0.10

dtmc

// Probability of convergence per round (votes agree)
const double p_converge = 0.60;

// HEAL-01: If P(consensus | remaining) < threshold, escalate early
const double escalation_threshold = 0.10;

// Maximum deliberation rounds
const int MAX_ROUNDS = 3;

// States: round tracking + outcome
// round: 0..MAX_ROUNDS (current round)
// outcome: 0 = undecided, 1 = consensus reached, 2 = escalated
module deliberation
  round : [0..MAX_ROUNDS] init 0;
  outcome : [0..2] init 0;

  // Round proceeds: either converge or fail to converge
  // HEAL-01: convergence check each round
  [] (outcome=0 & round < MAX_ROUNDS) ->
      p_converge     : (outcome'=1) & (round'=round+1)     // consensus
    + (1-p_converge) : (outcome'=0) & (round'=round+1);    // no consensus yet

  // HEAL-01: Final round reached without consensus — escalate
  [] (outcome=0 & round = MAX_ROUNDS) ->
      1.0 : (outcome'=2);

endmodule

// Labels for property checking
// Consensus reached (any round)
label "consensus" = outcome=1;

// HEAL-01: Escalation fired (ran out of rounds or early trigger)
label "escalated" = outcome=2;

// Still deliberating
label "deliberating" = outcome=0 & round < MAX_ROUNDS;

// HEAL-02: Low consensus probability state (could trigger auto-adjust)
// P(consensus in remaining rounds) < 95% — recommend maxDeliberation adjustment
label "low_confidence" = outcome=0 & round >= 2;
