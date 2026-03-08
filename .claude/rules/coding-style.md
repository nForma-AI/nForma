---
paths:
  - "hooks/**/*.js"
  - "hooks/dist/**/*.js"
  - "bin/**/*.{js,cjs,mjs}"
---

# Coding Style Rules

- All hook files use `'use strict'` at the top
- Use CommonJS (`require`/`module.exports`) for hooks and bin/ scripts -- NOT ESM
- The sole ESM exception is `bin/unified-mcp-server.mjs`
- Config loading: always use `require('./config-loader')` with `loadConfig()` and `shouldRunHook()`
- Two-layer config merge: DEFAULT_CONFIG -> ~/.claude/nf.json (global) -> .claude/nf.json (project)
- All hooks read stdin as JSON, process, write JSON to stdout (or nothing for no-op)
- Prefer `spawnSync` for subprocess calls in hooks (synchronous hooks)
- Hook profile guard pattern: load config, extract profile, call shouldRunHook(), exit 0 if inactive
