---
phase: quick-101
verified: 2026-02-25T00:00:00Z
status: gaps_found
score: 7/8 must-haves verified
gaps:
  - truth: "quorum.md fallback dispatches Mode B workers as parallel Tasks (not sequential)"
    status: partial
    reason: "The top-level dispatch note was updated to parallel and the section header was renamed, but line 470 still has 'Dispatch (sequential — one Task per message turn):' prose and line 493 Mode B still says 'run deliberation (up to 3 rounds)' instead of 9/10 rounds. Section heading at line 352 still reads 'Escalate — no consensus after 4 rounds' while the banner inside it was correctly updated to 10 ROUNDS."
    artifacts:
      - path: "commands/qgsd/quorum.md"
        issue: "Line 352: section heading 'Escalate — no consensus after 4 rounds' not updated. Line 470: 'Dispatch (sequential — one Task per message turn):' still present in Mode B. Line 493: 'up to 3 rounds' deliberation cap not updated to match 10-round policy."
    missing:
      - "Change line 352 heading: '### Escalate — no consensus after 4 rounds' → '### Escalate — no consensus after 10 rounds'"
      - "Change line 470: 'Dispatch (sequential — one Task per message turn):' → 'Dispatch (parallel — all Tasks in one message turn):'"
      - "Change line 493: 'run deliberation (up to 3 rounds)' → 'run deliberation (up to 9 deliberation rounds, max 10 total rounds including Round 1)'"
---

# Quick Task 101: Unified Quorum — Verification Report

**Task Goal:** Unified quorum: new slot-worker agent, orchestrator 10-round parallel loop, inline synthesis, retire old workers
**Verified:** 2026-02-25
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | qgsd-quorum-slot-worker.md uses Bash (cqs.cjs) only — tools list is Read, Bash, Glob, Grep, no MCP tools | VERIFIED | Line 7: `tools: Read, Bash, Glob, Grep`; Step 4 is "Call the slot via Bash (cqs.cjs)"; role block says "Do NOT call MCP tools" |
| 2 | Orchestrator runs up to 10 deliberation rounds with inline synthesis — no separate synthesizer Task spawned | VERIFIED | Both Mode A and Mode B sections have `$MAX_ROUNDS = 10` loop; "INLINE SYNTHESIS (no Task spawn)" sections present; grep for `qgsd-quorum-synthesizer` in orchestrator returns 0 matches |
| 3 | Each orchestrator round dispatches all slot workers as parallel Task siblings with description='<slotName> quorum R<N>' | VERIFIED | Both Mode A (line ~275) and Mode B (line ~484) have `Task(subagent_type="qgsd-quorum-slot-worker", description="<slotName> quorum R<$CURRENT_ROUND>", ...)` as sibling calls |
| 4 | After each round, orchestrator synthesizes results inline and checks consensus before launching next round | VERIFIED | Both Mode A and Mode B have "INLINE SYNTHESIS (no Task spawn — orchestrator synthesizes directly)" sections with consensus check and cross-poll bundle build before incrementing round |
| 5 | Cross-pollination: R1 results are bundled and injected into R2+ worker prompts | VERIFIED | `$CROSS_POLL_BUNDLE` built after non-consensus round; injected into `prior_positions:` field in next round's Task prompts with `# Round 2+ only` comment |
| 6 | quorum.md fallback dispatches Mode B workers as parallel Tasks (not sequential) | PARTIAL | Top-level note at line 69 was updated to parallel and section header at line 448 says "parallel per round". BUT: line 470 still says "Dispatch (sequential — one Task per message turn):", line 352 section heading still says "after 4 rounds", and line 493 Mode B deliberation still says "up to 3 rounds" |
| 7 | CLAUDE.md R3.3 says 10 rounds before escalation | VERIFIED | R3.3 table: "Run deliberation (up to 10 rounds total)"; R3.3 prose: "10 rounds exhausted"; R3.4: "If 10 rounds complete without consensus" — all three locations updated |
| 8 | qgsd-quorum-worker.md and qgsd-quorum-synthesizer.md have deprecation notices at top | VERIFIED | Both files have `<!-- DEPRECATED: ... -->` comment as line 1, before the YAML frontmatter |

**Score:** 7/8 truths verified (1 partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `agents/qgsd-quorum-slot-worker.md` | Unified worker agent — Bash cqs.cjs only; tools: Read, Bash, Glob, Grep | VERIFIED | Exists, substantive (212 lines), contains `tools: Read, Bash, Glob, Grep`, Bash-only Step 4, no MCP |
| `agents/qgsd-quorum-orchestrator.md` | Orchestrator with 10-round loop + inline synthesis; contains "10 rounds" | VERIFIED | Exists, substantive (613 lines), `$MAX_ROUNDS = 10` in both Mode A and Mode B, inline synthesis sections present |
| `agents/qgsd-quorum-worker.md` | Deprecated old worker; contains "DEPRECATED" | VERIFIED | Exists, line 1 is deprecation comment |
| `agents/qgsd-quorum-synthesizer.md` | Deprecated synthesizer; contains "DEPRECATED" | VERIFIED | Exists, line 1 is deprecation comment |
| `commands/qgsd/quorum.md` | Fallback command with parallel Task dispatch; contains "parallel" | PARTIAL | Exists and contains "parallel" in top-level note and section header. But Mode B dispatch line 470 still says "sequential", line 352 heading still says "4 rounds", line 493 still says "up to 3 rounds" |
| `CLAUDE.md` | Policy with 10-round cap; contains "10 rounds" | VERIFIED | R3.3 and R3.4 updated to 10 rounds throughout (file is gitignored, updated on disk only per project design) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agents/qgsd-quorum-orchestrator.md` | `agents/qgsd-quorum-slot-worker.md` | `Task(subagent_type=qgsd-quorum-slot-worker, description='<slotName> quorum R<N>')` | WIRED | Pattern `qgsd-quorum-slot-worker` appears in both Mode A and Mode B Task dispatch sections in orchestrator; `description=` field present |
| `agents/qgsd-quorum-slot-worker.md` | `call-quorum-slot.cjs` | `Bash node call-quorum-slot.cjs` | WIRED | Step 4 contains exact bash pattern: `node "$HOME/.claude/qgsd-bin/call-quorum-slot.cjs" --slot <slot> --timeout <timeout_ms> --cwd <repo_dir> <<'WORKER_PROMPT'` |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| QUICK-101 | Unified quorum: new slot-worker agent, orchestrator 10-round parallel loop, inline synthesis, retire old workers | PARTIAL | 7/8 truths verified; one partial gap in quorum.md fallback consistency |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `commands/qgsd/quorum.md` | 352 | Section heading "Escalate — no consensus after 4 rounds" — stale copy of old round cap | Warning | Misleading for users reading the fallback; contradicts the banner text inside the same section |
| `commands/qgsd/quorum.md` | 470 | "Dispatch (sequential — one Task per message turn):" — stale label contradicts the parallel note added at line 450 | Warning | Two contradictory instructions in same section; executor following the label (line 470) would dispatch sequentially |
| `commands/qgsd/quorum.md` | 493 | Mode B fallback deliberation: "up to 3 rounds" — inconsistent with 10-round policy | Warning | Mode B fallback caps at 3 deliberation rounds (~4 total) instead of 9 (~10 total); inconsistent with orchestrator and CLAUDE.md |

### Human Verification Required

None. All checks were automatable via file reading and grep.

### Gaps Summary

The task completed successfully for 7 of 8 required truths. The one gap is in `commands/qgsd/quorum.md` — the fallback path has three residual inconsistencies from the old 4-round sequential architecture:

1. **Line 352 — section heading:** "Escalate — no consensus after 4 rounds" was not updated. The banner text inside the section was correctly updated to "10 ROUNDS" but the markdown heading itself was missed.

2. **Line 470 — Mode B dispatch label:** The section was renamed to "parallel per round" and the note at line 450 says parallel, but the actual dispatch prose at line 470 still opens with "Dispatch (sequential — one Task per message turn):" — a direct contradiction within the same section.

3. **Line 493 — Mode B deliberation cap:** "If split: run deliberation (up to 3 rounds)" was not updated to match the 10-round policy. The Mode A section above it was correctly updated to "max 10 total rounds" but Mode B was missed.

These three issues are all in the fallback path (used only when the orchestrator is unavailable). The primary path (orchestrator) is fully correct. The fixes are all small targeted text changes.

---

_Verified: 2026-02-25_
_Verifier: Claude (qgsd-verifier)_
