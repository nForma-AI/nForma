---
created: 2026-02-20T19:26:27.611Z
title: Add qgsd:quorum command for consensus answers
area: planning
files: []
---

## Problem

Claude needs a way for users to ask an ad-hoc question to the full quorum (Claude + Codex + Gemini + OpenCode + Copilot) and get a consensus answer — without the answer being tied to a specific NON_EXECUTION workflow like plan-phase or research-phase.

Currently, quorum is only invoked internally by CLAUDE.md rules (R3) during specific lifecycle steps. There's no user-facing command to say "run this question through the quorum and give me the consensus answer."

## Solution

Create `/qgsd:quorum` command with two modes based on the input context:

### Mode A — Pure Question (no commands required)
1. Takes a question/prompt as input
2. Follows R3 Quorum Protocol: Claude forms position, then queries Codex, Gemini, OpenCode, Copilot sequentially
3. Runs deliberation rounds until CONSENSUS or 4 rounds max
4. Returns consensus answer or escalates disagreement to user

### Mode B — Execution + Trace Review (when commands must be run and approval must be given)
Triggered when the context implies running a sequence of commands before a verdict is possible (e.g. "should we approve this plan", "does this pass", "is this safe to execute").

1. **Claude runs the command sequence** — executes all relevant commands (tests, lint, build, verifications, etc.) and captures full output logs/traces
2. **Logs are preserved** — all traces are kept and made available to reviewers (not summarized, full fidelity)
3. **Quorum reviews the traces** — each model (Codex, Gemini, OpenCode, Copilot) receives the full execution traces alongside the original question
4. **Each member gives a verdict** — approve / reject / flag, with reasoning grounded in the actual trace output
5. **Deliberation if split** — disagreements follow R3.3 deliberation (up to 3 rounds), with traces always in context
6. **Final output** — consensus verdict with trace-backed rationale, or escalation to user if no consensus

Useful for: pre-execution approval gates, verifying a fix actually works, validating a plan's assumptions against real output, or any "run it and tell me if it's good" scenario.
