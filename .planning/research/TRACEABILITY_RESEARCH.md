# Formal Verification ↔ Human Requirements Traceability Research

**Date:** 2026-03-03
**Scope:** QGSD project — 210 requirements, 22 formal models (11 TLA+, 8 Alloy, 3 PRISM), 1 UPPAAL model
**Status:** Research complete

---

## 1. Executive Summary

The QGSD project has accumulated a substantial formal verification corpus (30 verification steps, 22+ models, 210 requirements) but lacks any structured linkage between human requirements and the formal properties that verify them. This research investigates the current state of all artifacts, surveys industry traceability practices (DO-178C/DO-333, ISO 26262, IEC 61508), analyzes model state spaces for explosion risk, maps every formal property to its closest matching requirement(s), evaluates schema design options for encoding traceability, and proposes decomposition strategies for models at risk. The recommended approach is a **hybrid schema**: lightweight inline annotations in existing files (model-registry, requirements, check-results) plus a derived `traceability-matrix.json` artifact generated at verification time, following the DO-333 bidirectional traceability model with property-level granularity.

---

## 2. Current State Analysis

### 2.1 Requirements (`formal/requirements.json`)

- **210 requirements** across 58 ID prefixes (ACT, AGENT, ARCH, BLD, CALIB, CL, COMP, CONF, CRED, DASH, DETECT, DIAG, DISP, DRIFT, ENFC, EVID, FAIL, HEAL, HLTH, IMPR, INST, KEY, LIVE, LOOP, MCP, MCPENV, META, MULTI, OBS, ORES, PLAN, PLCY, PORT, PROV, PRST, QUORUM, RECV, REDACT, REN, RLS, SAFE, SCBD, SCHEMA, SENS, SIG, SLOT, SPEC, STATE, STD, STOP, SYNC, TRIAGE, UNIF, UPPAAL, UPS, VERIFY, VIS, WIZ)
- **142 Pending, 68 Complete**
- Schema: `{ id, text, category, phase, status, provenance: { source_file, milestone }, background }`
- **No field for formal spec linkage** — no `verified_by`, `formal_properties`, or `model_references` field exists
- Content hash and frozen timestamp present for integrity tracking

### 2.2 Model Registry (`formal/model-registry.json`)

- **22 model entries** (11 TLA+, 8 Alloy, 3 PRISM, plus 1 test path)
- Schema per model: `{ version, last_updated, update_source, source_id, session_id, description }`
- **Two models have requirement-linked descriptions**: QGSDStopHook ("SPEC-01") and quorum-composition ("SPEC-03")
- **No structured requirement linkage field** — no `requirements`, `properties`, or `traces_to` array
- Version tracking exists (some models at v343 from auto-generation)

### 2.3 Check Result Schema (`formal/check-result.schema.json`)

- Fields: `tool, formalism, result, timestamp, metadata, check_id, surface, property, runtime_ms, summary, triage_tags, observation_window`
- **The `property` field exists** but is free-text (e.g., "Trace redaction -- no forbidden keys...")
- **No `requirement_ids` or `traces_to` field** — check results are not linked to requirements
- Result values: `pass | fail | warn | inconclusive`

### 2.4 Verification Orchestrator (`bin/run-formal-verify.cjs`)

- **30 steps** organized by tool type: generate (2), petri (2), TLA+ (10), Alloy (8), PRISM (3), CI (4), UPPAAL (1), triage (1)
- Each step has: `tool, id, label, type, script, args` — but **no requirement references**
- Step IDs like `tla:quorum-safety`, `alloy:quorum-votes`, `prism:quorum` are descriptive but not requirement-linked
- Some step labels include requirement refs in comments (e.g., "MCPENV-02", "SPEC-01", "UPPAAL-01/02/03", "LIVE-01/LIVE-02", "EVID-01/EVID-02") but these are free-text, not structured
- Produces `check-results.ndjson` which is truncated and rebuilt each run

### 2.5 Check Results (`formal/check-results.ndjson`)

- Actual output contains 4 entries from a CI enforcement run
- Each line is a JSON object conforming to the schema
- `check_id` matches step IDs from the orchestrator (e.g., `ci:trace-redaction`)
- `property` field contains human-readable property descriptions
- **No requirement attribution** in the actual output

### 2.6 Invariants Documentation (`formal/spec/*/invariants.md`)

- **10 invariant specification files** covering: quorum, deliberation, prefilter, recruiting, breaker, convergence, oscillation, account-manager, mcp-calls, tui-nav
- Each documents: property formula, config line, fairness assumption, realism rationale, source location
- These are the richest source of requirement-to-property mapping intent, but are **unstructured markdown** — not machine-readable
- Some reference requirement IDs (e.g., "R3", "R4", "R1", "R2", "R3") and GAP IDs (GAP-1, GAP-2, GAP-5, GAP-6)

### 2.7 Existing Ad-Hoc Requirement References

References found in formal model comments and config files:

| Location | Requirement Ref | Format |
|----------|----------------|--------|
| MCsafety.cfg comment | N/A | No ref |
| MCMCPEnv.cfg comment | MCPENV-02 | Free-text |
| MCStopHook.cfg comment | SPEC-01 | Free-text |
| alloy/quorum-votes.als | ALY-01 | Comment |
| alloy/quorum-composition.als | SPEC-03 | Comment |
| prism/quorum.pm | PRM-01 | Comment |
| prism/oauth-rotation.pm/.props | PRM-AM-01 | Comment |
| prism/mcp-availability.pm | MCPENV-04 | Comment |
| run-formal-verify.cjs labels | MCPENV-02, SPEC-01, SPEC-03, UPPAAL-01/02/03, LIVE-01/02, EVID-01/02, MCPENV-04 | Label text |
| QGSDDeliberation.tla | R3, R3.3, R3.6 | Comment |
| QGSDPreFilter.tla | R4 | Comment |
| model-registry.json descriptions | SPEC-01, SPEC-03 | Free-text |

**Key finding**: Requirement references exist in ~12 of 22 models but are scattered across comments, labels, and descriptions with no consistent format or machine-readable structure.

---

## 3. Industry Practices

### 3.1 DO-178C / DO-333 (Aerospace)

DO-178C establishes the gold standard for safety-critical software verification traceability:

- **Bidirectional traceability** is mandatory: from requirements to code/tests and back
- **DO-333 Formal Methods Supplement** allows mathematical proofs to satisfy verification objectives
- Key principle: formal proofs can **replace** some testing but must be **traceable** to the requirement they satisfy
- Traceability table structure: `Requirement <-> Formal Property <-> Proof/Check Result <-> Evidence`
- **Verification Objective Coverage**: each requirement must map to at least one verification activity; each verification activity must map back to at least one requirement
- Coverage analysis ensures no untraceable material and no orphan requirements

**Applicability to QGSD**: The DO-333 model of `Requirement -> Property -> Check Result -> Evidence` is directly applicable. QGSD already has the middle elements (properties, check results) but lacks the linking structure.

### 3.2 ISO 26262 (Automotive)

- **Requirements traceability** is a mandatory part of the software development lifecycle
- Bidirectional tracing from safety requirements through implementation to verification
- Each safety requirement at each ASIL level must trace to verification evidence
- The **compliance matrix** maps each standard clause to project requirements and test cases

**Applicability to QGSD**: ISO 26262's structured compliance matrix approach is a good model for the standalone `traceability-matrix.json` artifact.

### 3.3 IEC 61508 (Industrial Safety)

- Objective: ensure all requirements are shown to be properly met and no untraceable material is introduced
- Bidirectional traceability is specified as an explicit objective in Annex A.1
- Formal proof is supported at all SIL levels
- Traceability ensures: (a) all outline requirements are completely addressed, (b) all detailed requirements trace to outline requirements, (c) no surplus/spurious code exists

**Applicability to QGSD**: IEC 61508's emphasis on **no surplus artifacts** (every model property should trace to a requirement, every requirement should have formal coverage) provides a useful completeness metric.

### 3.4 Alloy Requirement Mapping Practices

- Alloy assertions are natural verification units — each `check` command maps to a specific property claim
- Best practice: assertion names encode the requirement ID (e.g., `assert SPEC03_NoEmptySelection`)
- Alloy's bounded scope declarations provide natural granularity boundaries
- Test-driven modeling: `run` commands serve as validation witnesses

**Current QGSD pattern**: Some Alloy files use requirement-referencing assertion names (e.g., `ThresholdPasses`, `AllRulesHold`) but these don't systematically map to requirement IDs.

### 3.5 PRISM Property-to-Requirement Linking

- PRISM properties are specified in `.props` files, one per line
- Each property can be annotated with a comment referencing the requirement
- Best practice: property files include structured comments mapping each property to its requirement
- PRISM's quantitative results (probabilities, expected rewards) can serve as acceptance criteria

**Current QGSD pattern**: PRISM files include requirement refs in comments (PRM-01, PRM-AM-01, MCPENV-04) but these are not machine-parseable.

### 3.6 General Best Practices Summary

1. **Property-level granularity**: trace at the individual invariant/property level, not just the model level
2. **Bidirectional links**: both "requirement -> properties" and "property -> requirements"
3. **Automated validation**: tooling should detect orphan requirements (no formal coverage) and orphan properties (no requirement justification)
4. **Continuous maintenance**: traceability must be updated as models evolve
5. **Machine-readable format**: structured data (JSON/YAML), not free-text comments

---

## 4. State Space Analysis

### 4.1 TLA+ Models

| Model | Config | Variables | Domains | Approx States | Symmetry | Explosion Risk |
|-------|--------|-----------|---------|---------------|----------|----------------|
| QGSDQuorum | MCsafety | 4: phase, successCount, polledCount, deliberationRounds | 4 * 4 * 4 * 10 | ~640 (with symmetry on 5 agents) | Yes (AgentSymmetry on 5 agents) | **Low** |
| QGSDQuorum | MCliveness | 4: phase, successCount, polledCount, deliberationRounds | 4 * 4 * 4 * 10 | ~640 (no symmetry, 3 agents) | No (liveness incompatible) | **Low** |
| QGSDQuorum | MCQGSDQuorum | 4 | same | ~640 | No | **Low** |
| QGSDCircuitBreaker | MCbreaker | 2: active, disabled | 2 * 2 = 4 states | 4 | No | **Minimal** |
| QGSDOscillation | MCoscillation | 6: commits, runs, flagCount, netChange, flagged, algorithmDone | Seq(3) * Seq(3) * [3->Nat] * Int * Bool * Bool | **~10^4-10^5** (Labels=3, Depth=3, CommitWindow=5) | No | **Moderate** |
| QGSDConvergence | MCconvergence | 3: logWritten, stateDeleted, haikuVerdict | 2 * 2 * 3 = 12 | 12 | No | **Minimal** |
| QGSDDeliberation | MCdeliberation | 3: deliberationRound, improvementIteration, voteState | 11 * 11 * 5 = 605 | ~605 | No | **Low** |
| QGSDPreFilter | MCprefilter | 4: filterRound, modelAgreement, autoResolved, filterPhase | 4 * 2 * 2 * 3 = 48 | ~48 | No | **Minimal** |
| QGSDAccountManager | MCaccount-manager | 4: state, pool, active, pending_op | 6 * 2^4 * 5 * (4*5) = 9,600 | **~9,600** (MaxPool=4) | No | **Low-Moderate** |
| QGSDMCPEnv | MCMCPEnv | 3: slotStatus, callState, quorumPhase | 2^2 * 3^2 * 3 = 108 | ~108 (NumSlots=2) | No | **Low** (but grows as 3^N * 2^N with slots) |
| QGSDStopHook | MCStopHook | 4: hasCommand, hasQuorumEvidence, decision, algorithmDone | 2 * 2 * 3 * 2 = 24 | ~24 | No | **Minimal** |
| QGSDRecruiting | MCrecruiting-safety | 3: recruited, tried, phase | 2^4 * 2^4 * 2 = 512 | ~512 (4 slots) | No | **Low** |
| QGSDRecruiting | MCrecruiting-liveness | 3 | 2^3 * 2^3 * 2 = 128 | ~128 (3 slots) | No | **Minimal** |
| TUINavigation | MCTUINavigation | 2: depth, exited | 4 * 2 = 8 | 8 (minus impossible states ~5) | No | **Minimal** |
| QGSDQuorum_xstate | MCQGSDQuorum | 7: state, slotsAvailable, successCount, deliberationRounds, maxDeliberation, maxSize, polledCount | Unbounded Nat | **Unbounded without constraints** | No | **HIGH** (uses Nat domains) |

### 4.2 Models at Risk for Combinatorial Explosion

1. **QGSDQuorum_xstate (HIGH RISK)**: Uses `Nat` domains for 6 of 7 variables. The `Next` relation quantifies over `\E slotsAvailable \in Nat` and `\E successCount \in Nat`, making TLC unable to enumerate. This model is a generated scaffold and requires manual bounds or a separate bounded config to be checkable.

2. **QGSDOscillation (MODERATE RISK)**: The `commits` variable is a sequence of labels bounded by CommitWindow=5, and `runs` is derived from it. With Labels={A,B,C} and sequences up to length 5, the commit space alone is 3^5 = 243 possible sequences, combined with derived state this reaches ~10^4-10^5 distinct states. Currently manageable but scaling Labels or CommitWindow would explode.

3. **QGSDAccountManager (LOW-MODERATE RISK)**: With MaxPool=4, the `pool` variable ranges over 2^4=16 subsets, combined with other variables gives ~9,600 states. Increasing MaxPool to 8 would yield ~2.5M states; MaxPool=10 would reach ~10^7.

4. **QGSDMCPEnv (CONDITIONAL RISK)**: Currently configured with NumSlots=2, giving ~108 states. But state space scales as O(3^N * 2^N * 3) with N slots. At N=4 (production slot count), this becomes ~3,888. At N=6, ~139,968. At N=10, ~170M. The current NumSlots=2 is a deliberate abstraction to keep it tractable.

### 4.3 Existing Decomposition Patterns

The project already uses several decomposition strategies:

1. **Separate safety/liveness configs**: MCsafety (5 agents, symmetry, no liveness) vs MCliveness (3 agents, no symmetry, liveness) for QGSDQuorum. This is a classic liveness/safety split necessitated by TLC's symmetry-liveness incompatibility.

2. **Protocol decomposition**: QGSDQuorum models the high-level state machine; QGSDDeliberation models the R3 deliberation sub-protocol; QGSDPreFilter models the R4 pre-filter sub-protocol; QGSDRecruiting models the recruitment sub-process. These are compositional decompositions of the overall quorum workflow.

3. **Layer separation**: QGSDMCPEnv models the MCP transport layer (timeout, availability); QGSDQuorum models the voting logic layer. This separates environmental concerns from protocol concerns.

4. **Complementary formalisms**: TLA+ for temporal/behavioral properties; Alloy for structural invariants; PRISM for probabilistic properties. The same domain (e.g., account management) is verified structurally in Alloy (account-pool-structure.als) and behaviorally in TLA+ (QGSDAccountManager.tla).

---

## 5. Property-to-Requirement Coverage Map

### 5.1 TLA+ Properties

| Model | Property | Type | Closest Requirement(s) |
|-------|----------|------|----------------------|
| QGSDQuorum | TypeOK | Safety invariant | QUORUM-01 (quorum slot types) |
| QGSDQuorum | UnanimityMet | Safety invariant | QUORUM-02, SAFE-01 (unanimity gate) |
| QGSDQuorum | QuorumCeilingMet | Safety invariant | QUORUM-03, SLOT-01 (maxSize ceiling) |
| QGSDQuorum | DeliberationBounded | Safety invariant | LOOP-01 (deliberation loop bound) |
| QGSDQuorum | AllTransitionsValid | Temporal safety | SAFE-02 (valid state transitions) |
| QGSDQuorum | DeliberationMonotone | Temporal safety | SAFE-03 (monotonic round counter) |
| QGSDQuorum | EventualConsensus | Liveness | QUORUM-04, RECV-01 (eventual decision) |
| QGSDCircuitBreaker | TypeOK | Safety invariant | DETECT-01 (breaker state types) |
| QGSDCircuitBreaker | DisabledExcludesActive | Safety invariant | DETECT-02 (disabled precludes active) |
| QGSDCircuitBreaker | MonitoringReachable | Liveness | DETECT-03 (recovery to monitoring) |
| QGSDOscillation | TypeOK | Safety invariant | DETECT-04 (algorithm state types) |
| QGSDOscillation | OscillationFlaggedCorrectly | Safety invariant | DETECT-05 (flagging correctness, GAP-1) |
| QGSDOscillation | AlgorithmTerminates | Liveness | DETECT-06 (algorithm termination) |
| QGSDConvergence | TypeOK | Safety invariant | ORES-01 (convergence state types) |
| QGSDConvergence | LogBeforeDelete | Safety invariant | ORES-02 (log before delete, GAP-5) |
| QGSDConvergence | ResolvedAtWriteOnce | Temporal safety | ORES-03 (write-once semantics) |
| QGSDConvergence | HaikuUnavailableNoCorruption | Temporal safety | ORES-04 (fail-open no corruption) |
| QGSDConvergence | ConvergenceEventuallyResolves | Liveness | ORES-05 (eventual resolution) |
| QGSDDeliberation | TypeOK | Safety invariant | PLAN-01 (deliberation state types) |
| QGSDDeliberation | TotalRoundsBounded | Safety invariant | LOOP-02 (combined round bound, GAP-2) |
| QGSDDeliberation | DeliberationMonotone | Temporal safety | SAFE-03 (monotonic counters) |
| QGSDDeliberation | ImprovementMonotone | Temporal safety | IMPR-01 (improvement monotonicity) |
| QGSDDeliberation | ProtocolTerminates | Liveness | PLAN-02 (protocol termination) |
| QGSDPreFilter | TypeOK | Safety invariant | PLAN-03 (pre-filter state types) |
| QGSDPreFilter | AutoResolutionSound | Safety invariant | PLAN-04 (auto-resolution soundness, GAP-6) |
| QGSDPreFilter | FilterRoundsBounded | Safety invariant | LOOP-03 (filter round bound) |
| QGSDPreFilter | AutoResolvedPhaseConsistent | Safety invariant | PLAN-05 (phase consistency) |
| QGSDPreFilter | PreFilterTerminates | Liveness | PLAN-06 (pre-filter termination) |
| QGSDAccountManager | TypeOK | Safety invariant | CRED-01 (account manager state types) |
| QGSDAccountManager | ActiveIsPoolMember | Safety invariant | CRED-02 (active in pool) |
| QGSDAccountManager | NoActiveWhenEmpty | Safety invariant | CRED-03 (no active when empty) |
| QGSDAccountManager | IdleNoPending | Safety invariant | CRED-04 (idle no pending) |
| QGSDAccountManager | OpMatchesState | Safety invariant | CRED-05 (op-state consistency) |
| QGSDAccountManager | IdleReachable | Liveness | CRED-06 (idle reachable) |
| QGSDMCPEnv | TypeInvariantHolds | Safety invariant | MCPENV-01 (MCP env state types) |
| QGSDMCPEnv | NoSpuriousConsensus | Safety invariant | MCPENV-02 (no spurious consensus) |
| QGSDMCPEnv | EventualDecision | Liveness | MCPENV-03 (eventual decision under faults) |
| QGSDStopHook | TypeOK | Safety invariant | STOP-01 (stop hook state types) |
| QGSDStopHook | SafetyInvariant1 | Safety invariant | STOP-02, SPEC-01 (BLOCK requires command) |
| QGSDStopHook | SafetyInvariant2 | Safety invariant | STOP-03 (BLOCK requires no evidence) |
| QGSDStopHook | SafetyInvariant3 | Safety invariant | STOP-04 (PASS on planning requires evidence) |
| QGSDStopHook | LivenessProperty1 | Liveness | STOP-05 (algorithm terminates) |
| QGSDStopHook | LivenessProperty2 | Liveness | STOP-06 (evidence implies eventual PASS) |
| QGSDStopHook | LivenessProperty3 | Liveness | STOP-07 (command+no evidence implies BLOCK) |
| QGSDRecruiting | TypeOK | Safety invariant | SLOT-02 (recruiting state types) |
| QGSDRecruiting | PolledCeiling | Safety invariant | SLOT-03, R1 (polled ceiling) |
| QGSDRecruiting | SubslotsFirst | Safety invariant | SLOT-04, R2 (sub-before-api order) |
| QGSDRecruiting | FullRecruitment | Liveness | SLOT-05, R3 (full recruitment) |
| TUINavigation | TypeOK | Safety invariant | (TUI depth types) |
| TUINavigation | NoDeadlock | Safety invariant | (ESC always available) |
| TUINavigation | DepthBounded | Safety invariant | (depth within MaxDepth) |
| TUINavigation | EscapeProgress | Temporal safety | (ESC reduces depth) |

### 5.2 Alloy Assertions

| Model | Assertion | Closest Requirement(s) |
|-------|-----------|----------------------|
| quorum-votes | ThresholdPasses | QUORUM-02, SAFE-01 (unanimity gate) |
| quorum-votes | BelowThresholdFails | QUORUM-02, SAFE-01 (below threshold fails) |
| quorum-votes | ZeroApprovalsFail | SAFE-04 (zero approvals safety baseline) |
| quorum-composition | AllRulesHold | SPEC-03, COMP-01 (composition rules) |
| scoreboard-recompute | RecomputeIdempotent | SCBD-01 (idempotent recompute) |
| scoreboard-recompute | NoVoteLoss | SCBD-02 (no vote loss) |
| scoreboard-recompute | NoDoubleCounting | SCBD-03 (no double counting) |
| scoreboard-recompute | TNplusScoreIsCorrect | SCBD-04 (score delta correctness) |
| availability-parsing | ParseCorrect | CALIB-01 (future date invariant) |
| availability-parsing | YearRolloverHandled | CALIB-02 (year rollover) |
| availability-parsing | FallbackIsNull | CALIB-03 (null fallback safety) |
| transcript-scan | BoundaryCorrectCheck | STOP-08 (boundary detection) |
| transcript-scan | PairingUniqueCheck | STOP-09 (unique pairing) |
| transcript-scan | NoDuplicateCountingCheck | STOP-10 (no duplicate counting) |
| transcript-scan | SuccessCountNeverExceedsMinSizeCheck | STOP-11 (ceiling enforcement) |
| install-scope | NoConflict | INST-01 (no conflicting scope) |
| install-scope | AllEquivalence | INST-02 (--all equivalence) |
| install-scope | InstallIdempotent | INST-03 (install idempotent) |
| install-scope | RollbackSoundCheck | INST-04 (rollback soundness, GAP-7) |
| install-scope | ConfigSyncCompleteCheck | INST-05 (config sync completeness) |
| taxonomy-safety | NoInjection | SCBD-05 (classification deterministic) |
| taxonomy-safety | TaxonomyClosed | SCBD-06 (taxonomy closure) |
| taxonomy-safety | NewCategoryConsistent | SCBD-07 (new category consistency) |
| account-pool-structure | AddPreservesValidity | CRED-07 (add preserves validity) |
| account-pool-structure | SwitchPreservesValidity | CRED-08 (switch preserves validity) |
| account-pool-structure | RemovePreservesValidity | CRED-09 (remove preserves validity) |
| account-pool-structure | SwitchPreservesPool | CRED-10 (switch preserves pool) |
| account-pool-structure | RemoveShrinksPool | CRED-11 (remove shrinks pool) |

### 5.3 PRISM Properties

| Model | Property | Closest Requirement(s) |
|-------|----------|----------------------|
| quorum.pm | P=? [F s=1] (eventual convergence) | PRM-01, QUORUM-04 (certain termination) |
| quorum.pm | R{"rounds"}=? [F s=1] (expected rounds) | PRM-01 (round efficiency) |
| quorum.pm | P=? [F<=9 s=1] (within MaxDeliberation) | PRM-01, LOOP-01 (bounded convergence) |
| quorum.pm | P=? [F<=10 s=1] (high-confidence bound) | PRM-01 (high-confidence termination) |
| oauth-rotation.pm | P=? [F s=1] (rotation success) | PRM-AM-01, CRED-12 (rotation success rate) |
| oauth-rotation.pm | P=? [F s=0] (exhaustion probability) | PRM-AM-01 (failure probability) |
| oauth-rotation.pm | R{"rotations"}=? [F s<=1] (expected attempts) | PRM-AM-01 (attempt efficiency) |
| mcp-availability.pm | S=? ["min_quorum_available"] | MCPENV-04 (minimum quorum availability) |
| mcp-availability.pm | S=? ["total_outage"] | MCPENV-04, FAIL-01 (total outage probability) |
| mcp-availability.pm | S=? ["majority_available"] | MCPENV-04 (majority availability) |

### 5.4 Coverage Gaps

**Requirements with NO formal coverage (sample based on known requirement prefixes):**

Many requirement ID prefixes have no corresponding formal model at all:
- **ACT-\***: Activity tracking (7 requirements) -- no formal model
- **AGENT-\***: Agent management -- no formal model beyond account-pool-structure
- **ARCH-\***: Architecture -- no formal model
- **BLD-\***: Build -- no formal model
- **DASH-\***: Dashboard -- no formal model
- **DIAG-\***: Diagnostics -- no formal model
- **KEY-\***: Key management -- no formal model
- **META-\***: Metadata -- no formal model
- **MULTI-\***: Multi-slot -- no formal model
- **PORT-\***: Portability -- no formal model
- **RLS-\***: Release -- no formal model
- **STATE-\***: State management -- no formal model
- **WIZ-\***: Wizard -- limited coverage (TUINavigation covers navigation only)

**Properties with UNCLEAR requirement mapping:**
- TUINavigation properties (NoDeadlock, DepthBounded, EscapeProgress) -- no matching requirement IDs in requirements.json
- Some TypeOK invariants are structural validation without specific requirement counterparts

---

## 6. Schema Design Options

### 6.1 Option A: Inline Annotations in Existing Files

**model-registry.json extension:**
```json
{
  "formal/tla/QGSDStopHook.tla": {
    "version": 1,
    "description": "SPEC-01: Stop hook decision logic",
    "requirements": ["SPEC-01", "STOP-02", "STOP-03", "STOP-04"],
    "properties": [
      { "name": "SafetyInvariant1", "type": "invariant", "requirements": ["STOP-02", "SPEC-01"] },
      { "name": "SafetyInvariant2", "type": "invariant", "requirements": ["STOP-03"] },
      { "name": "LivenessProperty1", "type": "liveness", "requirements": ["STOP-05"] }
    ]
  }
}
```

**requirements.json extension:**
```json
{
  "id": "SPEC-01",
  "text": "...",
  "formal_coverage": {
    "models": ["formal/tla/QGSDStopHook.tla"],
    "properties": ["SafetyInvariant1", "SafetyInvariant2", "SafetyInvariant3"],
    "check_ids": ["tla:stop-hook"]
  }
}
```

**check-result.schema.json extension:**
```json
{
  "requirement_ids": {
    "type": "array",
    "items": { "type": "string" }
  }
}
```

**Pros:**
- Co-located with existing data; no new file to maintain
- Bidirectional: model->reqs AND req->models
- Easy to validate with JSON schema
- Incremental adoption (add fields gradually)

**Cons:**
- Bloats existing files (model-registry would grow significantly)
- Property-level detail in model-registry creates deep nesting
- Dual maintenance: links in both model-registry and requirements must stay in sync
- requirements.json is a generated/aggregated file -- adding formal_coverage requires the aggregation pipeline to understand it

### 6.2 Option B: Standalone Traceability Matrix

**`formal/traceability-matrix.json`:**
```json
{
  "version": "1.0",
  "generated_at": "2026-03-03T...",
  "links": [
    {
      "requirement_id": "SPEC-01",
      "model": "formal/tla/QGSDStopHook.tla",
      "property": "SafetyInvariant1",
      "property_type": "invariant",
      "config": "formal/tla/MCStopHook.cfg",
      "check_id": "tla:stop-hook",
      "last_result": "pass",
      "last_checked": "2026-03-03T06:50:58Z",
      "confidence": "machine-checked",
      "notes": "BLOCK decision implies planning command detected"
    }
  ],
  "coverage_summary": {
    "requirements_covered": 45,
    "requirements_total": 210,
    "coverage_pct": 21.4,
    "orphan_properties": [],
    "uncovered_requirements": ["ACT-01", "ACT-02", ...]
  }
}
```

**Pros:**
- Single source of truth for all traceability links
- No modification to existing file schemas
- Easy to generate, validate, and diff
- Natural artifact for CI reporting ("coverage report")
- Can be generated from model comments + manual annotations

**Cons:**
- Third artifact to maintain (alongside model-registry and requirements)
- Risk of staleness if not regenerated automatically
- Loss of co-location (must open separate file to see links)
- Does not appear in model or requirement context

### 6.3 Option C: Hybrid (Recommended)

Combine lightweight inline annotations with a derived standalone matrix:

1. **model-registry.json**: Add a `requirements` array (model-level, coarse) -- just the requirement IDs this model covers
2. **requirements.json**: Add `formal_models` array (requirement-level, coarse) -- just the model paths
3. **check-result.schema.json**: Add `requirement_ids` array -- emitted by individual runners
4. **`formal/traceability-matrix.json`**: Generated artifact combining all of the above at property-level granularity, enriched with check results. Produced by a new script (e.g., `bin/generate-traceability-matrix.cjs`) that:
   - Reads model-registry for model->requirement links
   - Reads requirements for requirement->model links
   - Reads check-results.ndjson for latest pass/fail
   - Validates bidirectional consistency (warns on asymmetric links)
   - Produces coverage summary statistics

**Pros:**
- Lightweight inline changes (just arrays of IDs)
- Derived matrix provides the full picture without manual maintenance
- Bidirectional validation catches stale links
- Coverage metrics computed automatically
- CI can fail on coverage regressions

**Cons:**
- More moving parts than pure Option A or B
- Requires a generation script
- Property-level detail only exists in the derived matrix (not inline)

### 6.4 Granularity Trade-offs

| Granularity | Pros | Cons |
|-------------|------|------|
| **Model-level** | Simple, low maintenance | Can't distinguish which property covers which requirement |
| **Property-level** | Precise coverage, supports gap analysis | Many entries, harder to maintain manually |
| **Assertion-level** (Alloy) | Finest grain, maps to individual checks | Too granular for requirements that span multiple assertions |
| **Check-result-level** | Ties to actual verification runs | Ephemeral (regenerated each run), not a stable mapping |

**Recommendation**: Use **property-level** granularity in the traceability matrix, with model-level summaries inline. This matches the DO-333 approach where each formal proof maps to specific verification objectives.

### 6.5 Manual vs. Automated Extraction

**Automated extraction from comments:**
- Many models already include requirement IDs in comments (e.g., `// Requirements: ALY-01`, `// SPEC-03`)
- A parser could extract these with a regex like `Requirements?:\s*([\w-]+(?:,\s*[\w-]+)*)`
- Config file comments also contain refs (e.g., `MCPENV-02`, `SPEC-01`)

**Manual annotation:**
- Needed for property-level mapping (comments don't specify which property maps to which requirement)
- The invariants.md files contain the richest mapping data but would need a structured format

**Hybrid extraction:**
- Parse model-level requirement refs from comments automatically
- Require manual property-level annotation in a structured format (either in the model comment header or in a sidecar annotation file)
- Validate consistency at CI time

---

## 7. Decomposition Strategy

### 7.1 When to Decompose a Model

Based on analysis of TLC behavior and industry practice, decomposition should be considered when:

| Indicator | Threshold | Current Models Affected |
|-----------|-----------|----------------------|
| State space > 10^6 | Moderate risk | QGSDQuorum_xstate (unbounded) |
| State space > 10^8 | High risk, decompose | None currently |
| TLC runtime > 10 min | Consider decomposition | Unknown (need runtime data) |
| Variables > 8 | Complexity risk | QGSDQuorum_xstate (7 vars) |
| Nested quantifiers in Next | Exponential branching | QGSDQuorum_xstate, QGSDOscillation |
| Adding new features would cross threshold | Preemptive decompose | QGSDMCPEnv (if NumSlots increases), QGSDAccountManager (if MaxPool increases) |

### 7.2 Compositional Verification Patterns for TLA+

**Pattern 1: Safety/Liveness Split** (Already used)
- Separate configs for safety (with symmetry) and liveness (without symmetry, fewer agents)
- Example: MCsafety.cfg (5 agents, symmetry) vs MCliveness.cfg (3 agents, no symmetry)
- **Requirement coverage**: Both configs cover the same model, so the traceability matrix needs to handle one model with multiple configs/check_ids

**Pattern 2: Protocol Decomposition** (Already used)
- Split a complex protocol into sub-protocols modeled independently
- QGSDQuorum (top-level) + QGSDDeliberation (R3 sub-protocol) + QGSDPreFilter (R4 sub-protocol) + QGSDRecruiting (recruitment sub-process)
- **Requirement coverage**: Each sub-model covers a subset of requirements; the traceability matrix naturally captures this

**Pattern 3: Layer Separation** (Already used)
- QGSDMCPEnv (transport/environment layer) vs QGSDQuorum (protocol logic layer)
- **Requirement coverage**: MCPENV-* requirements map to MCP layer; QUORUM-* requirements map to protocol layer

**Pattern 4: Assume-Guarantee** (Not yet used)
- Model A assumes property P of Model B; Model B assumes property Q of Model A
- Verify A satisfies its properties under assumption P; verify B satisfies its properties under assumption Q
- **Applicability**: Could be used if QGSDMCPEnv and QGSDQuorum need to be verified together -- MCP env assumes quorum will eventually read outcomes; quorum assumes MCP env will eventually deliver outcomes

**Pattern 5: Constant Reduction** (Already used)
- MCMCPEnv uses NumSlots=2 instead of production NumSlots=4
- MCsafety uses MaxSize=3 (production value) but could be reduced
- **Trade-off**: Reduced constants means the verified state space is a subset of production -- properties may not hold at production scale

### 7.3 Compositional Verification Patterns for Alloy

Alloy's bounded model checking naturally limits scope:
- `check ... for 5 Account, 5 PoolState` -- scope bounds are explicit
- Decomposition in Alloy = separate assertion groups in separate files (already done)
- Cross-model properties could use Alloy's `open` mechanism to import shared signatures

### 7.4 Compositional Verification Patterns for PRISM

PRISM supports compositional analysis through:
- Module-based decomposition (mcp-availability.pm uses 4 independent modules)
- Parallel composition with shared synchronization labels
- Assume-guarantee for probabilistic systems is an active research area with L*-based learning approaches

### 7.5 Maintaining Requirement Coverage During Decomposition

When splitting a monolithic model M into sub-models M1, M2:

1. **Pre-split**: Document all property-requirement mappings for M
2. **Split**: Assign each property to exactly one sub-model (M1 or M2)
3. **Interface properties**: Add new properties at the M1-M2 boundary to verify composition assumptions
4. **Post-split validation**: Run the traceability matrix generator -- no requirement should lose coverage
5. **CI guard**: The traceability matrix should fail if coverage decreases after a split

### 7.6 Symmetry Reduction Opportunities

| Model | Current Symmetry | Potential Gains |
|-------|-----------------|-----------------|
| QGSDQuorum (MCsafety) | AgentSymmetry on 5 agents (~120x reduction) | Already optimal |
| QGSDRecruiting | None | SubSlots and ApiSlots could be symmetric (~2x-4x) if slot identity doesn't matter |
| QGSDMCPEnv | Constant bound (NumSlots=2) | Could use SYMMETRY on Slots if moved to model values |
| QGSDAccountManager | None | AccountIds could be symmetric (~24x with MaxPool=4) |

---

## 8. Recommended Approach

### 8.1 Phase 1: Schema Foundation (Low effort, high value)

1. **Extend `model-registry.json`**: Add `requirements: string[]` per model entry (model-level coarse mapping)
2. **Extend `check-result.schema.json`**: Add `requirement_ids: string[]` field
3. **Update individual runners** (run-tlc.cjs, run-alloy.cjs, etc.) to emit `requirement_ids` in their NDJSON output, extracted from model comments
4. **Seed initial data**: Populate model-registry `requirements` arrays using the property-to-requirement map from Section 5

### 8.2 Phase 2: Traceability Matrix Generator (Medium effort, high value)

1. **Create `bin/generate-traceability-matrix.cjs`** that:
   - Parses requirement refs from model file comments (automated extraction)
   - Reads model-registry for model->requirement links
   - Reads check-results.ndjson for latest results per check_id
   - Produces `formal/traceability-matrix.json` with property-level links and coverage stats
2. **Add traceability generation** as a step in `run-formal-verify.cjs` (after all checks complete)
3. **Add CI guard**: warn (not fail) when coverage drops below a threshold

### 8.3 Phase 3: Bidirectional Validation (Medium effort, medium value)

1. **Extend `requirements.json`** with `formal_models: string[]` per requirement
2. **Add cross-validation** in the traceability matrix generator:
   - Detect orphan properties (property in model but no matching requirement)
   - Detect uncovered requirements (requirement with no formal property)
   - Detect asymmetric links (model claims req X, but req X doesn't claim model)
3. **Coverage dashboard**: human-readable summary in `VERIFICATION.md` template

### 8.4 Phase 4: Property-Level Annotations (Higher effort, highest value)

1. **Standardize property annotations** in model files using a structured comment format:
   ```
   \* @requirement STOP-02
   \* @requirement SPEC-01
   SafetyInvariant1 == ...
   ```
   Or for Alloy:
   ```
   -- @requirement INST-01
   assert NoConflict { ... }
   ```
2. **Parse structured annotations** in the traceability matrix generator
3. **Full DO-333-style bidirectional traceability** at property level

### 8.5 Priority Order

1. Phase 1 (schema foundation) -- can be done in a single session
2. Phase 2 (matrix generator) -- core deliverable, enables all downstream analysis
3. Phase 4 (property-level annotations) -- highest precision, but requires touching every model file
4. Phase 3 (bidirectional validation) -- depends on Phase 2

---

## 9. Risk Factors and Open Questions

### 9.1 Risks

1. **Maintenance burden**: Adding traceability links to 22 models x 80+ properties is significant manual work. The initial seeding is tractable but ongoing maintenance as models evolve requires discipline.

2. **Requirement ID instability**: Requirements are aggregated from milestone files. If requirement IDs change during aggregation, all traceability links break. Mitigation: freeze requirement IDs once assigned.

3. **Generated model coverage**: Three models (QGSDQuorum, quorum-votes, quorum.pm) are auto-generated from `src/machines/qgsd-workflow.machine.ts`. Their requirement links must be maintained in the generator, not the generated files. This adds complexity to the generation pipeline.

4. **False coverage confidence**: A property named "SafetyInvariant1" mapped to requirement STOP-02 does NOT guarantee the property correctly captures STOP-02's intent. Semantic validation (does the formal property actually express the requirement?) requires human review and is not automatable.

5. **Partial state space coverage**: TLC's bounded model checking only verifies within the declared scope. A property verified for MaxPool=4 may not hold for MaxPool=10. The traceability matrix should record scope bounds alongside results.

6. **QGSDQuorum_xstate unbounded state space**: This generated model uses unbounded Nat domains and cannot currently be model-checked. It either needs manual bounds added or should be excluded from the traceability matrix.

### 9.2 Open Questions

1. **Should TypeOK invariants map to requirements?** TypeOK is a structural validation property, not a domain requirement. Options: (a) map to a synthetic "structural soundness" requirement, (b) leave unmapped but track separately, (c) create TYPE-* requirements.

2. **How to handle multi-config models?** QGSDQuorum has 3 configs (MCsafety, MCliveness, MCQGSDQuorum). The traceability matrix should link properties to configs, not just models. This means the matrix key is `(model, config, property)`, not just `(model, property)`.

3. **Should UPPAAL and Petri net models be included?** The UPPAAL model (quorum-races.xml) and Petri net models are non-critical / informational. Including them in the traceability matrix adds completeness but also noise.

4. **Coverage threshold**: What percentage of requirements should have formal coverage? Currently ~45 of 210 requirements (~21%) could plausibly be mapped. Many requirements (UI, configuration, deployment) are not amenable to formal verification. A realistic target might be 40-50% coverage for "verifiable" requirements, with a classification of which requirements are formal-verification-eligible.

5. **Traceability matrix format**: JSON is proposed, but should this be NDJSON (append-friendly) or monolithic JSON (easier to query)? The check-results use NDJSON; the requirements use monolithic JSON. The traceability matrix is more like requirements (complete snapshot) than check-results (streaming), so monolithic JSON seems appropriate.

6. **Integration with quorum scoreboard**: Should the traceability matrix feed into the quorum scoreboard? For example, a quorum agent's vote could be weighted by how many requirements have formal coverage in the affected domain.

7. **Property naming conventions**: Should property names encode requirement IDs (e.g., `STOP02_BlockRequiresCommand` instead of `SafetyInvariant1`)? This would make automated extraction trivial but would require renaming many existing properties.

---

## Sources

- [Requirements Traceability Matrix (RTM) - Perforce](https://www.perforce.com/resources/alm/requirements-traceability-matrix)
- [ISO 26262 Requirements Traceability - Parasoft](https://www.parasoft.com/learning-center/iso-26262/requirements-traceability/)
- [DO-178C Requirements Traceability Matrix - Parasoft](https://www.parasoft.com/learning-center/do-178c/requirements-traceability/)
- [DO-178C Wikipedia](https://en.wikipedia.org/wiki/DO-178C)
- [DO-333 Formal Methods Supplement - GlobalSpec](https://standards.globalspec.com/std/1461592/rtca-do-333)
- [Formal Methods in Avionic Software Certification: The DO-178C Perspective - Springer](https://link.springer.com/chapter/10.1007/978-3-642-34032-1_21)
- [IEC 61508 Standard Guide - LDRA](https://ldra.com/iec-61508/)
- [Understanding Verification and Validation Under IEC 61508 - VectorCAST](https://cdn.vector.com/cms/content/products/VectorCAST/Docs/Whitepapers/English/Understanding_Verification_Validation_of_Software_Under_IEC-61508.pdf)
- [Optimizing TLA+ Model Checking - Learn TLA+](https://learntla.com/topics/optimization.html)
- [Compositional Verification for Timed Systems - LMCS](https://lmcs.episciences.org/1591/pdf)
- [Progress on State Explosion Problem - ResearchGate](https://www.researchgate.net/publication/221025695_Progress_on_the_State_Explosion_Problem_in_Model_Checking)
- [Automated Circular Assume-Guarantee Reasoning - Springer](https://link.springer.com/article/10.1007/s00165-017-0436-0)
- [PRISM Model Checker](https://www.prismmodelchecker.org/)
- [Towards Continuous Assurance with Formal Verification - arXiv](https://arxiv.org/html/2511.14805)
- [Alloy Overview - Formal Software Design](https://haslab.github.io/formal-software-design/overview/index.html)
- [Requirements Traceability - Wikipedia](https://en.wikipedia.org/wiki/Requirements_traceability)
- [Four Best Practices for Requirements Traceability - Jama Software](https://www.jamasoftware.com/requirements-management-guide/requirements-traceability/four-best-practices-for-requirements-traceability)
