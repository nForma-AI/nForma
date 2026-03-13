---
phase: quick-280
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-prompt.js
  - hooks/dist/nf-prompt.js
  - bin/quorum-preflight.cjs
  - test/model-dedup.test.cjs
autonomous: true
requirements: [QUICK-280]
formal_artifacts: none

must_haves:
  truths:
    - "When two slots share the same model, only the first (by auth_type sort order) is dispatched as primary"
    - "The duplicate-model slot is demoted to a fallback position between T1 and T2 in FALLBACK-01 sequence"
    - "Quorum preflight --team output shows model per slot so dedup reasoning is visible"
    - "Slots with unique models are unaffected by dedup logic"
  artifacts:
    - path: "hooks/nf-prompt.js"
      provides: "Model dedup logic after orderedSlots sort, before externalSlotCap slice"
      contains: "modelDedup"
    - path: "test/model-dedup.test.cjs"
      provides: "Unit tests for model dedup behavior"
      min_lines: 40
    - path: "bin/quorum-preflight.cjs"
      provides: "Model info in buildTeam output"
      contains: "display_provider"
  key_links:
    - from: "hooks/nf-prompt.js"
      to: "bin/providers.json"
      via: "agentCfg lookup for model field"
      pattern: "agentCfg\\[.*\\]\\.model"
    - from: "hooks/nf-prompt.js"
      to: "buildFalloverRule"
      via: "modelDedupFallbacks inserted between T1 and T2"
      pattern: "modelDedup"
---

<objective>
Deduplicate quorum slots that share the same underlying model so the quorum gets diverse model perspectives instead of duplicate votes from the same model via different slot names.

Purpose: codex-1 and codex-2 both run gpt-5.4; gemini-1 and gemini-2 both run gemini-3-pro-preview. Dispatching both wastes a quorum slot on a duplicate perspective. Keep one as primary, demote the duplicate to fallback tier for resilience.

Output: Updated dispatch logic in nf-prompt.js, enhanced preflight output, test coverage.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-prompt.js
@bin/quorum-preflight.cjs
@bin/providers.json
@test/fallback-01-regression.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add model-dedup step to nf-prompt.js dispatch logic</name>
  <files>hooks/nf-prompt.js</files>
  <action>
In the quorum dispatch section of nf-prompt.js, after orderedSlots is sorted by auth_type (around line 478, after the `if (preferSub)` sort block) and BEFORE the `const externalSlotCap = fanOutCount - 1` line (~line 481):

1. Add a model-dedup step that:
   - Creates a `seenModels` Map (model string -> first slot name that claimed it)
   - Creates a `modelDedupFallbacks` array for demoted duplicate-model slots
   - Iterates orderedSlots. For each slot, look up its model via `agentCfg[slot.slot]?.model || 'unknown'`
   - If the model is already in seenModels, remove the slot from orderedSlots and push it to modelDedupFallbacks
   - If the model is new, add it to seenModels and keep the slot in orderedSlots
   - Log to stderr when a slot is demoted: `[nf-dispatch] MODEL-DEDUP: ${slot.slot} (${model}) demoted to fallback — duplicate of ${seenModels.get(model)}`

2. Update the FALLBACK-01 sequence builder call. Currently t1Unused and t2Slots are computed from orderedSlots (lines 618-624). Insert `modelDedupFallbacks` as a new tier between T1 and T2:
   - After computing t1Unused (line 619-621), compute `const tModelDedup = modelDedupFallbacks.map(s => s.slot)`
   - Pass tModelDedup to buildFalloverRule as a new parameter

3. Update `buildFalloverRule` function (line 309) to accept and render the new model-dedup tier:
   - Add `modelDedupSlots` parameter (array of slot names, default [])
   - In the step rendering, insert model-dedup slots between T1 and T2:
     - If modelDedupSlots.length > 0, add: `Step N MODEL-DEDUP: [slots] <- same model as a primary, try before T2`
   - Adjust step numbering accordingly

4. Export `modelDedupFallbacks` computation as a testable function. Create and export a `deduplicateByModel(orderedSlots, agentCfg)` function that returns `{ unique: [...], duplicates: [...] }`. Use this in the main dispatch path.

IMPORTANT: The dedup must happen BEFORE the externalSlotCap slice so that the cap is applied to unique-model slots only. This ensures the quorum gets maximum model diversity within the fan-out budget.

Formal invariant note: EventualConsensus is not affected — dedup only reorders/filters the dispatch list, it does not change the vote collection or decision logic.
  </action>
  <verify>
Run `node test/fallback-01-regression.test.cjs` — existing tests must still pass (dedup is additive, does not change buildFalloverRule contract for callers passing empty modelDedupSlots).

Grep for the new function: `grep 'deduplicateByModel' hooks/nf-prompt.js` returns matches.
  </verify>
  <done>
Model dedup logic exists in nf-prompt.js. Duplicate-model slots are moved to fallback tier. Existing FALLBACK-01 tests pass. Function is exported for testing.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add model-dedup tests and enhance preflight output</name>
  <files>test/model-dedup.test.cjs, bin/quorum-preflight.cjs</files>
  <action>
**test/model-dedup.test.cjs:**

Create a test file following the same pattern as test/fallback-01-regression.test.cjs (require assert, custom test runner, exit code based on failures).

Import `{ deduplicateByModel, buildFalloverRule }` from `../hooks/nf-prompt.js`.

Test cases for deduplicateByModel:
1. **No duplicates** — all unique models: input 4 slots with 4 different models, output unique=4, duplicates=0
2. **One pair of duplicates** — codex-1 (gpt-5.4) + codex-2 (gpt-5.4): unique keeps codex-1, duplicates has codex-2
3. **Two pairs of duplicates** — codex-1/codex-2 (gpt-5.4) + gemini-1/gemini-2 (gemini-3-pro): unique=2 (codex-1, gemini-1), duplicates=2 (codex-2, gemini-2)
4. **Auth-type sort order respected** — if orderedSlots already has sub slots first, the first sub slot wins (not the api slot)
5. **Unknown model (missing agentCfg entry)** — slot not in agentCfg gets model 'unknown', treated as unique

Test cases for buildFalloverRule with modelDedupSlots:
6. **Model-dedup tier rendered** — pass modelDedupSlots=['codex-2'], verify output contains 'MODEL-DEDUP' and 'codex-2'
7. **Empty model-dedup tier** — pass modelDedupSlots=[], verify no MODEL-DEDUP line in output
8. **Step numbering correct** — with T1 + MODEL-DEDUP + T2, verify steps are numbered sequentially

Mock agentCfg as a plain object: `{ 'codex-1': { model: 'gpt-5.4', auth_type: 'sub' }, ... }`.

**bin/quorum-preflight.cjs:**

Update the `buildTeam` function to include `display_provider` alongside `model`:
- Change line 62 from `team[p.name] = { model: p.model }` to `team[p.name] = { model: p.model, display_provider: p.display_provider || p.provider }`
- This makes model info visible in `node bin/quorum-preflight.cjs --team` output so users can see which slots share models
  </action>
  <verify>
Run `node test/model-dedup.test.cjs` — all 8 tests pass.

Run `node test/fallback-01-regression.test.cjs` — existing tests still pass (buildFalloverRule backward compatible with new optional param).

Run `node bin/quorum-preflight.cjs --team` — output JSON includes display_provider field.
  </verify>
  <done>
8 model-dedup tests pass. Existing fallback-01 tests pass. Preflight --team output shows model and display_provider per slot.
  </done>
</task>

<task type="auto">
  <name>Task 3: Sync hooks/dist and run install</name>
  <files>hooks/dist/nf-prompt.js</files>
  <action>
1. Copy the updated hook to dist: `cp hooks/nf-prompt.js hooks/dist/nf-prompt.js`
2. Run installer: `node bin/install.js --claude --global`
3. Verify the installed copy at ~/.claude/hooks/ has the dedup logic

This is required per project convention: edits to hook source files MUST sync to hooks/dist/ and run install.
  </action>
  <verify>
`grep 'deduplicateByModel' hooks/dist/nf-prompt.js` returns matches.

`grep 'deduplicateByModel' ~/.claude/hooks/nf-prompt.js` returns matches (installed copy).

`node bin/install.js --claude --global` exits 0.
  </verify>
  <done>
hooks/dist/nf-prompt.js synced. Install completed. Installed hook at ~/.claude/hooks/ contains model-dedup logic.
  </done>
</task>

</tasks>

<verification>
1. `node test/model-dedup.test.cjs` — all dedup tests pass
2. `node test/fallback-01-regression.test.cjs` — existing fallback tests pass (no regression)
3. `grep 'MODEL-DEDUP' hooks/nf-prompt.js` — new tier visible in FALLBACK-01 sequence
4. `grep 'deduplicateByModel' hooks/dist/nf-prompt.js` — synced to dist
5. `node bin/quorum-preflight.cjs --team` — shows model per slot for dedup visibility
</verification>

<success_criteria>
- Duplicate-model slots (codex-1/codex-2, gemini-1/gemini-2) are deduplicated before fan-out cap, maximizing model diversity
- Demoted slots appear in FALLBACK-01 as MODEL-DEDUP tier between T1 and T2
- 8 new tests cover dedup logic and FALLBACK-01 integration
- No regression in existing fallback-01 tests
- Hook synced to dist and installed globally
</success_criteria>

<output>
After completion, create `.planning/quick/280-deduplicate-quorum-slots-sharing-the-sam/SUMMARY.md`
</output>
