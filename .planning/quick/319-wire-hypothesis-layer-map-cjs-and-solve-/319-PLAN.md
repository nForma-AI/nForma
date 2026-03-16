---
phase: quick-319
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/nf-solve.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "nf-solve.cjs imports loadHypothesisTransitions and computeLayerPriorityWeights from hypothesis-layer-map.cjs"
    - "nf-solve.cjs imports computeWaves from solve-wave-dag.cjs"
    - "autoClose accepts an optional layerOrder parameter and dispatches handlers in that order when provided"
    - "autoClose falls back to the existing hardcoded order when layerOrder is not provided (backward compatible)"
    - "At the call site, computeWaves output is flattened into a layerOrder array and passed to autoClose"
    - "Wave ordering is logged to stderr for observability"
    - "All existing nf-solve.test.cjs tests still pass"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Hypothesis-driven wave ordering integration with behavioral dispatch"
      contains: "LAYER_HANDLERS"
    - path: "bin/nf-solve.test.cjs"
      provides: "Tests proving autoClose honors layerOrder parameter"
      contains: "TC-HTARGET"
  key_links:
    - from: "bin/nf-solve.cjs"
      to: "bin/hypothesis-layer-map.cjs"
      via: "require()"
      pattern: "require.*hypothesis-layer-map"
    - from: "bin/nf-solve.cjs"
      to: "bin/solve-wave-dag.cjs"
      via: "require()"
      pattern: "require.*solve-wave-dag"
    - from: "bin/nf-solve.cjs autoClose"
      to: "layerOrder parameter"
      via: "dispatch map iteration"
      pattern: "LAYER_HANDLERS.*layerOrder"
    - from: "bin/nf-solve.cjs solve loop"
      to: "computeWaves(residual, priorityWeights)"
      via: "function call producing layerOrder for autoClose"
      pattern: "computeWaves.*residual"
---

<objective>
Wire hypothesis-layer-map.cjs and solve-wave-dag.cjs into nf-solve.cjs so hypothesis transitions CONTROL autoClose dispatch order, not just log it.

Purpose: Close the HTARGET-01/HTARGET-02 integration gap. The quorum blocked the original plan because it only logged wave order without feeding it into autoClose dispatch. This revision refactors autoClose to accept a `layerOrder` parameter derived from computeWaves, making hypothesis-driven wave ordering behavioral.

Output: autoClose dispatches layer handlers in wave-derived order when provided, falls back to hardcoded order when not. The solve loop call site computes waves and passes the flattened layer order.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs
@bin/hypothesis-layer-map.cjs
@bin/solve-wave-dag.cjs
@bin/nf-solve.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor autoClose to dispatch map with layerOrder parameter, wire into solve loop</name>
  <files>bin/nf-solve.cjs</files>
  <action>
This task has two parts: (A) refactor autoClose to use a dispatch map with optional layerOrder, and (B) wire hypothesis modules into the solve loop call site.

**Part A — Refactor autoClose (function at line ~3306)**

1. Add two require statements near the top of nf-solve.cjs (after existing requires around lines 42-54):
   ```
   const { loadHypothesisTransitions, computeLayerPriorityWeights } = require('./hypothesis-layer-map.cjs');
   const { computeWaves } = require('./solve-wave-dag.cjs');
   ```

2. Change the autoClose signature from `autoClose(residual, oscillatingSet)` to `autoClose(residual, oscillatingSet, layerOrder)`.

3. Inside autoClose, AFTER the `isLayerBlocked` helper and BEFORE the first if-block (line ~3327), create a dispatch map `LAYER_HANDLERS` that maps layer keys to handler functions. Each handler receives `(residual, actions, isLayerBlocked)` and contains the existing if-block logic for that layer. Extract these layer handlers from the existing if-chain:

   ```
   const LAYER_HANDLERS = {
     f_to_t: (res, acts, blocked) => {
       // existing f_to_t if-block logic (lines 3328-3358) — both stub generation AND stub upgrade
       if (blocked('f_to_t')) {
         acts.push('OSCILLATION BLOCKED: f_to_t — automated remediation suspended, human review required');
         return;
       }
       if (res.f_to_t.residual > 0) {
         // ... existing spawnTool('bin/formal-test-sync.cjs') logic ...
         // ... existing stub upgrade logic ...
       }
     },
     c_to_f: (res, acts, blocked) => {
       // existing c_to_f block (lines 3360-3367)
       if (res.c_to_f.residual > 0) { acts.push(res.c_to_f.residual + ' constant mismatch(es) — manual review required'); }
     },
     t_to_c: (res, acts, blocked) => {
       // existing t_to_c block (lines 3369-3374)
       if (res.t_to_c.residual > 0) { acts.push(res.t_to_c.residual + ' test failure(s) — manual fix required'); }
     },
     r_to_f: (res, acts, blocked) => {
       // existing r_to_f block (lines 3376-3390) with triage detail
     },
     f_to_c: (res, acts, blocked) => {
       // existing f_to_c block (lines 3392-3398)
     },
     r_to_d: (res, acts, blocked) => {
       // existing r_to_d block (lines 3400-3406)
     },
     d_to_c: (res, acts, blocked) => {
       // existing d_to_c block (lines 3408-3414)
     },
     p_to_f: (res, acts, blocked) => {
       // existing p_to_f block (lines 3416-3426) with autoClosePtoF
     },
     per_model_gates: (res, acts, blocked) => {
       // existing per_model_gates block (lines 3449-3536)
     },
   };
   ```

   IMPORTANT: Move the existing logic INTO each handler function verbatim. Do NOT rewrite or simplify the logic. Each handler should produce the exact same actions as the original if-block. The `blocked` parameter is `isLayerBlocked` (passed through to keep closure simple).

4. After the dispatch map, keep the TLA+ config regeneration block (lines 3428-3439), evidence readiness check (lines 3539-3568), and formal_lint block (lines 3441-3447) as direct calls OUTSIDE the dispatch map — these are cross-cutting concerns, not layer-specific handlers.

5. Replace the entire sequential if-chain (lines 3327-3536) with dispatch iteration:

   ```
   // Default layer order matches the original hardcoded sequence
   const DEFAULT_LAYER_ORDER = ['f_to_t', 'c_to_f', 't_to_c', 'r_to_f', 'f_to_c', 'r_to_d', 'd_to_c', 'p_to_f', 'per_model_gates'];

   const order = layerOrder || DEFAULT_LAYER_ORDER;
   for (const layerKey of order) {
     const handler = LAYER_HANDLERS[layerKey];
     if (handler) {
       handler(residual, actions, isLayerBlocked);
     }
   }
   ```

   If `layerOrder` is provided, iterate in that order. If a layer in `layerOrder` has no handler in the map (e.g., `git_heatmap`, `h_to_m`), skip silently — not all DAG layers have autoClose handlers. If `layerOrder` is null/undefined, use DEFAULT_LAYER_ORDER (backward compatible).

6. After the dispatch loop, keep the cross-cutting blocks (TLA+ config, formal_lint, evidence readiness) in their original position.

**Part B — Wire into solve loop call site (line ~4619)**

7. BEFORE the `autoClose(residual, oscillatingSet)` call at line ~4619, compute the layerOrder:

   ```
   // HTARGET-01/02: Compute hypothesis-driven layer dispatch order
   let layerOrder = null;
   try {
     const transitions = loadHypothesisTransitions(ROOT);
     const priorityWeights = computeLayerPriorityWeights(transitions);
     const waveOrder = computeWaves(residual, priorityWeights);
     if (waveOrder.length > 0) {
       // Flatten waves into a single layer order array
       layerOrder = [];
       for (const w of waveOrder) {
         for (const layer of w.layers) {
           layerOrder.push(layer);
         }
       }
       process.stderr.write(TAG + ' Wave ordering (' + waveOrder.length + ' waves, ' +
         (transitions.length > 0 ? transitions.length + ' hypothesis transition(s) applied' : 'no transitions') +
         '): ' + waveOrder.map(w => 'W' + w.wave + '[' + w.layers.join(',') + ']' + (w.sequential ? '(seq)' : '')).join(' -> ') + '\n');
     }
   } catch (e) {
     // fail-open: wave ordering failure means autoClose uses default order
     process.stderr.write(TAG + ' WARNING: wave ordering failed: ' + e.message + '\n');
   }
   ```

8. Change the autoClose call to pass layerOrder:
   ```
   const closeResult = autoClose(residual, oscillatingSet, layerOrder);
   ```

9. Store wave_order in the iteration record for JSON output. After:
   `iterations[iterations.length - 1].actions = closeResult.actions_taken;`
   Add:
   `iterations[iterations.length - 1].wave_order = layerOrder;`

**Constraints:**
- Each handler must produce IDENTICAL actions to the original if-block for the same inputs. This is a structural refactor, not a behavioral change (except for dispatch order).
- The `DEFAULT_LAYER_ORDER` must match the original if-chain sequence exactly so that `autoClose(residual, oscillatingSet)` (no layerOrder) behaves identically.
- All fail-open semantics preserved: if hypothesis modules throw, layerOrder stays null, autoClose uses default order.
  </action>
  <verify>
    Run: `grep 'LAYER_HANDLERS' bin/nf-solve.cjs` — should match the dispatch map definition.
    Run: `grep 'DEFAULT_LAYER_ORDER' bin/nf-solve.cjs` — should match the fallback array.
    Run: `grep 'layerOrder' bin/nf-solve.cjs` — should match in autoClose signature, dispatch loop, and call site.
    Run: `grep 'hypothesis-layer-map' bin/nf-solve.cjs` — should match the require line.
    Run: `grep 'solve-wave-dag' bin/nf-solve.cjs` — should match the require line.
    Run: `grep 'computeWaves' bin/nf-solve.cjs` — should match at the call site.
    Run: `node -e "const s = require('./bin/nf-solve.cjs'); console.log('imports OK')"` from project root — should print "imports OK".
    Run: `node bin/nf-solve.cjs --report-only --json 2>/dev/null | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('ok')})"` — end-to-end still works.
  </verify>
  <done>
    autoClose uses a LAYER_HANDLERS dispatch map iterated via layerOrder parameter. When layerOrder is null (default), dispatch uses DEFAULT_LAYER_ORDER matching the original hardcoded sequence. The solve loop call site computes waves from hypothesis transitions, flattens to layerOrder, and passes to autoClose. Wave ordering is logged to stderr and stored in iteration records.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests proving autoClose honors layerOrder dispatch order</name>
  <files>bin/nf-solve.test.cjs</files>
  <action>
Add a new test section (after existing test categories) that verifies autoClose behavioral dispatch ordering. Use the same `node:test` + `node:assert/strict` pattern as existing tests.

1. Test "TC-HTARGET-1: autoClose without layerOrder produces same actions as before (backward compat)":
   - Build a minimal residual object with `f_to_t: { residual: 1, detail: {} }` and all other layers at `{ residual: 0, detail: {} }` (include: c_to_f, t_to_c, r_to_f, f_to_c, r_to_d, d_to_c, p_to_f, per_model_gates, formal_lint, git_heatmap, c_to_r, t_to_r, d_to_r, hazard_model, l1_to_l3, l3_to_tc, h_to_m)
   - Call `autoClose(residual)` (no layerOrder, no oscillatingSet)
   - Assert result has `actions_taken` array and `stubs_generated` number — no regression

2. Test "TC-HTARGET-2: autoClose with layerOrder dispatches layers in specified order":
   - Build a residual with `r_to_f: { residual: 1, detail: { total: 1, covered: 0, percentage: 0 } }` and `t_to_c: { residual: 1, detail: {} }` both positive, all others at zero
   - Call `autoClose(residual, new Set(), ['t_to_c', 'r_to_f'])` — t_to_c BEFORE r_to_f (opposite of DEFAULT_LAYER_ORDER which has r_to_f before t_to_c [index 3] and t_to_c at [index 2] — actually t_to_c is at index 2 and r_to_f at index 3 in default, so use `['r_to_f', 't_to_c']` vs the default to show the first action comes from r_to_f)
   - Actually, the clearest test: call with `['t_to_c', 'r_to_f']` and verify first action mentions "test failure" (t_to_c), second mentions "requirement" (r_to_f). Then call again with `['r_to_f', 't_to_c']` and verify order flips.
   - Assert the actions appear in the order matching layerOrder, proving dispatch order is honored.

3. Test "TC-HTARGET-3: autoClose with layerOrder skips unknown layer keys gracefully":
   - Build a minimal residual (all layers zero)
   - Call `autoClose(residual, new Set(), ['nonexistent_layer', 'also_fake'])`
   - Assert returns normally with empty or near-empty actions_taken (no crash)

4. Test "TC-HTARGET-4: computeWaves + computeLayerPriorityWeights integration":
   - Import `computeWaves` from `solve-wave-dag.cjs` and `computeLayerPriorityWeights` from `hypothesis-layer-map.cjs`
   - Create mock transitions: `[{ layer_keys: ['r_to_f'] }]`
   - Call `computeLayerPriorityWeights(transitions)` — assert returns `{ r_to_f: 1 }`
   - Create mock residual: `{ r_to_f: { residual: 1 }, f_to_t: { residual: 1 } }`
   - Call `computeWaves(residual, weights)` — assert returns non-empty array
   - Flatten waves to layerOrder array, assert it contains 'r_to_f' and 'f_to_t'
  </action>
  <verify>
    Run: `node --test bin/nf-solve.test.cjs 2>&1 | tail -30` — all tests pass, including new TC-HTARGET tests.
    Run: `grep -c 'TC-HTARGET' bin/nf-solve.test.cjs` — should return 4 (four test descriptions).
  </verify>
  <done>
    Four TC-HTARGET tests verify: (1) backward compatibility without layerOrder, (2) dispatch order honors layerOrder parameter (the critical behavioral test), (3) unknown layer keys don't crash, (4) computeWaves/computeLayerPriorityWeights integration produces valid layerOrder arrays. All existing tests still pass.
  </done>
</task>

</tasks>

<verification>
1. `grep 'LAYER_HANDLERS' bin/nf-solve.cjs` returns match for dispatch map
2. `grep 'DEFAULT_LAYER_ORDER' bin/nf-solve.cjs` returns match for fallback
3. `grep 'layerOrder' bin/nf-solve.cjs` returns matches in signature, loop, and call site
4. `grep 'hypothesis-layer-map' bin/nf-solve.cjs` returns match
5. `grep 'solve-wave-dag' bin/nf-solve.cjs` returns match
6. `grep 'wave_order' bin/nf-solve.cjs` returns match in iteration record
7. `node --test bin/nf-solve.test.cjs` — all tests pass (0 failures)
8. `node bin/nf-solve.cjs --report-only --json 2>/dev/null | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('ok')})"` — end-to-end still works
</verification>

<success_criteria>
- autoClose refactored to use LAYER_HANDLERS dispatch map with layerOrder parameter
- DEFAULT_LAYER_ORDER matches original hardcoded if-chain sequence exactly
- autoClose(residual, oscillatingSet) without layerOrder is backward compatible
- Solve loop call site computes waves via hypothesis modules and passes flattened layerOrder to autoClose
- Wave ordering logged to stderr and stored in iteration records
- Tests prove dispatch order is behavioral (TC-HTARGET-2 is the critical test)
- All integration is fail-open (hypothesis module errors -> default order)
- All existing + new tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/319-wire-hypothesis-layer-map-cjs-and-solve-/319-SUMMARY.md`
</output>
