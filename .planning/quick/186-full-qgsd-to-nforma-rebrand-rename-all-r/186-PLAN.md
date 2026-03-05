---
phase: quick-186
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  # Task 1 — file/directory renames + config path migration
  - bin/qgsd-solve.cjs  # rename to bin/nf-solve.cjs
  - bin/qgsd-solve.test.cjs  # rename to bin/nf-solve.test.cjs
  - bin/qgsd-debt.test.cjs  # rename to bin/nf-debt.test.cjs
  - bin/qgsd-fan-out.test.cjs  # rename to bin/nf-fan-out.test.cjs
  - bin/qgsd-solve-ptoF-integration.test.cjs  # rename to bin/nf-solve-ptoF-integration.test.cjs
  - bin/qgsd-stop-hook.test.cjs  # rename to bin/nf-stop-hook.test.cjs
  - hooks/qgsd-circuit-breaker.js  # rename to hooks/nf-circuit-breaker.js
  - hooks/qgsd-prompt.js  # rename to hooks/nf-prompt.js
  - hooks/qgsd-stop.js  # rename to hooks/nf-stop.js
  - hooks/qgsd-statusline.js  # rename to hooks/nf-statusline.js
  - hooks/qgsd-check-update.js  # rename to hooks/nf-check-update.js
  - hooks/qgsd-session-start.js  # rename to hooks/nf-session-start.js
  - hooks/qgsd-token-collector.js  # rename to hooks/nf-token-collector.js
  - hooks/qgsd-slot-correlator.js  # rename to hooks/nf-slot-correlator.js
  - hooks/qgsd-spec-regen.js  # rename to hooks/nf-spec-regen.js
  - hooks/qgsd-precompact.js  # rename to hooks/nf-precompact.js
  - hooks/qgsd-prompt-fan-out.test.cjs  # rename to hooks/nf-prompt-fan-out.test.cjs
  - hooks/qgsd-stop-fan-out.test.cjs  # rename to hooks/nf-stop-fan-out.test.cjs
  - hooks/qgsd-circuit-breaker.test.js  # rename to hooks/nf-circuit-breaker.test.js
  - hooks/qgsd-prompt.test.js  # rename to hooks/nf-prompt.test.js
  - hooks/qgsd-stop.test.js  # rename to hooks/nf-stop.test.js
  - hooks/qgsd-statusline.test.js  # rename to hooks/nf-statusline.test.js
  - hooks/qgsd-session-start.test.js  # rename to hooks/nf-session-start.test.js
  - hooks/qgsd-token-collector.test.js  # rename to hooks/nf-token-collector.test.js
  - hooks/qgsd-slot-correlator.test.js  # rename to hooks/nf-slot-correlator.test.js
  - hooks/qgsd-spec-regen.test.js  # rename to hooks/nf-spec-regen.test.js
  - hooks/qgsd-precompact.test.js  # rename to hooks/nf-precompact.test.js
  - agents/qgsd-codebase-mapper.md  # rename to agents/nf-codebase-mapper.md
  - agents/qgsd-debugger.md  # rename to agents/nf-debugger.md
  - agents/qgsd-executor.md  # rename to agents/nf-executor.md
  - agents/qgsd-integration-checker.md  # rename to agents/nf-integration-checker.md
  - agents/qgsd-phase-researcher.md  # rename to agents/nf-phase-researcher.md
  - agents/qgsd-plan-checker.md  # rename to agents/nf-plan-checker.md
  - agents/qgsd-planner.md  # rename to agents/nf-planner.md
  - agents/qgsd-project-researcher.md  # rename to agents/nf-project-researcher.md
  - agents/qgsd-quorum-orchestrator.md  # rename to agents/nf-quorum-orchestrator.md
  - agents/qgsd-quorum-slot-worker.md  # rename to agents/nf-quorum-slot-worker.md
  - agents/qgsd-quorum-synthesizer.md  # rename to agents/nf-quorum-synthesizer.md
  - agents/qgsd-quorum-test-worker.md  # rename to agents/nf-quorum-test-worker.md
  - agents/qgsd-quorum-worker.md  # rename to agents/nf-quorum-worker.md
  - agents/qgsd-research-synthesizer.md  # rename to agents/nf-research-synthesizer.md
  - agents/qgsd-roadmapper.md  # rename to agents/nf-roadmapper.md
  - agents/qgsd-verifier.md  # rename to agents/nf-verifier.md
  - core/commands/qgsd/review-requirements.md  # rename dir to core/commands/nf/
  - templates/qgsd.json  # rename to templates/nf.json
  - src/machines/qgsd-workflow.machine.ts  # rename to src/machines/nf-workflow.machine.ts
  - hooks/dist/*  # all qgsd-* files renamed to nf-*
  - scripts/build-hooks.js  # update hook filename references
  # Task 2 — content replacements across all live code
  - bin/install.js
  - bin/nForma.cjs
  - bin/manage-agents-core.cjs
  - bin/nf-solve.cjs  # (renamed from qgsd-solve.cjs)
  - package.json
  - commands/nf/*.md  # all 48 command files
  - core/workflows/*.md  # all 32 workflow files
  - core/templates/*.md  # all template files
  - core/references/*.md  # all reference files
  - core/bin/gsd-tools.cjs
  - hooks/nf-*.js  # (renamed hook files)
  - hooks/config-loader.js
  - agents/nf-*.md  # (renamed agent files)
  - scripts/*.js
  - scripts/*.sh
  - CHANGELOG.md
  # Task 3 — test file content updates + install sync + verification
  - bin/*.test.cjs  # all test files with qgsd references
  - hooks/*.test.js  # all hook test files
  - hooks/*.test.cjs  # all hook test files
  - core/bin/gsd-tools.test.cjs
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "No live code file in bin/, hooks/, commands/nf/, core/, scripts/, agents/ contains the string 'qgsd' except in backward-compat regex patterns and historical comments"
    - "No file named qgsd-*.js or qgsd-*.cjs exists in hooks/ or bin/ (all renamed to nf-*)"
    - "No agent file named qgsd-*.md exists in agents/ (all renamed to nf-*)"
    - "The installer correctly references nf-* hook filenames and installs to ~/.claude/nf/ path"
    - "All command files in commands/nf/ have name: nf:* instead of name: qgsd:*"
    - "All tests pass after the rename (npm test or node --test)"
    - "subagent_type values use nf-* prefix instead of qgsd-* prefix"
  artifacts:
    - path: "hooks/nf-prompt.js"
      provides: "Renamed quorum prompt hook"
    - path: "hooks/nf-stop.js"
      provides: "Renamed stop hook"
    - path: "hooks/nf-circuit-breaker.js"
      provides: "Renamed circuit breaker hook"
    - path: "bin/nf-solve.cjs"
      provides: "Renamed solve script"
    - path: "agents/nf-executor.md"
      provides: "Renamed executor agent"
    - path: "agents/nf-planner.md"
      provides: "Renamed planner agent"
    - path: "agents/nf-quorum-slot-worker.md"
      provides: "Renamed quorum slot worker agent"
  key_links:
    - from: "bin/install.js"
      to: "hooks/nf-*.js"
      via: "hook registration in ~/.claude.json"
      pattern: "nf-(prompt|stop|circuit-breaker|statusline|session-start|spec-regen|precompact|token-collector|slot-correlator)"
    - from: "bin/install.js"
      to: "~/.claude/nf/"
      via: "install target directory"
      pattern: "nf/"
    - from: "hooks/nf-prompt.js"
      to: "agents/nf-quorum-slot-worker.md"
      via: "subagent_type dispatch"
      pattern: 'subagent_type="nf-quorum-slot-worker"'
    - from: "commands/nf/*.md"
      to: "core/workflows/*.md"
      via: "execution_context references"
      pattern: "~/.claude/nf/"
    - from: "scripts/build-hooks.js"
      to: "hooks/nf-*.js"
      via: "hook filename list for build"
      pattern: "nf-"
requirements: []
---

<objective>
Complete the QGSD-to-nForma rebrand by renaming all remaining qgsd/QGSD references in live code to nf/nForma.

Three prior commits handled: user-facing strings (805ca1a3), npm package name (45169f45), and /qgsd: -> /nf: command prefixes (59adc7a0). This plan handles everything else: file renames, directory renames, install paths, subagent types, variable names, config paths, hook filenames, agent filenames, and all remaining content references.

Purpose: Achieve brand consistency — the only "qgsd" remaining should be in backward-compat regex patterns (the tri-prefix `/(nf|q?gsd):/` in hooks) and in .planning/ historical records.

Output: All live code files consistently use nf/nForma naming.
</objective>

<execution_context>
@.planning/quick/186-full-qgsd-to-nforma-rebrand-rename-all-r/186-PLAN.md
</execution_context>

<context>
@.planning/STATE.md
@bin/install.js
@hooks/config-loader.js
@scripts/build-hooks.js
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename all qgsd-prefixed files and directories to nf-prefix</name>
  <files>
    bin/qgsd-solve.cjs
    bin/qgsd-solve.test.cjs
    bin/qgsd-debt.test.cjs
    bin/qgsd-fan-out.test.cjs
    bin/qgsd-solve-ptoF-integration.test.cjs
    bin/qgsd-stop-hook.test.cjs
    hooks/qgsd-circuit-breaker.js
    hooks/qgsd-prompt.js
    hooks/qgsd-stop.js
    hooks/qgsd-statusline.js
    hooks/qgsd-check-update.js
    hooks/qgsd-session-start.js
    hooks/qgsd-token-collector.js
    hooks/qgsd-slot-correlator.js
    hooks/qgsd-spec-regen.js
    hooks/qgsd-precompact.js
    hooks/qgsd-prompt-fan-out.test.cjs
    hooks/qgsd-stop-fan-out.test.cjs
    hooks/qgsd-circuit-breaker.test.js
    hooks/qgsd-prompt.test.js
    hooks/qgsd-stop.test.js
    hooks/qgsd-statusline.test.js
    hooks/qgsd-session-start.test.js
    hooks/qgsd-token-collector.test.js
    hooks/qgsd-slot-correlator.test.js
    hooks/qgsd-spec-regen.test.js
    hooks/qgsd-precompact.test.js
    agents/qgsd-*.md (16 files)
    core/commands/qgsd/ (directory)
    templates/qgsd.json
    src/machines/qgsd-workflow.machine.ts
    hooks/dist/qgsd-*.js
    scripts/build-hooks.js
  </files>
  <action>
    Use `git mv` for ALL renames to preserve git history. Perform in this order:

    **1. bin/ file renames:**
    ```
    git mv bin/qgsd-solve.cjs bin/nf-solve.cjs
    git mv bin/qgsd-solve.test.cjs bin/nf-solve.test.cjs
    git mv bin/qgsd-debt.test.cjs bin/nf-debt.test.cjs
    git mv bin/qgsd-fan-out.test.cjs bin/nf-fan-out.test.cjs
    git mv bin/qgsd-solve-ptoF-integration.test.cjs bin/nf-solve-ptoF-integration.test.cjs
    git mv bin/qgsd-stop-hook.test.cjs bin/nf-stop-hook.test.cjs
    ```

    **2. hooks/ file renames (source files):**
    Rename ALL `hooks/qgsd-*.js` to `hooks/nf-*.js` and ALL `hooks/qgsd-*.test.js` to `hooks/nf-*.test.js` and `hooks/qgsd-*.test.cjs` to `hooks/nf-*.test.cjs`:
    ```
    git mv hooks/qgsd-circuit-breaker.js hooks/nf-circuit-breaker.js
    git mv hooks/qgsd-prompt.js hooks/nf-prompt.js
    git mv hooks/qgsd-stop.js hooks/nf-stop.js
    git mv hooks/qgsd-statusline.js hooks/nf-statusline.js
    git mv hooks/qgsd-check-update.js hooks/nf-check-update.js
    git mv hooks/qgsd-session-start.js hooks/nf-session-start.js
    git mv hooks/qgsd-token-collector.js hooks/nf-token-collector.js
    git mv hooks/qgsd-slot-correlator.js hooks/nf-slot-correlator.js
    git mv hooks/qgsd-spec-regen.js hooks/nf-spec-regen.js
    git mv hooks/qgsd-precompact.js hooks/nf-precompact.js
    ```
    And test files:
    ```
    git mv hooks/qgsd-circuit-breaker.test.js hooks/nf-circuit-breaker.test.js
    git mv hooks/qgsd-prompt.test.js hooks/nf-prompt.test.js
    git mv hooks/qgsd-stop.test.js hooks/nf-stop.test.js
    git mv hooks/qgsd-statusline.test.js hooks/nf-statusline.test.js
    git mv hooks/qgsd-session-start.test.js hooks/nf-session-start.test.js
    git mv hooks/qgsd-token-collector.test.js hooks/nf-token-collector.test.js
    git mv hooks/qgsd-slot-correlator.test.js hooks/nf-slot-correlator.test.js
    git mv hooks/qgsd-spec-regen.test.js hooks/nf-spec-regen.test.js
    git mv hooks/qgsd-precompact.test.js hooks/nf-precompact.test.js
    git mv hooks/qgsd-prompt-fan-out.test.cjs hooks/nf-prompt-fan-out.test.cjs
    git mv hooks/qgsd-stop-fan-out.test.cjs hooks/nf-stop-fan-out.test.cjs
    ```

    **3. hooks/dist/ file renames:**
    Rename ALL `hooks/dist/qgsd-*.js` to `hooks/dist/nf-*.js`:
    ```
    for f in hooks/dist/qgsd-*.js; do git mv "$f" "hooks/dist/nf-${f#hooks/dist/qgsd-}"; done
    ```

    **4. agents/ file renames (16 files):**
    ```
    for f in agents/qgsd-*.md; do git mv "$f" "agents/nf-${f#agents/qgsd-}"; done
    ```

    **5. core/commands/ directory rename:**
    ```
    git mv core/commands/qgsd core/commands/nf
    ```

    **6. templates/ file rename:**
    ```
    git mv templates/qgsd.json templates/nf.json
    ```

    **7. src/machines/ file rename:**
    ```
    git mv src/machines/qgsd-workflow.machine.ts src/machines/nf-workflow.machine.ts
    ```

    **8. Update scripts/build-hooks.js** to reference the new nf-* hook filenames instead of qgsd-* filenames.

    **IMPORTANT**: After all renames, update every `require()` or file path reference within the RENAMED files that points to the old filenames. For example:
    - In `hooks/nf-prompt.test.js`: `require('./qgsd-prompt')` -> `require('./nf-prompt')`
    - In `bin/nf-solve.test.cjs`: `require('./qgsd-solve')` -> `require('./nf-solve')`
    - In `bin/nf-stop-hook.test.cjs`: `require('../hooks/qgsd-stop')` -> `require('../hooks/nf-stop')`
    - In `hooks/nf-prompt-fan-out.test.cjs`: references to qgsd-prompt -> nf-prompt
    - In `hooks/nf-stop-fan-out.test.cjs`: references to qgsd-stop -> nf-stop

    **DO NOT rename or modify any files in .planning/ — these are historical records.**
  </action>
  <verify>
    ```bash
    # No qgsd-prefixed files remain in hooks/, bin/, agents/
    ls hooks/qgsd-*.js 2>/dev/null | wc -l  # should be 0
    ls bin/qgsd-*.cjs 2>/dev/null | wc -l   # should be 0
    ls agents/qgsd-*.md 2>/dev/null | wc -l  # should be 0
    ls hooks/dist/qgsd-*.js 2>/dev/null | wc -l  # should be 0
    ls core/commands/qgsd/ 2>/dev/null  # should not exist
    ls templates/qgsd.json 2>/dev/null  # should not exist
    # New files exist
    ls hooks/nf-prompt.js hooks/nf-stop.js hooks/nf-circuit-breaker.js
    ls bin/nf-solve.cjs
    ls agents/nf-executor.md agents/nf-planner.md
    ```
  </verify>
  <done>All qgsd-prefixed files renamed to nf-prefix using git mv. No qgsd-named files remain in hooks/, bin/, agents/, hooks/dist/, core/commands/, templates/, or src/machines/.</done>
</task>

<task type="auto">
  <name>Task 2: Replace all qgsd/QGSD content references in live code files</name>
  <files>
    bin/install.js
    bin/nForma.cjs
    bin/nf-solve.cjs
    bin/manage-agents-core.cjs
    bin/*.cjs (all 100+ bin scripts with qgsd references)
    package.json
    commands/nf/*.md (48 files)
    core/workflows/*.md (32 files)
    core/templates/*.md
    core/references/*.md
    core/bin/gsd-tools.cjs
    core/commands/nf/review-requirements.md
    core/defaults/baseline-requirements/index.json
    hooks/nf-*.js (10 renamed hook files)
    hooks/config-loader.js
    hooks/conformance-schema.cjs
    hooks/gsd-context-monitor.js
    agents/nf-*.md (16 renamed agent files)
    templates/nf.json
    scripts/*.js
    scripts/*.sh
    CHANGELOG.md
  </files>
  <action>
    Perform content replacements across all live code files. Use `sed -i '' ...` (macOS) or scripted find-and-replace. Apply these substitutions IN ORDER (most specific first to avoid partial matches):

    **Mapping table (ordered by specificity):**

    | Pattern | Replacement | Notes |
    |---------|-------------|-------|
    | `~/.claude/qgsd/` | `~/.claude/nf/` | Install target path |
    | `~/.claude/qgsd.json` | `~/.claude/nf.json` | Config file path |
    | `.claude/qgsd/` | `.claude/nf/` | Relative install paths |
    | `.claude/qgsd.json` | `.claude/nf.json` | Relative config paths |
    | `qgsd-bin/` | `nf-bin/` | Bin scripts install directory |
    | `qgsd-bin` | `nf-bin` | Bin scripts references |
    | `templates/qgsd.json` | `templates/nf.json` | Template path |
    | `qgsd-file-manifest.json` | `nf-file-manifest.json` | Manifest filename |
    | `qgsd-workflow.machine` | `nf-workflow.machine` | XState machine reference |
    | `qgsd-quorum-slot-worker` | `nf-quorum-slot-worker` | subagent_type (most used) |
    | `qgsd-quorum-orchestrator` | `nf-quorum-orchestrator` | subagent_type |
    | `qgsd-quorum-synthesizer` | `nf-quorum-synthesizer` | subagent_type |
    | `qgsd-quorum-test-worker` | `nf-quorum-test-worker` | subagent_type |
    | `qgsd-quorum-worker` | `nf-quorum-worker` | subagent_type |
    | `qgsd-executor` | `nf-executor` | subagent_type |
    | `qgsd-planner` | `nf-planner` | subagent_type |
    | `qgsd-verifier` | `nf-verifier` | subagent_type |
    | `qgsd-debugger` | `nf-debugger` | subagent_type |
    | `qgsd-roadmapper` | `nf-roadmapper` | subagent_type |
    | `qgsd-plan-checker` | `nf-plan-checker` | subagent_type |
    | `qgsd-phase-researcher` | `nf-phase-researcher` | subagent_type |
    | `qgsd-project-researcher` | `nf-project-researcher` | subagent_type |
    | `qgsd-research-synthesizer` | `nf-research-synthesizer` | subagent_type |
    | `qgsd-codebase-mapper` | `nf-codebase-mapper` | subagent_type |
    | `qgsd-integration-checker` | `nf-integration-checker` | subagent_type |
    | `qgsd-haiku-validator` | `nf-haiku-validator` | subagent_type |
    | `qgsd-statusline` | `nf-statusline` | Hook filename references |
    | `qgsd-check-update` | `nf-check-update` | Hook filename references |
    | `qgsd-session-start` | `nf-session-start` | Hook filename references |
    | `qgsd-circuit-breaker` | `nf-circuit-breaker` | Hook filename references |
    | `qgsd-prompt` | `nf-prompt` | Hook filename references |
    | `qgsd-stop` | `nf-stop` | Hook filename references |
    | `qgsd-spec-regen` | `nf-spec-regen` | Hook filename references |
    | `qgsd-precompact` | `nf-precompact` | Hook filename references |
    | `qgsd-token-collector` | `nf-token-collector` | Hook filename references |
    | `qgsd-slot-correlator` | `nf-slot-correlator` | Hook filename references |
    | `qgsd-solve` | `nf-solve` | Script filename references |
    | `qgsd-debt` | `nf-debt` | Script filename references |
    | `qgsd-fan-out` | `nf-fan-out` | Script filename references |
    | `name: qgsd:` | `name: nf:` | Command name: fields (48 files) |
    | `npx qgsd` | `npx nforma` | CLI invocation |
    | `"qgsd"` in package.json bin field | `"nforma"` | npm bin command name |
    | `QGSD >` | `nForma >` | Banner/UI strings |
    | `QGSD Quorum` | `nForma Quorum` | UI strings |
    | `QGSD Config` | `nForma Config` | UI strings |
    | `QGSD installer` | `nForma installer` | UI strings |

    **Variable name replacements in JS files:**
    | Pattern | Replacement |
    |---------|-------------|
    | `qgsdConfig` | `nfConfig` |
    | `qgsdConfigPath` | `nfConfigPath` |
    | `qgsdJsonPath` | `nfJsonPath` |
    | `QGSD_PATH` | `NF_PATH` |
    | `migrateQgsdJson` | `migrateNfJson` |
    | `addSlotToQuorumActive` (keep — not qgsd-named) | (no change) |

    **CRITICAL EXCEPTIONS — DO NOT replace these patterns:**
    1. The tri-prefix backward-compat regex `/(nf\|q?gsd):/` in hooks — KEEP as-is for backward compat
    2. The OpenCode conversion regex `convertedContent.replace(/\/nf:/g, '/qgsd-')` in install.js — this is intentional OpenCode compat, BUT update the comment to explain why qgsd- is kept for OpenCode
    3. Any `require()` paths that were already updated in Task 1
    4. Git URLs containing "QGSD" (e.g., `nForma-AI/QGSD`) — KEEP as-is (that's the repo name)
    5. **DO NOT touch any files in .planning/** — historical records
    6. The `build:machines` script in package.json referencing the machine file — update path to `nf-workflow.machine.ts`
    7. Comments explaining "formerly QGSD" or "renamed from QGSD" — these are fine to keep

    **Approach:** Process files directory by directory. For each file, read it, apply all relevant substitutions, write it back. Work through:
    1. `commands/nf/*.md` — update all 48 `name: qgsd:*` lines to `name: nf:*`, plus any qgsd references in body
    2. `core/workflows/*.md` — update all path references (`~/.claude/qgsd/` -> `~/.claude/nf/`), subagent types, command references
    3. `core/templates/*.md`, `core/references/*.md` — same path + subagent type updates
    4. `core/bin/gsd-tools.cjs` — path and variable updates
    5. `bin/install.js` — THE CRITICAL FILE. Update all hook filename references, install paths, config paths, manifest name, variable names. This file has ~99 qgsd occurrences. Be methodical.
    6. `bin/nForma.cjs` — ~64 occurrences, mostly paths and config references
    7. `bin/manage-agents-core.cjs` — agent filename references
    8. All other `bin/*.cjs` files — grep for remaining qgsd references and update
    9. `hooks/nf-*.js` and `hooks/config-loader.js` — update internal references
    10. `agents/nf-*.md` — update subagent_type references and cross-references
    11. `templates/nf.json` — update comments and any qgsd references
    12. `scripts/*.js`, `scripts/*.sh` — update references
    13. `package.json` — update bin field key and build:machines path
    14. `CHANGELOG.md` — update remaining qgsd references (34 occurrences)

    **For bin/install.js specifically:**
    - `path.join(configDir, 'qgsd')` -> `path.join(configDir, 'nf')`
    - `path.join(targetDir, 'qgsd')` -> `path.join(targetDir, 'nf')`
    - `path.join(targetDir, 'qgsd-bin')` -> `path.join(targetDir, 'nf-bin')`
    - All `buildHookCommand(targetDir, 'qgsd-*.js')` -> `buildHookCommand(targetDir, 'nf-*.js')`
    - `h.command.includes('qgsd-prompt')` -> `h.command.includes('nf-prompt')` (and similar for all hooks)
    - `matcher: 'qgsd-quorum-slot-worker'` -> `matcher: 'nf-quorum-slot-worker'`
    - `'qgsd-file-manifest.json'` -> `'nf-file-manifest.json'`
    - `file.startsWith('qgsd-')` -> `file.startsWith('nf-')` (for agent file detection in uninstall)
    - Config file: `qgsd.json` -> `nf.json` everywhere in install.js
    - Variable names: `qgsdConfig` -> `nfConfig`, `qgsdConfigPath` -> `nfConfigPath`
    - Keep the uninstall cleanup that removes OLD qgsd paths (add nf paths too, or rename)
    - Add migration logic: if `~/.claude/qgsd/` exists and `~/.claude/nf/` does not, rename the old directory during install (similar to existing gsd->qgsd migration pattern)

    **For the OpenCode `/qgsd-` conversion in install.js:**
    Keep `convertedContent.replace(/\/nf:/g, '/qgsd-')` — OpenCode uses flat commands and the qgsd- prefix is their convention. Update the comment to explain this is intentional for OpenCode backward compat.
    ACTUALLY: Since OpenCode already has the old commands, update this to `/nf-` for consistency: `convertedContent.replace(/\/nf:/g, '/nf-')`. The old `/qgsd-` commands won't exist after this rebrand.
  </action>
  <verify>
    ```bash
    # Count remaining qgsd references in live code (excluding .planning/ and backward-compat patterns)
    grep -r 'qgsd' bin/ hooks/ commands/ core/ scripts/ agents/ templates/ src/ package.json CHANGELOG.md \
      --include='*.js' --include='*.cjs' --include='*.mjs' --include='*.md' --include='*.json' --include='*.ts' --include='*.sh' \
      | grep -v 'q?gsd' | grep -v 'nForma-AI/QGSD' | grep -v '.planning/' | grep -v 'formerly' | grep -v 'renamed from' | wc -l
    # Target: 0 or very close to 0 (only backward-compat regex patterns)
    ```
  </verify>
  <done>All content references to qgsd/QGSD in live code files have been replaced with nf/nForma equivalents. The only remaining "qgsd" strings are in backward-compat regex patterns and historical explanations.</done>
</task>

<task type="auto">
  <name>Task 3: Sync hooks/dist, run install, and verify all tests pass</name>
  <files>
    hooks/dist/nf-*.js
    bin/install.js
    bin/*.test.cjs
    hooks/*.test.js
    hooks/*.test.cjs
    core/bin/gsd-tools.test.cjs
  </files>
  <action>
    **1. Rebuild hooks/dist/:**
    Copy all renamed hook source files to hooks/dist/:
    ```bash
    cp hooks/nf-circuit-breaker.js hooks/dist/
    cp hooks/nf-prompt.js hooks/dist/
    cp hooks/nf-stop.js hooks/dist/
    cp hooks/nf-statusline.js hooks/dist/
    cp hooks/nf-check-update.js hooks/dist/
    cp hooks/nf-session-start.js hooks/dist/
    cp hooks/nf-token-collector.js hooks/dist/
    cp hooks/nf-slot-correlator.js hooks/dist/
    cp hooks/nf-spec-regen.js hooks/dist/
    cp hooks/nf-precompact.js hooks/dist/
    cp hooks/config-loader.js hooks/dist/
    cp hooks/conformance-schema.cjs hooks/dist/
    cp hooks/gsd-context-monitor.js hooks/dist/
    ```
    Also copy the unified-mcp-server if present: `cp hooks/unified-mcp-server.mjs hooks/dist/ 2>/dev/null`
    Remove any old qgsd-* files from hooks/dist/ that are untracked.

    **2. Run the installer to verify it works:**
    ```bash
    node bin/install.js --claude --global
    ```
    This should install to `~/.claude/nf/` (the new path). Verify the installer:
    - Creates `~/.claude/nf/` directory
    - Registers hooks as `nf-prompt.js`, `nf-stop.js`, etc. in `~/.claude.json`
    - Creates `~/.claude/nf.json` config (or migrates from `~/.claude/qgsd.json`)

    **3. Run ALL tests to catch any broken references:**
    ```bash
    node --test bin/*.test.cjs hooks/*.test.js hooks/*.test.cjs core/bin/*.test.cjs 2>&1 | tail -20
    ```
    Fix any failures caused by:
    - Stale require() paths pointing to old qgsd-* filenames
    - Test assertions expecting old qgsd-* strings
    - Mock paths referencing old filenames
    - Config path expectations (`qgsd.json` -> `nf.json`)

    **4. Verify no qgsd-prefixed files remain in live code directories:**
    ```bash
    find bin/ hooks/ agents/ core/ templates/ src/ -name '*qgsd*' -not -path '.planning/*'
    ```
    Should return empty.

    **5. Final grep verification:**
    ```bash
    # Only backward-compat regex, git URLs, and OpenCode compat should remain
    grep -rn 'qgsd' bin/ hooks/ commands/ core/ scripts/ agents/ templates/ src/ \
      --include='*.js' --include='*.cjs' --include='*.mjs' --include='*.md' --include='*.json' --include='*.ts' --include='*.sh' \
      | grep -v 'q?gsd' | grep -v 'nForma-AI/QGSD' | grep -v 'formerly\|renamed\|old name\|was QGSD'
    ```
  </action>
  <verify>
    ```bash
    # 1. No qgsd-prefixed files in live code
    find bin/ hooks/ agents/ core/ templates/ src/ -name '*qgsd*' | wc -l  # 0

    # 2. Installer runs without error
    node bin/install.js --claude --global 2>&1 | grep -c 'error\|Error'  # 0

    # 3. Tests pass
    node --test bin/nf-solve.test.cjs hooks/nf-prompt.test.js hooks/nf-stop.test.js 2>&1 | tail -5

    # 4. Hook registration uses nf-* names
    cat ~/.claude.json | grep -c 'nf-prompt\|nf-stop\|nf-circuit-breaker'  # >= 3
    ```
  </verify>
  <done>hooks/dist/ synced with renamed files, installer successfully installs to ~/.claude/nf/ path, hooks registered with nf-* names in ~/.claude.json, and all tests pass with no qgsd references in test assertions.</done>
</task>

</tasks>

<verification>
1. `find bin/ hooks/ agents/ core/ templates/ src/ -name '*qgsd*'` returns empty
2. `grep -rn 'qgsd' bin/ hooks/ commands/ core/ scripts/ agents/ templates/ src/ --include='*.js' --include='*.cjs' --include='*.mjs' --include='*.md' --include='*.json' --include='*.ts' --include='*.sh' | grep -v 'q?gsd' | grep -v 'nForma-AI/QGSD' | grep -v 'formerly\|renamed\|old name\|was QGSD' | wc -l` returns 0
3. `node bin/install.js --claude --global` completes without errors
4. `node --test` passes for all test files
5. `cat ~/.claude.json | grep 'nf-prompt'` shows hook registration
</verification>

<success_criteria>
- Zero qgsd-prefixed filenames in live code directories (bin/, hooks/, agents/, core/, templates/, src/)
- Zero qgsd content references in live code except backward-compat regex patterns
- Installer correctly targets ~/.claude/nf/ and registers nf-* hooks
- All tests pass
- All 48 command files use `name: nf:*` syntax
- All subagent_type values use nf-* prefix
- All workflow/template path references use ~/.claude/nf/
</success_criteria>

<output>
After completion, create `.planning/quick/186-full-qgsd-to-nforma-rebrand-rename-all-r/186-SUMMARY.md`
</output>
