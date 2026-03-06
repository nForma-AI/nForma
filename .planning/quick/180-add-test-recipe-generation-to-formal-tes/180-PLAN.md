---
phase: quick-180
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/formal-test-sync.cjs
  - commands/qgsd/solve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-180]

must_haves:
  truths:
    - "generateStubs() writes a .stub.recipe.json sidecar for every gap alongside the .stub.test.js"
    - "Each recipe contains requirement_text, formal_property.definition, source_files, import_hint, test_strategy"
    - "solve.md F->T Phase 2 template uses batch size 5 (not 15) and instructs executors to read recipe JSON"
    - "Recipes with missing source_files or definition do not block stub generation (fail-open)"
  artifacts:
    - path: "bin/formal-test-sync.cjs"
      provides: "Recipe generation in generateStubs() + helper functions"
      contains: "stub.recipe.json"
    - path: "commands/qgsd/solve.md"
      provides: "Updated F->T Phase 2 template with recipe-based action and batch size 5"
      contains: "stub.recipe.json"
  key_links:
    - from: "bin/formal-test-sync.cjs"
      to: ".planning/formal/requirements.json"
      via: "loadRequirements() lookup by requirement_id"
      pattern: "requirementMap"
    - from: "bin/formal-test-sync.cjs"
      to: "formal model files (.tla, .als, .prism)"
      via: "extractPropertyDefinition reads model file and extracts property text"
      pattern: "extractPropertyDefinition"
    - from: "commands/qgsd/solve.md"
      to: ".planning/formal/generated-stubs/*.stub.recipe.json"
      via: "executor action block references recipe files"
      pattern: "stub.recipe.json"
---

<objective>
Add test recipe generation to formal-test-sync.cjs and update the solve.md F->T template for smaller batches with pre-resolved context.

Purpose: The current F->T remediation produces 244 stubs with only `assert.fail('TODO')` because executors lack pre-resolved context (requirement text, property definitions, source files). Recipe sidecars give executors everything they need without codebase-wide grep.

Output: Updated `bin/formal-test-sync.cjs` with recipe generation, updated `commands/qgsd/solve.md` with recipe-aware template at batch size 5.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/formal-test-sync.cjs
@commands/qgsd/solve.md
@.planning/formal/requirements.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add recipe generation and helpers to formal-test-sync.cjs</name>
  <files>bin/formal-test-sync.cjs</files>
  <action>
Add three helper functions before generateStubs():

1. `extractPropertyDefinition(modelFile, propertyName)` — reads the model file from disk and extracts the property/invariant definition text:
   - TLA+: regex for `propertyName == <body>` capturing everything until a blank line or next definition (pattern: `/^propertyName\s*==[\s\S]*?(?=\n\s*\n|\n\w+\s*==|\Z)/m`)
   - Alloy (.als): regex for `pred propertyName {` or `assert propertyName {` capturing the block up to matching `}`
   - PRISM (.prism/.sm): look for `// @requirement` comment near `P=?` or `filter` lines, capture the property line
   - Returns the extracted text string, or empty string `''` on failure (fail-open)

2. `findSourceFiles(requirementId, requirementText)` — uses `spawnSync` (already imported at line 18) to grep for source files:
   - Primary: `spawnSync('grep', ['-rl', requirementId, 'bin/', 'hooks/', 'commands/', '--include=*.cjs', '--include=*.mjs', '--include=*.js', '--include=*.md'], { encoding: 'utf8', cwd: ROOT, timeout: 10000 })`
   - Parse stdout lines, filter out formal model files and test files
   - If no results, try key terms from requirement text (first 3 significant words >4 chars)
   - Returns array of relative file paths, or `[]` on failure (fail-open, wrap in try/catch)

3. `classifyTestStrategy(requirementText)` — keyword classification on lowercased text:
   - "exists"/"exports"/"function"/"module"/"defined" -> "structural"
   - "returns"/"outputs"/"produces"/"result"/"calculates" -> "behavioral"
   - "constant"/"value"/"equals"/"match"/"threshold" -> "constant"
   - default -> "structural"

Then modify `generateStubs()` (line 444):
- Change signature to accept requirements array: `generateStubs(gaps, formalAnnotations, requirements)`
- At top of function, build a requirements lookup map from the requirements array: `const requirementMap = new Map(requirements.map(r => [r.id, r]));`
- Update the `main()` call site (line 581) to pass requirements: `stubs = generateStubs(coverageReport.gaps, formalAnnotations, requirements);`
- Inside the for-loop, after writing the stub file (line 472), also write a recipe sidecar within the same `if (!dryRun)` block:

  ```javascript
  const recipeFileName = requirement_id + '.stub.recipe.json';
  const recipeFilePath = path.join(stubsDir, recipeFileName);
  const req = requirementMap.get(requirement_id);
  const modelFile = gap.formal_properties.length > 0 ? gap.formal_properties[0].model_file : '';
  const definition = modelFile ? extractPropertyDefinition(path.join(ROOT, modelFile), property) : '';
  const sourceFiles = findSourceFiles(requirement_id, req ? req.text : '');
  const importHint = sourceFiles.length > 0
    ? "const mod = require('" + path.relative(stubsDir, path.join(ROOT, sourceFiles[0])).replace(/\\/g, '/') + "');"
    : '';
  const testStrategy = classifyTestStrategy(req ? req.text : '');

  const recipe = {
    requirement_id,
    requirement_text: req ? req.text : '',
    formal_property: {
      name: property,
      model_file: modelFile,
      definition,
      type: modelFile.endsWith('.tla') ? 'invariant' : modelFile.endsWith('.als') ? 'assertion' : 'property',
    },
    source_files: sourceFiles,
    import_hint: importHint,
    test_strategy: testStrategy,
  };

  fs.writeFileSync(recipeFilePath, JSON.stringify(recipe, null, 2) + '\n', 'utf8');
  ```

- Add recipe file path to the stubs return array entry: add `recipe_file: recipeFilePath` alongside existing fields
- Update `module.exports` (line 600) to also export the three new helpers: `module.exports = { parseAlloyDefaults, extractPropertyDefinition, findSourceFiles, classifyTestStrategy };`
  </action>
  <verify>
Run: `node bin/formal-test-sync.cjs --dry-run` — should complete without errors (dry-run skips writes but exercises new code paths for loading data).
Run: `node -e "const m = require('./bin/formal-test-sync.cjs'); console.log(typeof m.extractPropertyDefinition, typeof m.findSourceFiles, typeof m.classifyTestStrategy)"` — should print `function function function`.
Run: `node -e "const m = require('./bin/formal-test-sync.cjs'); console.log(m.classifyTestStrategy('function exists and exports'))"` — should print `structural`.
  </verify>
  <done>
generateStubs() writes {ID}.stub.recipe.json sidecars with requirement_text, formal_property (name, model_file, definition, type), source_files, import_hint, and test_strategy. All three helpers exported and functional. Fail-open on missing data (empty strings/arrays, never throws).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update solve.md F->T template for recipe-based batches of 5</name>
  <files>commands/qgsd/solve.md</files>
  <action>
In `commands/qgsd/solve.md`, update the F->T Phase 2 section (lines ~133-204):

1. **Line 137** — Change max batch size from 15 to 5:
   Replace: `max 15 stubs per batch`
   With: `max 5 stubs per batch`

2. **Lines 135-136** — Update "Load context" step to mention recipes:
   Replace the existing step 1 text with:
   ```
   1. **Load context:** Parse `.planning/formal/formal-test-sync-report.json` for each stub's `requirement_id`, `formal_properties[].model_file`, `formal_properties[].property`. Also verify recipe files exist at `.planning/formal/generated-stubs/{ID}.stub.recipe.json` — these contain pre-resolved context (requirement text, property definition, source files, import hints, test strategy).
   ```

3. **Add Phase 1b validation gate** — Insert between Phase 1 (line ~131) and Phase 2 (line ~133):
   ```
   **Phase 1b — Validate recipes:** After stubs are generated, count recipe files and check completeness:
   ```bash
   node -e "
   const fs = require('fs');
   const dir = '.planning/formal/generated-stubs';
   const recipes = fs.readdirSync(dir).filter(f => f.endsWith('.stub.recipe.json'));
   const incomplete = recipes.filter(f => {
     const r = JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
     return !r.source_files.length || !r.formal_property.definition;
   });
   console.log('[solve] Recipes: ' + recipes.length + ' total, ' + incomplete.length + ' incomplete');
   "
   ```
   Incomplete recipes (missing source_files or definition) produce lower-quality tests but do NOT block dispatch.
   ```

4. **Lines 145-189** — Replace the PLAN.md template's `<action>` block with recipe-aware instructions:
   ```
   <action>
   For each stub:
   1. Read .planning/formal/generated-stubs/{ID}.stub.recipe.json
   2. Read the stub file (.stub.test.js)
   3. Use recipe.formal_property.definition as the property under test
   4. Import from recipe.import_hint (adjust relative path if needed)
   5. Follow recipe.test_strategy:
      - structural: assert function/export exists with correct signature
      - behavioral: call function with known input, assert output matches formal property
      - constant: assert code constant === formal value from property definition
   6. If recipe.source_files is empty, use Grep to find the implementing module
   7. Replace assert.fail('TODO') with real test logic using node:test + node:assert/strict
   </action>
   ```

5. **Update the template objective** to reference recipe context:
   Replace: `For each stub, read the formal model and requirement text, then replace`
   With: `For each stub, read its recipe JSON for pre-resolved context, then replace`

6. **Update the template formal context line** to include recipe reference:
   After `- {ID1}: model={model_file} property={property_name} text="{requirement text}"` add:
   `  recipe=.planning/formal/generated-stubs/{ID1}.stub.recipe.json`
  </action>
  <verify>
Grep the file for "max 5 stubs" to confirm batch size change.
Grep for "stub.recipe.json" to confirm recipe references appear in Phase 1b validation, template objective, and action block.
Grep for "recipe.test_strategy" to confirm the action block references strategy field.
Confirm no "max 15 stubs" remains in the file.
  </verify>
  <done>
solve.md F->T Phase 2 uses batch size 5, template action block reads recipe JSON first, Phase 1b validation gate counts and warns on incomplete recipes, and executors have pre-resolved context for every stub.
  </done>
</task>

</tasks>

<verification>
1. `node bin/formal-test-sync.cjs --dry-run` exits 0 (no writes, exercises code paths)
2. `node -e "const m = require('./bin/formal-test-sync.cjs'); console.log(Object.keys(m))"` shows all 4 exports
3. `grep -c 'stub.recipe.json' commands/qgsd/solve.md` returns >= 3 (Phase 1b, template objective, action block)
4. `grep 'max 15' commands/qgsd/solve.md` returns nothing (batch size changed)
5. `grep 'max 5' commands/qgsd/solve.md` returns a match
</verification>

<success_criteria>
- formal-test-sync.cjs generateStubs() produces .stub.recipe.json sidecars with pre-resolved context
- Recipe includes: requirement_text, formal_property.definition, source_files, import_hint, test_strategy
- solve.md F->T template uses batch size 5 and recipe-first action instructions
- Validation gate warns on incomplete recipes without blocking
- All changes are fail-open (no new crash paths)
</success_criteria>

<output>
After completion, create `.planning/quick/180-add-test-recipe-generation-to-formal-tes/180-SUMMARY.md`
</output>
