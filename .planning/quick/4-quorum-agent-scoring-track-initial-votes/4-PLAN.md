---
type: quick-full
num: 4
slug: quorum-agent-scoring-track-initial-votes
description: "quorum agent scoring: track initial votes vs final consensus to compute TP/TN/FP/FN scores and improvement acceptance rates per model"
date: 2026-02-21

must_haves:
  truths:
    - R8 rule exists in CLAUDE.md defining TP/TN/FP/FN scoring schema with weighted points
    - R8 specifies weighted scoring: TN=5pts, TP=1pts, FP=-3pts, FN=-1pt, accepted improvement=+2pts
    - R8 defines edge cases: unanimous Round 1 = all TP; multi-contrarian = each scored individually
    - R8 includes update protocol: Claude updates scoreboard after every quorum
    - .planning/quorum-scoreboard.md exists with initial template and column headers
  artifacts:
    - CLAUDE.md (modified — R8 added after R7)
    - .planning/quorum-scoreboard.md (new file — scoreboard template)
  key_links: []
---

# Quick Task 4: Quorum Agent Scoring System

## Quorum Result

**CONSENSUS REACHED** after Round 2 (Reduced quorum — Codex UNAVAILABLE/usage limit, OpenCode UNAVAILABLE/timeout, per R6.4)

- Claude: APPROVE — TP/TN/FP/FN schema, two-file approach, sound design
- Gemini: APPROVE (revised) — initially REVIEW-NEEDED, approved after confirming weighted scoring incorporated (TN=5 >> TP=1 to prevent rubber-stamper dominance)
- Copilot: APPROVE — two-file approach correct, explicit edge case rules needed

**R3.6 activated:** Gemini proposed improvements (weighted scoring, edge cases) in Round 1 → incorporated → re-quorum → consensus reached in Round 2.

## Agreed Design

### Scoring Schema (per quorum round)

| Classification | Condition | Points |
|---|---|---|
| True Positive (TP) | Agent approved; consensus approved | +1 |
| True Negative (TN) | Agent was contrarian; consensus adopted their position | +5 |
| False Positive (FP) | Agent approved; consensus adopted contrarian's position | -3 |
| False Negative (FN) | Agent was contrarian; consensus rejected their objection | -1 |
| Improvement Accepted | Agent proposed improvement; incorporated into final plan | +2 |
| Improvement Rejected | Agent proposed improvement; not incorporated | 0 |

### Edge Cases
- **Unanimous Round 1 (no contrarians):** All agents score TP (+1). No bonus for unchallenged agreement.
- **Multi-contrarian:** Each contrarian scored individually based on whether their specific objection prevailed.
- **Pivot (contrarian for imprecise reason but right outcome):** Scored as TN — V1 limitation, documented.
- **UNAVAILABLE models:** Not scored for that round (no entry).

## Tasks

### Task 1: Add R8 to CLAUDE.md

```yaml
files:
  - CLAUDE.md
action: >
  Insert R8 — Agent Score Tracking after R7 (Pre-Response Gate) and before
  the Appendix section. Define the TP/TN/FP/FN schema, weighted points,
  edge cases, and the update protocol (Claude updates scoreboard after
  every quorum round).
verify: >
  grep -n "R8" CLAUDE.md shows the new section after R7.
  Rule contains weighted point values (TN=5, TP=1, FP=-3, FN=-1).
  Rule references .planning/quorum-scoreboard.md.
done: R8 section present and correctly positioned in CLAUDE.md
```

**Rule text to insert (after R7 block, before Appendix):**

```markdown
---

## R8 — Agent Score Tracking

After every QUORUM round, Claude MUST update `.planning/quorum-scoreboard.md`
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
3. Append a row to `.planning/quorum-scoreboard.md` for each model in that round.
4. Update each model's cumulative score column.

Claude MUST update the scoreboard **before** presenting output to the user, as part of the same step that records the quorum result.

### R8.4 — Scoreboard Format

See `.planning/quorum-scoreboard.md` for the live scoreboard.
```

### Task 2: Create .planning/quorum-scoreboard.md

```yaml
files:
  - .planning/quorum-scoreboard.md
action: >
  Create the initial scoreboard file with a summary table (cumulative scores
  per model) and a round log table (one row per model per quorum round).
  Pre-populate with the three completed quorums from Quick Tasks 2 and 4
  based on observed behavior.
verify: >
  File exists at .planning/quorum-scoreboard.md.
  Contains ## Cumulative Scores section with all 5 models.
  Contains ## Round Log section.
done: quorum-scoreboard.md exists with headers and initial data
```

**Initial file content:**

The scoreboard starts empty for historical rounds (no retroactive scoring for rounds before R8 existed), but includes the round log structure. The three quorum rounds conducted today (Quick 2 Round 1, Quick 2 Round 2, Quick 4 Round 1, Quick 4 Round 2) are logged based on observed behavior during those sessions.
