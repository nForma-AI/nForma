---
phase: quick-151
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/load-baseline-requirements.cjs
  - bin/load-baseline-requirements.test.cjs
  - qgsd-core/workflows/new-project.md
  - qgsd-core/workflows/new-milestone.md
autonomous: true
requirements: [QUICK-151]
formal_artifacts: none

must_haves:
  truths:
    - "The load-baseline-requirements utility reads index.json, resolves each category file, filters requirements by a given profile, and returns a structured array of {id, text, intent, verifiable_by, category} objects with sequential IDs"
    - "Profile filtering correctly handles all 3 filter semantics: includes_all (web, mobile), excludes (desktop, api, cli), and includes_only (library)"
    - "The new-project workflow presents a profile picker (web/mobile/desktop/api/cli/library) before requirements definition, loads filtered baseline requirements, and presents them as pre-checked defaults that users can opt-out of"
    - "The new-milestone workflow presents the same profile picker and baseline defaults integration as new-project"
    - "Baseline requirements use IDs from the id_template (UX-01, SEC-01, etc.) and are distinct from project-specific REQ-IDs (AUTH-01, CONT-01, etc.)"
    - "Users can deselect any baseline requirement during scoping — they are defaults, not mandates"
  artifacts:
    - path: "bin/load-baseline-requirements.cjs"
      provides: "loadBaselineRequirements(profile) function that reads index.json and category files, filters by profile, assigns sequential IDs per id_template"
      exports: ["loadBaselineRequirements"]
      min_lines: 40
    - path: "bin/load-baseline-requirements.test.cjs"
      provides: "Tests covering all 6 profiles, filter semantics, ID generation, and edge cases"
      contains: "loadBaselineRequirements"
      min_lines: 50
    - path: "qgsd-core/workflows/new-project.md"
      provides: "Profile picker step and baseline requirements integration in Step 7"
      contains: "load-baseline-requirements"
    - path: "qgsd-core/workflows/new-milestone.md"
      provides: "Profile picker step and baseline requirements integration in Step 9"
      contains: "load-baseline-requirements"
  key_links:
    - from: "bin/load-baseline-requirements.cjs"
      to: "qgsd-core/defaults/baseline-requirements/index.json"
      via: "reads index.json to discover profiles and category files"
      pattern: "index\\.json"
    - from: "bin/load-baseline-requirements.cjs"
      to: "qgsd-core/defaults/baseline-requirements/*.json"
      via: "reads each category file listed in index.json categories array"
      pattern: "categories.*file"
    - from: "qgsd-core/workflows/new-project.md"
      to: "bin/load-baseline-requirements.cjs"
      via: "Step 6.5 runs node bin/load-baseline-requirements.cjs --profile <selected>"
      pattern: "load-baseline-requirements"
    - from: "qgsd-core/workflows/new-milestone.md"
      to: "bin/load-baseline-requirements.cjs"
      via: "Step 8.5 runs node bin/load-baseline-requirements.cjs --profile <selected>"
      pattern: "load-baseline-requirements"
---

<objective>
Wire baseline requirements into new-project and new-milestone workflows. Create a utility that loads baseline requirements from `qgsd-core/defaults/baseline-requirements/`, filters them by project profile (web/mobile/desktop/api/cli/library), and presents them as opt-out defaults before project-specific requirements are gathered.

Purpose: Every QGSD project should start with sensible baseline requirements (UX heuristics, security, reliability, observability, CI/CD, performance) appropriate for its project type. Users can remove any they don't want, but the defaults ensure nothing obvious is missed.

Output: `bin/load-baseline-requirements.cjs` utility with tests, updated `new-project.md` and `new-milestone.md` workflows with profile picker and baseline requirement integration.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@qgsd-core/defaults/baseline-requirements/index.json
@qgsd-core/defaults/baseline-requirements/ux-heuristics.json
@qgsd-core/defaults/baseline-requirements/security.json
@qgsd-core/defaults/baseline-requirements/reliability.json
@qgsd-core/defaults/baseline-requirements/observability.json
@qgsd-core/defaults/baseline-requirements/ci-cd.json
@qgsd-core/defaults/baseline-requirements/performance.json
@qgsd-core/workflows/new-project.md
@qgsd-core/workflows/new-milestone.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create load-baseline-requirements utility and tests</name>
  <files>bin/load-baseline-requirements.cjs, bin/load-baseline-requirements.test.cjs</files>
  <action>
Create `bin/load-baseline-requirements.cjs` -- a Node.js CJS script that loads baseline requirements filtered by project profile. The script works both as a CLI tool (for workflow integration) and as a require()-able module (for testing).

**Module export: `loadBaselineRequirements(profile, basePath?)`**

Parameters:
- `profile` (string): one of `web`, `mobile`, `desktop`, `api`, `cli`, `library`
- `basePath` (string, optional): path to baseline-requirements directory, defaults to `path.resolve(__dirname, '../qgsd-core/defaults/baseline-requirements')`

Returns: `{ profile, label, description, categories: [{ name, description, requirements: [{ id, text, intent, verifiable_by }] }], total }`

**Algorithm:**

1. Read `index.json` from basePath
2. Validate profile exists in `index.json.profiles`
3. Get profile config object (contains `includes_all`, `excludes`, or `includes_only`)
4. For each category in `index.json.categories`:
   a. Read the category JSON file (e.g., `ux-heuristics.json`)
   b. Filter requirements based on profile config:
      - If profile has `includes_all: true` -- include all requirements from this category
      - If profile has `excludes` array -- include all requirements from this category EXCEPT those whose slug matches an excludes entry. The excludes entries use format `"category-slug/req-slug"`. To match: derive category slug from filename (e.g., `ux-heuristics.json` -> `ux-heuristics`), then check each requirement by creating a slug from the requirement's position: `{category-slug}/{slugified-first-few-words}`. BUT actually, look at the index.json `excludes` values more carefully -- they use a readable identifier like `"ux-heuristics/target-size"`. Match these against requirements by checking if the requirement's text (lowercased) contains the key words from the slug. For example, `"ux-heuristics/target-size"` matches the requirement containing "target size" in the ux-heuristics category. Better approach: since each requirement has a `profiles` array in the category file, use that directly. If the profile string is NOT in the requirement's `profiles` array, exclude it.
      - If profile has `includes_only` array -- only include requirements from categories whose filename (without .json) is in the includes_only array

   **IMPORTANT SIMPLIFICATION**: Each requirement in the category JSON files already has a `profiles` array listing which profiles it applies to. Use this directly:
   - For `includes_only` profiles (library): only load category files named in `includes_only` array, then include all requirements from those files
   - For all other profiles: load all category files, then for each requirement check if the profile string is in the requirement's `profiles` array

5. Assign sequential IDs using the `id_template` from each category:
   - Track a counter per category prefix (UX, SEC, REL, OBS, CI, PERF)
   - For UX category: first requirement gets UX-01, second UX-02, etc.
   - Pad numbers to 2 digits

6. Return structured result

**CLI mode:**

When run as `node bin/load-baseline-requirements.cjs --profile web`, output the result as JSON to stdout. Parse args with simple `process.argv` handling (no library needed).

Also support `--list-profiles` to output just the profiles array from index.json.

Add a hashbang `#!/usr/bin/env node` at top.

```javascript
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--list-profiles')) {
    const index = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../qgsd-core/defaults/baseline-requirements/index.json'), 'utf8'));
    const profiles = Object.entries(index.profiles).map(([key, val]) => ({ key, label: val.label, description: val.description }));
    console.log(JSON.stringify(profiles, null, 2));
    process.exit(0);
  }
  const profileIdx = args.indexOf('--profile');
  if (profileIdx === -1 || !args[profileIdx + 1]) {
    console.error('Usage: node bin/load-baseline-requirements.cjs --profile <web|mobile|desktop|api|cli|library>');
    process.exit(1);
  }
  const result = loadBaselineRequirements(args[profileIdx + 1]);
  console.log(JSON.stringify(result, null, 2));
}
```

Export for testing:
```javascript
module.exports = { loadBaselineRequirements };
```

**Tests: `bin/load-baseline-requirements.test.cjs`**

Use Node.js built-in `node:test` and `node:assert` (same pattern as `bin/qgsd.test.cjs`).

Tests to write:

1. `loadBaselineRequirements('web')` returns all 34 requirements (web includes_all)
2. `loadBaselineRequirements('mobile')` returns all 34 requirements (mobile includes_all)
3. `loadBaselineRequirements('library')` returns only security + ci-cd categories (includes_only)
4. `loadBaselineRequirements('api')` excludes UX requirements that have only UI profiles (target-size, keyboard-nav, orientation, discoverable-labels, input-constraints)
5. `loadBaselineRequirements('cli')` excludes more UX requirements than api does (also exit-paths, retry-backoff)
6. `loadBaselineRequirements('desktop')` excludes observability/health-check
7. All returned requirements have `id`, `text`, `intent`, `verifiable_by` fields
8. IDs follow the template pattern (UX-01, SEC-01, etc.) with zero-padded 2-digit numbers
9. IDs within a category are sequential (no gaps)
10. `loadBaselineRequirements('invalid')` throws an error
11. Total count for web profile matches index.json `total_requirements` (34)
12. Each category in result has `name` and `description` fields
13. `--list-profiles` CLI flag returns 6 profiles

Run with: `node --test bin/load-baseline-requirements.test.cjs`
  </action>
  <verify>
    1. `node --test bin/load-baseline-requirements.test.cjs` -- all tests pass, 0 failures.
    2. `node bin/load-baseline-requirements.cjs --profile web | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.total)"` -- prints `34`.
    3. `node bin/load-baseline-requirements.cjs --profile library | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.categories.map(c=>c.name).join(','))"` -- prints `Security,CI/CD` (only 2 categories for library).
    4. `node bin/load-baseline-requirements.cjs --list-profiles | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.length)"` -- prints `6`.
  </verify>
  <done>
    bin/load-baseline-requirements.cjs exports loadBaselineRequirements(profile) that reads index.json, loads category files, filters by profile using per-requirement profiles arrays + includes_only for library, assigns sequential IDs per id_template, and returns structured categories with {id, text, intent, verifiable_by}. CLI mode supports --profile and --list-profiles. Test suite covers all 6 profiles, filter semantics, ID generation, error handling, and CLI flags.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire baseline requirements into new-project workflow</name>
  <files>qgsd-core/workflows/new-project.md</files>
  <action>
Modify `qgsd-core/workflows/new-project.md` to add a profile picker and baseline requirements integration. Insert two new steps between the current Step 6 (Research Decision) and Step 7 (Define Requirements).

**Step 6.5: Project Profile Selection**

Insert after Step 6 and before Step 7. This step determines which baseline requirements apply.

Add this section:

```markdown
## 6.5. Project Profile Selection

Present a profile picker to determine which baseline requirements apply:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "What type of project is this?",
    multiSelect: false,
    options: [
      { label: "Web Application", description: "Browser-based app with UI, APIs, and user sessions" },
      { label: "Mobile Application", description: "Native or hybrid mobile app" },
      { label: "Desktop Application", description: "Native desktop app (Electron, Tauri, etc.)" },
      { label: "API Service", description: "Backend API without a user-facing UI" },
      { label: "CLI Tool", description: "Command-line interface tool or script" },
      { label: "Library / Package", description: "Reusable library consumed by other projects" }
    ]
  }
])
```

Map selection to profile key:
- "Web Application" -> `web`
- "Mobile Application" -> `mobile`
- "Desktop Application" -> `desktop`
- "API Service" -> `api`
- "CLI Tool" -> `cli`
- "Library / Package" -> `library`

Store `PROJECT_PROFILE` variable for next step.

**If auto mode:** Default to `web` profile (most common). Can be overridden with `--profile <key>` flag if provided in arguments.
```

**Step 6.6: Load Baseline Requirements**

Insert after Step 6.5:

```markdown
## 6.6. Load Baseline Requirements

Load baseline requirements filtered by the selected profile:

```bash
BASELINE=$(node bin/load-baseline-requirements.cjs --profile "$PROJECT_PROFILE")
```

Parse the JSON output to get categories and requirements.

Present baseline requirements for opt-out:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► BASELINE REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Profile: [label] | [N] baseline requirements across [M] categories

These are industry-standard requirements for [profile label] projects.
All are included by default. Deselect any that don't apply.
```

For each category, use AskUserQuestion with multiSelect:

```
AskUserQuestion([
  {
    header: "[Category]",
    question: "Keep these [category] baseline requirements?",
    multiSelect: true,
    options: [
      // All pre-selected (default: included)
      { label: "[REQ-ID]: [text]", description: "[intent]", selected: true },
      ...
    ]
  }
])
```

Track kept vs removed baseline requirements. Kept baselines will be included in REQUIREMENTS.md under a `### Baseline` section per category.

**If auto mode:** Keep all baseline requirements (no opt-out step). Include all in REQUIREMENTS.md.

Store `BASELINE_KEPT` and `BASELINE_REMOVED` for use in Step 7.
```

**Modify Step 7 (Define Requirements):**

After the existing "Generate REQUIREMENTS.md" instruction, add guidance for integrating baseline requirements:

Add to the REQUIREMENTS.md generation instructions (inside Step 7, before the commit):

```markdown
**Include baseline requirements in REQUIREMENTS.md:**

Add a `## Baseline Requirements` section BEFORE the project-specific `## v1 Requirements` section:

```markdown
## Baseline Requirements

*Included from QGSD baseline defaults (profile: [profile]). These are non-functional quality requirements.*

### [Category 1]
- [x] **UX-01**: [text]
- [x] **UX-02**: [text]
- [ ] ~~**UX-03**: [text]~~ *(removed during scoping)*

### [Category 2]
- [x] **SEC-01**: [text]
...
```

Baseline requirements use their own ID namespace (UX-XX, SEC-XX, REL-XX, OBS-XX, CI-XX, PERF-XX) separate from project-specific REQ-IDs. They are tracked but not mapped to roadmap phases — they are cross-cutting quality gates verified during phase verification.

Removed baselines are shown struck through for traceability (the user consciously chose to exclude them).
```

Also update the "Present full requirements list" section to show baseline requirements first, then project-specific requirements.

**Update success_criteria at the bottom of new-project.md:**

Add:
- `- [ ] Project profile selected (web/mobile/desktop/api/cli/library)`
- `- [ ] Baseline requirements loaded and filtered by profile`
- `- [ ] User opted out of unwanted baselines`
- `- [ ] REQUIREMENTS.md includes Baseline Requirements section with kept/removed tracking`
  </action>
  <verify>
    1. `grep -c 'load-baseline-requirements' qgsd-core/workflows/new-project.md` -- at least 2 matches (step reference + bash command).
    2. `grep -c 'Project Profile' qgsd-core/workflows/new-project.md` -- at least 1 match (Step 6.5 heading).
    3. `grep -c 'Baseline Requirements' qgsd-core/workflows/new-project.md` -- at least 3 matches (step heading, REQUIREMENTS.md section, success criteria).
    4. `grep 'auto mode.*profile' qgsd-core/workflows/new-project.md` -- confirms auto mode defaults to web profile.
    5. `grep -c 'web\|mobile\|desktop\|api\|cli\|library' qgsd-core/workflows/new-project.md` -- at least 6 matches (all profiles mentioned in picker).
  </verify>
  <done>
    new-project.md has Step 6.5 (Project Profile Selection with AskUserQuestion picker for 6 profiles), Step 6.6 (Load Baseline Requirements via CLI and present for opt-out with multiSelect), and updated Step 7 with Baseline Requirements section in REQUIREMENTS.md generation. Auto mode defaults to web profile and keeps all baselines. Success criteria updated.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire baseline requirements into new-milestone workflow</name>
  <files>qgsd-core/workflows/new-milestone.md</files>
  <action>
Modify `qgsd-core/workflows/new-milestone.md` to add the same profile picker and baseline requirements integration. Insert two new steps between the current Step 8 (Research Decision) and Step 9 (Define Requirements).

**Step 8.5: Project Profile Selection**

Insert after Step 8 and before Step 9:

```markdown
## 8.5. Project Profile Selection

**Check for existing profile in PROJECT.md:**

```bash
EXISTING_PROFILE=$(grep -oP 'Profile:\s*\K\w+' .planning/PROJECT.md 2>/dev/null || echo "")
```

**If profile exists:** Present it for confirmation:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "Continue with existing project profile?",
    multiSelect: false,
    options: [
      { label: "Keep: [existing profile label]", description: "Same project type as previous milestone" },
      { label: "Change profile", description: "Project type has changed" }
    ]
  }
])
```

If "Keep" -> use existing profile. If "Change" -> show full picker (same as new-project Step 6.5).

**If no profile exists:** Show full picker:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "What type of project is this?",
    multiSelect: false,
    options: [
      { label: "Web Application", description: "Browser-based app with UI, APIs, and user sessions" },
      { label: "Mobile Application", description: "Native or hybrid mobile app" },
      { label: "Desktop Application", description: "Native desktop app (Electron, Tauri, etc.)" },
      { label: "API Service", description: "Backend API without a user-facing UI" },
      { label: "CLI Tool", description: "Command-line interface tool or script" },
      { label: "Library / Package", description: "Reusable library consumed by other projects" }
    ]
  }
])
```

Map selection to profile key (same mapping as new-project).

Store `PROJECT_PROFILE` variable. Update PROJECT.md with `Profile: [key]` if not already present.
```

**Step 8.6: Load Baseline Requirements**

Insert after Step 8.5:

```markdown
## 8.6. Load Baseline Requirements

**Check for existing baseline requirements in REQUIREMENTS.md:**

```bash
HAS_BASELINE=$(grep -c '## Baseline Requirements' .planning/REQUIREMENTS.md 2>/dev/null || echo "0")
```

**If baselines already exist (HAS_BASELINE > 0):**

Baseline requirements carry forward from previous milestone. Present a summary:

```
Baseline requirements from previous milestone carry forward.

[N] baseline requirements active across [M] categories.

Review baselines? (yes/no)
```

If "yes" -> present the same opt-out flow as new-project Step 6.6.
If "no" -> carry forward as-is.

**If no baselines exist (HAS_BASELINE = 0):**

Load and present baselines (same flow as new-project Step 6.6):

```bash
BASELINE=$(node bin/load-baseline-requirements.cjs --profile "$PROJECT_PROFILE")
```

Present for opt-out with multiSelect per category.
```

**Modify Step 9 (Define Requirements):**

Add the same baseline integration as new-project Step 7 -- baseline requirements go into a `## Baseline Requirements` section in REQUIREMENTS.md, before project-specific requirements. Baseline IDs use their own namespace. Removed baselines shown struck through.

Add this text after the "Generate REQUIREMENTS.md:" instruction in Step 9:

```markdown
**Include baseline requirements in REQUIREMENTS.md:**

If this is the first milestone with baselines, add a `## Baseline Requirements` section before `## Milestone v[X.Y] Requirements`:

```markdown
## Baseline Requirements

*Included from QGSD baseline defaults (profile: [profile]). Cross-cutting quality gates.*

### [Category]
- [x] **UX-01**: [text]
...
```

If baselines carried forward from a previous milestone, preserve the existing `## Baseline Requirements` section (with any user modifications from Step 8.6).
```

**Update success_criteria at the bottom of new-milestone.md:**

Add:
- `- [ ] Project profile confirmed or selected`
- `- [ ] Baseline requirements loaded (new) or carried forward (existing)`
- `- [ ] REQUIREMENTS.md includes Baseline Requirements section`
  </action>
  <verify>
    1. `grep -c 'load-baseline-requirements' qgsd-core/workflows/new-milestone.md` -- at least 2 matches.
    2. `grep -c 'Project Profile' qgsd-core/workflows/new-milestone.md` -- at least 1 match (Step 8.5 heading).
    3. `grep -c 'Baseline Requirements' qgsd-core/workflows/new-milestone.md` -- at least 3 matches.
    4. `grep 'carry forward' qgsd-core/workflows/new-milestone.md` -- confirms milestone-specific carry-forward logic.
    5. `grep -c 'EXISTING_PROFILE\|HAS_BASELINE' qgsd-core/workflows/new-milestone.md` -- at least 2 matches (milestone-specific detection).
  </verify>
  <done>
    new-milestone.md has Step 8.5 (Project Profile Selection with carry-forward detection from PROJECT.md), Step 8.6 (Load Baseline Requirements with carry-forward from previous milestone or fresh load), and updated Step 9 with baseline integration in REQUIREMENTS.md generation. Success criteria updated.
  </done>
</task>

</tasks>

<verification>
1. `node --test bin/load-baseline-requirements.test.cjs` -- all tests pass (0 failures).
2. `node bin/load-baseline-requirements.cjs --profile web | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('total:', d.total, 'cats:', d.categories.length)"` -- prints `total: 34 cats: 6`.
3. `node bin/load-baseline-requirements.cjs --profile library | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log('total:', d.total, 'cats:', d.categories.length)"` -- prints `total: 10 cats: 2` (6 security + 4 ci-cd).
4. `grep -l 'load-baseline-requirements' qgsd-core/workflows/new-project.md qgsd-core/workflows/new-milestone.md` -- both files listed.
5. `grep -l 'Project Profile Selection' qgsd-core/workflows/new-project.md qgsd-core/workflows/new-milestone.md` -- both files listed.
</verification>

<success_criteria>
- bin/load-baseline-requirements.cjs loads index.json, reads category files, filters by profile, assigns sequential IDs per id_template, outputs JSON
- All 6 profiles produce correct filtered results: web/mobile (all 34), desktop (33, minus health-check), api (29, minus 5 UI-only UX), cli (27, minus 7), library (10, only security+ci-cd)
- CLI supports --profile and --list-profiles flags
- Test suite covers all profiles, filter logic, ID generation, and error handling
- new-project.md has Step 6.5 (profile picker) and Step 6.6 (baseline requirements opt-out)
- new-milestone.md has Step 8.5 (profile picker with carry-forward) and Step 8.6 (baseline requirements with carry-forward)
- Both workflows include baseline requirements in REQUIREMENTS.md with own ID namespace
- Auto mode in new-project defaults to web profile and keeps all baselines
</success_criteria>

<output>
After completion, create `.planning/quick/151-wire-baseline-requirements-into-new-proj/151-SUMMARY.md`
</output>
