---
# Triage source configuration for /qgsd:triage
# Copy this file to .planning/triage-sources.md and edit for your project.
#
# Supported source types: github | sentry | bash
#
# Each source is fetched in parallel. Results are merged, deduplicated,
# and sorted by severity then recency before being presented.

sources:

  # ── GitHub Issues ──────────────────────────────────────────────────────────
  - type: github
    label: "GitHub Issues"
    # repo: owner/repo   # optional — defaults to current git remote
    filter:
      state: open
      labels: [bug, regression]   # empty list = no label filter
      # assignee: "@me"           # filter by assignee (@me = you)
      since: 7d                   # only issues opened/updated in the last 7 days

  # ── GitHub PRs with failing CI ─────────────────────────────────────────────
  # - type: github
  #   label: "Failing PRs"
  #   filter:
  #     type: pr
  #     state: open
  #     since: 3d

  # ── Sentry Errors (uses Sentry MCP — no sentry-cli required) ──────────────
  # - type: sentry
  #   label: "Sentry Errors"
  #   # project: my-org/my-project   # optional — auto-detected from MCP if omitted
  #   filter:
  #     status: unresolved
  #     since: 24h

  # ── Sentry User Feedback ────────────────────────────────────────────────────
  # - type: sentry-feedback
  #   label: "User Feedback"
  #   # project: my-org/my-project   # optional — auto-detected from MCP if omitted
  #   filter:
  #     since: 7d

  # ── Custom bash command ────────────────────────────────────────────────────
  # Runs any shell command. Each output line becomes an issue.
  # Use parser: json if your command emits [{title, url, severity}] JSON.
  #
  # - type: bash
  #   label: "Failed CI Runs"
  #   command: "gh run list --status=failure --limit=5 --json displayTitle,url | jq '[.[] | {title: .displayTitle, url: .url, severity: \"error\"}]'"
  #   parser: json
  #
  # - type: bash
  #   label: "TODO/FIXME in main"
  #   command: "git diff main..HEAD --name-only | xargs grep -l 'TODO\\|FIXME' 2>/dev/null"
  #   parser: lines
---

# Triage Sources

Configuration for `/qgsd:triage` — the project's issue aggregation command.

## How to use

```
/qgsd:triage                    # Fetch from all configured sources
/qgsd:triage --source github    # Fetch from GitHub only
/qgsd:triage --since 24h        # Override time window for all sources
/qgsd:triage --limit 5          # Max 5 issues per source
```

After fetching, triage presents a prioritized table and routes the selected
issue to `/qgsd:debug` (errors/bugs) or `/qgsd:quick` (warnings/tasks).

Sentry sources (`sentry`, `sentry-feedback`) use the Sentry MCP server — no
`sentry-cli` installation required. The project slug is auto-detected if omitted.

## Adding new source types

The `bash` type is the universal escape hatch. Any tool with a CLI can be
integrated:

```yaml
- type: bash
  label: "Linear Urgent"
  command: "linear issue list --team ENG --priority urgent --format json"
  parser: json
```

```yaml
- type: bash
  label: "Datadog Monitors"
  command: "datadog-cli monitors list --status=Alert"
  parser: lines
```
