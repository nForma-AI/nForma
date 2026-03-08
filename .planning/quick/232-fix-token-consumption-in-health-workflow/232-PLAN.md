---
phase: quick-232
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/health.md
  - hooks/nf-token-collector.js
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "nf:health displays token consumption data from token-dashboard.cjs instead of fragile inline script"
    - "Token collector removes debug transcript capture code"
    - "Token records with hex agent_id fallback are handled gracefully in display"
  artifacts:
    - path: "core/workflows/health.md"
      provides: "Token display step using bin/token-dashboard.cjs"
      contains: "token-dashboard.cjs"
    - path: "hooks/nf-token-collector.js"
      provides: "Clean token collector without debug code"
  key_links:
    - from: "core/workflows/health.md"
      to: "bin/token-dashboard.cjs"
      via: "node bin/token-dashboard.cjs CLI call"
      pattern: "node.*token-dashboard"
---

<objective>
Fix token consumption display in nf:health by replacing the fragile inline Node.js script with a call to the existing `bin/token-dashboard.cjs`, and clean up debug instrumentation from the token collector hook.

Purpose: The inline script in health.md duplicates logic already in token-dashboard.cjs, and all 856 token records show 0/0 tokens because subagent transcripts don't contain usage data. Rather than trying to fix the unfixable transcript parsing, delegate to the dashboard CLI which already handles aggregation, cost estimation, and graceful display of null/zero data.

Output: Updated health workflow, cleaned token collector hook, synced installed copies.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@core/workflows/health.md
@bin/token-dashboard.cjs
@hooks/nf-token-collector.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace inline token script in health.md with token-dashboard.cjs call</name>
  <files>core/workflows/health.md</files>
  <action>
In `core/workflows/health.md`, replace the entire `<step name="display_token_usage">` content (lines ~102-150) with a simplified version that calls the existing CLI tool:

Replace the inline `node -e "..."` block with:
```bash
node bin/token-dashboard.cjs --last 3
```

Keep the step wrapper and the instruction to "Display the output inline in the health report, between the main status section and the Errors/Warnings section."

The dashboard already:
- Uses the correct path via `bin/planning-paths.cjs`
- Handles missing files gracefully
- Aggregates by slot family (strips hex IDs via slotFamily())
- Shows cost estimates
- Handles null/zero token data

Also remove the debug transcript capture code from `hooks/nf-token-collector.js`:
- Delete lines 111-114 (the DEBUG block that writes `transcript-debug-sample.jsonl`)
- This was temporary investigation instrumentation

Then sync both files to their installed locations:
1. `cp core/workflows/health.md ~/.claude/nf/workflows/health.md` (workflow sync)
2. `cp hooks/nf-token-collector.js hooks/dist/nf-token-collector.js && node bin/install.js --claude --global` (hook install sync)
  </action>
  <verify>
1. `grep 'token-dashboard.cjs' core/workflows/health.md` returns a match
2. `grep -c 'node -e' core/workflows/health.md` — the display_token_usage step should NOT contain an inline `node -e` script
3. `grep 'transcript-debug-sample' hooks/nf-token-collector.js` returns NO match (debug code removed)
4. `diff core/workflows/health.md ~/.claude/nf/workflows/health.md` shows no differences
5. `node bin/token-dashboard.cjs --last 1` runs without error
  </verify>
  <done>
Health workflow's token display step calls bin/token-dashboard.cjs instead of inline script. Debug transcript capture removed from token collector. Both files synced to installed locations.
  </done>
</task>

</tasks>

<verification>
- `grep 'token-dashboard' core/workflows/health.md` confirms the dashboard CLI is referenced
- `grep -v 'debug' hooks/nf-token-collector.js | wc -l` confirms debug code removed
- `node bin/token-dashboard.cjs --last 1` produces formatted output without errors
</verification>

<success_criteria>
- health.md display_token_usage step delegates to bin/token-dashboard.cjs
- No inline Node.js token aggregation script remains in health.md for that step
- Debug transcript capture code removed from nf-token-collector.js
- Installed copies match source files
</success_criteria>

<output>
After completion, create `.planning/quick/232-fix-token-consumption-in-health-workflow/232-SUMMARY.md`
</output>
