---
created: 2026-02-20T20:27:47.349Z
title: Narrow stop hook quorum scope to exclude internal routing decisions
area: planning
files:
  - CLAUDE.md
---

## Problem

The stop hook fires quorum for internal GSD workflow routing decisions, which is overkill. For example: when `/gsd:new-project` detects existing code and routes the user to `/gsd:map-codebase`, the stop hook intercepts this routing response and demands full quorum review before Claude can deliver it.

Quorum should only be required when presenting a substantive NON_EXECUTION output to the user (a plan, research result, roadmap, verification report). It should NOT fire for:
- Routing decisions ("run this command first, then come back")
- Workflow navigation responses
- Simple user prompts asking for the next step

The current hook allowlist is too broad — it catches these routing messages as if they were plan outputs.

## Solution

Update the stop hook (or its allowlist/trigger conditions in CLAUDE.md R3.1) to distinguish between:
1. **Substantive outputs** — actual plan/research/roadmap content → quorum required
2. **Routing/navigation responses** — directing user to run a different command → quorum NOT required

Could be implemented via:
- A keyword/pattern filter in the stop hook that detects routing-only responses
- An explicit exemption list for routing responses from sub-steps (e.g., "map codebase first" handoffs)
- A structured marker Claude adds to routing responses to signal "no quorum needed"
