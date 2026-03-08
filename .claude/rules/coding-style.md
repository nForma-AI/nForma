# Coding Style Rules

- All hook files use `'use strict'` at the top
- Use CommonJS (`require`/`module.exports`) for hooks and bin/ scripts -- NOT ESM
- The sole ESM exception is `bin/unified-mcp-server.mjs`
- Config loading: always use `require('./config-loader')` with `loadConfig()` and `shouldRunHook()`
- Two-layer config merge: DEFAULT_CONFIG -> ~/.claude/nf.json (global) -> .claude/nf.json (project)
- All hooks read stdin as JSON, process, write JSON to stdout (or nothing for no-op)
- Prefer `spawnSync` for subprocess calls in hooks (synchronous hooks)
- Hook profile guard pattern: load config, extract profile, call shouldRunHook(), exit 0 if inactive

## Validate Before Apply

1. **Validate model/config references before applying**: When configuring model names, API endpoints, or provider references, verify they exist in the current provider map (`bin/providers.json`) or package.json before writing config. Rationale: sessions showed non-existent model names being configured, causing downstream failures.

2. **Verify refactors preserve extraction**: When refactoring code that was previously extracted into separate modules/functions, verify the refactored version still imports from the extracted location rather than re-inlining the content. Run `grep` to confirm import statements reference the extracted module. Rationale: sub-skill refactors re-inlined previously extracted content.

3. **Pre-flight infrastructure checks**: Before running automated pipelines (test suites, build scripts, deployment), verify the expected file formats and infrastructure state match assumptions. Check that input files exist and match expected schemas before processing.
