---- MODULE QGSDRecruiting ----
(*
 * formal/tla/QGSDRecruiting.tla
 *
 * Models the quorum recruitment subprocess: ordered slot selection with
 * sub-before-api policy, skip-if-unresponsive, and MaxSize ceiling.
 *
 * Complements QGSDQuorum.tla by proving the three properties that the main
 * model accepts as opaque black-box inputs:
 *
 *   R1  PolledCeiling    Cardinality(recruited) <= MaxSize
 *   R2  SubslotsFirst    no api slot enters recruited while untried sub slots remain
 *   R3  FullRecruitment  Cardinality(Responsive) >= MaxSize => <>(Cardinality(recruited) = MaxSize)
 *
 * Key design choices:
 *   - Responsive is a CONSTANT: TLC checks one specific availability scenario per run.
 *     Use MCrecruiting-safety.cfg for safety (mixed availability) and
 *     MCrecruiting-liveness.cfg for liveness (enough slots responsive).
 *   - "Skip-if-unresponsive" is modeled by adding s to tried but NOT to recruited
 *     when s \notin Responsive. This produces the reduced polledCount that
 *     QGSDQuorum.tla models as nondeterministic p \in 1..MaxSize.
 *   - AllSubsTried gate on TryApiSlot encodes the sub-before-api policy
 *     (qgsd-prompt.js preferSub ordering guarantee, tested by TC-PROMPT-PREFER-SUB-DEFAULT).
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS
    SubSlots,   \* Finite set of sub-type slot identifiers (tried first)
    ApiSlots,   \* Finite set of api-type slot identifiers (tried after SubSlots exhausted)
    MaxSize,    \* Hard cap on polledCount — mirrors qgsd.json quorum.maxSize
    Responsive  \* Subset of AllSlots that respond in this model run

ASSUME SubSlots \cap ApiSlots = {}
ASSUME Responsive \subseteq (SubSlots \cup ApiSlots)
ASSUME MaxSize \in Nat /\ MaxSize > 0
ASSUME Cardinality(SubSlots \cup ApiSlots) > 0

AllSlots == SubSlots \cup ApiSlots

VARIABLES
    recruited,  \* set of slots that responded and were recruited
    tried,      \* set of slots already attempted (responsive or not)
    phase       \* "RECRUITING" | "DONE"

vars == <<recruited, tried, phase>>

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ recruited \subseteq AllSlots
    /\ tried     \subseteq AllSlots
    /\ recruited \subseteq tried        \* can only recruit a slot after trying it
    /\ recruited \subseteq Responsive   \* only responsive slots enter recruited
    /\ phase \in {"RECRUITING", "DONE"}

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ recruited = {}
    /\ tried     = {}
    /\ phase     = "RECRUITING"

\* ── Helper predicates ────────────────────────────────────────────────────────

\* Ordering gate: all sub slots have been attempted (responsive or not)
AllSubsTried == SubSlots \subseteq tried

\* Recruitment can continue: cap not yet hit and untried slots remain
CanRecruit ==
    /\ Cardinality(recruited) < MaxSize
    /\ tried /= AllSlots

\* ── Actions ──────────────────────────────────────────────────────────────────

\* Try a sub-type slot — no ordering prerequisite
TrySubSlot(s) ==
    /\ phase = "RECRUITING"
    /\ CanRecruit
    /\ s \in SubSlots
    /\ s \notin tried
    /\ LET newRecruited == IF s \in Responsive THEN recruited \cup {s} ELSE recruited
       IN /\ tried'     = tried \cup {s}
          /\ recruited' = newRecruited
          /\ phase'     = IF Cardinality(newRecruited) = MaxSize THEN "DONE" ELSE "RECRUITING"

\* Try an api-type slot — ONLY after all sub slots have been attempted
TryApiSlot(s) ==
    /\ phase = "RECRUITING"
    /\ CanRecruit
    /\ s \in ApiSlots
    /\ s \notin tried
    /\ AllSubsTried     \* sub-before-api ordering constraint
    /\ LET newRecruited == IF s \in Responsive THEN recruited \cup {s} ELSE recruited
       IN /\ tried'     = tried \cup {s}
          /\ recruited' = newRecruited
          /\ phase'     = IF Cardinality(newRecruited) = MaxSize THEN "DONE" ELSE "RECRUITING"

\* Declare done: cap reached or roster exhausted — no more slots to try
Finish ==
    /\ phase = "RECRUITING"
    /\ ~CanRecruit
    /\ phase'     = "DONE"
    /\ UNCHANGED <<recruited, tried>>

Next ==
    \/ \E s \in SubSlots : TrySubSlot(s)
    \/ \E s \in ApiSlots : TryApiSlot(s)
    \/ Finish

\* ── Safety invariants ────────────────────────────────────────────────────────

\* R1: polledCount (Cardinality(recruited)) never exceeds the cap
PolledCeiling ==
    Cardinality(recruited) <= MaxSize

\* R2: no api slot enters recruited while untried sub slots remain
SubslotsFirst ==
    (\E s \in ApiSlots : s \in recruited) => AllSubsTried

\* ── Liveness ─────────────────────────────────────────────────────────────────

\* R3: when enough slots respond, recruitment reaches full capacity
EnoughResponsive == Cardinality(Responsive) >= MaxSize
FullRecruitment  == EnoughResponsive => <>(Cardinality(recruited) = MaxSize)

\* ── Spec with fairness ───────────────────────────────────────────────────────
\* WF on each action ensures TLC cannot stall indefinitely on a state where
\* a move is continuously enabled — this models the sequential slot-trying loop.
Spec ==
    Init /\ [][Next]_vars
    /\ WF_vars(Finish)
    /\ \A ss \in SubSlots : WF_vars(TrySubSlot(ss))
    /\ \A sa \in ApiSlots : WF_vars(TryApiSlot(sa))

====
