---- MODULE NFGatePromotion ----
(*
 * formal/tla/NFGatePromotion.tla
 * Handwritten -- not generated from XState.
 * Source: bin/gate-stability.cjs, bin/nf-solve.cjs
 *
 * Models the gate promotion lifecycle: how models advance from SOFT_GATE
 * to HARD_GATE based on consecutive clean sessions, with flip-flop detection
 * and cooldown enforcement to prevent unstable promotions.
 *
 * Key abstractions:
 * - Maturity levels: SOFT_GATE < HARD_GATE (two-level promotion)
 * - Consecutive clean sessions tracked per model
 * - Flip-flop: model demoted then re-promoted within a window
 * - Cooldown timer prevents promotion after demotion
 * - Promotion changelog tracks all promotion events (deduplicated)
 *
 * @requirement PROMO-01  (eligibility check before promotion)
 * @requirement PROMO-02  (consecutive clean session tracking)
 * @requirement PROMO-03  (promotion execution)
 * @requirement PROMO-04  (promotion changelog logging)
 * @requirement PROMO-05  (flip-flop detection)
 * @requirement STAB-01   (flip-flop prevents promotion)
 * @requirement STAB-02   (cooldown enforcement)
 * @requirement STAB-03   (no duplicate log entries)
 *)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS
    MaxSessions,        \* Bound on consecutive clean session counter (5)
    CooldownThreshold,  \* Sessions required before promotion after demotion (3)
    FlipFlopLimit       \* Number of direction changes that constitute flip-flop (3)

ASSUME MaxSessions \in Nat /\ MaxSessions > 0
ASSUME CooldownThreshold \in Nat /\ CooldownThreshold > 0
ASSUME FlipFlopLimit \in Nat /\ FlipFlopLimit > 0

\* Maturity levels (ordered: SOFT_GATE < HARD_GATE)
MaturityLevel == {"SOFT_GATE", "HARD_GATE"}

\* Stability status values
StabilityStatus == {"STABLE", "UNSTABLE", "COOLING_DOWN"}

\* Log entry types for deduplication
LogEntryType == {"PROMOTE", "DEMOTE"}

VARIABLES
    maturity,                \* Current maturity level
    consecutive_clean,       \* Nat: consecutive clean sessions counter
    cooldown_timer,          \* Nat: remaining cooldown sessions (0 = no cooldown)
    promotion_log,           \* Seq of [type: LogEntryType, session: Nat] entries
    stability,               \* StabilityStatus
    flip_flop_count,         \* Nat: number of direction changes detected
    session_counter,         \* Nat: global session counter for log timestamps
    done                     \* BOOLEAN: model reached terminal state

vars == <<maturity, consecutive_clean, cooldown_timer, promotion_log,
          stability, flip_flop_count, session_counter, done>>

\* ---- Type invariant -------------------------------------------------------
TypeOK ==
    /\ maturity \in MaturityLevel
    /\ consecutive_clean \in 0..MaxSessions
    /\ cooldown_timer \in 0..CooldownThreshold
    /\ promotion_log \in Seq(LogEntryType \X (0..MaxSessions*2))
    /\ Len(promotion_log) <= MaxSessions * 2
    /\ stability \in StabilityStatus
    /\ flip_flop_count \in 0..FlipFlopLimit
    /\ session_counter \in 0..MaxSessions*2
    /\ done \in BOOLEAN

\* ---- Initial state ---------------------------------------------------------
Init ==
    /\ maturity = "SOFT_GATE"
    /\ consecutive_clean = 0
    /\ cooldown_timer = 0
    /\ promotion_log = <<>>
    /\ stability = "STABLE"
    /\ flip_flop_count = 0
    /\ session_counter = 0
    /\ done = FALSE

\* ---- Helper predicates -----------------------------------------------------

\* @requirement PROMO-01 (eligibility check)
Eligible ==
    /\ maturity = "SOFT_GATE"
    /\ consecutive_clean >= CooldownThreshold
    /\ cooldown_timer = 0
    /\ stability # "UNSTABLE"

\* Check if a log entry already exists (for deduplication)
\* @requirement STAB-03
LogContains(typ, sess) ==
    \E i \in 1..Len(promotion_log) : promotion_log[i] = <<typ, sess>>

\* ---- Actions ---------------------------------------------------------------

\* IncrementCleanSession: record a clean (non-regressing) session.
\* @requirement PROMO-02
IncrementCleanSession ==
    /\ ~done
    /\ session_counter < MaxSessions * 2
    /\ consecutive_clean < MaxSessions
    /\ session_counter' = session_counter + 1
    /\ consecutive_clean' = consecutive_clean + 1
    /\ IF cooldown_timer > 0
       THEN cooldown_timer' = cooldown_timer - 1
       ELSE cooldown_timer' = 0
    /\ IF cooldown_timer = 1
       THEN stability' = "STABLE"
       ELSE stability' = stability
    /\ UNCHANGED <<maturity, promotion_log, flip_flop_count, done>>

\* RecordDirtySession: a session that breaks the clean streak.
RecordDirtySession ==
    /\ ~done
    /\ session_counter < MaxSessions * 2
    /\ session_counter' = session_counter + 1
    /\ consecutive_clean' = 0
    /\ UNCHANGED <<maturity, cooldown_timer, promotion_log, stability, flip_flop_count, done>>

\* Promote: advance maturity from SOFT_GATE to HARD_GATE.
\* @requirement PROMO-03
Promote ==
    /\ ~done
    /\ Eligible
    /\ maturity' = "HARD_GATE"
    /\ consecutive_clean' = 0
    \* @requirement PROMO-04 (log promotion, deduplicated)
    /\ IF ~LogContains("PROMOTE", session_counter)
       THEN promotion_log' = Append(promotion_log, <<"PROMOTE", session_counter>>)
       ELSE promotion_log' = promotion_log
    /\ UNCHANGED <<cooldown_timer, stability, flip_flop_count, session_counter, done>>

\* Demote: revert from HARD_GATE back to SOFT_GATE (regression detected).
Demote ==
    /\ ~done
    /\ maturity = "HARD_GATE"
    /\ maturity' = "SOFT_GATE"
    /\ consecutive_clean' = 0
    \* @requirement STAB-02 (engage cooldown on demotion)
    /\ cooldown_timer' = CooldownThreshold
    /\ stability' = "COOLING_DOWN"
    \* @requirement PROMO-05 (track flip-flop)
    /\ flip_flop_count' = flip_flop_count + 1
    \* @requirement PROMO-04 (log demotion, deduplicated)
    /\ IF ~LogContains("DEMOTE", session_counter)
       THEN promotion_log' = Append(promotion_log, <<"DEMOTE", session_counter>>)
       ELSE promotion_log' = promotion_log
    /\ UNCHANGED <<session_counter, done>>

\* DetectFlipFlop: when flip-flop count reaches limit, mark as UNSTABLE.
\* @requirement PROMO-05
\* @requirement STAB-01
DetectFlipFlop ==
    /\ ~done
    /\ flip_flop_count >= FlipFlopLimit
    /\ stability' = "UNSTABLE"
    /\ done' = TRUE
    /\ UNCHANGED <<maturity, consecutive_clean, cooldown_timer, promotion_log,
                   flip_flop_count, session_counter>>

\* Terminate: model has reached a terminal state (promoted to HARD_GATE and stable).
Terminate ==
    /\ ~done
    /\ maturity = "HARD_GATE"
    /\ stability = "STABLE"
    /\ done' = TRUE
    /\ UNCHANGED <<maturity, consecutive_clean, cooldown_timer, promotion_log,
                   stability, flip_flop_count, session_counter>>

\* ---- Next state relation ---------------------------------------------------
Next ==
    \/ IncrementCleanSession
    \/ RecordDirtySession
    \/ Promote
    \/ Demote
    \/ DetectFlipFlop
    \/ Terminate

\* ---- Safety invariants -----------------------------------------------------

\* @requirement STAB-01 (flip-flop prevents promotion)
\* An unstable model is never at HARD_GATE maturity.
FlipFlopPreventsPromotion ==
    stability = "UNSTABLE" => maturity = "SOFT_GATE"

\* @requirement STAB-02 (no promotion during cooldown)
\* Cooldown timer > 0 implies maturity stays at SOFT_GATE.
CooldownEnforced ==
    cooldown_timer > 0 => maturity = "SOFT_GATE"

\* @requirement PROMO-04 (all promotions/demotions logged)
\* After a promote or demote, the promotion_log is non-empty — every
\* maturity transition is recorded with timestamp and session_id.
PromotionAlwaysLogged ==
    (maturity = "HARD_GATE" \/ done) => Len(promotion_log) > 0

\* @requirement STAB-03 (no duplicate log entries)
\* Every entry in the promotion log is unique.
NoDuplicateLogEntries ==
    \A i, j \in 1..Len(promotion_log) :
        i # j => promotion_log[i] # promotion_log[j]

\* ---- Liveness property -----------------------------------------------------
\* The system eventually reaches a terminal state (promoted+stable or unstable).
EventualTermination == <>(done = TRUE)

\* ---- Full specification with fairness --------------------------------------
\* WF on IncrementCleanSession: clean sessions keep arriving.
\* WF on DetectFlipFlop: instability is eventually detected.
\* WF on Terminate: terminal states are eventually recognized.
Spec == Init /\ [][Next]_vars
        /\ WF_vars(IncrementCleanSession)
        /\ WF_vars(DetectFlipFlop)
        /\ WF_vars(Terminate)

====
