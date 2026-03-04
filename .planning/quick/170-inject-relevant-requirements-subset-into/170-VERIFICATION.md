---
phase: quick-170
verified: 2026-03-04T23:47:00Z
status: passed
score: 5/5 must-haves verified
---

# Quick Task 170: Inject Relevant Requirements Subset Into Quorum Dispatch Prompts

**Phase Goal:** Inject relevant requirements subset into quorum dispatch prompts so external agents can make better-informed judgments grounded in project requirements (237 formal requirements from `.formal/requirements.json`).

**Verified:** 2026-03-04 23:47 UTC

**Status:** PASSED

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Quorum slot prompts include relevant requirements when question/artifact path maps to known categories | ✓ VERIFIED | `buildModeAPrompt()` and `buildModeBPrompt()` accept `requirements` param; `matchRequirementsByKeywords()` scores and filters based on question keywords + artifact path → category mapping; main() calls both before building prompt |
| 2 | Requirements matching is keyword-based on question text and artifact path, selecting by category_raw and category group | ✓ VERIFIED | `extractKeywords()` tokenizes question on spaces/slashes/hyphens/dots with stopword filter; `extractPathCategories()` maps path segments (e.g., "hook" → "Hooks & Enforcement", "quorum" → "Quorum & Dispatch"); scoring adds +3 boost for category matches |
| 3 | When no requirements match, prompts are unchanged (no empty section injected) | ✓ VERIFIED | `formatRequirementsSection([])` returns `null`; prompt builders check `if (requirements && requirements.length > 0)` before calling formatRequirementsSection; empty array yields no injection |
| 4 | Requirements injection is capped to prevent prompt bloat (max ~20 requirements) | ✓ VERIFIED | `matchRequirementsByKeywords()` returns `slice(0, 20)` after sorting by score; broad query test confirms max 20 |
| 5 | Fail-open: if requirements.json is missing or malformed, prompt construction proceeds without requirements | ✓ VERIFIED | `loadRequirements()` has try/catch that sets cache to `[]` and returns `[]` on any error; main() calls this and passes result to matchers; no throw, no crash |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `bin/quorum-slot-dispatch.cjs` | Requirements-aware prompt construction | ✓ VERIFIED | Module exports 3 required functions (loadRequirements, matchRequirementsByKeywords, formatRequirementsSection); buildModeAPrompt & buildModeBPrompt modified to accept & inject requirements; main() wired to call load + match before building prompt |
| `bin/quorum-slot-dispatch.test.cjs` | Tests for requirements matching and injection | ✓ VERIFIED | 12 new tests added covering: loadRequirements (smoke, fail-open), matchRequirementsByKeywords (quorum, hook, artifact path, gibberish, cap), formatRequirementsSection (format, empty), buildModeAPrompt (with/without), buildModeBPrompt (with requirements); all 39 tests pass (27 existing + 12 new) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bin/quorum-slot-dispatch.cjs` main() | `.formal/requirements.json` | `loadRequirements()` calls `fs.readFileSync()` at line 781 | ✓ WIRED | requirements loaded on every dispatch, cached by projectRoot |
| `bin/quorum-slot-dispatch.cjs` main() | `matchRequirementsByKeywords()` | Direct call at line 782 with (allRequirements, question, artifactPath) | ✓ WIRED | matched requirements passed to buildModeAPrompt/buildModeBPrompt as `requirements` parameter |
| `buildModeAPrompt()` | `formatRequirementsSection()` | Called at line 318 if `requirements && requirements.length > 0` | ✓ WIRED | requirements section injected into prompt output between question/artifact and review context |
| `buildModeBPrompt()` | `formatRequirementsSection()` | Called at line 444 if `requirements && requirements.length > 0` | ✓ WIRED | same pattern as Mode A; Mode B executes traces section follows requirement section |
| Requirements in prompt | Agent understanding | Requirements appear near top of prompt (after question, before instructions) | ✓ WIRED | Prompt structure places requirements block after "Question:" section, before review context and agent instructions; visible, well-formatted, high influence position |

### Test Results

All 39 tests pass (27 existing + 12 new):

```
✔ loadRequirements smoke test: loads 237+ requirements
✔ loadRequirements fail-open: returns empty array on nonexistent path
✔ matchRequirementsByKeywords — quorum keywords: returns DISP/QUORUM requirements
✔ matchRequirementsByKeywords — hook keywords: returns Hooks & Enforcement requirements
✔ matchRequirementsByKeywords — artifact path matching: maps artifact path to category
✔ matchRequirementsByKeywords — gibberish query returns empty array
✔ matchRequirementsByKeywords — broad query capped at 20 results
✔ formatRequirementsSection — formats correctly with requirement data
✔ formatRequirementsSection — returns null for empty array
✔ buildModeAPrompt includes requirements section when provided
✔ buildModeAPrompt omits requirements section when empty array
✔ buildModeBPrompt includes requirements section when provided

[27 existing prompt construction/parsing tests also pass]
```

**Command:** `node --test bin/quorum-slot-dispatch.test.cjs`
**Result:** 39 passing, 0 failures, duration 79ms

### Implementation Quality

#### Fail-Open Pattern
- ✓ Missing `.formal/requirements.json` returns `[]` (no throw)
- ✓ Malformed JSON returns `[]` (catch block catches and caches)
- ✓ Cache prevents re-reading disk on repeated calls
- ✓ Prompts built without requirements look identical to before

#### Keyword Matching
- ✓ Stopword filtering (68 common English stopwords removed)
- ✓ Splits on multiple delimiters: spaces, slashes, hyphens, dots, underscores
- ✓ Path-to-category mapping: hook→Hooks, quorum→Quorum, install→Installer, mcp→MCP, formal→Formal Verification, config→Configuration, plan→Planning, test→Testing, observe→Observability (11 mappings)
- ✓ Scoring: +2 for ID prefix match, +1 per keyword hit in text/category, +3 for artifact-path-derived category match
- ✓ Capped at 20 results to prevent prompt bloat

#### Prompt Integration
- ✓ Requirements section injected after Question/Artifact, before Review Context (high visibility)
- ✓ Format: `=== APPLICABLE REQUIREMENTS === [intro text] [requirement list] ================================`
- ✓ Each requirement shows: `- [ID] text (Category)`
- ✓ Empty requirements array yields no section (truly fail-open)

#### Module Exports
All three required functions exported and testable:
```javascript
module.exports = {
  loadRequirements,
  matchRequirementsByKeywords,
  formatRequirementsSection,
  buildModeAPrompt,
  buildModeBPrompt,
  // ... other existing functions
};
```

### Anti-Patterns Scan

| File | Pattern | Check | Result |
|------|---------|-------|--------|
| bin/quorum-slot-dispatch.cjs | TODO/FIXME/placeholder comments | grep -n | No matches |
| bin/quorum-slot-dispatch.cjs | Empty implementations | grep -n "return null\|return {}\|return \[\]" | Returns checked: `[]` for fail-open (legitimate), `null` for empty sections (legitimate) |
| bin/quorum-slot-dispatch.cjs | console.log only implementations | grep -n "console.log" | No production console.log calls (only in tests) |
| bin/quorum-slot-dispatch.test.cjs | Test coverage | wc -l | 428 lines, 39 tests (comprehensive coverage) |

**No blockers found.**

### Sample Prompt Output

When invoked with question "quorum dispatch timeout", the prompt includes:

```
=== APPLICABLE REQUIREMENTS ===
The following project requirements are relevant to this review.
Consider whether the proposed change satisfies or violates these:

- [QUORUM-01] plan-milestone-gaps proposed gap closure phases are submitted to R3 quorum for approval... (Quorum & Dispatch)
- [QUORUM-02] execute-phase gaps_found triggers quorum diagnosis and auto-resolution... (Quorum & Dispatch)
- [QUORUM-03] discuss-phase remaining user_questions... are routed to quorum in auto mode... (Quorum & Dispatch)
- [QUORUM-04] A quorum round reaches consensus when all voting members... (Quorum & Dispatch)
- [QUORUM-05] All quorum members... MUST review prior-round positions... (Quorum & Dispatch)
- [DISP-01] qgsd-prompt.js runs a fast health probe... (Quorum & Dispatch)
- [DISP-02] qgsd-prompt.js reads scoreboard `availability` windows... (Quorum & Dispatch)
- [DISP-03] Dispatch list ordered by recent success rate... (Quorum & Dispatch)
- [DISP-04] Prompt construction... happens deterministically in JavaScript... (Quorum & Dispatch)
- [META-01] GSD planning commands... auto-resolve questions via quorum... (Quorum & Dispatch)
- [META-02] Only questions where quorum fails to reach consensus... presented to user... (Quorum & Dispatch)
[... up to 20 requirements, sorted by relevance score ...]
================================
```

### Verification Commands

**1. Functions exported:**
```bash
node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); console.log(typeof m.loadRequirements, typeof m.matchRequirementsByKeywords, typeof m.formatRequirementsSection)"
# Output: function function function ✓
```

**2. Load requirements:**
```bash
node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements(process.cwd()); console.log('loaded:', reqs.length, 'requirements')"
# Output: loaded: 237 requirements ✓
```

**3. Match requirements:**
```bash
node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const reqs = m.loadRequirements(process.cwd()); const matched = m.matchRequirementsByKeywords(reqs, 'quorum dispatch slot timeout', null); console.log('matched:', matched.length, matched.map(r=>r.id).join(', '))"
# Output: matched: 20 QUORUM-01, QUORUM-02, ... ✓
```

**4. Test suite:**
```bash
node --test bin/quorum-slot-dispatch.test.cjs
# Output: 39 pass, 0 fail ✓
```

**5. Prompt with requirements:**
```bash
node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'quorum dispatch review', requirements: m.matchRequirementsByKeywords(m.loadRequirements('.'), 'quorum dispatch review', null)}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"
# Output: true ✓
```

**6. Prompt without requirements (fail-open):**
```bash
node -e "const m = require('./bin/quorum-slot-dispatch.cjs'); const p = m.buildModeAPrompt({round:1, repoDir:'.', question:'random unrelated stuff'}); console.log(p.includes('APPLICABLE REQUIREMENTS'))"
# Output: false ✓
```

## Formal Verification Notes

**formal_artifacts declared:** none

The plan specified no formal model artifacts (TLA+, Alloy, PRISM) changes. This task is purely JavaScript implementation for requirements injection into prompts. Formal check result indicates tooling unavailable (skipped).

The implementation respects the quorum invariants from `.formal/spec/quorum/invariants.md`:
- **EventualConsensus** property: Quorum agents now have access to project requirements (APPLICABLE REQUIREMENTS block), allowing them to reason about whether consensus is justified against stated requirements
- **EventualConsensus liveness guarantee** (WF_vars on Decide, StartQuorum, AnyCollectVotes, AnyDeliberate) is unaffected — requirements injection is additive, not changing quorum control flow

The deliberation invariants from `.formal/spec/deliberation/invariants.md` are similarly unaffected:
- **ProtocolTerminates** property continues to hold (round-bounded, terminal states unchanged)
- **DeliberationMonotone** and **ImprovementMonotone** remain valid (no state regression logic)

Requirements injection occurs in the prompt construction phase, before agent execution — it provides input but does not alter the R3 deliberation protocol semantics.

## Summary

**Goal:** Agents reviewing QGSD plans receive a matched subset (up to 20) of the 237 formal requirements, grounded by keyword matching on the review question and artifact path.

**Result:** ACHIEVED

- ✓ Three pure functions added: loadRequirements, matchRequirementsByKeywords, formatRequirementsSection
- ✓ main() wired to load → match → inject before building dispatch prompts
- ✓ Both Mode A (question-based) and Mode B (execution review) support requirements
- ✓ Fail-open: missing/malformed requirements.json does not break dispatch
- ✓ All 39 tests pass (27 existing + 12 new)
- ✓ No anti-patterns, no stubs, no orphaned code
- ✓ Implementation aligns with project's quorum and deliberation invariants

**Recommendation:** READY FOR MERGE

---

_Verified: 2026-03-04T23:47:00Z_
_Verifier: Claude (qgsd-verifier)_
