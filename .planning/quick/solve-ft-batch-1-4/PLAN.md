---
phase: solve-ft-batch-1-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/OBS-04.stub.test.js
  - .planning/formal/generated-stubs/OBS-05.stub.test.js
  - .planning/formal/generated-stubs/OBS-06.stub.test.js
  - .planning/formal/generated-stubs/OBS-07.stub.test.js
  - .planning/formal/generated-stubs/OBS-08.stub.test.js
  - .planning/formal/generated-stubs/ACT-01.stub.test.js
  - .planning/formal/generated-stubs/ACT-02.stub.test.js
  - .planning/formal/generated-stubs/ACT-03.stub.test.js
  - .planning/formal/generated-stubs/ACT-04.stub.test.js
  - .planning/formal/generated-stubs/ACT-05.stub.test.js
  - .planning/formal/generated-stubs/ACT-06.stub.test.js
  - .planning/formal/generated-stubs/ACT-07.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-01.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-02.stub.test.js
  - .planning/formal/generated-stubs/SOLVE-03.stub.test.js
autonomous: true
requirements: [OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07, SOLVE-01, SOLVE-02, SOLVE-03]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 4.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- OBS-04: model=.planning/formal/prism/observability-delivery.props property=S=? [ "slot1_unavail" ] text="Status shows recent UNAVAIL count per agent from quorum scoreboard"
- OBS-05: model=.planning/formal/alloy/cli-exit-conventions.als property=ExitCode text="CLI tools exit with appropriate codes (0 = success, non-zero = failure) and write errors to stderr, output to stdout"
- OBS-06: model=.planning/formal/alloy/observability-analysis.als property=Bool text="Scan local project state for unfinished quick tasks, stale debug sessions, and unverified milestone phases; surface them"
- OBS-07: model=.planning/formal/alloy/observability-analysis.als property=Bool text="The analyze-assumptions CLI parses TLA+, Alloy, and PRISM formal models to extract assumptions, thresholds, and invarian"
- OBS-08: model=.planning/formal/alloy/observability-analysis.als property=Bool text="The analyze-assumptions CLI classifies each extracted assumption into priority tiers (Tier 1: directly monitorable numer"
- ACT-01: model=.planning/formal/tla/QGSDActivityTracking.tla property=WriteActivity text="`.planning/current-activity.json` is written atomically at every major workflow state transition (execute-phase, plan-ph"
- ACT-02: model=.planning/formal/tla/QGSDActivityTracking.tla property=TypeOK text="Activity schema: `{ activity, sub_activity, phase?, plan?, wave?, debug_round?, checkpoint?, quorum_round?, updated }` —"
- ACT-03: model=.planning/formal/tla/QGSDActivityTracking.tla property=ActivityClear text="`gsd-tools.cjs activity-set <json>` CLI command writes the current-activity.json file with atomic replace; `activity-cle"
- ACT-04: model=.planning/formal/tla/QGSDActivityTracking.tla property=ResumeWork text="`resume-work` reads current-activity.json and routes to the exact recovery point — displaying the interrupted state befo"
- ACT-05: model=.planning/formal/tla/QGSDActivityTracking.tla property=StageTransition text="`execute-phase` writes activity at every stage boundary: entering/exiting plan execution, checkpoint:verify, debug loop "
- ACT-06: model=.planning/formal/tla/QGSDActivityTracking.tla property=StageTransition text="`plan-phase`, `new-milestone`, `debug`, `quorum`, and `circuit-breaker` resolution workflows write activity at every sta"
- ACT-07: model=.planning/formal/tla/QGSDActivityTracking.tla property=ClearActivity text="Activity file is cleared on successful completion of any top-level workflow; it persists across context resets when mid-"
- SOLVE-01: model=.planning/formal/alloy/solve-consistency.als property=Bool text="Execute `/qgsd:solve` command to sweep all 7 layer transitions (Requirements→Formal, Formal→Tests, Code→Formal, Tests→Co"
- SOLVE-02: model=.planning/formal/alloy/solve-consistency.als property=Bool text="Parse all Alloy default constants from newline-separated constraint blocks and clear formalTestSyncCache at each solver "
- SOLVE-03: model=.planning/formal/alloy/solver-doc-layers.als property=Requirement text="Solver discovers documentation files via config (docs_paths in .planning/config.json) with convention fallback (README.m"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, ACT-01, ACT-02, ACT-03, ACT-04, ACT-05, ACT-06, ACT-07, SOLVE-01, SOLVE-02, SOLVE-03</name>
  <files>.planning/formal/generated-stubs/OBS-04.stub.test.js, .planning/formal/generated-stubs/OBS-05.stub.test.js, .planning/formal/generated-stubs/OBS-06.stub.test.js, .planning/formal/generated-stubs/OBS-07.stub.test.js, .planning/formal/generated-stubs/OBS-08.stub.test.js, .planning/formal/generated-stubs/ACT-01.stub.test.js, .planning/formal/generated-stubs/ACT-02.stub.test.js, .planning/formal/generated-stubs/ACT-03.stub.test.js, .planning/formal/generated-stubs/ACT-04.stub.test.js, .planning/formal/generated-stubs/ACT-05.stub.test.js, .planning/formal/generated-stubs/ACT-06.stub.test.js, .planning/formal/generated-stubs/ACT-07.stub.test.js, .planning/formal/generated-stubs/SOLVE-01.stub.test.js, .planning/formal/generated-stubs/SOLVE-02.stub.test.js, .planning/formal/generated-stubs/SOLVE-03.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/OBS-04.stub.test.js .planning/formal/generated-stubs/OBS-05.stub.test.js .planning/formal/generated-stubs/OBS-06.stub.test.js .planning/formal/generated-stubs/OBS-07.stub.test.js .planning/formal/generated-stubs/OBS-08.stub.test.js .planning/formal/generated-stubs/ACT-01.stub.test.js .planning/formal/generated-stubs/ACT-02.stub.test.js .planning/formal/generated-stubs/ACT-03.stub.test.js .planning/formal/generated-stubs/ACT-04.stub.test.js .planning/formal/generated-stubs/ACT-05.stub.test.js .planning/formal/generated-stubs/ACT-06.stub.test.js .planning/formal/generated-stubs/ACT-07.stub.test.js .planning/formal/generated-stubs/SOLVE-01.stub.test.js .planning/formal/generated-stubs/SOLVE-02.stub.test.js .planning/formal/generated-stubs/SOLVE-03.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
