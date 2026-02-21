---
phase: quick-34
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quorum-scoreboard.json
  - bin/update-scoreboard.cjs
  - commands/qgsd/quorum.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "quorum-scoreboard.json has a top-level `categories` object with all 5 parent categories and their subcategory arrays"
    - "Each round entry in `rounds` may carry `category` and `subcategory` string fields"
    - "update-scoreboard.cjs accepts --category and --subcategory flags; when omitted it calls Haiku to auto-classify using the task label and --task-description"
    - "Haiku can propose a new category name that gets added dynamically to the categories map"
    - "quorum.md scoreboard update calls pass --task-description with the debate question/topic so Haiku has content to classify"
  artifacts:
    - path: ".planning/quorum-scoreboard.json"
      provides: "taxonomy definition + category fields on rounds"
      contains: "\"categories\""
    - path: "bin/update-scoreboard.cjs"
      provides: "CLI extension with Haiku auto-classification"
      exports: ["main"]
    - path: "commands/qgsd/quorum.md"
      provides: "updated scoreboard update instructions passing --task-description"
  key_links:
    - from: "commands/qgsd/quorum.md"
      to: "bin/update-scoreboard.cjs"
      via: "--task-description flag in bash snippet"
      pattern: "task-description"
    - from: "bin/update-scoreboard.cjs"
      to: ".planning/quorum-scoreboard.json"
      via: "Haiku classify → merge into categories + write round entry"
      pattern: "categories"
---

<objective>
Add debate category metadata to the quorum scoreboard system.

Purpose: Track what domain each quorum debate covers (Technical, Quantitative, Professional, Product, Data), enabling future analytics on which domains generate the most disagreement, which models excel in which areas, and where quorum overhead is concentrated.

Output:
- `quorum-scoreboard.json` gains a `categories` taxonomy object and per-round `category`/`subcategory` fields
- `update-scoreboard.cjs` gains `--task-description`, `--category`, `--subcategory` flags with Haiku auto-classification fallback
- `quorum.md` updated so scoreboard update calls include `--task-description` to feed Haiku
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quorum-scoreboard.json
@bin/update-scoreboard.cjs
@commands/qgsd/quorum.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add taxonomy to scoreboard JSON and extend update-scoreboard.cjs with category flags + Haiku auto-classification</name>
  <files>
    .planning/quorum-scoreboard.json
    bin/update-scoreboard.cjs
  </files>
  <action>
**Part A — .planning/quorum-scoreboard.json**

Add a top-level `"categories"` key immediately after `"models"`, before `"rounds"`. The value is an object mapping each parent category name to an array of subcategory strings:

```json
"categories": {
  "Technical / Engineering": [
    "Basic programming",
    "Algorithms & data structures",
    "Backend coding (APIs, DB, services)",
    "Frontend coding (UI, React/JS, CSS)",
    "Full-stack web apps",
    "DevOps & infrastructure (CI/CD, Docker, K8s)",
    "Cloud platforms (AWS, GCP, Azure)",
    "Systems programming (C/C++, Rust)",
    "Data engineering & ETL",
    "ML engineering & MLOps",
    "Security & secure coding"
  ],
  "Quantitative / Business": [
    "Arithmetic & basic numeracy",
    "School-level math (algebra, geometry, calculus)",
    "Competition/advanced math",
    "Statistics & probability",
    "Accounting (bookkeeping, GAAP/IFRS concepts)",
    "Corporate finance (valuation, capital structure)",
    "Financial analysis & modeling (ratios, DCF)",
    "Trading & quantitative finance",
    "Tax (personal and corporate)",
    "Actuarial style problems"
  ],
  "Professional Domains": [
    "Law (contracts, case summaries)",
    "Medicine & clinical reasoning",
    "Nursing & allied health",
    "Pharma & biomedical research",
    "Insurance (policies, claims)",
    "Real estate (valuation, contracts)",
    "Supply chain & operations",
    "HR & people operations",
    "Marketing & advertising",
    "Customer support / ticket resolution"
  ],
  "Product & Content": [
    "Technical writing & documentation",
    "API design & documentation",
    "UX writing & microcopy",
    "Product management (PRDs, specs)",
    "Creative writing (stories, scripts)",
    "Business communication (emails, reports)",
    "Education & tutoring (explanations, exercises)"
  ],
  "Data / Knowledge Work": [
    "Information extraction from documents",
    "Table & spreadsheet reasoning",
    "Document summarization (reports, legal, financial)",
    "Search/RAG QA over domain corpora",
    "Analytics & BI explanation (dashboards, metrics)"
  ]
}
```

Existing `"models"` and `"rounds"` keys are preserved verbatim. Do NOT modify any existing round entries — they will not have `category`/`subcategory` fields (that is acceptable; only new entries from this point forward carry those fields).

**Part B — bin/update-scoreboard.cjs**

1. **New CLI flags**: Add three optional flags to the parser and validation:
   - `--task-description <string>` — the debate question/topic text; used as Haiku input when category not supplied
   - `--category <string>` — explicit parent category; skips Haiku if provided
   - `--subcategory <string>` — explicit subcategory; skips Haiku if provided

   Both `--category` and `--subcategory` are optional. If neither is supplied but `--task-description` is present, trigger Haiku auto-classification. If none of the three are provided, write the round entry without category fields (silent skip — backward compatible).

2. **Haiku auto-classification function**: Add `classifyWithHaiku(taskDescription, categories)` function that:
   - Uses the `@anthropic-ai/sdk` package (already in package.json — check first; if absent use `child_process.spawnSync` to call `npx claude` as fallback — but check package.json first)
   - Builds a prompt listing all category/subcategory options from the `categories` map and asks Haiku to return JSON: `{ "category": "...", "subcategory": "...", "is_new": false }` or `{ "category": "New Category Name", "subcategory": "New Subcategory Name", "is_new": true }`
   - Uses model `claude-haiku-4-5-20251001`
   - Wraps in try/catch — on any error, returns `null` (silent skip, do not block scoreboard write)
   - Prompt template:
     ```
     You are classifying a quorum debate topic into a category taxonomy.

     Debate topic: {taskDescription}

     Taxonomy:
     {formatted list of category: [subcategory, ...]}

     Return ONLY valid JSON (no markdown, no explanation):
     {"category": "<parent category name>", "subcategory": "<subcategory name>", "is_new": false}

     If the topic does not match any existing category or subcategory well, propose new names:
     {"category": "<new parent name>", "subcategory": "<new subcategory name>", "is_new": true}

     Choose the single best match. Return nothing except the JSON object.
     ```

3. **SDK detection**: Before using `@anthropic-ai/sdk`, check if it is importable via `require.resolve('@anthropic-ai/sdk')` in a try/catch. If not available, return `null` from `classifyWithHaiku` (skip silently).

4. **Dynamic category merge**: After classification returns (non-null), if `is_new` is true, add the new category/subcategory to `data.categories` before writing. If `is_new` is false but the returned category exists in `data.categories` and the subcategory is not in the array yet (Haiku hallucinated a variant), append the subcategory string.

5. **Round entry extension**: When a round entry is created or updated (both the `existingIdx !== -1` branch and the `push` branch), if `category` and `subcategory` are resolved (either from flags or from Haiku), set `round.category = resolvedCategory` and `round.subcategory = resolvedSubcategory` on the entry object.

6. **`loadData` function update**: When loading existing JSON, ensure `data.categories` exists — if missing, initialize it as `{}` (backward compat for files that predate this change). The taxonomy seeding is handled separately in Part A (not in loadData).

7. **`emptyData` function update**: Add `categories: {}` to the returned object so fresh scoreboards start with an empty categories map. The actual taxonomy is seeded from the JSON file directly (Part A), not from emptyData.

8. **USAGE string update**: Add the three new flags to the USAGE constant so `--help` output reflects them.

9. **Confirmation output update**: Append ` | category: {category} > {subcategory}` to the confirmation line printed to stdout when category was resolved. When category was not resolved (no flags, no description, or Haiku failed), omit this suffix (keep existing format).

**Implementation note on SDK**: Check `package.json` to confirm `@anthropic-ai/sdk` is present. If it is, use it directly with `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`. The API key is always available in the Claude Code environment via `process.env.ANTHROPIC_API_KEY`.
  </action>
  <verify>
    1. `node bin/update-scoreboard.cjs --help 2>&1 | grep task-description` should show the flag in usage
    2. `node -e "const d = require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8'); const j = JSON.parse(d); console.log(Object.keys(j.categories).length)"` should output `5`
    3. `node -e "const d = require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8'); const j = JSON.parse(d); console.log(j.categories['Technical / Engineering'].length)"` should output `11`
    4. Existing round entries are still present and unchanged: `node -e "const j = JSON.parse(require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8')); console.log(j.rounds.length)"` should equal the pre-edit count (42 rounds)
    5. Test explicit category flag: `node bin/update-scoreboard.cjs --model claude --result TP --task "test-category-34" --round 1 --verdict APPROVE --category "Technical / Engineering" --subcategory "Basic programming"` — exits 0, confirmation includes "Technical / Engineering"
    6. Verify the test round entry was written with category field: `node -e "const j = JSON.parse(require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8')); const r = j.rounds.find(r => r.task === 'test-category-34'); console.log(r.category, r.subcategory)"` should print `Technical / Engineering Basic programming`
    7. Remove the test entry after verification by re-reading the JSON, filtering out the test entry, and writing back — or simply note it as a test artifact (acceptable in scoreboard)
  </verify>
  <done>
    - `quorum-scoreboard.json` has `categories` object with 5 parent keys and correct subcategory counts
    - Existing 42 round entries are intact with no modifications
    - `update-scoreboard.cjs` accepts `--category`, `--subcategory`, `--task-description` flags
    - Explicit `--category` + `--subcategory` pass through to the round entry
    - Haiku classification function exists (SDK-guarded, returns null on failure)
    - `emptyData()` includes `categories: {}`
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quorum.md to pass --task-description to scoreboard update calls</name>
  <files>
    commands/qgsd/quorum.md
  </files>
  <action>
In `commands/qgsd/quorum.md`, there are three places where the `node bin/update-scoreboard.cjs` bash snippet appears (Step 6 consensus output, Step 7 escalation, and Mode B Step 6 verdict output). Each currently shows:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT>
```

Update all three occurrences to add `--task-description` carrying the debate question/topic:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT> \
  --task-description "<question or topic being debated>"
```

For Mode A (Steps 6 and 7): the description placeholder is `"<question or topic being debated>"` — in practice this is the content of the `[question]` variable that the executor uses as the debate topic. Add a note below each snippet:

> `--task-description`: the full debate question/topic (the `[question]` value). Used by Haiku to auto-classify the category. Omit if the question is too long (>500 chars) — use a shortened summary instead.

For Mode B (Step 6): the description placeholder is `"<debate topic from $ARGUMENTS>"` with a note:

> `--task-description`: a brief description of what was being verified/reviewed (from `$ARGUMENTS` or a short summary). Used by Haiku to auto-classify. Optional — omit if not meaningful.

Do not change any other content in quorum.md. The `--result`, `--task`, `--round`, `--verdict` documentation below each snippet is unchanged.
  </action>
  <verify>
    1. `grep -c "task-description" commands/qgsd/quorum.md` should output `6` (3 bash snippets × 1 flag each + 3 note lines = 6 occurrences minimum; accept 6+)
    2. `grep "task-description" commands/qgsd/quorum.md` shows the flag in all three bash snippets
    3. The file still renders valid markdown: no broken code fences, no missing step headings — visually scan the three affected sections
  </verify>
  <done>
    All three `node bin/update-scoreboard.cjs` bash snippets in quorum.md include `--task-description` with a placeholder and explanatory note. No other content changed.
  </done>
</task>

</tasks>

<verification>
1. JSON structure check: `node -e "const j = JSON.parse(require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8')); console.log(JSON.stringify({hasCats: !!j.categories, catCount: Object.keys(j.categories).length, roundCount: j.rounds.length}))"` — expect `{"hasCats":true,"catCount":5,"roundCount":42}` (or 43 if test round kept)
2. CLI smoke test with category: `node bin/update-scoreboard.cjs --model claude --result TP --task "cat-smoke-34" --round 1 --verdict APPROVE --category "Product & Content" --subcategory "Technical writing & documentation"` — exits 0, prints confirmation with category
3. Verify round entry: `node -e "const j = JSON.parse(require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8')); const r = j.rounds.find(r => r.task === 'cat-smoke-34'); console.log(r)"` — shows `category` and `subcategory` fields
4. Backward compat: existing round entries (e.g. `quick-2: R3.6 rule`) do NOT have `category`/`subcategory` fields — `node -e "const j = JSON.parse(require('fs').readFileSync('.planning/quorum-scoreboard.json','utf8')); const r = j.rounds[0]; console.log('category' in r)"` outputs `false`
5. quorum.md check: `grep -c "task-description" commands/qgsd/quorum.md` outputs ≥ 6
</verification>

<success_criteria>
- `quorum-scoreboard.json` has a `categories` object with 5 parent categories and correct subcategory arrays, with all existing round data intact
- `update-scoreboard.cjs` supports `--category`, `--subcategory`, `--task-description`; explicit flags write category to the round entry; Haiku classification fires when `--task-description` given without `--category`/`--subcategory`; all failures are silent (fail-open)
- `quorum.md` scoreboard update snippets include `--task-description` in all 3 locations
- All existing scoreboard functionality (score computation, model stats, existing round formats) is unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/34-add-debate-category-metadata-to-quorum-s/34-SUMMARY.md`
</output>
