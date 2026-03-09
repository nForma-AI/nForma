# Quorum Debate
Question: Is the fork-based async approach (solve-worker.cjs + async wrappers in nForma.cjs) correct and complete for making the TUI non-blocking in the Solve modules?
Date: 2026-03-09
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude | APPROVE — fork pattern correct, `child_process.fork()` is the right choice since sweeps use spawnSync internally. Minor concerns about double-resolve race and screen reference scope. | bin/solve-worker.cjs, bin/nForma.cjs:11-140, bin/nf-solve.cjs:99 |
| codex-1 (primary) | UNAVAIL — timeout after 30s | — |
| opencode-1 (T1 fallback) | APPROVE_WITH_CONCERNS — sound architecture, 6 strengths noted. Concerns: settle guard needed, IPC size limits for classifyAsync, no worker cleanup on parent crash, no backpressure on batch IPC. | bin/solve-worker.cjs:1-100, bin/nForma.cjs:36-160, bin/nForma.cjs:3421-3432, bin/nForma.cjs:3495-3510, bin/nForma.cjs:3700-3715, bin/nForma.cjs:4068-4145 |
| gemini-1 (primary) | UNAVAIL — timeout after 30s | — |
| copilot-1 (T1 fallback) | APPROVE_WITH_CONCERNS — correct pattern. Concerns: double-resolve race, suggest disconnect() over kill(), worker reuse across flows, top-level require may be dead code for solve flows. | bin/solve-worker.cjs, bin/nForma.cjs:35-160 (wrappers), bin/nForma.cjs:9-10 (top-level requires) |

## Outcome
All 3 available models (Claude, opencode-1, copilot-1) approved the approach. The fork-based async pattern correctly addresses the root cause: `spawnSync()` calls in nf-solve.cjs sweep functions block the blessed event loop, and `child_process.fork()` creates an independent process with its own event loop. All four solve flows are properly converted to async with loading indicators and error handling.

Post-consensus, the top shared concern (settled guard to prevent double-resolve/reject race) was applied immediately, along with switching from `child.kill()` to `child.disconnect()` for graceful worker shutdown.
