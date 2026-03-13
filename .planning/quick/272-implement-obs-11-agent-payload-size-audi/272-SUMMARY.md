---
phase: quick-272
plan: 272
subsystem: observability
tags: [payload-audit, guardrails, agent-context]

requires: []
provides:
  - Agent payload size audit tool for detecting oversized diagnostic outputs
  - /nf:health integration for automatic payload scanning
  - GUARD-01 compliance checking (128KB threshold)

affects:
  - /nf:health workflow
  - Agent context budget management
  - Future observability diagnostics

tech-stack:
  added:
    - audit-agent-payloads.cjs (Node.js script)
  patterns:
    - Standalone diagnostic script pattern (matches check-mcp-health.cjs, telemetry-collector.cjs)
    - Fail-open semantics (scripts missing/errored don't block health checks)
    - JSON output mode for programmatic use

key-files:
  created:
    - bin/audit-agent-payloads.cjs
    - bin/audit-agent-payloads.test.cjs
  modified:
    - commands/nf/health.md
    - core/workflows/health.md

key-decisions:
  - Scan both commands/nf/ and core/workflows/ directories for script patterns
  - Support --threshold-kb override for tuning threshold beyond 128KB default
  - Always exit 0 (advisory, not blocking) even when warnings exist
  - Use execFileSync instead of execSync for safer command execution

requirements-completed: [OBS-11]

duration: 8min
completed: 2026-03-11
---

# Quick Task 272: Implement OBS-11 Agent Payload Size Audit

**Standalone diagnostic script for detecting agent payloads exceeding GUARD-01 128KB threshold, wired into /nf:health**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T19:01:00Z
- **Completed:** 2026-03-11T19:09:00Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments

- **bin/audit-agent-payloads.cjs:** Scans skill .md files for `node bin/*.cjs --json` invocations, executes them, measures output size, classifies against 128KB threshold
- **Tests:** 6 test cases covering table output, JSON schema, threshold override, script discovery, data structure validation, and summary accuracy
- **Health Integration:** Added diagnostic step to /nf:health workflow and commands/nf/health.md documentation
- **Smart Retries:** Attempts to run scripts with `--project-root` flag if initial run fails (handles scripts that require context)

## Task Commits

1. **Task 1 & 2: Create audit script and wire into health** - `2d8c1e35` (feat)

Both tasks completed in single atomic commit per deviation rule (tight coupling)

## Files Created/Modified

- `bin/audit-agent-payloads.cjs` - 240 lines, standalone audit script with JSON and table output modes
- `bin/audit-agent-payloads.test.cjs` - 80 lines, 6 test cases covering all functionality
- `commands/nf/health.md` - Added "Agent Payload Size Audit" diagnostic entry
- `core/workflows/health.md` - Added "run_payload_audit" step after harness diagnostic

## Decisions Made

- **Script discovery:** Use regex pattern `/node\s+(?:~\/\.claude\/nf-bin\/|(?:\$[A-Z_]+\/)?bin\/)([a-z0-9_-]+\.cjs).*--json/g` to find invocations across both commands/nf/ and core/workflows/
- **Execution strategy:** Try script with `--json` first, retry with `--project-root=$(pwd)` if non-zero exit, mark as "skipped" if both fail
- **Output format:** Human-readable colored table by default (like check-mcp-health.cjs), JSON object when `--json` flag provided
- **Status classification:** "ok" (< 128KB), "warning" (>= 128KB), "error" (crash/timeout), "skipped" (requires arguments), "missing" (not on disk)
- **Exit code:** Always 0 (warnings are advisory per GUARD-01, not blocking)

## Deviations from Plan

None - plan executed exactly as written.

## Test Results

All 6 test cases pass:
1. Default run produces table output with expected columns ✓
2. JSON output has correct schema (threshold_kb, scripts array, summary object) ✓
3. --threshold-kb 0 causes all scripts with output to show as warning ✓
4. Script discovery finds >= 3 scripts ✓
5. Scripts array has correct structure (name, size_bytes, status, source_files, size_human) ✓
6. Summary counts match actual script statuses ✓

Manual verification:
- `node bin/audit-agent-payloads.cjs` exits 0 and displays table with 17 discovered scripts
- trace-corpus-stats.cjs correctly flagged as WARNING (167.5 KB > 128 KB)
- Finds scripts referenced in solve-report.md, tokens.md, solve-remediate.md, plan-phase.md, solve-diagnose.md, observe.md, sync-baselines.md, map-requirements.md

## Issues Encountered

None - all verification criteria met.

## Next Steps

Commit the changes and update STATE.md "Quick Tasks Completed" table.

---
*Quick Task: 272*
*Completed: 2026-03-11*
