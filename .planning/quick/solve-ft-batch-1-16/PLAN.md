---
phase: solve-ft-batch-1-16
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/generated-stubs/EVID-02.stub.test.js
  - .planning/formal/generated-stubs/FAIL-01.stub.test.js
  - .planning/formal/generated-stubs/FAIL-02.stub.test.js
  - .planning/formal/generated-stubs/HEAL-01.stub.test.js
  - .planning/formal/generated-stubs/HEAL-02.stub.test.js
  - .planning/formal/generated-stubs/LIVE-01.stub.test.js
  - .planning/formal/generated-stubs/LIVE-02.stub.test.js
  - .planning/formal/generated-stubs/PRST-01.stub.test.js
  - .planning/formal/generated-stubs/PRST-02.stub.test.js
  - .planning/formal/generated-stubs/REL-01.stub.test.js
  - .planning/formal/generated-stubs/REL-02.stub.test.js
  - .planning/formal/generated-stubs/TRIAGE-01.stub.test.js
  - .planning/formal/generated-stubs/TRIAGE-02.stub.test.js
  - .planning/formal/generated-stubs/AGT-01.stub.test.js
  - .planning/formal/generated-stubs/INIT-01.stub.test.js
autonomous: true
requirements: [EVID-02, FAIL-01, FAIL-02, HEAL-01, HEAL-02, LIVE-01, LIVE-02, PRST-01, PRST-02, REL-01, REL-02, TRIAGE-01, TRIAGE-02, AGT-01, INIT-01]
formal_artifacts: none
---

<objective>
Implement 15 test stubs for batch 16.

For each stub, read the formal model and requirement text, then replace
assert.fail('TODO') with real test logic using node:test + node:assert/strict.

Formal context:
- EVID-02: model=.planning/formal/alloy/evidence-triage.als property=Confidence text="`observation_window` metadata (window_start, window_end, n_traces, n_events, window_days) written to `check-results.ndjs"
- FAIL-01: model=.planning/formal/prism/mcp-availability.props property=S=? [ "total_outage" ] text="call-quorum-slot.cjs retries a failed slot call up to 2 times with exponential backoff (1s, 3s) before recording UNAVAIL"
- FAIL-02: model=.planning/formal/alloy/provider-failure.als property=Bool text="providers.json contains explicit slot-to-provider mapping; when a provider probe returns DOWN, all slots on that provide"
- HEAL-01: model=.planning/formal/prism/deliberation-healing.props property=P=? [ F "consensus" ] text="After each deliberation round, system computes P(consensus | remaining rounds); if P < threshold (default 10%), escalati"
- HEAL-02: model=.planning/formal/prism/deliberation-healing.props property=P=? [ F "low_confidence" ] text="When verify-quorum-health detects P(consensus) < 95%, it recommends and auto-adjusts maxDeliberation in qgsd.json (with "
- LIVE-01: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteLiveness text="CI step detects liveness properties lacking a fairness declaration in `invariants.md` and emits `result=inconclusive` in"
- LIVE-02: model=.planning/formal/tla/QGSDCIChecks.tla property=CompleteLiveness text="`run-formal-verify.cjs` STEPS includes a `ci:liveness-fairness-lint` step that enforces LIVE-01"
- PRST-01: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=AddAgent text="User can select a named provider preset (AkashML / Together.xyz / Fireworks.ai) in addAgent/editAgent flow instead of ma"
- PRST-02: model=.planning/formal/tla/QGSDAgentProvisioning.tla property=CloneSlot text="User can clone an existing slot — copies provider URL and model config, prompts for new slot name"
- REL-01: model=.planning/formal/alloy/reliability-patterns.als property=ExternalService text="Failures in external services (APIs, databases, third-party SDKs) are caught and handled gracefully — the application de"
- REL-02: model=.planning/formal/alloy/reliability-patterns.als property=ExternalService text="Long-running operations (file uploads, data processing, API calls >2s) show progress indication and can be cancelled by "
- TRIAGE-01: model=.planning/formal/alloy/evidence-triage.als property=Confidence text="`bin/generate-triage-bundle.cjs` reads `check-results.ndjson` and writes `.planning/formal/diff-report.md` (per-check de"
- TRIAGE-02: model=.planning/formal/alloy/evidence-triage.als property=Confidence text="`run-formal-verify.cjs` calls `generate-triage-bundle.cjs` as the final step after all checks complete"
- AGT-01: model=.planning/formal/tla/QGSDAgentLoop.tla property=TypeOK text="Subagents spawned by QGSD skills MUST loop autonomously until a terminal condition is reached. Valid terminal conditions"
- INIT-01: model=.planning/formal/alloy/baseline-requirements-filter.als property=Profile text="Load and filter baseline requirements by project profile (web/mobile/desktop/api/cli/library), present profile-filtered "
</objective>

<tasks>
<task type="auto">
  <name>Implement stubs: EVID-02, FAIL-01, FAIL-02, HEAL-01, HEAL-02, LIVE-01, LIVE-02, PRST-01, PRST-02, REL-01, REL-02, TRIAGE-01, TRIAGE-02, AGT-01, INIT-01</name>
  <files>.planning/formal/generated-stubs/EVID-02.stub.test.js, .planning/formal/generated-stubs/FAIL-01.stub.test.js, .planning/formal/generated-stubs/FAIL-02.stub.test.js, .planning/formal/generated-stubs/HEAL-01.stub.test.js, .planning/formal/generated-stubs/HEAL-02.stub.test.js, .planning/formal/generated-stubs/LIVE-01.stub.test.js, .planning/formal/generated-stubs/LIVE-02.stub.test.js, .planning/formal/generated-stubs/PRST-01.stub.test.js, .planning/formal/generated-stubs/PRST-02.stub.test.js, .planning/formal/generated-stubs/REL-01.stub.test.js, .planning/formal/generated-stubs/REL-02.stub.test.js, .planning/formal/generated-stubs/TRIAGE-01.stub.test.js, .planning/formal/generated-stubs/TRIAGE-02.stub.test.js, .planning/formal/generated-stubs/AGT-01.stub.test.js, .planning/formal/generated-stubs/INIT-01.stub.test.js</files>
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
  <verify>Run: node --test .planning/formal/generated-stubs/EVID-02.stub.test.js .planning/formal/generated-stubs/FAIL-01.stub.test.js .planning/formal/generated-stubs/FAIL-02.stub.test.js .planning/formal/generated-stubs/HEAL-01.stub.test.js .planning/formal/generated-stubs/HEAL-02.stub.test.js .planning/formal/generated-stubs/LIVE-01.stub.test.js .planning/formal/generated-stubs/LIVE-02.stub.test.js .planning/formal/generated-stubs/PRST-01.stub.test.js .planning/formal/generated-stubs/PRST-02.stub.test.js .planning/formal/generated-stubs/REL-01.stub.test.js .planning/formal/generated-stubs/REL-02.stub.test.js .planning/formal/generated-stubs/TRIAGE-01.stub.test.js .planning/formal/generated-stubs/TRIAGE-02.stub.test.js .planning/formal/generated-stubs/AGT-01.stub.test.js .planning/formal/generated-stubs/INIT-01.stub.test.js</verify>
  <done>No assert.fail('TODO') remains. Each stub has real test logic.</done>
</task>
</tasks>
