---
phase: solve-ft-batch-1-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/DECOMP-04.stub.test.js
  - .planning/formal/generated-stubs/DECOMP-05.stub.test.js
  - .planning/formal/generated-stubs/DETECT-01.stub.test.js
  - .planning/formal/generated-stubs/DETECT-02.stub.test.js
  - .planning/formal/generated-stubs/DETECT-03.stub.test.js
  - .planning/formal/generated-stubs/DETECT-04.stub.test.js
  - .planning/formal/generated-stubs/DETECT-05.stub.test.js
  - .planning/formal/generated-stubs/ORES-01.stub.test.js
  - .planning/formal/generated-stubs/ORES-02.stub.test.js
  - .planning/formal/generated-stubs/ORES-03.stub.test.js
  - .planning/formal/generated-stubs/ORES-04.stub.test.js
  - .planning/formal/generated-stubs/ORES-05.stub.test.js
  - .planning/formal/generated-stubs/QUORUM-01.stub.test.js
  - .planning/formal/generated-stubs/QUORUM-02.stub.test.js
  - .planning/formal/generated-stubs/QUORUM-03.stub.test.js
autonomous: true
requirements: [DECOMP-04, DECOMP-05, DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05, ORES-01, ORES-02, ORES-03, ORES-04, ORES-05, QUORUM-01, QUORUM-02, QUORUM-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 7.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- DECOMP-04: model=.planning/formal/alloy/state-space-analysis.als property=RiskLevel text="The state-space analysis report is included in the traceability matrix output as a `state_space` section per model"
- DECOMP-05: model=.planning/formal/alloy/decomp-cross-model.als property=Bool text="`analyze-state-space.cjs` identifies model pairs sharing source files or requirement prefixes, estimates the merged stat"
- DETECT-01: model=.planning/formal/tla/QGSDCircuitBreaker.tla property=TypeOK text="PreToolUse hook intercepts Bash tool calls and checks whether the current context has an active circuit breaker before r"
- DETECT-02: model=.planning/formal/tla/QGSDCircuitBreaker.tla property=DisabledExcludesActive text="Hook retrieves last N commits' changed files via `git log --name-only` (N = commit_window config) when detection is need"
- DETECT-03: model=.planning/formal/tla/QGSDCircuitBreaker.tla property=MonitoringReachable text="Hook identifies oscillation when the exact same file set (strict set equality, not intersection) appears in ≥ oscillatio"
- DETECT-04: model=.planning/formal/tla/QGSDOscillation.tla property=TypeOK text="Read-only Bash commands (git log, git diff, grep, cat, ls, head, tail, find) pass through without detection or blocking"
- DETECT-05: model=.planning/formal/tla/QGSDOscillation.tla property=OscillationFlaggedCorrectly text="Detection is skipped (returns pass) when no git repository exists in the current working directory"
- ORES-01: model=.planning/formal/tla/QGSDConvergence.tla property=TypeOK text="When oscillation is detected and the oscillating file set contains only internal code files, Claude MUST enter oscillati"
- ORES-02: model=.planning/formal/tla/QGSDConvergence.tla property=LogBeforeDelete text="Oscillation resolution mode presents oscillation evidence (file set, commit graph) to all available quorum models with s"
- ORES-03: model=.planning/formal/tla/QGSDConvergence.tla property=ResolvedAtWriteOnce text="Quorum deliberates (R3.3, up to 4 rounds) and may only approve unified solutions — partial/incremental fixes are rejecte"
- ORES-04: model=.planning/formal/tla/QGSDConvergence.tla property=HaikuUnavailableNoCorruption text="On consensus, Claude presents the unified solution plan to the user for approval before any execution"
- ORES-05: model=.planning/formal/tla/QGSDConvergence.tla property=ConvergenceEventuallyResolves text="If no consensus after 4 rounds, Claude hard-stops and escalates to the human with all model positions"
- QUORUM-01: model=.planning/formal/tla/QGSDQuorum.tla property=TypeOK text="plan-milestone-gaps proposed gap closure phases are submitted to R3 quorum for approval before ROADMAP.md is updated (re"
- QUORUM-02: model=.planning/formal/alloy/quorum-votes.als property=ThresholdPasses text="execute-phase gaps_found triggers quorum diagnosis and auto-resolution (replaces chain halt + manual suggestion)"
- QUORUM-03: model=.planning/formal/tla/QGSDQuorum.tla property=QuorumCeilingMet text="discuss-phase remaining user_questions (surviving R4 pre-filter) are routed to quorum in auto mode (replaces AskUserQues"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: DECOMP-04, DECOMP-05, DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05, ORES-01, ORES-02, ORES-03, ORES-04, ORES-05, QUORUM-01, QUORUM-02, QUORUM-03</name>
  <files>.planning/formal/generated-stubs/DECOMP-04.stub.test.js, .planning/formal/generated-stubs/DECOMP-05.stub.test.js, .planning/formal/generated-stubs/DETECT-01.stub.test.js, .planning/formal/generated-stubs/DETECT-02.stub.test.js, .planning/formal/generated-stubs/DETECT-03.stub.test.js, .planning/formal/generated-stubs/DETECT-04.stub.test.js, .planning/formal/generated-stubs/DETECT-05.stub.test.js, .planning/formal/generated-stubs/ORES-01.stub.test.js, .planning/formal/generated-stubs/ORES-02.stub.test.js, .planning/formal/generated-stubs/ORES-03.stub.test.js, .planning/formal/generated-stubs/ORES-04.stub.test.js, .planning/formal/generated-stubs/ORES-05.stub.test.js, .planning/formal/generated-stubs/QUORUM-01.stub.test.js, .planning/formal/generated-stubs/QUORUM-02.stub.test.js, .planning/formal/generated-stubs/QUORUM-03.stub.test.js</files>
  <action>
For each stub:
1. Read the stub file
2. Read the formal model (find the property/invariant definition)
3. Read the .stub.recipe.json sidecar if it exists for pre-resolved context
4. Grep codebase for the source module implementing this requirement
5. Replace assert.fail('TODO') with test logic that imports the source
   module and asserts the invariant behavior
6. For behavioral reqs that cannot be unit-tested directly, test the
   structural constraint (function exists, constants match, exports present)
  </action>
  <verify>Run: node --test .planning/formal/generated-stubs/DECOMP-04.stub.test.js .planning/formal/generated-stubs/DECOMP-05.stub.test.js .planning/formal/generated-stubs/DETECT-01.stub.test.js .planning/formal/generated-stubs/DETECT-02.stub.test.js .planning/formal/generated-stubs/DETECT-03.stub.test.js .planning/formal/generated-stubs/DETECT-04.stub.test.js .planning/formal/generated-stubs/DETECT-05.stub.test.js .planning/formal/generated-stubs/ORES-01.stub.test.js .planning/formal/generated-stubs/ORES-02.stub.test.js .planning/formal/generated-stubs/ORES-03.stub.test.js .planning/formal/generated-stubs/ORES-04.stub.test.js .planning/formal/generated-stubs/ORES-05.stub.test.js .planning/formal/generated-stubs/QUORUM-01.stub.test.js .planning/formal/generated-stubs/QUORUM-02.stub.test.js .planning/formal/generated-stubs/QUORUM-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
