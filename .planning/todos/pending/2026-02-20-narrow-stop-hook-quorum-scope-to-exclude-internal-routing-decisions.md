---
created: 2026-02-20T20:27:47.349Z
title: Narrow stop hook quorum scope to exclude internal routing decisions
area: planning
files:
  - CLAUDE.md
  - hooks/src/qgsd-stop.js
---

## Problem

The stop hook fires quorum for internal GSD workflow steps that are NOT presenting a plan or research output. This is overkill in at least three observed cases:

1. **`/gsd:new-project` routing** — detects existing code, routes user to `/gsd:map-codebase`. Stop hook fires before delivering this simple routing message.

2. **`/gsd:discuss-phase` responses** — stop hook fires even on intermediate discuss-phase workflow steps, not just when the filtered question list is presented.

3. **`/gsd:map-codebase` mid-workflow** — stop hook fires while Claude is waiting for background mapper agents to complete, before any output is presented to the user. The quorum reviews "is this approach correct?" — a meaningless question at that stage.

The hook is matching on command name (`/gsd:new-project`, `/gsd:map-codebase`, etc.) in the transcript but NOT distinguishing between:
- Intermediate workflow steps (agent spawning, routing, status updates)
- Final substantive outputs that actually need quorum (plans, roadmaps, research reports, verified question lists)

## Solution

The stop hook should only require quorum when Claude is about to deliver a **final substantive NON_EXECUTION output** — not on every Stop event that mentions a GSD command.

Options:
- Add a structured sentinel Claude emits only when presenting final output (e.g., `<!-- QUORUM_REQUIRED -->`), and only check for quorum evidence when that sentinel is present
- Narrow the hook's allowlist to specific output patterns (e.g., "Here is the plan", "Phase plan complete") rather than command name presence
- Add an exemption for mid-workflow intermediate steps (routing, agent spawning, status waiting)

The current architecture makes the hook over-broad — it gates every Stop event for an allowlisted command, including purely administrative mid-workflow turns.
