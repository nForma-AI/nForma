---
phase: quick-273
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/proximity.md
  - commands/nf/resolve.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-273]

must_haves:
  truths:
    - "/nf:proximity runs the 5-step pipeline (graph, candidates, eval, scores, pairings) and shows a summary dashboard"
    - "/nf:proximity --skip-eval skips the Haiku evaluation step"
    - "/nf:proximity --rebuild forces full graph rebuild"
    - "/nf:resolve auto-detects pending pairings alongside solve items in overview"
    - "/nf:resolve presents pairings with model/requirement/score/verdict and confirm/reject/skip actions"
    - "/nf:resolve --auto-confirm-yes batch-confirms yes-verdict pairings via resolve-pairings.cjs"
  artifacts:
    - path: "commands/nf/proximity.md"
      provides: "Pipeline runner skill for proximity graph"
      contains: "nf:proximity"
    - path: "commands/nf/resolve.md"
      provides: "Extended triage wizard with pairings support"
      contains: "candidate-pairings.json"
  key_links:
    - from: "commands/nf/proximity.md"
      to: "bin/formal-proximity.cjs"
      via: "Bash node invocation"
      pattern: "node bin/formal-proximity"
    - from: "commands/nf/proximity.md"
      to: "bin/candidate-pairings.cjs"
      via: "Bash node invocation"
      pattern: "node bin/candidate-pairings"
    - from: "commands/nf/resolve.md"
      to: ".planning/formal/candidate-pairings.json"
      via: "fs.readFileSync in temp script"
      pattern: "candidate-pairings\\.json"
    - from: "commands/nf/resolve.md"
      to: "bin/resolve-pairings.cjs"
      via: "require() in temp action script"
      pattern: "resolve-pairings"
---

<objective>
Create the `/nf:proximity` skill command and extend `/nf:resolve` with auto-detected proximity pairings as a unified data source.

Purpose: The v0.34 proximity pipeline scripts exist in bin/ but lack a skill to invoke them. Meanwhile /nf:resolve only handles solve items. This plan wires both together — proximity runs the pipeline, resolve triages the output alongside existing solve items.

Output: Two command files — one new (proximity.md), one modified (resolve.md).
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/resolve.md
@commands/nf/formal-test-sync.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /nf:proximity skill command</name>
  <files>commands/nf/proximity.md</files>
  <action>
Create `commands/nf/proximity.md` following the convention of `commands/nf/formal-test-sync.md` (simple command file that shells out to bin scripts).

Frontmatter:
```yaml
name: nf:proximity
description: Run the proximity graph pipeline — build graph, discover unlinked pairs, evaluate semantically, generate pairings
argument-hint: "[--rebuild] [--min-score N] [--max-hops N] [--skip-eval] [--resolve]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
```

Objective: Orchestrate the 5-step proximity pipeline, showing progress and a summary dashboard.

Execution context: None required — self-contained pipeline of existing scripts.

Process (7 steps):

1. **Parse args** from $ARGUMENTS: `--rebuild` (force graph rebuild), `--min-score` (default 0.6), `--max-hops` (default 3), `--skip-eval` (skip Haiku LLM call), `--resolve` (suggest /nf:resolve at end).

2. **Build graph** — Run `node bin/formal-proximity.cjs`. If `.planning/formal/proximity-index.json` exists and `--rebuild` is NOT set, skip this step and report "Graph cached (N nodes, E edges)". If `--rebuild`, delete `proximity-index.json` first. Display node/edge/orphan counts from output.

3. **Discover candidates** — Run `node bin/candidate-discovery.cjs --min-score <val> --max-hops <val> --json`. Display candidate count and score histogram.

4. **Haiku evaluation** — If `--skip-eval` is set, skip this step and report "Skipped (--skip-eval)". Otherwise run `node bin/haiku-semantic-eval.cjs`. Display verdict distribution (yes/no/maybe counts).

5. **Compute semantic scores** — Run `node bin/compute-semantic-scores.cjs --json`. Display per-gate score summary.

6. **Generate pairings** — Run `node bin/candidate-pairings.cjs --json`. Display pending/confirmed/rejected counts.

7. **Summary dashboard** — Formatted table consolidating all pipeline metrics. If pending pairings > 0, suggest: "Run /nf:resolve to triage N pending pairings". If `--resolve` flag was passed, explicitly tell user to run `/nf:resolve`.

Key behaviors to document in the process:
- Each step runs via Bash. If any step exits non-zero, halt and display the error.
- Steps should display a progress indicator line before each script invocation (e.g., "[2/6] Discovering candidates...").
- The `--skip-eval` flag is useful when Haiku quota is exhausted.
  </action>
  <verify>
Verify the file exists and has correct structure:
- `grep 'name: nf:proximity' commands/nf/proximity.md` returns match
- `grep 'formal-proximity' commands/nf/proximity.md` returns match (step 2)
- `grep 'candidate-discovery' commands/nf/proximity.md` returns match (step 3)
- `grep 'haiku-semantic-eval' commands/nf/proximity.md` returns match (step 4)
- `grep 'compute-semantic-scores' commands/nf/proximity.md` returns match (step 5)
- `grep 'candidate-pairings' commands/nf/proximity.md` returns match (step 6)
- `grep 'skip-eval' commands/nf/proximity.md` returns match
- `grep 'rebuild' commands/nf/proximity.md` returns match
- Frontmatter has YAML fences, name, description, argument-hint, allowed-tools
  </verify>
  <done>
commands/nf/proximity.md exists with valid frontmatter and a 7-step process that invokes all 5 pipeline scripts in order, handles --rebuild/--skip-eval/--min-score/--max-hops/--resolve flags, and shows a summary dashboard.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend /nf:resolve with auto-detected pairings</name>
  <files>commands/nf/resolve.md</files>
  <action>
Modify `commands/nf/resolve.md` to auto-detect proximity pairings alongside solve items. Changes are additive — all existing solve item logic stays intact.

**2a. Frontmatter** — Update argument-hint line to:
```
argument-hint: "[--source solve|pairings] [--category dtoc|ctor|ttor|dtor] [--verdict genuine|review|unclassified] [--limit N] [--auto-confirm-yes] [--auto-reject-no]"
```

**2b. Step 1 — Extend data loading script** — In the `/private/tmp/nf-resolve-load.cjs` code block, AFTER the existing `console.log(JSON.stringify({ summary, archived: archive.entries.length }));` line, add pairings loading:

```javascript
// Load pairings if file exists
const PAIRINGS_PATH = path.join(process.cwd(), '.planning', 'formal', 'candidate-pairings.json');
let pairingSummary = { total: 0, pending: 0, confirmed: 0, rejected: 0, byVerdict: {} };
if (fs.existsSync(PAIRINGS_PATH)) {
  const pd = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
  const pending = pd.pairings.filter(p => p.status === 'pending');
  const byVerdict = { yes: 0, no: 0, maybe: 0 };
  for (const p of pending) byVerdict[p.verdict || 'maybe']++;
  pairingSummary = { total: pd.pairings.length, pending: pending.length,
    confirmed: pd.metadata.confirmed, rejected: pd.metadata.rejected, byVerdict };
}
```

Update the console.log to output both: `console.log(JSON.stringify({ summary, archived: archive.entries.length, pairings: pairingSummary }));`

Add `const path = require('path');` and `const fs = require('fs');` at top of the script (fs may already be available via solve-tui, but be explicit).

**2c. Step 1 — Extend overview display** — Add parsing for `--source` flag (optional filter: solve|pairings). Update the overview dashboard to show both sections:

```
 -- Solve Items --
 D->C Broken Claims:   X genuine, Y review, Z unclassified
 ...

 -- Proximity Pairings --
 Pending:  P (X yes, Y maybe, Z no)
 Resolved: Q confirmed, R rejected
```

If `--source solve` -> only show solve section. If `--source pairings` -> only show pairings section. Default: show both. Update the header to "N items + P pairings to triage".

**2d. Step 2 — Extend queue builder** — In the `/private/tmp/nf-resolve-queue.cjs` code block, AFTER the existing solve queue logic, add pairings to the queue:

```javascript
// After existing solve queue...
if (source !== 'solve') {
  const PAIRINGS_PATH = path.join(process.cwd(), '.planning', 'formal', 'candidate-pairings.json');
  if (fs.existsSync(PAIRINGS_PATH)) {
    const pd = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
    const pairings = pd.pairings.filter(p => p.status === 'pending').map(p => ({
      _source: 'pairing', type: 'pairing',
      model: p.model, requirement: p.requirement,
      proximity_score: p.proximity_score, verdict: p.verdict,
      confidence: p.confidence, reasoning: p.reasoning,
      summary: `${require('path').basename(p.model)} <-> ${p.requirement} (${p.verdict}, score=${p.proximity_score.toFixed(2)})`,
    }));
    // Sort: yes -> maybe -> no, by score desc within each group
    const verdictOrder = { yes: 0, maybe: 1, no: 2 };
    pairings.sort((a, b) => (verdictOrder[a.verdict] || 1) - (verdictOrder[b.verdict] || 1) || b.proximity_score - a.proximity_score);
    queue.push(...pairings);
  }
}
```

Solve items come first (broken things), pairings after (enrichment).

**2e. Step 3 — Add pairing presentation format** — Add a new subsection after the existing "For each item" block. When `item._source === 'pairing'`, use this display format:

```
Item N/Total -- Proximity Pairing

 Model:       [item.model basename]
 Requirement: [item.requirement] -- "[requirement description from requirements.json]"
 Proximity:   [score]  |  Verdict: [verdict]
 Reasoning:   [item.reasoning]

-- Recommendation --
 Haiku says [VERDICT] with proximity [SCORE]
 -> [Confirm if yes+high score / Review if maybe / Likely reject if no]

   [c] Confirm  [r] Reject  [s] Skip  [q] Quit
```

For evidence gathering: read requirement text from `.planning/formal/requirements.json` (search by ID) and model metadata from `.planning/formal/model-registry.json`.

**2f. Step 3e — Add pairing actions** — Add pairing-specific action handling after the existing action section:

When item._source === 'pairing':
- **Confirm (c)**: Write temp script to `/private/tmp/nf-resolve-action.cjs` that requires `resolve-pairings.cjs` and calls `confirmPairing(pairing, registry)`. The script should load candidate-pairings.json, find the matching pairing by model+requirement, load model-registry.json, call confirmPairing(), then write both files back.
- **Reject (r)**: Similar temp script calling `rejectPairing(pairing)`, writes pairings file back.
- **Skip (s)**: No-op, continue to next item.
- **Quit (q)**: Save progress, show summary.

**2g. Step 4 — Extend session summary** — Add a pairings section to the session summary:

```
 -- Pairings --
 Confirmed:   X (written to model-registry)
 Rejected:    Y (cached)
 Skipped:     Z
```

Track pairing counters (pairingsConfirmed, pairingsRejected, pairingsSkipped) alongside existing solve counters.

**2h. Add batch mode section** — Add a new step between arg parsing and the overview. If `--auto-confirm-yes` or `--auto-reject-no` flags are present AND source includes pairings:
- Shell out directly: `node bin/resolve-pairings.cjs --auto-confirm-yes` (or `--auto-reject-no`)
- Display result counts from output
- Then continue with interactive solve items if any remain

IMPORTANT: Keep ALL existing solve item logic exactly as-is. The pairings additions are purely additive — new code blocks appended to existing steps, new subsections added alongside existing ones.
  </action>
  <verify>
Verify the modifications:
- `grep 'source solve|pairings' commands/nf/resolve.md` confirms --source flag in frontmatter
- `grep 'auto-confirm-yes' commands/nf/resolve.md` confirms batch flag in frontmatter
- `grep 'candidate-pairings.json' commands/nf/resolve.md` confirms pairings loading
- `grep '_source.*pairing' commands/nf/resolve.md` confirms pairing detection in presentation
- `grep 'confirmPairing' commands/nf/resolve.md` confirms confirm action
- `grep 'rejectPairing' commands/nf/resolve.md` confirms reject action
- `grep 'resolve-pairings.cjs' commands/nf/resolve.md` confirms batch mode
- `grep 'Proximity Pairings' commands/nf/resolve.md` confirms overview section
- All existing solve item process steps remain intact (check Step 1-4 headers still present)
- Frontmatter still has name: nf:resolve and all original allowed-tools
  </verify>
  <done>
commands/nf/resolve.md extended with: (1) --source and --auto-confirm-yes/--auto-reject-no in frontmatter, (2) pairings loading in Step 1, (3) unified overview showing both solve items and pairings, (4) pairings appended to queue in Step 2, (5) pairing-specific presentation format in Step 3, (6) confirm/reject actions using resolve-pairings.cjs exports, (7) extended session summary with pairing counters, (8) batch mode for auto-confirm/reject. All existing solve item logic unchanged.
  </done>
</task>

</tasks>

<verification>
- `commands/nf/proximity.md` exists with valid YAML frontmatter and 7-step process
- `commands/nf/resolve.md` retains all original functionality plus pairings extensions
- No bin/*.cjs files were modified (all logic already exported)
- Proximity skill references all 5 pipeline scripts by correct path
- Resolve skill references candidate-pairings.json and resolve-pairings.cjs correctly
</verification>

<success_criteria>
- /nf:proximity can be invoked and runs the 5-step pipeline with progress reporting
- /nf:proximity --skip-eval skips step 4, --rebuild forces step 2
- /nf:resolve overview shows both solve items and pending pairings
- /nf:resolve presents pairings with model/requirement/score/verdict format
- /nf:resolve confirm/reject actions call resolve-pairings.cjs exports
- /nf:resolve --auto-confirm-yes batch-confirms without interactive loop
- /nf:resolve --source pairings filters to pairings only
</success_criteria>

<output>
After completion, create `.planning/quick/273-create-nf-proximity-skill-and-extend-nf-/SUMMARY.md`
</output>
