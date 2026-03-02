---
phase: quick-130
plan: 01
type: execute
date: 2026-03-02
status: complete
duration_minutes: 12
commits:
  - hash: cfd7e192
    message: "feat(quick-130): create bin/run-formal-check.cjs lightweight formal checker"
  - hash: c6324688
    message: "feat(quick-130): add Step 6.3 post-execution formal check to quick.md"
tasks_completed: 2
files_modified:
  - bin/run-formal-check.cjs
  - qgsd-core/workflows/quick.md
tech_stack:
  - Node.js spawnSync for tool execution
  - Fail-open pattern: missing java/jars → warning + exit 0
  - JSON result parsing for verifier integration
key_decisions:
  - Per-module runner (not full suite) for Step 6.3 efficiency
  - Module-to-check mapping hardcoded (not discovered) for predictability
  - Unknown modules treated as skipped (fail-open), not failed
  - FORMAL_CHECK_RESULT passed as JSON to Step 6.5 verifier prompt
---

# Quick Task 130: Wire Actual TLC/Alloy/PRISM Execution into --full Mode

## Summary

Successfully wired real model checking execution into the quick --full workflow. The quick task now executes TLC, Alloy, and PRISM on formal specifications after executor completion (Step 6.3), surfaces counterexample signals to the verifier (Step 6.5), and maintains fail-open semantics to prevent blocking when tools are unavailable.

## Implementation

### Task 1: Create bin/run-formal-check.cjs

Created a lightweight per-module formal checker at `/Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs` (395 lines).

**Capabilities:**
- Accepts `--modules=quorum,tui-nav,breaker` CLI argument
- Hardcoded module-to-check mapping covering 10 modules:
  - quorum, tui-nav, breaker, deliberation, oscillation, convergence, prefilter, recruiting, account-manager, mcp-calls
- Per-module checks:
  - TLC: java -jar formal/tla/tla2tools.jar tlc2.TLC (180s timeout)
  - Alloy: java -jar formal/alloy/org.alloytools.alloy.dist.jar (180s timeout)
  - PRISM: invoked if PRISM_BIN env var set (180s timeout)

**Fail-open semantics:**
- Missing java binary: logs warning "[run-formal-check] WARNING: java not found — skipping all TLC/Alloy checks", marks all checks as skipped, exits 0
- Missing tla2tools.jar: logs warning, skips TLC checks, exits 0
- Missing org.alloytools.alloy.dist.jar: logs warning, skips Alloy checks, exits 0
- PRISM_BIN not set: logs warning, skips PRISM checks, does not affect exit code
- Unknown module name: logs warning "[run-formal-check] WARNING: unknown module \"X\" — skipping", continues with known modules

**Result output:**
- Summary line: `[run-formal-check] Results: N checks, M passed, K failed, J skipped`
- Machine-readable JSON: `FORMAL_CHECK_RESULT={"passed":M,"failed":K,"skipped":J,"counterexamples":["module:tool",...]}` (stdout, parseable by grep)
- Exit code: 0 if all checks passed or skipped (no counterexample), 1 if any check failed

**Verification:**
- `node bin/run-formal-check.cjs --modules=quorum` → runs 3 checks, outputs FORMAL_CHECK_RESULT JSON, exits 0 or 1 depending on counterexamples
- `node bin/run-formal-check.cjs --modules=unknown` → logs warning, exits 0 with empty result (fail-open)

### Task 2: Add Step 6.3 to quick.md and Sync

Inserted Step 6.3 (Post-execution formal check) into qgsd-core/workflows/quick.md between Step 6 (executor) and Step 6.5 (verifier).

**Step 6.3 orchestration:**
1. Guard: skip if NOT `$FULL_MODE` or `$FORMAL_SPEC_CONTEXT` is empty
2. Build module list from FORMAL_SPEC_CONTEXT
3. Display banner: "QGSD ► FORMAL CHECK (post-execution)"
4. Run: `node bin/run-formal-check.cjs --modules=${MODULES}`
5. Parse: Extract FORMAL_CHECK_RESULT line using grep + cut
6. Route on exit code:
   - 0: Display "◆ Formal check: PASSED", continue to Step 6.5
   - 1: Display "◆ Formal check: COUNTEREXAMPLE FOUND", continue to Step 6.5 (do NOT abort)
7. Fail-open clause: If run-formal-check.cjs errors, log warning and set FORMAL_CHECK_RESULT=null

**Step 6.5 Verifier integration:**
- Added to verifier prompt `<formal_context>` section:
  - "Formal check result from Step 6.3: ${FORMAL_CHECK_RESULT !== null ? JSON.stringify(FORMAL_CHECK_RESULT) : 'skipped (tool unavailable)'}"
  - "If failed > 0 in formal check result: treat as a HARD FAILURE in your verification — must_haves cannot pass if a counterexample was found."

**Success criteria update:**
- Added checklist: "- [ ] (--full) Step 6.3 formal check ran when FORMAL_SPEC_CONTEXT non-empty; FORMAL_CHECK_RESULT passed to verifier"

**Installed copy sync:**
- Copied qgsd-core/workflows/quick.md to ~/.claude/qgsd/workflows/quick.md
- Verified: `diff` produces no output (files identical)

## Verification

All success criteria met:

1. **bin/run-formal-check.cjs exists and runs**
   - File: /Users/jonathanborduas/code/QGSD/bin/run-formal-check.cjs (395 lines)
   - Test: `node bin/run-formal-check.cjs --modules=quorum` → produces FORMAL_CHECK_RESULT JSON, exits 0 or 1
   - Fail-open: `node bin/run-formal-check.cjs --modules=unknown` → logs warning, exits 0

2. **Step 6.3 exists in quick.md**
   - 3 occurrences found (header + guard + success criteria)
   - Location: between executor output and Step 6.5 verifier

3. **FORMAL_CHECK_RESULT passed to verifier**
   - 5 references in quick.md (init, parse, route, verifier prompt, success criteria)
   - Verifier prompt includes: JSON result and hard-failure rule

4. **Installed copy matches source**
   - `diff /Users/jonathanborduas/code/QGSD/qgsd-core/workflows/quick.md /Users/jonathanborduas/.claude/qgsd/workflows/quick.md` → no output (files identical)

5. **Fail-open semantics verified**
   - Missing java: exits 0 with warning
   - Unknown modules: exit 0 with warning, not 1
   - PRISM optional: missing PRISM_BIN does not block exit

## Deviations from Plan

None — plan executed exactly as written. All quorum guidance items applied:
- Missing jar files log warning and exit 0 (fail-open)
- Unknown/unrecognized module names log warning, skip, exit 0
- FORMAL_CHECK_RESULT line is consumed by Step 6.5 verifier prompt with malformed-line handling (set to null if not found)
