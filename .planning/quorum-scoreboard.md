# Quorum Scoreboard

Tracks per-model performance across all QUORUM rounds. Updated after every quorum per R8.

## Cumulative Scores

| Model | Score | TP | TN | FP | FN | Improvements Accepted | Rounds Participated |
|-------|-------|----|----|----|----|----------------------|---------------------|
| Claude | +3 | 3 | 0 | 0 | 0 | 0 | 3 |
| Gemini | +11 | 5 | 0 | 0 | 0 | 3 | 5 |
| OpenCode | +6 | 4 | 0 | 0 | 0 | 1 | 4 |
| Copilot | +7 | 5 | 0 | 0 | 0 | 1 | 5 |
| Codex | 0 | 0 | 0 | 0 | 0 | 0 | 0 (UNAVAIL) |

## Round Log

| Date | Task | Round | Model | Vote | Final Consensus | Classification | Points | Notes |
|------|------|-------|-------|------|-----------------|----------------|--------|-------|
| 2026-02-21 | quick-2 R3.6 rule | 1 | Claude | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-2 R3.6 rule | 1 | Gemini | APPROVE (proposed cap=3) | APPROVE (cap=10) | TP | +1 | |
| 2026-02-21 | quick-2 R3.6 rule | 1 | Gemini | — | — | Improvement Accepted | +2 | Proposed 3-round cap; incorporated as 10-iteration limit |
| 2026-02-21 | quick-2 R3.6 rule | 1 | OpenCode | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-2 R3.6 rule | 1 | Copilot | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-2 R3.6 rule | 1 | Codex | UNAVAIL | — | — | — | Usage limit |
| 2026-02-21 | quick-4 scoring system | 1 | Claude | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-4 scoring system | 1 | Gemini | REVIEW-NEEDED (proposed weighting) | APPROVE | TP | +1 | |
| 2026-02-21 | quick-4 scoring system | 1 | Gemini | — | — | Improvement Accepted | +2 | Proposed weighted scoring (TN=5>>TP=1); incorporated to prevent rubber-stamper dominance |
| 2026-02-21 | quick-4 scoring system | 1 | Copilot | APPROVE | APPROVE | TP | +1 | Two-file approach correct; explicit edge cases needed |
| 2026-02-21 | quick-4 scoring system | 1 | Codex | UNAVAIL | — | — | — | Usage limit |
| 2026-02-21 | quick-4 scoring system | 1 | OpenCode | UNAVAIL | — | — | — | Timeout |
| 2026-02-21 | quick-5 pre-flight validation | 1 | Gemini | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | Gemini | — | — | Improvement Accepted | +2 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | OpenCode | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | OpenCode | — | — | Improvement Accepted | +2 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | Copilot | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | Copilot | — | — | Improvement Accepted | +2 | |
| 2026-02-21 | quick-5 pre-flight validation | 1 | Codex | UNAVAIL | — | — | — | |
| 2026-02-21 | quick-5 pre-flight validation | 2 | Gemini | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-5 pre-flight validation | 2 | OpenCode | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-5 pre-flight validation | 2 | Copilot | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-7 USER-GUIDE diagram | 1 | Claude | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-7 USER-GUIDE diagram | 1 | Gemini | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-7 USER-GUIDE diagram | 1 | OpenCode | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-7 USER-GUIDE diagram | 1 | Copilot | APPROVE | APPROVE | TP | +1 | |
| 2026-02-21 | quick-7 USER-GUIDE diagram | 1 | Codex | UNAVAIL | — | — | — | Usage limit until Feb 24 |
| 2026-02-21 | quick-5 pre-flight validation | 2 | Codex | UNAVAIL | — | — | — | |

## Notes

- Rounds before R8 was added (2026-02-21, quick task 4) are backfilled based on observed behavior during those sessions.
- Improvement Accepted/Rejected rows are recorded separately from the TP/TN/FP/FN row for the same round to allow independent point tracking.
- Round 2 deliberation rounds do not generate new TP/TN entries; improvement classifications are captured in the round where the improvement was proposed.
- Codex has been UNAVAILABLE in all rounds to date due to usage limits.
- Claude rows begin from quick-4 (when R8 was defined); Claude was present in earlier rounds but not retroactively scored.
