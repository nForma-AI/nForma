---
phase: quick-238
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-stop.js
  - hooks/dist/nf-stop.js
  - bin/compute-per-model-gates.cjs
  - bin/solve-tui.cjs
  - bin/formalization-candidates.cjs
  - bin/nf-solve.cjs
  - .planning/formal/promotion-changelog.json
autonomous: true
formal_artifacts:
  create:
    - path: .planning/formal/promotion-changelog.json
      type: alloy
      description: "Structured log of gate promotions and demotions"
requirements: [GATE-01, GATE-02, GATE-03, GATE-04]

must_haves:
  truths:
    - "Evidence files are refreshed at the end of every session via the Stop hook"
    - "Gate promotions and demotions are logged to a structured changelog"
    - "TUI displays recent promotions from the changelog"
    - "Formalization candidates are ranked by churn x trace density / model coverage"
    - "Models are automatically demoted when evidence quality regresses below threshold"
  artifacts:
    - path: "hooks/nf-stop.js"
      provides: "Always-on evidence refresh at session end"
      contains: "refresh-evidence"
    - path: ".planning/formal/promotion-changelog.json"
      provides: "Structured promotion/demotion history"
      contains: "from_level"
    - path: "bin/formalization-candidates.cjs"
      provides: "Ranked formalization candidate files"
      contains: "churn"
    - path: "bin/compute-per-model-gates.cjs"
      provides: "Gate demotion on evidence regression"
      contains: "evidence_regression"
    - path: "bin/solve-tui.cjs"
      provides: "TUI section showing recent promotions"
      contains: "promotion-changelog"
  key_links:
    - from: "hooks/nf-stop.js"
      to: "bin/refresh-evidence.cjs"
      via: "spawnSync after quorum logic completes"
      pattern: "refresh-evidence"
    - from: "bin/compute-per-model-gates.cjs"
      to: ".planning/formal/promotion-changelog.json"
      via: "appendChangelog writes promotion/demotion entries"
      pattern: "promotion-changelog"
    - from: "bin/solve-tui.cjs"
      to: ".planning/formal/promotion-changelog.json"
      via: "loadJSON reads and filters recent entries"
      pattern: "promotion-changelog"
    - from: "bin/formalization-candidates.cjs"
      to: ".planning/formal/evidence/git-heatmap.json"
      via: "reads churn signals"
      pattern: "git-heatmap"
    - from: "bin/nf-solve.cjs"
      to: "bin/formalization-candidates.cjs"
      via: "spawnTool in formatReport"
      pattern: "formalization-candidates"
  consumers:
    - artifact: "bin/formalization-candidates.cjs"
      consumed_by: "bin/nf-solve.cjs"
      integration: "spawnTool call in formatReport section"
      verify_pattern: "formalization-candidates"
---

<objective>
Close 4 remaining gate promotion feedback loops: always-on evidence collection, promotion changelog with TUI visibility, formalization candidates ranking, and automatic gate demotion on regression.

Purpose: Gate promotions currently happen silently with no history trail, evidence is only collected during explicit solve runs, there is no guidance on which files to formalize next, and demoted gates are never detected automatically. These 4 features close the feedback loops so the system is self-maintaining.
Output: Evidence refreshed every session, changelog tracking all gate transitions, ranked candidate list for formalization, automatic demotion when evidence regresses.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-stop.js
@bin/compute-per-model-gates.cjs
@bin/solve-tui.cjs
@bin/nf-solve.cjs
@bin/refresh-evidence.cjs
@.planning/formal/evidence/git-heatmap.json
@.planning/formal/evidence/trace-corpus-stats.json
@.planning/formal/model-registry.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Always-on evidence collection via Stop hook + promotion changelog + demotion logic</name>
  <files>
    hooks/nf-stop.js
    hooks/dist/nf-stop.js
    bin/compute-per-model-gates.cjs
    .planning/formal/promotion-changelog.json
  </files>
  <action>
**Feature 1 — Wire refresh-evidence.cjs into nf-stop.js:**

Add evidence refresh ONLY on the approve path (line ~683), right before `process.exit(0)`. This means evidence gets refreshed after every successful session completion.

```javascript
// Always-on evidence refresh — runs at end of every session.
// Fail-open: if refresh fails, never block the stop hook.
try {
  const { spawnSync } = require('child_process');
  const refreshScript = path.join(__dirname, '..', 'bin', 'refresh-evidence.cjs');
  if (fs.existsSync(refreshScript)) {
    const result = spawnSync(process.execPath, [refreshScript, '--json'], {
      cwd: process.cwd(),
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      process.stderr.write('[nf] evidence refresh warning: exit ' + result.status + '\n');
    }
  }
} catch (evErr) {
  process.stderr.write('[nf] evidence refresh failed (fail-open): ' + (evErr.message || evErr) + '\n');
}
```

**Feature 2 — Promotion changelog:**

Create `.planning/formal/promotion-changelog.json` as an empty array: `[]`.

In `bin/compute-per-model-gates.cjs`, add a function `appendChangelog(entry)` that:
1. Reads `FORMAL/promotion-changelog.json` (or `[]` if missing/malformed)
2. Pushes the new entry
3. Writes back (only if not DRY_RUN_FLAG)

Entry schema: `{ model, from_level, to_level, timestamp, evidence_readiness: { score, total }, trigger }`.

The `appendChangelog(entry)` function must also enforce a retention policy: after pushing the new entry, if the array length exceeds 200, trim from the front to keep only the last 200 entries. This prevents unbounded growth of the changelog file.

Call `appendChangelog()` at two points:
- After each promotion (~line 266 and ~line 278), with `trigger: "auto_promotion"`
- After each demotion (new Feature 4 code), with `trigger: "evidence_regression"`

**Feature 4 — Automatic gate demotion:**

In `bin/compute-per-model-gates.cjs`, after the promotion logic block (after line ~285), add demotion checks:

```javascript
// Demotion: SOFT_GATE models that no longer meet threshold
// Hysteresis: promote at score>=1 but demote at score<0.8 to prevent oscillation at boundaries
if (!promoted && model.gate_maturity === 'SOFT_GATE' && !evidenceReadiness.skipped) {
  if (evidenceReadiness.score < 0.8 || maturity < 0.8) {
    model.gate_maturity = 'ADVISORY';
    model.last_updated = new Date().toISOString();
    const demotionEntry = {
      model: modelPath, from_level: 'SOFT_GATE', to_level: 'ADVISORY',
      timestamp: new Date().toISOString(),
      evidence_readiness: { score: evidenceReadiness.score, total: evidenceReadiness.total },
      trigger: 'evidence_regression',
    };
    appendChangelog(demotionEntry);
    perModel[modelPath].demoted = true;
  }
}

// Demotion: HARD_GATE models that no longer meet threshold
// Hysteresis: promote at score>=3 but demote at score<2.5 to prevent oscillation at boundaries
if (!promoted && model.gate_maturity === 'HARD_GATE' && !evidenceReadiness.skipped) {
  if (evidenceReadiness.score < 2.5 || maturity < 2.5) {
    model.gate_maturity = 'SOFT_GATE';
    model.last_updated = new Date().toISOString();
    const demotionEntry = {
      model: modelPath, from_level: 'HARD_GATE', to_level: 'SOFT_GATE',
      timestamp: new Date().toISOString(),
      evidence_readiness: { score: evidenceReadiness.score, total: evidenceReadiness.total },
      trigger: 'evidence_regression',
    };
    appendChangelog(demotionEntry);
    perModel[modelPath].demoted = true;
  }
}
```

Also add demotions to the output object `demotions` array (alongside `promotions`).

**Install sync (per MEMORY.md):**

After editing hooks/nf-stop.js: `cp hooks/nf-stop.js hooks/dist/ && node bin/install.js --claude --global`
  </action>
  <verify>
1. `grep 'refresh-evidence' hooks/nf-stop.js` returns match for the spawnSync call
2. `grep 'evidence_regression' bin/compute-per-model-gates.cjs` returns demotion trigger
3. `grep 'appendChangelog\|promotion-changelog' bin/compute-per-model-gates.cjs` returns changelog logic
4. `node bin/compute-per-model-gates.cjs --json --dry-run 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('has demotions:', 'demotions' in d)"` prints "has demotions: true"
5. `test -f .planning/formal/promotion-changelog.json && echo "changelog exists"` prints "changelog exists"
6. `diff hooks/nf-stop.js hooks/dist/nf-stop.js` returns no diff (install sync)
7. `grep -c '200\|retention\|trim\|slice' bin/compute-per-model-gates.cjs` confirms retention cap is present in appendChangelog
  </verify>
  <done>
Evidence files refresh at end of every successful session via Stop hook. Gate promotions and demotions both log structured entries to promotion-changelog.json (capped at 200 entries). SOFT_GATE models demote to ADVISORY when evidence score drops below 0.8 (hysteresis buffer vs promote threshold of 1). HARD_GATE models demote to SOFT_GATE when evidence score drops below 2.5 (hysteresis buffer vs promote threshold of 3). Install sync completed.
  </done>
</task>

<task type="auto">
  <name>Task 2: Formalization candidates script + nf-solve integration</name>
  <files>
    bin/formalization-candidates.cjs
    bin/nf-solve.cjs
  </files>
  <action>
**Feature 3 — Create bin/formalization-candidates.cjs:**

Create a new script that ranks uncovered files by formalization priority. Pattern follows existing bin/ scripts (ROOT detection, --json flag, --project-root=, fail-open).

Inputs (all fail-open — missing file means empty data):
1. `.planning/formal/evidence/git-heatmap.json` — `signals.churn_files` array, each entry has `file` and `touch_count`
2. `.planning/formal/evidence/trace-corpus-stats.json` — `sessions` array; compute trace density per file by counting action occurrences across sessions
3. `.planning/formal/model-registry.json` — `models` object keyed by file path; entries with `gate_maturity !== 'ADVISORY'` have existing coverage

Algorithm:
1. Build a map of file -> churn from git-heatmap.json `signals.churn_files` (if the structure uses `signals.numerical_adjustments`, adapt — use touch_count as churn proxy). If git-heatmap has `signals.bugfix_hotspots`, also factor those in (bugfix files get 2x weight).
2. Build a map of file -> trace_density from trace-corpus-stats.json. **IMPORTANT**: The sessions array contains per-session `actions` maps keyed by action type (e.g. `quorum_start`, `circuit_break`), NOT per-file action maps. There are no file-level references in trace-corpus-stats.json. Therefore, trace_density cannot be computed from this file as originally designed. Instead: set trace_density = 1.0 for all files (neutral multiplier) so the ranking degrades gracefully to churn-only. Add a TODO comment noting that per-file trace data would need to come from a future instrumentation source. Do NOT silently produce zeros.
3. Build a set of covered_files from model-registry.json — any model path with `gate_maturity` !== 'ADVISORY' or `layer_maturity` >= 1.
4. For each file in the churn map that is NOT in covered_files: `score = (churn * trace_density) / (1 + existing_model_coverage)`. Since these are uncovered, existing_model_coverage = 0, so score = churn * trace_density.
5. Sort descending by score. Output top N (default 10, configurable via `--top=N`).

Output format (human-readable by default, JSON with --json):
```
Formalization Candidates (top 10)
  1. bin/nf-solve.cjs          score: 42.5  churn: 85  traces: 0.50
  2. hooks/nf-stop.js          score: 30.0  churn: 60  traces: 0.50
  ...
```

JSON format: `{ generated, candidates: [{ file, score, churn, trace_density, reason }] }`

**Wire into nf-solve.cjs report phase:**

In `formatReport()` in nf-solve.cjs, after the PRISM Priority section (~line 2977), add a Formalization Candidates section:

```javascript
// Formalization Candidates (top files to formalize next)
try {
  const fcResult = spawnTool('bin/formalization-candidates.cjs', ['--json', '--top=5']);
  if (fcResult.ok && fcResult.stdout && fcResult.stdout.trim()) {
    const fcData = JSON.parse(fcResult.stdout);
    if (fcData.candidates && fcData.candidates.length > 0) {
      lines.push('\u2500 Formalization Candidates \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
      for (const c of fcData.candidates.slice(0, 5)) {
        const fileLabel = c.file.length > 40 ? '...' + c.file.slice(-37) : c.file;
        lines.push('  ' + fileLabel.padEnd(42) + 'score: ' + c.score.toFixed(1));
      }
    }
  }
} catch (e) {
  // fail-open: candidates are informational
}
```
  </action>
  <verify>
1. `node bin/formalization-candidates.cjs --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('candidates:', d.candidates.length)"` prints a candidate count
2. `node bin/formalization-candidates.cjs 2>/dev/null | head -5` shows human-readable output
3. `grep 'formalization-candidates' bin/nf-solve.cjs` returns match for spawnTool integration
4. Pre-flight: `test -f .planning/formal/evidence/git-heatmap.json && test -f .planning/formal/model-registry.json && echo "inputs exist"` prints "inputs exist"
  </verify>
  <done>
formalization-candidates.cjs ranks uncovered files by churn (trace_density defaults to 1.0 since trace-corpus-stats.json lacks per-file data). nf-solve formatReport includes the top 5 candidates in its report output.
  </done>
</task>

<task type="auto">
  <name>Task 3: TUI promotion changelog section</name>
  <files>
    bin/solve-tui.cjs
  </files>
  <action>
**Feature 2b — TUI visibility for promotion changelog:**

In solve-tui.cjs, add a "Recent Promotions" section to the main menu screen (renderMainMenu function, after the category list box at ~line 484).

Must respect tui-nav invariants:
- EscapeProgress: This section is display-only on the main menu (depth=0), so no navigation depth change. No invariant violation.
- DepthBounded: No new depth levels added. Display-only section.

Implementation:

1. Add a constant for the changelog path:
```javascript
const CHANGELOG_PATH = path.join(ROOT, '.planning', 'formal', 'promotion-changelog.json');
```

2. Add a helper function `loadRecentPromotions(days)` that:
   - Reads `CHANGELOG_PATH` (fail-open: returns [] on error)
   - Filters entries where `timestamp` is within the last `days` days (default 7)
   - Returns filtered array sorted by timestamp descending

3. In `renderMainMenu()`, after the category list box (after line 484 `lines.push(BOX.bl + hr + BOX.br);`), add:

```javascript
// Helper: compute visible (non-ANSI) length of a string
function visLen(s) { return s.replace(/\x1b\[[0-9;]*m/g, '').length; }
// Helper: pad string to visible width W, accounting for ANSI escapes
function visPad(s, w) { return s + ' '.repeat(Math.max(0, w - visLen(s))); }

// Recent Promotions section
const recentPromos = loadRecentPromotions(7);
if (recentPromos.length > 0) {
  lines.push('');
  lines.push(BOX.tl + hr + BOX.tr);
  lines.push(BOX.v + BOLD + '  Recent Gate Changes (7d)'.padEnd(W) + RESET + BOX.v);
  lines.push(BOX.ml + hr + BOX.mr);
  for (const p of recentPromos.slice(0, 5)) {
    const arrow = p.trigger === 'evidence_regression' ? RED + ' DEMOTED ' + RESET : GREEN + ' PROMOTED' + RESET;
    const model = (p.model || '').length > 30 ? '...' + p.model.slice(-27) : p.model;
    const line = '  ' + arrow + ' ' + model.padEnd(32) + p.from_level + ' -> ' + p.to_level;
    lines.push(BOX.v + visPad(line, W) + BOX.v);
  }
  if (recentPromos.length > 5) {
    const moreLine = DIM + '  ... and ' + (recentPromos.length - 5) + ' more' + RESET;
    lines.push(BOX.v + visPad(moreLine, W) + BOX.v);
  }
  lines.push(BOX.bl + hr + BOX.br);
}
```

NOTE: Use `visLen`/`visPad` helpers instead of hardcoded `padEnd(W + 20)` or `(' ').repeat(W - 16)`. These helpers strip ANSI escapes before measuring length, following a clean pattern instead of fragile magic-number offsets. If the TUI already has a similar helper, reuse it; otherwise add these two functions near the top of the rendering section.

This is purely display — no new navigation states, no depth changes, no key handlers. It reads the changelog file that Task 1 creates and shows recent entries with color-coded promotion/demotion status.
  </action>
  <verify>
1. `grep 'promotion-changelog' bin/solve-tui.cjs` returns match for changelog loading
2. `grep 'loadRecentPromotions\|Recent Gate Changes' bin/solve-tui.cjs` returns matches
3. `grep 'DEMOTED\|PROMOTED' bin/solve-tui.cjs` returns color-coded labels
4. Verify no new depth states: `grep -c 'state.depth' bin/solve-tui.cjs` should not increase (display-only addition)
5. `grep 'visLen\|visPad' bin/solve-tui.cjs` confirms ANSI-aware padding helpers are used (no hardcoded W+20 offsets)
  </verify>
  <done>
TUI main menu shows recent gate promotions and demotions from the last 7 days, color-coded green for promotions and red for demotions. No new navigation states added (display-only), respecting tui-nav invariants.
  </done>
</task>

</tasks>

<verification>
1. `grep 'refresh-evidence' hooks/nf-stop.js` confirms Stop hook wiring
2. `diff hooks/nf-stop.js hooks/dist/nf-stop.js` returns empty (install sync)
3. `node bin/compute-per-model-gates.cjs --json --dry-run 2>/dev/null` includes demotions field
4. `test -f .planning/formal/promotion-changelog.json` confirms changelog exists
5. `node bin/formalization-candidates.cjs --json 2>/dev/null` produces candidate rankings
6. `grep 'formalization-candidates' bin/nf-solve.cjs` confirms report integration
7. `grep 'promotion-changelog' bin/solve-tui.cjs` confirms TUI integration
</verification>

<success_criteria>
All 4 feedback loops closed: (1) evidence refreshed every session via Stop hook, (2) promotion/demotion changelog tracked and visible in TUI, (3) formalization candidates ranked and shown in solve report, (4) gates automatically demoted when evidence regresses below threshold.
</success_criteria>

<output>
After completion, create `.planning/quick/238-close-remaining-gate-promotion-feedback-/238-SUMMARY.md`
</output>
