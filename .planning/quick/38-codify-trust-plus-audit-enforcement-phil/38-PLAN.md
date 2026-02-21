---
phase: quick-38
plan: 38
type: execute
wave: 1
depends_on: []
files_modified:
  - CLAUDE.md
autonomous: true
requirements: [QUICK-38]

must_haves:
  truths:
    - "CLAUDE.md contains a named section for the audit-trail enforcement design principle"
    - "The section names the three audit mechanisms: STATE.md, quorum scoreboard, SUMMARY.md artifacts"
    - "The section explicitly contrasts with hard-gate FSM enforcement and frames flexibility as a strength"
    - "The principle is positioned clearly as an intentional design choice, not an omission"
    - "All prior rules (R0–R8) remain intact and correctly positioned"
  artifacts:
    - path: "CLAUDE.md"
      provides: "Binding operational policy with audit-trail design principle added"
      contains: "audit-trail enforcement"
  key_links:
    - from: "CLAUDE.md audit-trail section"
      to: "STATE.md, quorum-scoreboard.json, SUMMARY.md"
      via: "named mechanisms in design principle text"
      pattern: "STATE\\.md|scoreboard|SUMMARY\\.md"
---

<objective>
Add the "audit-trail enforcement" design principle to CLAUDE.md as an explicit, named design choice.

Purpose: The quorum discussion established that QGSD's enforcement model is trust + audit, not permission-every-step. This insight needs to be a stated design principle — not an implicit gap. Without it, future Claude instances (and users) may see the absence of hard FSM gates as a weakness rather than the intentional, flexible-by-design architecture it is.

Output: CLAUDE.md on disk updated with a new "Design Principles" section (or equivalent placement) containing the audit-trail enforcement principle. All existing rules preserved.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write CLAUDE.md with audit-trail design principle</name>
  <files>/Users/jonathanborduas/code/QGSD/CLAUDE.md</files>
  <action>
CLAUDE.md is gitignored and does not currently exist on disk. You must create it from scratch using the reconstructed content below. This content incorporates all rules added by previous quick tasks (quick-1 through quick-18) plus the new audit-trail design principle from quick-38.

Write the following content exactly to `/Users/jonathanborduas/code/QGSD/CLAUDE.md`:

---BEGIN CLAUDE.md CONTENT---

# CLAUDE.md — QGSD Binding Operational Policy

This file defines mandatory rules for Claude when operating within QGSD. Rules override default behavior. Claude MUST follow these rules on every response.

**This file is gitignored by design.** See the Design Principles section for why.

---

## R0 — Absolute Constraints

1. Claude MUST NOT execute any `/qgsd:` command without quorum consensus (R3) except: `/qgsd:quorum`, `/qgsd:quorum-test`, `/qgsd:debug`, `/qgsd:health`, `/qgsd:help`, `/qgsd:progress`.
2. Claude MUST NOT modify `.planning/ROADMAP.md` without quorum consensus on the change.
3. Claude MUST NOT skip quorum when a PLAN.md is the output artifact. Plans require consensus.

---

## R1 — Definitions

| Term | Meaning |
|---|---|
| **QUORUM** | Multi-model consensus: Claude + Codex + Gemini + OpenCode + Copilot |
| **CONSENSUS** | All available models vote APPROVE (or APPROVE with improvements) |
| **BLOCK** | One or more models vote BLOCK — execution halts until resolved |
| **REVIEW-NEEDED** | Model requests deliberation before committing to a vote |
| **UNAVAILABLE** | Model not reachable (quota/error) — proceed with available models per R6 |
| **`checkpoint:verify`** | Automated verification gate; executor calls `/qgsd:quorum-test`; enters `/qgsd:debug` loop capped at 3 rounds on failure; escalates to `checkpoint:human-verify` if loop exhausts |
| **`checkpoint:human-verify`** | Human-required gate; used only for: (a) 3-round debug loop exhaustion, (b) all quorum models UNAVAILABLE, (c) inherently non-automatable checks (e.g., live session integration tests) |

---

## R2 — Execution Boundaries

### R2.1 — Planning vs Execution Separation

Claude MUST NOT execute plan tasks while still in the planning phase. Planning output is a PLAN.md. Execution reads the PLAN.md.

### R2.2 — Single-Model Execution

EXECUTION is performed by Claude alone. Quorum models diagnose and plan; they never execute. This is structural: Claude is the only model with tool access during execution.

---

## R3 — Quorum Protocol

Quorum is required before delivering output for any `/qgsd:` planning or decision command.

### R3.1 — Commands Requiring Quorum

The following commands MUST run quorum before delivering output to the user:
- `/qgsd:plan-phase`
- `/qgsd:research-phase`
- `/qgsd:discuss-phase`
- `/qgsd:new-project`
- `/qgsd:new-milestone`
- `/qgsd:verify-work`
- `/qgsd:quorum-test`
- `/qgsd:quick`

### R3.2 — Quorum Execution Protocol

1. Claude MUST form its own position (its vote) **before** querying other models. This is Claude's active quorum contribution — not pre-query preparation.
2. Query each model with an **identical prompt** using a **separate, sequential tool call** (NOT sibling calls in the same message). Order: Codex → Gemini → OpenCode → Copilot.
3. Collect all positions. Apply R3.3 decision logic.

**Why sequential, not parallel:** Sibling MCP calls in Claude Code are not guaranteed to be truly parallel and can produce race conditions. Sequential calls are the safe default per the hook enforcement model.

### R3.3 — Deliberation Rules

| Situation | Action |
|---|---|
| All available models APPROVE | CONSENSUS reached. Deliver output. |
| Any model BLOCK | BLOCK state. Run deliberation (up to 4 rounds). |
| Any model REVIEW-NEEDED | Run deliberation round to resolve. |
| All models UNAVAILABLE | Fail-open per R6. Note reduced quorum. Deliver output. |

Deliberation: share all positions with all models simultaneously (one call each, still sequential). Re-vote. Repeat until consensus or 4 rounds exhausted.

### R3.4 — Escalation

If 4 deliberation rounds complete without consensus, Claude MUST escalate to the user with:
- The specific BLOCK reason(s)
- Each model's position
- A proposed resolution path

Claude MUST NOT deliver the blocked output until the user resolves the escalation.

### R3.5 — Consensus Rules

CONSENSUS requires agreement from all **available** models. If 2+ models are UNAVAILABLE, Claude MUST note "reduced quorum" in the output and proceed. A single available model achieving self-consensus is not valid quorum — minimum 2 models (Claude + 1 external) required.

### R3.6 — Iterative Improvement Protocol

IF CONSENSUS is reached (all available models APPROVE) but one or more models also propose specific, actionable improvements:

1. Claude MUST incorporate the improvements into a revised plan iteration.
2. Claude MUST present the revised plan to a new QUORUM round.
3. This process MAY repeat up to **10 total iterations**.
4. Claude MUST stop iterating when either:
   - No quorum member proposes further improvements, OR
   - 10 iterations have completed.
5. The final approved plan proceeds to execution.

**Regression handling:** IF a refinement causes any model to switch from APPROVE to BLOCK, Claude MUST treat this as a new BLOCKER (R3.5) and halt execution until the blocking issue is resolved via R3.3 deliberation.

**Conflict handling:** IF quorum members propose mutually incompatible improvements, Claude acts as tie-breaker after 1 deliberation round. IF still unresolved, Claude MUST escalate to the user with all conflicting positions.

---

## R4 — Pre-Filter Protocol (Gray Area Questions)

Before presenting gray area questions to the user in `/qgsd:discuss-phase`, Claude MUST apply the R4 pre-filter to every candidate question.

**R4 decision table:**

| Outcome | Action |
|---|---|
| All available models agree CONSENSUS-READY + same answer | Record as assumption. Remove from user-facing list. |
| Any model returns USER-INPUT-NEEDED, OR conflicting CONSENSUS-READY answers | Run R3.3 deliberation (up to 3 rounds). |
| No consensus after 3 deliberation rounds | Mark for user presentation. |

Maintain two lists: `auto_resolved[]` (consensus assumptions) and `user_questions[]` (genuine preference items). Present only `user_questions[]` to the user.

---

## R5 — Oscillation Resolution Mode

Triggered by the circuit breaker hook (`qgsd-circuit-breaker.js`) when oscillation is detected (3+ alternating commit groups on the same file set).

### R5.1 — What Oscillation Means

Oscillation = Claude is stuck in a loop: implementing change, reverting, reimplementing. The circuit breaker fires to prevent wasted effort and context consumption.

### R5.2 — Resolution Procedure

1. **STOP all implementation work immediately.**
2. Read `.claude/circuit-breaker-state.json` for the commit history.
3. **Environmental fast-path:** IF the oscillating files are config/lock files (`package-lock.json`, `*.lock`, dependency manifests) → escalate directly to user. Do not apply quorum. This is an external dependency issue.
4. **Run quorum diagnosis** (R3.2, sequential):
   - Share the commit graph with all models
   - Ask: "What is the root cause of this oscillation? What is the correct fix?"
5. Apply R3.3 deliberation if needed. Reach consensus on root cause.
6. **Implement the consensus fix** as a single, clean commit.
7. Run `npx qgsd --reset-breaker` to clear the breaker state.

See `get-shit-done/workflows/oscillation-resolution-mode.md` for the full procedure.

---

## R6 — Availability and Fail-Open Policy

QGSD operates in a world where quorum models are frequently unavailable (quota limits, timeouts, errors).

### R6.1 — Fail-Open Rule

Claude MUST NOT block execution simply because a quorum model is unavailable. Proceed with available models. Note reduced quorum in output.

### R6.2 — Minimum Quorum

Minimum valid quorum: Claude + 1 external model. If no external models are available, Claude MUST note "all external models unavailable — self-quorum only" and proceed with caution. This is a degraded state, not a hard block.

### R6.3 — Per-Model Availability Tracking

If a model returns an error or timeout, classify it UNAVAILABLE for that round only. Do not assume it is permanently unavailable for subsequent rounds.

### R6.4 — Availability Documentation

When reduced quorum is used, Claude MUST document which models were unavailable in the quorum result section of the output (e.g., "Codex UNAVAILABLE — usage limit").

---

## R7 — Pre-Response Gate

Before delivering any response that includes a PLAN.md, SUMMARY.md, or ROADMAP.md update as an artifact, Claude MUST confirm:

1. Quorum was run (or a valid R6 exception applies).
2. The artifact reflects the consensus outcome.
3. No BLOCK is outstanding.

If any check fails, Claude MUST NOT deliver the response. Run quorum or resolve the block first.

---

## R8 — Agent Score Tracking

After every QUORUM round, Claude MUST update `.planning/quorum-scoreboard.json`
with each available model's performance classification for that round.

### R8.1 — Classification Schema

| Classification | Condition | Points |
|---|---|---|
| True Positive (TP) | Agent approved; final consensus approved | +1 |
| True Negative (TN) | Agent blocked/contrarian; consensus adopted their position | +5 |
| False Positive (FP) | Agent approved; consensus adopted contrarian's position | -3 |
| False Negative (FN) | Agent blocked/contrarian; consensus rejected their objection | -1 |
| Improvement Accepted | Agent proposed improvement incorporated into final plan | +2 |
| Improvement Rejected | Agent proposed improvement not incorporated | 0 |

### R8.2 — Edge Cases

- **Unanimous Round 1 (no contrarians):** All available agents score TP (+1).
- **Multi-contrarian:** Each contrarian scored individually based on whether their specific objection prevailed in deliberation.
- **Pivot (contrarian for imprecise reason but correct outcome):** Score TN — V1 limitation, semantic matching of objections not attempted.
- **UNAVAILABLE model:** No entry for that round.

### R8.3 — Update Protocol

After CONSENSUS is reached (or escalated per R3.4), Claude MUST:

1. Determine each model's initial vote (Round 1) and the final consensus outcome.
2. Classify each model per R8.1.
3. Use `node bin/update-scoreboard.cjs` to append the round result.
4. Update each model's cumulative score.

Claude MUST update the scoreboard **before** presenting output to the user, as part of the same step that records the quorum result.

### R8.4 — Scoreboard Location

See `.planning/quorum-scoreboard.json` for the live scoreboard (gitignored, disk-only).

---

## Design Principles

### Audit-Trail Enforcement (not FSM Permission Gates)

QGSD uses **trust + audit** enforcement, not step-by-step permission gating. This is an intentional architectural choice, not an omission.

#### What This Means

A traditional enforcement model would use a Finite State Machine (FSM): Claude cannot proceed from state A to state B without explicit permission checks at each transition. Every workflow step would be gated by a structural mechanism that blocks unauthorized moves.

QGSD does not do this. The enforcement model is:

1. **Trust**: Claude is trusted to follow the rules in this file on each response. The rules are written as behavioral constraints, not code-enforced gates.
2. **Audit**: Three mechanisms provide an after-the-fact audit trail that catches drift:
   - **STATE.md** — Records decisions, position, blockers, and session continuity. Drift from the stated position is visible across sessions.
   - **Quorum scoreboard** (`.planning/quorum-scoreboard.json`) — Records every quorum round outcome and each model's vote. Systematic rule-skipping would show up as anomalous vote patterns.
   - **SUMMARY.md artifacts** — Every plan and quick task produces a SUMMARY.md that documents what was built, what decisions were made, and any deviations. These form an immutable record reviewable at any point.

#### Why This Is a Strength

True FSM enforcement is architecturally impossible in a system where Claude reads markdown instructions. Any "hard gate" in a markdown workflow file is ultimately advisory — Claude could always output something that bypasses the gate. The practical maximum of structural enforcement in this architecture is toolchain-level hooks (which QGSD uses for quorum injection and circuit breaking).

Within that ceiling, trust + audit offers a real advantage: **flexibility without chaos**.

- When a model is unavailable (R6), Claude can proceed without waiting for a gate to unlock.
- When quorum produces an improvement (R3.6), Claude can iterate without re-running a full FSM transition.
- When the circuit breaker fires (R5), the system can reason about the oscillation rather than hard-blocking all progress.

The audit trail means that if Claude drifts from the rules, it is visible and correctable. This is better than a brittle FSM that breaks on unexpected inputs and has no recovery path.

#### The Invariant

This design only works if the audit artifacts are maintained. Claude MUST:
- Update STATE.md after each phase/milestone change.
- Update the quorum scoreboard after every quorum round (R8).
- Write SUMMARY.md artifacts after every plan and quick task execution.

Skipping these is the failure mode. The audit trail is the enforcement.

---

## Appendix — Quorum Model Registry

| Model | Tool Prefix | Role |
|---|---|---|
| **Claude** (Sonnet 4.6) | self | Voting quorum member; primary reasoner; sole executor |
| **Codex** | `mcp__codex-cli__review` | External reviewer |
| **Gemini** | `mcp__gemini-cli__gemini` | External reviewer |
| **OpenCode** | `mcp__opencode__opencode` | External reviewer |
| **Copilot** | `mcp__copilot-cli__ask` | External reviewer |

**Availability note:** Codex is frequently UNAVAILABLE (usage limits). Gemini hits daily quota (~30 min resets). Design for reduced quorum as the common case, not the exception.

---END CLAUDE.md CONTENT---

IMPORTANT: CLAUDE.md is gitignored by project design. Write to disk only at `/Users/jonathanborduas/code/QGSD/CLAUDE.md`. Do NOT stage or commit this file.
  </action>
  <verify>
    grep -n "audit-trail enforcement" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    # Must return a match in the Design Principles section

    grep -n "STATE\.md\|scoreboard\|SUMMARY\.md" /Users/jonathanborduas/code/QGSD/CLAUDE.md | grep -i "audit\|mechanism\|trail"
    # Must return matches showing the three mechanisms are named

    grep -n "trust + audit\|trust+audit\|trust.*audit" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    # Must return match

    grep -n "FSM\|permission.*gate\|hard gate\|Finite State" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    # Must return match — FSM contrast is present

    grep -n "R3.6\|R8\|R5\|R4" /Users/jonathanborduas/code/QGSD/CLAUDE.md
    # Must return multiple matches — prior rules preserved

    git -C /Users/jonathanborduas/code/QGSD status | grep CLAUDE.md
    # Must NOT appear in staged files (it's gitignored)
  </verify>
  <done>
CLAUDE.md exists on disk at /Users/jonathanborduas/code/QGSD/CLAUDE.md with:
- All rules R0–R8 intact
- New "Design Principles" section containing the audit-trail enforcement principle
- Three audit mechanisms (STATE.md, scoreboard, SUMMARY.md) explicitly named
- FSM contrast present with explanation of why flexibility is a strength
- File NOT staged in git (gitignored by design)
  </done>
</task>

</tasks>

<verification>
After task completion:
1. grep "audit-trail enforcement" /Users/jonathanborduas/code/QGSD/CLAUDE.md — must match
2. grep "trust + audit" /Users/jonathanborduas/code/QGSD/CLAUDE.md — must match
3. grep "STATE.md\|scoreboard\|SUMMARY.md" /Users/jonathanborduas/code/QGSD/CLAUDE.md — must show three mechanisms in Design Principles
4. grep "FSM\|Finite State" /Users/jonathanborduas/code/QGSD/CLAUDE.md — must match
5. grep "R3.6\|R8.3\|R5.2" /Users/jonathanborduas/code/QGSD/CLAUDE.md — must match (prior rules present)
6. git -C /Users/jonathanborduas/code/QGSD status | grep CLAUDE — must be empty (gitignored, not staged)
</verification>

<success_criteria>
- CLAUDE.md exists on disk with all rules R0–R8 intact
- New Design Principles section present with audit-trail enforcement principle
- Three audit mechanisms explicitly named: STATE.md, quorum scoreboard, SUMMARY.md
- FSM contrast articulated: why hard-gate approach is not viable and why flexibility is a strength
- Invariant stated: audit trail only works if artifacts are maintained (Claude must update them)
- CLAUDE.md not staged or committed (gitignored by project design)
</success_criteria>

<output>
After completion, create `.planning/quick/38-codify-trust-plus-audit-enforcement-phil/38-SUMMARY.md` with:
- What was added (Design Principles section, audit-trail enforcement principle)
- Why CLAUDE.md was not committed (gitignored by design)
- Confirmation the three audit mechanisms are named and the FSM contrast is present
</output>
