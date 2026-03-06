---
phase: quick-178
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/qgsd-solve.cjs
  - .planning/formal/acknowledged-false-positives.json
autonomous: true
formal_artifacts: none
requirements:
  - SOLVE-06

must_haves:
  truths:
    - "Solver auto-creates .planning/formal/ subdirectories if missing on first run"
    - "T->C sweep supports configurable test runner via .planning/config.json solve.t_to_c"
    - "R->F sweep triages requirements by formalizability and batches top-N per iteration"
    - "D->C sweep filters false positives by checking file existence and reading acknowledged-false-positives.json"
    - "Solver writes solve-state.json after each run with known_issues and r_to_f_progress"
    - "F->C sweep detects schema mismatch in conformance trace and classifies accordingly"
    - "Reverse discovery candidates are pre-classified into Category A/B/C"
  artifacts:
    - path: "bin/qgsd-solve.cjs"
      provides: "All 7 solver improvements integrated into the consistency solver"
      min_lines: 2250
    - path: ".planning/formal/acknowledged-false-positives.json"
      provides: "Seed file for D->C false positive suppression"
      contains: "entries"
  key_links:
    - from: "bin/qgsd-solve.cjs#main"
      to: "bin/qgsd-solve.cjs#preflight"
      via: "preflight() called before first iteration"
      pattern: "preflight\\("
    - from: "bin/qgsd-solve.cjs#sweepTtoC"
      to: ".planning/config.json"
      via: "reads solve.t_to_c config for runner selection"
      pattern: "solve.*t_to_c"
    - from: "bin/qgsd-solve.cjs#sweepRtoF"
      to: "bin/qgsd-solve.cjs#triageRequirements"
      via: "scores and batches requirements before dispatch"
      pattern: "triageRequirements"
    - from: "bin/qgsd-solve.cjs#sweepDtoC"
      to: ".planning/formal/acknowledged-false-positives.json"
      via: "loads and filters suppressed false positives"
      pattern: "acknowledged-false-positives"
    - from: "bin/qgsd-solve.cjs#main"
      to: ".planning/formal/solve-state.json"
      via: "writes state after each solver run"
      pattern: "solve-state\\.json"
    - from: "bin/qgsd-solve.cjs#assembleReverseCandidates"
      to: "bin/qgsd-solve.cjs#classifyCandidate"
      via: "pre-classifies candidates into A/B/C categories"
      pattern: "category.*[ABC]"
---

<objective>
Implement all 7 solver improvements to bin/qgsd-solve.cjs: auto-bootstrap infrastructure, configurable test runner, R->F prioritization, D->C false positive filtering, solver config persistence, conformance trace self-healing, and reverse discovery auto-categorization.

Purpose: Make the solver more robust, reduce false positives, support incremental formalization, and provide better signal-to-noise in reverse discovery.
Output: Updated bin/qgsd-solve.cjs with all 7 improvements, seed acknowledged-false-positives.json.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@bin/qgsd-solve.cjs
@.planning/config.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add preflight bootstrap, configurable test runner, and solver state persistence</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
Add three improvements to bin/qgsd-solve.cjs:

**1. Auto-Bootstrap Preflight (Step 0)**
Add a `preflight()` function called at the top of `main()` before the iteration loop:
- Check if `path.join(ROOT, '.planning', 'formal')` exists; if not, `fs.mkdirSync` recursively for subdirs: `tla`, `alloy`, `generated-stubs`
- If `model-registry.json` does not exist in `.planning/formal/`, create empty `{ "models": [], "search_dirs": [] }`
- NOTE: Do NOT add logic to copy from `.formal/requirements.json` — the `.formal/ → .planning/formal/` migration is complete (commit 158d6371) and that path is dead code
- Log to stderr: `TAG + ' Bootstrapped formal infrastructure'` (only if any creation happened)

**2. Configurable Test Runner for T->C**
Modify `sweepTtoC()` to read `.planning/config.json` for `solve.t_to_c` config:
```js
// At top of sweepTtoC, load config
const configPath = path.join(ROOT, '.planning', 'config.json');
let tToCConfig = { runner: 'node-test', command: null, scope: 'all' };
try {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (cfg.solve && cfg.solve.t_to_c) {
    tToCConfig = { ...tToCConfig, ...cfg.solve.t_to_c };
  }
} catch (e) { /* use defaults */ }
```

Three modes:
- `runner: "none"` -- return `{ residual: 0, detail: { skipped: true, reason: 'runner=none in config' } }`
- `runner: "jest"` -- spawn `npx jest --ci --json` (or config.command if set), parse JSON output for `numFailedTests`
- `runner: "node-test"` (default) -- existing `node --test` logic

Add auto-detection: if `runner: "node-test"` and `scope: "generated-stubs-only"`, after parsing TAP output, check if ALL failures are in test files outside `.planning/formal/generated-stubs/`. If so, classify as "runner mismatch", set residual to 0, and add a warning to detail: `{ runner_mismatch: true, warning: 'All N failures are outside generated-stubs scope — likely runner mismatch' }`.

**3. Solver State Persistence**
After the iteration loop in `main()` (right before the JSON/report output), write `.planning/formal/solve-state.json`:
```js
const solveState = {
  last_run: new Date().toISOString(),
  converged: converged,
  iteration_count: iterations.length,
  final_residual_total: finalResidual.total,
  reverse_discovery_total: finalResidual.reverse_discovery_total || 0,
  known_issues: [],
  r_to_f_progress: {
    total: finalResidual.r_to_f.detail.total || 0,
    covered: finalResidual.r_to_f.detail.covered || 0,
    percentage: finalResidual.r_to_f.detail.percentage || 0,
  },
};
// Collect known issues from non-zero non-error layers
for (const [key, val] of Object.entries(finalResidual)) {
  if (val && typeof val === 'object' && val.residual > 0) {
    solveState.known_issues.push({ layer: key, residual: val.residual });
  }
}
try {
  const stateDir = path.join(ROOT, '.planning', 'formal');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'solve-state.json'),
    JSON.stringify(solveState, null, 2) + '\n'
  );
} catch (e) {
  process.stderr.write(TAG + ' WARNING: could not write solve-state.json: ' + e.message + '\n');
}
```

Ensure `preflight()` is exported from `module.exports` for testability.
  </action>
  <verify>
Run `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.preflight === 'function' ? 'OK' : 'MISSING')"` to confirm preflight is exported.
Grep for `preflight()` call in main, `t_to_c` config read in sweepTtoC, and `solve-state.json` write in main.
Run `node --test bin/qgsd-solve.test.cjs` to confirm existing tests still pass.
  </verify>
  <done>
preflight() creates missing formal infrastructure directories on first run. sweepTtoC reads .planning/config.json for runner config and supports node-test/jest/none modes with scope-based auto-detection. main() writes solve-state.json after each run with known_issues and r_to_f_progress.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add R->F prioritization and D->C false positive filtering</name>
  <files>bin/qgsd-solve.cjs, .planning/formal/acknowledged-false-positives.json</files>
  <action>
Add two sweep-level improvements:

**4. R->F Prioritization (triage layer)**
Add a `triageRequirements(requirements)` function that scores each requirement:
- HIGH: requirement text matches word-boundary regex for "shall", "must", "invariant", "constraint" (use `\b` boundaries, e.g. `/\bmust\b/i` to avoid matching "mustard"), or has a `formalizability` field set to "high"
- MEDIUM: matches word-boundary regex for "should", "verify", "ensure", "validate", "check"
- LOW: matches word-boundary regex for "may", "could", "consider", "nice-to-have"
- SKIP: matches word-boundary regex for "deferred", "out-of-scope", "deprecated"

Use `new RegExp('\\b' + keyword + '\\b', 'i')` and match against the requirement text — but guard the property name since requirements.json entries may use either field: `const text = (requirement.text || requirement.description || '').toLowerCase()`. This prevents false matches like "mustard" matching "must" and avoids undefined errors on entries that use `description` instead of `text`.

Returns `{ high: [...], medium: [...], low: [...], skip: [...] }` arrays of requirement IDs.

Modify `sweepRtoF()`: After getting uncovered requirements from the traceability matrix, run them through `triageRequirements()`. Add to the detail object:
```js
detail.triage = { high: N, medium: N, low: N, skip: N };
detail.priority_batch = highIds.concat(mediumIds).slice(0, 15); // top 15 for next iteration
```
The residual remains the full uncovered count (do not hide work), but the `priority_batch` guides autoClose dispatch.

In `autoClose()` for R->F, update the action message to include triage info:
`residual.r_to_f.detail.triage.high + ' HIGH + ' + residual.r_to_f.detail.triage.medium + ' MEDIUM priority requirements lack formal coverage'`

**5. D->C False Positive Filtering**
Modify `sweepDtoC()` to add false positive filtering BEFORE adding claims to `brokenClaims`:

a) Load acknowledged false positives:
```js
const fpPath = path.join(ROOT, '.planning', 'formal', 'acknowledged-false-positives.json');
let acknowledgedFPs = new Set();
try {
  const fpData = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
  for (const entry of (fpData.entries || [])) {
    // Key by doc_file + value only (no line numbers — line numbers shift on edits and break suppression)
    acknowledgedFPs.add(entry.doc_file + ':' + entry.value);
  }
} catch (e) { /* no ack file */ }
```

b) In the claim verification loop, after determining `isBroken = true`:
- If claim.type === 'file_path' and value ends in `.ts`, `.tsx`, or `.mdx` (inside backticks in docs): this is already checked by file existence -- keep as-is
- If the claim's doc_file matches patterns like `CHANGELOG`, `HISTORY`, `archived/`, `deprecated/`: set weight to 0.1 instead of full category weight
- If `acknowledgedFPs.has(claim.doc_file + ':' + claim.value)`: skip the claim entirely (do not add to brokenClaims). NOTE: the key intentionally omits line numbers — line numbers are unstable (any edit above the acknowledged line shifts them, breaking suppression)
- Add `detail.suppressed_fp_count` to track how many were filtered

c) Create seed `.planning/formal/acknowledged-false-positives.json`:
```json
{
  "description": "Suppressed D->C false positives. Add entries to prevent known-stale claims from inflating residual.",
  "entries": []
}
```

Export `triageRequirements` from module.exports for testability.
  </action>
  <verify>
Run `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.triageRequirements === 'function' ? 'OK' : 'MISSING')"`.
Verify `acknowledged-false-positives.json` exists: `cat .planning/formal/acknowledged-false-positives.json`.
Grep for `acknowledgedFPs` in sweepDtoC, `priority_batch` in sweepRtoF.
Run `node --test bin/qgsd-solve.test.cjs` to confirm existing tests still pass.
  </verify>
  <done>
sweepRtoF triages requirements by formalizability (HIGH/MEDIUM/LOW/SKIP) and provides priority_batch of top 15 for incremental formalization. sweepDtoC filters acknowledged false positives, reduces weight for historical/archived docs, and tracks suppressed count.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add F->C conformance self-healing and reverse discovery auto-categorization</name>
  <files>bin/qgsd-solve.cjs</files>
  <action>
Add two improvements — one to sweepFtoC and one to assembleReverseCandidates:

**6. Conformance Trace Self-Healing**
Modify `sweepFtoC()`: After parsing check-results.ndjson, add a schema compatibility check:

```js
// Conformance trace self-healing
const conformancePath = path.join(ROOT, '.planning', 'formal', 'trace', 'conformance-events.jsonl');
if (fs.existsSync(conformancePath)) {
  try {
    const events = fs.readFileSync(conformancePath, 'utf8').split('\n')
      .filter(l => l.trim())
      .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
      .filter(Boolean);

    const eventTypes = new Set(events.map(e => e.type || e.event));

    // Try to load XState machine event types from spec/
    const specDir = path.join(ROOT, '.planning', 'formal', 'spec');
    let machineEventTypes = new Set();
    if (fs.existsSync(specDir)) {
      const specFiles = walkDir(specDir, 3, 0);
      for (const f of specFiles) {
        if (!f.endsWith('.json') && !f.endsWith('.js')) continue;
        try {
          const content = fs.readFileSync(f, 'utf8');
          // Extract event types from "on": { "EVENT_NAME": ... } patterns
          const onMatches = content.matchAll(/"on"\s*:\s*\{([^}]+)\}/g);
          for (const m of onMatches) {
            const keys = m[1].matchAll(/"([A-Z_]+)"/g);
            for (const k of keys) machineEventTypes.add(k[1]);
          }
        } catch(e) { /* skip */ }
      }
    }

    if (machineEventTypes.size > 0 && eventTypes.size > 0) {
      const overlap = [...eventTypes].filter(t => machineEventTypes.has(t)).length;
      const overlapPct = overlap / Math.max(eventTypes.size, 1);

      if (overlapPct < 0.5) {
        // Schema mismatch — reclassify
        return {
          residual: failedCount,
          detail: {
            ...existingDetail,
            schema_mismatch: true,
            schema_mismatch_detail: {
              trace_event_types: eventTypes.size,
              machine_event_types: machineEventTypes.size,
              overlap: overlap,
              overlap_pct: (overlapPct * 100).toFixed(1) + '%',
            },
            note: 'Conformance trace has <50% event type overlap with state machine — likely schema mismatch, not verification failure',
          },
        };
      }
    }
  } catch (e) {
    // Conformance trace check failed — fail-open, continue with normal result
  }
}
```

**Insertion point:** The current `sweepFtoC()` builds its return value near the end of the function as `return { residual: failedCount, detail: { total_checks, passed, failed, inconclusive, failures, inconclusive_checks } }`. NOTE: Line numbers cited here (~705-715) are approximate and WILL shift after Tasks 1-2 modify the file. The executor should search for the `return { residual: failedCount, detail:` pattern rather than relying on exact line numbers. Capture this detail into a variable BEFORE the return:
```js
const existingDetail = {
  total_checks: totalCount,
  passed: Math.max(0, totalCount - failedCount - inconclusiveCount),
  failed: failedCount,
  inconclusive: inconclusiveCount,
  failures: failures,
  inconclusive_checks: inconclusiveChecks,
};
```
Then place the conformance trace check block (above) using `existingDetail`, and change the final return to `return { residual: failedCount, detail: existingDetail };`. The schema_mismatch early-return spreads `...existingDetail` so all normal fields are preserved.

**Note on walkDir:** `walkDir()` is a top-level function defined at line 139 of qgsd-solve.cjs, so it is already in scope for `sweepFtoC` — no import or re-definition needed.

The residual count stays the same (failed formal checks are still failed), but the detail.schema_mismatch flag lets consumers distinguish real failures from stale trace data.

**7. Reverse Discovery Auto-Categorization**
Modify `assembleReverseCandidates()` to pre-classify candidates into three categories:

Add a `classifyCandidate(candidate)` function:

```js
function classifyCandidate(candidate) {
  const text = (candidate.file_or_claim || '').toLowerCase();
  const evidence = (candidate.evidence || '').toLowerCase();

  // Category A (likely requirements): strong requirement language
  // Use word-boundary regex to avoid false matches (e.g. "mustard" matching "must")
  // Consistent with triageRequirements() which also uses \b boundaries
  const reqSignals = ['must', 'shall', 'ensures', 'invariant', 'constraint', 'enforces', 'guarantees'];
  const hasReqLanguage = reqSignals.some(s => new RegExp('\\b' + s + '\\b', 'i').test(text));

  // Category B (likely documentation): weak/descriptive language in doc claims
  const docSignals = ['supports', 'handles', 'provides', 'describes', 'documents', 'explains'];
  const hasDocLanguage = docSignals.some(s => new RegExp('\\b' + s + '\\b', 'i').test(text));

  // Module and test types are more likely to be real requirements
  if (candidate.type === 'module' || candidate.type === 'test') {
    // Source modules and tests are usually genuine missing requirements
    return { category: 'A', reason: 'source ' + candidate.type + ' without requirement tracing', suggestion: 'approve' };
  }

  if (candidate.type === 'claim') {
    if (hasReqLanguage) {
      return { category: 'A', reason: 'strong requirement language in doc claim', suggestion: 'approve' };
    }
    if (hasDocLanguage && !hasReqLanguage) {
      return { category: 'B', reason: 'descriptive/documentation language only', suggestion: 'acknowledge' };
    }
    return { category: 'C', reason: 'ambiguous — review needed', suggestion: 'review' };
  }

  return { category: 'C', reason: 'unclassified candidate type', suggestion: 'review' };
}
```

In `assembleReverseCandidates()`, after the dedup/filter/ack loop and before applying MAX_REVERSE_CANDIDATES cap:

```js
// Auto-categorize candidates
for (const c of candidates) {
  const classification = classifyCandidate(c);
  c.category = classification.category;
  c.category_reason = classification.reason;
  c.suggestion = classification.suggestion;
}

// Count by category for summary
const categoryCounts = { A: 0, B: 0, C: 0 };
for (const c of candidates) {
  categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
}
```

Add `category_counts` to the return object alongside existing `candidates`, `total_raw`, `deduped`, `filtered`, `acknowledged`.

Update `formatReport()` reverse discovery section: after the "Candidates: N (raw: ...)" line, add:
```
if (ac.category_counts) {
  lines.push('  Category A (likely reqs): ' + (ac.category_counts.A || 0) +
    ', Category B (likely docs): ' + (ac.category_counts.B || 0) +
    ', Category C (ambiguous): ' + (ac.category_counts.C || 0));
}
```

Update `formatJSON()`: include `category_counts` in the assembled_candidates section of the JSON output (it flows through naturally since assembled_candidates is already included in the residual).

Export `classifyCandidate` from module.exports for testability.
  </action>
  <verify>
Run `node -e "const s = require('./bin/qgsd-solve.cjs'); console.log(typeof s.classifyCandidate === 'function' ? 'OK' : 'MISSING')"`.
Grep for `schema_mismatch` in sweepFtoC, `category_counts` in formatReport and assembleReverseCandidates.
Run `node --test bin/qgsd-solve.test.cjs` to confirm existing tests still pass.
  </verify>
  <done>
sweepFtoC detects conformance trace schema mismatch and flags it in detail rather than treating it as pure verification failure. Reverse discovery candidates are pre-classified: Category A (source modules/tests, strong requirement language) get "approve" suggestion, Category B (descriptive doc claims) get "acknowledge" suggestion, Category C (ambiguous) get "review" suggestion. Category counts appear in both human-readable and JSON output.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const s = require('./bin/qgsd-solve.cjs'); const fns = ['preflight','triageRequirements','classifyCandidate']; for (const f of fns) console.log(f + ': ' + (typeof s[f] === 'function' ? 'OK' : 'MISSING'))"` -- all three new functions exported
2. `node --test bin/qgsd-solve.test.cjs` -- existing tests pass (no regressions)
3. `cat .planning/formal/acknowledged-false-positives.json` -- seed file exists with empty entries array
4. `grep -c 'preflight\|triageRequirements\|classifyCandidate\|solve-state\.json\|acknowledged-false-positives\|schema_mismatch\|category_counts\|priority_batch' bin/qgsd-solve.cjs` -- all 7 features present in codebase
</verification>

<success_criteria>
All 7 solver improvements are integrated into bin/qgsd-solve.cjs:
1. preflight() auto-creates .planning/formal/ subdirectories
2. sweepTtoC supports configurable test runner (node-test/jest/none) with scope filtering
3. sweepRtoF triages requirements by formalizability with priority batching
4. sweepDtoC filters false positives via acknowledged-false-positives.json and historical doc weighting
5. main() writes solve-state.json after each run
6. sweepFtoC detects conformance trace schema mismatch
7. assembleReverseCandidates classifies candidates into A/B/C categories

Existing tests pass. No regressions.
</success_criteria>

<output>
After completion, create `.planning/quick/178-implement-all-7-solver-improvements-auto/178-SUMMARY.md`
</output>
