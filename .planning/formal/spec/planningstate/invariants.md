# Liveness Fairness Declarations: planningstate

**Spec source:** `formal/tla/QGSDPlanningState.tla`
**Config:** `formal/tla/MCPlanningState.cfg`

## RouteCLiveness

**Property:** `RouteCLiveness == allPhasesComplete ~> auditTriggered`
**Config line:** `PROPERTY RouteCLiveness` (MCPlanningState.cfg)
**Fairness assumption:** WF_vars on RouteC action
**Realism rationale:** When all phases are complete, the RouteC action chains into audit-milestone. By weak fairness, if RouteC is continuously enabled (all phases complete and audit not yet triggered), it must eventually fire — models the fact that execute-plan Route C is a deterministic skill dispatch that completes in bounded time. The Spec definition in QGSDPlanningState.tla embeds `WF_vars(RouteC)`.

**Source:** `formal/tla/QGSDPlanningState.tla`, Spec definition

## FallbackLiveness

**Property:** `FallbackLiveness == <>(nextPhaseResolved \/ allPhasesComplete)`
**Config line:** `PROPERTY FallbackLiveness` (MCPlanningState.cfg)
**Fairness assumption:** WF_vars on ResolveNextPhaseFromDir and FallbackToHeadingParse actions
**Realism rationale:** Phase-complete must eventually resolve the next phase. If the next-phase directory exists, ResolveNextPhaseFromDir fires. If not, FallbackToHeadingParse parses ROADMAP.md headings. Weak fairness on both ensures one eventually fires — models the fact that the filesystem check and heading parse are synchronous operations. The Spec definition embeds `WF_vars(ResolveNextPhaseFromDir) /\ WF_vars(FallbackToHeadingParse)`.

**Source:** `formal/tla/QGSDPlanningState.tla`, Spec definition
