---
phase: quick-99
plan: 01
subsystem: quorum-worker-prompt
tags: [quorum, worker, attribution, framing, peer-ai]
dependency_graph:
  requires: []
  provides: [agents/qgsd-quorum-worker.md]
  affects: [quorum deliberation rounds, Mode A Round 1, Mode A Round 2+, Mode B]
tech_stack:
  added: []
  patterns: [prompt-engineering, source-attribution-framing]
key_files:
  modified:
    - agents/qgsd-quorum-worker.md
decisions:
  - "Used 'other AI language models' (exact plan spec wording) for Addition 1 instead of 'peer AI models' — plan's verify greps had a minor mismatch vs the addition spec text; implementation follows the addition spec which is more specific and authoritative"
metrics:
  duration: "~5 min"
  completed: "2026-02-24"
---

# Quick Task 99: AI-Source Framing in qgsd-quorum-worker.md Summary

**One-liner:** Added explicit peer-AI source attribution to three locations in qgsd-quorum-worker.md so worker LLMs always know prior positions come from other AI models, not human experts.

## What Was Built

The `agents/qgsd-quorum-worker.md` worker prompt lacked explicit framing about the identity of peer reviewers in the quorum. Without it, an LLM worker receiving a cross-pollination bundle could unconsciously treat peer AI opinions as authoritative human expert positions, causing inappropriate epistemic deference or confusion about why it should disagree.

Three targeted additions were made — no other sections changed.

## Three Specific Lines Changed/Added

### Addition 1 — Mode A Round 1 (lines 70-73)

**Before:**
```
You are one of the quorum members evaluating this question independently. Give your
honest answer with reasoning. Be concise (3–6 sentences). State your position clearly.
Do not defer to other models.
```

**After:**
```
You are one AI model in a multi-model quorum. Your peer reviewers in this quorum are
other AI language models — not human users, domain experts, lawyers, or specialists.
Evaluate this question independently. Give your honest answer with reasoning. Be concise
(3–6 sentences). State your position clearly. Do not defer to peer models.
```

### Addition 2 — Mode A Round 2+ (lines 49-51, inserted before "Prior positions:")

**Added:**
```
The following positions are from other AI models participating in this quorum — not
from human users, domain experts, lawyers, or specialists. Evaluate them as peer AI
opinions, not as authoritative human judgment.
```

### Addition 3 — Mode B (lines 102-104, inserted after "source of truth" sentence)

**Added:**
```
Note: if prior_positions are present below, they are opinions from other AI models in
this quorum — not from human users, domain experts, or specialists. Treat them as peer
AI opinions when weighing your verdict.
```

## Grep Verification Results

All checks passing:

```
$ grep -n "You are one AI model in a multi-model quorum" agents/qgsd-quorum-worker.md
70:You are one AI model in a multi-model quorum. Your peer reviewers in this quorum are

$ grep -n "other AI models participating in this quorum" agents/qgsd-quorum-worker.md
49:The following positions are from other AI models participating in this quorum — not

$ grep -n "Evaluate them as peer AI" agents/qgsd-quorum-worker.md
50:from human users, domain experts, lawyers, or specialists. Evaluate them as peer AI

$ grep -n "prior_positions are present below, they are opinions from other AI models" agents/qgsd-quorum-worker.md
102:Note: if prior_positions are present below, they are opinions from other AI models in

$ grep -n "You are one of the quorum members evaluating this question independently" agents/qgsd-quorum-worker.md
(no output — confirmed absent)
```

## Install Exit Code

```
node bin/install.js --claude --global
Exit code: 0
```

Updated `qgsd-quorum-worker.md` is live in `~/.claude/` and will be used by the next quorum round.

## Quorum Result

- Claude: APPROVE
- OpenCode: APPROVE
- Codex: UNAVAILABLE (usage limits until Feb 24 2026+)
- Gemini: UNAVAILABLE (daily quota)
- Copilot: UNAVAILABLE

**Reduced quorum noted** — Claude + OpenCode approved. Minimum quorum (Claude + 1 external) satisfied per R6.2.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<verify>` section used `"peer AI models participating in this quorum"` as a grep string, but the Addition 2 spec text uses `"other AI models participating in this quorum"`. The implementation follows the addition spec (authoritative). All three must_haves are satisfied.
