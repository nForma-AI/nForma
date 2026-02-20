---
created: 2026-02-20T19:26:27.611Z
title: Add gsd:quorum command for consensus answers
area: planning
files: []
---

## Problem

Claude needs a way for users to ask an ad-hoc question to the full quorum (Claude + Codex + Gemini + OpenCode + Copilot) and get a consensus answer — without the answer being tied to a specific NON_EXECUTION workflow like plan-phase or research-phase.

Currently, quorum is only invoked internally by CLAUDE.md rules (R3) during specific lifecycle steps. There's no user-facing command to say "run this question through the quorum and give me the consensus answer."

## Solution

Create `/gsd:quorum` command that:
1. Takes a question/prompt as input (from arguments or conversation context)
2. Follows the full R3 Quorum Protocol from CLAUDE.md:
   - Claude forms its own position first
   - Queries Codex, Gemini, OpenCode, Copilot sequentially with identical prompts
   - Runs deliberation rounds until CONSENSUS or 4 rounds max
   - Escalates to user if no consensus after round 4
3. Returns the consensus answer (or the disagreement breakdown with Claude's recommendation)

Useful for: architecture questions, approach decisions, debugging hypotheses, or any situation where the user wants a multi-model validated answer.
