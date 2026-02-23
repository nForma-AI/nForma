# quorum-test artifact
date: 2026-02-23T18:45:00Z
files: hooks/qgsd-stop.test.js
exit_code: 0

## verdict
PASS

## worker verdicts
| Model    | Verdict | Concerns                                     |
|----------|---------|----------------------------------------------|
| Gemini   | PASS    | Fail-open design noted (intentional by design)|
| OpenCode | PASS    | none                                         |
| Copilot  | UNAVAIL | CLI format error                             |
| Codex    | UNAVAIL | Usage limit until Feb 24 2026                |
| CONSENSUS| PASS    | 2 PASS, 0 BLOCK, 2 UNAVAIL                  |

## execution bundle summary
- Node: v25.6.1
- Tests: 24 pass, 0 fail
- Key fixes verified: TC6/TC9 env-isolated, buildBlockReason restored, quorum enforcement re-enabled
