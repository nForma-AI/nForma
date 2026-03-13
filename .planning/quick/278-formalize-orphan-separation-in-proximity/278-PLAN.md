---
phase: quick-278
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/candidate-discovery.cjs
  - commands/nf/proximity.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-278]

must_haves:
  truths:
    - "Non-neighbor pairs are stored in a separate orphans object, not in candidates array"
    - "Haiku eval and pairings generation only process graph-sourced candidates"
    - "Orphan counts appear in proximity pipeline summary dashboard"
    - "discoverCandidates() return shape includes orphans.models[] and orphans.requirements[]"
  artifacts:
    - path: "bin/candidate-discovery.cjs"
      provides: "Orphan separation in discoverCandidates()"
      contains: "orphans"
    - path: "commands/nf/proximity.md"
      provides: "Orphan display in summary dashboard"
      contains: "orphan"
  key_links:
    - from: "bin/candidate-discovery.cjs"
      to: ".planning/formal/candidates.json"
      via: "JSON.stringify + writeFileSync"
      pattern: "orphans"
    - from: "bin/haiku-semantic-eval.cjs"
      to: ".planning/formal/candidates.json"
      via: "data.candidates (unchanged — orphans excluded by structure)"
      pattern: "data\\.candidates"
    - from: "bin/candidate-pairings.cjs"
      to: ".planning/formal/candidates.json"
      via: "candidatesData.candidates (unchanged — orphans excluded by structure)"
      pattern: "candidatesData\\.candidates"
---

<objective>
Move non-neighbor pairs from the candidates[] array to a separate top-level orphans object in candidates.json output. This structurally excludes orphans from Haiku semantic evaluation and pairings generation (both read data.candidates), eliminating wasted API calls on pairs that consistently evaluate to "no".

Purpose: Non-neighbor pairs are artificial pairings of unrelated orphan models with orphan requirements. Current data shows 9/10 candidates are non-neighbor with 100% "no" verdicts. Separating them avoids Haiku eval waste and surfaces the real signal: which models and requirements lack ANY coverage.

Output: Updated candidate-discovery.cjs with orphan separation, updated proximity.md with orphan summary display.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/candidate-discovery.cjs
@bin/haiku-semantic-eval.cjs
@bin/candidate-pairings.cjs
@commands/nf/proximity.md
@.planning/formal/candidates.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Separate orphans from candidates in candidate-discovery.cjs</name>
  <files>bin/candidate-discovery.cjs</files>
  <action>
Modify the `discoverCandidates()` function to output orphans separately instead of pushing non-neighbor pairs into `candidates[]`.

**Changes to the non-neighbor discovery block (lines 203-256):**

Instead of pushing non-neighbor entries into `candidates[]`, build two orphan lists from the zero-path pairs:

1. After ranking zeroPairs by priority (existing logic), extract unique orphan entities:
   - `orphanModels[]` — unique model paths from zeroPairs where the model has 0 linked requirements (modelInfo.requirements is empty or length 0)
   - `orphanRequirements[]` — unique requirement IDs from zeroPairs where the requirement has empty formal_models (reqAlreadyCovered.get(reqId) === false)

2. Take top N of each list (using nonNeighborTop as the limit for each), preserving the coverage-gap priority ranking. For orphanModels, rank by: number of zeroPairs that reference this model (more pairs = more isolated = higher priority). For orphanRequirements, rank by: number of zeroPairs that reference this requirement.

3. Remove the loop at lines 241-255 that pushes into `candidates[]` with `source: 'non_neighbor'`.

4. Add an `orphans` object to the return value alongside `metadata` and `candidates`:

```javascript
return {
  metadata: { ... },  // existing, update non_neighbor_count to orphan counts
  candidates,          // now contains ONLY graph-sourced entries
  orphans: {
    models: orphanModels,       // Array of { path, zeroPairCount }
    requirements: orphanReqs,   // Array of { id, zeroPairCount }
  },
};
```

5. Update metadata fields:
   - Replace `non_neighbor_count` with `orphan_models_count` and `orphan_requirements_count`
   - Keep `non_neighbor_top` as the limit parameter

6. Update the score histogram logging (lines 363-376): Remove the `'non_neighbor'` bucket since non-neighbor entries no longer exist in candidates[].

7. Update the non-neighbor logging message (lines 379-381) to say "Found X orphan models, Y orphan requirements" instead of "Added N non-neighbor candidates".

8. Update the CLI `main()` function: After writing candidates.json, also log orphan counts.

9. Update `module.exports` — `discoverCandidates` is the only export, no change needed to the export itself.

**Do NOT modify:** bin/haiku-semantic-eval.cjs or bin/candidate-pairings.cjs — they read `data.candidates` which will now contain only graph entries. The orphans object is ignored by them automatically.
  </action>
  <verify>
Run: `node bin/candidate-discovery.cjs --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('candidates source check:', d.candidates.every(c => c.source === 'graph')); console.log('orphans present:', !!d.orphans); console.log('orphan models:', (d.orphans?.models||[]).length); console.log('orphan reqs:', (d.orphans?.requirements||[]).length);"`

Verify:
- All entries in candidates[] have source='graph' (no non_neighbor)
- orphans object exists with models[] and requirements[] arrays
- orphans arrays are non-empty (there ARE orphan entities in the codebase)
- candidates.json on disk reflects the new structure
  </verify>
  <done>
candidates.json has separate orphans object. candidates[] contains only graph-sourced pairs. Non-neighbor pairs no longer exist as candidate entries. Orphan models and requirements are surfaced as individual entities with zeroPairCount for prioritization.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add orphan display to proximity pipeline summary</name>
  <files>commands/nf/proximity.md</files>
  <action>
Update the `/nf:proximity` skill to display orphan information in the summary dashboard.

**Step 3 update (Discover candidates):**
- After running candidate-discovery, read orphans from the JSON output
- Change display from "Found N graph candidates + M non-neighbor candidates" to:
  "Found N graph candidates. Orphans: X models, Y requirements"
- Remove the "Non-neighbor pairs ranked by coverage gap" line since non-neighbor pairs no longer exist as candidates

**Step 7 update (Summary dashboard):**
- Add an Orphans row to the summary table between Candidates and Evaluation:

```
 Candidates        |  C total (graph-sourced only)
 Orphans           |  X models, Y requirements (no graph coverage)
 Evaluation        |  yes/no/maybe counts (or SKIPPED)
```

- Remove "(G graph + N non-neighbor)" from the Candidates line since all candidates are now graph-sourced. Just show "C candidates".

**Step 4 sub-agent fallback update:**
- In step 4b, the sub-agent fallback reads candidates.json. Since orphans are now in a separate key, no code change is needed — the fallback already iterates `candidates` array only. But update the step text to note: "Read `.planning/formal/candidates.json` and parse the candidates array (orphans are excluded from evaluation)."
  </action>
  <verify>
Read commands/nf/proximity.md and verify:
- Step 3 references orphan counts (not non-neighbor candidates)
- Step 7 summary dashboard includes an Orphans row
- No references to "non-neighbor candidates" remain (only "orphans")
- Step 4b mentions orphans exclusion
  </verify>
  <done>
Proximity pipeline summary displays orphan model and requirement counts. Non-neighbor terminology replaced with orphan terminology throughout the skill. Dashboard clearly separates graph candidates from orphaned entities.
  </done>
</task>

</tasks>

<verification>
1. Run full pipeline: `node bin/candidate-discovery.cjs --json` and confirm candidates.json structure
2. Confirm haiku-semantic-eval.cjs still works: `node bin/haiku-semantic-eval.cjs --dry-run` (reads data.candidates, should see fewer entries)
3. Confirm candidate-pairings.cjs still works: `node bin/candidate-pairings.cjs --json` (reads candidatesData.candidates)
4. Grep for residual 'non_neighbor' in candidates.json output to confirm clean separation
</verification>

<success_criteria>
- candidates.json contains zero entries with source='non_neighbor' in candidates[]
- candidates.json has top-level orphans object with models[] and requirements[] arrays
- Haiku eval and pairings scripts work unchanged (they only read data.candidates)
- Proximity skill summary shows orphan counts
</success_criteria>

<output>
After completion, create `.planning/quick/278-formalize-orphan-separation-in-proximity/SUMMARY.md`
</output>
