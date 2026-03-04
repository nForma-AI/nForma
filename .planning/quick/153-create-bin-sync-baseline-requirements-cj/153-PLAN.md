---
phase: quick-153
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/sync-baseline-requirements.cjs
  - bin/sync-baseline-requirements.test.cjs
autonomous: true
requirements: [QUICK-153]
formal_artifacts: none

must_haves:
  truths:
    - "Running sync-baseline-requirements merges baseline requirements into .formal/requirements.json without duplicating existing entries that have matching text"
    - "New baseline requirements get assigned the next available ID in their category prefix namespace (e.g., if UX-01..UX-08 exist, new UX requirement gets UX-09)"
    - "Each merged requirement has category, status: Pending, and provenance with source_file: qgsd-baseline"
    - "The script is idempotent — running it twice produces the same output"
    - "The envelope (content_hash, aggregated_at) is updated after merge; frozen_at is preserved if present"
    - "The script reports what was added vs skipped to stdout"
  artifacts:
    - path: "bin/sync-baseline-requirements.cjs"
      provides: "syncBaselineRequirements(profile, projectRoot) function + CLI with --profile flag"
      exports: ["syncBaselineRequirements"]
      min_lines: 80
    - path: "bin/sync-baseline-requirements.test.cjs"
      provides: "Tests covering idempotent merge, ID assignment, skip-on-match, provenance, envelope update"
      contains: "syncBaselineRequirements"
      min_lines: 60
  key_links:
    - from: "bin/sync-baseline-requirements.cjs"
      to: "bin/load-baseline-requirements.cjs"
      via: "require('./load-baseline-requirements.cjs').loadBaselineRequirements"
      pattern: "loadBaselineRequirements"
    - from: "bin/sync-baseline-requirements.cjs"
      to: "bin/requirements-core.cjs"
      via: "require('./requirements-core.cjs').readRequirementsJson"
      pattern: "readRequirementsJson"
    - from: "bin/sync-baseline-requirements.cjs"
      to: ".formal/requirements.json"
      via: "reads existing requirements, writes merged result"
      pattern: "requirements\\.json"
---

<objective>
Create `bin/sync-baseline-requirements.cjs` -- an idempotent CLI tool that merges baseline requirements into an existing `.formal/requirements.json`. It matches on exact `text` field to detect duplicates, assigns next-available IDs per category prefix for new entries, and updates the envelope metadata.

Purpose: After baseline requirements are defined (quick-151), projects need a way to sync them into the formal requirements envelope without manual copy-paste and without creating duplicates on re-run.

Output: `bin/sync-baseline-requirements.cjs` with tests, ready for integration into workflows.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/load-baseline-requirements.cjs
@bin/requirements-core.cjs
@bin/aggregate-requirements.cjs
@.formal/requirements.json
@.planning/config.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create sync-baseline-requirements module and CLI</name>
  <files>bin/sync-baseline-requirements.cjs</files>
  <action>
Create `bin/sync-baseline-requirements.cjs` -- a Node.js CJS script that merges baseline requirements into `.formal/requirements.json`. Works as both a CLI tool and a require()-able module.

**Module export: `syncBaselineRequirements(profile, projectRoot?)`**

Parameters:
- `profile` (string): one of `web`, `mobile`, `desktop`, `api`, `cli`, `library`
- `projectRoot` (string, optional): path to project root, defaults to `process.cwd()`

Returns: `{ added: [{id, text}], skipped: [{id, text, existingId}], total_before, total_after }`

**Algorithm:**

1. Load baseline requirements via `require('./load-baseline-requirements.cjs').loadBaselineRequirements(profile)`
2. Read existing requirements via `require('./requirements-core.cjs').readRequirementsJson(projectRoot)` -- returns `{ envelope, requirements }`
3. Build a Set of existing requirement `text` values for O(1) lookup: `const existingTexts = new Map(requirements.map(r => [r.text, r.id]))`
4. Build a map of highest existing ID number per prefix. Scan all existing requirements: for each `r.id`, split on `-`, get prefix and number. Track `maxId[prefix] = Math.max(maxId[prefix], parseInt(number))`. Example: if ACT-07 exists, `maxId['ACT'] = 7`.
5. For each baseline category, derive the category prefix from the first requirement's ID (e.g., `UX-01` -> `UX`).
6. For each baseline requirement in that category:
   a. Check if `existingTexts.has(req.text)` (exact string match on `text` field)
   b. If match found: add to `skipped` array with `{ id: req.id, text: req.text, existingId: existingTexts.get(req.text) }`. Do NOT add to requirements array.
   c. If no match: assign next available ID:
      - `maxId[prefix] = (maxId[prefix] || 0) + 1`
      - `newId = prefix + '-' + String(maxId[prefix]).padStart(2, '0')`
      - Transform to requirements.json schema:
        ```javascript
        {
          id: newId,
          text: req.text,
          category: baselineCategory.name,   // e.g., "UX Heuristics", "Security"
          phase: "baseline",
          status: "Pending",
          provenance: {
            source_file: "qgsd-baseline",
            milestone: "baseline"
          }
        }
        ```
      - Push to requirements array
      - Add to `added` array with `{ id: newId, text: req.text }`
7. If any requirements were added:
   a. Compute new content_hash using `crypto.createHash('sha256')` on `JSON.stringify(requirements, null, 2)` -- use `'sha256:' + hash.digest('hex')` format to match `aggregate-requirements.cjs` `computeContentHash()` pattern
   b. Update `aggregated_at` to current ISO timestamp
   c. Preserve existing `frozen_at` value (do NOT clear it)
   d. Preserve existing `schema_version` if present
   e. Write updated JSON to `.formal/requirements.json` with `JSON.stringify(envelope, null, 2)` where envelope is `{ aggregated_at, content_hash, frozen_at, schema_version, requirements }`
8. If nothing was added, do NOT write the file (truly idempotent).
9. Return the result object.

**CLI mode:**

```javascript
#!/usr/bin/env node
'use strict';

// ... module code ...

if (require.main === module) {
  const args = process.argv.slice(2);

  // Parse --profile
  const profileIdx = args.indexOf('--profile');
  if (profileIdx === -1 || !args[profileIdx + 1]) {
    // Try reading from .planning/config.json
    let profile = null;
    try {
      const config = JSON.parse(fs.readFileSync(
        path.join(process.cwd(), '.planning/config.json'), 'utf8'
      ));
      profile = config.profile;
    } catch (_) {}

    if (!profile) {
      console.error('Usage: node bin/sync-baseline-requirements.cjs --profile <web|mobile|desktop|api|cli|library>');
      console.error('       Or set "profile" in .planning/config.json');
      process.exit(1);
    }

    const result = syncBaselineRequirements(profile);
    printReport(result);
  } else {
    const profile = args[profileIdx + 1];
    const result = syncBaselineRequirements(profile);
    printReport(result);
  }
}
```

**Report output (`printReport` helper):**

```
Baseline sync: [profile] profile
  Before: [N] requirements
  Added:  [M] new requirements
  Skipped: [K] (already present by text match)
  After:  [N+M] requirements

Added:
  + [UX-09] Touch targets are at least 44x44 CSS pixels
  + [SEC-05] All user input is validated on the server side

Skipped:
  ~ [SEC-01] matched existing [REDACT-01]
```

If `--json` flag is present, output the raw result object as JSON instead of the human-readable report.

**Dependencies:** Only `fs`, `path`, `crypto` (Node built-ins) + the two local requires.
  </action>
  <verify>
    1. `node -e "require('./bin/sync-baseline-requirements.cjs')"` -- no errors, module loads cleanly.
    2. `node bin/sync-baseline-requirements.cjs --help 2>&1 || true` -- shows usage message (exits with code 1 since no profile).
    3. `node -e "const m = require('./bin/sync-baseline-requirements.cjs'); console.log(typeof m.syncBaselineRequirements)"` -- prints `function`.
  </verify>
  <done>
    bin/sync-baseline-requirements.cjs exports syncBaselineRequirements(profile, projectRoot) that loads baselines, matches on text against existing requirements, assigns next-available IDs for new entries, writes updated requirements.json with sha256 content_hash. CLI supports --profile flag with fallback to config.json, --json for machine output. File is not written if nothing changed (idempotent).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create comprehensive test suite</name>
  <files>bin/sync-baseline-requirements.test.cjs</files>
  <action>
Create `bin/sync-baseline-requirements.test.cjs` using Node.js built-in `node:test` and `node:assert` (same pattern as existing test files in bin/).

**Test strategy:** Use a temp directory with a mock `.formal/requirements.json` and mock baseline data to test merge logic in isolation. Do NOT modify the real `.formal/requirements.json`.

**Setup helper:**

```javascript
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

function createTempProject(existingReqs = []) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-baseline-'));
  fs.mkdirSync(path.join(tmpDir, '.formal'), { recursive: true });
  const envelope = {
    aggregated_at: '2026-03-01T00:00:00.000Z',
    content_hash: 'sha256:' + 'a'.repeat(64),
    frozen_at: '2026-03-01T00:00:00.000Z',
    schema_version: '1',
    requirements: existingReqs,
  };
  fs.writeFileSync(
    path.join(tmpDir, '.formal', 'requirements.json'),
    JSON.stringify(envelope, null, 2)
  );
  return tmpDir;
}

function readResult(tmpDir) {
  return JSON.parse(fs.readFileSync(
    path.join(tmpDir, '.formal', 'requirements.json'), 'utf8'
  ));
}
```

**Tests to write:**

1. **Empty project gets all baseline requirements added** -- start with empty requirements array, sync with 'cli' profile, verify all 13 baseline requirements are added with correct IDs, categories, status: "Pending", provenance.source_file: "qgsd-baseline".

2. **Idempotent: second run adds nothing** -- sync once, record result, sync again. Second run should have `added: []` and `skipped: [all]`. File content_hash should be unchanged.

3. **Text match skips duplicates** -- pre-populate requirements.json with one requirement whose `text` exactly matches a baseline requirement (but with a different ID and category). Sync should skip that one and add the rest.

4. **Next-available ID assignment** -- pre-populate with `SEC-01`, `SEC-02`, `SEC-03`. Sync baseline that includes SEC category. New SEC requirements should start at `SEC-04`, not `SEC-01`.

5. **Mixed prefixes get independent counters** -- pre-populate with `UX-05` and `SEC-02`. New UX requirements start at `UX-06`, new SEC requirements start at `SEC-03`.

6. **Provenance fields are correct** -- each added requirement has `provenance: { source_file: "qgsd-baseline", milestone: "baseline" }` and `phase: "baseline"`.

7. **Envelope metadata updated on add** -- after sync that adds requirements, `aggregated_at` should be more recent than original, `content_hash` should differ from original, `frozen_at` should be preserved from original, `schema_version` should be preserved.

8. **File not written when nothing to add** -- pre-populate with all baseline requirement texts already present. Sync should not modify file (check mtime or content_hash stays same).

9. **Return value shape** -- verify result has `added` (array), `skipped` (array), `total_before` (number), `total_after` (number), and `total_after === total_before + added.length`.

10. **Content hash is sha256 prefixed** -- after sync, content_hash matches `/^sha256:[a-f0-9]{64}$/`.

11. **Handles missing .formal/requirements.json gracefully** -- create temp dir without .formal/requirements.json, sync should create the file with baseline requirements.

Run with: `node --test bin/sync-baseline-requirements.test.cjs`
  </action>
  <verify>
    1. `node --test bin/sync-baseline-requirements.test.cjs` -- all tests pass, 0 failures.
    2. `node --test bin/sync-baseline-requirements.test.cjs 2>&1 | grep -c 'pass'` -- at least 10 passing tests.
  </verify>
  <done>
    bin/sync-baseline-requirements.test.cjs has 11+ tests covering: empty project merge, idempotency, text-match dedup, next-available ID assignment, mixed prefix counters, provenance correctness, envelope metadata update, no-write when nothing added, return value shape, content hash format, and missing file handling. All tests use temp directories and do not modify project state.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/sync-baseline-requirements.test.cjs` -- all tests pass, 0 failures.
2. `node -e "const m = require('./bin/sync-baseline-requirements.cjs'); console.log(Object.keys(m))"` -- prints `[ 'syncBaselineRequirements' ]`.
3. `node bin/sync-baseline-requirements.cjs --profile cli --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('added:', d.added.length, 'skipped:', d.skipped.length)"` -- shows baseline sync results against real project (likely all skipped if texts already present, or some added if new).
4. Running `node bin/sync-baseline-requirements.cjs --profile cli` twice produces identical output on the second run (all skipped).
</verification>

<success_criteria>
- bin/sync-baseline-requirements.cjs loads baselines via loadBaselineRequirements(), reads existing requirements via readRequirementsJson(), matches on exact text field
- New requirements get next-available ID in their prefix namespace (no collisions)
- Each added requirement has category, status: "Pending", provenance: { source_file: "qgsd-baseline", milestone: "baseline" }, phase: "baseline"
- Envelope content_hash updated with sha256 format, aggregated_at updated, frozen_at preserved
- File not written when nothing to add (true idempotency)
- CLI supports --profile flag with config.json fallback, --json for machine output
- Test suite covers all merge scenarios with 11+ tests using temp directories
- Running the tool twice on the same project produces identical results
</success_criteria>

<output>
After completion, create `.planning/quick/153-create-bin-sync-baseline-requirements-cj/153-SUMMARY.md`
</output>
