# Quorum Debate
Question: Can the current nForma codebase detect whether the active Claude session is running with a 200K or 1M context window?
Date: 2026-03-14
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | No reliable detection. context_window_size defaults to 1M when absent. display_name not parsed for tier. No env vars. | hooks/nf-statusline.js:54, hooks/nf-statusline.js:31, hooks/nf-context-monitor.js:99-104 |
| codex-1 (primary) | UNAVAIL | — |
| gemini-1 (T1 fallback) | UNAVAIL | — |
| claude-1 (T2 fallback) | YES_PARTIAL: context_window_size exists in hook schema but defaults to 1M. display_name has no tier info. No env vars. 6 modules needed. | hooks/nf-statusline.js:42-57, hooks/config-loader.js (HOOK_INPUT_SCHEMAS), hooks/nf-context-monitor.js |
| copilot-1 (primary) | UNAVAIL | — |
| opencode-1 (T1 fallback) | UNAVAIL | — |
| claude-3 (T2 fallback) | INVESTIGATE_THEN_IMPLEMENT: Partial support exists. context_window_size in schema but unconfirmed if actually sent. display_name: NO. No env vars. 6 implementation steps. | hooks/nf-statusline.js:42-57, hooks/config-loader.js, .planning/milestones/v0.28-phases/.../v0.28-03-RESEARCH.md, hooks/nf-statusline.test.js |

## Outcome
All valid external voters agree: the current nForma codebase **cannot reliably detect** 200K vs 1M context windows. Partial infrastructure exists (`context_window_size` field in hook payloads) but defaults mask the signal. No env vars or display_name parsing provides the distinction. Implementation would require 5-6 module changes plus empirical confirmation that Claude Code populates the field.
