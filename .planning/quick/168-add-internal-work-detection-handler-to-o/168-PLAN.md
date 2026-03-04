---
phase: quick-168
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/observe-handler-internal.cjs
  - bin/observe-handlers.cjs
  - commands/qgsd/observe.md
autonomous: true
formal_artifacts: none
requirements: [INTERNAL-OBSERVE-01]

must_haves:
  truths:
    - "Running /qgsd:observe surfaces unfinished quick tasks (have PLAN.md but no SUMMARY.md) as issues"
    - "Running /qgsd:observe surfaces stale debug sessions (quorum-debug-latest.md) as issues"
    - "Running /qgsd:observe surfaces active milestone phases with no VERIFICATION.md as issues"
    - "Internal work issues appear in observe output without any user configuration (always-on)"
    - "Step 7 routing suggests /qgsd:quick for unfinished tasks, /qgsd:debug --resume for debug, /qgsd:solve for consistency gaps"
  artifacts:
    - path: "bin/observe-handler-internal.cjs"
      provides: "Internal work detection handler returning standard observe schema"
      exports: ["handleInternal"]
    - path: "bin/observe-handlers.cjs"
      provides: "Re-exports handleInternal from handler module"
      contains: "handleInternal"
    - path: "commands/qgsd/observe.md"
      provides: "Internal handler registration, always-on injection, solve routing"
      contains: "handleInternal"
  key_links:
    - from: "bin/observe-handler-internal.cjs"
      to: ".planning/quick/*/PLAN.md and SUMMARY.md"
      via: "fs.readdirSync + fs.existsSync scan"
      pattern: "readdirSync.*quick"
    - from: "commands/qgsd/observe.md"
      to: "bin/observe-handler-internal.cjs"
      via: "registerHandler('internal', handleInternal) + unconditional source injection"
      pattern: "registerHandler.*internal"
    - from: "commands/qgsd/observe.md"
      to: "/qgsd:solve"
      via: "Step 7 routing option for internal issues"
      pattern: "qgsd:solve"
---

<objective>
Add an internal work detection handler to /qgsd:observe that scans local project state for unfinished quick tasks, unresolved debug sessions, and active milestone phases without verification. Then update observe.md to register the handler as always-on (no config needed) and add "solve" as a routing option.

Purpose: Surface internal project housekeeping issues alongside external sources (GitHub, Sentry) so nothing falls through the cracks.
Output: New handler module + updated observe skill with internal detection and solve routing.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/observe-handlers.cjs
@bin/observe-registry.cjs
@commands/qgsd/observe.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create internal work detection handler</name>
  <files>
    bin/observe-handler-internal.cjs
    bin/observe-handlers.cjs
  </files>
  <action>
Create `bin/observe-handler-internal.cjs` implementing `handleInternal(sourceConfig, options)` returning the standard observe schema `{ source_label, source_type, status, issues[] }`.

The handler scans three categories of internal work:

1. **Unfinished quick tasks**: Scan `.planning/quick/` for directories matching `{N}-{slug}/`. For each, check if `{N}-PLAN.md` exists but `{N}-SUMMARY.md` does NOT exist. Extract task number N from the directory name. For each unfinished task, create an issue:
   ```js
   {
     id: `internal-quick-${N}`,
     title: `Unfinished quick task #${N}: ${slug}`,
     severity: 'warning',
     url: '',
     age: formatAge(planStat.mtime),  // use fs.statSync on the PLAN.md
     created_at: planStat.mtime.toISOString(),
     meta: `PLAN exists, no SUMMARY`,
     source_type: 'internal',
     issue_type: 'issue',
     _route: `/qgsd:quick "${slug}"`
   }
   ```

2. **Stale debug sessions**: Check if `.planning/quick/quorum-debug-latest.md` exists. If it does, read the file and check if it contains "unresolved" or "status: open" (case-insensitive). Also check the file's mtime — if less than 7 days old, surface it. Create issue:
   ```js
   {
     id: 'internal-debug-latest',
     title: 'Unresolved debug session: quorum-debug-latest.md',
     severity: 'info',
     url: '',
     age: formatAge(stat.mtime),
     created_at: stat.mtime.toISOString(),
     meta: 'Debug session may need resolution',
     source_type: 'internal',
     issue_type: 'issue',
     _route: '/qgsd:debug --resume'
   }
   ```

3. **Active milestone phases**: Read `.planning/STATE.md`. If `Phase:` line shows a value other than "-" or "---", extract the phase identifier. Then check if `.planning/phases/{phase}/` directory exists. If it does, check if any `*-VERIFICATION.md` file exists in that directory. If no verification file exists and the phase is active, surface it:
   ```js
   {
     id: `internal-milestone-${phase}`,
     title: `Active phase ${phase} has no verification`,
     severity: 'warning',
     url: '',
     age: '',
     created_at: new Date().toISOString(),
     meta: 'Phase active in STATE.md but no VERIFICATION.md found',
     source_type: 'internal',
     issue_type: 'issue',
     _route: '/qgsd:solve'
   }
   ```

Use `path.resolve(options.projectRoot || process.cwd())` as the base directory for all scans. Wrap everything in try/catch — if any scan fails, log a warning but continue with other scans (fail-open). The handler is synchronous (returns directly, no async needed — same pattern as handleGitHub/handleBash).

**Explicit fail-open guards:**
- Before reading the debug session file content (category 2), use `fs.existsSync(debugPath)` to guard the read. Do not rely solely on try/catch — the existence check must be explicit before `fs.readFileSync`.
- When extracting the `Phase:` value from STATE.md (category 3), sanitize the phase string with `phase.replace(/[^a-z0-9-]/g, '')` before using it in any filesystem path construction (e.g., `path.join(planningDir, 'phases', phase)`). This prevents malformed STATE.md Phase values from causing path traversal or invalid path issues.

Export: `module.exports = { handleInternal };`

Then update `bin/observe-handlers.cjs`:
- Add `const { handleInternal } = require('./observe-handler-internal.cjs');` near the production handler imports (line ~411).
- Add `handleInternal` to the module.exports object.
  </action>
  <verify>
    Run `node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({ label: 'test' }, {}); console.log(JSON.stringify(r, null, 2));"` from QGSD root and confirm it returns standard schema with status "ok" and surfaces any unfinished quick tasks found.
    Run `node -e "const h = require('./bin/observe-handlers.cjs'); console.log(typeof h.handleInternal);"` and confirm it prints "function".
  </verify>
  <done>
    handleInternal scans .planning/quick/ for tasks with PLAN but no SUMMARY, checks for stale debug sessions, checks STATE.md for active unverified phases. Returns standard observe schema. Each issue includes `_route` metadata for downstream routing. Exported from both observe-handler-internal.cjs and observe-handlers.cjs.
  </done>
</task>

<task type="auto">
  <name>Task 2: Register internal handler as always-on in observe.md and add solve routing</name>
  <files>
    commands/qgsd/observe.md
  </files>
  <action>
Update `commands/qgsd/observe.md` with three changes:

1. **Step 3 — Register internal handler**: After the existing registerHandler calls (line ~68), add:
   ```javascript
   const { handleInternal } = require('./bin/observe-handlers.cjs');
   registerHandler('internal', handleInternal);
   ```

2. **Step 2 (after source loading) — Inject internal source unconditionally**: After the source config is loaded and filtered, append the internal source so it always runs regardless of config file contents or --source filter. Add this text after the `$SOURCE_FILTER` filtering paragraph:

   ```
   **Always-on internal source:** Regardless of config or filters, inject an internal work detection source:
   ```javascript
   // Inject internal scanner unconditionally (always-on, no config needed)
   const internalSource = { type: 'internal', label: 'Internal Work', issue_type: 'issue' };
   // Add to sources array if not already present and not filtered out by --source
   if (!$SOURCE_FILTER || $SOURCE_FILTER === 'internal') {
     config.sources.push(internalSource);
   }
   ```
   This ensures internal work detection runs even if observe-sources.md doesn't exist (the "no config" early-exit should still show internal issues). **Critical ordering:** Move the "no sources" early-exit check to AFTER internal source injection. The early-exit must only trigger if the sources array is empty AFTER the internal source has been injected — not before. This means the guard `if (sources.length === 0) { exit early }` must appear below the internal source injection block. Without this ordering, the observe command would exit before the internal handler ever runs when no external sources are configured.
   ```

3. **Step 7 — Add solve routing and internal-aware routing**: Update the routing section to handle internal issues. After the existing routing rules (severity-based), add:

   ```
   **Internal issue routing:**
   If the selected issue has `source_type: 'internal'` and `_route` metadata:
   - Use the `_route` value as the suggested action instead of severity-based routing
   - Example: unfinished quick task suggests `/qgsd:quick "original-slug"`, debug session suggests `/qgsd:debug --resume`

   **"solve" option:**
   If user enters "solve", run `/qgsd:solve` to address all internal consistency issues at once:
   ```
   Enter issue # to work on, "ack N" to acknowledge, "solve" for all internal issues, "all" for full details, or press Enter to skip:
   ```
   When "solve" is entered:
   - Display: `Routing all internal issues to /qgsd:solve...`
   - Invoke `/qgsd:solve`
   ```

Update the argument-hint in the frontmatter to include "internal" in the source list:
```
argument-hint: "[--source github|sentry|sentry-feedback|bash|internal] [--since 24h|7d] [--limit N]"
```
  </action>
  <verify>
    Read commands/qgsd/observe.md and confirm:
    1. `handleInternal` is imported and registered in Step 3
    2. Internal source is injected unconditionally in Step 2
    3. Step 7 includes "solve" option and internal _route-based routing
    4. argument-hint includes "internal"
  </verify>
  <done>
    observe.md registers handleInternal as always-on source that runs without configuration. Step 7 routes internal issues via _route metadata and offers "solve" command to batch-process all internal consistency issues via /qgsd:solve. The internal handler runs even when no observe-sources.md config exists.
  </done>
</task>

</tasks>

<verification>
1. `node -e "const { handleInternal } = require('./bin/observe-handler-internal.cjs'); const r = handleInternal({}, {}); console.log(r.status, r.issues.length + ' issues');"` returns "ok" with a count
2. `node -e "const h = require('./bin/observe-handlers.cjs'); console.log(Object.keys(h).filter(k => k.includes('Internal')))"` includes handleInternal
3. `grep -c 'handleInternal' commands/qgsd/observe.md` returns at least 2 (import + register)
4. `grep -c 'solve' commands/qgsd/observe.md` returns at least 2 (routing + prompt)
5. `grep 'internal' commands/qgsd/observe.md | head -3` shows source type registration
</verification>

<success_criteria>
- handleInternal scans .planning/quick/ for PLAN-without-SUMMARY tasks and surfaces them as issues
- handleInternal detects stale debug sessions and active unverified milestone phases
- Internal handler returns standard observe schema (source_label, source_type, status, issues[])
- observe.md injects internal source unconditionally (no config file entry needed)
- observe.md Step 7 offers "solve" option and routes internal issues via _route metadata
- All issues include _route metadata for skill-specific routing
</success_criteria>

<output>
After completion, create `.planning/quick/168-add-internal-work-detection-handler-to-o/168-SUMMARY.md`
</output>
