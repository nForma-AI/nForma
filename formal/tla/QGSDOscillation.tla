---- MODULE QGSDOscillation ----
(*
 * formal/tla/QGSDOscillation.tla
 * Handwritten — not generated from XState.
 * Source: hooks/qgsd-circuit-breaker.js (detectOscillation + hasReversionInHashes)
 *
 * Models the run-collapse oscillation detection algorithm.
 *
 * Key abstraction: file sets are represented as abstract labels from a finite
 * alphabet (e.g., {A, B, C}). The label represents the sorted-join key
 * produced by files.slice().sort().join('\0') in the JS implementation.
 * This avoids modeling file names while preserving the counting correctness property.
 *
 * State vars:
 *   commits    -- Seq of labels (abstract file-set identifiers); models hashes/fileSets arrays
 *   runs       -- Seq of labels after run-collapse (consecutive duplicates merged)
 *   flagCount  -- Function label -> count of run-groups with that label
 *   netChange  -- Integer: sum of (additions - deletions) across consecutive pairs
 *                 Negative or zero => genuine reversion; models hasReversionInHashes result
 *   flagged    -- BOOLEAN: whether oscillation was detected
 *   algorithmDone -- BOOLEAN: all algorithm steps have completed
 *)
EXTENDS Naturals, Sequences, FiniteSets, TLC

CONSTANTS
    Labels,       \* Abstract file-set identifiers e.g. {A, B, C}
    Depth,        \* Minimum alternating run-groups to trigger oscillation (default 3)
    CommitWindow  \* Maximum commits to inspect (default 5 for model checking)

ASSUME Depth \in Nat /\ Depth > 0
ASSUME CommitWindow \in Nat /\ CommitWindow > 0
ASSUME IsFiniteSet(Labels)

VARIABLES
    commits,       \* Sequence of label values (abstract commits)
    runs,          \* Run-collapse of commits
    flagCount,     \* [label -> Nat] count of run-groups per label
    netChange,     \* Integer diff sum (abstract: nondeterministically chosen)
    flagged,       \* BOOLEAN: oscillation detected
    algorithmDone  \* BOOLEAN: algorithm has completed all steps

vars == <<commits, runs, flagCount, netChange, flagged, algorithmDone>>

\* ── Type invariant ───────────────────────────────────────────────────────────
TypeOK ==
    /\ commits \in Seq(Labels)
    /\ Len(commits) <= CommitWindow
    /\ runs \in Seq(Labels)
    /\ flagCount \in [Labels -> Nat]
    /\ netChange \in -(CommitWindow)..(CommitWindow)
    /\ flagged \in BOOLEAN
    /\ algorithmDone \in BOOLEAN

\* ── Initial state ────────────────────────────────────────────────────────────
Init ==
    /\ commits      = <<>>
    /\ runs         = <<>>
    /\ flagCount    = [l \in Labels |-> 0]
    /\ netChange    = 0
    /\ flagged      = FALSE
    /\ algorithmDone = FALSE

\* ── Actions ──────────────────────────────────────────────────────────────────

\* AddCommit(label): extend the commits sequence with a new label.
\* Bounded by CommitWindow — no infinite sequences.
AddCommit(label) ==
    /\ ~algorithmDone
    /\ Len(commits) < CommitWindow
    /\ commits' = Append(commits, label)
    /\ UNCHANGED <<runs, flagCount, netChange, flagged, algorithmDone>>

\* CollapseRuns: compute the run-length encoding of commits.
\* Consecutive identical labels are merged into one run-group.
\* Result written to runs variable.
CollapseRuns ==
    /\ ~algorithmDone
    /\ Len(commits) > 0
    /\ LET collapsed ==
           LET RECURSIVE collapse(_, _)
               collapse(seq, acc) ==
                 IF seq = <<>> THEN acc
                 ELSE IF acc = <<>> \/ Head(seq) # Head(Tail(acc \o <<Head(seq)>>))
                      THEN collapse(Tail(seq), Append(acc, Head(seq)))
                      ELSE collapse(Tail(seq), acc)
           IN collapse(commits, <<>>)
       IN runs' = collapsed
    /\ UNCHANGED <<commits, flagCount, netChange, flagged, algorithmDone>>

\* ComputeFlagCount: count occurrences of each label in the collapsed runs sequence.
ComputeFlagCount ==
    /\ ~algorithmDone
    /\ runs # <<>>
    /\ flagCount' = [l \in Labels |->
           LET RECURSIVE countIn(_, _)
               countIn(seq, acc) ==
                 IF seq = <<>> THEN acc
                 ELSE countIn(Tail(seq), IF Head(seq) = l THEN acc + 1 ELSE acc)
           IN countIn(runs, 0)]
    /\ UNCHANGED <<commits, runs, netChange, flagged, algorithmDone>>

\* SetNetChange(n): nondeterministically set the net diff sum.
\* Models hasReversionInHashes result: negative/zero means genuine reversion.
SetNetChange(n) ==
    /\ ~algorithmDone
    /\ netChange' = n
    /\ UNCHANGED <<commits, runs, flagCount, flagged, algorithmDone>>

\* EvaluateFlag: set flagged based on OscillationFlaggedCorrectly predicate.
\* This is the terminal step — sets algorithmDone = TRUE.
EvaluateFlag ==
    /\ ~algorithmDone
    /\ flagged' = (\E l \in Labels : flagCount[l] >= Depth /\ netChange <= 0)
    /\ algorithmDone' = TRUE
    /\ UNCHANGED <<commits, runs, flagCount, netChange>>

Next ==
    \/ \E label \in Labels : AddCommit(label)
    \/ CollapseRuns
    \/ ComputeFlagCount
    \/ \E n \in -(CommitWindow)..(CommitWindow) : SetNetChange(n)
    \/ EvaluateFlag

\* ── Key invariant (GAP-1) ────────────────────────────────────────────────────

\* OscillationFlaggedCorrectly: the flagged boolean is TRUE iff there exists
\* a label whose run-group count meets the Depth threshold AND the net diff
\* is non-positive (genuine reversion, not TDD progression).
OscillationFlaggedCorrectly ==
    flagged <=>
        (\E l \in Labels : flagCount[l] >= Depth /\ netChange <= 0)

\* ── Liveness (terminates) ────────────────────────────────────────────────────

\* AlgorithmTerminates: every behavior eventually sets algorithmDone to TRUE.
\* WF_vars(EvaluateFlag) ensures EvaluateFlag fires once continuously enabled.
AlgorithmTerminates == <>(algorithmDone = TRUE)

\* ── Full specification ────────────────────────────────────────────────────────
Spec == Init /\ [][Next]_vars
        /\ WF_vars(EvaluateFlag)
        /\ WF_vars(CollapseRuns)

====
