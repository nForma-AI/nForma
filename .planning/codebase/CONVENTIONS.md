# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- JavaScript/Node files: lowercase with hyphens for multi-word names (e.g., `gsd-tools.cjs`, `gsd-statusline.js`)
- Test files: append `.test.cjs` suffix (e.g., `gsd-tools.test.cjs`)
- Markdown agent/command files: lowercase with hyphens (e.g., `gsd-codebase-mapper.md`)

**Functions:**
- camelCase for all function names (e.g., `safeReadFile`, `extractFrontmatter`, `cmdStateLoad`)
- Command handlers prefixed with `cmd` (e.g., `cmdCommit`, `cmdStateUpdate`, `cmdHistoryDigest`)
- Helper functions descriptive but concise (e.g., `normalizePhaseName`, `isGitIgnored`)

**Variables:**
- camelCase for all variables and parameters (e.g., `frontmatter`, `phaseDir`, `configPath`)
- Constants in UPPERCASE_SNAKE_CASE (e.g., `TOOLS_PATH`, `PATCHES_DIR_NAME`, `MANIFEST_NAME`)
- Private/internal variables prefixed with underscore when needed for clarity

**Objects/Types:**
- PascalCase for object type names and constructors (e.g., `MODEL_PROFILES`)
- Flat structure preferred, but nested objects allowed for grouped configuration data

## Code Style

**Formatting:**
- No linting/formatting tool configured (no `.eslintrc`, `.prettierrc`, or `biome.json`)
- Indentation: 2 spaces (observed throughout codebase)
- Line length: no hard limit enforced, but generally kept under 100 characters
- Semicolons: required (JavaScript style)
- String quotes: single quotes preferred in most cases, but double quotes used in YAML/JSON output contexts

**Linting:**
- No formal linting configured
- Code style is self-regulated through manual review
- Focus on readability and consistency with existing patterns

## Import Organization

**Order:**
1. Node.js built-in modules (`fs`, `path`, `child_process`, `os`, `readline`, `crypto`)
2. Third-party packages (none currently used)
3. Relative imports/requires

**Pattern:**
```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
```

**Path Aliases:**
None configured. All paths use `require()` or direct `path.join()` calls.

## Error Handling

**Patterns:**
- Errors logged via custom `error()` function at `gsd-tools.cjs:483`:
  ```javascript
  function error(message) {
    process.stderr.write('Error: ' + message + '\n');
  }
  ```
- Try-catch blocks used for risky operations (file I/O, JSON parsing, git operations)
- Empty catch blocks with `} catch { }` used to silently handle non-critical failures (e.g., when checking for optional files)
- Non-critical failures logged to stderr but do not halt execution
- Critical errors call `error()` and may exit with `process.exit(1)`

**Common Patterns:**
```javascript
try {
  const result = fs.readFileSync(filePath, 'utf-8');
  return result;
} catch {
  return null;
}
```

## Logging

**Framework:** console/process.stderr only (no logging library)

**Patterns:**
- Errors written to `process.stderr` via `error()` function
- Success/info written to `process.stdout` via `output()` function at `gsd-tools.cjs:465`
- `--raw` flag available for JSON output (machine-readable)
- Color codes used in install script (`bin/install.js`) for terminal UI

## Comments

**When to Comment:**
- Complex algorithms documented with inline comments explaining logic (e.g., YAML parser in `gsd-tools.cjs:251-324`)
- State machine comments for stack-based logic (e.g., "Stack to track nested objects: [{obj, key, indent}]")
- Regex patterns explained when non-obvious
- Integration points with external systems noted (e.g., "Brave API" comment)

**JSDoc/TSDoc:**
- Minimal JSDoc usage
- Function parameters documented only for public/exported functions
- Complex functions have parameter descriptions in comments above

**Example from `gsd-tools.cjs`:**
```javascript
/**
 * Compute SHA256 hash of file contents
 */
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

## Function Design

**Size:**
- Aim for single responsibility: functions handle one logical operation
- Typical function size: 20-80 lines
- Longer functions (100+ lines) used for complex workflows or command handlers

**Parameters:**
- Single parameter preferred; options object used for 3+ parameters
- Options objects have descriptive keys (e.g., `{ stopped_at, resume_file, phase, plan }`)

**Return Values:**
- Functions return data structures (objects, arrays, or primitives)
- `output()` function used to format/print results (JSON or raw)
- Functions return early on error via `error()` call

## Module Design

**Exports:**
- Single entry point in `gsd-tools.cjs`: command dispatcher via main logic block
- Functions defined as declarations, not exports
- `module.exports` not used (Node.js CommonJS auto-available)

**Barrel Files:**
- Not used; monolithic `gsd-tools.cjs` handles all command logic
- Test file alongside implementation: `gsd-tools.test.cjs` in same directory

## Special Patterns

**Configuration Loading:**
- `loadConfig()` function at `gsd-tools.cjs:156` handles reading `.planning/config.json`
- Settings stored in JSON files (e.g., `settings.json` in Claude/OpenCode config)
- Environment variables checked for overrides (e.g., `CLAUDE_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`)

**YAML Parsing:**
- Custom YAML parser at `gsd-tools.cjs:251-324` (no external parser)
- Handles nested objects, arrays, and mixed structures
- Frontmatter extraction from markdown files with regex: `/^---\n([\s\S]+?)\n---/`

**Command Dispatcher:**
- Main CLI logic at bottom of `gsd-tools.cjs:2200+` (not shown in excerpt)
- Subcommands routed by string name, e.g., `history-digest`, `state load`
- `--raw` flag controls output format (JSON vs human-readable)

---

*Convention analysis: 2026-02-20*
