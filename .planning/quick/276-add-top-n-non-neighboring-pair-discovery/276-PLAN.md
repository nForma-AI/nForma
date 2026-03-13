---
phase: quick-276
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/candidate-discovery.cjs
  - commands/nf/proximity.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-276]

must_haves:
  truths:
    - "candidate-discovery.cjs accepts --non-neighbor-top <N> flag and defaults to 20"
    - "Zero-path pairs are ranked by coverage-gap heuristic and top N are included in output"
    - "Non-neighbor candidates have source: non_neighbor and proximity_score: 0.0"
    - "BFS candidates have source: graph"
    - "Metadata includes non_neighbor_count and non_neighbor_top fields"
    - "proximity.md Step 3 displays non-neighbor discovery count alongside graph candidates"
    - "proximity.md passes --non-neighbor-top flag through to candidate-discovery.cjs"
  artifacts:
    - path: "bin/candidate-discovery.cjs"
      provides: "Non-neighbor pair discovery with coverage-gap heuristic"
      exports: ["discoverCandidates"]
    - path: "commands/nf/proximity.md"
      provides: "Updated skill with non-neighbor flag support and display"
  key_links:
    - from: "commands/nf/proximity.md"
      to: "bin/candidate-discovery.cjs"
      via: "CLI invocation with --non-neighbor-top flag"
      pattern: "--non-neighbor-top"
    - from: "bin/candidate-discovery.cjs"
      to: "bin/formal-proximity.cjs"
      via: "require for BFS proximity function"
      pattern: "require.*formal-proximity"
---

<objective>
Add top-N non-neighboring pair discovery to the proximity pipeline. Currently, candidate-discovery.cjs only finds pairs reachable via BFS (proximity_score > threshold). Pairs with no graph path (score = 0) are invisible even when semantically suspicious. This plan adds a coverage-gap heuristic that surfaces the top N zero-path pairs ranked by how under-covered the model and requirement are.

Purpose: Surface blind spots in the proximity graph where models and requirements have no path but low coverage suggests a missing link.
Output: Updated candidate-discovery.cjs with non-neighbor discovery, updated proximity.md skill with flag passthrough and display.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/candidate-discovery.cjs
@commands/nf/proximity.md
@bin/formal-proximity.cjs (reference only — for proximity() API)
@.planning/formal/model-registry.json (reference only — for linkedReqs structure)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add non-neighbor discovery to candidate-discovery.cjs</name>
  <files>bin/candidate-discovery.cjs</files>
  <action>
Modify `bin/candidate-discovery.cjs` with these changes:

**A. Update `discoverCandidates()` function signature:**
- Add `nonNeighborTop` to opts (default: 20)
- Add `source: "graph"` field to every existing BFS candidate push (line ~70-74)

**B. After the main BFS loop (after line 77), add non-neighbor discovery block:**
- Collect all (modelPath, reqId) pairs where proximity_score was 0 OR proximity() returned null/NaN (i.e., no graph path). Track these during the BFS loop by recording zero-score pairs into a `zeroPairs` array.
- Implementation detail: inside the existing BFS loop, when score is 0 or null/NaN (and pair was not skipped for being already linked), push `{ model: modelPath, requirement: reqId }` to `zeroPairs` ONLY IF the pair does not already exist in the `candidates` array (i.e., not already discovered by BFS). This ensures non-neighbor discovery complements rather than duplicates graph-based discovery.
- After the BFS loop, compute coverage-gap heuristic for each zero pair:
  - `modelCoverage` = count of reqs linked to this model (from `linkedReqs` set for that model) + count of BFS candidates already found for this model (filter `candidates` by `.model === modelPath`)
  - `reqCoverage` = count of models linked to this req (scan all models in modelRegistry to count how many have this reqId in their requirements array) + count of BFS candidates already found for this req (filter `candidates` by `.requirement === reqId`)
  - `priority = 1/(modelCoverage+1) + 1/(reqCoverage+1)`
- **Guard clause:** If `nonNeighborTop <= 0`, skip the entire zero-pair collection and ranking block, and set `non_neighbor_count = 0` in metadata. This allows users to disable the feature via `--non-neighbor-top 0`.
- Sort zeroPairs by priority descending, take top `nonNeighborTop`
- **Deduplication guard:** Before pushing each non-neighbor candidate, verify the (model, requirement) pair does not already exist in `candidates`. Skip if duplicate found. This is a defensive check to prevent accidental duplicates even though the zeroPairs collection already filters.
- Push each selected pair into `candidates` array with `{ model, requirement, proximity_score: 0.0, source: "non_neighbor", priority: <rounded to 4 decimals> }`

**C. Update metadata object:**
- Add `non_neighbor_count: <number of non-neighbor candidates added>`
- Add `non_neighbor_top: nonNeighborTop`

**D. Pre-compute reqModelCount (REQUIRED step, not optional optimization):**
- Before entering the non-neighbor ranking loop, you MUST build a `Map<reqId, count>` by iterating `modelRegistry.models` once and counting how many models reference each reqId in their requirements array. This is mandatory to avoid O(N*M) scanning inside the ranking loop and must be computed before any priority calculations.

**E. Update `parseArgs()`:**
- Add `--non-neighbor-top` flag parsing (same pattern as `--max-hops`): `args.nonNeighborTop = 20` default, parse integer value.

**F. Update `printHelp()`:**
- Add `--non-neighbor-top <n>  Include top N non-neighboring pairs by coverage gap (default: 20)` line.

**G. Update `main()`:**
- Pass `nonNeighborTop: args.nonNeighborTop` into `discoverCandidates()` opts.
- After the score histogram block, add a stderr log for non-neighbor count: `[candidate-discovery] Added N non-neighbor candidates (top ${nonNeighborTop} by coverage gap)`

**H. Update histogram to handle non-neighbor candidates:**
- Add an explicit `'non_neighbor'` bucket label (NOT `'0.0'`) to the histogram for non-neighbor candidates. This bucket is distinct from the 0.6-1.0 graph candidate buckets. Display it as a separate line in the histogram output.

**Export:** `discoverCandidates` is already exported — no change needed. Update the existing JSDoc for `discoverCandidates()` to document: (a) the new `nonNeighborTop` parameter (type: number, default: 20, description: max non-neighbor pairs to include), and (b) that returned candidates now include a `source` field with values `'graph'` or `'non_neighbor'`.
  </action>
  <verify>
Run: `node bin/candidate-discovery.cjs --help` — confirm `--non-neighbor-top` appears in help output.
Run: `node bin/candidate-discovery.cjs --json --non-neighbor-top 5 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('nn_count:', d.metadata.non_neighbor_count, 'nn_top:', d.metadata.non_neighbor_top); const nn=d.candidates.filter(c=>c.source==='non_neighbor'); console.log('nn_candidates:', nn.length); const gr=d.candidates.filter(c=>c.source==='graph'); console.log('graph_candidates:', gr.length); if(nn.every(c=>c.proximity_score===0)) console.log('ALL_NN_ZERO_SCORE'); if(gr.every(c=>c.source==='graph')) console.log('ALL_GRAPH_TAGGED');"` — confirm non-neighbor candidates appear with score 0.0 and source "non_neighbor", graph candidates have source "graph".
  </verify>
  <done>
candidate-discovery.cjs discovers and includes top-N non-neighboring pairs ranked by coverage-gap heuristic. All candidates have a `source` field ("graph" or "non_neighbor"). Metadata includes `non_neighbor_count` and `non_neighbor_top`. The `--non-neighbor-top` CLI flag controls the count with default 20.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update proximity.md skill to pass and display non-neighbor flag</name>
  <files>commands/nf/proximity.md</files>
  <action>
Modify `commands/nf/proximity.md` with these changes:

**A. Step 1 (argument parsing):**
- Add `--non-neighbor-top <N>` to the extraction list with default 20.
- Update the `argument-hint` in the YAML frontmatter to include `[--non-neighbor-top N]`.

**B. Step 3 (discover candidates):**
- Update the command invocation to pass `--non-neighbor-top <val>` from parsed arguments.
- Update display to show: "Found N graph candidates + M non-neighbor candidates" by reading `metadata.candidates_found` minus `metadata.non_neighbor_count` for graph count, and `metadata.non_neighbor_count` for non-neighbor count.
- When `non_neighbor_count > 0`, add a line: "Non-neighbor pairs ranked by coverage gap (top <non_neighbor_top>)"

**C. Step 7 (summary dashboard):**
- Update the Candidates row to show breakdown: `C total (G graph + N non-neighbor)`
- Example: `Candidates  |  15 total (10 graph + 5 non-neighbor)`

**D. Notes section:**
- Add a note: "The `--non-neighbor-top` flag controls how many zero-path pairs are included based on coverage-gap ranking (default: 20). Pass `--non-neighbor-top 0` to disable non-neighbor discovery."
  </action>
  <verify>
Read `commands/nf/proximity.md` and confirm:
1. `--non-neighbor-top` appears in argument-hint frontmatter
2. Step 1 mentions `--non-neighbor-top` extraction
3. Step 3 command includes `--non-neighbor-top`
4. Step 3 display mentions "graph candidates + non-neighbor candidates"
5. Step 7 summary dashboard shows the breakdown format
6. Notes section mentions `--non-neighbor-top`
  </verify>
  <done>
proximity.md skill parses --non-neighbor-top flag, passes it through to candidate-discovery.cjs, and displays non-neighbor candidate counts in both the step progress output and the summary dashboard.
  </done>
</task>

</tasks>

<verification>
1. `node bin/candidate-discovery.cjs --help` shows `--non-neighbor-top` flag
2. `node bin/candidate-discovery.cjs --json --non-neighbor-top 5 2>&1` produces output with both graph and non-neighbor candidates, each with correct `source` field
3. `grep 'non-neighbor-top' commands/nf/proximity.md` returns matches in argument-hint, Step 1, Step 3, and notes
4. candidates.json metadata contains `non_neighbor_count` and `non_neighbor_top` fields after a run
</verification>

<success_criteria>
- candidate-discovery.cjs surfaces zero-path pairs ranked by coverage-gap heuristic
- All candidates carry a `source` field distinguishing graph from non-neighbor
- proximity.md skill displays non-neighbor stats and passes the flag through
- No regression in existing BFS candidate discovery behavior
</success_criteria>

<output>
After completion, create `.planning/quick/276-add-top-n-non-neighboring-pair-discovery/SUMMARY.md`
</output>
