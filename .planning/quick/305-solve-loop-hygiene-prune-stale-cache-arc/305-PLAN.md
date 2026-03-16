---
phase: quick-305
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/solve-tui.cjs
  - bin/build-code-trace.cjs
autonomous: true
formal_artifacts: none
requirements: []

must_haves:
  truths:
    - "D->R archived items remain archived after doc edits (key stability)"
    - "Classification cache and archive contain zero entries for items no longer in sweep output"
    - "build-code-trace.cjs itself does not appear as C->R unclassified"
    - "test/ directory files with matching scope concepts inherit tracing from their scope"
  artifacts:
    - path: "bin/solve-tui.cjs"
      provides: "pruneStaleEntries(), content-hash D->R archive keys"
      contains: "pruneStaleEntries"
    - path: "bin/build-code-trace.cjs"
      provides: "Self-trace header, test/ concept inheritance"
      contains: "Requirements:"
  key_links:
    - from: "bin/solve-tui.cjs archiveItem()"
      to: "bin/solve-tui.cjs itemKey()"
      via: "D->R items use itemKey('dtor', item) instead of line-based key"
      pattern: "itemKey\\('dtor'"
    - from: "bin/build-code-trace.cjs"
      to: ".planning/formal/spec/*/scope.json"
      via: "concept-based inheritance for test/ files"
      pattern: "test.*concept"
---

<objective>
Fix 4 solve-loop hygiene issues: (1) prune 459+ stale classification cache and 470+ stale archive entries that are dead weight from pre-code-trace-index era, (2) fix D->R archive key instability where line-based keys break after doc edits, (3) self-trace build-code-trace.cjs so it stops appearing as C->R unclassified, (4) add concept-based test/ inheritance so 33 T->R orphans get traced.

Purpose: Reduce noise in solve loop, fix key stability bug, eliminate wasted Haiku classifications on stale items.
Output: Updated bin/solve-tui.cjs and bin/build-code-trace.cjs
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/solve-tui.cjs
@bin/build-code-trace.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix D->R key stability and add stale entry pruning to solve-tui.cjs</name>
  <files>bin/solve-tui.cjs</files>
  <action>
Two changes in bin/solve-tui.cjs:

**A. Fix D->R key stability (THE BUG)**

Change `archiveItem()` (line 274-295), `unarchiveItem()` (line 297-304), and `isArchived()` (line 306-337) to use content-hash keys for dtor items instead of line-based keys.

In all three functions, replace the key computation:
```
item.type === 'dtor' ? `${item.doc_file}:${item.line}`
```
with:
```
item.type === 'dtor' ? itemKey('dtor', item)
```

This aligns archive keys with the classification cache's content-hash keys (SHA-256 truncated to 16 chars). The `itemKey()` function at line 1408 already handles dtor by hashing `item.claim_text || item.reason || item.value`.

Also update `acknowledgeItem()` (line 228-234): for the dtor case (falls into the else branch at line 227), change the `value` field from `item.file || item.claim_text || item.summary` to `itemKey('dtor', item)` so FP entries use the same content-hash key.

**Migration note**: Existing archive entries with old line-based keys (containing `:` and a number) will become orphaned. The pruneStaleEntries function (part B) will clean these up.

**B. Add pruneStaleEntries() function**

Add a new exported function `pruneStaleEntries(sweepData)` after `readClassificationCache()` (after line 1428):

1. Accept `sweepData` parameter (output of `loadSweepData()`)
2. Build a Set of all current item keys per category:
   - For each category in CATEGORIES, iterate `sweepData[cat.key].items`
   - For each item, compute `itemKey(cat.key, item)` and add to set
3. Read classification cache via `readClassificationCache()` — returns `{catKey: {itemHash: classification}}`
4. For each category in the cache, remove entries whose key is NOT in the current item key set for that category
5. Write the pruned cache back to CLASSIFY_CACHE_PATH (preserve the `{classifications: {...}, generated_at: ...}` envelope format — read the full file first to get the envelope)
6. Read archive via `readArchiveFile()` — returns `{entries: [{key, type, ...}]}`
7. For each archive entry, compute whether the key exists in the current item key set for that entry's type. Remove entries where the key is not found in current sweep output.
8. Write pruned archive back via `writeArchiveFile()`
9. Return `{cache_pruned: N, archive_pruned: M}` counts

Call `pruneStaleEntries(sweepData)` at the end of `classifyWithHaiku()` after writing the cache (around line 1356). Pass the sweepData that was already loaded. This is a fire-and-forget cleanup — wrap in try/catch so classification never fails due to pruning errors.

Also export pruneStaleEntries in the module.exports at the bottom of the file for manual use.
  </action>
  <verify>
1. `node -e "const t = require('./bin/solve-tui.cjs'); console.log(typeof t.pruneStaleEntries)"` prints "function"
2. `grep "itemKey('dtor'" bin/solve-tui.cjs | wc -l` shows at least 3 matches (archiveItem, unarchiveItem, isArchived)
3. `grep "doc_file.*:.*line" bin/solve-tui.cjs` returns NO matches for dtor key computation (old line-based pattern gone)
4. Existing tests pass: `node bin/solve-tui.test.cjs 2>&1 | tail -5` (if test file exists)
  </verify>
  <done>
D->R items use content-hash keys in archive/unarchive/isArchived (matching classification cache). pruneStaleEntries() function exists and is called after Haiku classification. No line-based dtor keys remain in key computation paths.
  </done>
</task>

<task type="auto">
  <name>Task 2: Self-trace build-code-trace.cjs and add test/ concept inheritance</name>
  <files>bin/build-code-trace.cjs</files>
  <action>
Two changes in bin/build-code-trace.cjs:

**A. Self-trace via Requirements header**

Add a `// Requirements: SOLVE-13` comment to the file header (within the first 5 lines, after the existing JSDoc block opening). The sweepCtoR header-comment fallback in nf-solve.cjs already scans for `// Requirements: REQ-ID` patterns and marks those files as traced. SOLVE-13 ("Quick mode guarantees single-cycle completion for scope-limited tasks") is the closest requirement — the code-trace index supports quick mode by reducing false positive noise.

Specifically, change the header block (lines 3-13) to include the requirements comment right after the opening `/**`:
```
/**
 * build-code-trace.cjs
 *
 * Requirements: SOLVE-13
 *
 * Builds a code trace index...
```

**B. Concept-based test/ inheritance (new Step 3b)**

After the existing Step 3 (source-module inheritance, ending around line 165), add a new step "Step 3b: Concept-based test/ inheritance" that handles files in the `test/` directory:

1. Scan the `test/` directory for `*.test.cjs` and `*.test.js` files
2. For each test file NOT already in `index.traced_files`:
   a. Extract a "concept" from the filename: strip directory prefix, strip `.test.cjs`/`.test.js` suffix, strip common prefixes like `e2e-` (e.g., `test/solve-convergence-e2e.test.cjs` -> `solve-convergence`)
   b. Check if any spec scope directory name matches the concept. The scope dirs are subdirectories of `.planning/formal/spec/`. Match logic: the concept string contains the scope dir name OR the scope dir name contains the concept string (e.g., concept `solve-convergence` matches scope dir `solve-convergence`)
   c. If a scope match is found, read that scope's `scope.json` to get its `source_files` array. For each source file in the scope, if it exists in `index.traced_files`, collect its requirement IDs. Add the test file to `index.traced_files` with all collected requirement IDs.
   d. If no scope match, try matching against `bin/*.cjs` source files: strip the test file's concept to get a base name (e.g., `solve-cycle-detector` from `test/solve-cycle-detector.test.cjs`), check if `bin/${baseName}.cjs` exists in `index.traced_files`, and inherit its requirement IDs.
3. After processing all test files, also remove matched test files from `scope_only` if they were added there.

This should resolve approximately 33 of 38 T->R orphans that are integration/e2e tests in the test/ directory.
  </action>
  <verify>
1. `node bin/build-code-trace.cjs` runs without error and prints updated counts
2. `grep "Requirements: SOLVE-13" bin/build-code-trace.cjs` returns a match
3. `node -e "const {buildIndex} = require('./bin/build-code-trace.cjs'); const idx = buildIndex(process.cwd()); const testFiles = Object.keys(idx.traced_files).filter(f => f.startsWith('test/')); console.log('test/ files traced:', testFiles.length)"` shows a number > 0 (was previously 0 for test/ directory files)
4. `node -e "const {buildIndex} = require('./bin/build-code-trace.cjs'); const idx = buildIndex(process.cwd()); console.log('build-code-trace.cjs traced:', !!idx.traced_files['bin/build-code-trace.cjs'])"` prints true
  </verify>
  <done>
build-code-trace.cjs has Requirements: SOLVE-13 header and no longer appears as C->R unclassified. test/ directory files with matching scope concepts are traced via concept-based inheritance. Running `node bin/build-code-trace.cjs` shows increased traced file count.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run pruning and rebuild index to verify hygiene improvements</name>
  <files>
.planning/formal/code-trace-index.json
.planning/formal/solve-classifications.json
.planning/formal/archived-solve-items.json
  </files>
  <action>
Execute the hygiene improvements end-to-end:

1. Rebuild the code-trace index: `node bin/build-code-trace.cjs`
2. Run a manual prune to verify stale entry removal works:
   ```
   node -e "
     const tui = require('./bin/solve-tui.cjs');
     // loadSweepData is not exported, so call pruneStaleEntries with a fresh sweep
     // Actually, pruneStaleEntries needs sweepData. Load it by requiring nf-solve directly.
     const solve = require('./bin/nf-solve.cjs');
     // Build sweepData manually matching loadSweepData's format
     const cats = ['dtoc','ctor','ttor','dtor'];
     const sweepFns = {dtoc:'sweepDtoC',ctor:'sweepCtoR',ttor:'sweepTtoR',dtor:'sweepDtoR'};
     const data = {};
     for (const c of cats) { try { data[c] = {items: solve[sweepFns[c]]()}; } catch(e) { data[c] = {items:[]}; } }
     const result = tui.pruneStaleEntries(data);
     console.log('Pruned:', JSON.stringify(result));
   "
   ```
3. Verify the pruned files have fewer entries than before by checking their sizes
4. Run `node bin/nf-solve.cjs --json 2>/dev/null | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('residuals:',JSON.stringify(j.summary?.residuals||{}))})"` to confirm residual counts dropped

If pruneStaleEntries is not accessible because loadSweepData is internal, adjust the export or use a simpler approach: export loadSweepData as well, or have the manual prune call use the exported function signature.

Commit all changes with message: "fix(solve): D->R key stability, stale cache pruning, test/ concept tracing"
  </action>
  <verify>
1. `git diff --stat HEAD~1` shows changes to bin/solve-tui.cjs and bin/build-code-trace.cjs
2. `node bin/build-code-trace.cjs` reports increased traced file count vs before
3. No test failures in related test files
  </verify>
  <done>
All 4 hygiene improvements verified end-to-end: stale entries pruned, D->R keys stable, build-code-trace.cjs self-traced, test/ files inherit tracing. Changes committed.
  </done>
</task>

</tasks>

<verification>
1. D->R key stability: archive/unarchive/isArchived all use itemKey('dtor', item) content hashes
2. Stale pruning: pruneStaleEntries() removes cache/archive entries not in current sweep output
3. Self-trace: build-code-trace.cjs has Requirements header and appears in code-trace-index.json
4. Test inheritance: test/ files matched to scope concepts appear in traced_files
5. No regressions: existing solve-tui tests pass
</verification>

<success_criteria>
- Zero line-based dtor keys in archive key computation (grep confirms)
- pruneStaleEntries function exists and is callable
- build-code-trace.cjs appears in its own output index
- test/ directory traced file count > 0 (was 0 before)
- All changes committed
</success_criteria>

<output>
After completion, create `.planning/quick/305-solve-loop-hygiene-prune-stale-cache-arc/305-SUMMARY.md`
</output>
