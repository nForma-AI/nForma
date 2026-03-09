---
phase: quick-249
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/principle-mapping.cjs
  - bin/nForma.cjs
  - bin/requirements-core.cjs
autonomous: true
requirements: []
formal_artifacts: none

must_haves:
  truths:
    - "TUI Requirements header shows live counts derived from requirements.json, not hardcoded mock data"
    - "TUI Browse Reqs view shows 8 principles as top-level groups, with specification counts under each"
    - "All 308 requirements are assigned to a principle — no orphans"
    - "Unmapped categories (51 currently) are assigned to the closest principle via a fallback mapping"
  artifacts:
    - path: "bin/principle-mapping.cjs"
      provides: "GROUP_TO_PRINCIPLES map + getCategoryPrinciple() resolver"
      exports: ["GROUP_TO_PRINCIPLES", "getCategoryPrinciple", "PRINCIPLES"]
    - path: "bin/nForma.cjs"
      provides: "Hierarchical requirements browse + live header stats"
      contains: "principle-mapping"
    - path: "bin/requirements-core.cjs"
      provides: "groupByPrinciple() function for requirement grouping"
      contains: "groupByPrinciple"
  key_links:
    - from: "bin/nForma.cjs"
      to: "bin/principle-mapping.cjs"
      via: "require('./principle-mapping.cjs')"
      pattern: "require.*principle-mapping"
    - from: "bin/nForma.cjs"
      to: "bin/requirements-core.cjs"
      via: "groupByPrinciple call"
      pattern: "groupByPrinciple"
    - from: "bin/principle-mapping.cjs"
      to: ".planning/formal/category-groups.json"
      via: "require for category-to-group resolution"
      pattern: "category-groups"
---

<objective>
Fix the TUI Requirements view to show a two-level hierarchy: 8 principles at the top level, with specifications grouped under each. Replace the hardcoded mock header stats with live data from requirements.json.

Purpose: The current Browse Reqs view shows a flat list of 308 requirements with no logical grouping. The header line "287 total - 8 principles - 9 categories" is hardcoded mock data. Users need to see requirements organized by principle to understand coverage at a glance.

Output: A principle-mapping module, updated requirements-core with grouping, and a hierarchical TUI browse view with live stats.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/formal/category-groups.json
@.planning/formal/requirements.json
@bin/nForma.cjs
@bin/requirements-core.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create principle-mapping module and add groupByPrinciple to requirements-core</name>
  <files>bin/principle-mapping.cjs, bin/requirements-core.cjs</files>
  <action>
Create `bin/principle-mapping.cjs` that exports:

1. `PRINCIPLES` — array of 8 principle names. Use these 8 principles derived from the 9+N category groups:
   - "Protocol Integrity" (maps from: Hooks & Enforcement)
   - "Quorum Governance" (maps from: Quorum & Dispatch)
   - "Formal Rigor" (maps from: Formal Verification)
   - "Operational Visibility" (maps from: Observability & Diagnostics)
   - "Agent Ecosystem" (maps from: MCP & Agents)
   - "Configuration Safety" (maps from: Configuration)
   - "Installation Reliability" (maps from: Installer & CLI)
   - "Planning Discipline" (maps from: Planning & Tracking)

2. `GROUP_TO_PRINCIPLES` — object mapping each of the 9+ consolidated groups (from category-groups.json values) to one of the 8 principles above. Testing & Quality maps to "Formal Rigor".

3. `UNMAPPED_FALLBACKS` — object mapping the 18 unmapped raw categories directly to principles:
   - "Agent Behavior" -> "Agent Ecosystem"
   - "CI/CD" -> "Installation Reliability"
   - "Credentials & Account Management" -> "Configuration Safety"
   - "Observability & Triage" -> "Operational Visibility"
   - "Documentation" -> "Planning Discipline"
   - "Code Quality Guardrails" -> "Formal Rigor"
   - "Installation & Toolchain" -> "Installation Reliability"
   - "TUI Navigation" -> "Operational Visibility"
   - "Architecture Constraints" -> "Protocol Integrity"
   - "Project Identity" -> "Installation Reliability"
   - "Reliability" -> "Protocol Integrity"
   - "Security" -> "Configuration Safety"
   - "Traceability & Verification" -> "Formal Rigor"
   - "solve" -> "Formal Rigor"
   - "Solver Orchestration" -> "Formal Rigor"
   - "Solver-Discovered" -> "Formal Rigor"
   - "Conformance & Traces" -> "Formal Rigor"
   - "UX Heuristics" -> "Operational Visibility"

4. `getCategoryPrinciple(rawCategory)` — resolves a raw category string to its principle:
   a. First check if rawCategory is itself a consolidated group key in GROUP_TO_PRINCIPLES
   b. Then look up rawCategory in category-groups.json to get consolidated group, then map group to principle
   c. Then check UNMAPPED_FALLBACKS
   d. Fallback: return "Planning Discipline" (catch-all)

IMPORTANT: When loading category-groups.json, filter out the `_comment` key (it's not a real mapping).

Then in `bin/requirements-core.cjs`, add a `groupByPrinciple(requirements)` function:
- Import getCategoryPrinciple and PRINCIPLES from principle-mapping.cjs
- Return an object: `{ [principle]: { count, requirements: [...] } }` for each of the 8 principles
- Each requirement is placed under its principle via getCategoryPrinciple(r.category)
- Order keys by PRINCIPLES array order
- Export groupByPrinciple in module.exports
  </action>
  <verify>
Run: `node -e "const pm = require('./bin/principle-mapping.cjs'); const rc = require('./bin/requirements-core.cjs'); const {requirements} = rc.readRequirementsJson(); const grouped = rc.groupByPrinciple(requirements); const total = Object.values(grouped).reduce((s,g) => s + g.count, 0); console.log('Principles:', Object.keys(grouped).length); console.log('Total mapped:', total); console.log('Expected:', requirements.length); Object.entries(grouped).forEach(([p,g]) => console.log(p, g.count));"`

Expected: 8 principles, total mapped = 308 (all requirements accounted for), no orphans.
  </verify>
  <done>
All 308 requirements map to exactly one of 8 principles. getCategoryPrinciple resolves every raw category (mapped, unmapped, or fallback). groupByPrinciple returns 8 groups with correct counts summing to total.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace hardcoded TUI header and implement hierarchical Browse Reqs view</name>
  <files>bin/nForma.cjs</files>
  <action>
Two changes in `bin/nForma.cjs`:

**A) Replace hardcoded reqs header (lines ~181-199):**

The `reqs:` array in the mock data block currently shows hardcoded "287 total - 8 principles - 9 categories" and fake category rows. Replace with a function `buildReqsHeader()` that:
1. Loads requirements via `reqCore.readRequirementsJson()`
2. Groups via `reqCore.groupByPrinciple(requirements)`
3. Builds the header showing live total: `"${total} total - 8 principles - ${uniqueGroups} categories"`
4. Lists each principle with its count (no coverage/formal columns needed — those were fake)
5. Shows a summary line at bottom with total count
6. Call this function where the `reqs:` mock array was used

Import `principle-mapping.cjs` at top of file (near other requires).

**B) Replace flat Browse Reqs with hierarchical view (lines ~2906-2950):**

Rewrite `reqBrowseFlow()` to show a two-level hierarchy:
1. First show a principle picker list (8 items) using `promptList()` — each item shows: `"Principle Name (N specs)"`
2. When user selects a principle, show the specifications under it using the existing `renderReqList()` function (pass filtered requirements for that principle)
3. Add a "Back to Principles" option or handle ESC to return to the principle list

The existing `renderReqList()` function can stay as-is — it already renders a list of requirements nicely. Just feed it the filtered subset.

Keep the existing filter hotkeys (f for filter, s for search) working within the specification view if they exist.

NOTE on tui-nav invariant: EscapeProgress requires depth' < depth on ESC. The principle picker -> spec list is a standard promptList flow which already follows this pattern (ESC returns to previous menu). Do NOT add extra depth levels beyond what promptList naturally provides.
  </action>
  <verify>
1. Run `node bin/nForma.cjs` — navigate to Requirements (F2), confirm header shows live counts (should show "308 total" not "287 total")
2. Navigate to Browse Reqs — confirm principle picker appears with 8 principles and correct counts
3. Select a principle — confirm specification list shows only requirements for that principle
4. Press ESC — confirm return to principle picker
5. Grep for hardcoded "287": `grep -n "287" bin/nForma.cjs` — should return 0 matches in the reqs header area
  </verify>
  <done>
TUI Requirements header shows live stats from requirements.json (308 total, 8 principles). Browse Reqs shows a principle picker leading to filtered specification lists. No hardcoded mock data remains in the reqs header. ESC navigation works correctly.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const rc = require('./bin/requirements-core.cjs'); const {requirements} = rc.readRequirementsJson(); const g = rc.groupByPrinciple(requirements); console.log(Object.keys(g).length, '== 8'); console.log(Object.values(g).reduce((s,x)=>s+x.count,0), '== 308')"` — prints "8 == 8" and "308 == 308"
2. `grep -c '287 total' bin/nForma.cjs` — returns 0 (no hardcoded mock count)
3. `grep 'principle-mapping' bin/nForma.cjs` — confirms import exists
4. `grep 'groupByPrinciple' bin/requirements-core.cjs` — confirms export exists
</verification>

<success_criteria>
- All 308 requirements are grouped under 8 principles with zero orphans
- TUI header shows live requirement counts derived from requirements.json
- Browse Reqs shows principle picker (8 items) -> specification list (filtered)
- No hardcoded mock data remains in requirements header
- ESC navigation follows existing TUI patterns (no invariant violations)
</success_criteria>

<output>
After completion, create `.planning/quick/249-fix-tui-requirements-view-to-show-two-le/249-SUMMARY.md`
</output>
