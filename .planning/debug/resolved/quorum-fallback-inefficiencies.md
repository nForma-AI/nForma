---
status: resolved
trigger: "quorum-fallback-inefficiencies"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Three separate root causes identified:
  1. FALLBACK PARALLELISM: buildFalloverRule() in nf-prompt.js emits "dispatch the next tier" with no "parallel sibling Tasks in ONE message turn" requirement. quorum.md FALLBACK-01 section also lacks this explicit parallel dispatch instruction. Both sources leave the orchestrator free to dispatch sequentially.
  2. DUPLICATE DISPATCH: quorum.md FALLBACK-01 section says "dispatch a replacement" per UNAVAIL primary — one-to-one replacement model. When codex-1 UNAVAILS and gemini-1 UNAVAILS, opencode-1 was dispatched as T1 replacement for codex-1, THEN dispatched again as T1 replacement for gemini-1. The protocol doesn't say "deduplicate across all UNAVAIL primaries — dispatch each T1 slot at most once."
  3. CODEX-1 RESUME: The slot-worker agent (nf-quorum-slot-worker.md) runs a single Bash call and emits output verbatim. quorum-slot-dispatch.cjs guarantees a structured UNAVAIL block even on failure. But the ambiguity arises BEFORE quorum-slot-dispatch.cjs runs: the raw CLI output from codex-1's subprocess contained partial/ambiguous text. The orchestrator (Claude) receives the structured result block from quorum-slot-dispatch and should parse `verdict: UNAVAIL` cleanly. The resume behavior means the orchestrator ignored the structured result block and instead tried to resume the agent Task itself. quorum.md gives no guidance that `verdict: UNAVAIL` is definitive — no "treat the result block as final; never resume a slot-worker Task."

test: Verified by reading quorum.md FALLBACK-01 section (lines 308-319), buildFalloverRule in nf-prompt.js (lines 336-373), and the slot-worker agent + dispatch script.
expecting: All three root causes confirmed
next_action: Apply fixes to quorum.md (parallelism instruction + dedup + resume guidance) and buildFalloverRule in nf-prompt.js

## Symptoms

expected: |
  1. FALLBACK PARALLELISM: T1 fallbacks dispatched as parallel sibling Tasks in one message turn
  2. DUPLICATE DISPATCH: opencode-1 dispatched exactly once per round
  3. CODEX-1 RESUME: Ambiguous worker returns parsed immediately, no resume attempt

actual: |
  1. FALLBACK PARALLELISM: T1 fallbacks dispatched sequentially (opencode-1 then copilot-1 in separate turns) — ~60s latency added
  2. DUPLICATE DISPATCH: TWO opencode-1 task completions (IDs buljgyf9w and bow0cdcq7)
  3. CODEX-1 RESUME: Orchestrator resumed codex-1 agent via `resume: a2de9255c69da510c` — ~13s unnecessary latency

errors: |
  No hard errors — efficiency/correctness concerns:
  - Double opencode-1 dispatch wastes slot invocation (API cost + latency)
  - Sequential fallback dispatch adds ~60s total latency vs parallel
  - Unnecessary resume adds ~13s latency

reproduction: |
  Run `/nf:quorum <question>` when codex-1 and gemini-1 are both UNAVAIL.
  Fallback logic triggers but executes inefficiently.

started: 2026-03-12, may have existed since FALLBACK-01 tiered fallback was added

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-12T00:01:00Z
  checked: commands/nf/quorum.md lines 308-319 (FALLBACK-01 section)
  found: |
    "When a dispatched slot returns UNAVAIL, dispatch a replacement in this priority order..."
    "1. T1 — unused sub-CLI slots... Build $T1_UNUSED = [working-list slots with auth_type=sub] − $DISPATCH_LIST. Dispatch $T1_UNUSED first..."
    "2. T2 — final fallback slots..."
    NO language specifying that T1 replacements should be dispatched as PARALLEL sibling Tasks in one turn.
    NO language specifying deduplication across multiple UNAVAIL primaries.
  implication: Orchestrator is free to dispatch T1 fallbacks sequentially, one per UNAVAIL primary.

- timestamp: 2026-03-12T00:01:30Z
  checked: hooks/nf-prompt.js buildFalloverRule() lines 336-373
  found: |
    Step 1 PRIMARY: [slot list]
    Step 2 T1 sub-CLI: [t1 list] ← try these BEFORE any T2 slot
    Step 3 T2 ccr: [t2 list]
    CRITICAL: Do NOT fail-open until ALL tiers are exhausted.
    NO "dispatch all T1 replacements as parallel sibling Tasks in ONE message turn."
    Injected into Claude's context via UserPromptSubmit hook at quorum time.
  implication: Hook instructions are also silent on parallelism of fallback dispatch. Orthogonal confirmation of gap.

- timestamp: 2026-03-12T00:02:00Z
  checked: quorum.md FALLBACK-01 section + display table (lines 325-340)
  found: |
    Display table shows:
      slot-A (primary) → UNAVAIL → T1-next (T1 fallback)
      slot-B (primary) → UNAVAIL → T1-next (T1 fallback)
    The "same T1 slot can appear as fallback for BOTH slot-A and slot-B" is visually implied.
    No constraint that opencode-1 (T1) should be dispatched at most once even if two primaries UNAVAIL.
  implication: Protocol table structurally invites duplicate dispatch: one opencode-1 Task per UNAVAIL primary row.

- timestamp: 2026-03-12T00:02:30Z
  checked: bin/quorum-slot-dispatch.cjs lines 1019-1032 (UNAVAIL handling)
  found: |
    isUnavail = exitCode !== 0 || output.includes('TIMEOUT')
    When isUnavail: emitResultBlock({ verdict: 'UNAVAIL', ... }) — always emits structured block.
    The block includes `verdict: UNAVAIL`, `reasoning:`, `unavail_message:`, `raw:` sections.
    quorum-slot-dispatch.cjs ALWAYS exits 0 with a structured result block — never exits non-zero.
  implication: The slot-worker output is always well-structured. The codex-1 resume issue is NOT caused by quorum-slot-dispatch.cjs failing to emit a structured block.

- timestamp: 2026-03-12T00:03:00Z
  checked: agents/nf-quorum-slot-worker.md (full file)
  found: |
    Agent is a thin passthrough: single Bash call → quorum-slot-dispatch.cjs → emit stdout verbatim.
    No multi-turn logic, no resume logic inside the worker.
    Worker returns the quorum-slot-dispatch.cjs output as its final message.
    There is no guidance in the agent spec that says "this output is final — do not attempt to continue."
  implication: If the worker returns a structured UNAVAIL block, the orchestrator (Claude) should parse verdict: UNAVAIL. But if Claude sees the Task completion and tries to "resume" the agent Task for more info, that's an orchestrator behavior gap — not a worker gap. quorum.md does not say "Task results are final; never call resume on a slot-worker Task."

- timestamp: 2026-03-12T00:03:30Z
  checked: quorum.md "Handle UNAVAILABLE" instruction (line 306)
  found: |
    "Handle UNAVAILABLE per R6: note unavailability, then apply the tiered fallback rule below before continuing."
    R6 reference exists but there is no explicit "parse the result block for verdict: UNAVAIL" instruction.
    No instruction: "if the Task's output contains `verdict: UNAVAIL`, treat the Task as complete — do not resume."
  implication: Claude can interpret "handle UNAVAILABLE" as requiring more investigation → triggering a resume call on the codex-1 agent to get clarification, adding ~13s latency.

## Resolution

root_cause: |
  Three separate protocol instruction gaps, all in the orchestrator-facing instructions (quorum.md + buildFalloverRule in nf-prompt.js):

  1. FALLBACK PARALLELISM: Neither quorum.md FALLBACK-01 section nor buildFalloverRule() said "dispatch all fallback replacements as parallel sibling Tasks in ONE message turn." The instructions said "dispatch a replacement" (singular, per UNAVAIL) leaving the orchestrator free to dispatch sequentially.

  2. DUPLICATE DISPATCH: The FALLBACK-01 protocol framed fallbacks as one-to-one replacements (one replacement per UNAVAIL primary). The display table reinforced this by showing a T1 row under each UNAVAIL primary row. With two UNAVAIL primaries, Claude dispatched opencode-1 twice — once as T1 replacement for codex-1, once as T1 replacement for gemini-1. No deduplication rule existed.

  3. CODEX-1 RESUME: quorum.md said "Handle UNAVAILABLE per R6" but never stated "the slot-worker result block is final — never call resume on a completed slot-worker Task." The orchestrator interpreted `verdict: UNAVAIL` in the result block as inconclusive and resumed the agent Task to get more data.

fix: |
  1. quorum.md FALLBACK-01 section: Added explicit parallel dispatch requirement ("dispatch ALL needed fallback replacements as parallel sibling Tasks in ONE message turn"), dedup rule ("each fallback slot dispatched AT MOST ONCE per round"), and no-resume rule ("slot-worker Task results are final, never call resume").
  2. Display table note: Added "Important: fallback slots appear at most once in this table" to both Mode A and Mode B tables to prevent the visual invitation to duplicate-dispatch.
  3. buildFalloverRule() in hooks/nf-prompt.js: Added three lines to the injected instructions: PARALLEL DISPATCH, DEDUP, NO RESUME. Synced to hooks/dist/ and reinstalled globally.

verification: |
  - 7/7 FALLBACK-01 regression tests pass (node test/fallback-01-regression.test.cjs)
  - grep confirms all three new constraint lines in installed ~/.claude/hooks/nf-prompt.js
  - quorum.md changes are self-evidently correct (no behavioral code changed — only protocol text)

files_changed:
  - commands/nf/quorum.md
  - hooks/nf-prompt.js
  - hooks/dist/nf-prompt.js
