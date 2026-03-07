---
phase: quick-201
verified: 2026-03-07T01:30:00Z
status: gaps_found
score: 1/3 must-haves verified
gaps:
  - truth: "Every bin/ script is classified as either wired (referenced by a skill command or hook) or lone (unreferenced)"
    status: failed
    reason: "19 actual non-test bin/ scripts on disk are missing from both wired_summary and lone_producers. 16 appear only in transitive_chains but were never added to the main inventory. 3 are completely unaccounted for (generate-traceability-matrix.cjs, install-formal-tools.cjs, run-sensitivity-sweep.cjs). Additionally, total_bin_scripts claims 154 but actual count on disk is 153."
    artifacts:
      - path: ".planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json"
        issue: "19 on-disk scripts missing from wired/lone classification; phantom scripts (old-script.cjs, missing.cjs, foo.cjs) in wired_summary that do not exist on disk"
    missing:
      - "Add 19 missing scripts to either wired_summary or lone_producers: check-liveness-fairness.cjs, generate-traceability-matrix.cjs, install-formal-tools.cjs, nForma.cjs, run-account-manager-tlc.cjs, run-account-pool-alloy.cjs, run-alloy.cjs, run-audit-alloy.cjs, run-breaker-tlc.cjs, run-installer-alloy.cjs, run-oauth-rotation-prism.cjs, run-oscillation-tlc.cjs, run-phase-tlc.cjs, run-protocol-tlc.cjs, run-quorum-composition-alloy.cjs, run-sensitivity-sweep.cjs, run-stop-hook-tlc.cjs, run-transcript-alloy.cjs, run-uppaal.cjs"
      - "Remove phantom entries from wired_summary: bin/old-script.cjs, bin/missing.cjs, bin/foo.cjs do not exist on disk"
      - "Correct total_bin_scripts from 154 to 153 (actual count)"
  - truth: "Survey output is machine-readable JSON for downstream tooling"
    status: partial
    reason: "JSON parses and schema matches plan, but data quality issues would cause downstream tooling failures: wired_summary contains 44 test file references that should be excluded, bin/gsd-tools.cjs is referenced 40+ times but does not exist in repo bin/ (it exists only at installed path ~/.claude/nf/bin/gsd-tools.cjs), and 3 phantom script names appear"
    artifacts:
      - path: ".planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json"
        issue: "wired_summary contains test files (*.test.cjs) and non-existent scripts; any tool iterating wired paths would get file-not-found errors"
    missing:
      - "Remove all *.test.cjs entries from wired_summary (44 entries in by_package_json)"
      - "Resolve bin/gsd-tools.cjs references -- either note it as an installed-path-only script or map to the actual repo equivalent"
      - "Remove bin/old-script.cjs, bin/missing.cjs, bin/foo.cjs from by_skill_command"
---

# Quick Task 201: Bin Script Survey Verification Report

**Phase Goal:** Survey code for producer-without-consumer lone features not wired into top-level skills
**Verified:** 2026-03-07T01:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every bin/ script is classified as either wired or lone | FAILED | 19 of 153 actual non-test bin/ scripts are absent from both wired_summary and lone_producers. 16 appear only in transitive_chains but were not added to the main inventory. 3 are completely missing. |
| 2 | Lone producers are documented with purpose and potential skill integration point | VERIFIED | All 68 lone_producers entries have path, purpose, classification, suggested_skill, referenced_by, and has_companion_test fields. Zero entries missing required fields. Classifications: 60 standalone_tool, 7 internal_utility, 1 test_helper. |
| 3 | Survey output is machine-readable JSON for downstream tooling | PARTIAL | JSON parses correctly and schema matches plan (lone_producers, wired_summary with 7 consumer categories, transitive_chains with 28 entries). However, wired_summary contains 44 test file references in by_package_json and references to non-existent scripts (old-script.cjs, missing.cjs, foo.cjs, gsd-tools.cjs). |

**Score:** 1/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `201-lone-producers.json` | Structured inventory of all bin scripts | Exists, substantive, data quality issues | 1,037 lines, valid JSON, has all required top-level keys. However, inventory is incomplete (19 scripts missing) and contains phantom entries. |
| `201-SUMMARY.md` | Human-readable summary of findings | VERIFIED | Contains stats table, high-value integration tiers, dead code candidates, internal utilities check, transitive chains, coverage metric. All 6 required sections present. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| commands/nf/*.md | bin/*.cjs | script references | PARTIALLY VERIFIED | 8 skill commands mapped in by_skill_command, but includes phantom entries (old-script.cjs, missing.cjs, foo.cjs) |
| hooks/*.js | bin/*.cjs | require/spawn calls | VERIFIED | 2 hooks mapped (nf-prompt.js, nf-post-edit-format.js) |
| ~/.claude/nf/workflows/*.md | bin/*.cjs | installed workflow references | DATA QUALITY ISSUE | References bin/gsd-tools.cjs which does not exist in repo bin/ directory (only at installed path) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| QUICK-201 | 201-PLAN.md | Survey bin/ for lone producers | PARTIAL | Inventory produced but incomplete -- 19 scripts unaccounted for |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 201-lone-producers.json | wired_summary.by_skill_command | Phantom entries: old-script.cjs, missing.cjs, foo.cjs | WARNING | Downstream tooling would fail on file-not-found |
| 201-lone-producers.json | wired_summary.by_package_json | 44 test file (.test.cjs) entries | WARNING | Test files should not appear in production wiring inventory |
| 201-lone-producers.json | wired_summary (multiple) | 40+ references to bin/gsd-tools.cjs (does not exist in repo) | WARNING | Post-rebrand stale reference; file exists only at ~/.claude/nf/bin/ |
| 201-lone-producers.json | top-level | total_bin_scripts: 154 vs actual 153 | INFO | Off-by-one count |

### Human Verification Required

None -- all checks are automatable for this survey task.

### Gaps Summary

The survey successfully identified and documented 68 lone producers with complete metadata (Truth 2 passes cleanly). However, the completeness guarantee (Truth 1) fails because 19 actual scripts on disk were omitted from the main wired/lone classification. Most of these (16) are formal verification runners that appear in transitive_chains but were never added to wired_summary. The remaining 3 (generate-traceability-matrix.cjs, install-formal-tools.cjs, run-sensitivity-sweep.cjs) are completely unaccounted for.

The data quality of wired_summary (Truth 3) is degraded by phantom script references, test file inclusion, and stale post-rebrand paths. These issues would cause downstream tooling that iterates wired paths to encounter file-not-found errors.

**Root cause:** The transitive chain analysis identified scripts as transitively reachable but did not add them back to wired_summary. Additionally, the bin/ directory scan appears to have been performed against a stale or partial file listing rather than the actual filesystem.

---

_Verified: 2026-03-07T01:30:00Z_
_Verifier: Claude (nf-verifier)_
