---
phase: quick-142
plan: 01
task_count: 1
task_completed: 1
type: execute
author: Claude Opus 4.6
date: 2026-03-03
duration_seconds: 180
status: completed
requirements: [QUICK-142]
---

# Quick Task 142: Enhance /qgsd:solve to Orchestrate Remediation Skills

## Summary

Rewrote `commands/qgsd/solve.md` from a thin "run script" wrapper into a comprehensive orchestrator skill that diagnoses consistency gaps across 5 layer transitions (R→F, F→T, C→F, T→C, F→C), dispatches to the correct remediation skill/script for each gap type, re-diagnoses after remediation, and converges via a diagnose-remediate-rediagnose loop with before/after residual comparison.

**One-liner:** Full orchestrator skill with 4-phase dispatch loop (close-formal-gaps, formal-test-sync, fix-tests, run-formal-verify) plus convergence iteration and before/after reporting.

## Completed Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Rewrite solve.md as orchestrator skill with convergence loop | `{commit_hash}` |

## Changes Made

### Task 1: Rewrite solve.md as Orchestrator Skill

**File modified:** `commands/qgsd/solve.md`

#### Frontmatter Changes
- **allowed-tools expanded** from `[Read, Bash, Glob, Grep]` to `[Read, Write, Edit, Bash, Glob, Grep, Agent, Skill, AskUserQuestion]` — necessary for orchestrating sub-skills and managing file I/O during convergence
- **name** preserved as `qgsd:solve`
- **argument-hint** preserved: `[--report-only] [--max-iterations=N] [--json] [--verbose]`
- **description** updated to reflect full orchestration role

#### Process Section (Complete Rewrite)

Transformed from a single-line "run script" into a 6-step orchestration process:

**Step 1: Initial Diagnostic Sweep**
- Runs `node bin/qgsd-solve.cjs --json --report-only` to get baseline residual vector
- Parses JSON to extract gap counts for all 5 layer transitions
- Stores baseline for before/after comparison
- Displays baseline residual in human-readable format with health indicators (GREEN/YELLOW/RED)

**Step 2: Report-Only Gate**
- Checks if `--report-only` flag was passed
- If yes: displays baseline residual and stops (preserves read-only diagnostic mode)
- If no: continues to remediation dispatch

**Step 3: Remediation Dispatch (Ordered by Dependency)**
- **R→F gaps:** Dispatches `/qgsd:close-formal-gaps` with either `--ids=<list>` (≤10 reqs) or `--all` (>10 reqs)
- **F→T gaps:** Runs `node bin/formal-test-sync.cjs` (direct script, generates test stubs and updates sidecars)
- **T→C gaps:** Dispatches `/qgsd:fix-tests` to autonomously discover and fix failing tests
- **C→F gaps:** Logs mismatches but does NOT auto-remediate (constant divergence may be intentional)
- **F→C gaps:** Runs `node bin/run-formal-verify.cjs` to check formal verification

Remediation order respects dependency graph: R→F before F→T (new formal specs create new invariants requiring test backing).

Each dispatch wrapped in error handling: if a remediation fails, logs the failure and continues to the next gap type.

**Step 4: Re-Diagnostic Sweep**
- After all remediations complete, runs `node bin/qgsd-solve.cjs --json --report-only` again
- Parses result as `post_residual`

**Step 5: Convergence Check**
- Compares baseline_residual.total vs post_residual.total
- If post_residual == 0: reports "All layers converged to zero. System is fully consistent." and exits
- If post_residual < baseline_residual: reports improvement and continues to Step 6
- If post_residual >= baseline_residual: reports stasis and continues to Step 6
- Implements iteration loop: if `--max-iterations=N` and N > 1, loops back to Step 3 until convergence, max iterations, or residual stops decreasing

**Step 6: Before/After Summary**
- Displays side-by-side comparison table:
  ```
  Layer Transition         Before  After   Delta
  ─────────────────────────────────────────────
  R -> F (Req->Formal)        N      M      Δ
  F -> T (Formal->Test)       N      M      Δ
  C -> F (Code->Formal)       N      M      Δ
  T -> C (Test->Code)         N      M      Δ
  F -> C (Formal->Code)       N      M      Δ
  Total                       N      M      Δ
  ```
- Notes manual review requirement for C→F gaps

#### Key Design Decisions

1. **Skill-level orchestration, not script-level** — The convergence loop is implemented in the skill, not in qgsd-solve.cjs. The script remains a pure diagnostic engine (reads `--json --report-only`). This allows richer orchestration via Skill dispatches and better error handling.

2. **Dispatch order matters** — R→F → F→T → T→C → F→C → C→F (manual). New formal specs create new invariants; tests must be generated after formal specs are created.

3. **F→T runs direct script, not sub-skill** — `formal-test-sync.cjs` is called directly via bash, not `/qgsd:formal-test-sync`. This is faster and the Node script already handles stub generation and sidecar updates. The skill wrapper (formal-test-sync.md) is a workflow option, but for orchestration we use the raw script.

4. **C→F is always manual** — Constant mismatches between formal specs and config may be intentional divergences. We log them but never auto-fix. User must review and decide.

5. **Error handling per remediation** — Each dispatch wraps in try/catch logic. If one remediation fails, we continue to the next gap type instead of aborting. This ensures maximum convergence even if intermediate steps have issues.

6. **Default max-iterations=3** — Reasonable bound on remediation rounds. If residual doesn't decrease within 3 loops, remaining gaps likely need manual attention.

## Verification Results

All success criteria met:

| Criterion | Result |
|-----------|--------|
| allowed-tools expanded (Write, Edit, Agent, Skill, AskUserQuestion added) | ✓ PASS |
| Dispatches to 4 remediation targets (close-formal-gaps, formal-test-sync.cjs, fix-tests, run-formal-verify) | ✓ PASS |
| C→F gaps logged for manual review | ✓ PASS |
| --report-only mode short-circuits after diagnostic sweep | ✓ PASS |
| Convergence loop re-diagnoses after remediation | ✓ PASS |
| Before/after comparison table included | ✓ PASS |
| Remediation order respects dependencies (R→F before F→T) | ✓ PASS |
| Skill file has valid YAML frontmatter and XML structure | ✓ PASS |

## Deviations from Plan

None — the plan was executed exactly as specified. All requirements from the `must_haves` section are satisfied:

1. ✓ "Running /qgsd:solve with no flags performs a diagnostic sweep, dispatches remediation skills for non-zero gaps (R→F, F→T, T→C, F→C), re-diagnoses, and presents a before/after residual comparison"

2. ✓ "Running /qgsd:solve --report-only performs a single diagnostic sweep and displays the residual vector without dispatching any remediation skills"

3. ✓ "The skill dispatches to the correct remediation target for each gap type: close-formal-gaps for R→F, formal-test-sync for F→T, fix-tests for T→C, run-formal-verify.cjs for F→C, and logs C→F for manual review"

4. ✓ "The skill converges by re-diagnosing after each remediation round and stopping when residual is zero or unchanged"

## Impact

This enhancement transforms `/qgsd:solve` from a thin wrapper that could only auto-close F→T gaps (test stubs) into a full orchestrator capable of closing gaps across all formal verification layers:

- **R→F:** Can now auto-generate formal specs for uncovered requirements
- **F→T:** Already worked; now integrated into convergence loop
- **T→C:** Can now autonomously discover and fix failing tests
- **F→C:** Can now run formal verification checks
- **C→F:** Explicitly excluded from auto-remediation (human judgment required)

The convergence loop enables iterative improvement: if R→F remediation creates new formal specs, F→T remediation generates test stubs for the new invariants. This creates a flywheel effect until consistency is achieved.

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| commands/qgsd/solve.md | ~280 | Complete rewrite from wrapper to orchestrator |

## Next Steps

With `/qgsd:solve` now fully orchestrated:

1. Users can run `/qgsd:solve` to automatically close gaps across all 5 layer transitions
2. The solver will iterate up to 3 times (configurable) until residual converges or reaches zero
3. Manual review is still required for C→F (constant) mismatches
4. The before/after report makes convergence progress visible

This unlocks the formal verification workflow: diagnose gaps → auto-close cross-layer gaps → verify consistency → repeat until converged.

## Self-Check

- ✓ File `commands/qgsd/solve.md` exists and contains orchestrator logic
- ✓ Frontmatter has expanded allowed-tools
- ✓ Process section has 6 steps with all required dispatch logic
- ✓ All 4 remediation targets referenced (close-formal-gaps, formal-test-sync, fix-tests, run-formal-verify)
- ✓ Convergence loop and before/after comparison implemented
- ✓ YAML and XML syntax valid

