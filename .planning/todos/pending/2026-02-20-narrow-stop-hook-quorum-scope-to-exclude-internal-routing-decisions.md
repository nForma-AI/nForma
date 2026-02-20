---
created: 2026-02-20T20:27:47.349Z
title: Narrow stop hook quorum scope to exclude internal routing decisions
area: planning
files:
  - CLAUDE.md
  - hooks/src/qgsd-stop.js
---

## Problem

Quorum is firing for GSD's own internal operations, not just project decisions. These should never require quorum:

- **`/gsd:map-codebase`** — mapping the codebase is a GSD file operation, not a project decision
- **`/gsd:new-project` routing** — routing the user to run a prerequisite command is workflow navigation
- **`/gsd:discuss-phase` intermediate steps** — mid-workflow status messages aren't project decisions
- **Any todo/STATE.md write** — GSD managing its own planning files

The core principle: **quorum is for decisions about the project being built** (plans, architecture, roadmaps, phase research). It is NOT for GSD managing its own files or orchestrating its own workflow.

The stop hook currently pattern-matches on command names and fires on any Stop event for an allowlisted command — regardless of whether Claude is making a project decision or just doing GSD housekeeping.

## Solution

Redefine the quorum trigger condition: quorum is required only when Claude is delivering a **project decision output** — a plan, roadmap, architecture choice, research result, or verification report about the project.

GSD's own internal operations are explicitly exempt:
- Codebase mapping (`/gsd:map-codebase`)
- Workflow routing (directing user to run another command)
- Todo/STATE.md management
- Agent spawning and status reporting
- Any step where GSD is managing itself, not deciding about the project

Implementation: the stop hook allowlist or trigger logic needs to distinguish "GSD housekeeping commands" from "project decision commands".
