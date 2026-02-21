# Phase 9: Verify Phases 5-6 - Research

**Researched:** 2026-02-21
**Domain:** gsd-verifier agent workflow, goal-backward verification, QGSD circuit breaker and GUARD 5 delivery artifacts
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DETECT-01 | PreToolUse hook intercepts Bash tool calls and checks whether the current context has an active circuit breaker before running detection | Verified in `hooks/qgsd-circuit-breaker.js` — active-state branch at line 151 runs before detection; main() reads state, checks `state.active`, then conditionally runs git log |
| DETECT-02 | Hook retrieves last N commits' changed files via `git log --format="%H" -N` (N = commit_window config) when detection is needed | Verified in `getCommitFileSets()` — uses `spawnSync('git', ['log', '--format=%H', `-${commitWindow}`])` followed by `git diff-tree --root --no-commit-id -r --name-only` per hash |
| DETECT-03 | Hook identifies oscillation when the exact same file set (strict set equality) appears in >= oscillation_depth of last commit_window commits | Verified in `detectOscillation()` — sorts each file array, joins with '\0', counts via Map; strict set equality confirmed by sort+join approach |
| DETECT-04 | Read-only Bash commands (git log, git diff, grep, cat, ls, head, tail, find) pass through without detection or blocking | Verified by `isReadOnly(command)` regex `READ_ONLY_REGEX` at line 20; read-only branch exits 0 at line 166 before any detection |
| DETECT-05 | Detection is skipped when no git repository exists in the current working directory | Verified by `getGitRoot()` catch block returning null; main() exits 0 when gitRoot is null |
| STATE-01 | Circuit breaker state persisted in `.claude/circuit-breaker-state.json` (relative to project root) | Verified in `writeState()` — uses `path.join(gitRoot, '.claude', 'circuit-breaker-state.json')` |
| STATE-02 | State schema: `{ active, file_set[], activated_at, commit_window_snapshot[] }` | Verified in `writeState()` — writes all four fields; activated_at uses `new Date().toISOString()` |
| STATE-03 | Hook reads existing state first — if active, applies enforcement immediately without re-running git log detection | Verified in main() — `readState()` called before detection; if `state.active === true`, enforcement path taken immediately |
| STATE-04 | State file created silently if absent; failure to write logs to stderr but never blocks execution | Verified in `writeState()` catch block — logs to stderr and returns without throwing; main() exits 0 in all Phase 6 paths |
</phase_requirements>

## Summary

Phase 9 is a pure verification phase — no code changes are expected. Its job is to spawn the `gsd-verifier` agent twice (once for Phase 5, once for Phase 6) to produce formal VERIFICATION.md files that close the audit gap identified in `v0.2-MILESTONE-AUDIT.md`. The audit found all 9 requirements (DETECT-01..05, STATE-01..04) are "orphaned" — claimed by Phase 6's SUMMARY.md but never independently verified.

The pre-flight investigation (codebase spot-checks during this research) shows the implementations are substantially correct. Phase 5 deliverables (three-surface quorum_instructions sync, dist rebuild) all pass their own success criteria per the SUMMARY. Phase 6 deliverables (circuit breaker hook, 15 test cases, gitignore entry, build wiring) all pass their own success criteria per the SUMMARY. The test suite runs 138/138 passing, source-to-dist parity is confirmed by diff, and `qgsd-circuit-breaker.js` contains all expected functions.

The verifier's job is to independently confirm this — using goal-backward analysis starting from ROADMAP.md success criteria, not from SUMMARY claims. The plan for Phase 9 needs to describe exactly what files the verifier must read, what checks to run, and what format to produce. This is a process phase, not a code phase.

**Primary recommendation:** Spawn `gsd-verifier` (subagent_type="gsd-verifier") once per phase. Give each agent the PLAN.md, SUMMARY.md, and ROADMAP.md success criteria as context. The agent follows the standard gsd-verifier workflow: read must_haves from PLAN frontmatter, verify artifacts, verify key links, assess requirements coverage, scan anti-patterns, produce VERIFICATION.md.

## Standard Stack

### Core — Verifier Inputs per Phase

| Input | Phase 5 | Phase 6 | Role |
|-------|---------|---------|------|
| PLAN frontmatter `must_haves` | `05-01-PLAN.md` | `06-01-PLAN.md` | Primary must-have source for verifier |
| SUMMARY.md | `05-01-SUMMARY.md` | `06-01-SUMMARY.md` | Claimed deliverables (do not trust; verify) |
| ROADMAP.md success criteria | Phase 5 section | Phase 6 section | High-level goal contract |
| gsd-tools verify artifacts | `05-01-PLAN.md` | `06-01-PLAN.md` | Automated artifact + key-link checking |
| REQUIREMENTS.md traceability | GAP-01, GAP-02 (no formal IDs) | DETECT-01..05, STATE-01..04 | Requirements coverage section |

### Core — gsd-verifier Agent

The verifier agent (`/Users/jonathanborduas/.claude/agents/gsd-verifier.md`) is the execution engine. It:
1. Checks for previous VERIFICATION.md (Step 0)
2. Loads plan context (Step 1)
3. Establishes must-haves from PLAN frontmatter (Step 2, Option A)
4. Verifies truths (Step 3)
5. Verifies artifacts at three levels: exists, substantive, wired (Steps 4-5)
6. Checks requirements coverage (Step 6)
7. Scans anti-patterns (Step 7)
8. Determines overall status (Step 9)
9. Creates VERIFICATION.md (Write tool — never Bash heredoc)

### Supporting — Automated Verification Commands

```bash
# Artifact verification via gsd-tools
node /Users/jonathanborduas/.claude/get-shit-done/bin/gsd-tools.cjs verify artifacts "$PLAN_PATH"

# Key link verification via gsd-tools
node /Users/jonathanborduas/.claude/get-shit-done/bin/gsd-tools.cjs verify key-links "$PLAN_PATH"

# Test suite (Phase 6 — must all pass)
cd /Users/jonathanborduas/code/QGSD && npm test

# Source-dist parity (Phase 5 — must all be empty)
diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js
diff hooks/config-loader.js hooks/dist/config-loader.js
```

## Architecture Patterns

### Phase 9 Plan Structure

This is a two-task verification plan:

```
Phase 9/
├── Task 1: Verify Phase 5 (spawn gsd-verifier for 05-fix-guard5-delivery-gaps)
│   ├── Inputs: 05-01-PLAN.md, 05-01-SUMMARY.md, ROADMAP Phase 5 section
│   ├── Output: .planning/phases/05-fix-guard5-delivery-gaps/05-VERIFICATION.md
│   └── Checkpoint: verify artifacts tool passes
└── Task 2: Verify Phase 6 (spawn gsd-verifier for 06-circuit-breaker-detection-and-state)
    ├── Inputs: 06-01-PLAN.md, 06-01-SUMMARY.md, ROADMAP Phase 6 section, REQUIREMENTS.md (DETECT/STATE section)
    ├── Output: .planning/phases/06-circuit-breaker-detection-and-state/06-VERIFICATION.md
    └── Checkpoint: verify artifacts tool passes + npm test green
```

Tasks can run sequentially (Phase 5 then Phase 6). No dependency between them, but sequential is safer to avoid stdout interleaving in verifier output.

### Pattern 1: gsd-verifier must_haves Source — PLAN frontmatter (Option A)

Both Phase 5 and Phase 6 have rich `must_haves` in their PLAN frontmatter. The verifier MUST use Option A (PLAN frontmatter must_haves), not derive from scratch. This is the fastest and most reliable path.

**Phase 5 must_haves (from `05-01-PLAN.md` frontmatter):**

Truths:
- `buildQuorumInstructions()` in bin/install.js includes step N+2 (GSD_DECISION marker instruction)
- `templates/qgsd.json` quorum_instructions includes step 5 matching DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK
- `hooks/dist/qgsd-stop.js` contains GUARD 5 code (ARTIFACT_PATTERNS, hasArtifactCommit, DECISION_MARKER, hasDecisionMarker)
- `hooks/dist/qgsd-prompt.js` contains step 5
- `CHANGELOG.md [Unreleased]` documents GUARD 5 fix and --redetect-mcps flag

Artifacts (5 files):
- `bin/install.js` — contains "GSD_DECISION"
- `templates/qgsd.json` — contains "GSD_DECISION"
- `hooks/dist/qgsd-stop.js` — contains "hasDecisionMarker"
- `hooks/dist/qgsd-prompt.js` — contains "GSD_DECISION"
- `CHANGELOG.md` — contains "--redetect-mcps"

Key links (2):
- `bin/install.js buildQuorumInstructions()` → `hooks/qgsd-stop.js hasDecisionMarker()` via "GSD_DECISION"
- `hooks/qgsd-stop.js` → `hooks/dist/qgsd-stop.js` via "hasDecisionMarker|ARTIFACT_PATTERNS"

**Phase 6 must_haves (from `06-01-PLAN.md` frontmatter):**

Truths:
- Write Bash command on repo with no oscillation passes without writing state
- Write Bash command where same file set appears in >= 3 of last 6 commits triggers state with active:true
- Read-only Bash command passes without running detection
- No git repo: hook passes without error
- Active state file exists: hook reads it and passes (Phase 6 — enforcement is Phase 7)
- State schema: `{ active, file_set[], activated_at (ISO 8601), commit_window_snapshot[][] }`
- State write failure logs to stderr and never blocks execution (fail-open)
- npm test passes with all 15 circuit-breaker test cases green
- `.claude/circuit-breaker-state.json` listed in .gitignore

Artifacts (5 files):
- `hooks/qgsd-circuit-breaker.js` — PreToolUse hook
- `hooks/qgsd-circuit-breaker.test.js` — 15 TDD test cases, min 200 lines
- `scripts/build-hooks.js` — contains "qgsd-circuit-breaker.js"
- `package.json` — contains "qgsd-circuit-breaker.test.js"
- `.gitignore` — contains ".claude/circuit-breaker-state.json"

Key links (3):
- `hooks/qgsd-circuit-breaker.js` → `.claude/circuit-breaker-state.json` via "circuit-breaker-state\\.json"
- `hooks/qgsd-circuit-breaker.js` → `git diff-tree --no-commit-id -r --name-only` via "diff-tree.*--name-only"
- `hooks/qgsd-circuit-breaker.js` → `hooks/config-loader.js` via "require.*config-loader"

### Pattern 2: gsd-verifier Output Format

The verifier writes VERIFICATION.md with YAML frontmatter. For a PASSED verification, the planner needs to then update REQUIREMENTS.md checkboxes ([`[ ]` → `[x]`) for DETECT-01..05 and STATE-01..04.

Phase 5 has no formal requirement IDs (GAP-01, GAP-02 are audit gap labels, not REQUIREMENTS.md IDs). The Requirements Coverage section should note this explicitly.

Phase 6 has 9 formal requirement IDs: DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05, STATE-01, STATE-02, STATE-03, STATE-04.

### Pattern 3: Post-Verification REQUIREMENTS.md Update

After VERIFICATION.md is produced with `status: passed`, a follow-up task must update REQUIREMENTS.md to check the boxes for DETECT-01..05 and STATE-01..04. The audit reset these to `[ ]` pending verification.

```
REQUIREMENTS.md traceability table:
- DETECT-01 through DETECT-05: change [ ] → [x]
- STATE-01 through STATE-04: change [ ] → [x]
Also update status column from "Pending" to "Complete"
```

### Anti-Patterns to Avoid

- **Trusting SUMMARY.md claims:** The SUMMARY for Phase 6 claims "DETECT-01, DETECT-02, ..., STATE-04 delivered". The verifier must NOT accept this claim — it must independently verify each one from the codebase.
- **Running npm test inside gsd-verifier without cwd:** The test suite must be run from `/Users/jonathanborduas/code/QGSD`. Always pass full path.
- **Using Bash heredoc for VERIFICATION.md:** The gsd-verifier agent spec explicitly prohibits this. ALWAYS use the Write tool.
- **Committing VERIFICATION.md:** The verifier should NOT commit — the orchestrator/planner handles that in Phase 9's plan.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact existence + pattern checking | Manual grep loops | `gsd-tools verify artifacts "$PLAN_PATH"` | Reads must_haves.artifacts from PLAN frontmatter, returns structured JSON |
| Key link checking | Manual grep per link | `gsd-tools verify key-links "$PLAN_PATH"` | Reads must_haves.key_links from PLAN frontmatter, returns structured JSON |
| Test suite state | Manual per-test inspection | `npm test` from QGSD root | Runs all 4 suites; 138 tests; returns pass/fail count |

**Key insight:** The gsd-tools `verify` commands are purpose-built for this workflow. Using them is faster and more reliable than manual file inspection for the artifact/key-link checks.

## Common Pitfalls

### Pitfall 1: Phase 6 Key Link Pattern for diff-tree May Not Match Actual Implementation

**What goes wrong:** The PLAN frontmatter specifies `"diff-tree.*--name-only"` as the key link pattern for Phase 6. However, the SUMMARY documents that the executor switched from `execSync` (string) to `spawnSync` (array args) for security reasons. The `diff-tree` call now uses `spawnSync('git', ['diff-tree', '--root', '--no-commit-id', '-r', '--name-only', hash])`. A pattern grep for `"diff-tree.*--name-only"` on the source file may not match a spawnSync array call.

**Why it happens:** PLAN was written before execution; implementation diverged from the plan.

**How to avoid:** If gsd-tools key-link verification fails on `diff-tree.*--name-only`, manually grep for `diff-tree` in `hooks/qgsd-circuit-breaker.js` — if found (even in an array), the link is WIRED. Document the divergence.

**Warning signs:** `gsd-tools verify key-links` returns `verified: false` for the diff-tree link despite the hook working.

### Pitfall 2: Phase 5 Requirements Coverage Has No Formal IDs

**What goes wrong:** Phase 5's PLAN frontmatter lists `requirements: [GAP-01, GAP-02]`. These are audit gap labels, not REQUIREMENTS.md requirement IDs. The verifier's Step 6 tries to cross-reference against REQUIREMENTS.md, which will not find GAP-01 or GAP-02.

**Why it happens:** Phase 5 was a gap-closure phase defined before formal requirements were added to REQUIREMENTS.md.

**How to avoid:** In the Requirements Coverage section, note that Phase 5 addressed audit gaps GAP-01 and GAP-02 (not formal requirement IDs), and that these gaps are now closed. No REQUIREMENTS.md checkbox updates needed for Phase 5.

### Pitfall 3: Phase 6 Test Count Discrepancy (15 vs 138)

**What goes wrong:** The PLAN says "15 TDD test cases". The current test suite shows 138 total tests. The verifier needs to confirm 15 circuit-breaker-specific tests exist in the output.

**Why it happens:** The suite includes qgsd-stop.test.js (19), config-loader.test.js (10), gsd-tools.test.cjs (81+), and qgsd-circuit-breaker.test.js (15+) — each file runs separately.

**How to avoid:** Run `node --test hooks/qgsd-circuit-breaker.test.js` to see only the circuit breaker count. Current suite: 15 CB tests. Or inspect the `npm test` output line `qgsd-circuit-breaker.test.js: 15/15`.

### Pitfall 4: SUMMARY Reports 125/125 Tests but Audit Says 138/138

**What goes wrong:** The Phase 6 SUMMARY says "125/125 pass" but the current test run shows 138/138. The verifier might flag this as a discrepancy.

**Why it happens:** Additional tests were added in Phases 7-8 (TC16-TC19 for the stop hook, config-loader tests). The 125 count was accurate at Phase 6 completion; 138 is current state.

**How to avoid:** Run `npm test` and accept the current count (138). The direction (all passing) is what matters, not the exact count from an older SUMMARY.

### Pitfall 5: `.claude/` directory During Test Teardown

**What goes wrong:** Phase 6 tests create real temp git repos and may leave `.claude/` directories if teardown fails. This does not affect verification but may confuse directory listings.

**Why it happens:** CB-TC tests use `fs.mkdtempSync` with `finally` cleanup blocks.

**How to avoid:** If `/tmp/` directories containing `.claude/` appear, they are test artifacts. Irrelevant to verification.

## Code Examples

Verified patterns from codebase inspection (2026-02-21):

### Phase 5 — Three-surface verification commands (all confirmed passing)

```bash
# Surface 1: source hook (Phase 4 done)
grep -c "GSD_DECISION" hooks/qgsd-prompt.js        # returns: 1

# Surface 2: installer (Phase 5 done)
grep -c "GSD_DECISION" bin/install.js              # returns: 1
grep "required.length + 2" bin/install.js          # returns: 1 match

# Surface 3: template (Phase 5 done)
grep -c "GSD_DECISION" templates/qgsd.json         # returns: 1

# Dist parity (Phase 5 done — all three return empty)
diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js
diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js
diff hooks/config-loader.js hooks/dist/config-loader.js

# GUARD 5 in dist stop hook
grep -c "hasDecisionMarker" hooks/dist/qgsd-stop.js  # returns: 2+
grep -c "hasArtifactCommit" hooks/dist/qgsd-stop.js  # returns: 2

# CHANGELOG
grep -c "redetect-mcps" CHANGELOG.md              # returns: 2+
grep -c "GSD_DECISION" CHANGELOG.md               # returns: 1
```

### Phase 6 — Circuit breaker artifact checks (all confirmed passing)

```bash
# Artifact existence and content
ls -la hooks/qgsd-circuit-breaker.js              # exists, 188 lines
ls -la hooks/qgsd-circuit-breaker.test.js         # exists, 655 lines

# Key functions present in hook
grep -n "isReadOnly\|getGitRoot\|readState\|getCommitFileSets\|detectOscillation\|writeState" \
  hooks/qgsd-circuit-breaker.js

# State schema in writeState
grep -A8 "writeFileSync" hooks/qgsd-circuit-breaker.js | grep "active\|file_set\|activated_at\|commit_window"

# Read-only regex
grep "READ_ONLY_REGEX" hooks/qgsd-circuit-breaker.js  # returns: const declaration + test

# State file path
grep "circuit-breaker-state" hooks/qgsd-circuit-breaker.js  # returns: path.join usage

# Build wiring
grep "qgsd-circuit-breaker" scripts/build-hooks.js     # returns: 1 entry in HOOKS_TO_COPY
grep "qgsd-circuit-breaker" package.json               # returns: test script entry

# .gitignore
grep "circuit-breaker-state" .gitignore                # returns: 1 match

# Test suite (15/15 must pass)
node --test hooks/qgsd-circuit-breaker.test.js
```

### Phase 6 — Key link check workaround for spawnSync divergence

The PLAN expects `diff-tree.*--name-only` pattern but implementation uses spawnSync array. Manual check:

```bash
# If gsd-tools key-link fails for diff-tree, run this manually:
grep -n "diff-tree" hooks/qgsd-circuit-breaker.js
# Expected: spawnSync('git', ['diff-tree', '--root', '--no-commit-id', '-r', '--name-only', hash])
# This confirms the key link IS wired, just as array args not string
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SUMMARY.md as completion evidence | VERIFICATION.md from goal-backward analysis | Phase 1-4 established the pattern | Phase 5-8 skipped this step; Phase 9 closes the gap |
| `execSync` with string args in hook | `spawnSync` with array args | During Phase 6 execution | Safer (no shell injection); changed key-link pattern |
| `git diff-tree` fails on root commits | Added `--root` flag to expose all root commit files | During Phase 6 execution | Enables oscillation detection in repos with < 4 commits |

**Deprecated/outdated:**
- "125/125 tests" count from Phase 6 SUMMARY: replaced by 138/138 (current). Accept the higher number as correct.

## Open Questions

1. **Will gsd-tools `verify key-links` work for Phase 6 diff-tree link given spawnSync divergence?**
   - What we know: PLAN frontmatter specifies `"diff-tree.*--name-only"` as the via pattern. The source file uses spawnSync with array args. A grep for the literal pattern `diff-tree.*--name-only` may not match.
   - What's unclear: Whether gsd-tools searches for the pattern in the `from` file or across the repo.
   - Recommendation: Run gsd-tools verify key-links first. If it returns verified:false for that link, add a manual grep fallback and mark WIRED with a note.

2. **Does Phase 5 need a Requirements Coverage section in its VERIFICATION.md?**
   - What we know: Phase 5 has `requirements: [GAP-01, GAP-02]` in PLAN frontmatter. These are not REQUIREMENTS.md IDs.
   - What's unclear: Whether the verifier should skip Step 6 or document "no formal requirement IDs."
   - Recommendation: Document "no formal requirement IDs for this phase; closes audit gaps GAP-01 and GAP-02" in the Requirements Coverage section. This is honest and complete.

3. **Should Phase 9's plan also update REQUIREMENTS.md checkboxes?**
   - What we know: After a PASSED VERIFICATION.md, REQUIREMENTS.md checkboxes for DETECT-01..05 and STATE-01..04 should be updated to [x] and status changed from "Pending" to "Complete".
   - What's unclear: Whether this is a separate task in the Phase 9 plan or part of the verifier's output.
   - Recommendation: Add a third task in the Phase 9 PLAN.md (after both verification tasks) to update REQUIREMENTS.md. This is a mechanical edit. Conditional on both verifications passing.

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection of `/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.js` (188 lines) — all functions, state schema, read-only regex, state file path verified
- Direct codebase inspection of `/Users/jonathanborduas/code/QGSD/hooks/qgsd-circuit-breaker.test.js` (655 lines) — 15 test cases confirmed by TC numbering
- `npm test` run from QGSD root — 138/138 passing including 15 circuit breaker tests
- `diff hooks/qgsd-stop.js hooks/dist/qgsd-stop.js` — empty (identical) confirmed
- `diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js` — empty (identical) confirmed
- `diff hooks/config-loader.js hooks/dist/config-loader.js` — empty (identical) confirmed
- `grep -n "GSD_DECISION" bin/install.js` — line 213 confirmed (required.length + 2)
- `grep -n "GSD_DECISION" templates/qgsd.json` — step 5 in quorum_instructions confirmed
- `grep -n "GSD_DECISION" hooks/dist/qgsd-prompt.js` — step 5 confirmed in dist
- `grep -n "GSD_DECISION" CHANGELOG.md` — line 12 confirmed in [Unreleased]
- `grep "circuit-breaker-state" .gitignore` — line 10 confirmed
- `grep "qgsd-circuit-breaker" scripts/build-hooks.js` — line 19 confirmed
- `grep "qgsd-circuit-breaker" package.json` — test script line 51 confirmed
- `.planning/phases/05-fix-guard5-delivery-gaps/05-01-PLAN.md` — must_haves frontmatter read
- `.planning/phases/05-fix-guard5-delivery-gaps/05-01-SUMMARY.md` — verification results table read
- `.planning/phases/06-circuit-breaker-detection-and-state/06-01-PLAN.md` — must_haves frontmatter read
- `.planning/phases/06-circuit-breaker-detection-and-state/06-01-SUMMARY.md` — key decisions and bug fixes read
- `/Users/jonathanborduas/.claude/agents/gsd-verifier.md` — full verifier workflow read (all 10 steps)
- `.planning/phases/01-hook-enforcement/01-VERIFICATION.md` — VERIFICATION.md format reference
- `.planning/REQUIREMENTS.md` — DETECT-01..05, STATE-01..04 descriptions and traceability status

### Secondary (MEDIUM confidence)

- `.planning/v0.2-MILESTONE-AUDIT.md` — gap analysis and integration checker findings confirming "substantially correct"

## Metadata

**Confidence breakdown:**
- Verifier workflow: HIGH — gsd-verifier.md read directly; Phase 1 VERIFICATION.md used as format reference
- Phase 5 artifacts: HIGH — all must_haves verified by direct codebase inspection and diff/grep commands
- Phase 6 artifacts: HIGH — all must_haves verified by direct codebase inspection; npm test run confirms 138/138
- Pitfalls: HIGH — spawnSync divergence confirmed by reading source; test count from live run; SUMMARY count from document

**Research date:** 2026-02-21
**Valid until:** Research is codebase-state-specific. Valid as long as Phase 5 and Phase 6 files are unchanged before Phase 9 executes. If any hook file changes, re-run spot checks.
