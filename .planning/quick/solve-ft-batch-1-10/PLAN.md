---
phase: solve-ft-batch-1-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/LOOP-04.stub.test.js
  - .planning/formal/generated-stubs/SEC-01.stub.test.js
  - .planning/formal/generated-stubs/SEC-02.stub.test.js
  - .planning/formal/generated-stubs/SEC-03.stub.test.js
  - .planning/formal/generated-stubs/SEC-04.stub.test.js
  - .planning/formal/generated-stubs/SIG-01.stub.test.js
  - .planning/formal/generated-stubs/SIG-02.stub.test.js
  - .planning/formal/generated-stubs/SIG-03.stub.test.js
  - .planning/formal/generated-stubs/SIG-04.stub.test.js
  - .planning/formal/generated-stubs/STATE-01.stub.test.js
  - .planning/formal/generated-stubs/STATE-02.stub.test.js
  - .planning/formal/generated-stubs/STATE-03.stub.test.js
  - .planning/formal/generated-stubs/STATE-04.stub.test.js
  - .planning/formal/generated-stubs/SYNC-01.stub.test.js
  - .planning/formal/generated-stubs/SYNC-02.stub.test.js
autonomous: true
requirements: [LOOP-04, SEC-01, SEC-02, SEC-03, SEC-04, SIG-01, SIG-02, SIG-03, SIG-04, STATE-01, STATE-02, STATE-03, STATE-04, SYNC-01, SYNC-02]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 10.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- LOOP-04: model=.planning/formal/tla/QGSDSpecGeneration.tla property=StartDebugMine text="`propose-debug-invariants.cjs` mines TLA+ invariant candidates from debug sessions"
- SEC-01: model=.planning/formal/alloy/security-scanning.als property=ScanResult text="Pre-commit hook runs secret scanning (e.g., Gitleaks) to block commits containing API keys, tokens, passwords, or creden"
- SEC-02: model=.planning/formal/alloy/security-scanning.als property=ScanResult text="CI pipeline runs deep secret scanning (e.g., TruffleHog) across full repo history on every PR"
- SEC-03: model=.planning/formal/alloy/security-scanning.als property=ScanResult text="All external input (user input, API request bodies, query parameters, file uploads) is validated and sanitized at system"
- SEC-04: model=.planning/formal/alloy/security-scanning.als property=ScanResult text="Dependencies are scanned for known vulnerabilities in CI (e.g., npm audit, Dependabot, Snyk) and critical/high findings "
- SIG-01: model=.planning/formal/alloy/signal-analysis-tools.als property=Bool text="`detect-coverage-gaps.cjs` diffs TLC states vs conformance traces to produce `.planning/formal/coverage-gaps.md`"
- SIG-02: model=.planning/formal/alloy/signal-analysis-tools.als property=Bool text="`generate-petri-net.cjs --roadmap` models phase dependencies as Petri net with critical path analysis"
- SIG-03: model=.planning/formal/alloy/signal-analysis-tools.als property=Bool text="`prism-priority.cjs` ranks roadmap items by PRISM failure probability"
- SIG-04: model=.planning/formal/alloy/signal-analysis-tools.als property=Bool text="`quorum-consensus-gate.cjs` gates quorum rounds by Poisson binomial consensus probability threshold"
- STATE-01: model=.planning/formal/tla/QGSDBreakerState.tla property=UpdateState text="audit-milestone updates STATE.md "Stopped at" and "Current Position" fields with the audit result (passed / gaps_found /"
- STATE-02: model=.planning/formal/tla/QGSDBreakerState.tla property=TypeOK text="State schema: `{ active, file_set[], activated_at, commit_window_snapshot[] }` — captures what triggered the breaker"
- STATE-03: model=.planning/formal/tla/QGSDBreakerState.tla property=HookReadsState text="Hook reads existing state first — if active, applies enforcement immediately without re-running git log detection"
- STATE-04: model=.planning/formal/tla/QGSDBreakerState.tla property=CreateSilently text="State file created silently if absent; failure to write logs to stderr but never blocks execution"
- SYNC-01: model=.planning/formal/alloy/gsd-sync-invariants.als property=Bool text="QGSD ships as separate npm package (`qgsd` or `get-shit-done-quorum`) that wraps GSD"
- SYNC-02: model=.planning/formal/alloy/gsd-sync-invariants.als property=Bool text="When GSD releases a new planning command, QGSD releases a patch update adding the command to the default `quorum_command"
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: LOOP-04, SEC-01, SEC-02, SEC-03, SEC-04, SIG-01, SIG-02, SIG-03, SIG-04, STATE-01, STATE-02, STATE-03, STATE-04, SYNC-01, SYNC-02</name>
  <files>.planning/formal/generated-stubs/LOOP-04.stub.test.js, .planning/formal/generated-stubs/SEC-01.stub.test.js, .planning/formal/generated-stubs/SEC-02.stub.test.js, .planning/formal/generated-stubs/SEC-03.stub.test.js, .planning/formal/generated-stubs/SEC-04.stub.test.js, .planning/formal/generated-stubs/SIG-01.stub.test.js, .planning/formal/generated-stubs/SIG-02.stub.test.js, .planning/formal/generated-stubs/SIG-03.stub.test.js, .planning/formal/generated-stubs/SIG-04.stub.test.js, .planning/formal/generated-stubs/STATE-01.stub.test.js, .planning/formal/generated-stubs/STATE-02.stub.test.js, .planning/formal/generated-stubs/STATE-03.stub.test.js, .planning/formal/generated-stubs/STATE-04.stub.test.js, .planning/formal/generated-stubs/SYNC-01.stub.test.js, .planning/formal/generated-stubs/SYNC-02.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/LOOP-04.stub.test.js .planning/formal/generated-stubs/SEC-01.stub.test.js .planning/formal/generated-stubs/SEC-02.stub.test.js .planning/formal/generated-stubs/SEC-03.stub.test.js .planning/formal/generated-stubs/SEC-04.stub.test.js .planning/formal/generated-stubs/SIG-01.stub.test.js .planning/formal/generated-stubs/SIG-02.stub.test.js .planning/formal/generated-stubs/SIG-03.stub.test.js .planning/formal/generated-stubs/SIG-04.stub.test.js .planning/formal/generated-stubs/STATE-01.stub.test.js .planning/formal/generated-stubs/STATE-02.stub.test.js .planning/formal/generated-stubs/STATE-03.stub.test.js .planning/formal/generated-stubs/STATE-04.stub.test.js .planning/formal/generated-stubs/SYNC-01.stub.test.js .planning/formal/generated-stubs/SYNC-02.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
