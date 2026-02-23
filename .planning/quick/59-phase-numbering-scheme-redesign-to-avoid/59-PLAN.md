---
phase: quick-59
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - get-shit-done/bin/gsd-tools.cjs
  - get-shit-done/bin/gsd-tools.test.cjs
  - get-shit-done/templates/roadmap.md
  - get-shit-done/references/decimal-phase-calculation.md
  - .planning/ROADMAP.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Phase IDs like v0.7-01 and v0.7-02 are valid input to normalizePhaseName() and round-trip correctly"
    - "Phase directories named v0.7-01-composition-architecture/ are found by find-phase v0.7-01"
    - "roadmap analyze correctly extracts phase numbers from Phase v0.7-01: Name headers"
    - "Decimal gap insertion works: v0.7-01.1 is the first gap after v0.7-01"
    - "Sort order is correct: v0.7-01, v0.7-01.1, v0.7-02 sort in milestone then sequence order"
    - "QGSD ROADMAP.md uses milestone-scoped IDs for v0.7 phases (v0.7-01, v0.7-02, v0.7-03)"
    - "roadmap.md template documents the milestone-scoped numbering convention"
    - "All existing integer-phase tests still pass (backward compat)"
  artifacts:
    - path: "get-shit-done/bin/gsd-tools.cjs"
      provides: "parseMilestonePhaseId(), updated normalizePhaseName(), sort, find, add, insert, analyze"
      contains: "parseMilestonePhaseId"
    - path: "get-shit-done/bin/gsd-tools.test.cjs"
      provides: "Tests for milestone-scoped phase ID parsing and operations"
      contains: "v0.7-01"
    - path: "get-shit-done/templates/roadmap.md"
      provides: "Updated convention documentation for milestone-scoped phase numbering"
      contains: "v0.7-01"
    - path: ".planning/ROADMAP.md"
      provides: "v0.7 phases use new IDs: v0.7-01, v0.7-02, v0.7-03"
      contains: "v0.7-01"
  key_links:
    - from: "normalizePhaseName()"
      to: "parseMilestonePhaseId()"
      via: "normalizePhaseName detects vX.Y-NN format and delegates to parseMilestonePhaseId"
      pattern: "parseMilestonePhaseId"
    - from: "cmdRoadmapAnalyze() phasePattern"
      to: "milestone-scoped phase headers"
      via: "Updated regex captures both integer and v0.7-01 style phase IDs from headers"
      pattern: "v\\\\d+\\\\.\\\\d+-\\\\d+"
    - from: ".planning/ROADMAP.md v0.7 section"
      to: ".planning/phases/v0.7-01-composition-architecture/"
      via: "directory renamed to match new phase ID convention"
      pattern: "v0\\.7-01"
---

<objective>
Redesign the GSD phase numbering scheme within QGSD's bundled tooling to scope phase IDs to their milestone (v0.7-01 instead of global 40), preventing collision when multiple milestones run in parallel or gap phases are inserted mid-milestone.

Purpose: Global integer phase numbers accumulate across milestones, causing two problems: (1) inserting a gap phase between Phase 39 and 40 requires renumbering of all subsequent phases; (2) working two milestones in parallel (v0.7 and a hotfix branch) produces number conflicts. Milestone-scoped IDs (v0.7-01, v0.7-02) are self-contained — a v0.7 gap insertion becomes v0.7-01.1 without touching v0.7-02 or any other milestone's numbers.

Output: gsd-tools.cjs understands milestone-scoped phase IDs alongside existing integer IDs; QGSD ROADMAP.md applies the new scheme for v0.7 phases; roadmap template documents the convention.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@get-shit-done/bin/gsd-tools.cjs
@get-shit-done/bin/gsd-tools.test.cjs
@get-shit-done/templates/roadmap.md
@get-shit-done/references/decimal-phase-calculation.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add milestone-scoped phase ID support to gsd-tools.cjs</name>
  <files>get-shit-done/bin/gsd-tools.cjs</files>
  <action>
    The new phase ID format is v{major}.{minor}-{NN} where major.minor is the milestone version
    and NN is a zero-padded sequence within that milestone. Examples: v0.7-01, v0.7-02,
    v0.7-01.1 (decimal gap insertion within the milestone). Existing integer format (40, 39.1)
    continues to work unchanged — backward compat is required.

    NOTE: Do NOT modify the installed copy at ~/.claude/get-shit-done/bin/gsd-tools.cjs.
    QGSD bundles its own copy at get-shit-done/bin/gsd-tools.cjs. Only modify that bundled copy.

    **1. Add parseMilestonePhaseId() helper** (insert immediately after normalizePhaseName at line ~267):

    ```javascript
    /**
     * Parse a milestone-scoped phase ID like "v0.7-01" or "v0.7-01.1"
     * Returns null if input is not in milestone-scoped format.
     * Returns { milestone: 'v0.7', seq: '01', decimal: null, full: 'v0.7-01' }
     * or      { milestone: 'v0.7', seq: '01', decimal: '1', full: 'v0.7-01.1' }
     */
    function parseMilestonePhaseId(phase) {
      const match = phase.match(/^(v\d+\.\d+)-(\d+)(?:\.(\d+))?/i);
      if (!match) return null;
      const milestone = match[1].toLowerCase();
      const seq = match[2].padStart(2, '0');
      const decimal = match[3] || null;
      const full = decimal ? `${milestone}-${seq}.${decimal}` : `${milestone}-${seq}`;
      return { milestone, seq, decimal, full };
    }
    ```

    **2. Update normalizePhaseName()** (around line 260) to handle milestone-scoped IDs:

    ```javascript
    function normalizePhaseName(phase) {
      // Milestone-scoped format: v0.7-01, v0.7-01.1
      const msp = parseMilestonePhaseId(phase);
      if (msp) return msp.full;

      // Legacy integer format: 40, 39.1
      const match = phase.match(/^(\d+(?:\.\d+)?)/);
      if (!match) return phase;
      const num = match[1];
      const parts = num.split('.');
      const padded = parts[0].padStart(2, '0');
      return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
    }
    ```

    IMPORTANT: parseMilestonePhaseId must be defined BEFORE normalizePhaseName in the file since
    normalizePhaseName calls it. Add parseMilestonePhaseId immediately before normalizePhaseName.

    **3. Update phase sort in cmdPhasesList()** (around line 874).
    Replace the numeric sort comparator:

    ```javascript
    dirs.sort((a, b) => {
      const parseSortKey = (d) => {
        // Milestone-scoped: v0.7-01, v0.7-01.1
        const msp = parseMilestonePhaseId(d);
        if (msp) {
          // Sort by milestone version numerically, then by sequence
          const versionParts = msp.milestone.replace('v', '').split('.');
          const major = parseInt(versionParts[0] || '0', 10);
          const minor = parseInt(versionParts[1] || '0', 10);
          const seqNum = parseInt(msp.seq, 10);
          const dec = msp.decimal ? parseFloat(`0.${msp.decimal}`) : 0;
          // Encode as large number to sort after legacy integers
          return 1000000 + major * 10000 + minor * 100 + seqNum + dec;
        }
        // Legacy integer
        return parseFloat(d.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      };
      return parseSortKey(a) - parseSortKey(b);
    });
    ```

    **4. Update next-header detection regexes** — there are two instances of the pattern
    `/\n#{2,4}\s+Phase\s+\d/i` that mark the end of a phase section. Update both to also
    match milestone-scoped headers that start with 'v':

    In cmdRoadmapGetPhase() (around line 976):
    ```javascript
    // Before:
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    // After:
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+(?:\d|v\d)/i);
    ```

    In cmdRoadmapAnalyze() (around line 2574):
    ```javascript
    // Before:
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    // After:
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+(?:\d|v\d)/i);
    ```

    **5. Update cmdRoadmapAnalyze() main phase extraction pattern** (around line 2563):
    ```javascript
    // Before:
    const phasePattern = /#{2,4}\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
    // After:
    const phasePattern = /#{2,4}\s*Phase\s+(v\d+\.\d+-\d+(?:\.\d+)?|\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
    ```

    Also update the checklist scan pattern in cmdRoadmapAnalyze() (around line 2653):
    ```javascript
    // Before:
    const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+(?:\.\d+)?)/gi;
    // After:
    const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(v\d+\.\d+-\d+(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
    ```

    And update the checkbox pattern used for roadmap-complete detection (around line 2614):
    ```javascript
    // Before:
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${phaseNum.replace('.', '\\.')}`, 'i');
    // After — escape all regex-special chars in phaseNum (dots and dashes):
    const escapedPhaseNum = phaseNum.replace(/\./g, '\\.').replace(/-/g, '\\-');
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${escapedPhaseNum}`, 'i');
    ```

    **6. Update cmdPhaseAdd()** — when project uses milestone-scoped IDs, scope new phases to
    the current milestone instead of incrementing the global integer counter.

    Replace the "Find highest integer phase number" block (lines ~2692-2703) with:

    ```javascript
    // Detect if project uses milestone-scoped phase IDs
    const msHeaderPat = /#{2,4}\s*Phase\s+(v\d+\.\d+-\d+)(?:\.\d+)?\s*:/gi;
    const msMatches = [...content.matchAll(msHeaderPat)];

    let newPhaseNum, paddedNum, dirName;

    if (msMatches.length > 0) {
      // Milestone-scoped mode: find highest seq within each milestone, use the latest milestone
      const milestoneSeqs = {};
      for (const mm of msMatches) {
        const msp = parseMilestonePhaseId(mm[1]);
        if (!msp) continue;
        if (!milestoneSeqs[msp.milestone]) milestoneSeqs[msp.milestone] = 0;
        const seqNum = parseInt(msp.seq, 10);
        if (seqNum > milestoneSeqs[msp.milestone]) milestoneSeqs[msp.milestone] = seqNum;
      }
      // Use the last milestone found (most recent in roadmap)
      const latestMilestone = Object.keys(milestoneSeqs).pop();
      const nextSeq = (milestoneSeqs[latestMilestone] || 0) + 1;
      paddedNum = String(nextSeq).padStart(2, '0');
      newPhaseNum = `${latestMilestone}-${paddedNum}`;
      dirName = `${newPhaseNum}-${slug}`;
    } else {
      // Legacy integer mode (unchanged behavior)
      const intPhasePat = /#{2,4}\s*Phase\s+(\d+)(?:\.\d+)?:/gi;
      let maxPhase = 0;
      let m;
      while ((m = intPhasePat.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num > maxPhase) maxPhase = num;
      }
      newPhaseNum = maxPhase + 1;
      paddedNum = String(newPhaseNum).padStart(2, '0');
      dirName = `${paddedNum}-${slug}`;
    }
    ```

    **7. Fix decimal pattern escaping in cmdPhaseInsert()** (around line 2768).
    The existing `decimalPattern` regex is built from `normalizedBase` which for milestone-scoped
    IDs contains dots that need escaping:

    ```javascript
    // Before:
    const decimalPattern = new RegExp(`^${normalizedBase}\\.(\\d+)`);
    // After:
    const decimalPattern = new RegExp(`^${normalizedBase.replace(/\./g, '\\.')}\\.(\\d+)`);
    ```

    No other changes needed in cmdPhaseInsert() — the decimal output `v0.7-01.1` is generated
    naturally by `${normalizedBase}.${nextDecimal}` and the directory becomes `v0.7-01.1-slug`.

    After all edits, run npm test to confirm no regressions.
  </action>
  <verify>
    Run existing test suite:
    ```
    node --test get-shit-done/bin/gsd-tools.test.cjs 2>&1 | tail -10
    ```
    All existing tests must pass (no regressions).

    Manual smoke test via inline node:
    ```
    node -e "
    const fs = require('fs');
    // Load just the two functions by evaluating the relevant lines
    const src = fs.readFileSync('get-shit-done/bin/gsd-tools.cjs', 'utf8');
    const pMatch = src.match(/function parseMilestonePhaseId\([\s\S]+?\n\}/);
    const nMatch = src.match(/function normalizePhaseName\([\s\S]+?\n\}/);
    eval(pMatch[0]); eval(nMatch[0]);
    console.assert(normalizePhaseName('v0.7-01') === 'v0.7-01', 'ms normalize');
    console.assert(normalizePhaseName('v0.7-01.1') === 'v0.7-01.1', 'ms decimal');
    console.assert(normalizePhaseName('40') === '40', 'int normalize');
    console.assert(normalizePhaseName('39.1') === '39.1', 'int decimal');
    console.log('normalizePhaseName PASS');
    "
    ```
    Expected: `normalizePhaseName PASS`

    Test roadmap analyze with milestone-scoped headers:
    ```
    TMPDIR=$(mktemp -d)
    mkdir -p "$TMPDIR/.planning/phases"
    printf '### Phase v0.7-01: Composition\n**Goal:** Config-driven\n\n### Phase v0.7-02: Slots\n**Goal:** N slots\n' > "$TMPDIR/.planning/ROADMAP.md"
    node get-shit-done/bin/gsd-tools.cjs roadmap analyze --cwd "$TMPDIR" 2>&1
    rm -rf "$TMPDIR"
    ```
    Expected: JSON output with `phase_count: 2` and `phases[0].number: 'v0.7-01'`.
  </verify>
  <done>
    parseMilestonePhaseId() helper exists and correctly parses v0.7-01 and v0.7-01.1.
    normalizePhaseName() handles both legacy integer and milestone-scoped IDs.
    Sort, find-phase, roadmap-analyze, phase-add, and phase-insert all work with v{X.Y}-{NN} IDs.
    All existing gsd-tools tests pass (backward compat preserved).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update templates and QGSD ROADMAP.md to use the new scheme</name>
  <files>
    get-shit-done/templates/roadmap.md
    get-shit-done/references/decimal-phase-calculation.md
    .planning/ROADMAP.md
    .planning/phases/v0.7-01-composition-architecture/v0.7-01-01-PLAN.md
    .planning/phases/v0.7-01-composition-architecture/v0.7-01-02-PLAN.md
  </files>
  <action>
    **Step A: Rename phase directories and plan files on disk.**

    Run these renames:
    ```
    mv .planning/phases/40-composition-architecture .planning/phases/v0.7-01-composition-architecture
    mv .planning/phases/41-multiple-slots .planning/phases/v0.7-02-multiple-slots
    mv .planning/phases/42-wizard-composition-screen .planning/phases/v0.7-03-wizard-composition-screen
    ```

    Within the renamed composition-architecture directory:
    ```
    mv .planning/phases/v0.7-01-composition-architecture/40-01-PLAN.md \
       .planning/phases/v0.7-01-composition-architecture/v0.7-01-01-PLAN.md
    mv .planning/phases/v0.7-01-composition-architecture/40-02-PLAN.md \
       .planning/phases/v0.7-01-composition-architecture/v0.7-01-02-PLAN.md
    ```

    If a `40-RESEARCH.md` file exists in that directory, also rename it:
    ```
    mv .planning/phases/v0.7-01-composition-architecture/40-RESEARCH.md \
       .planning/phases/v0.7-01-composition-architecture/v0.7-01-RESEARCH.md
    ```

    **Step B: Update frontmatter in renamed plan files.**

    In `v0.7-01-01-PLAN.md`:
    - Change `phase: 40-composition-architecture` to `phase: v0.7-01-composition-architecture`
    - Keep `plan: 01` as-is (plan number is relative within the phase)
    - In the `<output>` section at the bottom, change the SUMMARY path reference from
      `.planning/phases/40-composition-architecture/40-01-SUMMARY.md` to
      `.planning/phases/v0.7-01-composition-architecture/v0.7-01-01-SUMMARY.md`
    - In `<context>` section, update `@.planning/phases/40-composition-architecture/40-RESEARCH.md`
      to `@.planning/phases/v0.7-01-composition-architecture/v0.7-01-RESEARCH.md`

    In `v0.7-01-02-PLAN.md`:
    - Change `phase: 40-composition-architecture` to `phase: v0.7-01-composition-architecture`
    - Keep `plan: 02` as-is
    - Update `<output>` section SUMMARY path: `40-02-SUMMARY.md` to `v0.7-01-02-SUMMARY.md`
    - Update `<context>` section RESEARCH reference the same way

    **Step C: Update .planning/ROADMAP.md.**

    In the milestones summary list:
    - `**v0.7 — Composition Config & Multi-Slot** — Phases 40+ (planned)` stays as-is
      (the summary line can say "v0.7-01+ (planned)" — update the text)

    In the v0.7 section detail:
    - `- [ ] **Phase 40: Composition Architecture**` becomes
      `- [ ] **Phase v0.7-01: Composition Architecture**`
    - `- [ ] **Phase 41: Multiple Slots**` becomes
      `- [ ] **Phase v0.7-02: Multiple Slots**`
    - `- [ ] **Phase 42: Wizard Composition Screen**` becomes
      `- [ ] **Phase v0.7-03: Wizard Composition Screen**`

    In the Phase Details section:
    - `### Phase 40: Composition Architecture` becomes `### Phase v0.7-01: Composition Architecture`
    - `**Depends on**: Phase 39` becomes `**Depends on**: Phase 39 (v0.6, global-numbered)`
    - `Plans: TBD` — update plan list placeholders to reference v0.7-01-01-PLAN.md etc.
    - `### Phase 41: Multiple Slots` becomes `### Phase v0.7-02: Multiple Slots`
    - `**Depends on**: Phase 40` becomes `**Depends on**: Phase v0.7-01`
    - `### Phase 42: Wizard Composition Screen` becomes `### Phase v0.7-03: Wizard Composition Screen`
    - `**Depends on**: Phase 41` becomes `**Depends on**: Phase v0.7-02`

    In the Progress table at the bottom:
    - `| 40. Composition Architecture | v0.7 | TBD | Pending | - |` becomes
      `| v0.7-01. Composition Architecture | v0.7 | TBD | Pending | - |`
    - `| 41. Multiple Slots | v0.7 | TBD | Pending | - |` becomes
      `| v0.7-02. Multiple Slots | v0.7 | TBD | Pending | - |`
    - `| 42. Wizard Composition Screen | v0.7 | TBD | Pending | - |` becomes
      `| v0.7-03. Wizard Composition Screen | v0.7 | TBD | Pending | - |`

    **Step D: Update get-shit-done/templates/roadmap.md.**

    Replace the Phase Numbering block (currently lines 16-18) with:

    ```markdown
    **Phase Numbering:**
    - Milestone-scoped phases (v1.0-01, v1.0-02): Phases scoped to their milestone — PREFERRED for all new projects
    - Decimal phases (v1.0-01.1, v1.0-02.1): Urgent gap insertions within a milestone (marked INSERTED)
    - Legacy integer phases (1, 2, 3): Global sequential numbering — supported for backward compat only

    Milestone-scoped IDs prevent two failure modes:
    - Parallel milestone work: v1.0-01 and v1.1-01 never collide
    - Mid-milestone gap insertion: v1.0-01.1 inserts without renumbering v1.0-02
    - Format: v{major}.{minor}-{NN} where NN resets to 01 each milestone
    ```

    Update the example Initial Roadmap template (lines ~22-103) to use milestone-scoped IDs:
    - `- [ ] **Phase 1:` becomes `- [ ] **Phase v1.0-01:`
    - `- [ ] **Phase 2:` becomes `- [ ] **Phase v1.0-02:`
    - `- [ ] **Phase 3:` becomes `- [ ] **Phase v1.0-03:`
    - `- [ ] **Phase 4:` becomes `- [ ] **Phase v1.0-04:`
    - `### Phase 1:` becomes `### Phase v1.0-01:`
    - `### Phase 2:` becomes `### Phase v1.0-02:`
    - `### Phase 2.1:` becomes `### Phase v1.0-02.1:`
    - `### Phase 3:` becomes `### Phase v1.0-03:`
    - `### Phase 4:` becomes `### Phase v1.0-04:`
    - Plan file refs: `01-01:` becomes `v1.0-01-01:`; `02-01:` becomes `v1.0-02-01:` etc.
    - `02.1-01:` becomes `v1.0-02.1-01:`
    - `**Depends on**: Phase 1` becomes `**Depends on**: Phase v1.0-01`
    - `**Depends on**: Phase 2` becomes `**Depends on**: Phase v1.0-02`

    Update the guidelines block near line 111:
    - `Plans use naming: {phase}-{plan}-PLAN.md (e.g., 01-02-PLAN.md)` becomes
      `Plans use naming: {phase}-{plan}-PLAN.md (e.g., v1.0-01-02-PLAN.md)`
    - `Keep continuous phase numbering (never restart at 01)` becomes
      `Milestone-scoped numbering resets per milestone: v1.0 uses v1.0-01/02, v1.1 uses v1.1-01/02`

    **Step E: Update get-shit-done/references/decimal-phase-calculation.md.**

    Add a new section at the end of the file:

    ```markdown
    ## Milestone-Scoped Decimal Insertion

    For milestone-scoped phases, decimal gap insertion follows the same pattern but uses
    the full milestone-scoped phase ID as the base:

    Using gsd-tools:

    ```bash
    # Insert gap phase after v0.7-01
    node /path/to/gsd-tools.cjs phase insert v0.7-01 "Fix critical config bug"
    # Creates: .planning/phases/v0.7-01.1-fix-critical-config-bug/
    ```

    Examples:

    | Existing Phases       | Next Inserted Phase |
    |-----------------------|---------------------|
    | v0.7-01 only          | v0.7-01.1           |
    | v0.7-01, v0.7-01.1    | v0.7-01.2           |
    | v0.7-02 only          | v0.7-02.1           |

    Directory naming: `.planning/phases/v0.7-01.1-fix-critical-config-bug/`
    Plan naming: `v0.7-01.1-01-PLAN.md`
    ```

    **Step F: Record the decision in STATE.md.**

    Under `### Decisions` in .planning/STATE.md, append:
    `- [quick-59]: Phase numbering redesigned to milestone-scoped IDs (v0.7-01 format); v0.7 phases renamed from 40/41/42; gsd-tools.cjs updated to parse both integer and milestone-scoped formats`
  </action>
  <verify>
    Verify directory rename:
    ```
    ls /Users/jonathanborduas/code/QGSD/.planning/phases/ | grep "v0.7"
    ```
    Expected: v0.7-01-composition-architecture, v0.7-02-multiple-slots, v0.7-03-wizard-composition-screen

    Verify plan files renamed:
    ```
    ls /Users/jonathanborduas/code/QGSD/.planning/phases/v0.7-01-composition-architecture/
    ```
    Expected: v0.7-01-01-PLAN.md, v0.7-01-02-PLAN.md

    Verify ROADMAP.md updated:
    ```
    grep "v0.7-01\|v0.7-02\|v0.7-03" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md | wc -l
    ```
    Expected: 6 or more lines.

    Verify no stale global phase IDs:
    ```
    grep "Phase 40\|Phase 41\|Phase 42" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md
    ```
    Expected: no output (all renamed).

    Verify gsd-tools find-phase works with renamed directories:
    ```
    node get-shit-done/bin/gsd-tools.cjs find-phase v0.7-01 2>&1
    ```
    Expected: JSON with found:true and directory containing v0.7-01-composition-architecture.

    Run full test suite:
    ```
    npm test 2>&1 | tail -5
    ```
    Expected: all tests pass.
  </verify>
  <done>
    roadmap.md template documents milestone-scoped numbering as preferred convention with examples.
    decimal-phase-calculation.md includes milestone-scoped insertion examples.
    .planning/ROADMAP.md uses v0.7-01/02/03 for all three v0.7 phases; no Phase 40/41/42 references remain.
    Phase directories renamed on disk. Plan files renamed. Frontmatter phase field updated.
    gsd-tools find-phase v0.7-01 returns found:true.
    npm test passes with no regressions.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add gsd-tools test coverage for milestone-scoped phase IDs</name>
  <files>get-shit-done/bin/gsd-tools.test.cjs</files>
  <action>
    Add a new describe block for milestone-scoped phase ID support. Place it after the existing
    "roadmap analyze command" describe block. Follow the exact patterns used in existing tests:
    use `createTempProject()`, `cleanup()`, `runGsdTools()`, and `fs.writeFileSync()` for fixtures
    (these helpers are already defined in the test file).

    Add the following describe block:

    ```javascript
    // ─── Milestone-Scoped Phase IDs ───────────────────────────────────────────────

    describe('milestone-scoped phase IDs', () => {
      let tmpDir;

      beforeEach(() => {
        tmpDir = createTempProject();
      });

      afterEach(() => {
        cleanup(tmpDir);
      });

      test('MS-TC-01: roadmap analyze parses milestone-scoped phase headers', () => {
        fs.writeFileSync(
          path.join(tmpDir, '.planning', 'ROADMAP.md'),
          `# Roadmap: QGSD\n\n### Phase v0.7-01: Composition Architecture\n**Goal:** Config-driven quorum\n\n### Phase v0.7-02: Multiple Slots\n**Goal:** N instances per family\n`
        );

        const result = runGsdTools('roadmap analyze', tmpDir);
        assert.ok(result.success, `Command failed: ${result.error}`);

        const output = JSON.parse(result.output);
        assert.strictEqual(output.phase_count, 2, 'should find 2 phases');
        assert.strictEqual(output.phases[0].number, 'v0.7-01', 'first phase number is v0.7-01');
        assert.strictEqual(output.phases[1].number, 'v0.7-02', 'second phase number is v0.7-02');
        assert.strictEqual(output.phases[0].name, 'Composition Architecture', 'phase name extracted');
        assert.strictEqual(output.phases[0].goal, 'Config-driven quorum', 'goal extracted');
      });

      test('MS-TC-02: find-phase v0.7-01 finds milestone-scoped directory', () => {
        const phaseDir = path.join(tmpDir, '.planning', 'phases', 'v0.7-01-composition-architecture');
        fs.mkdirSync(phaseDir, { recursive: true });

        const result = runGsdTools('find-phase v0.7-01', tmpDir);
        assert.ok(result.success, `Command failed: ${result.error}`);

        const output = JSON.parse(result.output);
        assert.strictEqual(output.found, true, 'phase must be found');
        assert.ok(output.directory.includes('v0.7-01-composition-architecture'), 'directory contains phase ID');
      });

      test('MS-TC-03: phases list sorts v0.7-01, v0.7-01.1, v0.7-02 in correct order', () => {
        const dirs = ['v0.7-02-multiple-slots', 'v0.7-01-composition', 'v0.7-01.1-gap-fix'];
        for (const d of dirs) {
          fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', d), { recursive: true });
        }

        const result = runGsdTools('phases list', tmpDir);
        assert.ok(result.success, `Command failed: ${result.error}`);

        const output = JSON.parse(result.output);
        assert.strictEqual(output.directories.length, 3, '3 directories');
        assert.ok(output.directories[0].startsWith('v0.7-01-'), 'first is v0.7-01');
        assert.ok(output.directories[1].startsWith('v0.7-01.1-'), 'second is v0.7-01.1');
        assert.ok(output.directories[2].startsWith('v0.7-02-'), 'third is v0.7-02');
      });

      test('MS-TC-04: roadmap analyze reads disk_status for milestone-scoped phase directories', () => {
        fs.writeFileSync(
          path.join(tmpDir, '.planning', 'ROADMAP.md'),
          `# Roadmap\n\n### Phase v0.7-01: Composition Architecture\n**Goal:** Config-driven quorum\n`
        );

        const phaseDir = path.join(tmpDir, '.planning', 'phases', 'v0.7-01-composition-architecture');
        fs.mkdirSync(phaseDir, { recursive: true });
        fs.writeFileSync(path.join(phaseDir, 'v0.7-01-01-PLAN.md'), '# Plan');
        fs.writeFileSync(path.join(phaseDir, 'v0.7-01-01-SUMMARY.md'), '# Summary');

        const result = runGsdTools('roadmap analyze', tmpDir);
        assert.ok(result.success, `Command failed: ${result.error}`);

        const output = JSON.parse(result.output);
        assert.strictEqual(output.phases[0].disk_status, 'complete', 'disk_status is complete');
        assert.strictEqual(output.phases[0].plan_count, 1, '1 plan found');
        assert.strictEqual(output.phases[0].summary_count, 1, '1 summary found');
      });
    });
    ```

    Do NOT modify any existing test cases or test helpers.
  </action>
  <verify>
    Run new tests only:
    ```
    node --test get-shit-done/bin/gsd-tools.test.cjs 2>&1 | grep -E "MS-TC|milestone-scoped" | head -10
    ```
    Expected: All 4 MS-TC tests show as passing.

    Run full suite:
    ```
    npm test 2>&1 | tail -5
    ```
    Expected: total test count increased by 4, all passing.
  </verify>
  <done>
    Four new MS-TC-01..04 tests exist in the describe('milestone-scoped phase IDs') block.
    All 4 pass. No existing tests broken. npm test green.
  </done>
</task>

</tasks>

<verification>
1. `node get-shit-done/bin/gsd-tools.cjs find-phase v0.7-01 2>&1` returns JSON with found:true and directory v0.7-01-composition-architecture
2. `grep "Phase v0.7-0" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md | wc -l` returns 6 or more
3. `grep "Phase 40\|Phase 41\|Phase 42" /Users/jonathanborduas/code/QGSD/.planning/ROADMAP.md` returns empty
4. `node --test get-shit-done/bin/gsd-tools.test.cjs 2>&1 | grep "MS-TC"` shows 4 passing tests
5. `npm test 2>&1 | tail -5` — all tests green with no failures
</verification>

<success_criteria>
- parseMilestonePhaseId() parses v0.7-01 and v0.7-01.1 correctly; returns null for integers
- normalizePhaseName() handles both integer (40) and milestone-scoped (v0.7-01) formats without regression
- roadmap analyze extracts phase numbers from Phase v0.7-01: headers; disk_status works for v0.7-01 directories
- find-phase v0.7-01 locates directories starting with that prefix
- Phase list sort: v0.7-01 appears before v0.7-01.1 appears before v0.7-02
- QGSD .planning/ROADMAP.md: Phase v0.7-01/02/03 used; old Phase 40/41/42 references removed
- Phase directories renamed on disk to v0.7-01/02/03 format
- Plan files in v0.7-01 directory renamed from 40-0N-PLAN.md to v0.7-01-0N-PLAN.md; frontmatter updated
- roadmap.md template documents milestone-scoped numbering as preferred convention
- decimal-phase-calculation.md documents milestone-scoped decimal insertion
- 4 new MS-TC-01..04 tests pass; all prior tests pass; npm test green
</success_criteria>

<output>
After completion, create `.planning/quick/59-phase-numbering-scheme-redesign-to-avoid/59-SUMMARY.md`
</output>
