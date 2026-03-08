---
paths:
  - "hooks/**/*.js"
  - "bin/**/*.{js,cjs,mjs}"
  - ".env*"
---

# Security Rules

- Never commit .env files, API keys, or secrets to git
- All hook files must use fail-open pattern (try/catch wrapping process.exit(0))
- Hook stdout is the decision channel -- never write debug output to stdout, use stderr
- MCP server credentials live in ~/.claude.json, never in repo files
- The `NF_CLAUDE_JSON` env var is for testing only -- never set in production
- Never store quorum results or cache entries containing sensitive model responses in git-tracked files
