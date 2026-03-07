---
phase: quick
plan: 201
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json
  - .planning/quick/201-survey-code-for-producer-without-consume/201-SUMMARY.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-201]

must_haves:
  truths:
    - "Every bin/ script is classified as either wired (referenced by a skill command or hook) or lone (unreferenced)"
    - "Lone producers are documented with their purpose and potential skill integration point"
    - "Survey output is machine-readable JSON for downstream tooling"
  artifacts:
    - path: ".planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json"
      provides: "Structured inventory of bin scripts not reachable from any /nf: command"
      contains: "lone_producers"
    - path: ".planning/quick/201-survey-code-for-producer-without-consume/201-SUMMARY.md"
      provides: "Human-readable summary of findings"
  key_links:
    - from: "commands/nf/*.md"
      to: "bin/*.cjs"
      via: "script references in workflow markdown"
      pattern: "bin/[a-z-]+\\.cjs"
    - from: "hooks/*.js"
      to: "bin/*.cjs"
      via: "require or spawn calls"
      pattern: "require\\(|spawnSync\\("
    - from: "~/.claude/nf/workflows/*.md"
      to: "bin/*.cjs"
      via: "installed workflow references to nf-bin scripts"
      pattern: "nf-bin/|bin/[a-z-]+\\.cjs"
---

<objective>
Survey all bin/ scripts and identify "lone producers" -- scripts that generate output or provide features but are not wired into any top-level /nf: skill command, hook, or workflow. Produce a machine-readable inventory and human-readable summary.

Purpose: Identify dead code, orphaned utilities, and integration opportunities where existing bin scripts could be connected to skill commands to increase user-facing value.
Output: JSON inventory of lone producers + summary markdown
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@commands/nf/
@bin/
@hooks/
@core/
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build reference graph from skill commands, hooks, and workflows to bin scripts</name>
  <files>
    .planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json
  </files>
  <action>
    Scan all consumer surfaces that could reference bin/ scripts:

    1. **Skill commands** (commands/nf/*.md): grep for any `bin/` references, `node bin/`, `require.*bin/`, script names. These are the primary entry points users invoke.

    2. **Hooks** (hooks/*.js and hooks/dist/*.js): grep for require() or spawnSync() calls to bin/ scripts.

    3. **Workflows** (core/workflows/*.md if exists, plus any .md files under core/): grep for bin/ references.

    4. **Installed workflows** (~/.claude/nf/workflows/*.md and ~/.claude/nf/templates/*.md): grep for nf-bin/ or bin/ references. These are the installed runtime copies that may reference scripts via the ~/.claude/nf-bin/ install path rather than the repo's bin/ directory. Map nf-bin/ references back to their bin/ source.

    5. **Other bin scripts** -- scan BOTH bin/*.cjs AND bin/*.mjs (the unified-mcp-server.mjs is a known ESM exception that is a primary runtime entry point): grep for require() or import calls to sibling bin/ scripts. Build transitive closure: if script A calls script B which calls script C, and A is wired, then B and C are also wired. Record chain depth for each transitively-wired script (depth 0 = directly referenced by consumer, depth 1 = referenced by a depth-0 script, etc.).

    6. **unified-mcp-server.mjs specifically**: this is a primary runtime entry point configured in ~/.claude.json. Scan it for any imports or references to other bin/ scripts -- anything it references is wired.

    7. **package.json scripts**: check npm scripts that reference bin/ files.

    8. **Install.js**: check what it installs/references.

    Build a set of all bin/*.cjs and bin/*.mjs files (excluding test files *.test.cjs).
    Build a set of all "referenced" scripts from steps 1-8.
    The difference = lone producers.

    For each lone producer, read the first 20 lines to extract a purpose comment or description, and classify:
    - `dead_code`: appears to be unused and superseded
    - `internal_utility`: used only by other scripts (check if those parents are themselves wired)
    - `standalone_tool`: provides user-facing value but has no skill command entry point
    - `test_helper`: only used in test contexts

    Output JSON structure:
    ```json
    {
      "generated": "ISO timestamp",
      "total_bin_scripts": N,
      "wired_scripts": N,
      "lone_producers": [
        {
          "path": "bin/example.cjs",
          "purpose": "one-line description from file header",
          "classification": "standalone_tool|dead_code|internal_utility|test_helper",
          "suggested_skill": "/nf:command or null",
          "referenced_by": [],
          "has_companion_test": false
        }
      ],
      "wired_summary": {
        "by_skill_command": { "solve.md": ["bin/a.cjs", "bin/b.cjs"] },
        "by_hook": { "nf-prompt.js": ["bin/c.cjs"] },
        "by_installed_workflow": { "execute-plan.md": ["bin/d.cjs"] },
        "by_mcp_server": ["bin/e.cjs"],
        "by_other_bin": { "bin/d.cjs": ["bin/e.cjs"] }
      },
      "transitive_chains": [
        {
          "root": "bin/a.cjs",
          "chain": ["bin/b.cjs", "bin/c.cjs"],
          "depth": 2,
          "root_consumer": "commands/nf/solve.md"
        }
      ]
    }
    ```

    Important: exclude .test.cjs files from the lone producer list -- they are test files, not producers. But DO note if a lone producer has a companion test file (suggests it was intentionally built, not throwaway).
  </action>
  <verify>
    Run: node -e "const j = require('./.planning/quick/201-survey-code-for-producer-without-consume/201-lone-producers.json'); console.log('total:', j.total_bin_scripts, 'lone:', j.lone_producers.length, 'wired:', j.wired_scripts);"
    Confirm it parses without error, every entry in lone_producers has all required fields (path, purpose, classification), and total_bin_scripts = wired_scripts + lone_producers.length (accounting for test files excluded).
  </verify>
  <done>
    Machine-readable JSON inventory exists with every non-test bin/ script (both .cjs and .mjs) classified as wired or lone, with purpose extracted, classification assigned, and transitive chains documented with depth.
  </done>
</task>

<task type="auto">
  <name>Task 2: Produce human-readable summary with integration recommendations</name>
  <files>
    .planning/quick/201-survey-code-for-producer-without-consume/201-SUMMARY.md
  </files>
  <action>
    Read the 201-lone-producers.json and produce a summary markdown with:

    1. **Stats table**: total scripts, wired count, lone count, breakdown by classification
    2. **High-value integration opportunities**: standalone_tool entries that could become /nf: commands or be wired into existing commands. For each, suggest which skill command it belongs to or whether it warrants a new one.
    3. **Dead code candidates**: scripts classified as dead_code, with recommendation to archive or delete.
    4. **Internal utilities check**: for internal_utility entries, verify their parent scripts ARE wired. If the parent is also lone, flag the entire chain.
    5. **Transitive chains**: list any deep chains (depth >= 2) to highlight hidden dependencies.
    6. **Coverage metric**: percentage of bin/ scripts reachable from a user-facing /nf: command.

    Format as a proper SUMMARY.md following the project template conventions.
  </action>
  <verify>
    - File exists and contains all 6 sections
    - Coverage metric is calculated correctly (wired / total non-test scripts * 100)
    - At least one actionable recommendation exists for standalone_tool entries
  </verify>
  <done>
    Human-readable summary with stats, integration recommendations, dead code candidates, transitive chain analysis, and a coverage metric showing what percentage of bin/ scripts are reachable from user-facing skill commands.
  </done>
</task>

</tasks>

<verification>
- 201-lone-producers.json is valid JSON with complete classification of all non-test bin/ scripts (both .cjs and .mjs)
- 201-SUMMARY.md provides actionable insights about orphaned code
- No bin/ script (excluding tests) is unaccounted for -- every script appears in either wired or lone list
- Installed workflows (~/.claude/nf/) are included in the consumer scan
- Transitive chains are captured with depth metadata
</verification>

<success_criteria>
- Complete inventory of all non-test bin/ scripts (both .cjs and .mjs) with wired/lone classification
- Each lone producer has purpose, classification, and suggested integration point
- Summary identifies top integration opportunities and dead code candidates
- Coverage metric quantifies how much of bin/ is reachable from /nf: commands
- Transitive dependency chains documented with depth for traceability
</success_criteria>

<output>
After completion, create `.planning/quick/201-survey-code-for-producer-without-consume/201-SUMMARY.md`
</output>
