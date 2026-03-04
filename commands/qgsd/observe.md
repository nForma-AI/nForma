---
name: qgsd:observe
description: Fetch issues and drifts from configured sources, render dual-table output, and write to debt ledger. Replaces /qgsd:triage.
argument-hint: "[--source github|sentry|sentry-feedback|bash|internal] [--since 24h|7d] [--limit N]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Aggregate issues and drifts from all configured sources, deduplicate, render a prioritized dual-table output (Issues + Drifts), write observations to the debt ledger, and route the selected issue to the right QGSD workflow.

This command is the project's unified "what's broken right now?" entry point. It replaces `/qgsd:triage` with debt-aware persistence and dual-table rendering.
</objective>

<process>

## Step 1: Parse arguments

From `$ARGUMENTS`, extract:
- `--source <type>` → `$SOURCE_FILTER` (filter to one source type; default: all)
- `--since <duration>` → `$SINCE_OVERRIDE` (e.g. `24h`, `7d`; overrides per-source config)
- `--limit <n>` → `$LIMIT_OVERRIDE` (max issues per source; default: 10)

## Step 2: Load source configuration

Use `loadObserveConfig()` from `bin/observe-config.cjs` to load sources.

```javascript
const { loadObserveConfig } = require('./bin/observe-config.cjs');
const config = loadObserveConfig();
// config = { sources, configFile, observeConfig, error? }
```

The loader automatically:
1. Tries `.planning/observe-sources.md` first, falls back to `.planning/triage-sources.md` (backward compatible)
2. Parses YAML frontmatter to extract sources array
3. Infers `issue_type` for known source types (github/sentry/bash → "issue", prometheus/grafana/logstash → "drift")
4. Applies default timeout and fail_open settings

**If no config file exists or error is returned:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD > OBSERVE: No sources configured
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Create .planning/observe-sources.md to configure issue sources.
```
Stop.

**If `$SOURCE_FILTER` is set**, keep only sources whose `type` matches.

**Always-on internal source:** Regardless of config or filters, inject an internal work detection source:

```javascript
// Inject internal scanner unconditionally (always-on, no config needed)
const internalSource = { type: 'internal', label: 'Internal Work', issue_type: 'issue' };
// Add to sources array if not already present and not filtered out by --source
if (!$SOURCE_FILTER || $SOURCE_FILTER === 'internal') {
  config.sources.push(internalSource);
}

// Critical: check for empty sources AFTER internal injection
if (config.sources.length === 0) {
  // Display "no sources" message only if sources is empty AFTER internal source injection
  display("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n QGSD > OBSERVE: No sources configured\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nCreate .planning/observe-sources.md to configure issue sources.");
  stop();
}
```

This ensures internal work detection runs even if observe-sources.md doesn't exist or if the user filters to `--source internal`.

## Step 3: Register handlers

Import handler functions and register them with the registry:

```javascript
const { registerHandler } = require('./bin/observe-registry.cjs');
const { handleGitHub, handleSentry, handleSentryFeedback, handleBash, handleInternal } = require('./bin/observe-handlers.cjs');

registerHandler('github', handleGitHub);
registerHandler('sentry', handleSentry);
registerHandler('sentry-feedback', handleSentryFeedback);
registerHandler('bash', handleBash);
registerHandler('internal', handleInternal);
```

Display dispatch header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD > OBSERVE: Fetching from N source(s)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 4: Dispatch parallel fetch

Call `dispatchAll()` from `bin/observe-registry.cjs` — this dispatches ALL sources uniformly through the registry with per-source timeout. No special-casing per source type at this stage.

```javascript
const { dispatchAll } = require('./bin/observe-registry.cjs');
const results = await dispatchAll(config.sources, { sinceOverride: $SINCE_OVERRIDE, limitOverride: $LIMIT_OVERRIDE });
```

This uses `Promise.allSettled` internally — one source failure does not block others (OBS-08).

## Step 4b: MCP bridge for pending_mcp results

After `dispatchAll` returns, iterate over results. For any result with `status: "pending_mcp"`:

1. Read the `_mcp_instruction` object from the result:
   ```javascript
   const { tool, params, mapper } = result._mcp_instruction;
   ```

2. Execute the MCP tool call directly (the observe command runs in Claude context where MCP tools are available). Call the tool named in `_mcp_instruction.tool` with `_mcp_instruction.params`. Try `mcp__sentry__<tool>` first, then `mcp__plugin_sentry_sentry__<tool>` as fallback.

3. Import the mapper function from `bin/observe-handlers.cjs`:
   ```javascript
   const handlers = require('./bin/observe-handlers.cjs');
   const mapperFn = handlers[mapper]; // e.g., mapSentryIssuesToSchema or mapSentryFeedbackToSchema
   ```

4. Call the mapper with the MCP result and the original sourceConfig:
   ```javascript
   const mapped = mapperFn(mcpResult, sourceConfig);
   // mapped = { source_label, source_type, status: "ok", issues: [...] }
   ```

5. Replace the `pending_mcp` result in the results array with the mapped standard schema result.

6. If the MCP call fails, replace with:
   ```javascript
   { source_label, source_type, status: "error", error: "MCP call failed: {message}", issues: [] }
   ```

**Key principle:** This pattern keeps handlers as pure testable CJS functions while the observe command (running in Claude context) handles MCP execution. The registry's `dispatchAll` works uniformly — the MCP bridge is a post-processing step.

## Step 5: Collect and render

Call `renderObserveOutput()` from `bin/observe-render.cjs`:

```javascript
const { renderObserveOutput } = require('./bin/observe-render.cjs');
const output = renderObserveOutput(results);
```

At this point ALL results are standard schema (pending_mcp results were resolved in Step 4b).

The renderer:
1. Separates successful results from errors
2. Splits issues by `issue_type`: "issue" items and "drift" items
3. Sorts each group by severity (error > bug > warning > info), then by age (newest first)
4. Renders ISSUES table with columns: #, Title, Source, Sev, Age
5. Renders DRIFTS table (if any) with columns: #, Parameter, Formal, Actual, Sev
6. Renders error section at bottom listing failed sources

Display the output.

If total issues = 0 and no drifts:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD > OBSERVE: All clear — no open issues found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sources checked: <list>
```
Stop.

## Step 6a: Write to debt ledger

Call `writeObservationsToDebt()` from `bin/observe-debt-writer.cjs`:

```javascript
const { writeObservationsToDebt } = require('./bin/observe-debt-writer.cjs');

// Collect all issues from all successful results
const allObservations = results
  .filter(r => r.status === 'ok')
  .flatMap(r => r.issues || []);

const { written, updated, errors } = writeObservationsToDebt(allObservations, '.formal/debt.json');
```

Display:
```
Wrote {written} new, updated {updated} existing debt entries.
```

This upserts all observations by fingerprint (using v0.27-01's `fingerprintIssue` and `fingerprintDrift` functions). Same issues across runs update `occurrences` and `last_seen`, not duplicates.

## Step 6b: Show debt summary

Read the debt ledger and display status counts:

```javascript
const { readDebtLedger } = require('./bin/debt-ledger.cjs');
const ledger = readDebtLedger('.formal/debt.json');
const entries = ledger.debt_entries || [];

const counts = {
  open: entries.filter(e => e.status === 'open').length,
  acknowledged: entries.filter(e => e.status === 'acknowledged').length,
  resolving: entries.filter(e => e.status === 'resolving').length,
  resolved: entries.filter(e => e.status === 'resolved').length
};
```

Display:
```
Debt ledger: {open} open, {acknowledged} acknowledged, {resolving} resolving, {resolved} resolved
```

## Step 7: Route to action

Prompt the user:

```
Enter issue # to work on, "ack N" to acknowledge, "solve" for all internal issues, "all" for full details, or press Enter to skip:
```

**If user enters a number:**
- Load the full issue details (title, URL, meta) for that index.
- Determine routing:
  - If the issue has `source_type: 'internal'` and `_route` metadata: use the `_route` value as the suggested action (example: unfinished quick task suggests `/qgsd:quick "original-slug"`, debug session suggests `/qgsd:debug --resume`)
  - Otherwise, routing by severity:
    - `severity: error` or `severity: bug` → suggest `/qgsd:debug`
    - `severity: warning` or `severity: info` → suggest `/qgsd:quick`
- Display:
  ```
  ◆ Issue: <title>
    URL: <url>
    Meta: <meta>

  Suggested action: /qgsd:debug "<title> — <meta>"
  Run it? [Y/n]
  ```
- If confirmed, invoke the suggested skill with the issue as context.

**If user enters "solve":**
- Collect all issues with `source_type: 'internal'`
- Display: `Routing all internal issues to /qgsd:solve...`
- Invoke `/qgsd:solve` to address all internal consistency issues at once

**If user enters "ack N":**
- Acknowledge the debt entry for issue #N (transition status from "open" to "acknowledged" via the debt state machine).
- Display: `Acknowledged: <title>`

**If user enters "all":**
- Print the full metadata for each issue (title, URL, meta, created_at) as a numbered list.
- Then re-prompt for a number.

**If user presses Enter (blank):**
```
Observe complete. Run /qgsd:observe again when ready.
```

</process>
