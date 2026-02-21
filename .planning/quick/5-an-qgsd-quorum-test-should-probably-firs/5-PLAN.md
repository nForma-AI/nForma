---
task: 5
slug: an-qgsd-quorum-test-should-probably-firs
description: "qgsd:quorum-test should first validate artifact collection before running tests"
date: 2026-02-21
mode: quick-full
must_haves:
  truths:
    - "Step 1 of quorum-test.md merges discovery + pre-flight validation into one step"
    - "File existence check runs before any test execution"
    - "npm test script validation is mandatory when package.json exists"
    - "Bundle assembly (Step 4) logs [WARN]/[ERROR] per-file distinctions"
  artifacts:
    - "commands/qgsd/quorum-test.md (modified — Step 1 expanded, Step 4 enhanced)"
  key_links:
    - "commands/qgsd/quorum-test.md"
---

# Quick Task 5 Plan: Expand qgsd:quorum-test with pre-flight validation

## Goal

Modify `commands/qgsd/quorum-test.md` so that before running any tests, the command validates that the artifact collection setup is correct. If test files are missing or the npm test script references non-existent paths, the command STOPs with an actionable error — no test execution, no wasted quorum worker calls.

## Quorum summary

Rounds: 2 | Available models: Claude + Gemini + OpenCode + Copilot (Codex UNAVAILABLE)
Result: CONSENSUS APPROVE after Round 2 (no further improvements proposed)

---

## Task 1: Expand Step 1 of quorum-test.md — Parse & validate target

**files:** `commands/qgsd/quorum-test.md`
**action:** Replace the existing "Step 1: Parse target" with an expanded step that merges discovery + pre-flight validation
**verify:** Step 1 in the file has sub-steps 1a–1e covering: argument type detection (file/directory/empty), existence check per file, npm test script validation, and validation summary display
**done:** File saved, step 1 reads correctly

### Replacement content for Step 1

Replace the existing:

```
**Step 1: Parse target**

If `$ARGUMENTS` is non-empty, use it as the test file path.
If `$ARGUMENTS` is empty, discover test files:

```bash
find . \( -name "*.test.js" -o -name "*.test.cjs" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*"
```

Store the list as `$TEST_FILES`. If no files found, stop: "No test files found."
```

With:

```
**Step 1: Parse and validate target**

**1a. Parse `$ARGUMENTS`:**
- If non-empty and points to a **directory**: discover test files within that directory recursively
  ```bash
  find "$ARGUMENTS" \( -name "*.test.js" -o -name "*.test.cjs" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*"
  ```
- If non-empty and points to a **file**: use it directly as `$TEST_FILES`
- If empty: discover all test files from repo root:
  ```bash
  find . \( -name "*.test.js" -o -name "*.test.cjs" \) \
    -not -path "*/node_modules/*" -not -path "*/.git/*"
  ```

Store the list as `$TEST_FILES`.

**1b. Empty check:**

If `$TEST_FILES` is empty, stop: "No test files found."

**1c. File existence check:**

For each file in `$TEST_FILES`, verify it exists on disk:
```bash
ls $TEST_FILES 2>&1
```

If any file is missing, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (missing test files)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Missing: <list of missing files>
Fix: Run `find . -name "*.test.*" | grep -v node_modules` to re-discover valid test files.
```

STOP — do not proceed to test execution.

**1d. npm test script validation (mandatory when package.json exists):**

Check if `package.json` exists:
```bash
ls package.json 2>/dev/null
```

If it exists, read the `"test"` script value. Extract each file path argument (words ending in `.js` or `.cjs`). For each extracted path, check if it exists on disk.

If any path is missing, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM-TEST: BLOCK (npm test script broken)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

package.json "test" script references missing file(s): <list>
Fix: Update package.json test script to:
  "test": "node --test <discovered test files from step 1>"
```

STOP — do not proceed.

**1e. Validation summary:**

Display:
```
✓ N test file(s) validated.
✓ npm test script OK. (or: ⚠ package.json not found — skipping script check)
Proceeding to test execution...
```
```

---

## Task 2: Enhance Step 4 bundle assembly with per-file error logging

**files:** `commands/qgsd/quorum-test.md`
**action:** In Step 4 (Assemble bundle), add per-file [WARN]/[ERROR] logging when reading test sources
**verify:** Step 4 mentions distinguishing empty source vs read error, with [WARN] and [ERROR] prefixes
**done:** Step 4 updated in file

### Replacement content for Step 4's source-reading section

Find the existing Step 4 source reading instruction (where it reads `$TEST_SOURCES`) and append:

```
When reading each test source file:
- If the file content is empty: include `[WARN] empty source: <filename>` in place of content
- If the Read tool returns an error: include `[ERROR] read failed: <filename> — <reason>` in place of content

This lets quorum workers see exactly what happened per file rather than silently receiving an incomplete bundle.
```

---

## Execution order

Task 1 first (expands Step 1), Task 2 second (enhances Step 4). Both modify the same file — execute sequentially, commit atomically after both tasks complete.

Commit message: `feat(commands): add pre-flight validation to qgsd:quorum-test — validate artifacts before running tests`
