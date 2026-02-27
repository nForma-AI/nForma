---
name: qgsd:triage
description: Fetch issues/errors from configured sources (GitHub, Sentry, custom) and triage them. Sources are defined in .planning/triage-sources.md
argument-hint: "[--source github|sentry|sentry-feedback|bash] [--since 24h|7d] [--limit N]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Task
  - AskUserQuestion
---

<objective>
Aggregate issues and errors from all configured sources, deduplicate, render a prioritized triage table, and route the selected issue to the right QGSD workflow.

This command is the project's unified "what's broken right now?" entry point.
</objective>

<process>

## Step 1: Parse arguments

From `$ARGUMENTS`, extract:
- `--source <type>` → `$SOURCE_FILTER` (filter to one source type; default: all)
- `--since <duration>` → `$SINCE_OVERRIDE` (e.g. `24h`, `7d`; overrides per-source config)
- `--limit <n>` → `$LIMIT_OVERRIDE` (max issues per source; default: 10)

## Step 2: Load source configuration

Read `.planning/triage-sources.md`.

Parse the YAML frontmatter block (between `---` delimiters at the top of the file) to extract the `sources` array.

**If the file does not exist:**

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► TRIAGE: No sources configured
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create .planning/triage-sources.md to configure issue sources.
See the template at: docs/triage-sources.example.md
```
Stop.

**If `$SOURCE_FILTER` is set**, keep only sources whose `type` matches.

## Step 3: Show dispatch header

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► TRIAGE: Fetching from N source(s)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
(Replace N with actual count.)

## Step 4: Dispatch parallel fetch agents

For each source in the config, spawn ONE Task(subagent_type="general-purpose") in parallel (all in the same message turn).

Each agent receives:
- The source config block (type, label, repo/project/command, filter settings)
- `$SINCE_OVERRIDE` and `$LIMIT_OVERRIDE` (if set)
- The fetch instructions for its source type (see Source Type Handlers below)

Each agent MUST return a JSON block in this exact format (and nothing else outside the block):
```json
{
  "source_label": "<label from config>",
  "source_type": "<github|sentry|bash>",
  "status": "ok|error",
  "error": "<message if status=error>",
  "issues": [
    {
      "id": "<unique id: gh-123, sentry-abc, etc.>",
      "title": "<issue title>",
      "url": "<direct url or empty string>",
      "severity": "<error|warning|bug|info>",
      "age": "<human-readable: 5m ago, 2h ago, 3d ago>",
      "created_at": "<ISO8601>",
      "meta": "<one-line extra context: assignee, first-seen count, etc.>"
    }
  ]
}
```

### Source Type Handlers

#### `github`

Config fields: `repo` (optional, default: detect from `git remote`), `filter.state` (default: `open`), `filter.labels` (list, optional), `filter.assignee` (optional), `filter.since` (duration string).

Steps:
1. If `repo` not set, run: `git remote get-url origin` and parse owner/repo from the URL.
2. Build `gh issue list` command:
   - `--repo <owner/repo>`
   - `--state <filter.state>`
   - `--label <label>` (repeat for each label in filter.labels)
   - `--assignee <filter.assignee>` (if set)
   - `--limit <$LIMIT_OVERRIDE or 10>`
   - `--json number,title,url,labels,createdAt,assignees`
3. Run the command. Parse JSON output.
4. Apply `since` filter: if `filter.since` or `$SINCE_OVERRIDE` is set, compute the cutoff timestamp and filter out issues older than that.
5. Map each issue to the standard output schema:
   - `id`: `gh-<number>`
   - `severity`: first label matching `bug|error|critical|warning|enhancement|info` (else `info`)
   - `age`: compute from `createdAt`

**For PRs** (if `filter.type: pr` is in config): use `gh pr list` with the same flags.

#### `sentry`

Config fields: `project` (optional `org-slug/project-slug`), `filter.status` (default: `unresolved`), `filter.since`.

Uses Sentry MCP tools — no `sentry-cli` required. Falls back to CLI only if MCP is unavailable.

Steps:
1. **Discover org/project**: If `project` is not set in config, call `mcp__sentry__find_organizations` to get the org slug, then `mcp__sentry__list_projects` to find the project whose slug or name best matches the current working directory name. If `mcp__sentry__` tools are unavailable, try `mcp__plugin_sentry_sentry__find_organizations` + `mcp__plugin_sentry_sentry__find_projects` instead.
2. **Fetch issues**: Call `mcp__sentry__search_issues` (or `mcp__plugin_sentry_sentry__search_issues`) with:
   - `query`: `"is:<filter.status>"` (default: `"is:unresolved"`)
   - `organization_slug` and `project_slug` from Step 1 or parsed from `project` config field
   - Apply `filter.since` or `$SINCE_OVERRIDE` to filter results by recency
   - Limit to `$LIMIT_OVERRIDE` or 10 results, sorted newest first
3. **Enrich critical issues**: For up to 3 issues with `level: fatal` or `level: error`, call `mcp__sentry__get_issue_details` (or `mcp__plugin_sentry_sentry__get_issue_details`) and extract the root file + line number from the first non-library stack frame. Put it in `meta` as `"<file>:<line> · <event_count> events · <user_count> users"`.
4. **Map to standard schema**:
   - `id`: `sentry-<issue_id>`
   - `severity`: `fatal`→`error`, `error`→`error`, `warning`→`warning`, `info`→`info`
   - `meta`: enriched root cause string (Step 3) if available; else `"<event_count> events · <user_count> users"`
5. **CLI fallback** (only if all MCP tools are unavailable): run `sentry-cli issues list --project <project> --status <status> --format json`. If `sentry-cli` is also absent, return `status: error` with message `"Sentry MCP not connected and sentry-cli not found"`.

#### `sentry-feedback`

Config fields: `project` (optional `org-slug/project-slug`), `filter.since` (default: `7d`).

Fetches user-submitted feedback reports from Sentry — distinct from automated error events. Use alongside a `sentry` source to surface both signals.

Steps:
1. **Discover org/project**: Same discovery logic as the `sentry` handler (Step 1 above).
2. **Fetch feedback**: Call `mcp__sentry__list_user_feedback` with `organization_slug`, `project_slug`, and a `since` cutoff computed from `filter.since` or `$SINCE_OVERRIDE` (default: `7d`).
3. If `mcp__sentry__list_user_feedback` is unavailable, return `status: error` with `"sentry-feedback requires mcp__sentry__ tools — ensure the Sentry MCP server is connected"`.
4. **Map to standard schema**:
   - `id`: `feedback-<id>`
   - `title`: feedback comment text truncated to 80 chars, prefixed with `[Feedback] `
   - `severity`: always `info`
   - `meta`: `"by <user_email>"` if available, plus the page URL where feedback was submitted

#### `bash`

Config fields: `command` (shell command string), `parser` (optional: `json` | `lines`; default: `lines`).

Steps:
1. Run: `<command>` (execute the configured command as-is).
2. If `parser: json`, attempt to parse as JSON array of `{title, url, severity}` objects.
3. If `parser: lines` (default), treat each non-empty output line as an issue title with severity `info`.
4. Map to standard schema: `id` = `bash-<index>`, `url` = empty unless provided.

## Step 5: Collect and deduplicate results

Wait for all fetch agents to return.

Collect all `issues[]` arrays. Deduplicate by URL (exact match) then by title (Jaccard similarity > 0.8 = same issue, keep the one with more metadata).

Mark cross-source duplicates with a `[+N]` tag (e.g. `[+Sentry]`).

Sort by:
1. Severity: `error` > `bug` > `warning` > `info`
2. Age: newest first

## Step 6: Render triage table

If total issues = 0:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► TRIAGE: All clear — no open issues found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sources checked: <list>
```
Stop.

Otherwise:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► TRIAGE: N issues across M source(s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────┬─────────────────────────────────────────────┬──────────────┬─────────┬────────────┐
│ #  │ Title                                       │ Source       │ Sev     │ Age        │
├────┼─────────────────────────────────────────────┼──────────────┼─────────┼────────────┤
│  1 │ TypeError: cannot read 'id' of undefined    │ Sentry       │ error   │ 5m ago     │
│  2 │ Login fails on Safari iOS 17 [+GitHub]      │ Sentry       │ bug     │ 2h ago     │
│  3 │ Memory leak in worker pool                  │ GitHub #119  │ bug     │ 1d ago     │
│  4 │ API rate limiter returns 200 on reject       │ GitHub #124  │ warning │ 3d ago     │
└────┴─────────────────────────────────────────────┴──────────────┴─────────┴────────────┘

Errors from fetches (if any):
  ✗ Sentry: sentry-cli not found (run: npm install -g @sentry/cli)
```

## Step 7: Route to action

Prompt the user:

```
Enter issue # to work on, "all" for full details, or press Enter to skip:
```

**If user enters a number:**
- Load the full issue details (title, URL, meta) for that index.
- Determine routing:
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

**If user enters "all":**
- Print the full metadata for each issue (title, URL, meta, created_at) as a numbered list.
- Then re-prompt for a number.

**If user presses Enter (blank):**
```
Triage skipped. Run /qgsd:triage again when ready.
```

</process>
