---
phase: quick-226
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/model-complexity-profile.cjs
  - bin/model-complexity-profile.test.cjs
  - bin/nf-solve.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-226]

must_haves:
  truths:
    - "Running model-complexity-profile.cjs produces a JSON profile combining static state-space estimates with actual runtime_ms from check-results.ndjson, using a formalism-prefix-to-path correlation layer to join the two ID formats"
    - "When state-space-report.json is absent (the default production case), the profiler produces a complete runtime-only profile with valid classifications and split candidates"
    - "The profile includes per-model complexity class (FAST/MODERATE/SLOW/HEAVY) based on runtime thresholds"
    - "nf-solve report includes a Model Complexity section showing runtime hotspots and split/merge recommendations"
    - "Models exceeding runtime threshold are flagged as split candidates; small fast models sharing requirements are flagged as merge candidates"
  artifacts:
    - path: "bin/model-complexity-profile.cjs"
      provides: "Combines state-space-report.json + check-results.ndjson into complexity profile"
      exports: ["main"]
    - path: "bin/model-complexity-profile.test.cjs"
      provides: "Unit tests for the profiler"
      min_lines: 50
    - path: ".planning/formal/model-complexity-profile.json"
      provides: "Persisted complexity profile artifact"
  key_links:
    - from: "bin/model-complexity-profile.cjs"
      to: ".planning/formal/state-space-report.json"
      via: "fs.readFileSync JSON parse"
      pattern: "state-space-report\\.json"
    - from: "bin/model-complexity-profile.cjs"
      to: ".planning/formal/check-results.ndjson"
      via: "NDJSON line parsing for runtime_ms"
      pattern: "check-results\\.ndjson"
    - from: "bin/nf-solve.cjs"
      to: "bin/model-complexity-profile.cjs"
      via: "spawnTool call in report generation"
      pattern: "model-complexity-profile"
---

<objective>
Track formal model complexity and runtime, then surface split/merge recommendations in nf-solve.

Purpose: With 112 formal models and growing, some checks take 20+ seconds while others are sub-second. Without visibility into runtime vs. complexity, the solver cannot recommend splitting heavy models or merging trivially small ones. This task adds that signal.

Output: A complexity profiler script, its tests, and nf-solve integration that surfaces actionable split/merge recommendations.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/analyze-state-space.cjs
@bin/nf-solve.cjs
@.planning/formal/check-result.schema.json
@.planning/formal/state-space-report.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create model-complexity-profile.cjs profiler</name>
  <files>
    bin/model-complexity-profile.cjs
    bin/model-complexity-profile.test.cjs
  </files>
  <action>
Create `bin/model-complexity-profile.cjs` — a Node.js CLI script that:

1. **Reads two data sources:**
   - `.planning/formal/state-space-report.json` (static complexity from analyze-state-space.cjs) — contains `models` keyed by TLA+ path with `estimated_states`, `risk_level`, `variables`, `has_unbounded`
   - `.planning/formal/check-results.ndjson` (runtime data from run-formal-verify.cjs) — each line has `check_id`, `runtime_ms`, `result`, `formalism`

2. **Builds a formalism-prefix-to-path correlation layer:**
   check-results.ndjson uses `check_id` values like `"tla:account-manager"`, `"alloy:quorum-votes"`, `"prism:quorum"`. state-space-report.json (when it exists) keys models by file path like `".planning/formal/tla/NFQuorum.tla"`. These two ID formats do NOT match directly.

   Build a `FORMALISM_PATH_MAP` that correlates the two:
   - Extract formalism prefix from check_id (e.g., `"tla"` from `"tla:account-manager"`)
   - Map formalism to directory: `{ tla: '.planning/formal/tla/', alloy: '.planning/formal/alloy/', prism: '.planning/formal/prism/' }`
   - Extract model slug from check_id (e.g., `"account-manager"` from `"tla:account-manager"`)
   - Match state-space entries whose path starts with the formalism directory AND whose filename (lowercased, without extension) contains the slug or a normalized variant
   - If no state-space match is found, the model gets `null` for all state-space fields (this is expected for non-TLA+ models and when state-space-report.json is absent)

   For each model found in either source after join:
   - `check_id` (from NDJSON) or model path (from state-space)
   - `formalism` (tla, alloy, prism, etc.)
   - `runtime_ms` — latest runtime from NDJSON (if multiple entries for same check_id, take the max)
   - `estimated_states` — from state-space report (null if not a TLA+ model or no join match)
   - `risk_level` — from state-space report (null if not TLA+ or no join match)
   - `variable_count` — number of variables (from state-space, null if no join match)
   - `runtime_class` — classified as: FAST (<=1000ms), MODERATE (1001-10000ms), SLOW (10001-30000ms), HEAVY (>30000ms)

3. **Generates split/merge recommendations:**
   - **Split candidates:** Models with `runtime_class` SLOW or HEAVY AND (`variable_count >= 5` or `estimated_states > 1_000_000`). When state-space data is unavailable (the default case today), split candidates are identified by runtime alone: any model with `runtime_class` HEAVY is a split candidate, and SLOW models are flagged with a softer recommendation ("consider splitting if complexity grows"). These are models worth decomposing.
   - **Merge candidates:** Use the existing `cross_model` analysis from state-space-report.json — pairs where `recommendation === 'merge'` AND both models have `runtime_class` FAST or MODERATE. Only merge when the combined runtime stays reasonable.

4. **Output format:**
   ```json
   {
     "metadata": { "generated_at": "...", "generator": "model-complexity-profile", "version": "1.0" },
     "profiles": { "<check_id>": { "formalism": "...", "runtime_ms": N, "estimated_states": N|null, "risk_level": "...", "variable_count": N, "runtime_class": "FAST|MODERATE|SLOW|HEAVY" } },
     "recommendations": {
       "split_candidates": [{ "check_id": "...", "reason": "HEAVY runtime (21044ms) with 6 variables and 1.2M states" }],
       "merge_candidates": [{ "model_a": "...", "model_b": "...", "reason": "Shared requirements [X], combined runtime 3200ms, within TLC budget" }]
     },
     "summary": { "total_profiled": N, "by_runtime_class": { "FAST": N, "MODERATE": N, "SLOW": N, "HEAVY": N }, "split_candidates": N, "merge_candidates": N }
   }
   ```

5. **CLI flags:**
   - `--json` — print to stdout instead of writing file
   - `--quiet` — suppress human summary
   - `--project-root=PATH` — standard nForma cross-repo flag

6. **Output file:** `.planning/formal/model-complexity-profile.json`

7. **Fail-open (default tested path):** If either data source is missing, produce a partial profile with warnings (do NOT exit non-zero). Missing state-space = runtime-only profile. Missing NDJSON = static-only profile.

   **IMPORTANT:** `state-space-report.json` does NOT currently exist on disk. The runtime-only profile (state-space absent) is therefore the DEFAULT code path in production, not an edge case. The code and tests MUST treat this as the primary path:
   - The profiler's main logic should work correctly with `stateSpaceData = null` as the normal case
   - Do NOT gate the entire profile behind state-space availability
   - The runtime-only profile should still produce valid classifications, split candidates (based on runtime alone), and summary statistics

Follow existing patterns from `bin/analyze-state-space.cjs`:
- Use `const TAG = '[model-complexity-profile]';`
- Parse `--project-root=` the same way
- Use `process.stdout.write` / `process.stderr.write` (not console.log)
- Exit 0 on success

Create `bin/model-complexity-profile.test.cjs` with tests:
- Test runtime classification thresholds (FAST/MODERATE/SLOW/HEAVY boundary values)
- Test merge candidate filtering (both must be FAST/MODERATE)
- Test split candidate detection (SLOW/HEAVY with enough variables)
- Test graceful handling when state-space-report.json is missing (this is the DEFAULT path — must produce a complete runtime-only profile, not a degraded stub)
- Test graceful handling when check-results.ndjson is missing
- Test deduplication of NDJSON entries (max runtime wins for same check_id)
- Test formalism-prefix-to-path join: given check_id `"tla:account-manager"` and state-space key `".planning/formal/tla/MCAccountManager.tla"`, verify they join correctly
- Test join miss: given check_id `"alloy:quorum-votes"` with no matching state-space entry, verify state-space fields are null and model still appears in profile

Use the project's existing test pattern: `const { test } = require('node:test'); const assert = require('node:assert/strict');`
  </action>
  <verify>
    node bin/model-complexity-profile.test.cjs && node bin/model-complexity-profile.cjs --json | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); assert(d.profiles); assert(d.recommendations); assert(d.summary); console.log('OK: ' + d.summary.total_profiled + ' models profiled')"
  </verify>
  <done>
    model-complexity-profile.cjs produces valid JSON with profiles, recommendations (split/merge), and summary. All tests pass. Handles missing data sources gracefully.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire model-complexity-profile into nf-solve report</name>
  <files>
    bin/nf-solve.cjs
  </files>
  <action>
Add a "Model Complexity" informational section to nf-solve's text report output (in the `formatTextReport` function, after the "PRISM Priority" section around line 2731).

1. **In the report section (formatTextReport):**
   After the PRISM Priority block (~line 2731), add:
   ```
   // Model Complexity profile (informational)
   try {
     const profilePath = path.join(ROOT, '.planning', 'formal', 'model-complexity-profile.json');
     if (fs.existsSync(profilePath)) {
       const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
       lines.push('─ Model Complexity ─────────────────────────────');
       const s = profile.summary || {};
       lines.push('  Profiled: ' + (s.total_profiled || 0) + ' models');
       const byClass = s.by_runtime_class || {};
       lines.push('  Runtime: ' + (byClass.FAST || 0) + ' FAST, ' + (byClass.MODERATE || 0) + ' MOD, ' + (byClass.SLOW || 0) + ' SLOW, ' + (byClass.HEAVY || 0) + ' HEAVY');

       // Show split candidates
       const recs = profile.recommendations || {};
       if (recs.split_candidates && recs.split_candidates.length > 0) {
         lines.push('  Split candidates (' + recs.split_candidates.length + '):');
         for (const sc of recs.split_candidates.slice(0, 5)) {
           lines.push('    ↗ ' + sc.check_id + ' — ' + sc.reason);
         }
       }

       // Show merge candidates
       if (recs.merge_candidates && recs.merge_candidates.length > 0) {
         lines.push('  Merge candidates (' + recs.merge_candidates.length + '):');
         for (const mc of recs.merge_candidates.slice(0, 5)) {
           lines.push('    ↘ ' + mc.model_a + ' + ' + mc.model_b + ' — ' + mc.reason);
         }
       }
     }
   } catch (e) {
     // fail-open: complexity profile is informational
   }
   ```

2. **Run the profiler after run-formal-verify.cjs completes in sweepFtoC:**
   After the F->C sweep spawns run-formal-verify.cjs and before parsing check-results.ndjson (~line 1058), add a non-blocking call to generate the complexity profile:
   ```
   // Generate complexity profile from fresh check-results.ndjson + state-space data
   try {
     spawnTool('bin/model-complexity-profile.cjs', ['--quiet']);
   } catch (e) {
     // fail-open: profiler is informational
   }
   ```
   This ensures the profile is fresh whenever nf-solve runs.

3. **Also add to JSON output (formatJSON function ~line 3039):**
   After building the health object, read model-complexity-profile.json and include it:
   ```
   // Attach complexity profile summary if available
   let complexityProfile = null;
   try {
     const profilePath = path.join(ROOT, '.planning', 'formal', 'model-complexity-profile.json');
     if (fs.existsSync(profilePath)) {
       const raw = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
       complexityProfile = {
         summary: raw.summary,
         split_candidates: (raw.recommendations || {}).split_candidates || [],
         merge_candidates: (raw.recommendations || {}).merge_candidates || [],
       };
     }
   } catch (e) { /* fail-open */ }
   ```
   Then add `complexity_profile: complexityProfile` to the returned object.

All additions are fail-open (try/catch, informational only). The profiler's data feeds the report but does NOT affect residual counts or convergence.
  </action>
  <verify>
    grep -n 'model-complexity-profile' bin/nf-solve.cjs | head -10
    node bin/model-complexity-profile.cjs --quiet && node bin/nf-solve.cjs --report-only --max-iterations=1 --fast 2>/dev/null | grep -A5 'Model Complexity' || echo "Profile section present (or no data yet)"
  </verify>
  <done>
    nf-solve.cjs calls model-complexity-profile.cjs during F->C sweep, displays Model Complexity section in text report showing runtime classes and split/merge recommendations, and includes complexity_profile in JSON output. All changes are fail-open — missing profiler does not break solve.
  </done>
</task>

</tasks>

<verification>
- `node bin/model-complexity-profile.test.cjs` — all tests pass
- `node bin/model-complexity-profile.cjs --json` — produces valid JSON with profiles and recommendations
- `grep 'model-complexity-profile' bin/nf-solve.cjs` — confirms integration wiring
- `node bin/nf-solve.cjs --report-only --max-iterations=1 --fast --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('complexity_profile:', d.complexity_profile ? 'present' : 'absent')"` — confirms JSON output includes profile
</verification>

<success_criteria>
1. model-complexity-profile.cjs combines runtime and static complexity into a single profile
2. Profile classifies each model by runtime class (FAST/MODERATE/SLOW/HEAVY)
3. Split candidates identified (heavy models worth decomposing)
4. Merge candidates identified (fast models sharing requirements)
5. nf-solve report displays complexity section with actionable recommendations
6. All changes are fail-open — missing data degrades gracefully
7. All tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/226-track-formal-model-complexity-and-runtim/226-SUMMARY.md`
</output>
