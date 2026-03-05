// formal/prism/mcp-availability.pm
// MCPENV-04: Per-slot MCP availability model calibrated from scoreboard.
// Parameters (const) are injected at runtime by run-prism.cjs from quorum-scoreboard.json.
// Fall-back priors (0.85) used when scoreboard has insufficient data.
//
// Model type: DTMC (Discrete-Time Markov Chain)
// Each slot independently transitions between available/unavailable states.
// Steady-state analysis reveals the probability that quorum has at least one
// available external model per round.
//
// Usage (PRISM CLI):
//   prism formal/prism/mcp-availability.pm formal/prism/mcp-availability.props
//     -const codex_1_avail=0.95 -const gemini_1_avail=0.92
//
// Via run-prism.cjs (injects rates from scoreboard automatically):
//   node bin/run-prism.cjs --model mcp-availability
//
// Slots modeled: codex-1, gemini-1, opencode-1, copilot-1 (core 4 external slots)
// Extended slots (claude-1..6) use the same prior — add consts as needed.

dtmc

// Per-slot steady-state availability rates (overridden by run-prism.cjs at runtime)
// Rate interpretation: probability that slot responds in a given quorum round
const double codex_1_avail    = 0.85;  // prior; overridden by run-prism.cjs from scoreboard
const double gemini_1_avail   = 0.85;  // prior
const double opencode_1_avail = 0.85;  // prior
const double copilot_1_avail  = 0.85;  // prior

// Slots: 0 = unavailable, 1 = available
// Each slot modeled as an independent two-state Markov chain.
// At each step, the slot either stays available or becomes unavailable (or vice versa).
// The stationary distribution of state=1 converges to the availability rate.

module codex
  codex_s : [0..1] init 1;
  [] (codex_s=1) -> codex_1_avail    : (codex_s'=1)
                  + (1-codex_1_avail) : (codex_s'=0);
  [] (codex_s=0) -> codex_1_avail    : (codex_s'=1)
                  + (1-codex_1_avail) : (codex_s'=0);
endmodule

module gemini
  gemini_s : [0..1] init 1;
  [] (gemini_s=1) -> gemini_1_avail    : (gemini_s'=1)
                   + (1-gemini_1_avail) : (gemini_s'=0);
  [] (gemini_s=0) -> gemini_1_avail    : (gemini_s'=1)
                   + (1-gemini_1_avail) : (gemini_s'=0);
endmodule

module opencode
  opencode_s : [0..1] init 1;
  [] (opencode_s=1) -> opencode_1_avail    : (opencode_s'=1)
                     + (1-opencode_1_avail) : (opencode_s'=0);
  [] (opencode_s=0) -> opencode_1_avail    : (opencode_s'=1)
                     + (1-opencode_1_avail) : (opencode_s'=0);
endmodule

module copilot
  copilot_s : [0..1] init 1;
  [] (copilot_s=1) -> copilot_1_avail    : (copilot_s'=1)
                    + (1-copilot_1_avail) : (copilot_s'=0);
  [] (copilot_s=0) -> copilot_1_avail    : (copilot_s'=1)
                    + (1-copilot_1_avail) : (copilot_s'=0);
endmodule

// Labels for property checking
// min_quorum_available: at least one external slot is available (minimum for any quorum response)
label "min_quorum_available" =
  codex_s=1 | gemini_s=1 | opencode_s=1 | copilot_s=1;

// total_outage: all external slots unavailable simultaneously
label "total_outage" =
  codex_s=0 & gemini_s=0 & opencode_s=0 & copilot_s=0;

// majority_available: at least 2 of 4 slots available (reduced quorum threshold)
label "majority_available" =
  (codex_s + gemini_s + opencode_s + copilot_s) >= 2;
