# Quorum Debate
Question: Should QGSD implement a pending-task pattern in `qgsd-prompt.js` to queue a skill invocation that survives a `/clear` command?
Date: 2026-02-26
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | APPROVE — pending-task pattern fits naturally into UserPromptSubmit hook; minimal implementation (~20 lines in qgsd-prompt.js); trivially reversible; pair with /qgsd:queue helper for discoverability | — |
| gemini-1 | UNAVAIL | quota exhausted (~23h33m reset) |
| opencode-1 | APPROVE — enhances workflow resilience for interrupted workflows; one-shot injection is clean; aligns with trust+audit model; fits v0.15 Health & Tooling Modernization focus | CLAUDE.md R0/Design Principles; .planning/STATE.md v0.15; hooks/qgsd-prompt.js lines 92–175 |

## Outcome
CONSENSUS: APPROVE (Claude + opencode-1; gemini-1 UNAVAIL — reduced quorum per R6)

Implement the pending-task pattern by extending `qgsd-prompt.js` to:
1. Check for `.claude/pending-task.txt` on each UserPromptSubmit event
2. If found, prepend the task content as additionalContext injection
3. Delete the file after reading (one-shot, no repeat injection)
4. Add a `/qgsd:queue` helper command that writes the file

This enables the workflow: write pending task → `/clear` → system auto-invokes on next prompt.
