# quorum-debug artifact
date: 2026-02-22T20:30:00.000Z
failure_context: codex-cli and gemini-cli showing 'error' health in /qgsd:mcp-status (no identity tool)
exit_code: N/A — configuration issue

## consensus
root_cause: codex-cli and gemini-cli used npx which runs npm-published versions lacking the identity tool, while local dist/ builds have it
next_step: switch codex-cli + gemini-cli in ~/.claude.json from npx to local dist/ node path

## fix applied
- codex-cli: `{ "command": "npx", "args": ["-y","codex-mcp-server"] }` → `{ "command": "node", "args": ["/Users/jonathanborduas/code/codex-mcp-server/dist/index.js"] }`
- gemini-cli: `{ "command": "npx", "args": ["-y","gemini-mcp-server"] }` → `{ "command": "node", "args": ["/Users/jonathanborduas/code/gemini-mcp-server/dist/index.js"] }`

## worker responses
| Model    | Confidence | Root Cause                                                  |
|----------|------------|-------------------------------------------------------------|
| Gemini   | UNAVAIL    | —                                                           |
| OpenCode | HIGH       | npm-published versions lack identity tool vs local builds   |
| Copilot  | HIGH       | npx loads stale npm cache missing identity tool             |
| Codex    | UNAVAIL    | quota exceeded (retry Feb 24 2026)                          |

## bundle
FAILURE CONTEXT: codex-cli and gemini-cli showing 'error' health in /qgsd:mcp-status
- ~/.claude.json used npx for codex-cli and gemini-cli
- Local repos at /Users/jonathanborduas/code/{codex,gemini}-mcp-server/ have identity in dist/
- npm-cached versions do NOT have identity tool
- opencode and copilot-cli (working) use local node dist/ paths
