---
phase: quick-289
verified: 2026-03-14T00:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Quick Task 289: Wire UPPAAL and Petri net support into close-formal-gaps Verification Report

**Task Goal:** Wire UPPAAL and Petri net support into close-formal-gaps for user project spec generation

**Verified:** 2026-03-14
**Status:** PASSED — All 7 observable truths verified, all 2 artifacts complete and wired, no anti-patterns detected.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | close-formal-gaps selects UPPAAL for requirements involving real-time constraints (timeouts, heartbeats, SLAs, deadlines) | ✓ VERIFIED | Formalism selection table row: "Real-time constraints, timed deadlines, heartbeats \| **UPPAAL** \| Timeout enforcement, race conditions, timed protocol phases, SLA deadlines" — found in core/workflows/close-formal-gaps.md line 92 |
| 2 | close-formal-gaps selects Petri net for requirements involving concurrency, pipelines, resource contention, or token-based workflows | ✓ VERIFIED | Formalism selection table row: "Concurrent workflows, resource contention, pipelines \| **Petri net** \| Pipeline stages, token-based concurrency, producer-consumer, resource pools" — found in core/workflows/close-formal-gaps.md line 93 |
| 3 | close-formal-gaps generates UPPAAL .xml + .q files following the quorum-races.xml convention when UPPAAL formalism is selected | ✓ VERIFIED | Section "UPPAAL timed automata" (line 156+) includes: `.xml` file generation with `<nta>`, `<declaration>`, `<template>`, `<system>` structure; `.q` query file format with safety/reachability queries; file naming convention `<descriptive-name>.xml` and `.q` in `.planning/formal/uppaal/` |
| 4 | close-formal-gaps generates Petri .dot files following the quorum-petri-net.dot convention when Petri formalism is selected | ✓ VERIFIED | Section "Petri net models" (line 181+) includes: `.dot` file generation in Graphviz DOT format with bipartite graph convention (places as circles, transitions as rectangles); optional `.json` companion file; `rankdir=LR` flow specification; `@requirement` annotation format |
| 5 | The --formalism flag accepts uppaal as a valid override option and is verified in both workflow and skill command | ✓ VERIFIED | Workflow: `--formalism=tla\|alloy\|prism\|petri\|uppaal` found on line 103. Skill command (commands/nf/close-formal-gaps.md): `--formalism=tla\|alloy\|prism\|petri\|uppaal` appears in both `argument-hint` (line 4) and `<process>` flag documentation (line 31). All three locations include `uppaal` as pipe-delimited option. |
| 6 | run-formal-verify.cjs already discovers and runs UPPAAL and Petri models from .planning/formal/{uppaal,petri}/ with no code changes needed | ✓ VERIFIED | Dynamic discovery code present: Lines 196-209 scan `.planning/formal/uppaal/` for `.xml` files and create step entries; Lines 179-194 scan `.planning/formal/petri/` for `.dot` files. Custom search_dirs scanning (lines 269-300) also includes UPPAAL and Petri discovery. Comments document `--only=uppaal` and `--only=petri` as valid filter options. No code changes required — discovery already exists. |
| 7 | run-uppaal.cjs gracefully degrades when verifyta is missing: writes warning to stderr, exits 0 with result=inconclusive, never crashes the verification suite | ✓ VERIFIED | Lines 115-137: when verifyta not found, writes diagnostic to stderr (lines 118-122), writes check result with `result: 'inconclusive'` and `triage_tags: ['no-verifyta']` (lines 123-135), exits 0 (line 136). No exception thrown; graceful degradation confirmed. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `core/workflows/close-formal-gaps.md` | Extended workflow with UPPAAL and Petri generation instructions | ✓ VERIFIED | File exists (286 lines). Contains: (1) formalism selection table with UPPAAL and Petri rows, (2) Formalism Selection Disambiguation section with 4 heuristics, (3) Step 4 UPPAAL study reference, (4) Step 5 UPPAAL generation subsection with XML DTD structure and concrete entity escaping example, (5) enhanced Petri .dot generation subsection, (6) Step 6 UPPAAL checker reference with graceful degradation documentation. Total: 10 occurrences of uppaal/UPPAAL across all sections. |
| `commands/nf/close-formal-gaps.md` | Skill command with uppaal in --formalism flag | ✓ VERIFIED | File exists (33 lines). Contains: (1) updated `description` listing all 5 formalisms "TLA+/Alloy/PRISM/Petri/UPPAAL", (2) `argument-hint` with `--formalism=tla\|alloy\|prism\|petri\|uppaal`, (3) `<process>` flag documentation with same formalism list. All 3 locations include `uppaal`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| core/workflows/close-formal-gaps.md | .planning/formal/uppaal/ | Step 4 study reference + Step 5 generation path | ✓ WIRED | Explicit references to `.planning/formal/uppaal/quorum-races.xml` (line 119), `.planning/formal/uppaal/` directory (line 177). Workflow instructs users to read existing UPPAAL models and create new ones in this directory. |
| core/workflows/close-formal-gaps.md | bin/run-uppaal.cjs | Step 6 checker invocation | ✓ WIRED | Explicit reference: "verifyta <model.xml> <model.q>" invocation described on line 207. Documentation of run-uppaal.cjs behavior, graceful degradation, and integration with run-formal-verify.cjs (lines 207-211). |
| commands/nf/close-formal-gaps.md | core/workflows/close-formal-gaps.md | execution_context reference | ✓ WIRED | Skill command references workflow at `@/Users/jonathanborduas/.claude/nf/workflows/close-formal-gaps.md` (line 21). Command passes all --flags through to the workflow (lines 26-32). Execution is fully delegated to workflow. |
| core/workflows/close-formal-gaps.md (repo source) | ~/.claude/nf/workflows/close-formal-gaps.md (installed location) | Install sync | ✓ WIRED | Verified via `diff` — output is empty (0 lines). Installed workflow is an exact copy of repo source. |

### Artifact Verification — Three Levels

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| `core/workflows/close-formal-gaps.md` | ✓ | ✓ (286 lines, comprehensive sections) | ✓ (synced to ~/.claude/nf/, referenced by skill command) | ✓ VERIFIED |
| `commands/nf/close-formal-gaps.md` | ✓ | ✓ (33 lines, all 5 formalisms listed in 3 places) | ✓ (references workflow, workflow is complete) | ✓ VERIFIED |

### Content Quality Checks

**No anti-patterns detected:**
- No TODO/FIXME/XXX/HACK placeholders
- No "coming soon" or empty stubs
- No console.log-only implementations
- No return null/return {} placeholders

**XML entity escaping documentation:**
- Concrete example provided: `` `x < 500` in `<label kind="guard">` MUST be written as `<label kind="guard">x &lt; 500</label>` ``
- Secondary example: `` `x <= TIMEOUT` becomes `<label kind="invariant">x &lt;= TIMEOUT</label>` ``
- Warning about malformed XML and silent verifyta rejection

**Formalism disambiguation heuristics:**
- UPPAAL over TLA+ (clock-based timing vs. logical ordering)
- UPPAAL over PRISM (reachability vs. stochastic)
- Petri net over TLA+ (concurrent resource flow vs. protocol states)
- Petri net over Alloy (dynamic flow vs. static constraints)

## Completion Verification

### Plan Success Criteria Met

- [x] close-formal-gaps workflow has UPPAAL in formalism selection table with disambiguation heuristics
- [x] close-formal-gaps workflow has UPPAAL .xml + .q generation template with full XML DTD structure reference
- [x] close-formal-gaps workflow has enhanced Petri .dot generation template with bipartite constraint and optional .json
- [x] close-formal-gaps workflow references verifyta for UPPAAL checking with graceful degradation details
- [x] close-formal-gaps workflow UPPAAL template includes concrete XML entity escaping example
- [x] Skill command accepts --formalism=uppaal (verified in both argument-hint and process flag docs)
- [x] Installed workflow is synced to ~/.claude/nf/workflows/

### Task Completion

**Task 1: Extend close-formal-gaps workflow** — COMPLETE
- Formalism table extended with UPPAAL and Petri rows (Step 3)
- Formalism Selection Disambiguation subsection added with 4 heuristics
- Step 4 UPPAAL study reference added
- Step 5 UPPAAL generation subsection with complete XML DTD template and escaping example
- Step 5 Petri generation subsection enhanced with bipartite constraint details
- Step 6 UPPAAL checker reference added with graceful degradation documentation

**Task 2: Update skill command and sync installed workflow** — COMPLETE
- Skill command description updated: "TLA+/Alloy/PRISM/Petri/UPPAAL"
- Skill command argument-hint updated: `--formalism=tla|alloy|prism|petri|uppaal`
- Skill command process flag documentation updated with full formalism list
- Installed workflow synced to ~/.claude/nf/workflows/close-formal-gaps.md (verified via diff)

### Integration Verification

**run-formal-verify.cjs already supports UPPAAL and Petri** — No code changes needed
- Dynamic discovery for `.xml` files in `.planning/formal/uppaal/` (lines 196-209)
- Dynamic discovery for `.dot` files in `.planning/formal/petri/` (lines 179-194)
- Custom search_dirs scanning includes both formalisms (lines 269-300)
- `--only=uppaal` and `--only=petri` filter options documented and implemented

**run-uppaal.cjs graceful degradation is complete** — Fully implemented
- Missing verifyta detection and stderr warning (lines 115-122)
- Inconclusive result with triage_tags: ['no-verifyta'] (lines 123-135)
- Exit 0 (no crash) guaranteed (line 136)
- Integration with run-formal-verify.cjs via nonCritical: true (verified in run-formal-verify.cjs line 208)

## Summary

**All goal deliverables verified:**

1. **UPPAAL Selection Logic** — Workflow includes formalism selection table with UPPAAL row and detailed disambiguation heuristics for when to choose UPPAAL over TLA+/PRISM.

2. **UPPAAL Generation Template** — Comprehensive .xml and .q file generation instructions with full XML DTD structure reference, element specifications, and concrete XML entity escaping example to prevent malformed output.

3. **Petri Net Enhancement** — Existing Petri section enhanced with bipartite graph constraint documentation, place/transition node shape specifications, rankdir conventions, and optional .json companion format.

4. **Formalism Flag** — `--formalism=uppaal` added as valid override option in both workflow and skill command with consistent pipe-delimited format across all occurrences.

5. **Runtime Integration** — run-formal-verify.cjs already discovers and executes UPPAAL/Petri models dynamically; run-uppaal.cjs gracefully degrades when verifyta is missing.

6. **Workflow Sync** — Installed workflow at ~/.claude/nf/workflows/ is in sync with repo source (verified via diff).

**Status: PASSED** — The quick task achieves its goal: close-formal-gaps now has complete UPPAAL and Petri net support with generation templates, selection heuristics, and runtime integration.

---

_Verified: 2026-03-14_
_Verifier: Claude (nf-verifier)_
