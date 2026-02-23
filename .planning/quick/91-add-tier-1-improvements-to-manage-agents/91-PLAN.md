---
phase: quick-91
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/manage-agents.cjs
autonomous: true
requirements:
  - MANAGE-AGENTS-TIER1

must_haves:
  truths:
    - "When the user sets or changes ANTHROPIC_BASE_URL in Add or Edit, a provider health probe runs and shows UP (green checkmark) or DOWN (warning) before saving"
    - "If the provider is DOWN, the user is prompted 'Save anyway? (y/N)' and can abort"
    - "The main menu has a '6. Check agent health' option that lets the user pick an agent and see its health status and latency"
    - "In Edit, after the summary card, a 'Observed performance' row shows p95/max/failures/suggested-timeout from MCP log history for that agent"
    - "If no log data exists for an agent in Edit, the performance row is silently omitted"
  artifacts:
    - path: "bin/manage-agents.cjs"
      provides: "All three Tier 1 improvements"
      contains: "checkAgentHealth"
  key_links:
    - from: "addAgent() / editAgent() baseUrl section"
      to: "probeProviderUrl()"
      via: "inline HTTP probe (same pattern as fetchProviderModels)"
      pattern: "probeProviderUrl"
    - from: "editAgent() summary card"
      to: "review-mcp-logs.cjs --json --tool <slotName>"
      via: "spawnSync child_process"
      pattern: "spawnSync.*review-mcp-logs"
    - from: "mainMenu() action handler"
      to: "checkAgentHealth()"
      via: "action === 'health'"
      pattern: "checkAgentHealth"
---

<objective>
Add three Tier 1 improvements to bin/manage-agents.cjs:
1. Provider pre-flight check when ANTHROPIC_BASE_URL is set/changed in Add or Edit
2. New menu item "6. Check agent health" with per-agent provider probe result
3. Observed performance row in Edit summary card (p95/max/failures from MCP logs)

Purpose: Surface provider health and historical performance data at the point of decision — when adding, editing, or choosing to check an agent.
Output: Enhanced bin/manage-agents.cjs with all three features integrated.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/91-add-tier-1-improvements-to-manage-agents/91-PLAN.md
@bin/manage-agents.cjs
@bin/check-provider-health.cjs
@bin/review-mcp-logs.cjs
@bin/check-mcp-health.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add probeProviderUrl helper and provider pre-flight to Add + Edit</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Add a `probeProviderUrl(baseUrl, apiKey)` async function near the top of the file (after `fetchProviderModels`). It makes a GET request to `${baseUrl}/models` with a 7-second timeout (same pattern as `fetchProviderModels` but returns `{ healthy: boolean, latencyMs: number, statusCode: number|null, error: string|null }`). Count HTTP status 200/401/403/404/422 as healthy (same logic as check-provider-health.cjs).

**In addAgent():** After collecting `answers.baseUrl` (line ~249, after building the `env` object but before `writeClaudeJson`), if `answers.baseUrl.trim()` is non-empty:
1. Call `probeProviderUrl(baseUrl, apiKey)` with the collected baseUrl and apiKey.
2. If healthy: print `  \x1b[32m✓ Provider UP (${latencyMs}ms)\x1b[0m`
3. If not healthy: print `  \x1b[33m⚠ Provider DOWN or unreachable\x1b[0m`, then prompt `{ type: 'confirm', name: 'saveAnyway', message: 'Save anyway?', default: false }`. If the user answers `false`, print `  Cancelled.` and `return` without saving.

**In editAgent():** In the `// ── Base URL` block (around line 443), after collecting `baseUrl` from the prompt, if the value is non-empty and not `'__REMOVE__'`:
1. Call `probeProviderUrl(baseUrl, env.ANTHROPIC_API_KEY || updates.apiKey || '')`.
2. Same healthy/DOWN flow as addAgent(): show green checkmark or yellow warning + confirm prompt. On "no", `return` early before applying updates.

Note: The probe runs AFTER the user types the URL but BEFORE writing to disk, so the abort is clean.
  </action>
  <verify>
    Run `node bin/manage-agents.cjs` and:
    - Add an agent with a reachable ANTHROPIC_BASE_URL (e.g., `https://api.together.xyz/v1`) — should see `✓ Provider UP (Xms)`.
    - Add an agent with a bogus URL (e.g., `https://does-not-exist.invalid/v1`) — should see `⚠ Provider DOWN`, then `Save anyway?` prompt; answering N should not add the agent.
    - Edit an existing agent and change its Base URL to a bogus value — same warning + abort flow.
  </verify>
  <done>
    Provider pre-flight runs on Add and Edit when baseUrl is set. Green checkmark for UP providers. Yellow warning + "Save anyway?" prompt for DOWN providers. Answering N aborts without writing to ~/.claude.json.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add "6. Check agent health" menu option</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Add `async function checkAgentHealth()` that:
1. Reads `~/.claude.json` and lists all agents.
2. Prompts the user to select one agent via `inquirer.prompt` (type: list, same display format as editAgent selector — slot name padded + model + key status).
3. Gets the selected agent's config. Check what type of agent it is:
   - If `cfg.env.ANTHROPIC_BASE_URL` is set: run `probeProviderUrl(baseUrl, apiKey)` and display a one-row result card:
     ```
       Agent:    <slotName>
       Status:   ✓ UP (Xms) [statusCode]  OR  ✗ DOWN [timeout/statusCode]
       URL:      <baseUrl>
       Model:    <CLAUDE_DEFAULT_MODEL or '—'>
     ```
   - If no ANTHROPIC_BASE_URL (subprocess provider like codex-1, gemini-1): print `  <slotName> is a subprocess provider — no HTTP endpoint to probe.`

This approach uses the already-added `probeProviderUrl()` from Task 1. No subprocess spawn of check-mcp-health.cjs needed (its `claude -p` approach is 12s+ and only works for claude-mcp-server instances).

**In mainMenu():** Add `{ name: '6. Check agent health', value: 'health' }` to the choices array, between `'5. Reorder agents'` and the Separator before `'0. Exit'`. Add `else if (action === 'health') await checkAgentHealth();` to the dispatch block.
  </action>
  <verify>
    Run `node bin/manage-agents.cjs`, select option 6:
    - For an agent with a real ANTHROPIC_BASE_URL, verify status card appears with latency.
    - For a codex-1/gemini-1 style agent (no baseUrl), verify the "subprocess provider" message appears.
    - Confirm the menu now shows options 1-6 plus 0.
  </verify>
  <done>
    Menu shows "6. Check agent health". User selects agent, sees UP/DOWN status with latency for HTTP-backed agents, and a clear message for subprocess agents. Returns to main menu after displaying result.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add observed performance row in Edit summary card</name>
  <files>bin/manage-agents.cjs</files>
  <action>
Add `const { spawnSync } = require('child_process');` to the top-level requires (after the existing requires).

In `editAgent()`, after printing the summary card closing line (`console.log('  └...')`) and before the `inquirer.prompt` for `fields`, add performance intel fetch:

```javascript
// ── Performance intel from MCP logs ───────────────────────────────────────
const reviewLogsPath = path.join(__dirname, 'review-mcp-logs.cjs');
let perfRow = null;
try {
  const res = spawnSync('node', [reviewLogsPath, '--json', '--tool', slotName], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (res.status === 0 && res.stdout) {
    const logData = JSON.parse(res.stdout);
    // serverStats is keyed by exact server name as seen in debug logs
    const stats = logData.serverStats && logData.serverStats[slotName];
    if (stats && stats.totalCalls > 0) {
      const p95s = stats.p95Ms ? (stats.p95Ms / 1000).toFixed(1) + 's' : '—';
      const maxS = stats.maxMs ? (stats.maxMs / 1000).toFixed(1) + 's' : '—';
      const failures = `${stats.failureCount}/${stats.totalCalls}`;
      // Suggested timeout: 1.5× p95, floored at 15000, rounded to nearest 5000ms
      const suggested = stats.p95Ms
        ? Math.max(15000, Math.ceil(stats.p95Ms * 1.5 / 5000) * 5000)
        : null;
      const suggestedStr = suggested ? `${suggested}ms` : '—';
      perfRow = `p95: ${p95s}  max: ${maxS}  failures: ${failures}  suggested timeout: ${suggestedStr}`;
    }
  }
} catch (_) {}

if (perfRow) {
  console.log(row('Perf   ', perfRow));
  console.log(`  └${'─'.repeat(W + 2)}┘\n`);
} else {
  console.log(`  └${'─'.repeat(W + 2)}┘\n`);
}
```

Note: The existing `console.log('  └...')` line at the bottom of the summary card must be REMOVED (it was printing the bottom border before); the new code above handles the bottom border in both branches. So remove the original bottom-border line and replace it with the block above.

The `row()` helper already exists in scope and formats the perf line to match other rows. The Perf row appears INSIDE the card box before the bottom border.

Wait — the box is: top border, title, middle divider, rows (Model/URL/Key/Timeout/Slot/Cmd), bottom border. The Perf row should appear as an additional row before the bottom border. Adjust implementation: remove the `console.log('  └...')` line that currently closes the box, then add perf row if available, then always print the closing `└` line. This keeps the box intact.
  </action>
  <verify>
    Run `node bin/manage-agents.cjs`, select option 3 (Edit), pick an agent that has appeared in MCP logs (check ~/.claude/debug/*.txt exists). Verify:
    - If log data exists: summary card shows a "Perf" row like `p95: 4.2s  max: 12.1s  failures: 3/47  suggested timeout: 15000ms`
    - If no log data: summary card shows normally without a Perf row (no error, no crash)
    - The box borders render correctly in both cases (no broken ASCII art)
    - `spawnSync` timeout of 5s means the edit flow is not significantly delayed
  </verify>
  <done>
    Edit summary card displays "Perf" row with p95/max/failures/suggested-timeout when MCP log data exists for the agent. Silently omitted when no data. Box renders correctly either way.
  </done>
</task>

</tasks>

<verification>
1. `node bin/manage-agents.cjs` starts without errors
2. Menu shows options 1-6 + 0 (Exit)
3. Option 6 (Check agent health) works for HTTP-backed and subprocess agents
4. Add flow: entering a real URL shows green checkmark; bogus URL shows warning + confirm prompt
5. Edit flow: changing Base URL triggers pre-flight; Perf row shows when log data exists
6. All existing functionality (list, add, edit, remove, reorder) still works unmodified
</verification>

<success_criteria>
- Provider pre-flight in Add: green checkmark for UP providers, warning + abort option for DOWN providers
- Provider pre-flight in Edit: same behavior when Base URL field is changed
- Menu item 6 present and functional; HTTP agents show UP/DOWN + latency; subprocess agents show informational message
- Perf row in Edit summary card: populated from review-mcp-logs.cjs --json when data exists; silently absent when no data
- No regressions in existing menu options 1-5
</success_criteria>

<output>
After completion, create `.planning/quick/91-add-tier-1-improvements-to-manage-agents/91-SUMMARY.md`
</output>
