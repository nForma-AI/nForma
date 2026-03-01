---
created: 2026-03-01T18:49:52.524Z
title: Slim down quorum slot worker — remove redundant Haiku file exploration
area: tooling
files:
  - .claude/agents/qgsd-quorum-slot-worker.md
  - .claude/qgsd-bin/call-quorum-slot.cjs
---

## Problem

The `qgsd-quorum-slot-worker` agent (Haiku 4.5) burns significant tokens on file exploration (Read, Glob, Grep) in Step 2 before calling the external coding agent via `call-quorum-slot.cjs`. Each tool call is a Haiku API round-trip with growing context.

This exploration is **redundant** — the MCP slots (Codex CLI, Gemini CLI, OpenCode, Copilot, CCR/DeepSeek) are full coding agents with their own file system access. They can read CLAUDE.md, STATE.md, explore the repo, and find relevant files on their own.

Current Step 2 reads:
- `CLAUDE.md` (full) — Haiku round-trip
- `.planning/STATE.md` (full) — Haiku round-trip
- Artifact file (full) — Haiku round-trip
- "2-3 additional Glob/Grep reads" — 2-4 more Haiku round-trips

Multiply by N parallel workers = N × 5-7 Haiku round-trips of redundant I/O.

## Solution

Make the worker a **thin passthrough**:

1. Parse arguments (no file reads)
2. Build prompt with question + artifact **path** (not content) — let the external agent read it
3. Call `call-quorum-slot.cjs` via Bash
4. Parse output, return structured block

Changes needed:
- Remove Step 2 file reads entirely (or make them opt-in for text-only API slots that genuinely can't read files)
- In Step 3 prompt template, replace embedded `$ARTIFACT_CONTENT` with artifact path + instruction for the agent to read it
- Remove Glob/Grep from the worker's tool list (Read + Bash should suffice for parse/call/return)
- Consider removing Read too if no files need to be read at all

Expected impact: ~80% reduction in Haiku token consumption per quorum round.
