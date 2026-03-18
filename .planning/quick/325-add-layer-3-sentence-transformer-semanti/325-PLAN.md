---
phase: quick-325
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - bin/formal-scope-scan.cjs
  - test/formal-scope-scan-semantic.test.cjs
  - .planning/quick/325-add-layer-3-sentence-transformer-semanti/325-SUMMARY.md
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "Layer 3 runs only when layers 1+2 return zero matches, computing cosine similarity against concatenated scope concepts"
    - "Layer 4 runs only when layers 1+2+3 return zero matches, invoking claude CLI via execFileSync"
    - "Layer 4 is disabled by default; --l4 flag opts in"
    - "Both layers integrate cleanly with --format lines and --format json output modes"
    - "Layer 3 and 4 matches include matched_by field set to 'semantic' and 'agentic' respectively"
    - "Graceful fallback: if @huggingface/transformers unavailable or claude CLI absent/timeout, layers skip silently with stderr warning"
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
- Layer 3: sentence transformer semantic similarity using @huggingface/transformers (Xenova/all-MiniLM-L6-v2) with cosine similarity threshold 0.35, tunable via --l3-threshold
- Layer 4: Claude Code sub-agent search via execFileSync(resolveClaudeCLI(), [...]) that scans .planning/formal/spec/*/ directories, opt-in via --l4 flag

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
  <name>Task 0: Add @huggingface/transformers to optionalDependencies in package.json</name>
  <files>package.json</files>
  <action>
Add an `optionalDependencies` field to package.json with `"@huggingface/transformers": "^3.0.0"`. This is optional because Layer 3 gracefully skips if the package is missing. The field should be placed after `devDependencies` and before `overrides`.

Edit package.json to add:
```json
"optionalDependencies": {
  "@huggingface/transformers": "^3.0.0"
},
```

Also update the `test:ci` script in package.json to include the new test file. Find the `"test:ci"` line — it currently ends with `bin/convergence-report.test.cjs bin/escalation-classifier.test.cjs"` — and append `test/formal-scope-scan-semantic.test.cjs` before the closing quote, so the end becomes `bin/convergence-report.test.cjs bin/escalation-classifier.test.cjs test/formal-scope-scan-semantic.test.cjs"`.

Run: npm install
This regenerates package-lock.json to include the new optional dependency.
  </action>
  <verify>
    1. `node -e "const p = require('./package.json'); console.log(p.optionalDependencies['@huggingface/transformers'])"` — outputs `^3.0.0`.
    2. `node -e "const p = require('./package.json'); console.log(p.scripts['test:ci'])"` — output includes `test/formal-scope-scan-semantic.test.cjs`.
    3. `node --input-type=commonjs << 'EOF'\nconst lock=require('./package-lock.json'); if(!lock.packages['node_modules/@huggingface/transformers']) throw new Error('not in lockfile'); console.log('lockfile ok');\nEOF`
  </verify>
  <done>
    - package.json has `optionalDependencies["@huggingface/transformers"] = "^3.0.0"`
    - package.json `test:ci` script includes `test/formal-scope-scan-semantic.test.cjs`
    - package-lock.json includes @huggingface/transformers entry
  </done>
</task>

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
  // Returns: array of { module, path, matched_by: 'semantic', similarity_score }
}
```

Implementation steps:
1. Attempt `const { pipeline } = await import('@huggingface/transformers')` inside a try/catch. If it throws (not installed or ESM load failure), write a warning to stderr ("Warning: @huggingface/transformers not available, skipping Layer 3") and return [].
2. Create embedder: `const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')`.
4. Compute query embedding: `const queryOutput = await embedder([query], { pooling: 'mean', normalize: true }); const dim = queryOutput.dims[1]; const queryVec = Array.from(queryOutput.data.slice(0, dim));`
5. For each module: concatenate its concepts array into a single string (join with ' '). Compute embedding: `const modOutput = await embedder([conceptText], { pooling: 'mean', normalize: true }); const modVec = Array.from(modOutput.data.slice(0, dim));` Compute cosine similarity: `cosineSim(queryVec, modVec)` (vectors are already L2-normalized via `normalize: true`).
6. If similarity >= threshold, add `{ module: mod.name, path: '.planning/formal/spec/' + mod.name + '/invariants.md', matched_by: 'semantic', similarity_score: Math.round(sim * 1000) / 1000 }` to results.
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

**Layer 4 — runAgenticLayer(query, specDir, claudeBin)**:

```js
function runAgenticLayer(query, specDir, claudeBin = resolveClaudeCLI()) {
  // Returns: array of { module, path, matched_by: 'agentic' }
  // claudeBin: optional override for test injection (defaults to resolved claude binary)
}
```

Inline helper — copy verbatim from bin/check-mcp-health.cjs lines 28-39:
```js
function resolveClaudeCLI() {
  const versionsDir = path.join(os.homedir(), '.local', 'share', 'claude', 'versions');
  if (!fs.existsSync(versionsDir)) return 'claude';
  const versions = fs.readdirSync(versionsDir)
    .filter(f => /^\d+\.\d+\.\d+$/.test(f) && fs.statSync(path.join(versionsDir, f)).isFile())
    .sort((a, b) => {
      const ap = a.split('.').map(Number), bp = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) { if (ap[i] !== bp[i]) return bp[i] - ap[i]; }
      return 0;
    });
  return versions.length > 0 ? path.join(versionsDir, versions[0]) : 'claude';
}
```
Define this function at module scope (alongside `runAgenticLayer`) so it can be exported.

Implementation steps:
1. Enumerate available modules from specDir — wrap `fs.readdirSync` in its own try/catch so a nonexistent or unreadable specDir returns [] without throwing:
```js
let availableModules;
try {
  availableModules = fs.readdirSync(specDir).filter(f => fs.statSync(path.join(specDir, f)).isDirectory());
} catch (_) {
  process.stderr.write('Warning: Layer 4 specDir not readable, skipping\n');
  return [];
}
```
2. Build prompt string injecting the available module list:
```js
const prompt = 'You are searching for formal specification modules that match a query.\n' +
  'Available modules: ' + availableModules.join(', ') + '\n\n' +
  'Query: ' + query + '\n\n' +
  'Return ONLY a JSON array of module names from the list above that are relevant, e.g. ["breaker", "quorum"].\n' +
  'If none match, return [].';
```
3. Build the spawn environment: `const env = { ...process.env }; delete env.CLAUDECODE;` to prevent nested-session blocking.
4. The Claude binary is provided by the `claudeBin` parameter (defaults to `resolveClaudeCLI()` — do NOT re-call resolveClaudeCLI inside the function body).
5. Run using `execFileSync` (throws on non-zero exit or timeout — wrap in try/catch):
```js
let stdout;
try {
  stdout = execFileSync(claudeBin, ['-p', prompt, '--output-format', 'json'], {
    encoding: 'utf8', timeout: 30000, cwd: ROOT, env, stdio: 'pipe'
  });
} catch (e) {
  process.stderr.write('Warning: Layer 4 claude CLI timed out or failed, skipping\n');
  return [];
}
```
If `execFileSync` throws because the binary is not found (ENOENT), the catch block also handles it — write stderr warning ("Warning: claude CLI not available, skipping Layer 4") and return [].
6. Parse stdout with a tolerant extractor — the claude CLI may return free-form text rather than a clean JSON array inside `parsed.result`:
```js
// Step 5: Parse result — tolerant extraction
let names = [];
try {
  const outer = JSON.parse(stdout);
  const text = typeof outer.result === 'string' ? outer.result : stdout;
  // Try direct parse first
  try {
    names = JSON.parse(text);
  } catch (_) {
    // Fall back: extract first JSON array from text
    const m = text.match(/\[[\s\S]*?\]/);
    if (m) names = JSON.parse(m[0]);
  }
  if (!Array.isArray(names)) names = [];
} catch (_) {
  process.stderr.write('Warning: Layer 4 could not parse claude CLI output, skipping\n');
  return [];
}
```
7. Filter parsed names to only include modules that actually exist in `availableModules` (hallucination guard — second safety net).
8. Map valid names to `{ module: name, path: '.planning/formal/spec/' + name + '/invariants.md', matched_by: 'agentic' }`.
9. Return results.

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

**Help text additions** — append to the Matching algorithm section of `printHelp()`, after the existing Layer 2 description block:
```
  --l3-threshold N       Cosine similarity threshold for Layer 3 (default: 0.35)
  --no-l3                Disable Layer 3 semantic fallback
  --l4                   Enable Layer 4 agentic fallback (disabled by default; slow/expensive)
Layer 3 (semantic — @huggingface/transformers, runs when layers 1+2 return 0 matches):
  Computes cosine similarity between query and module concept text.
  Modules above threshold returned with matched_by: "semantic".
Layer 4 (agentic — claude CLI sub-agent, runs when layers 1+2+3 return 0 matches):
  Spawns claude CLI to search spec directories. Requires --l4 flag to enable.
  Returns matched_by: "agentic". Skips silently if claude CLI unavailable.
```

**Exports** — extend module.exports at the bottom of bin/formal-scope-scan.cjs to add the four new symbols while preserving ALL existing exported symbols. Read the current module.exports at the bottom of bin/formal-scope-scan.cjs and keep every existing key. Add: runSemanticLayer, runAgenticLayer, cosineSim, resolveClaudeCLI.

**IMPORTANT:** Use `await import('@huggingface/transformers')` (dynamic ESM import) inside the async `runSemanticLayer` function — this is the correct pattern since `@huggingface/transformers` is ESM-only. Even in a CJS file, dynamic `import()` works inside async functions. The try/catch around the `await import()` is the graceful fallback mechanism (catches both "not installed" and ESM load errors).
  </action>
  <verify>
    1. `node bin/formal-scope-scan.cjs --description "circuit breaker timeout oscillation" --format lines` — runs without error (layers 1+2 likely match "breaker" module; Layer 3 not triggered).
    2. `node bin/formal-scope-scan.cjs --description "zzz-totally-obscure-query-xyzzy-no-match" --no-l3 --format json` — returns `[]` without crashing (no match, Layer 3 disabled, Layer 4 disabled by default).
    3. `node bin/formal-scope-scan.cjs --help | grep "l3-threshold"` — shows the new flag.
    4. `node -e "const m = require('./bin/formal-scope-scan.cjs'); console.log(typeof m.runAgenticLayer, typeof m.cosineSim, typeof m.resolveClaudeCLI)"` — outputs `function function function`.
    5. Verify both old and new exports are present:
```bash
node --input-type=commonjs << 'EOF'
const m=require('./bin/formal-scope-scan.cjs');
['parseArgs','runBugModeMatching','runModelCheckers','runSemanticLayer','runAgenticLayer','cosineSim','resolveClaudeCLI'].forEach(k=>{if(typeof m[k]==='undefined')throw new Error(k+' missing from exports')});
console.log('all exports present');
EOF
```
  </verify>
  <done>
    - Layer 3 and Layer 4 functions are implemented and exported
    - main() is async and integrates both layers with correct fallback conditions
    - --l3-threshold, --no-l3, --l4 flags are parsed and functional
    - Graceful fallback: missing @huggingface/transformers or absent claude CLI writes warning to stderr and returns []
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
Since @huggingface/transformers likely IS installed in the project (if it's in package.json) or IS NOT, test the graceful fallback path by mocking the require. The cleanest approach for CJS: temporarily override require.cache to simulate missing module.

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
Test fallback paths by importing `runAgenticLayer` directly and passing invalid arguments (no real claude call). `runAgenticLayer` is synchronous — do not mark calls as async.

```js
it('runAgenticLayer returns [] when claude binary is missing', () => {
  const { runAgenticLayer } = require('../bin/formal-scope-scan.cjs');
  const result = runAgenticLayer('circuit breaker', SPEC_DIR, '/nonexistent/claude-bin-xyz');
  assert.deepStrictEqual(result, []);
});
it('runAgenticLayer returns [] when specDir does not exist', () => {
  const { runAgenticLayer } = require('../bin/formal-scope-scan.cjs');
  const result = runAgenticLayer('circuit breaker', '/tmp/nonexistent-spec-dir-99999');
  assert.deepStrictEqual(result, []);
});
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

**Layer 4 availability fallback test (no real API call):**
Test Layer 4 graceful fallback when claude binary is missing — use the `claudeBin` injection parameter introduced in Task 1. Do NOT use PATH tricks (resolveClaudeCLI resolves an absolute path, making PATH irrelevant). Do NOT spawn a real claude CLI call (non-deterministic, slow, may timeout CI).

```js
it('Layer 4 falls back gracefully when claude binary is missing (injection)', () => {
  const { runAgenticLayer } = require('../bin/formal-scope-scan.cjs');
  const result = runAgenticLayer('zzz-xyzzy-nomatch-query', SPEC_DIR, '/nonexistent/claude-bin-xyz');
  assert.deepStrictEqual(result, []);
});
```

Use `describe` and `it` blocks. Keep test file under 150 lines.

**Layer 3 success-path test (integration — skipped if package absent):**

This test is slow (downloads/loads the model). Guard it so CI without the package simply skips rather than fails or times out.

```js
it('runSemanticLayer returns semantic match above threshold (integration — skipped if package absent)', async () => {
  try { await import('@huggingface/transformers'); } catch { return; /* skip */ }
  const { runSemanticLayer } = require('../bin/formal-scope-scan.cjs');
  const result = await runSemanticLayer('circuit breaker', [{ name: 'breaker', concepts: ['circuit breaker timeout'] }], 0.1);
  assert.ok(result.length > 0, 'expected at least one semantic match');
  assert.strictEqual(result[0].matched_by, 'semantic');
});
```

The threshold 0.1 is intentionally very low to guarantee a match regardless of exact model output. The `try { await import(...) } catch { return; }` guard skips when the optional dep is absent. The test calls `runSemanticLayer` directly — it works correctly because the implementation extracts plain JS arrays via `Array.from(output.data.slice(0, dim))` before passing to `cosineSim`.

**Regression test — Layer 1/2 still works after async conversion:**

```js
it('layers 1+2 still return exact/proximity match after async main() change', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--description', 'circuit breaker', '--format', 'json'], {
    encoding: 'utf8', timeout: 15000, cwd: ROOT
  });
  assert.strictEqual(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout.trim());
  assert.ok(output.length > 0, 'expected at least one match');
  assert.ok(output.some(m => m.matched_by !== undefined), 'expected at least one item with a matched_by field');
  const VALID_L1_L2 = ['source_file', 'concept', 'module_name', 'proximity_graph'];
  assert.ok(
    output.some(m => VALID_L1_L2.includes(m.matched_by)),
    'expected at least one Layer 1/2 result with valid matched_by'
  );
});
```
  </action>
  <verify>
    `node --test test/formal-scope-scan-semantic.test.cjs` — all tests pass (cosineSim unit tests, no-l3 flag test, runAgenticLayer binary-injection fallback tests, Layer 3 success-path test if transformers installed, regression test for layers 1+2).
  </verify>
  <done>
    - test/formal-scope-scan-semantic.test.cjs exists and passes with node --test
    - cosineSim unit tests verify dot-product math
    - --no-l3 flag test confirms layer is skippable
    - runAgenticLayer direct call with missing binary (claudeBin injection) confirms graceful fallback
    - runAgenticLayer direct call with nonexistent specDir confirms readdirSync error catch
    - Layer 3 success-path test validates semantic match at threshold 0.1 (skipped if transformers absent)
    - Regression test confirms layers 1+2 still return exact/proximity matches after async main() conversion
    - All tests exit 0
  </done>
</task>

</tasks>

<verification>
1. `node bin/formal-scope-scan.cjs --help | grep -E "l3|l4|semantic|agentic"` — shows new flags and layer descriptions
2. `node bin/formal-scope-scan.cjs --description "circuit breaker" --format json` — returns breaker module (layers 1+2 still work, no regression)
3. `node --test test/formal-scope-scan-semantic.test.cjs` — all tests pass
4. `node -e "const m = require('./bin/formal-scope-scan.cjs'); console.log(Object.keys(m))"` — includes runSemanticLayer, runAgenticLayer, cosineSim, resolveClaudeCLI
</verification>

<success_criteria>
- bin/formal-scope-scan.cjs extended with runSemanticLayer and runAgenticLayer functions
- Layer 3 triggers only when layers 1+2 return 0 matches (unless --no-l3)
- Layer 4 triggers only when layers 1+2+3 return 0 matches AND --l4 is set
- Both layers output matched_by field ("semantic" / "agentic")
- Missing @huggingface/transformers or absent claude CLI causes silent skip with stderr warning (no crash)
- Tests pass: node --test test/formal-scope-scan-semantic.test.cjs
- Existing behavior regression-free: layers 1+2 output unchanged when they find matches
</success_criteria>

<output>
After completion, create `.planning/quick/325-add-layer-3-sentence-transformer-semanti/325-SUMMARY.md`
</output>
