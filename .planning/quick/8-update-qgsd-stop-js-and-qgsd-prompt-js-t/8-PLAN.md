---
type: quick-full
num: 8
slug: update-qgsd-stop-js-and-qgsd-prompt-js-t
description: "Update qgsd-stop.js and qgsd-prompt.js to recognize /qgsd: command prefix in addition to /gsd:, fix fallback text to /qgsd:plan-phase for co-install isolation"
date: 2026-02-21

must_haves:
  truths:
    - hooks/qgsd-stop.js buildCommandPattern uses \/q?gsd: regex (matches both /gsd: and /qgsd:)
    - hooks/qgsd-stop.js extractCommand fallback string is '/qgsd:plan-phase' (not '/gsd:plan-phase')
    - hooks/qgsd-prompt.js cmdPattern uses \/q?gsd: regex (anchored, matches both prefixes)
    - hooks/dist/qgsd-stop.js reflects the same changes (rebuilt from source)
    - hooks/dist/qgsd-prompt.js reflects the same changes (rebuilt from source)
    - hooks/qgsd-stop.test.js includes at least one test using /qgsd: prefix that passes
  artifacts:
    - hooks/qgsd-stop.js (modified)
    - hooks/qgsd-prompt.js (modified)
    - hooks/dist/qgsd-stop.js (rebuilt)
    - hooks/dist/qgsd-prompt.js (rebuilt)
    - hooks/qgsd-stop.test.js (modified — /qgsd: test case added)
  key_links: []
---

# Quick Task 8: Fix Hook Namespace — Recognize /qgsd: Prefix

## Quorum Result

**CONSENSUS REACHED** (Reduced quorum — Codex UNAVAILABLE/usage limit, OpenCode UNAVAILABLE/timeout, per R6.4)

- Claude: APPROVE — `\/q?gsd:` regex, fix fallback, update tests, rebuild dist
- Gemini: APPROVE — `\/q?gsd:` correct; match BOTH prefixes; update tests + run build script
- Copilot: APPROVE — `\/q?gsd:` for both prefixes; strict `/qgsd:` if isolation needed

**Design decision:** Match BOTH `/gsd:` and `/qgsd:` (user's explicit intent: "in addition to /gsd:"). This ensures QGSD hooks enforce quorum regardless of which prefix the user types, while fixing the broken fallback message.

## Changes Required

### hooks/qgsd-stop.js
- Line 25: `'\\/gsd:('` → `'\\/q?gsd:('`
- Line 87: `return '/gsd:plan-phase'` → `return '/qgsd:plan-phase'`
- Comments on lines 22, 73-74: update /gsd: → /qgsd: references

### hooks/qgsd-prompt.js
- Line 38: `'^\\s*\\/gsd:('` → `'^\\s*\\/q?gsd:('`
- Comment on line 35-36: update /gsd: → /qgsd: references

### hooks/qgsd-stop.test.js
- Add at least one parallel test using `/qgsd:plan-phase` that verifies the stop hook fires (mirrors an existing /gsd: test)

### Build
- Run `node scripts/build-hooks.js` to sync changes to hooks/dist/

## Tasks

### Task 1: Update hooks/qgsd-stop.js

```yaml
files:
  - hooks/qgsd-stop.js
action: >
  1. Line 25: change '\\/gsd:(' to '\\/q?gsd:(' in buildCommandPattern
  2. Line 87: change return '/gsd:plan-phase' to return '/qgsd:plan-phase'
  3. Update comment on line 22 to mention both prefixes
  4. Update comment on lines 73-74 to show /qgsd:plan-phase as fallback
verify: >
  grep "q?gsd:" hooks/qgsd-stop.js shows the updated regex.
  grep "qgsd:plan-phase" hooks/qgsd-stop.js shows the updated fallback.
done: qgsd-stop.js uses \/q?gsd: pattern and /qgsd:plan-phase fallback
```

### Task 2: Update hooks/qgsd-prompt.js

```yaml
files:
  - hooks/qgsd-prompt.js
action: >
  Line 38: change '^\\s*\\/gsd:(' to '^\\s*\\/q?gsd:(' in cmdPattern regex.
  Update comments on lines 35-36 to mention both prefixes.
verify: >
  grep "q?gsd:" hooks/qgsd-prompt.js shows the updated pattern.
done: qgsd-prompt.js uses \/q?gsd: pattern
```

### Task 3: Add /qgsd: test case to qgsd-stop.test.js

```yaml
files:
  - hooks/qgsd-stop.test.js
action: >
  Add a new test mirroring Test 5 (PASS case: command in current turn + all
  quorum tool_use blocks) but using '/qgsd:plan-phase' instead of
  '/gsd:plan-phase'. Title it "Test N: /qgsd:plan-phase — quorum present → pass".
  This verifies the /q?gsd: regex correctly fires for the new prefix.
verify: >
  grep "qgsd:plan-phase" hooks/qgsd-stop.test.js shows the new test case.
done: at least one /qgsd: test exists in qgsd-stop.test.js
```

### Task 4: Rebuild dist/ and verify tests pass

```yaml
files:
  - hooks/dist/qgsd-stop.js
  - hooks/dist/qgsd-prompt.js
action: >
  1. Run: node scripts/build-hooks.js
  2. Run: node hooks/qgsd-stop.test.js
  3. Verify both dist files contain q?gsd: pattern
verify: >
  grep "q?gsd:" hooks/dist/qgsd-stop.js shows pattern in built file.
  grep "q?gsd:" hooks/dist/qgsd-prompt.js shows pattern in built file.
  Test runner exits 0 with no FAIL lines.
done: dist rebuilt, tests pass, both dist files contain updated pattern
```
