---
phase: quick-257
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nf-solve.cjs
  - bin/solve-tui.cjs
autonomous: true
formal_artifacts: none

must_haves:
  truths:
    - "Solve report displays triage breakdown (FP, archived, actionable) next to each reverse-discovery residual count"
    - "Stale archived items re-surface in /nf:resolve when underlying file has been modified since archival"
    - "Forward sweep residuals (D->C) also show suppressed_fp_count in report output"
  artifacts:
    - path: "bin/nf-solve.cjs"
      provides: "Triage-enriched formatReport output for reverse discovery rows"
    - path: "bin/solve-tui.cjs"
      provides: "Staleness check in isArchived/loadSweepData that re-surfaces stale archived items"
  key_links:
    - from: "bin/nf-solve.cjs formatReport()"
      to: "finalResidual.d_to_c.detail / c_to_r.detail / t_to_r.detail / d_to_r.detail"
      via: "triage fields read from solve-classifications.json and archived-solve-items.json"
      pattern: "triage|fp_count|archived_count|actionable_count"
    - from: "bin/solve-tui.cjs loadSweepData()"
      to: "isArchived() staleness check"
      via: "archive entry timestamp vs file mtime comparison"
      pattern: "stale|archived_at|mtimeMs"
---

<objective>
Fix the data disconnect between nf-solve report (shows large residual numbers like "33 D->C, 139 C->R") and /nf:resolve (shows 0 items because everything is FP-classified or archived). The report should show triage breakdown so users understand the actual state, and stale archived items should re-surface when the underlying file has changed.

Purpose: Users currently see alarming residual counts in solve reports but find nothing to act on in /nf:resolve, creating confusion and distrust in the tooling.
Output: Enriched solve report output and smarter archive staleness logic.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nf-solve.cjs
@bin/solve-tui.cjs
@.planning/formal/solve-classifications.json
@.planning/formal/archived-solve-items.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add triage breakdown to solve report output</name>
  <files>bin/nf-solve.cjs</files>
  <action>
In `formatReport()` (line ~2901), enrich the reverse discovery section AND the D->C forward row to show triage breakdown alongside raw residual counts.

**Step 1 — Add a helper function `computeTriageBreakdown(catKey, items)`** near the top of the report section (~line 2895). This function should:
- Read solve-classifications.json (use `const classPath = path.join(ROOT, '.planning', 'formal', 'solve-classifications.json')`)
- Read archived-solve-items.json (use `const archivePath = path.join(ROOT, '.planning', 'formal', 'archived-solve-items.json')`)
- For each item, compute its key using the same logic as solve-tui.cjs `itemKey()`:
  - dtoc: `${item.doc_file}:${item.value}`
  - ctor: `item.file`
  - ttor: `item.file`
  - dtor: `${item.doc_file}:${item.line}`
- Count: fp_count (classification === 'fp'), archived_count (key matches archive entry), actionable_count (neither FP nor archived)
- Return `{ fp_count, archived_count, actionable_count, total }`

**Step 2 — Enrich formatReport() reverse discovery rows.** After each reverse row is rendered (lines ~2948-2956), add a triage detail line. Access the detail arrays from `finalResidual`:
- `c_to_r.detail.untraced_modules` → catKey 'ctor', items have `.file` field
- `t_to_r.detail.orphan_tests` → catKey 'ttor', items are strings (file paths) — normalize to `{file: item}`
- `d_to_r.detail.unbacked_claims` → catKey 'dtor', items have `.doc_file`, `.line`

For each reverse row, if detail is available and not skipped, append a line like:
```
  (15 FP, 8 archived, 0 actionable)
```
Use DIM ANSI styling (already defined as `\x1b[2m`) to make the breakdown visually subordinate.

**Step 3 — Enrich D->C forward row.** The D->C sweep already returns `detail.suppressed_fp_count` and `detail.raw_broken_count`. After the D->C forward row in `forwardRows` rendering (~line 2940), if `finalResidual.d_to_c.detail` exists and is not skipped, compute triage for its `broken_claims` array (catKey 'dtoc') and append the breakdown line.

**Important:** Do NOT modify the sweep functions themselves — only `formatReport()` and the new helper. The helper reads the classification/archive files directly (same as solve-tui.cjs does). Wrap all file reads in try/catch with graceful fallback to `{}` / `{entries:[]}`.
  </action>
  <verify>
Run `node bin/nf-solve.cjs --fast 2>&1 | grep -A1 'C -> R\|T -> R\|D -> R\|D -> C'` and confirm each row has a triage breakdown line beneath it showing "(N FP, N archived, N actionable)".
  </verify>
  <done>
Solve report displays triage context for all reverse-discovery rows (C->R, T->R, D->R) and the D->C forward row, showing FP/archived/actionable counts so users understand why large residuals may have nothing to resolve.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add staleness check to archive filtering in solve-tui.cjs</name>
  <files>bin/solve-tui.cjs</files>
  <action>
Modify the archive staleness logic so items archived more than 30 days ago AND whose underlying file has been modified since archival are treated as "stale" and re-surface for triage.

**Step 1 — Update `isArchived()` function (line 278).** Currently it just checks if a key exists in the archive. Change it to also check staleness:

```javascript
function isArchived(item) {
  const archiveData = readArchiveFile();
  const key = item.type === 'dtoc' ? `${item.doc_file}:${item.value}`
    : item.type === 'dtor' ? `${item.doc_file}:${item.line}`
    : item.file || item.summary;
  const entry = archiveData.entries.find(e => e.key === key);
  if (!entry) return false;

  // Staleness check: if archived >30 days ago AND underlying file modified since, re-surface
  const STALE_DAYS = 30;
  const archivedAt = entry.archived_at ? new Date(entry.archived_at).getTime() : 0;
  const now = Date.now();
  const isOldEnough = (now - archivedAt) > (STALE_DAYS * 24 * 60 * 60 * 1000);

  if (isOldEnough) {
    // Determine the underlying file path to check mtime
    const filePath = item.file || item.doc_file;
    if (filePath) {
      try {
        const absPath = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
        const stat = fs.statSync(absPath);
        if (stat.mtimeMs > archivedAt) {
          return false; // stale archive — re-surface
        }
      } catch (_) {
        // File doesn't exist anymore — keep archived
      }
    }
  }

  return true;
}
```

**Step 2 — No changes needed to loadSweepData().** The `/nf:resolve` command already calls `isArchived()` on each item (resolve.md line 52: `const items = cat.items.filter(i => !st.isArchived(i))`). By updating `isArchived()` to return `false` for stale entries, those items will automatically re-appear in the resolve queue.

**Important:** The staleness check only applies to items older than 30 days. Recent archives are preserved. If the file no longer exists (statSync throws), the item stays archived since there's nothing to re-triage.
  </action>
  <verify>
Run a Node.js snippet that requires solve-tui.cjs, creates a mock item, verifies isArchived returns true for a recent archive entry, and returns false for an entry archived 31+ days ago when the file's mtime is newer:
```bash
node -e "
const st = require('./bin/solve-tui.cjs');
// Verify isArchived is a function and accepts items
console.log('isArchived type:', typeof st.isArchived);
console.log('Exports OK:', ['isArchived','loadSweepData','readArchiveFile'].every(k => typeof st[k] === 'function'));
"
```
Also verify no syntax errors: `node -c bin/solve-tui.cjs`
  </verify>
  <done>
isArchived() returns false for archive entries older than 30 days when the underlying file has been modified since archival, causing stale items to re-surface in /nf:resolve for fresh triage.
  </done>
</task>

</tasks>

<verification>
1. `node -c bin/nf-solve.cjs` — no syntax errors
2. `node -c bin/solve-tui.cjs` — no syntax errors
3. `node bin/nf-solve.cjs --fast 2>&1 | head -60` — report shows triage breakdown lines
4. Existing test suite: `node bin/solve-tui.test.cjs 2>&1 | tail -5` — all tests pass (if test file exists)
</verification>

<success_criteria>
- Solve report reverse-discovery section shows "(N FP, N archived, N actionable)" for each of C->R, T->R, D->R
- Solve report D->C row shows triage breakdown
- isArchived() re-surfaces items archived 30+ days ago when underlying file has changed
- No regressions in existing solve-tui.cjs exports or TUI functionality
</success_criteria>

<output>
After completion, create `.planning/quick/257-fix-solve-resolve-data-disconnect-add-tr/257-SUMMARY.md`
</output>
