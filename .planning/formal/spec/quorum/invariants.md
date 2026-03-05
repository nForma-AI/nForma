# Liveness Fairness Declarations: quorum

**Spec source:** `formal/tla/QGSDQuorum.tla`
**Config:** `formal/tla/MCliveness.cfg`

## EventualConsensus

**Property:** `EventualConsensus == <>(phase = "DECIDED")`
**Config line:** `PROPERTY EventualConsensus` (MCliveness.cfg)
**Fairness assumption:** WF_vars on 4 actions: Decide, StartQuorum, AnyCollectVotes, AnyDeliberate
**Realism rationale:** The QGSD quorum orchestrator in `bin/run-quorum.cjs` processes slot worker responses sequentially via a wave-barrier loop. If a vote response is pending in the queue, the Decide or Deliberate action will become enabled and, by weak fairness, must eventually fire. The AnyCollectVotes and AnyDeliberate composite actions cover the existentially quantified set of voting slots — once any responsive slot's response arrives, the action is enabled. In a deployed system, the event loop guarantees that enabled I/O actions are not permanently skipped; WF captures this guarantee.

**Source:** `formal/tla/QGSDQuorum.tla`, lines 141, 148–152
