---
phase: quick-143
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - bin/qgsd-solve.test.cjs
  - .formal/alloy/solve-consistency.als
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-143]

must_haves:
  truths:
    - "Solver sweeps 7 layer transitions including R->D and D->C"
    - "R->D sweep detects requirements not mentioned in docs (by ID or keyword match)"
    - "D->C sweep detects stale structural claims in docs (dead file paths, missing CLI commands, absent dependencies)"
    - "False positives are filtered: template vars, Example headings, home paths, fenced code blocks, code expressions"
    - "All existing tests continue to pass with updated mock objects"
    - "12 new tests validate extractKeywords, extractStructuralClaims, sweepRtoD, sweepDtoC, formatReport, formatJSON"
    - "Alloy model declares 7 transitions and checks pass"
    - "solve.md orchestrator displays and remediates R->D and D->C gaps"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "discoverDocFiles, extractKeywords, extractStructuralClaims, sweepRtoD, sweepDtoC functions"
      exports: ["discoverDocFiles", "extractKeywords", "extractStructuralClaims", "sweepRtoD", "sweepDtoC"]
    - path: "bin/qgsd-solve.test.cjs"
      provides: "Updated mocks + 12 new test cases"
      contains: "TC-KEYWORD-1"
    - path: ".formal/alloy/solve-consistency.als"
      provides: "7-transition Alloy model"
      contains: "RtoD, DtoC"
    - path: "commands/qgsd/solve.md"
      provides: "Orchestrator skill with R->D and D->C display/remediation"
      contains: "r_to_d"
  key_links:
    - from: "bin/qgsd-solve.cjs"
      to: ".formal/requirements.json"
      via: "sweepRtoD reads requirements"
      pattern: "requirements\\.json"
    - from: "bin/qgsd-solve.cjs"
      to: "discoverDocFiles()"
      via: "Both sweeps use doc discovery"
      pattern: "discoverDocFiles"
    - from: "bin/qgsd-solve.cjs"
      to: "computeResidual()"
      via: "New sweeps integrated into residual total"
      pattern: "r_to_d.*d_to_c"
    - from: "bin/qgsd-solve.test.cjs"
      to: "bin/qgsd-solve.cjs"
      via: "Imports new exports for unit testing"
      pattern: "extractKeywords.*extractStructuralClaims"
---

<objective>
Add R-to-D (Requirements -> Docs) and D-to-C (Docs -> Code) layer transitions to the qgsd-solve consistency solver, expanding it from 5 to 7 sweeps.

Purpose: The solver currently has zero visibility into documentation. READMEs can reference deleted files, omit shipped features, or list nonexistent CLI commands and the solver reports all-green. These two sweeps close the documentation blind spot.

Output: Updated solver engine with 7 sweeps, comprehensive test suite, updated Alloy formal model, and updated orchestrator skill.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/qgsd-solve.cjs
@bin/qgsd-solve.test.cjs
@.formal/alloy/solve-consistency.als
@commands/qgsd/solve.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add R-to-D and D-to-C sweep functions to the solver engine + update Alloy model</name>
  <files>bin/qgsd-solve.cjs, .formal/alloy/solve-consistency.als</files>
  <action>
In `bin/qgsd-solve.cjs`, implement the following changes. Reference the approved design at `/Users/jonathanborduas/.claude/plans/cozy-baking-bentley.md` for full specification.

**1. Add `discoverDocFiles()` helper** (after `spawnTool()` at ~line 84):
- Read `.planning/config.json` for `docs_paths` array (e.g., `["README.md", "docs/**/*.md"]`)
- Fall back to `["README.md", "docs/**/*.md"]` if absent
- Implement simple recursive `walkDir(dir)` that returns files matching patterns
- Implement `matchWildcard(pattern, filePath)` for `**/*.md` style globs — keep it simple (no npm dep)
- Return deduplicated absolute paths of discovered doc files
- Skip gracefully (return `[]`) if no docs exist

**2. Add `extractKeywords(text)` helper:**
- Split text on whitespace and punctuation
- Filter: remove tokens < 4 chars
- Filter: remove common stopwords (the, this, that, with, from, into, each, when, must, should, will, have, been, does, also, used, using, only, such, both, than, some, more, most, very, other, about, which, their, would, could, there, where, these, those, after, before, being, through, during, between, without, within, against, under, above, below, during)
- Filter: remove backtick-wrapped fragments (code tokens like `spawnSync`)
- Return unique lowercase tokens

**3. Add `sweepRtoD()` function** (after `sweepFtoC()`):
- Load `.formal/requirements.json` — if absent, return `{ residual: 0, detail: { skipped: true, reason: 'requirements.json not found' } }`
- Call `discoverDocFiles()` — if empty, return `{ residual: 0, detail: { skipped: true, reason: 'no doc files found' } }`
- Concatenate all doc file contents into a single string
- For each requirement entry, check two matching strategies:
  - **Primary**: literal ID match (e.g., "ACT-01" appears in concatenated docs) — case-sensitive
  - **Secondary**: extract keywords from requirement `text` field, require 3+ keyword matches in docs
- Count undocumented requirements (neither primary nor secondary match)
- Return `{ residual: N, detail: { undocumented_requirements: [...ids], total_requirements: N, documented: N, doc_files_scanned: N } }`

**4. Add `extractStructuralClaims(docContent, filePath)` helper:**
- Parse line-by-line
- Track fenced code blocks (lines starting with triple-backtick) — skip contents entirely (they're examples)
- Track current heading — if heading contains "Example" or "Template", skip claims in that section until next heading
- For each non-skipped line, find backtick-wrapped values and classify:
  - `file_path`: contains `/` with extension, or starts with `.` — BUT filter out:
    - Template variables containing `{` or `}`
    - Home directory paths starting with `~/`
    - Code expressions with operators (`+`, `=`, `&&`, `||`, `=>`)
    - Tokens < 4 chars
  - `cli_command`: starts with `node `, `npx `, `npm ` — verify the script/command portion exists
  - `dependency`: npm-style package name (lowercase, may have `@scope/`) — verify in `package.json` dependencies/devDependencies
- Return array of `{ line: N, type: 'file_path'|'cli_command'|'dependency', value: '...', doc_file: '...' }`

**5. Add `sweepDtoC()` function** (after `sweepRtoD()`):
- Call `discoverDocFiles()` — if empty, return `{ residual: 0, detail: { skipped: true, reason: 'no doc files found' } }`
- For each doc file, call `extractStructuralClaims(content, filePath)`
- For each claim, verify:
  - `file_path`: `fs.existsSync(path.join(ROOT, value))` — filter out paths starting with `/` (absolute non-project paths)
  - `cli_command`: extract script path (e.g., `node bin/foo.cjs` → check `bin/foo.cjs` exists)
  - `dependency`: check `package.json` `dependencies` or `devDependencies` keys
- Collect broken claims (verification failed)
- Return `{ residual: N, detail: { broken_claims: [...], total_claims_checked: N, doc_files_scanned: N } }`

**6. Update `computeResidual()`:**
- Add `const r_to_d = sweepRtoD();` and `const d_to_c = sweepDtoC();`
- Add both to the total sum (same pattern: `>= 0 ? val : 0`)
- Add `r_to_d` and `d_to_c` to the returned object

**7. Update `autoClose()`:**
- Add after F->C block:
  ```
  if (residual.r_to_d.residual > 0) {
    actions.push(residual.r_to_d.residual + ' requirement(s) undocumented in developer docs — manual review required');
  }
  if (residual.d_to_c.residual > 0) {
    actions.push(residual.d_to_c.residual + ' stale structural claim(s) in docs — manual review required');
  }
  ```

**8. Update `formatReport()`:**
- Add two rows to the `rows` array:
  `{ label: 'R -> D (Req->Docs)', residual: finalResidual.r_to_d.residual }`
  `{ label: 'D -> C (Docs->Code)', residual: finalResidual.d_to_c.residual }`
- Add detail sections for non-zero r_to_d and d_to_c (similar pattern to existing sections):
  - R->D: list undocumented requirement IDs
  - D->C: list broken claims with doc_file, line, type, value

**9. Update `formatJSON()`:**
- Add `'r_to_d'` and `'d_to_c'` to the health keys loop array
- Bump `solver_version` from `'1.0'` to `'1.1'`

**10. Update exports:**
- Add `discoverDocFiles`, `extractKeywords`, `extractStructuralClaims`, `sweepRtoD`, `sweepDtoC` to `module.exports`

**11. Update file header comment:**
- Add `R->D` and `D->C` to the layer transitions list
- Update "5 layer transitions" references to "7 layer transitions"

**In `.formal/alloy/solve-consistency.als`:**

- Add `RtoD, DtoC` to LayerTransition singletons: `one sig RtoF, FtoT, CtoF, TtoC, FtoC, RtoD, DtoC extends LayerTransition {}`
- Update `AllLayersSwept` fact: `#LayerTransition = 7` and add `RtoD + DtoC` to the union
- Update comment: "all 7 layer transitions"
- Update `SweepCoversAllLayers` assertion: `#LayerTransition = 7`
- Update both `check` scopes: `for 7`
  </action>
  <verify>
Run `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(Object.keys(s))"` from the repo root — must include `discoverDocFiles`, `extractKeywords`, `extractStructuralClaims`, `sweepRtoD`, `sweepDtoC` among the exports.

Run `node bin/qgsd-solve.cjs --json --report-only 2>/dev/null | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('keys:',Object.keys(j.residual_vector).sort().join(','));console.log('version:',j.solver_version)})"` — must show `r_to_d` and `d_to_c` in residual_vector keys and version `1.1`.

Verify Alloy model syntax: `grep -c 'RtoD' .formal/alloy/solve-consistency.als` should return >= 3 (sig, fact, assertion context).
  </verify>
  <done>
The solver engine sweeps 7 layer transitions. `computeResidual()` returns `r_to_d` and `d_to_c` fields. `formatReport()` displays 7 rows. `formatJSON()` includes 7 health keys at solver_version 1.1. `autoClose()` logs manual-review entries for both new transitions. Alloy model declares 7 LayerTransition singletons with updated facts and assertions.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update test suite + orchestrator skill for R-to-D and D-to-C transitions</name>
  <files>bin/qgsd-solve.test.cjs, commands/qgsd/solve.md</files>
  <action>
**In `bin/qgsd-solve.test.cjs`:**

**1. Update import statement** — add `discoverDocFiles`, `extractKeywords`, `extractStructuralClaims`, `sweepRtoD`, `sweepDtoC` to the destructured require.

**2. Update ALL 8 existing mock residual objects** in tests TC-FORMAT-1, TC-FORMAT-2, TC-FORMAT-3, TC-JSON-1, TC-JSON-2, TC-JSON-3 (6 tests, some share mock shape). Every residual object must now include:
```js
r_to_d: { residual: 0, detail: {} },
d_to_c: { residual: 0, detail: {} },
```
Totals stay the same (new fields are 0). This prevents test failures from missing keys.

**3. Add TC-FORMAT-4**: formatReport includes R->D and D->C labels
```js
test('TC-FORMAT-4: formatReport includes R -> D and D -> C labels', () => {
  // Build a residual with all 7 keys at 0
  // Call formatReport, assert result includes 'R -> D' and 'D -> C'
});
```

**4. Add TC-JSON-4**: formatJSON includes r_to_d and d_to_c health keys
```js
test('TC-JSON-4: formatJSON includes r_to_d and d_to_c health keys', () => {
  // Build a residual with all 7 keys at 0
  // Call formatJSON, assert result.health has r_to_d and d_to_c keys
  // Assert solver_version is '1.1'
});
```

**5. Add TC-KEYWORD-1**: extractKeywords strips stopwords and short tokens
```js
test('TC-KEYWORD-1: extractKeywords strips stopwords and short tokens', () => {
  const result = extractKeywords('the quick brown fox jumps over this lazy dog');
  assert.ok(!result.includes('the'));  // stopword
  assert.ok(!result.includes('fox'));  // < 4 chars
  assert.ok(result.includes('quick'));
  assert.ok(result.includes('brown'));
  assert.ok(result.includes('jumps'));
  assert.ok(result.includes('lazy'));
});
```

**6. Add TC-KEYWORD-2**: extractKeywords ignores backtick-wrapped fragments
```js
test('TC-KEYWORD-2: extractKeywords ignores backtick-wrapped fragments', () => {
  const result = extractKeywords('uses `spawnSync` for spawning child processes');
  assert.ok(!result.includes('spawnsync'));
  assert.ok(result.includes('spawning'));
  assert.ok(result.includes('child'));
  assert.ok(result.includes('processes'));
});
```

**7. Add TC-CLAIMS-1**: extractStructuralClaims finds file paths in backticks
```js
test('TC-CLAIMS-1: extractStructuralClaims finds file paths in backticks', () => {
  const doc = 'See `bin/qgsd-solve.cjs` for details.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(claims.some(c => c.type === 'file_path' && c.value === 'bin/qgsd-solve.cjs'));
});
```

**8. Add TC-CLAIMS-2**: extractStructuralClaims skips fenced code blocks
```js
test('TC-CLAIMS-2: extractStructuralClaims skips fenced code blocks', () => {
  const doc = 'text\n```\n`bin/fake-file.cjs`\n```\nmore text';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value === 'bin/fake-file.cjs'));
});
```

**9. Add TC-CLAIMS-3**: extractStructuralClaims skips template variables
```js
test('TC-CLAIMS-3: extractStructuralClaims skips template variables', () => {
  const doc = 'Path: `.planning/phases/{phase}/{plan}-PLAN.md`';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value.includes('{phase}')));
});
```

**10. Add TC-CLAIMS-4**: extractStructuralClaims skips paths under Example headings
```js
test('TC-CLAIMS-4: extractStructuralClaims skips paths under Example headings', () => {
  const doc = '## Example Usage\n\nSee `bin/imaginary.cjs` for reference.\n\n## Real Section\n\nSee `bin/qgsd-solve.cjs` here.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value === 'bin/imaginary.cjs'));
  // Real section claims should still be collected
  assert.ok(claims.some(c => c.value === 'bin/qgsd-solve.cjs'));
});
```

**11. Add TC-CLAIMS-5**: extractStructuralClaims identifies CLI commands
```js
test('TC-CLAIMS-5: extractStructuralClaims identifies CLI commands', () => {
  const doc = 'Run `node bin/qgsd-solve.cjs --report-only` to check.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(claims.some(c => c.type === 'cli_command'));
});
```

**12. Add TC-CLAIMS-6**: extractStructuralClaims skips home directory paths
```js
test('TC-CLAIMS-6: extractStructuralClaims skips home directory paths', () => {
  const doc = 'Installed at `~/.claude/hooks/` by default.';
  const claims = extractStructuralClaims(doc, 'test.md');
  assert.ok(!claims.some(c => c.value.includes('~/')));
});
```

**13. Add TC-SWEEP-RD-1**: sweepRtoD returns valid structure
```js
test('TC-SWEEP-RD-1: sweepRtoD returns valid structure', () => {
  const result = sweepRtoD();
  assert.ok(typeof result === 'object');
  assert.ok(typeof result.residual === 'number');
  assert.ok(typeof result.detail === 'object');
  // If skipped, should still be residual: 0
  if (result.detail.skipped) {
    assert.equal(result.residual, 0);
  }
});
```

**14. Add TC-SWEEP-DC-1**: sweepDtoC returns valid structure
```js
test('TC-SWEEP-DC-1: sweepDtoC returns valid structure', () => {
  const result = sweepDtoC();
  assert.ok(typeof result === 'object');
  assert.ok(typeof result.residual === 'number');
  assert.ok(typeof result.detail === 'object');
  if (result.detail.skipped) {
    assert.equal(result.residual, 0);
  }
});
```

**In `commands/qgsd/solve.md`:**

**1. Update objective:** Change "Sweeps 5 layer transitions" to "Sweeps 7 layer transitions (R->F, F->T, C->F, T->C, F->C, R->D, D->C)"

**2. Update Step 1** parsed fields list — add:
- `residual_vector.r_to_d.residual` — count of requirements not documented in developer docs
- `residual_vector.d_to_c.residual` — count of stale structural claims in docs

Add two rows to the display table:
```
R -> D (Req->Docs)          N      [status]
D -> C (Docs->Code)         N      [status]
```

**3. Add Step 3f** (after 3e, before Step 4) — R->D remediation:
- Manual review only (like C->F)
- Display undocumented requirement IDs from `residual_vector.r_to_d.detail.undocumented_requirements`
- Log: `"R->D: {N} requirement(s) undocumented in developer docs — manual review required"`

**4. Add Step 3g** — D->C remediation:
- Manual review only
- Display broken claims table: doc_file, line, type, value, reason
- Log: `"D->C: {N} stale structural claim(s) in docs — manual review required"`

**5. Update Step 6** before/after table — add two `[MANUAL]` rows:
```
R -> D (Req->Docs)         {N}    {M}    {delta}   [MANUAL]
D -> C (Docs->Code)        {N}    {M}    {delta}   [MANUAL]
```

Add note at bottom:
```
Note: R->D and D->C gaps require manual review. R->D gaps mean shipped requirements are undiscoverable in docs. D->C gaps mean docs reference files, commands, or dependencies that no longer exist.
```
  </action>
  <verify>
Run `node --test bin/qgsd-solve.test.cjs 2>&1` from repo root — ALL tests must pass (existing updated mocks + 12 new tests). Expect 0 failures.

Run `grep -c 'r_to_d\|d_to_c\|R -> D\|D -> C' commands/qgsd/solve.md` — should return >= 8 (multiple references in objective, step 1, step 3f, step 3g, step 6).

Run `node bin/qgsd-solve.cjs --report-only 2>/dev/null | grep -c 'R -> D\|D -> C'` — should return 2 (both rows in the table).
  </verify>
  <done>
All existing tests pass with updated mock objects containing `r_to_d` and `d_to_c` at residual 0. Twelve new tests pass: TC-FORMAT-4, TC-JSON-4, TC-KEYWORD-1, TC-KEYWORD-2, TC-CLAIMS-1 through TC-CLAIMS-6, TC-SWEEP-RD-1, TC-SWEEP-DC-1. The solve.md orchestrator skill references 7 transitions, includes r_to_d and d_to_c in diagnostic display, and has manual-review remediation steps 3f and 3g.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/qgsd-solve.test.cjs` — all tests pass (existing + 12 new)
2. `node bin/qgsd-solve.cjs --json --report-only` — JSON includes `r_to_d`, `d_to_c` in residual_vector, solver_version is `1.1`
3. `node bin/qgsd-solve.cjs --report-only` — human report shows 7-row table with R->D and D->C
4. `grep 'RtoD' .formal/alloy/solve-consistency.als` — Alloy model declares RtoD and DtoC singletons
5. `grep -c 'r_to_d' commands/qgsd/solve.md` — orchestrator skill references new transitions
</verification>

<success_criteria>
- Solver engine sweeps 7 layer transitions, up from 5
- R->D sweep correctly identifies requirements missing from docs using ID + keyword matching
- D->C sweep correctly identifies stale file paths, CLI commands, and dependencies in docs
- False positive filtering works: template vars, Example headings, home paths, fenced code blocks, code expressions
- All 20+ existing tests pass with updated mocks
- 12 new tests validate the new functionality
- Alloy formal model reflects 7 transitions with passing assertions
- Orchestrator skill displays and offers remediation for both new transition types
</success_criteria>

<output>
After completion, create `.planning/quick/143-add-r-to-d-and-d-to-c-layer-transitions-/143-SUMMARY.md`
</output>
