# Liveness Fairness Declarations: stop-hook

**Spec source:** `formal/tla/QGSDStopHook.tla`
**Config:** `formal/tla/MCStopHook.cfg`

## LivenessProperty1

**Property:** `LivenessProperty1 == <>algorithmDone`
**Config line:** `PROPERTY LivenessProperty1` (MCStopHook.cfg)
**Fairness assumption:** WF_vars on 3 actions: MakeDecision, DetectCommand, DetectQuorumEvidence
**Realism rationale:** The stop hook algorithm processes the transcript and makes a PASS/BLOCK decision. MakeDecision fires once all evidence has been gathered. DetectCommand and DetectQuorumEvidence scan the transcript for patterns. By weak fairness, if these actions are continuously enabled (transcript available, evidence present), they must eventually fire — models the fact that the synchronous transcript scan completes in bounded time. The Spec definition in QGSDStopHook.tla embeds `WF_vars(MakeDecision) /\ WF_vars(DetectCommand) /\ WF_vars(DetectQuorumEvidence)`.

**Source:** `formal/tla/QGSDStopHook.tla`, line 165

## LivenessProperty2

**Property:** `LivenessProperty2 == hasQuorumEvidence => <>(decision = "PASS")`
**Config line:** `PROPERTY LivenessProperty2` (MCStopHook.cfg)
**Fairness assumption:** WF_vars on MakeDecision (same as LivenessProperty1 — shared Spec definition)
**Realism rationale:** When quorum evidence is detected in the transcript, the MakeDecision action eventually fires and sets decision to PASS. The weak fairness assumption on MakeDecision ensures this happens — once evidence is gathered, the decision action is continuously enabled until it fires.

**Source:** `formal/tla/QGSDStopHook.tla`, line 172

## LivenessProperty3

**Property:** `LivenessProperty3 == (hasCommand /\ ~hasQuorumEvidence) => <>(decision = "BLOCK")`
**Config line:** `PROPERTY LivenessProperty3` (MCStopHook.cfg)
**Fairness assumption:** WF_vars on MakeDecision (same Spec definition)
**Realism rationale:** When a planning command is detected but no quorum evidence exists, MakeDecision fires and sets decision to BLOCK. Same fairness rationale as LivenessProperty2 — the synchronous decision logic completes once enabled.

**Source:** `formal/tla/QGSDStopHook.tla`, line 179
