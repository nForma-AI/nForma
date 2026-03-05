---
phase: quick-172
plan: 01
subsystem: formal-verification, observability
tags: [analysis, assumptions, instrumentation, gap-report]
dependency-graph:
  requires: [debt-ledger, observe-registry, observe-handlers, formal-models]
  provides: [assumption-gap-analysis]
  affects: [observability-pipeline]
tech-stack:
  patterns: [fail-open, regex-parsing, cross-reference, metric-naming]
key-files:
  created:
    - bin/analyze-assumptions.cjs
    - bin/analyze-assumptions.test.cjs
    - test/fixtures/sample.tla
    - test/fixtures/sample.cfg
    - test/fixtures/sample.als
    - test/fixtures/sample.pm
    - test/fixtures/sample.props
decisions:
  - CONSTANTS regex scoped to indented continuation lines to avoid consuming ASSUME statements
  - Collision handling appends __source suffix (e.g., qgsd_maxsize__tla) for disambiguation
  - observe-handlers.cjs exports functions but does not self-register; cross-reference catches gracefully
metrics:
  duration: 7 minutes
  completed: 2026-03-05
---

# Quick Task 172: Build Assumption-to-Instrumentation Analysis Summary

CLI tool that parses TLA+/Alloy/PRISM formal models, extracts 567 assumptions/thresholds/invariants, cross-references against debt ledger and observe handlers, and outputs a structured gap report with qgsd_-prefixed metrics and instrumentation snippets for each uncovered assumption.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Build assumption extraction engine and gap analysis core | 8ccd9c45 | bin/analyze-assumptions.cjs |
| 2 | Create test fixtures and comprehensive unit tests | a3fce37a | bin/analyze-assumptions.test.cjs, test/fixtures/* |

## Implementation Details

### Parsers
- **TLA+ parser**: Extracts ASSUME statements (with threshold values), CONSTANTS declarations (indented block parsing), and invariant definitions (TypeOK, *Bounded, *Met patterns). Also parses MC*.cfg files for concrete constant values, INVARIANT names, and PROPERTY names.
- **Alloy parser**: Extracts fact blocks with numeric constraints, assert blocks, and numeric constraints from predicates.
- **PRISM parser**: Extracts const declarations (double/int with optional values), module variable bounds ([N..M]), and property thresholds from paired .props files (F<=N step bounds, P>=X probability thresholds).

### Cross-reference (two-tier matching)
1. Primary: debt entry `formal_ref` matches `spec:{file}:{name}`
2. Fallback fuzzy: when `formal_ref` is null, case-insensitive substring match on `entry.id` or `entry.title`
3. Handler matching: if `bash` or `internal` handler types are registered but no specific config targets assumption, classified as `partial`

### Gap Report
- Metric naming: `qgsd_` prefix + lowercase + non-alnum replaced with `_`
- Collision detection: appends `__source` suffix when multiple sources produce same metric name
- Metric types: gauge for thresholds/constants/bounds, counter for invariants/asserts
- Instrumentation snippets: observe handler JSON configs (bash for gauges, internal for counters)

### CLI
- `node bin/analyze-assumptions.cjs` -- full scan, JSON to stdout, markdown to `.formal/assumption-gaps.md`
- `--json` -- JSON only, no markdown
- `--output=path` -- custom markdown output path
- `--verbose` -- include coverage stats on stderr
- Exit code: 0 if no uncovered, 1 if gaps exist

## Verification Results

- Exports 8 functions (extractTlaAssumptions, extractTlaCfgValues, extractAlloyAssumptions, extractPrismAssumptions, scanAllFormalModels, crossReference, generateGapReport, formatMarkdownReport)
- 567 assumptions extracted from real .formal/ directory (107 TLA+ files, 42 Alloy files, 5 PRISM files)
- JSON output valid with correct counts
- Markdown gap report written to .formal/assumption-gaps.md
- 39 tests passing (TLA+ 5, cfg 4, Alloy 5, PRISM 6, scanner 4, cross-ref 4, gap report 7, markdown 2, integration 2)
- Missing .formal/ directory, empty files, and null formal_ref all handled gracefully

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CONSTANTS regex too greedy**
- **Found during:** Task 1 verification
- **Issue:** The CONSTANTS block regex `(?:\s+.*\n)*` consumed ASSUME lines that followed the CONSTANTS block, generating spurious constant entries for keywords like "Nat", "in", "ASSUME"
- **Fix:** Scoped regex to `(?:\s{2,}\S.*\n)*` (only indented continuation lines) and filtered identifiers to require uppercase first letter
- **Files modified:** bin/analyze-assumptions.cjs
- **Commit:** included in a3fce37a

## Self-Check: PASSED
