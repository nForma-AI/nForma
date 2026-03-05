// .formal/prism/observability-delivery.pm
// Models quorum observability: telemetry, delivery rate, flakiness scoring.
// Source: quorum-scoreboard.json, hooks/qgsd-prompt.js
//
// @requirement OBS-01
// @requirement OBS-02
// @requirement OBS-03
// @requirement OBS-04
//
// Model type: DTMC (Discrete-Time Markov Chain)
// Each quorum round, slots independently produce a verdict or fail.
// Tracks delivery rate (3/3 vs degraded) and per-slot flakiness.
//
// Usage:
//   prism .formal/prism/observability-delivery.pm .formal/prism/observability-delivery.props
//     -const slot1_reliability=0.90 -const slot2_reliability=0.85 -const slot3_reliability=0.80

dtmc

// Per-slot reliability (probability of delivering a verdict in a round)
const double slot1_reliability = 0.90;  // override from scoreboard
const double slot2_reliability = 0.85;
const double slot3_reliability = 0.80;

// Flakiness threshold: if reliability < this, slot is deprioritized
const double flakiness_threshold = 0.70;

// Round counter (bounded for model checking)
const int MAX_ROUNDS = 5;

// Slot states: 0 = unavailable this round, 1 = delivered verdict
module slot1
  s1 : [0..1] init 1;
  [] (s1=1) -> slot1_reliability    : (s1'=1)
            + (1-slot1_reliability) : (s1'=0);
  [] (s1=0) -> slot1_reliability    : (s1'=1)
            + (1-slot1_reliability) : (s1'=0);
endmodule

module slot2
  s2 : [0..1] init 1;
  [] (s2=1) -> slot2_reliability    : (s2'=1)
            + (1-slot2_reliability) : (s2'=0);
  [] (s2=0) -> slot2_reliability    : (s2'=1)
            + (1-slot2_reliability) : (s2'=0);
endmodule

module slot3
  s3 : [0..1] init 1;
  [] (s3=1) -> slot3_reliability    : (s3'=1)
            + (1-slot3_reliability) : (s3'=0);
  [] (s3=0) -> slot3_reliability    : (s3'=1)
            + (1-slot3_reliability) : (s3'=0);
endmodule

// OBS-02: Full delivery = all 3 slots delivered
label "full_delivery" = s1=1 & s2=1 & s3=1;

// OBS-02: Degraded = at least 2 of 3 delivered but not all
label "degraded_delivery" = (s1 + s2 + s3) >= 2 & (s1 + s2 + s3) < 3;

// At least one slot delivered (minimum quorum)
label "any_delivery" = (s1 + s2 + s3) >= 1;

// Total failure: no slots delivered
label "total_failure" = s1=0 & s2=0 & s3=0;

// OBS-03: Individual slot unavailable (for flakiness tracking)
label "slot1_unavail" = s1=0;
label "slot2_unavail" = s2=0;
label "slot3_unavail" = s3=0;
