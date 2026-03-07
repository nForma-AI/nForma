---
name: nf:health
description: Diagnose planning directory health and optionally repair issues
argument-hint: [--repair] [--force]
allowed-tools:
  - Read
  - Bash
  - Write
  - AskUserQuestion
---
<objective>
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.
</objective>

<execution_context>
@~/.claude/nf/workflows/health.md
</execution_context>

<process>
Execute the health workflow from @~/.claude/nf/workflows/health.md end-to-end.
Parse --repair flag from arguments and pass to workflow.
</process>

<diagnostics>
## Available Diagnostic Scripts

These scripts provide detailed health diagnostics. The health workflow invokes them as needed, but they can also be run standalone. All scripts use fail-open: if a script is not found, the health workflow skips it silently.

### Quorum Slot Reachability
```bash
node bin/probe-quorum-slots.cjs
```
Parallel reachability probe for all configured quorum slots. Reports which MCP provider endpoints are responsive and their latency. Use when quorum dispatches are failing or timing out.

### XState Calibration Verification
```bash
node bin/verify-quorum-health.cjs
```
Verifies that the XState machine's maxDeliberation timeout is calibrated for actual empirical provider reliability. Flags miscalibration if empirical failure rates exceed the configured tolerance.

### MCP Server Health Check
```bash
node bin/check-mcp-health.cjs
```
Pre-flight health check for all MCP server instances. Tests connectivity and response time. Run before quorum dispatch to avoid wasting cycles on unreachable providers.

### MCP Log Analysis
```bash
node bin/review-mcp-logs.cjs
```
Scans MCP debug logs for timing anomalies, failures, and hangs. Produces a health report summarizing error patterns and latency outliers.

### Telemetry Collection
```bash
node bin/telemetry-collector.cjs
```
Pure disk I/O telemetry collector. Gathers operational metrics from local telemetry files for analysis by other diagnostic tools (e.g., issue-classifier.cjs).
</diagnostics>
