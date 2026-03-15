---
description: Create canonical quorum dispatch snippet and wire into all 8 workflows
formal_artifacts: none
must_haves:
  truths:
    - "core/references/quorum-dispatch.md exists with exact YAML format template, preflight sequence, fallback tiers, CE rules, and scoreboard update"
    - "All 8 workflows reference the snippet via @core/references/quorum-dispatch.md at every dispatch site"
    - "The YAML format template matches what nf-quorum-slot-worker.md parses (slot:, round:, timeout_ms:, repo_dir:, mode:, question:, etc.)"
    - "Provider preflight (check-provider-health.cjs), team identity (quorum-preflight.cjs --all), and health filtering are included in the snippet"
    - "Tiered fallback (T1→T2 from FALLBACK-01) is documented in the snippet"
    - "CE-1/CE-2/CE-3 consensus enforcement rules are included"
  artifacts:
    - core/references/quorum-dispatch.md
    - core/workflows/quick.md
    - core/workflows/plan-phase.md
    - core/workflows/execute-phase.md
    - core/workflows/discuss-phase.md
    - core/workflows/map-codebase.md
    - core/workflows/plan-milestone-gaps.md
    - core/workflows/fix-tests.md
    - commands/nf/resolve.md
  key_links:
    - commands/nf/quorum.md:278 (canonical YAML format)
    - agents/nf-quorum-slot-worker.md:15 (grep parser expects slot: format)
    - bin/quorum-preflight.cjs (preflight script)
    - bin/check-provider-health.cjs (provider probe)
---

# Quick Task 302: Canonical Quorum Dispatch Snippet

## Context

Every quorum invocation across 8+ workflows silently fails because:
1. None include the exact YAML format template that `nf-quorum-slot-worker.md` expects
2. None run provider preflight (`check-provider-health.cjs`)
3. None implement tiered fallback (FALLBACK-01)
4. None enforce CE-1/CE-2/CE-3 consensus rules explicitly
5. None update the scoreboard post-round

The canonical protocol exists in `commands/nf/quorum.md` (698 lines) but downstream workflows just say "dispatch as nf-quorum-slot-worker Tasks" — leaving Claude to guess the format, which it gets wrong.

## Task 1: Create the shared dispatch reference

**files:** core/references/quorum-dispatch.md (new)
**action:** Extract the reusable dispatch protocol from `commands/nf/quorum.md` into a compact reference that workflows can `@include`. Must contain:

1. **Preflight sequence** (3 steps):
   ```bash
   # Step 1: Provider health
   PROVIDER_HEALTH=$(node "$HOME/.claude/nf-bin/check-provider-health.cjs" --json)
   # Step 2: Team + health
   PREFLIGHT=$(node "$HOME/.claude/nf-bin/quorum-preflight.cjs" --all)
   # Step 3: Filter to available_slots only
   ```

2. **Fan-out computation** (from risk level):
   - routine/low → 2, medium → 3, high → max_quorum_size
   - $DISPATCH_LIST = first (FAN_OUT_COUNT - 1) from available_slots

3. **Exact YAML format template** for worker Task prompt:
   ```
   slot: <slotName>
   round: <round_number>
   timeout_ms: <from $SLOT_TIMEOUTS or 30000>
   repo_dir: <absolute path to project root>
   mode: <A|B>
   question: <question text>
   artifact_path: <path or empty>
   review_context: <framing text or empty>
   request_improvements: <true|false>
   prior_positions: |
     <positions from prior rounds, or empty>
   ```

4. **Task dispatch pattern**:
   ```
   For each slot in $DISPATCH_LIST, dispatch as PARALLEL sibling Tasks:
   Task(
     subagent_type="nf-quorum-slot-worker",
     model="haiku",
     description="<slot> [<cli> · <model>] quorum R<round>",
     prompt=<YAML block above>
   )
   ```

5. **Consensus enforcement** (CE-1, CE-2, CE-3):
   - CE-1: Claude is ADVISORY only, not counted in tally
   - CE-2: Any BLOCK from external voter → no consensus (absolute)
   - CE-3: Unanimity required among non-UNAVAIL voters

6. **Tiered fallback** (FALLBACK-01):
   - T1: Unused slots with auth_type=sub (same subscription tier)
   - T2: Unused slots with auth_type≠sub (different subscription)
   - Each slot dispatched AT MOST ONCE per round

7. **Scoreboard update** post-round:
   ```bash
   node bin/update-scoreboard.cjs --slot <name> --model-id <id> --result <code> --task <label> --round <n> --verdict <v>
   ```

8. **Error handling**: Classify UNAVAIL results using `classifyDispatchError` categories (TIMEOUT, AUTH, QUOTA, SERVICE_DOWN, SPAWN_ERROR, CLI_SYNTAX)

**verify:** File exists, contains all 8 sections, YAML format matches nf-quorum-slot-worker.md grep patterns
**done:** core/references/quorum-dispatch.md created with complete protocol

## Task 2: Wire snippet into all 8 workflows + resolve command

**files:** core/workflows/quick.md, core/workflows/plan-phase.md, core/workflows/execute-phase.md, core/workflows/discuss-phase.md, core/workflows/map-codebase.md, core/workflows/plan-milestone-gaps.md, core/workflows/fix-tests.md, commands/nf/resolve.md
**action:** At every dispatch site (15 total across 8+1 files), replace the generic "Dispatch $DISPATCH_LIST as sibling nf-quorum-slot-worker Tasks" instruction with:

```markdown
**Quorum dispatch** — follow the canonical protocol in @core/references/quorum-dispatch.md:
- Run preflight (Steps 1-3 from the reference)
- Use the exact YAML format template for worker prompts
- Apply tiered fallback if slots return UNAVAIL
- Enforce CE-1/CE-2/CE-3 consensus rules
- Update scoreboard after each round
```

Keep the workflow-specific parameters (artifact_path, review_context, request_improvements, mode) — only standardize the dispatch mechanics.

**verify:** grep all 8+1 files for "quorum-dispatch.md" — should find references at all dispatch sites
**done:** All dispatch sites reference the canonical snippet

## Task 3: Sync to installed workflows

**files:** ~/.claude/nf/workflows/*, ~/.claude/commands/nf/resolve.md
**action:** Copy updated workflow files from repo source to installed paths per the install sync requirement. The installer reads from core/workflows/ → ~/.claude/nf/workflows/.
**verify:** diff shows no differences between source and installed
**done:** Installed copies match source
