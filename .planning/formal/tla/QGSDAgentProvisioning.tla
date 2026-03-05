---- MODULE QGSDAgentProvisioning ----
(*
 * .formal/tla/QGSDAgentProvisioning.tla
 * Handwritten — models agent lifecycle: add, remove, provision, presets, clone.
 * Source: bin/qgsd.cjs (wizard), bin/account-manager.cjs
 *
 * @requirement AGENT-01
 * @requirement AGENT-02
 * @requirement AGENT-03
 * @requirement PROV-01
 * @requirement PROV-02
 * @requirement PROV-03
 * @requirement PRST-01
 * @requirement PRST-02
 *)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS MaxSlots

VARIABLES
    roster,         \* set of slot IDs currently provisioned (0..MaxSlots-1)
    verified,       \* set of slot IDs that passed identity ping
    baseUrls,       \* function: slot -> {"akash","together","fireworks","custom"}
    phase           \* "idle" | "adding" | "removing" | "changing_url" | "cloning" | "verifying"

vars == <<roster, verified, baseUrls, phase>>

Providers == {"akash", "together", "fireworks", "custom"}
Phases == {"idle", "adding", "removing", "changing_url", "cloning", "verifying"}

TypeOK ==
    /\ roster   \in SUBSET (0..(MaxSlots-1))
    /\ verified \in SUBSET (0..(MaxSlots-1))
    /\ phase    \in Phases

Init ==
    /\ roster   = {}
    /\ verified = {}
    /\ baseUrls = [s \in {} |-> "akash"]  \* empty function
    /\ phase    = "idle"

\* ── Actions ────────────────────────────────────────────────────────────────

\* AGENT-01: Add a new agent
\* @requirement AGENT-01
\* @requirement PROV-02
\* @requirement PRST-01
AddAgent(slot, provider) ==
    /\ phase = "idle"
    /\ slot \in 0..(MaxSlots-1)
    /\ slot \notin roster
    /\ provider \in Providers
    /\ roster'   = roster \union {slot}
    /\ baseUrls' = [s \in roster' |-> IF s = slot THEN provider ELSE baseUrls[s]]
    /\ phase'    = "adding"
    /\ UNCHANGED verified

\* AGENT-03: Verify connectivity after provisioning
\* @requirement AGENT-03
VerifyAgent(slot) ==
    /\ phase = "adding"
    /\ slot \in roster
    /\ slot \notin verified
    /\ verified' = verified \union {slot}
    /\ phase'    = "verifying"
    /\ UNCHANGED <<roster, baseUrls>>

\* AGENT-02: Remove an existing agent
\* @requirement AGENT-02
RemoveAgent(slot) ==
    /\ phase = "idle"
    /\ slot \in roster
    /\ roster'   = roster \ {slot}
    /\ verified' = verified \ {slot}
    /\ baseUrls' = [s \in (roster \ {slot}) |-> baseUrls[s]]
    /\ phase'    = "removing"
    /\ UNCHANGED <<>>

\* PROV-01, PROV-03: Change base URL for existing agent
\* @requirement PROV-01
\* @requirement PROV-03
ChangeProvider(slot, provider) ==
    /\ phase = "idle"
    /\ slot \in roster
    /\ provider \in Providers
    /\ baseUrls' = [s \in roster |-> IF s = slot THEN provider ELSE baseUrls[s]]
    /\ verified' = verified \ {slot}  \* re-verification needed after URL change
    /\ phase'    = "changing_url"
    /\ UNCHANGED roster

\* PRST-02: Clone an existing slot
\* @requirement PRST-02
CloneSlot(source, target) ==
    /\ phase = "idle"
    /\ source \in roster
    /\ target \in 0..(MaxSlots-1)
    /\ target \notin roster
    /\ roster'   = roster \union {target}
    /\ baseUrls' = [s \in roster' |-> IF s = target THEN baseUrls[source] ELSE baseUrls[s]]
    /\ phase'    = "cloning"
    /\ UNCHANGED verified

\* Return to idle
ReturnToIdle ==
    /\ phase # "idle"
    /\ phase' = "idle"
    /\ UNCHANGED <<roster, verified, baseUrls>>

Next ==
    \/ \E s \in 0..(MaxSlots-1), p \in Providers : AddAgent(s, p)
    \/ \E s \in 0..(MaxSlots-1) : VerifyAgent(s)
    \/ \E s \in 0..(MaxSlots-1) : RemoveAgent(s)
    \/ \E s \in 0..(MaxSlots-1), p \in Providers : ChangeProvider(s, p)
    \/ \E s1 \in 0..(MaxSlots-1), s2 \in 0..(MaxSlots-1) : CloneSlot(s1, s2)
    \/ ReturnToIdle

\* ── Safety invariants ──────────────────────────────────────────────────────

\* @requirement AGENT-01
\* Verified agents are always in roster
VerifiedInRoster ==
    verified \subseteq roster

\* @requirement AGENT-02
\* Removing a slot clears its verification
RemoveClears ==
    \A s \in 0..(MaxSlots-1) :
        s \notin roster => s \notin verified

\* @requirement PROV-01
\* Provider change invalidates verification (need re-verify)
ProviderChangeInvalidates ==
    phase = "changing_url" =>
        \E s \in roster : s \notin verified

Spec ==
    /\ Init
    /\ [][Next]_vars

====
