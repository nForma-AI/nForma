---
name: nf:session-insights
description: Analyze recent Claude session transcripts for friction patterns (tool failures, long sessions, iteration churn)
argument-hint: "[--sessions N]"
allowed-tools:
  - Read
  - Bash
---

<objective>
Scan recent session JSONL transcripts and surface friction patterns: repeated tool failures, abnormally long sessions, circuit breaker triggers, excessive file edits, and hook failures.
</objective>

<process>

## Step 1: Parse and validate arguments

From $ARGUMENTS, extract:
- `--sessions N` -> max sessions to scan (default: 20)
- Validate: if N is not a positive integer (e.g., negative, zero, NaN, non-numeric), default to 20

## Step 2: Run the handler

```javascript
const { handleSessionInsights } = require('./bin/observe-handler-session-insights.cjs');
const result = handleSessionInsights(
  { label: 'Session Insights', max_sessions: sessionsArg || 20 },
  { projectRoot: process.cwd() }
);
```

## Step 3: Render results

Display a header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma > SESSION INSIGHTS: Scanning last {N} sessions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

If result.status is 'error', display the error and stop.

If result.issues is empty:
```
All clear — no friction patterns detected in recent sessions.
```

Otherwise, render a table:
| # | Finding | Severity | Age | Details |
with each issue from result.issues.

Group by category for readability:
- Tool Failures
- Long Sessions
- Circuit Breaker
- File Churn
- Hook Failures

## Step 4: Suggest actions

For any warning-severity findings, suggest:
```
Suggested: /nf:quick "{issue title}" to address this friction pattern
```

</process>
