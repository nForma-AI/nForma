---
phase: quick-325
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-scope-scan.cjs
  - test/formal-scope-scan-semantic.test.cjs
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "Layer 3 runs only when layers 1+2 return zero matches, computing cosine similarity against concatenated scope concepts"
    - "Layer 4 runs only when layers 1+2+3 return zero matches, spawning claude CLI via spawnSync"
    - "Layer 4 is disabled by default; --l4 flag opts in"
    - "Both layers integrate cleanly with --format lines and --format json output modes"
    - "Layer 3 and 4 matches include match_type field set to 'semantic' and 'agentic' respectively"
    - "Graceful fallback: if @xenova/transformers unavailable or claude CLI absent/timeout, layers skip silently with stderr warning"
  artifacts:
    - path: "bin/formal-scope-scan.cjs"
      provides: "Extended scope scan with Layer 3 (semantic) and Layer 4 (agentic)"
      contains: "runSemanticLayer"
    - path: "test/formal-scope-scan-semantic.test.cjs"
      provides: "Tests for Layer 3 and Layer 4 behavior"
  key_links:
    - from: "main() in bin/formal-scope-scan.cjs"
      to: "runSemanticLayer()"
      via: "conditional: enriched.length === 0 && !args.noL3"
      pattern: "runSemanticLayer"
    - from: "main() in bin/formal-scope-scan.cjs"
      to: "runAgenticLayer()"
      via: "conditional: enriched.length === 0 && args.l4"
      pattern: "runAgenticLayer"
---

<objective>
Extend bin/formal-scope-scan.cjs with two new fallback layers:
- Layer 3: sentence transformer semantic similarity using @xenova/transformers (Xenova/all-MiniLM-L6-v2) with cosine similarity threshold 0.35, tunable via --l3-threshold
- Layer 4: Claude Code sub-agent search via spawnSync('claude', [...]) that scans .planning/formal/spec/*/ directories, opt-in via --l4 flag

Purpose: When exact/proximity matching fails (0 matches from layers 1+2), semantic and agentic fallbacks improve coverage discovery for queries that use synonymous language or novel terminology.
Output: Modified bin/formal-scope-scan.cjs with two new functions + exported symbols; test file covering layer behavior.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/formal-scope-scan.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Layer 3 (semantic similarity) and Layer 4 (agentic search) to formal-scope-scan.cjs</name>
  <files>bin/formal-scope-scan.cjs</files>
  <action>
Extend bin/formal-scope-scan.cjs with two new exported functions and integrate them into main().

**Arg parsing additions** — add to parseArgs():
- `--l3-threshold <float>`: default 0.35, parsed as parseFloat
- `--no-l3`: disable Layer 3 (args.noL3 = true)
- `--l4`: enable Layer 4 (args.l4 = true, default false)

**Layer 3 — runSemanticLayer(query, modules, threshold)**:

```js
async function runSemanticLayer(query, modules, threshold) {
  // modules: array of { name, concepts[] } objects
  // Returns: array of { module, path, match_type: 'semantic', similarity_score }
}
```

Implementation steps:
1. Attempt `require('@xenova/transformers')` inside a try/catch. If it throws (not installed), write a warning to stderr ("Warning: @xenova/transformers not available, skipping Layer 3") and return [].
2. Destructure `{ pipeline }` from the import result.
3. Create embedder: `const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')`.
4. Compute query embedding: `const queryEmb = await embedder(query, { pooling: 'mean', normalize: true })`.
5. For each module: concatenate its concepts array into a single string (join with ' '). Compute embedding. Compute cosine similarity between query vector and module vector using dot product (vectors are already L2-normalized via `normalize: true`).
6. If similarity >= threshold, add `{ module: mod.name, path: '.planning/formal/spec/' + mod.name + '/invariants.md', match_type: 'semantic', similarity_score: Math.round(sim * 1000) / 1000 }` to results.
7. Sort results by similarity_score descending.
8. Return results array.

Cosine similarity function (vectors already normalized — dot product suffices):
```js
function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
```

**Layer 4 — runAgenticLayer(query, specDir)**:

```js
function runAgenticLayer(query, specDir) {
  // Returns: array of { module, path, match_type: 'agentic' }
}
```

Implementation steps:
1. Check if `claude` CLI is available: `spawnSync('which', ['claude'], { encoding: 'utf8' })`. If status !== 0, write stderr warning ("Warning: claude CLI not available, skipping Layer 4") and return [].
2. Build prompt string:
```
You are searching for formal specification modules that match a query.
Scan the directories under .planning/formal/spec/ and identify which module names are relevant to this query:

Query: <query>

Return ONLY a JSON array of module directory names (strings), e.g. ["breaker", "quorum"].
If none match, return [].
```
3. Run: `spawnSync('claude', ['-p', prompt, '--output-format', 'text'], { encoding: 'utf8', timeout: 30000, cwd: ROOT, stdio: 'pipe' })`.
4. If result.error or result.status === null (timeout), write stderr warning ("Warning: Layer 4 claude CLI timed out or failed, skipping") and return [].
5. Parse stdout as JSON array. Wrap in try/catch — on parse failure, write stderr warning and return [].
6. Filter parsed names to only include modules that actually exist as directories in specDir (guard against hallucinated names).
7. Map valid names to `{ module: name, path: '.planning/formal/spec/' + name + '/invariants.md', match_type: 'agentic' }`.
8. Return results.

**main() integration** — after the Layer 2 enrichment block (after `const enriched = enrichWithProximityIndex(...)`):

```js
// Layer 3: Semantic similarity fallback (runs only when layers 1+2 return 0 matches)
let finalMatches = enriched;
if (enriched.length === 0 && !args.noL3) {
  const modulesForL3 = modules.map(mod => {
    const scopePath = path.join(SPEC_DIR, mod, 'scope.json');
    let concepts = [];
    try { concepts = JSON.parse(fs.readFileSync(scopePath, 'utf8')).concepts || []; } catch (_) {}
    return { name: mod, concepts };
  });
  const threshold = args.l3Threshold !== undefined ? args.l3Threshold : 0.35;
  finalMatches = await runSemanticLayer(args.description, modulesForL3, threshold);
}

// Layer 4: Agentic fallback (runs only when layers 1+2+3 return 0 matches, and --l4 is set)
if (finalMatches.length === 0 && args.l4) {
  finalMatches = runAgenticLayer(args.description, SPEC_DIR);
}
```

Because Layer 3 uses async (pipeline), convert main() to async: `async function main()` and call with `main().catch(e => { console.error(e); process.exit(1); })` instead of `main()`.

**Output integration** — replace the existing output block at the bottom of main() to use `finalMatches` instead of `enriched`. The --format lines branch: use `m.module + '\t' + m.path` (same as existing). The json branch: `JSON.stringify(finalMatches, null, 2)`.

**Help text additions** — add to printHelp():
```
  --l3-threshold N       Cosine similarity threshold for Layer 3 (default: 0.35)
  --no-l3                Disable Layer 3 semantic fallback
  --l4                   Enable Layer 4 agentic fallback (disabled by default; slow/expensive)
Layer 3 (semantic — @xenova/transformers, runs when layers 1+2 return 0 matches):
  Computes cosine similarity between query and module concept text.
  Modules above threshold returned with match_type: "semantic".
Layer 4 (agentic — claude CLI sub-agent, runs when layers 1+2+3 return 0 matches):
  Spawns claude CLI to search spec directories. Requires --l4 flag to enable.
  Returns match_type: "agentic". Skips silently if claude CLI unavailable.
```

**Exports** — add to module.exports at bottom:
`runSemanticLayer, runAgenticLayer, cosineSim`

**IMPORTANT:** Do NOT use dynamic import() for @xenova/transformers since this is a CommonJS file (require is fine; @xenova/transformers supports CJS). The try/catch around require is the graceful fallback mechanism.
  </action>
  <verify>
    1. `node bin/formal-scope-scan.cjs --description "circuit breaker timeout oscillation" --format lines` — runs without error (layers 1+2 likely match "breaker" module; Layer 3 not triggered).
    2. `node bin/formal-scope-scan.cjs --description "zzz-totally-obscure-query-xyzzy-no-match" --no-l3 --format json` — returns `[]` without crashing (no match, Layer 3 disabled, Layer 4 disabled by default).
    3. `node bin/formal-scope-scan.cjs --help | grep "l3-threshold"` — shows the new flag.
    4. `node -e "const m = require('./bin/formal-scope-scan.cjs'); console.log(typeof m.runAgenticLayer, typeof m.cosineSim)"` — outputs `function function`.
  </verify>
  <done>
    - Layer 3 and Layer 4 functions are implemented and exported
    - main() is async and integrates both layers with correct fallback conditions
    - --l3-threshold, --no-l3, --l4 flags are parsed and functional
    - Graceful fallback: missing @xenova/transformers or absent claude CLI writes warning to stderr and returns []
    - Help text includes Layer 3 and Layer 4 descriptions
  </done>
</task>

<task type="auto">
  <name>Task 2: Write tests for Layer 3 and Layer 4 behavior</name>
  <files>test/formal-scope-scan-semantic.test.cjs</files>
  <action>
Create test/formal-scope-scan-semantic.test.cjs using Node.js built-in test runner (require('node:test'), require('node:assert')).

Test the exported functions directly (not CLI invocation) to keep tests fast and dependency-free.

**cosineSim tests:**
- Two identical unit vectors → 1.0
- Orthogonal vectors → 0.0
- General case: [0.6, 0.8] · [0.8, 0.6] = 0.48 + 0.48 = 0.96

**runSemanticLayer — module not installed path:**
Since @xenova/transformers likely IS installed in the project (if it's in package.json) or IS NOT, test the graceful fallback path by mocking the require. The cleanest approach for CJS: temporarily override require.cache to simulate missing module.

Use spawnSync to invoke a small inline Node script that deletes the @xenova cache entry and calls runSemanticLayer. Actually, the cleanest testable approach for the unavailable case: write a dedicated mini test script that uses Module._resolveFilename trick.

For practical test coverage, use spawnSync CLI invocation for the fallback path tests:

```js
// Test: --no-l3 flag disables semantic layer (no transformer import attempted)
// Run with a description that won't match layers 1+2, but --no-l3 ensures [] returned
const result = spawnSync(process.execPath, [SCRIPT, '--description', 'zzz-xyzzy-nomatch-999', '--no-l3', '--format', 'json'], {...});
assert.strictEqual(result.status, 0);
assert.deepStrictEqual(JSON.parse(result.stdout.trim()), []);
```

**runAgenticLayer — unit test the guard logic:**
Test that when `which claude` fails (mock by passing a non-existent specDir and a non-existent binary), the function returns [] without throwing. Since we can't easily mock spawnSync in CJS, test via a separate spawn that sets PATH to empty:

```js
const result = spawnSync(process.execPath, [SCRIPT, '--description', 'zzz-nomatch-999', '--l4', '--no-l3', '--format', 'json'], {
  encoding: 'utf8', timeout: 10000, cwd: ROOT,
  env: { ...process.env, PATH: '/nonexistent' }  // makes 'which claude' fail
});
assert.strictEqual(result.status, 0);
assert.deepStrictEqual(JSON.parse(result.stdout.trim()), []);
assert.ok(result.stderr.includes('Warning'));
```

**cosineSim direct import test:**
```js
const { cosineSim } = require('../bin/formal-scope-scan.cjs');
it('cosineSim of identical vectors is 1', () => {
  assert.strictEqual(cosineSim([1, 0, 0], [1, 0, 0]), 1);
});
it('cosineSim of orthogonal vectors is 0', () => {
  assert.strictEqual(cosineSim([1, 0], [0, 1]), 0);
});
```

**Layer 4 JSON parse failure graceful handling:**
Spawn with PATH intact but description that forces Layer 4 path (--l4 --no-l3, obscure query). If claude CLI IS available, it may return results or []. Test only that exit code is 0 and stdout is valid JSON.

```js
it('Layer 4 with --l4 flag produces valid JSON output', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--description', 'zzz-xyzzy-nomatch-query', '--l4', '--no-l3', '--format', 'json'], { encoding: 'utf8', timeout: 35000, cwd: ROOT });
  assert.strictEqual(result.status, 0, result.stderr);
  assert.doesNotThrow(() => JSON.parse(result.stdout.trim()));
});
```

Use `describe` and `it` blocks. Keep test file under 100 lines.
  </action>
  <verify>
    `node --test test/formal-scope-scan-semantic.test.cjs` — all tests pass (cosineSim unit tests, no-l3 flag test, l4-with-no-PATH graceful fallback test).
  </verify>
  <done>
    - test/formal-scope-scan-semantic.test.cjs exists and passes with node --test
    - cosineSim unit tests verify dot-product math
    - --no-l3 flag test confirms layer is skippable
    - --l4 with empty PATH test confirms graceful fallback when claude CLI unavailable
    - All tests exit 0
  </done>
</task>

</tasks>

<verification>
1. `node bin/formal-scope-scan.cjs --help | grep -E "l3|l4|semantic|agentic"` — shows new flags and layer descriptions
2. `node bin/formal-scope-scan.cjs --description "circuit breaker" --format json` — returns breaker module (layers 1+2 still work, no regression)
3. `node --test test/formal-scope-scan-semantic.test.cjs` — all tests pass
4. `node -e "const m = require('./bin/formal-scope-scan.cjs'); console.log(Object.keys(m))"` — includes runSemanticLayer, runAgenticLayer, cosineSim
</verification>

<success_criteria>
- bin/formal-scope-scan.cjs extended with runSemanticLayer and runAgenticLayer functions
- Layer 3 triggers only when layers 1+2 return 0 matches (unless --no-l3)
- Layer 4 triggers only when layers 1+2+3 return 0 matches AND --l4 is set
- Both layers output match_type field ("semantic" / "agentic")
- Missing @xenova/transformers or absent claude CLI causes silent skip with stderr warning (no crash)
- Tests pass: node --test test/formal-scope-scan-semantic.test.cjs
- Existing behavior regression-free: layers 1+2 output unchanged when they find matches
</success_criteria>

<output>
After completion, create `.planning/quick/325-add-layer-3-sentence-transformer-semanti/325-SUMMARY.md`
</output>
