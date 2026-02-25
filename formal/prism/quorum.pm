// formal/prism/quorum.pm
// QGSD Quorum Convergence — DTMC Model
// Requirements: PRM-01
//
// Discrete-Time Markov Chain modeling QGSD quorum state transitions.
// States: 0=COLLECTING_VOTES, 1=DECIDED, 2=DELIBERATING
//
// Default rates are conservative priors. Override with empirical values from:
//   node bin/export-prism-constants.cjs
//
// To run with PRISM (requires PRISM_BIN env var pointing to prism shell script):
//   $PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]"
//
// To override rates from command line (no file-include in PRISM):
//   $PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]" -const tp_rate=0.9274 -const unavail=0.0215
//
// PRISM has no file-import. To use empirical rates from rates.const:
// either copy the const declarations below, or pass each as a -const CLI flag.

dtmc

// Slot aggregate rates (conservative priors — override with empirical data)
// tp_rate   = P(a slot votes APPROVE | it is AVAILABLE)
// unavail   = P(slot is UNAVAILABLE in a given round)
const double tp_rate = 0.85;   // conservative prior (see bin/export-prism-constants.cjs)
const double unavail = 0.15;   // conservative prior (see bin/export-prism-constants.cjs)

// Module: quorum_convergence
// s = 0 : COLLECTING_VOTES (initial state)
// s = 1 : DECIDED          (absorbing — consensus reached or forced)
// s = 2 : DELIBERATING     (retry — majority not reached in first pass)
module quorum_convergence
    s : [0..2] init 0;

    // From COLLECTING_VOTES:
    // If majority of available slots approve -> DECIDED
    // Otherwise -> DELIBERATING (retry round)
    [] s=0 -> (tp_rate * (1 - unavail)) : (s'=1)
            + (1 - tp_rate * (1 - unavail)) : (s'=2);

    // From DELIBERATING: same transition probabilities (memoryless DTMC)
    [] s=2 -> (tp_rate * (1 - unavail)) : (s'=1)
            + (1 - tp_rate * (1 - unavail)) : (s'=2);

    // DECIDED is an absorbing state
    [] s=1 -> 1.0 : (s'=1);

endmodule

// Properties (for reference — run with -pf flag, not inline):
// P=? [ F s=1 ]        — probability of eventually reaching DECIDED
// R=? [ F s=1 ]        — expected rounds until DECIDED (add reward structure above)
