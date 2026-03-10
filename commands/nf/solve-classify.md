---
name: nf:solve-classify
description: Classification phase sub-skill for nf:solve — runs Haiku sub-agent to pre-classify all solve items as genuine/fp/review before human involvement
argument-hint: [--force]
allowed-tools:
  - Read
  - Bash
---

<objective>
Pre-classify all solve sweep items using Claude Haiku as a sub-agent before elevating
to human involvement. Uses per-item forever cache — only new/unclassified items are
sent to Haiku. Returns classification stats and updates solve-classifications.json.

This sub-skill can be invoked directly (`/nf:solve-classify`) or dispatched by the
`/nf:solve` orchestrator after the diagnostic phase.
</objective>

<execution_context>
AUTONOMY REQUIREMENT: This skill runs FULLY AUTONOMOUSLY. Do NOT ask the user
any questions. Do NOT stop for human input.

The classification uses `solve-tui.cjs` exports (resolved from `~/.claude/nf-bin/solve-tui.cjs` with CWD fallback to `./bin/solve-tui.cjs`):
- `loadSweepData()` — loads all 4 sweep categories
- `classifyWithHaiku(data, opts)` — classifies items via claude CLI subprocess
- `readClassificationCache()` — reads existing per-item cache
- `itemKey(catKey, item)` — generates stable cache keys

Cache file: `.planning/formal/solve-classifications.json`
Cache behavior: per-item forever — once classified, an item's verdict persists
until manually cleared with `--force`.
</execution_context>

<process>

## Step 1: Load sweep data and check cache

```bash
node -e "
const fs = require('fs');
const home = require('os').homedir();
const installed = require('path').join(home, '.claude/nf-bin/solve-tui.cjs');
const local = './bin/solve-tui.cjs';
const stPath = fs.existsSync(installed) ? installed : local;
if (!fs.existsSync(stPath)) { console.log(JSON.stringify({error:'solve-tui.cjs not found'})); process.exit(1); }
const st = require(stPath);
const data = st.loadSweepData();
const cache = st.readClassificationCache();

const counts = { total: 0, cached: 0 };
for (const k of ['dtoc','ctor','ttor','dtor']) {
  const items = data[k]?.items || [];
  const catCache = cache[k] || {};
  counts.total += items.length;
  for (const item of items) {
    if (catCache[st.itemKey(k, item)]) counts.cached++;
  }
}
counts.new = counts.total - counts.cached;
console.log(JSON.stringify(counts));
"
```

Parse the counts. Display:
```
Solve Classify: {total} items, {cached} cached, {new} to classify
```

If `new == 0` and `--force` was NOT passed:
- Display: "All items already classified. Use --force to reclassify."
- Output the result JSON with `status: "cached"` and skip to output.

## Step 2: Run Haiku classification

```bash
node -e "
const fs = require('fs');
const home = require('os').homedir();
const installed = require('path').join(home, '.claude/nf-bin/solve-tui.cjs');
const local = './bin/solve-tui.cjs';
const stPath = fs.existsSync(installed) ? installed : local;
if (!fs.existsSync(stPath)) { console.log(JSON.stringify({error:'solve-tui.cjs not found'})); process.exit(1); }
const st = require(stPath);
const data = st.loadSweepData();
const force = process.argv.includes('--force');
const result = st.classifyWithHaiku(data, { force });
const stats = result._stats || { cached: 0, classified: 0, failed: 0 };

// Count verdicts
const verdicts = { genuine: 0, fp: 0, review: 0 };
for (const k of ['dtoc','ctor','ttor','dtor']) {
  for (const v of Object.values(result[k] || {})) {
    if (verdicts[v] !== undefined) verdicts[v]++;
  }
}

console.log(JSON.stringify({ stats, verdicts }));
" $FLAGS
```

Parse the output. Display the classification summary:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Haiku Classification Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 [!] Genuine:  {genuine}
 [~] FP:       {fp}
 [?] Review:   {review}

 From cache: {cached} | Newly classified: {classified} | Failed: {failed}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

</process>

<output_contract>
Return a JSON object:
```json
{
  "status": "ok" | "cached" | "error",
  "verdicts": { "genuine": N, "fp": N, "review": N },
  "stats": { "cached": N, "classified": N, "failed": N },
  "reason": "..." // only if status == "error"
}
```
</output_contract>
