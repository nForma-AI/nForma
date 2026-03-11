---
name: nf:proximity
description: Run the proximity graph pipeline — build graph, discover unlinked pairs, evaluate semantically, generate pairings
argument-hint: "[--rebuild] [--min-score N] [--max-hops N] [--top N] [--skip-eval] [--resolve]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

<objective>
Orchestrate the 5-step proximity pipeline. Build a semantic graph of model-requirement relationships, discover candidates with unmet links, evaluate using Haiku, compute semantic scores, and generate proximity pairings. Display progress and a summary dashboard showing metrics at each stage.
</objective>

<execution_context>
Self-contained pipeline of existing scripts. No external context needed.
</execution_context>

<process>

## Step 1: Parse arguments

Extract from `$ARGUMENTS`:
- `--rebuild` → force graph rebuild (delete existing proximity-index.json)
- `--min-score <N>` → minimum proximity score threshold (default: 0.6)
- `--max-hops <N>` → maximum graph hops for candidate discovery (default: 3)
- `--top <N>` → return only top N candidates by proximity score (default: 10, enforced by this skill — the underlying script defaults to no limit)
- `--skip-eval` → skip Haiku semantic evaluation step
- `--resolve` → suggest /nf:resolve at end of pipeline

Store parsed flags for use in downstream steps.

## Step 2: Build proximity graph

Run: `node bin/formal-proximity.cjs`

- **If graph exists and `--rebuild` NOT set:** Skip build, report cached graph stats: "Graph cached (N nodes, E edges, U orphans)"
- **If `--rebuild` is set:** Delete `.planning/formal/proximity-index.json` first, then run builder
- **Display:** Node count, edge count, orphan node count from builder output
- **On error:** Halt and display error message

Progress line: `[1/6] Building proximity graph...`

## Step 3: Discover candidates

Run: `node bin/candidate-discovery.cjs --min-score <val> --max-hops <val> --top <val> --json`

- Pass `--min-score` and `--max-hops` from parsed arguments
- If `--top` not specified by user, pass `--top 10` as default
- Display candidate count: "Found N candidates" (or "Showing top N of M candidates" when top is active)
- Display score distribution histogram (5 buckets: <0.4, 0.4-0.6, 0.6-0.8, 0.8-0.95, >=0.95)
- **On error:** Halt and display error message

Progress line: `[2/6] Discovering unlinked candidates...`

## Step 4: Haiku semantic evaluation

If `--skip-eval` is set:
- Report: "Skipped (--skip-eval)"
- Continue to step 5

Otherwise:
- Run: `node bin/haiku-semantic-eval.cjs`
- Display verdict distribution: "yes: X, no: Y, maybe: Z"
- **On error:** Halt and display error message

Progress line: `[3/6] Running semantic evaluation (Haiku)...`

## Step 5: Compute semantic scores

Run: `node bin/compute-semantic-scores.cjs --json`

- Display per-gate score summary (A, B, C scores)
- Show median, min, max for each gate
- **On error:** Halt and display error message

Progress line: `[4/6] Computing semantic scores...`

## Step 6: Generate pairings

Run: `node bin/candidate-pairings.cjs --json`

- Display pairing status summary:
  - Total pairings
  - Pending (not yet triaged)
  - Confirmed (accepted)
  - Rejected (dismissed)
- **On error:** Halt and display error message

Progress line: `[5/6] Generating candidate pairings...`

## Step 7: Summary dashboard

Consolidate all metrics into a formatted summary table:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Proximity Pipeline Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Graph             │  N nodes, E edges, U orphans
 Candidates        │  C total (score histogram)
 Evaluation        │  yes/no/maybe counts (or SKIPPED)
 Semantic Scores   │  Gate A/B/C ranges
 Pairings          │  P pending, Q confirmed, R rejected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If pending pairings > 0:**
Show: "→ Run /nf:resolve to triage P pending pairings"

**If `--resolve` flag was passed:**
Show: "→ Ready to triage. Run: /nf:resolve --source pairings"

Progress line: `[6/6] Generating summary...`

</process>

<notes>
- Each step runs via Bash. If any step exits non-zero, halt and display the error.
- Steps display progress indicators before each script invocation.
- The `--skip-eval` flag is useful when Haiku quota is exhausted or you want to rebuild without re-evaluating.
- The `--resolve` flag is a convenience — it suggests the exact /nf:resolve command to triage results.
- The `--top` flag defaults to 10 (enforced by this skill, not the script). The script itself defaults to no limit. Pass `--top 0` to bypass the skill default and see all candidates.
- All pipeline scripts are expected to exist in bin/ and produce JSON output (when --json is passed).
</notes>

</process>
