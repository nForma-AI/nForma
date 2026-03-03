---
phase: quick-134
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/requirements-core.cjs
  - bin/requirements-core.test.cjs
  - bin/agents.cjs
  - bin/agents.test.cjs
autonomous: true
requirements: [QUICK-134]
formal_artifacts: none

must_haves:
  truths:
    - "computeCoverage().withFormalModels counts requirements that have EITHER a direct formal_models field OR a model-registry forward link (union, not just registry)"
    - "buildTraceability() returns formal models from BOTH the requirement's own formal_models array AND model-registry forward links, deduplicated by path"
    - "Browse Reqs list shows [FM] badge for requirements that have formal_models field even if model-registry has no entry for them"
    - "TUI menu contains a 'Coverage Gaps' item in the Requirements section that runs detect-coverage-gaps.cjs and displays results"
    - "All tests pass: node --test bin/requirements-core.test.cjs and node --test bin/agents.test.cjs"
  artifacts:
    - path: "bin/requirements-core.cjs"
      provides: "formal_models field integration in computeCoverage and buildTraceability"
      exports: ["readRequirementsJson", "readModelRegistry", "readCheckResults", "computeCoverage", "buildTraceability", "filterRequirements", "getUniqueCategories"]
    - path: "bin/requirements-core.test.cjs"
      provides: "Tests for formal_models integration"
      min_lines: 330
    - path: "bin/agents.cjs"
      provides: "Coverage Gaps menu item + flow, updated FM badge logic"
      exports: ["MENU_ITEMS"]
    - path: "bin/agents.test.cjs"
      provides: "MENU_ITEMS structural test updated with req-gaps action"
      contains: "req-gaps"
  key_links:
    - from: "bin/requirements-core.cjs:computeCoverage"
      to: "formal/requirements.json"
      via: "r.formal_models field read"
      pattern: "r\\.formal_models"
    - from: "bin/requirements-core.cjs:buildTraceability"
      to: "formal/requirements.json"
      via: "requirement.formal_models field read"
      pattern: "requirement\\.formal_models"
    - from: "bin/agents.cjs:renderReqList"
      to: "formal/requirements.json"
      via: "r.formal_models check for FM badge"
      pattern: "r\\.formal_models"
    - from: "bin/agents.cjs:reqCoverageGapsFlow"
      to: "bin/detect-coverage-gaps.cjs"
      via: "require and call detectCoverageGaps"
      pattern: "detectCoverageGaps"
---

<objective>
Integrate the formal_models field from requirements.json into requirements-core.cjs (computeCoverage and buildTraceability) and agents.cjs (FM badge), and add detect-coverage-gaps.cjs to the TUI menu.

Purpose: 56 requirements in requirements.json have a direct formal_models field (added by SCHEMA-04), but requirements-core.cjs only finds formal models via model-registry forward links. This leaves the direct field unused, giving incomplete coverage counts and FM badges. Additionally, detect-coverage-gaps.cjs exists but is not accessible from the TUI.
Output: Updated requirements-core.cjs and agents.cjs with tests.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@bin/requirements-core.cjs
@bin/requirements-core.test.cjs
@bin/agents.cjs
@bin/agents.test.cjs
@bin/detect-coverage-gaps.cjs
@formal/requirements.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Integrate formal_models field into requirements-core.cjs and add tests</name>
  <files>bin/requirements-core.cjs, bin/requirements-core.test.cjs</files>
  <action>
Modify `bin/requirements-core.cjs` in two functions:

**1. computeCoverage() -- union formal_models with model-registry:**

In the "Formal model coverage" block (lines 92-100), after the loop that populates `reqsWithModels` from `registry.models`, add a second pass that also checks each requirement's own `formal_models` field:

```javascript
// Also include requirements with direct formal_models field (SCHEMA-04)
for (const r of requirements) {
  if (Array.isArray(r.formal_models) && r.formal_models.length > 0) {
    reqsWithModels.add(r.id);
  }
}
```

This must come AFTER the registry loop so both sources contribute to the same Set (union). The `withFormalModels` count on line 99 will then reflect requirements covered by either source.

**2. buildTraceability() -- union formal_models with model-registry:**

In the "Forward: find formal models" block (lines 139-149), after the loop that finds models from `registry.models`, add a second block that also checks the requirement's own `formal_models` array:

```javascript
// Also include models listed in requirement's own formal_models field (SCHEMA-04)
if (Array.isArray(requirement.formal_models)) {
  for (const modelPath of requirement.formal_models) {
    // Deduplicate: skip if already found via registry
    if (!formalModels.some(fm => fm.path === modelPath)) {
      // Try to get description from registry if available
      const registryEntry = models[modelPath];
      formalModels.push({
        path:        modelPath,
        description: (registryEntry && registryEntry.description) || '',
        version:     (registryEntry && registryEntry.version) || null,
      });
    }
  }
}
```

Deduplication is by `path` -- if model-registry already found the model, don't add a duplicate entry. If the model exists only in `formal_models` but not in model-registry, still include it but with empty description and null version (unless registry has metadata under that key).

**3. Add tests to bin/requirements-core.test.cjs:**

Add a new section "8. formal_models integration" after section 7 with these tests:

a. `computeCoverage: formal_models field adds to withFormalModels count` -- Create requirements where one has `formal_models: ["formal/tla/Foo.tla"]` but NO registry entry. Verify `withFormalModels` counts it.

b. `computeCoverage: formal_models + registry union is deduplicated` -- Create a requirement with `formal_models: ["formal/tla/Foo.tla"]` AND a registry entry listing that requirement. Verify `withFormalModels` is 1, not 2 (Set deduplicates).

c. `buildTraceability: includes models from requirement formal_models field` -- Create a requirement with `formal_models: ["formal/alloy/bar.als"]` but NO registry entry for that path. Verify `trace.formalModels` has length 1 with the correct path.

d. `buildTraceability: deduplicates models from formal_models and registry` -- Create a requirement with `formal_models: ["formal/tla/X.tla"]` AND a registry entry `formal/tla/X.tla` listing that requirement. Verify `trace.formalModels` has length 1 (not 2), and the entry has the registry's description (richer data wins).

e. `buildTraceability: formal_models enriches with registry metadata when available` -- Create a requirement with `formal_models: ["formal/tla/Y.tla"]` AND a registry entry for `formal/tla/Y.tla` that has `description: "Y model"` but does NOT list the requirement in its `requirements` array. Verify `trace.formalModels` has length 1, path is `formal/tla/Y.tla`, and description is `"Y model"` (pulled from registry metadata even though registry didn't link to this req).

Use the existing `makeReq` helper with override: `makeReq('FM-01', { formal_models: ['formal/tla/Foo.tla'] })`.
  </action>
  <verify>
Run: `node --test bin/requirements-core.test.cjs` -- all tests pass (existing + 5 new).
Spot-check: `node -e "const rc = require('./bin/requirements-core.cjs'); const cov = rc.computeCoverage([{id:'X', formal_models:['a.tla']}], {models:{}}, []); console.log(cov.withFormalModels)"` -- prints 1.
  </verify>
  <done>
computeCoverage() counts requirements with formal_models OR model-registry links (union via Set). buildTraceability() returns formal models from both sources, deduplicated by path, with registry metadata enrichment. All existing and new tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update FM badge in agents.cjs and add Coverage Gaps TUI menu item</name>
  <files>bin/agents.cjs, bin/agents.test.cjs</files>
  <action>
Modify `bin/agents.cjs` in three areas:

**1. Update FM badge in renderReqList() (around line 2026-2035):**

Currently the FM badge only checks model-registry. Update to also check `r.formal_models`:

Replace the existing FM badge block:
```javascript
// Check model-registry for FM badge
const registry = reqCore.readModelRegistry();
const reqsWithModels = new Set();
for (const entry of Object.values(registry.models || {})) {
  for (const rid of (entry.requirements || [])) reqsWithModels.add(rid);
}
```

With:
```javascript
// Check model-registry AND requirement.formal_models for FM badge
const registry = reqCore.readModelRegistry();
const reqsWithModels = new Set();
for (const entry of Object.values(registry.models || {})) {
  for (const rid of (entry.requirements || [])) reqsWithModels.add(rid);
}
// Also check direct formal_models field (SCHEMA-04)
for (const r of reqs) {
  if (Array.isArray(r.formal_models) && r.formal_models.length > 0) {
    reqsWithModels.add(r.id);
  }
}
```

The `fm` const on the next line (`const fm = reqsWithModels.has(r.id) ? ...`) remains unchanged -- it already reads from the Set.

**2. Add MENU_ITEMS entry for Coverage Gaps:**

In the MENU_ITEMS array (around line 69-73), after the existing `req-aggregate` entry:
```javascript
{ label: '  Aggregate',               action: 'req-aggregate'  },
```

Add:
```javascript
{ label: '  Coverage Gaps',           action: 'req-gaps'       },
```

This places it logically as the last Requirements-section action, before the separator.

**3. Add reqCoverageGapsFlow() function and dispatch:**

Add the flow function after the `reqAggregateFlow()` function (find it by searching for `reqAggregateFlow`). Add this new function:

```javascript
// --- Requirements: Coverage Gaps -------------------------------------------------
function reqCoverageGapsFlow() {
  try {
    const { detectCoverageGaps } = require('./detect-coverage-gaps.cjs');
    const lines = [];
    lines.push('{bold}TLC Coverage Gap Analysis{/bold}');
    lines.push('─'.repeat(60));
    lines.push('');

    // Run for all known specs
    const specs = ['QGSDQuorum', 'QGSDStopHook', 'QGSDCircuitBreaker'];
    let totalGaps = 0;

    for (const specName of specs) {
      const result = detectCoverageGaps({ specName });
      lines.push(`{bold}${specName}{/bold}`);

      if (result.status === 'full-coverage') {
        lines.push('  {green-fg}Full coverage{/} — all TLC-reachable states observed in traces');
      } else if (result.status === 'gaps-found') {
        totalGaps += result.gaps.length;
        lines.push(`  {yellow-fg}${result.gaps.length} gap(s){/} — states reachable by TLC but not observed:`);
        for (const gap of result.gaps) {
          lines.push(`    {red-fg}${gap}{/}`);
        }
        if (result.outputPath) {
          lines.push(`  Report: ${result.outputPath}`);
        }
      } else if (result.status === 'no-traces') {
        lines.push('  {gray-fg}No conformance traces found{/}');
      } else if (result.status === 'unknown-spec') {
        lines.push(`  {gray-fg}${result.reason}{/}`);
      }
      lines.push('');
    }

    lines.push('─'.repeat(60));
    if (totalGaps > 0) {
      lines.push(`{yellow-fg}Total gaps: ${totalGaps} state(s) need test coverage{/}`);
    } else {
      lines.push('{green-fg}No coverage gaps detected across all specs{/}');
    }

    setContent('Coverage Gaps', lines.join('\n'));
  } catch (err) {
    setContent('Coverage Gaps', `{red-fg}Error: ${err.message}{/}`);
  }
}
```

This is a synchronous function (like `renderReqCoverage`, not async) since `detectCoverageGaps` is synchronous.

**4. Wire dispatch:**

In the `dispatch()` function (around line 1901-1904), after the `req-aggregate` line:
```javascript
else if (action === 'req-aggregate')    await reqAggregateFlow();
```

Add:
```javascript
else if (action === 'req-gaps')         reqCoverageGapsFlow();
```

Note: no `await` since the function is synchronous.

**5. Update agents.test.cjs MENU_ITEMS test:**

In `bin/agents.test.cjs`, find the `MENU_ITEMS: contains all expected actions` test (around line 356-367). Add `'req-gaps'` to the expected actions array, after `'req-aggregate'`:

```javascript
for (const expected of [
  'list', 'add', 'clone', 'edit', 'remove', 'reorder',
  'health-single', 'login', 'provider-keys',
  'batch-rotate', 'health', 'scoreboard', 'update-agents', 'tune-timeouts',
  'update-policy', 'req-browse', 'req-coverage', 'req-traceability', 'req-aggregate',
  'req-gaps',
  'export', 'import', 'exit',
]) {
```

**TUI-nav invariant compliance:** Adding a menu item to MENU_ITEMS does not change navigation depth or escape behavior. The new `req-gaps` action renders content in the existing `contentBox` (same as `req-coverage`), which is depth=0 (main menu) and does not push a sub-flow. EscapeProgress is trivially preserved since no new depth transitions are introduced.
  </action>
  <verify>
Run: `node --test bin/agents.test.cjs` -- all tests pass including updated MENU_ITEMS structural test.
Check: `node -e "const {MENU_ITEMS} = require('./bin/agents.cjs'); const gaps = MENU_ITEMS.find(m => m.action === 'req-gaps'); console.log(gaps ? 'FOUND: ' + gaps.label : 'MISSING')"` -- prints "FOUND:   Coverage Gaps".
Check: `grep -c "reqCoverageGapsFlow" bin/agents.cjs` -- returns 2+ (function definition + dispatch).
Check: `grep "req-gaps" bin/agents.test.cjs` -- present in expected actions list.
  </verify>
  <done>
FM badge in Browse Reqs shows [FM] for requirements with formal_models field OR model-registry links. Coverage Gaps menu item exists in Requirements section. reqCoverageGapsFlow() runs detect-coverage-gaps.cjs for all 3 specs and displays results. agents.test.cjs MENU_ITEMS test includes req-gaps.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/requirements-core.test.cjs` -- all tests pass (existing + 5 new formal_models tests)
2. `node --test bin/agents.test.cjs` -- all tests pass (including req-gaps in MENU_ITEMS)
3. `node -e "const rc = require('./bin/requirements-core.cjs'); const cov = rc.computeCoverage([{id:'X', status:'Complete', formal_models:['a.tla']}], {models:{}}, []); console.log('withFM:', cov.withFormalModels)"` -- prints 1
4. `node -e "const rc = require('./bin/requirements-core.cjs'); const t = rc.buildTraceability('X', [{id:'X', formal_models:['a.tla']}], {models:{}}, []); console.log('models:', t.formalModels.length)"` -- prints 1
5. `node -e "const {MENU_ITEMS} = require('./bin/agents.cjs'); console.log(MENU_ITEMS.filter(m => m.action.startsWith('req-')).map(m => m.action).join(', '))"` -- includes req-gaps
</verification>

<success_criteria>
- computeCoverage() withFormalModels reflects union of model-registry and requirement.formal_models
- buildTraceability() formalModels array includes models from both sources, deduplicated
- Browse Reqs FM badge lights up for requirements with direct formal_models field
- Coverage Gaps menu item appears in TUI Requirements section
- reqCoverageGapsFlow runs all 3 specs through detect-coverage-gaps.cjs
- All existing tests continue to pass; new tests cover formal_models integration
</success_criteria>

<output>
After completion, create `.planning/quick/134-integrate-formal-models-field-and-detect/134-SUMMARY.md`
</output>
