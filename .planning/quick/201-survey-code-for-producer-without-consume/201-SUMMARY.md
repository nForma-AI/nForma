---
phase: quick
plan: 201
subsystem: tooling
tags: [bin-scripts, dead-code, code-survey, dependency-graph]

requires:
  - phase: none
    provides: existing bin/ directory with 153 scripts
provides:
  - Machine-readable JSON inventory of all bin/ scripts with wired/lone classification
  - Coverage metric and integration recommendations for orphaned scripts
affects: [solve, observe, quorum, health, close-formal-gaps]

tech-stack:
  added: []
  patterns: [reference-graph-analysis, consumer-surface-scanning]

key-files:
  created:
    - .planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json
    - .planning/quick/201-survey-code-for-producer-without-consume/201-SUMMARY.md
  modified: []

key-decisions:
  - "Dynamic dispatch via run-formal-verify.cjs counted as wired -- spawnSync-based runners are transitively reachable"
  - "nForma.cjs classified as wired entry point despite no skill command routing to it -- it is the primary TUI/CLI"
  - "install.js bulk copy of all .cjs to nf-bin/ does NOT count as wiring -- scripts must have a consumer that invokes them"

patterns-established:
  - "Consumer surface scanning: skill commands, hooks, core workflows, installed workflows, package.json, install.js, MCP server, cross-bin requires, dynamic dispatch"

requirements-completed: [QUICK-201]

duration: 8min
completed: 2026-03-07
---

# Quick Task 201: Bin Script Survey Summary

**53.6% of 153 non-test bin/ scripts are reachable from user-facing /nf: commands; 71 standalone tools, utilities, and helpers remain unwired lone producers**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-07T00:10:35Z
- **Completed:** 2026-03-07T00:19:00Z
- **Tasks:** 2
- **Files created:** 2

## Stats Overview

| Metric | Count |
|--------|-------|
| Total non-test bin/ scripts | 153 |
| Wired (reachable from consumers) | 82 |
| Lone producers (unreferenced) | 71 |
| Coverage | 53.6% |

### Lone Producer Classification Breakdown

| Classification | Count | Description |
|---------------|-------|-------------|
| standalone_tool | 63 | CLI tools with argv parsing or main-module execution |
| internal_utility | 7 | Library modules exporting functions, no direct consumer found |
| test_helper | 1 | Used exclusively in test contexts |

### Companion Test Coverage

- 52 of 71 lone producers have companion `.test.cjs` files (73%)
- This indicates intentional, quality-built code -- not throwaway scripts

## High-Value Integration Opportunities

These standalone tools provide significant user-facing value and should be wired into existing /nf: commands or given their own skill entry points.

### Tier 1: Formal Verification Tools (should wire into /nf:solve or /nf:close-formal-gaps)

| Script | Purpose | Suggested Skill |
|--------|---------|----------------|
| `gate-a-grounding.cjs` | Measures L1 evidence vs L2 semantics alignment | /nf:solve |
| `gate-b-abstraction.cjs` | Verifies L3 reasoning artifacts have valid derived_from links | /nf:solve |
| `gate-c-validation.cjs` | Verifies L3 failure modes map to test recipes | /nf:solve |
| `cross-layer-dashboard.cjs` | Aggregates L1, Gate A/B/C scores into single view | /nf:solve |
| `hazard-model.cjs` | FMEA scoring (Severity x Occurrence x Detection = RPN) | /nf:solve |
| `risk-heatmap.cjs` | Combines FMEA RPN with coverage gap data | /nf:solve |
| `generate-formal-specs.cjs` | Generates ALL formal artifacts from XState machine | /nf:close-formal-gaps |
| `generate-petri-net.cjs` | Generates DOT + SVG Petri Net visualization | /nf:close-formal-gaps |
| `generate-tla-cfg.cjs` | Generates TLA+ config files from XState machine | /nf:close-formal-gaps |
| `lint-formal-models.cjs` | Finds fat, unbounded, overly complex models | /nf:solve |
| `promote-gate-maturity.cjs` | Manages ADVISORY -> SOFT_GATE -> HARD_GATE transitions | /nf:solve |
| `analyze-state-space.cjs` | Estimates state-space size per TLA+ model | /nf:solve |
| `export-prism-constants.cjs` | Exports scoreboard TP/UNAVAIL rates to PRISM constants | /nf:close-formal-gaps |
| `prism-priority.cjs` | PRISM failure probability ranker for roadmap signals | /nf:solve |
| `quorum-formal-context.cjs` | Generates formal_spec_summary for quorum prompts | /nf:solve |
| `generate-traceability-matrix.cjs` | Generates bidirectional requirements-to-properties index | /nf:solve |
| `install-formal-tools.cjs` | Installs formal verification tool dependencies (TLC, Alloy, PRISM) | /nf:close-formal-gaps |
| `run-sensitivity-sweep.cjs` | Varies key model parameters and records outcome deltas | /nf:solve |

These 18 scripts form a coherent formal verification toolkit that could be orchestrated by `/nf:solve` as sub-steps.

### Tier 2: Quorum and Health Tools

| Script | Purpose | Suggested Skill |
|--------|---------|----------------|
| `call-quorum-slot.cjs` | Bash-callable quorum slot dispatcher | /nf:quorum |
| `quorum-slot-dispatch.cjs` | Prompt construction + output parsing for quorum slots | /nf:quorum |
| `probe-quorum-slots.cjs` | Parallel reachability probe for quorum slots | /nf:quorum |
| `verify-quorum-health.cjs` | Verifies XState maxDeliberation calibration | /nf:quorum |
| `check-mcp-health.cjs` | Pre-flight health check for MCP server instances | /nf:health |
| `review-mcp-logs.cjs` | Scans debug logs for MCP timing/failures/hangs | /nf:health |
| `telemetry-collector.cjs` | Pure disk I/O telemetry collector | /nf:health |

### Tier 3: Observability and Analysis Tools

| Script | Purpose | Suggested Skill |
|--------|---------|----------------|
| `attribute-trace-divergence.cjs` | Root-cause attribution for XState divergences | /nf:solve |
| `state-candidates.cjs` | Mines traces for unmodeled state candidates | /nf:solve |
| `trace-corpus-stats.cjs` | Indexes conformance events by session/action/transition | /nf:solve |
| `observed-fsm.cjs` | Derives observed-behavior FSM from trace data | /nf:observe |
| `sensitivity-sweep-feedback.cjs` | Compares empirical TP rate with sweep predictions | /nf:observe |
| `security-sweep.cjs` | Standalone security scanner | /nf:observe |
| `design-impact.cjs` | Three-layer git diff impact analysis | /nf:plan-phase |
| `issue-classifier.cjs` | Ranks operational issues by severity from telemetry | /nf:solve |

### Tier 4: Standalone Utilities (candidates for new /nf: commands)

| Script | Purpose | New Skill? |
|--------|---------|-----------|
| `set-secret.cjs` | CLI secret setter (wraps secrets.cjs) | Wire into /nf:mcp-setup |
| `validate-requirements-haiku.cjs` | Semantic requirements validator via Claude Haiku | Wire into /nf:map-requirements |
| `git-heatmap.cjs` | Mines git history for churn/hotspot data | Wire into /nf:solve |
| `migrate-planning.cjs` | Auto-migrate .planning/ directory layout | Wire into /nf:update |
| `gh-account-rotate.cjs` | Rotate gh auth accounts for copilot slots | Wire into /nf:quorum |

## Dead Code Candidates

No scripts are classified as `dead_code`. All 71 lone producers export functions or accept CLI arguments, indicating they were deliberately built. However, several have minimal consumers:

- `bin/ccr-secure-config.cjs` and `bin/ccr-secure-start.cjs` -- CCR (claude-code-router) integration that may be deprecated if CCR is no longer used
- `bin/blessed-terminal.cjs` -- Drop-in blessed-xterm replacement; only useful if TUI terminal widget is active
- `bin/check-coverage-guard.cjs` -- CI coverage guard with no CI pipeline referencing it
- `bin/count-scenarios.cjs` -- Scenario counter with no consumer

## Internal Utilities Check

7 scripts classified as `internal_utility` export functions but have no consumer found:

| Script | Purpose | Status |
|--------|---------|--------|
| `bin/blessed-terminal.cjs` | XTerm widget replacement | Potentially orphaned -- no TUI code imports it |
| `bin/budget-tracker.cjs` | Token budget calculation | Likely consumed by nForma.cjs dynamically |
| `bin/conformance-schema.cjs` | Event field enumerations | Used by test files only -- borderline test_helper |
| `bin/debt-retention.cjs` | Debt retention policy | Potentially consumed by observe-debt-writer.cjs dynamically |
| `bin/formal-core.cjs` | Formal verification data functions | May be consumed by TUI code |
| `bin/quorum-cache.cjs` | Cache key computation + file I/O | Likely consumed by quorum dispatch at runtime |
| `bin/stall-detector.cjs` | Quorum slot stall detection | Likely consumed by quorum dispatch at runtime |

**Verdict:** Budget-tracker, quorum-cache, and stall-detector are likely consumed at runtime by the quorum workflow but through dynamic requires or config-driven paths not captured by static analysis. Blessed-terminal and formal-core may be genuinely orphaned.

## Transitive Chains (depth >= 2)

11 transitive chains have depth >= 2, indicating multi-layer dependency trees:

| Root Script | Chain Length | Max Depth | Root Consumer |
|------------|-------------|-----------|---------------|
| `nForma.cjs` | 10 scripts | 2 | CLI TUI entry point |
| `observe-debt-writer.cjs` | 7 scripts | 2 | commands/nf/observe.md |
| `nf-solve.cjs` | 7 scripts | 2 | commands/nf/solve.md |
| `quorum-consensus-gate.cjs` | 5 scripts | 2 | nf-prompt.js hook |
| `run-oscillation-tlc.cjs` | 3 scripts | 2 | run-formal-verify.cjs |
| `run-breaker-tlc.cjs` | 3 scripts | 2 | run-formal-verify.cjs |
| `run-protocol-tlc.cjs` | 3 scripts | 2 | run-formal-verify.cjs |
| `run-account-manager-tlc.cjs` | 3 scripts | 2 | run-formal-verify.cjs |
| `run-stop-hook-tlc.cjs` | 3 scripts | 2 | run-formal-verify.cjs |
| `run-phase-tlc.cjs` | 2 scripts | 2 | run-formal-verify.cjs |
| `check-liveness-fairness.cjs` | 3 scripts | 2 | run-formal-verify.cjs |

The deepest chains are nForma.cjs (10 dependencies) and the observe/solve stacks (7 each). All formal runner chains share a common pattern: runner -> write-check-result.cjs + run-tlc.cjs + requirement-map.cjs.

## Coverage Metric

**53.6% of non-test bin/ scripts are reachable from user-facing /nf: skill commands.**

Wired by consumer type:
- 8 skill commands reference bin/ scripts directly
- 2 hooks reference bin/ scripts (nf-prompt.js, nf-post-edit-format.js)
- 20+ core/installed workflows reference gsd-tools.cjs and other bin/ scripts
- 19 formal runner scripts wired via run-formal-verify.cjs dynamic dispatch
- Extensive cross-bin require() chains provide transitive coverage

## Accomplishments

- Complete machine-readable inventory (201-lone-producers.json) classifying all 153 non-test bin/ scripts
- Identified 71 lone producers with purpose, classification, and suggested skill integration
- Mapped 28 transitive dependency chains with depth metadata
- Produced actionable integration recommendations organized by priority tier
- 73% of lone producers have companion tests, indicating high-quality orphaned code

## Task Commits

1. **Task 1: Build reference graph and lone producer inventory** - `60377297` (feat)
2. **Task 2: Produce human-readable summary** - pending (this file)

## Decisions Made

- Dynamic dispatch via `run-formal-verify.cjs` counted as wired: spawnSync-based runner references are functionally equivalent to require() for reachability analysis
- `nForma.cjs` classified as wired entry point: it is the primary TUI/CLI and gets installed to `~/.claude/nf-bin/`
- `install.js` bulk copy of all `.cjs` to `nf-bin/` does NOT count as wiring: presence in nf-bin does not mean any consumer invokes the script

## Deviations from Plan

### Post-verification fixes

1. **19 missing scripts classified:** 16 transitively-wired formal runners added to wired_summary.by_other_bin under run-formal-verify.cjs; nForma.cjs added as wired entry point; 3 scripts (generate-traceability-matrix.cjs, install-formal-tools.cjs, run-sensitivity-sweep.cjs) added as lone producers.
2. **Phantom entries removed:** bin/old-script.cjs, bin/missing.cjs, bin/foo.cjs, bin/nf.cjs, bin/check-spec.cjs removed from wired_summary (do not exist on disk).
3. **Test files removed:** 46 .test.cjs entries removed from wired_summary.by_package_json (test files excluded per plan scope).
4. **gsd-tools.cjs documented:** Added notes field explaining bin/gsd-tools.cjs exists only at installed path (~/.claude/nf/bin/), not in repo bin/.
5. **Counts corrected:** total_bin_scripts 154->153, wired 86->82, lone 68->71, coverage 55.8%->53.6%.

## Issues Encountered

None.

## Next Steps

1. **Quick win:** Wire gate-a/b/c, cross-layer-dashboard, and hazard-model into `/nf:solve` remediation flow
2. **Medium effort:** Create `/nf:formal-dashboard` skill command aggregating cross-layer-dashboard, lint-formal-models, and coverage metrics
3. **Housekeeping:** Confirm CCR scripts (ccr-secure-config, ccr-secure-start) are still needed; archive if deprecated
4. **CI integration:** Wire check-coverage-guard.cjs and check-bundled-sdks.cjs into CI pipeline

---
*Quick Task: 201*
*Completed: 2026-03-07*
