# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Node.js built-in `node:test` module (v18+)
- Config: `get-shit-done/bin/gsd-tools.test.cjs`

**Assertion Library:**
- Node.js built-in `node:assert` module (strict assertions)

**Run Commands:**
```bash
npm test                    # Run all tests
node --test get-shit-done/bin/gsd-tools.test.cjs  # Direct invocation
```

## Test File Organization

**Location:**
- Co-located with implementation: `.cjs` pair (e.g., `gsd-tools.cjs` + `gsd-tools.test.cjs`)
- Both in `get-shit-done/bin/` directory

**Naming:**
- Test file: `<implementation>.test.cjs`
- Tests are the only `.test.cjs` files in the codebase

**Structure:**
```
get-shit-done/bin/
├── gsd-tools.cjs          # Main implementation
└── gsd-tools.test.cjs      # Tests
```

## Test Structure

**Suite Organization:**

```javascript
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

describe('history-digest command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('empty phases directory returns valid schema', () => {
    const result = runGsdTools('history-digest', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const digest = JSON.parse(result.output);
    assert.deepStrictEqual(digest.phases, {}, 'phases should be empty object');
  });

  test('nested frontmatter fields extracted correctly', () => {
    // ... test implementation
  });
});
```

**Patterns:**
- Nested `describe()` blocks organize related tests
- `beforeEach()` creates temporary test directories
- `afterEach()` cleans up filesystem state
- Each `test()` is a single logical test case

## Mocking

**Framework:** Manual mocking via temporary filesystem operations

**Patterns:**

```javascript
// Helper to create temporary test project
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  return tmpDir;
}

// Helper to execute CLI command and capture result
function runGsdTools(args, cwd = process.cwd()) {
  try {
    const result = execSync(`node "${TOOLS_PATH}" ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

// Create test file structure
function setup() {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);
}
```

**What to Mock:**
- Filesystem via `fs.mkdtempSync()`, `fs.writeFileSync()`, `fs.mkdirSync()`
- CLI execution via `execSync()` spawning the actual tool
- Configuration via temporary `.planning/config.json` files

**What NOT to Mock:**
- The actual `gsd-tools.cjs` CLI (invoked directly via `execSync`)
- Filesystem state (use real temp directories, not mocked)
- JSON parsing (real data used for integration testing)

## Fixtures and Factories

**Test Data:**

Fixtures are created inline as markdown strings:

```javascript
const summaryContent = `---
phase: "01"
name: "Foundation Setup"
dependency-graph:
  provides:
    - "Database schema"
    - "Auth system"
  affects:
    - "API layer"
tech-stack:
  added:
    - "prisma"
    - "jose"
patterns-established:
  - "Repository pattern"
  - "JWT auth flow"
key-decisions:
  - "Use Prisma over Drizzle"
  - "JWT in httpOnly cookies"
---

# Summary content here
`;
```

**Location:**
- Inline within test blocks (no separate fixture files)
- `beforeEach()` creates temporary directory structure
- Files written via `fs.writeFileSync()` with fixture content

## Coverage

**Requirements:** None enforced (no coverage configuration)

**View Coverage:**
- Not available; coverage tooling not configured
- Tests focus on behavioral correctness, not line coverage

## Test Types

**Unit Tests:**
- Test individual command functions (e.g., `history-digest`, `state load`)
- Scope: single CLI command behavior
- Use real filesystem via `mkdtempSync()` to test file I/O

**Integration Tests:**
- Test CLI invocation via `execSync()` with full command flow
- Scope: full command execution with real stdout/stderr capture
- All tests function as integration tests (CLI-level)

**E2E Tests:**
- Not used; integration tests via `execSync` serve this purpose

## Common Patterns

**Async Testing:**

No async/await used. All tests are synchronous:

```javascript
test('synchronous file operations', () => {
  const result = runGsdTools('history-digest', tmpDir);
  assert.ok(result.success);
});
```

Tests spawn subprocesses via `execSync()` (blocking) rather than promises.

**Error Testing:**

```javascript
test('malformed SUMMARY.md skipped gracefully', () => {
  // Create valid file
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), validContent);

  // Create malformed file
  fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), `---
broken: [unclosed
---`);

  // Command succeeds despite error
  const result = runGsdTools('history-digest', tmpDir);
  assert.ok(result.success, `Command should succeed despite malformed files: ${result.error}`);

  const digest = JSON.parse(result.output);
  assert.ok(digest.phases['01'], 'Phase 01 should exist');
});
```

Pattern: Test graceful degradation by including malformed data alongside valid data.

**State Verification:**

```javascript
test('nested frontmatter fields extracted correctly', () => {
  // Setup file with nested YAML
  fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), summaryContent);

  // Execute command
  const result = runGsdTools('history-digest', tmpDir);

  // Verify nested fields extracted
  const digest = JSON.parse(result.output);
  assert.deepStrictEqual(
    digest.phases['01'].provides.sort(),
    ['Auth system', 'Database schema'],
    'provides should contain nested values'
  );
});
```

Pattern: Nested assertions verify complex data structure transformations.

## Test Execution Context

**Test Discovery:**
- Files matching `*.test.cjs` in `get-shit-done/bin/`
- Invoked via `npm test` in `package.json` script

**Environment:**
- Tests run in isolated temporary directories (`fs.mkdtempSync`)
- Cleanup in `afterEach()` removes all test artifacts
- No global state pollution between tests

**Subprocess Communication:**
- CLI output captured via `execSync(..., { stdio: ['pipe', 'pipe', 'pipe'] })`
- stdout/stderr captured into `result.output` and `result.error`
- Exit codes used to determine success/failure

---

*Testing analysis: 2026-02-20*
