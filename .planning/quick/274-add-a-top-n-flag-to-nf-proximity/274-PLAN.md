---
phase: quick-274
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/candidate-discovery.cjs
  - commands/nf/proximity.md
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Running candidate-discovery.cjs with --top 10 returns at most 10 candidates"
    - "Default behavior (no --top flag) returns all candidates as before; the skill enforces --top 10 default, not the script"
    - "The proximity.md skill documents and passes --top N to candidate-discovery.cjs"
    - "Bounds check: truncation only applies when args.top > 0 AND args.top < candidates.length"
  artifacts:
    - path: "bin/candidate-discovery.cjs"
      provides: "--top N CLI flag, truncates sorted candidates"
      contains: "--top"
    - path: "commands/nf/proximity.md"
      provides: "--top N flag documentation and passthrough"
      contains: "--top"
  key_links:
    - from: "commands/nf/proximity.md"
      to: "bin/candidate-discovery.cjs"
      via: "Bash invocation with --top flag"
      pattern: "--top"
---

<objective>
Add a --top N flag to the proximity pipeline that caps candidate output to the top N results by proximity score. Default: 10.

Purpose: With low thresholds or high hop counts, discovery returns thousands of candidates (e.g., 8,647). The --top flag makes output practical by showing only the highest-scoring pairs.
Output: Updated candidate-discovery.cjs with --top support, updated proximity.md skill with --top documentation and passthrough.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/candidate-discovery.cjs
@commands/nf/proximity.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add --top N flag to candidate-discovery.cjs</name>
  <files>bin/candidate-discovery.cjs</files>
  <action>
In `parseArgs()`:
- Add `top: null` to the default args object (null means "no limit" — return all candidates)
- Add parsing for `--top` flag following the same pattern as `--max-hops`: `else if (argv[i].startsWith('--top')) { const val = argv[i].includes('=') ? argv[i].split('=')[1] : argv[++i]; args.top = parseInt(val, 10); }`

In `printHelp()`:
- Add line: `  --top <n>       Return only top N candidates by score (default: all)`

In `main()`, after calling `discoverCandidates()` and before writing candidates.json:
- If `args.top` is a positive integer AND `args.top < result.candidates.length` (defensive bounds check — skip slicing when top is 0 or >= the result set size), slice `result.candidates` to `result.candidates.slice(0, args.top)` and update `result.metadata.candidates_found` to reflect the truncated count. Add `result.metadata.top` field set to `args.top`. Also add `result.metadata.candidates_before_top` with the pre-truncation count so the user knows how many were discovered total.
- The histogram logging (lines 172-184) should run BEFORE the top-N truncation so the user sees the full distribution.
- After truncation, log to stderr: `[candidate-discovery] Showing top ${args.top} of ${beforeCount} candidates`

The candidates are already sorted by proximity_score descending (line 79-85), so slicing gives the top N automatically.
  </action>
  <verify>
Run `node bin/candidate-discovery.cjs --help` and confirm --top appears in help text.
Run `node bin/candidate-discovery.cjs --min-score 0.3 --max-hops 6 --top 5 --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('count:', d.candidates.length, 'top:', d.metadata.top); process.exit(d.candidates.length <= 5 ? 0 : 1)"` — exits 0.
  </verify>
  <done>--top N flag parses correctly, truncates candidates to N, metadata includes top and candidates_before_top fields, full histogram still logged before truncation.</done>
</task>

<task type="auto">
  <name>Task 2: Update proximity.md skill to support --top flag</name>
  <files>commands/nf/proximity.md</files>
  <action>
In the YAML frontmatter:
- Update `argument-hint` to include `[--top N]`: `"[--rebuild] [--min-score N] [--max-hops N] [--top N] [--skip-eval] [--resolve]"`

In Step 1 (Parse arguments):
- Add: `- \`--top <N>\` → return only top N candidates by proximity score (default: 10, enforced by this skill — the underlying script defaults to no limit)`

In Step 3 (Discover candidates):
- Update the Run command to pass `--top`: `Run: \`node bin/candidate-discovery.cjs --min-score <val> --max-hops <val> --top <val> --json\``
- Add note: "If --top not specified by user, pass --top 10 as default"
- Update display to show: "Showing top N of M candidates" when top is active

In the notes section:
- Add: `- The \`--top\` flag defaults to 10 (enforced by this skill, not the script). The script itself defaults to no limit. Pass \`--top 0\` to bypass the skill default and see all candidates.`
  </action>
  <verify>Read the updated commands/nf/proximity.md and confirm --top appears in frontmatter argument-hint, Step 1 parsing, Step 3 invocation, and notes section.</verify>
  <done>proximity.md documents --top flag with default 10, passes it through to candidate-discovery.cjs in Step 3, and notes explain the flag.</done>
</task>

</tasks>

<verification>
1. `node bin/candidate-discovery.cjs --help` shows --top in usage
2. `node bin/candidate-discovery.cjs --top 3 --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.candidates.length)"` prints 3 or fewer
3. `grep -- '--top' commands/nf/proximity.md` returns multiple matches (argument-hint, parsing, invocation, notes)
</verification>

<success_criteria>
- candidate-discovery.cjs accepts --top N and returns at most N candidates
- Default behavior without --top is unchanged (all candidates returned)
- proximity.md skill documents --top with default 10 and passes it to the script
- Metadata in JSON output includes top count and pre-truncation count
</success_criteria>

<output>
After completion, create `.planning/quick/274-add-a-top-n-flag-to-nf-proximity/274-SUMMARY.md`
</output>
