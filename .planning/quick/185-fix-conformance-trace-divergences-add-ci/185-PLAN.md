---
phase: quick-185
plan: 185
type: execute
wave: 1
depends_on: []
files_modified:
  - src/machines/qgsd-workflow.machine.ts
  - bin/validate-traces.cjs
  - bin/validate-traces.test.cjs
  - .planning/formal/tla/guards/qgsd-workflow.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "circuit_break conformance events replay through XState machine without unmappable_action divergence"
    - "IDLE state accepts CIRCUIT_BREAK event and self-loops back to IDLE"
    - "All 11,855 previously-divergent traces now validate cleanly"
    - "IDLE state config includes CIRCUIT_BREAK key in its on block"
    - "mapToXStateEvent maps circuit_break to CIRCUIT_BREAK event type"
  artifacts:
    - path: "src/machines/qgsd-workflow.machine.ts"
      provides: "CIRCUIT_BREAK event type and IDLE self-loop transition"
      contains: "CIRCUIT_BREAK"
    - path: "dist/machines/qgsd-workflow.machine.cjs"
      provides: "Rebuilt CJS bundle with CIRCUIT_BREAK support"
    - path: "bin/validate-traces.cjs"
      provides: "mapToXStateEvent mapping for circuit_break action"
      contains: "circuit_break"
    - path: "bin/validate-traces.test.cjs"
      provides: "Dedicated test case for circuit_break mapping"
      contains: "circuit_break"
  key_links:
    - from: "bin/validate-traces.cjs"
      to: "src/machines/qgsd-workflow.machine.ts"
      via: "mapToXStateEvent returns { type: 'CIRCUIT_BREAK' } for circuit_break action"
      pattern: "case 'circuit_break'"
---

<objective>
Fix 11,855 conformance trace divergences caused by unmappable `circuit_break` action.

Purpose: The circuit breaker hook emits `circuit_break` conformance events in the IDLE phase, but neither the XState machine definition nor the `mapToXStateEvent` function recognize this action. This causes validate-traces to report them all as `unmappable_action` divergences.

Output: XState machine with CIRCUIT_BREAK self-loop on IDLE, validate-traces mapping for circuit_break, dedicated test for the mapping, rebuilt CJS bundle, updated guards JSON.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@src/machines/qgsd-workflow.machine.ts
@bin/validate-traces.cjs
@bin/validate-traces.test.cjs
@.planning/formal/tla/guards/qgsd-workflow.json
@bin/conformance-schema.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CIRCUIT_BREAK event to XState machine and mapToXStateEvent</name>
  <files>
    src/machines/qgsd-workflow.machine.ts
    bin/validate-traces.cjs
    bin/validate-traces.test.cjs
    .planning/formal/tla/guards/qgsd-workflow.json
  </files>
  <action>
**Before making any changes**, capture the current divergence baseline:
```
node bin/validate-traces.cjs --summary 2>&1 | tee /tmp/185-before.txt
```

Four changes needed:

1. **src/machines/qgsd-workflow.machine.ts** — Two edits:
   a. Add `| { type: 'CIRCUIT_BREAK' }` to the `QGSDEvent` type union on line 19 (immediately after the DECIDE event on line 18: `| { type: 'DECIDE'; outcome: 'APPROVE' | 'BLOCK' };`). The new line becomes:
   ```
   | { type: 'CIRCUIT_BREAK' };
   ```
   Move the semicolon from the DECIDE line to this new line.

   b. Add a `CIRCUIT_BREAK` self-loop transition in the `IDLE` state's `on` block (around line 50). It should target `'IDLE'` (self-loop) with **no actions** — omitting actions on the self-loop is intentional because circuit breaker blocks prevent state transitions, so no context reset should occur:
   ```
   CIRCUIT_BREAK: {
     target: 'IDLE',
   },
   ```
   Place it after the existing `QUORUM_START` transition in the IDLE state.

2. **bin/validate-traces.cjs** — In the `mapToXStateEvent` function (around line 72-86), add a case before the `default` return:
   ```
   case 'circuit_break':
     return { type: 'CIRCUIT_BREAK' };
   ```

3. **bin/validate-traces.test.cjs** — Add a dedicated test case for the circuit_break mapping. After the existing mapping tests, add:
   ```js
   test('mapToXStateEvent maps circuit_break to CIRCUIT_BREAK', () => {
     // Require the module to access mapToXStateEvent
     // If mapToXStateEvent is not exported, test via integration:
     // send a circuit_break event through a single-event trace and assert no divergence
     const lines = [
       JSON.stringify({ action: 'circuit_break', phase: 'IDLE', ts: Date.now(), session: 'test-cb' })
     ];
     const result = runValidator(lines);
     assert.strictEqual(result.status, 0, 'circuit_break trace should validate without divergence');
     assert.ok(!result.stdout.includes('unmappable_action'), 'should not report unmappable_action for circuit_break');
   });
   ```

4. **.planning/formal/tla/guards/qgsd-workflow.json** — No changes needed. Circuit_break does not introduce new guards or variables. This file is listed for awareness only.

After edits, rebuild the CJS bundle:
```
npm run build:machines
```

This produces dist/machines/qgsd-workflow.machine.cjs with the new CIRCUIT_BREAK event baked in. validate-traces.cjs loads this CJS bundle at runtime.
  </action>
  <verify>
Run the test suite including the new circuit_break test:
```
node --test bin/validate-traces.test.cjs
```

Confirm the machine accepts CIRCUIT_BREAK in IDLE with an inline smoke test that also asserts CIRCUIT_BREAK exists in the IDLE state config:
```
node -e "
const {createActor, qgsdWorkflowMachine} = require('./dist/machines/qgsd-workflow.machine.cjs');
const a = createActor(qgsdWorkflowMachine);
a.start();
// Assert IDLE state config includes CIRCUIT_BREAK key
const idleConfig = qgsdWorkflowMachine.config.states.IDLE.on;
if (!idleConfig || !('CIRCUIT_BREAK' in idleConfig)) {
  console.error('FAIL: IDLE state config missing CIRCUIT_BREAK key');
  process.exit(1);
}
a.send({type:'CIRCUIT_BREAK'});
const s = a.getSnapshot();
console.log('state:', s.value);
a.stop();
process.exit(s.value === 'IDLE' ? 0 : 1);
"
```

Capture the after-fix divergence count and compare:
```
node bin/validate-traces.cjs --summary 2>&1 | tee /tmp/185-after.txt
echo "--- BEFORE ---"; cat /tmp/185-before.txt; echo "--- AFTER ---"; cat /tmp/185-after.txt
```
The unmappable_action divergence count for circuit_break should drop to 0.
  </verify>
  <done>
- CIRCUIT_BREAK event type exists in QGSDEvent union (after DECIDE on line 18)
- IDLE state has CIRCUIT_BREAK self-loop transition with no actions (intentional — no context reset)
- mapToXStateEvent maps 'circuit_break' to { type: 'CIRCUIT_BREAK' }
- Dedicated test in validate-traces.test.cjs confirms circuit_break mapping works
- IDLE state config verified to include CIRCUIT_BREAK key via inline smoke test
- dist/machines/qgsd-workflow.machine.cjs rebuilt
- All validate-traces tests pass (including new circuit_break test)
- validate-traces --summary shows divergence count delta (before/after captured)
  </done>
</task>

</tasks>

<verification>
- `node --test bin/validate-traces.test.cjs` — all tests pass including new circuit_break mapping test
- Inline actor test confirms CIRCUIT_BREAK self-loop in IDLE and CIRCUIT_BREAK key in IDLE config
- `node bin/validate-traces.cjs --summary` — unmappable_action divergences for circuit_break drop to 0
- Before/after divergence delta captured in /tmp/185-before.txt and /tmp/185-after.txt
- `git diff src/machines/qgsd-workflow.machine.ts` shows CIRCUIT_BREAK in event union and IDLE state
- `git diff bin/validate-traces.cjs` shows circuit_break case in mapToXStateEvent
- `git diff bin/validate-traces.test.cjs` shows new circuit_break test case
</verification>

<success_criteria>
circuit_break conformance events are no longer classified as unmappable_action divergences. The XState machine replays them as IDLE self-loops (with no actions — intentionally no context reset). All existing and new tests pass. Divergence count delta is captured before/after.
</success_criteria>

<output>
After completion, create `.planning/quick/185-fix-conformance-trace-divergences-add-ci/185-SUMMARY.md`
</output>
