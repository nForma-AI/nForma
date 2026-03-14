---
phase: quick-289
plan: 01
subsystem: formal-verification
tags:
  - formal-methods
  - UPPAAL
  - petri-nets
  - workflow-extension
tech_stack:
  - UPPAAL timed automata
  - Petri net models
  - Graphviz DOT format
  - XML DTD
key_files:
  - core/workflows/close-formal-gaps.md
  - commands/nf/close-formal-gaps.md
decisions:
  - UPPAAL and Petri formalism selection heuristics integrated into Step 3
  - Concrete XML entity escaping example provided (x &lt; 500) to prevent malformed XML generation
  - run-uppaal.cjs graceful degradation documented (exits 0 with inconclusive when verifyta missing)
---

# Quick Task 289: Wire UPPAAL and Petri net support into close-formal-gaps

**Completed:** 2026-03-14

## Summary

Extended the close-formal-gaps workflow to support UPPAAL timed automata and Petri net spec generation for user project requirements. The workflow previously referenced these formalisms but lacked generation templates and heuristics. UPPAAL and Petri selection logic, XML/DOT generation templates, and model checker integration are now complete and documented in the workflow.

## Tasks Completed

### Task 1: Extend close-formal-gaps workflow with UPPAAL and Petri generation instructions

Modified `core/workflows/close-formal-gaps.md` with these changes:

**Step 3 (Select Formalism) — Extended formalism table and added disambiguation section:**
- Added UPPAAL row: "Real-time constraints, timed deadlines, heartbeats | **UPPAAL** | Timeout enforcement, race conditions, timed protocol phases, SLA deadlines"
- Added Petri row enhancement: Explicitly added "pipelines" to pattern, expanded "when" to include "producer-consumer, resource pools"
- Added new "Formalism Selection Disambiguation" subsection with 4 clear disambiguation rules:
  - UPPAAL over TLA+ when requirement mentions clock-based timing (ms/s deadlines, heartbeat intervals)
  - UPPAAL over PRISM when asking "will X complete within Y ms?" (reachability) vs "probability" (stochastic)
  - Petri net over TLA+ when focusing on concurrent resource flow vs protocol state transitions
  - Petri net over Alloy when about dynamic flow/reachability vs static constraints
- Updated formalism override line to accept `--formalism=tla|alloy|prism|petri|uppaal`

**Step 4 (Study Existing Models) — Added UPPAAL entry:**
- Added: "**UPPAAL**: Read `.planning/formal/uppaal/quorum-races.xml` and its `.q` query file. Note the XML structure with `<nta>`, `<declaration>` (global constants), `<template>` (timed automata), `<system>` (process instantiation), and the `.q` query syntax (`A[] not deadlock`, `E<> location`, etc.)."

**Step 5 (Generate the Formal Model) — Added UPPAAL section and enhanced Petri:**

New UPPAAL subsection includes:
- Complete `.xml` file structure with `<nta>`, `<declaration>`, `<template>`, and `<system>` block specs
- Template structure: local clocks, locations with invariants, transitions with guards/synchronisation/assignments
- Concrete XML entity escaping example: "`x < 500` in a `<label kind="guard">` MUST be written as `<label kind="guard">x &lt; 500</label>`" — prevents malformed XML generation
- `.q` query file format: safety queries (`A[] not deadlock`), reachability (`E<> location.State`), bounded liveness
- File naming convention: `<descriptive-name>.xml` and `.q` in `.planning/formal/uppaal/`
- Requirement ID annotation: `// @requirement REQ-ID`

Enhanced Petri subsection now includes:
- Explicit bipartite graph constraint documentation
- Place/transition node shape specs (circles for places, filled rectangles for transitions)
- Rankdir and labeling conventions
- Optional `.json` companion file format with places and transitions arrays
- `@requirement` annotation format in DOT comments

**Step 6 (Run Model Checker) — Added UPPAAL entry:**
- Added UPPAAL checker: "`verifyta <model.xml> <model.q>` — all queries must report "satisfied"`
- Documented graceful degradation: "If verifyta is not installed (no VERIFYTA_BIN env var), `run-uppaal.cjs` writes a warning to **stderr** (not stdout), sets result to `inconclusive` with triage tag `no-verifyta`, and exits 0 (no crash)"
- Noted that run-formal-verify.cjs discovers `.xml` files automatically and run-uppaal.cjs is marked `nonCritical: true`

**Verification:**
- `grep -c 'uppaal\|UPPAAL' core/workflows/close-formal-gaps.md` returns **10** (comprehensive coverage)
- Formalism override line updated to include `uppaal`
- Verifyta reference present in checker step
- Bipartite constraint documented in Petri section
- Disambiguation section present with all 4 rules
- XML entity escaping example provided with concrete syntax

### Task 2: Update skill command and sync installed workflow

Modified `commands/nf/close-formal-gaps.md`:
- Updated `description` line to include UPPAAL: "selects formalism (TLA+/Alloy/PRISM/Petri/UPPAAL)"
- Updated `argument-hint` line: `--formalism=tla|alloy|prism|petri|uppaal`
- Updated `<process>` section flag documentation: `--formalism=tla|alloy|prism|petri|uppaal  Override formalism selection`

Synced workflow to installed location:
- Copied `core/workflows/close-formal-gaps.md` to `~/.claude/nf/workflows/close-formal-gaps.md`
- Verified sync with `diff` command (no differences)

**Verification:**
- `grep 'uppaal' commands/nf/close-formal-gaps.md` shows uppaal in both argument-hint and process flag docs (2 lines)
- `grep 'UPPAAL' commands/nf/close-formal-gaps.md` shows UPPAAL in description
- Installed workflow matches repo source (diff clean)

## Deviations from Plan

None — plan executed exactly as written. All verification criteria met without requiring auto-fixes.

## Verification Results

All plan success criteria confirmed:

- [x] close-formal-gaps workflow has UPPAAL in formalism selection table with disambiguation heuristics
- [x] close-formal-gaps workflow has UPPAAL .xml + .q generation template with full XML DTD structure reference
- [x] close-formal-gaps workflow has enhanced Petri .dot generation template with bipartite constraint and optional .json
- [x] close-formal-gaps workflow references verifyta for UPPAAL checking with graceful degradation details
- [x] close-formal-gaps workflow UPPAAL template includes concrete XML entity escaping example
- [x] Skill command accepts --formalism=uppaal (verified in both argument-hint and process flag docs)
- [x] Installed workflow is synced to ~/.claude/nf/workflows/

## Self-Check

- [x] core/workflows/close-formal-gaps.md exists and contains 10+ uppaal/UPPAAL mentions
- [x] commands/nf/close-formal-gaps.md exists and lists uppaal in argument-hint and process docs
- [x] ~/.claude/nf/workflows/close-formal-gaps.md synced (diff returns empty)
- [x] run-formal-verify.cjs already has dynamic UPPAAL/Petri discovery (no code changes needed)
- [x] Concrete XML entity escaping example present in UPPAAL generation template
- [x] run-uppaal.cjs graceful degradation documented (stderr warning, exits 0, nonCritical: true)

**Self-Check: PASSED**
