---
phase: quick-116
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/machines/qgsd-workflow.machine.ts
  - bin/generate-formal-specs.cjs
  - formal/tla/QGSDQuorum.tla
  - formal/tla/MCsafety.cfg
  - formal/tla/MCliveness.cfg
  - formal/alloy/quorum-votes.als
  - formal/prism/quorum.pm
  - formal/prism/quorum.props
autonomous: true
requirements: [QUICK-116]

must_haves:
  truths:
    - "Running node bin/generate-formal-specs.cjs produces formal specs that match the semantics already in the hand-extended QGSDQuorum.tla (unanimity, MaxSize, polledCount)"
    - "XState machine context includes maxSize: 3 and polledCount: 0, with a unanimityMet guard (successCount >= polledCount)"
    - "Generator extracts maxSize from machine context rather than using a hardcoded constant"
    - "Generator has a GUARD_REGISTRY mapping guard names to TLA+/Alloy/PRISM translations — guard formulas are no longer baked into template strings"
    - "All 6 generated files (QGSDQuorum.tla, MCsafety.cfg, MCliveness.cfg, quorum-votes.als, quorum.pm, quorum.props) are consistent with each other and with the machine"
    - "Existing hook tests continue to pass after changes"
  artifacts:
    - path: "src/machines/qgsd-workflow.machine.ts"
      provides: "XState machine — source of truth with maxSize/polledCount context and unanimityMet guard"
      contains: "maxSize: 3"
    - path: "bin/generate-formal-specs.cjs"
      provides: "Formal spec generator — fully automatic, no hardcoded guard formulas"
      contains: "GUARD_REGISTRY"
    - path: "formal/tla/QGSDQuorum.tla"
      provides: "TLA+ spec — generated, matches current hand-extended semantics (unanimity, MaxSize, polledCount)"
      contains: "MaxSize"
    - path: "formal/alloy/quorum-votes.als"
      provides: "Alloy model — uses unanimity predicate derived from guard registry"
      contains: "UnanimityReached"
    - path: "formal/prism/quorum.pm"
      provides: "PRISM DTMC — updated to reference unanimity semantics"
      contains: "unanimityMet"
  key_links:
    - from: "src/machines/qgsd-workflow.machine.ts"
      to: "bin/generate-formal-specs.cjs"
      via: "regex extraction of context fields and guard bodies"
      pattern: "maxSize:\\s*(\\d+)"
    - from: "bin/generate-formal-specs.cjs"
      to: "formal/tla/QGSDQuorum.tla"
      via: "GUARD_REGISTRY.unanimityMet.tla template"
      pattern: "GUARD_REGISTRY"
    - from: "bin/generate-formal-specs.cjs"
      to: "formal/alloy/quorum-votes.als"
      via: "GUARD_REGISTRY.unanimityMet.alloy template"
      pattern: "GUARD_REGISTRY"
---

<objective>
Make the formal spec generator fully automatic by: (1) adding maxSize and polledCount to the XState machine context with a unanimityMet guard, (2) updating the generator to extract these context fields and build a guard-to-formal translation registry, and (3) regenerating all formal specs from the now-correct machine.

Purpose: The hand-extended QGSDQuorum.tla (quick-115) diverged from the generator — unanimity replaced majority, MaxSize and polledCount were added. The generator must be updated to produce these same semantics automatically so the formal specs are never out of sync with the machine again.

Output: Updated machine, updated generator with GUARD_REGISTRY, regenerated formal specs that match the existing hand-extended TLA+ semantics.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key prior art to match exactly:
@formal/tla/QGSDQuorum.tla
@formal/tla/MCsafety.cfg
@formal/tla/MCliveness.cfg
@src/machines/qgsd-workflow.machine.ts
@bin/generate-formal-specs.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add maxSize, polledCount context and unanimityMet guard to XState machine</name>
  <files>src/machines/qgsd-workflow.machine.ts</files>
  <action>
Add two fields to the QGSDContext interface and context initializer, then add the unanimityMet guard:

1. In `QGSDContext` interface, add after `maxDeliberation: number`:
   ```
   maxSize:    number;   // cap on voters polled per round (--n N - 1 ceiling)
   polledCount: number;  // agents actually recruited this round
   ```

2. In `.createMachine({ context: { ... } })`, add after `maxDeliberation: 7`:
   ```
   maxSize:     3,
   polledCount: 0,
   ```

3. In `guards: { ... }`, add after `minQuorumMet`:
   ```
   unanimityMet: ({ context }) =>
     context.successCount >= context.polledCount,
   ```

Do NOT remove `minQuorumMet` — keep it. The machine currently uses `minQuorumMet` in its transitions (COLLECTING_VOTES → DECIDED guard). We are adding `unanimityMet` as an additional guard that the generator can read and use for formal spec translation. The existing machine transitions do not need to change their guard references — this task only adds the context fields and the new guard definition.

Note: `maxSize: 3` matches the default polled ceiling (MinSize/2 = ceil(5/2) = 3 external models by default). This is the value currently hardcoded in MCsafety.cfg and MCliveness.cfg from quick-115.
  </action>
  <verify>
Run: `node -e "const m = require('./src/machines/qgsd-workflow.machine.ts'); console.log('ok')" 2>&1 || npx tsc --noEmit 2>&1 | head -20`

Check that the TypeScript compiles without errors related to the new fields.

Also verify content:
```
grep -n "maxSize\|polledCount\|unanimityMet" src/machines/qgsd-workflow.machine.ts
```
Expected: 5+ matches covering interface, context initializer, and guard definition.
  </verify>
  <done>
`src/machines/qgsd-workflow.machine.ts` contains:
- `maxSize: number` in QGSDContext interface
- `polledCount: number` in QGSDContext interface
- `maxSize: 3` in context initializer
- `polledCount: 0` in context initializer
- `unanimityMet: ({ context }) => context.successCount >= context.polledCount` in guards
TypeScript compiles without errors on the new fields.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add GUARD_REGISTRY and context extraction to generator, regenerate all formal specs</name>
  <files>bin/generate-formal-specs.cjs</files>
  <action>
Update `bin/generate-formal-specs.cjs` with three changes:

**A. Extract maxSize from machine context (after existing maxDelib extraction, line ~46):**
```js
// maxSize default — cap on voters polled per round
const maxSizeMatch = src.match(/maxSize:\s*(\d+)/);
const maxSize = maxSizeMatch ? parseInt(maxSizeMatch[1], 10) : 3;

// polledCount initial value
const polledCountMatch = src.match(/polledCount:\s*(\d+)/);
const polledCountInit = polledCountMatch ? parseInt(polledCountMatch[1], 10) : 0;
```

Update the extraction failure check (line ~57) to include maxSize:
```js
if (!stateNames.length || maxDelib === null || !initialState || !finalState || maxSize === null) {
  // add maxSize to error output
  process.stderr.write('  maxSize: ' + maxSize + '\n');
}
```

Update the stdout progress line (line ~74) to include maxSize:
```js
process.stdout.write('[generate-formal-specs] XState machine → ' + stateNames.join(', ') +
  '  maxDeliberation=' + maxDelib + '  maxSize=' + maxSize + '  initial=' + initialState + '  final=' + finalState + '\n');
```

**B. Add GUARD_REGISTRY after the extraction block (before the TLA spec generation):**
```js
// ── Guard-to-formal translation registry ─────────────────────────────────────
// Each guard maps its TypeScript predicate to its TLA+, Alloy, and PRISM translations.
// Update this registry when guard formulas change — never hardcode guard logic in templates.
const GUARD_REGISTRY = {
  unanimityMet: {
    ts:    'successCount >= polledCount',
    tla:   'n = p',                                          // CollectVotes(n,p): all polled approved
    alloy: '#r.approvals = #r.polled',                       // VoteRound: approvals equals polled set
    prism: 'tp_rate',                                        // P(unanimous | available) = tp_rate
    desc:  'All polled agents approved (unanimity within the polled set)',
  },
  minQuorumMet: {
    ts:    'successCount >= Math.ceil(slotsAvailable / 2)',
    tla:   'n * 2 >= N',                                     // majority of total roster
    alloy: 'mul[#r.approvals, 2] >= r.total',
    prism: 'tp_rate * (1 - unavail)',
    desc:  'Majority of available agents approved (legacy — superseded by unanimityMet)',
  },
  noInfiniteDeliberation: {
    ts:    'deliberationRounds < maxDeliberation',
    tla:   'deliberationRounds < MaxDeliberation',
    alloy: 'r.rounds < MaxDeliberation',
    prism: 'deliberationRounds < maxDelib',
    desc:  'Deliberation has not reached the maximum round cap',
  },
};
```

**C. Update the TLA+ spec generation to use the extracted maxSize and polledCount, matching the hand-extended QGSDQuorum.tla exactly.**

Replace the current `tlaSpec` array (lines ~83-216) with a version that:
- Adds `MaxSize` to CONSTANTS block: `    MaxSize          \\* Cap on voters polled per round (default: ' + maxSize + ')'`
- Adds `ASSUME MaxSize \\in 1..N` after `N == Cardinality(Agents)`
- Adds `polledCount` to VARIABLES: `    polledCount,        \\* Number of agents actually recruited this round (≤ MaxSize; may be less if roster runs dry)`
- Updates `vars` to include polledCount: `vars == <<phase, successCount, polledCount, deliberationRounds>>`
- Updates TypeOK to use MaxSize bounds: `    /\\ successCount \\in 0..MaxSize`, `    /\\ polledCount \\in 0..MaxSize`
- Updates Init: `    /\\ polledCount        = ' + polledCountInit`
- Updates CollectVotes to use unanimity semantics (`n = p` from GUARD_REGISTRY.unanimityMet.tla):
  - Signature: `CollectVotes(n, p)` with `p \\in 1..MaxSize`, `n \\in 0..p`
  - Unanimity branch: `IF n = p` → DECIDED; else → DELIBERATING (set `polledCount' = p`, `deliberationRounds' = deliberationRounds + 1`)
  - Comment: `\\* unanimityMet (' + GUARD_REGISTRY.unanimityMet.ts + '): ' + GUARD_REGISTRY.unanimityMet.desc`
- Updates Deliberate to use unanimity: `IF n = polledCount \\/ deliberationRounds >= MaxDeliberation`
- Updates Next: `\\/ \\E p \\in 1..MaxSize : \\E n \\in 0..p : CollectVotes(n, p)`, `\\/ \\E n \\in 0..MaxSize : Deliberate(n)`
- Replaces MinQuorumMet invariant with UnanimityMet: `UnanimityMet == phase = "' + finalState + '" => (successCount = polledCount \\/ deliberationRounds >= MaxDeliberation)`
- Adds QuorumCeilingMet invariant: `QuorumCeilingMet == phase = "' + finalState + '" => /\\ polledCount <= MaxSize /\\ (successCount = polledCount \\/ deliberationRounds >= MaxDeliberation)`
- Updates AnyCollectVotes: `AnyCollectVotes == \\E p \\in 1..MaxSize : \\E n \\in 0..p : CollectVotes(n, p)`
- Updates AnyDeliberate: `AnyDeliberate   == \\E n \\in 0..MaxSize : Deliberate(n)`
- Updates guard translation comments to reference GUARD_REGISTRY keys instead of hardcoded formulas

**D. Update MCsafety.cfg generation** to:
- Add `MaxSize = ' + maxSize` to CONSTANTS (after MaxDeliberation)
- Replace `INVARIANT MinQuorumMet` with `INVARIANT UnanimityMet`
- Add `INVARIANT QuorumCeilingMet`

**E. Update MCliveness.cfg generation** to:
- Add `MaxSize = ' + maxSize` to CONSTANTS (after MaxDeliberation)

**F. Update Alloy spec generation** to use unanimity semantics:
- The `MajorityReached` pred becomes `UnanimityReached`: `#r.approvals = r.polled`
- Add `polled : one Int` field to `VoteRound` sig (alongside `total`)
- Update comments to reference `GUARD_REGISTRY.unanimityMet.alloy`
- Update assertions to check unanimity: ThresholdPasses → all polled agents must approve, BelowThresholdFails → one missing approval fails unanimity
- Keep `fact AgentCount { #Agent = ' + SAFETY_AGENTS + ' }` but update scope comments

**G. Update PRISM spec generation** to reference unanimity in comments:
- Update the `minQuorumMet → DECIDED` comment to `unanimityMet → DECIDED`
- Reference `GUARD_REGISTRY.unanimityMet.desc` in the module comment

**After all generator changes, run the generator:**
```
node bin/generate-formal-specs.cjs
```

The generated QGSDQuorum.tla MUST structurally match the hand-extended version in formal/tla/QGSDQuorum.tla (the one currently on disk). The generator now owns the file — remove the "Hand-extended" warning from the header and restore "GENERATED — do not edit by hand."
  </action>
  <verify>
```bash
# 1. Generator runs without errors
node bin/generate-formal-specs.cjs

# 2. MaxSize present in all generated files
grep -l "MaxSize" formal/tla/QGSDQuorum.tla formal/tla/MCsafety.cfg formal/tla/MCliveness.cfg

# 3. UnanimityMet in TLA+ (not MinQuorumMet)
grep "UnanimityMet\|QuorumCeilingMet" formal/tla/QGSDQuorum.tla formal/tla/MCsafety.cfg

# 4. polledCount in TLA+ variables
grep "polledCount" formal/tla/QGSDQuorum.tla

# 5. GUARD_REGISTRY in generator
grep "GUARD_REGISTRY" bin/generate-formal-specs.cjs

# 6. maxSize extracted from machine (not hardcoded)
grep "maxSizeMatch\|maxSize" bin/generate-formal-specs.cjs | head -5

# 7. Alloy uses unanimity predicate
grep "UnanimityReached\|unanimity" formal/alloy/quorum-votes.als

# 8. Header restored to GENERATED (not Hand-extended)
grep "GENERATED\|Hand-extended" formal/tla/QGSDQuorum.tla

# 9. Existing hook tests still pass
node --test hooks/qgsd-stop.test.js 2>&1 | tail -5
node --test hooks/qgsd-prompt.test.js 2>&1 | tail -5
```
  </verify>
  <done>
- `bin/generate-formal-specs.cjs` has a `GUARD_REGISTRY` constant with `unanimityMet`, `minQuorumMet`, `noInfiniteDeliberation` entries
- Generator extracts `maxSize` from machine source via regex
- Running `node bin/generate-formal-specs.cjs` exits 0 and writes all 6 files
- `formal/tla/QGSDQuorum.tla` contains `MaxSize`, `polledCount`, `UnanimityMet`, `QuorumCeilingMet` and header says "GENERATED — do not edit by hand"
- `formal/tla/MCsafety.cfg` has `MaxSize`, `INVARIANT UnanimityMet`, `INVARIANT QuorumCeilingMet`
- `formal/tla/MCliveness.cfg` has `MaxSize`
- `formal/alloy/quorum-votes.als` uses unanimity predicate
- Hook tests: 32/32 stop, 16/16 prompt
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. Generator is idempotent — running it twice produces identical output:
   ```bash
   node bin/generate-formal-specs.cjs && md5sum formal/tla/QGSDQuorum.tla > /tmp/h1
   node bin/generate-formal-specs.cjs && md5sum formal/tla/QGSDQuorum.tla > /tmp/h2
   diff /tmp/h1 /tmp/h2  # must be empty
   ```

2. Machine context fields match TLA+ constants:
   - machine `maxSize: 3` → `MCsafety.cfg MaxSize = 3`
   - machine `maxDeliberation: 7` → `MCsafety.cfg MaxDeliberation = 7`

3. Guard registry drives the formal translations (not baked strings):
   ```bash
   grep "unanimityMet\|GUARD_REGISTRY" bin/generate-formal-specs.cjs | wc -l
   # must be > 5 occurrences
   ```

4. All tests pass:
   ```bash
   node --test hooks/qgsd-stop.test.js 2>&1 | grep "pass\|fail"
   node --test hooks/qgsd-prompt.test.js 2>&1 | grep "pass\|fail"
   ```
</verification>

<success_criteria>
- XState machine has `maxSize: 3`, `polledCount: 0` in context and `unanimityMet` guard
- Generator extracts `maxSize` from machine source (no hardcoded fallback used in practice)
- GUARD_REGISTRY in generator maps guard names to TLA+/Alloy/PRISM translations
- Generated QGSDQuorum.tla is structurally identical to the hand-extended version from quick-115 (unanimity semantics, MaxSize constant, polledCount variable, UnanimityMet + QuorumCeilingMet invariants)
- QGSDQuorum.tla header says "GENERATED — do not edit by hand" (no longer Hand-extended warning)
- Running the generator is safe and produces correct output without manual editing
- 32/32 stop hook tests pass, 16/16 prompt hook tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/116-make-formal-spec-generator-fully-automat/116-SUMMARY.md`
</output>
