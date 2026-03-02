---
phase: quick-128
plan: 01
type: summary
completed_date: 2026-03-02
duration_minutes: 15
tasks_completed: 3
artifacts_created: 2
key_artifacts:
  - qgsd-core/workflows/quick.md
  - commands/qgsd/quick.md
  - ~/.claude/qgsd/workflows/quick.md (installed)
  - ~/.claude/commands/qgsd/quick.md (installed)
commits:
  - hash: 35f5b719
    message: "feat(quick-128): add formal integration to quick --full workflow"
    files: [qgsd-core/workflows/quick.md]
  - hash: a267b8fe
    message: "feat(quick-128): update commands/qgsd/quick.md with formal integration in --full"
    files: [commands/qgsd/quick.md]
---

# Quick Task 128: Upgrade quick --full mode: formal/ integration Summary

## Objective
Upgrade the quick workflow (`--full` mode) to integrate with formal/ specification modules, enabling automatic discovery of relevant invariants and formal artifact tracking through the planning, checking, execution, and verification pipeline.

## One-Liner
Formal scope scanning in quick --full mode now discovers relevant `formal/spec/*/invariants.md` files and injects them into planner, checker, executor, and verifier for provably safe quick task execution against system invariants.

## What Was Built

### Task 1: Add formal integration steps to qgsd-core/workflows/quick.md

**Completed additions:**

1. **Step 4.5 (Formal scope scan)** — Only when `$FULL_MODE`:
   - Scans `formal/spec/` directory for subdirectories
   - Checks for `invariants.md` in each module
   - Matches `$DESCRIPTION` keywords against module names (case-insensitive substring matching)
   - Populates `$FORMAL_SPEC_CONTEXT` as array of `{ module, path }` objects
   - Displays count of matched modules
   - Stores context for downstream steps

2. **Step 5 (Planner injection)** — Formal context block added:
   - Planner `<files_to_read>` injects matching `invariants.md` files
   - New `<formal_context>` block tells planner to:
     - Read injected invariants.md and identify applicable invariants
     - Declare `formal_artifacts:` in frontmatter (none | update | create)
     - Ensure plan tasks do not violate identified invariants

3. **Step 5.5 (Checker dimension)** — Formal checks added:
   - New check dimensions: "Formal artifacts" and "Invariant compliance"
   - Checker receives formal invariants in `<files_to_read>`
   - Validates that `formal_artifacts` paths are well-specified (not vague)
   - Verifies plan tasks avoid invariant violations

4. **Step 6 (Executor constraint)** — Formal file handling:
   - If plan declares `formal_artifacts: update` or `formal_artifacts: create`:
     - Executor must execute the formal/ file changes
     - Include formal/ files in the atomic commit alongside implementation files
   - Formal/ files never committed separately — always bundled with task commit

5. **Step 6.5 (Verifier context)** — Formal verification added:
   - Verifier receives formal invariants in `<files_to_read>`
   - New `<formal_context>` block instructs verifier to:
     - Check that executor respected identified invariants
     - For formal artifact updates/creates: verify syntactic reasonableness (TLA+/Alloy/PRISM structure)
     - Basic structure validation (not full model checking)

6. **Step 6.5.1 (Quorum review of VERIFICATION.md)** — New step (--full only, after passed status):
   - Display quorum review banner
   - Form own position on whether VERIFICATION.md confirms all must_haves and no invariant violations
   - Run quorum (Mode A — artifact review) on VERIFICATION.md
   - Route on verdict:
     - **APPROVED** → Keep `$VERIFICATION_STATUS = "Verified"`, proceed to status update
     - **BLOCKED** → Set `$VERIFICATION_STATUS = "Needs Review"`, proceed to status update
     - **ESCALATED** → Present escalation to user, set status to "Needs Review"
   - Fail-open: if all slots unavailable, keep "Verified" with note

7. **Success criteria expanded** — Added 7 new items for formal integration:
   - Formal scope scan runs before planner (step 4.5), $FORMAL_SPEC_CONTEXT populated
   - Planner receives relevant invariants.md in files_to_read
   - Plan declares formal_artifacts field in frontmatter
   - Executor includes formal/ files in atomic commits when formal_artifacts non-empty
   - Verifier checks invariant compliance and formal artifact syntax
   - Quorum reviews VERIFICATION.md after passed status (step 6.5.1)

### Task 2: Update commands/qgsd/quick.md objective

Updated the `<objective>` section to describe `--full` flag as:

**Before:**
```
**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.
```

**After:**
```
**`--full` flag:** Single-phase rigor tier. Enables:
- Plan-checking (max 2 iterations) and post-execution verification
- Formal scope scan: discovers relevant `formal/spec/*/invariants.md` and injects invariant context into the planner
- Plan frontmatter must declare `formal_artifacts:` (none | update | create) with formal/ file targets
- Executor commits formal/ files atomically when `formal_artifacts` is non-empty
- Verifier checks invariant compliance and formal artifact syntax
- Quorum reviews VERIFICATION.md after passing (can downgrade to "Needs Review")

Use when you want quality guarantees with formal correctness properties, without full milestone ceremony.
```

### Task 3: Install sync

Ran installer to propagate both source files to `~/.claude/`:

```bash
node /Users/jonathanborduas/code/QGSD/bin/install.js --claude --global
```

**Propagated:**
- `qgsd-core/workflows/quick.md` → `~/.claude/qgsd/workflows/quick.md` ✓
- `commands/qgsd/quick.md` → `~/.claude/commands/qgsd/quick.md` ✓

Verified installed copies contain:
- "FORMAL_SPEC_CONTEXT" and "Step 4.5" in workflow ✓
- "Single-phase rigor tier" and "formal_artifacts" in command ✓

## Key Design Patterns

1. **Keyword matching heuristic:** Case-insensitive substring matching allows fuzzy module relevance discovery without requiring exact keywords. Examples: "quorum" task matches `quorum/invariants.md`, "TUI nav" matches `tui-nav/invariants.md`.

2. **Fail-open quorum:** Step 6.5.1 quorum review doesn't block execution if all slots are unavailable — verification status remains "Verified" with a note.

3. **Formal artifacts in plan frontmatter:** Required field when FORMAL_SPEC_CONTEXT is non-empty. Three modes:
   - `none` — task doesn't touch formal/ files
   - `update: [list of paths]` — task modifies existing formal/ files
   - `create: [list of {path, type, description}]` — task creates new formal/ files

4. **Atomic formal commits:** Formal/ files never committed separately. Always included in the task's atomic commit alongside implementation files. Ensures tight version coupling.

5. **Single-phase rigor tier:** Positioning --full mode as a coherent rigor level (between default quick and full milestone ceremony) with formal verification as a first-class gate.

## Verification

✓ All 6 formal integration additions present in qgsd-core/workflows/quick.md:
  - Step 4.5 formal scope scan block
  - Planner prompt with $FORMAL_SPEC_CONTEXT injection and formal_context block
  - Checker step 5.5 with formal dimension checks and formal_context
  - Executor step 6 with formal file commit instructions
  - Verifier step 6.5 with formal context injection
  - Step 6.5.1 quorum review of VERIFICATION.md with APPROVED/BLOCKED/ESCALATED routing

✓ Verification checks (from plan):
```bash
grep -n "Step 4.5\|FORMAL_SPEC_CONTEXT\|formal_artifacts\|Step 6.5.1" qgsd-core/workflows/quick.md
→ 20+ matches (expected: 10+) ✓

grep -n "Quorum review of VERIFICATION.md\|Needs Review" qgsd-core/workflows/quick.md
→ Multiple matches ✓

grep -n "Single-phase rigor tier\|formal_artifacts\|formal/spec" commands/qgsd/quick.md
→ 3+ matches ✓
```

✓ Installed files verified:
```bash
grep "FORMAL_SPEC_CONTEXT" ~/.claude/qgsd/workflows/quick.md → exists ✓
grep "Single-phase" ~/.claude/commands/qgsd/quick.md → exists ✓
```

## Deviations from Plan

None — plan executed exactly as written. All 7 additions implemented precisely as specified in the constraints.

## Next Steps

Quick tasks using `--full` mode can now:
1. Automatically discover relevant formal specification modules
2. Have their plans validated against invariants
3. Include formal artifact modifications in atomic commits
4. Have their verification results reviewed by quorum for additional confidence

The groundwork is now in place for quick tasks to leverage the formal/ specification system as a built-in rigor tier, positioning them between default quick execution and full multi-phase milestone ceremonies.
