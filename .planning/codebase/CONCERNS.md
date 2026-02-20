# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Claude Code classifyHandoffIfNeeded Bug Workaround:**
- Issue: Claude Code has a bug in the `classifyHandoffIfNeeded` function that causes false agent failure reports
- Files: `get-shit-done/workflows/execute-phase.md`, `get-shit-done/workflows/quick.md`, `agents/gsd-executor.md`
- Impact: Orchestrators receive failure signals even though agents completed work successfully, causing unnecessary re-execution attempts and poor UX
- Fix approach: Added spot-checking logic (v1.17.0) where workflows verify actual output before reporting failure. This is a tactical workaround—proper fix requires Claude Code SDK patch
- Current Status: Mitigated but not resolved

**Multi-Runtime Compatibility Complexity:**
- Issue: Supporting Claude Code, OpenCode, and Gemini CLI creates platform-specific quirks requiring custom handling
- Files: `bin/install.js`, `agents/gsd-executor.md`, `get-shit-done/workflows/execute-phase.md`
- Examples:
  - Gemini requires shell variable escaping (`${VAR}` → `\${VAR}`) in agent bodies (#449c5a)
  - OpenCode uses XDG Base Directory spec requiring different paths than Claude/Gemini (#0dde979)
  - Windows requires detached process spawning and HEREDOC replacement (#1344bd8, #ced41d7)
  - OpenCode converts `general-purpose` subagent type to `general`
  - Windows path normalization needed in gsd-tools (backslash handling)
- Impact: Platform-specific bugs surface slowly through community reports. Maintenance burden scales with runtime count
- Fix approach: Centralize platform detection in `bin/install.js`. Add integration tests for each runtime. Document platform-specific patterns in `INTEGRATIONS.md`

**Reverted Features (Breaking Changes):**
- Two features reverted recently:
  1. "convert Task() calls to codex exec during install" (#d55998b)
  2. "install GSD commands as prompts for '/' menu discoverability" (#e820263)
- Impact: Indicates experimental features had unintended side effects or conflicts with other components
- Fix approach: Root cause analysis needed before re-attempting these features. Document why they were reverted in code comments

## Known Bugs

**Scope Boundary and Attempt Limit Enforcement:**
- Issue: Executor could run away in infinite loops if a task repeatedly failed but never hit a checkpoint
- Files: `agents/gsd-executor.md`
- Trigger: Task with auto-fix enabled, dependency loop, or repeating logic error
- Workaround: Added scope boundary + attempt limit in executor (v1.19.2, #8b75531)
- Current Status: Fixed but indicates executor robustness needs improvement

**Settings File Corruption on Write:**
- Issue: Direct file writes could corrupt `settings.json` / `settings.local.json` on failure
- Files: `bin/install.js`, `get-shit-done/workflows/*.md`
- Impact: User configuration lost, installer state unclear
- Current Status: Fixed by using Write tool for all file creation (#c4ea358)
- Lesson: Standard `fs.writeFileSync` is unsafe for critical config — always use proper atomic writes or tool abstractions

**ROADMAP Progress Table Out of Sync:**
- Issue: Progress table showed incorrect "X/Y Complete" values because LLM was manually editing counts instead of computing from disk
- Files: `get-shit-done/workflows/complete-milestone.md`
- Impact: Misleading progress reports, impossible to know true completion state
- Current Status: Fixed (#c8827fe) by delegating to `gsd-tools roadmap update-plan-progress` which counts disk state
- Lesson: Never let agents manually edit numeric summary fields — compute from authoritative sources only

## Security Considerations

**API Keys in Codebase Analysis:**
- Risk: `/gsd:map-codebase` reads files to analyze codebase, could accidentally read `.env` or credential files
- Current mitigation: Built-in protections against committing secrets, documented in README (#234)
- Recommendations:
  - Explicitly list forbidden files in codebase mapper: `.env*`, `*.pem`, `*.key`, `credentials.*`, `secrets.*`
  - Add deny rule documentation in `docs/USER-GUIDE.md` with Claude Code settings examples
  - Consider adding a pre-flight check in mapper that warns if sensitive file patterns are found

**Commit Attribution Handling:**
- Risk: Co-Authored-By lines could be injected with malicious content if not properly escaped
- Files: `bin/install.js` (lines 279-281)
- Current mitigation: `safeAttribution.replace(/\$/g, '$$$$')` escapes backreference injection
- Status: Properly implemented but worth monitoring for regex bypass techniques

## Performance Bottlenecks

**Large File Reading in Context Assembly:**
- Problem: Some workflows embed entire file contents into prompts instead of using paths
- Files: `get-shit-done/workflows/execute-phase.md`, historical versions before v1.16
- Impact: Context bloat, slower agent startup, higher token costs
- Improvement path: Version 1.16+ delegates plan reading to subagents. Audit remaining workflows for embedded file content. Use `gsd-tools` CLI for structured data extraction instead of passing raw files

**JSON Payload Truncation in Tool Calls:**
- Problem: Large JSON responses were truncated when passed through tool call JSON serialization
- Files: `get-shit-done/bin/gsd-tools.cjs`, affected workflows
- Current Status: Fixed (#8d97732) by writing large payloads to temp files
- Lesson: Be aware of nested JSON serialization limits in tool call results — consider temp file strategy for any payload >100KB

**Nested YAML Frontmatter Parsing Complexity:**
- Problem: Parsing frontmatter with complex nested structures (`dependency-graph.provides`, `tech-stack.added`) is fragile with regex
- Files: `get-shit-done/bin/gsd-tools.cjs`
- Impact: Parser needs updates every time frontmatter structure changes
- Improvement: Consider using YAML library instead of regex for robustness

## Fragile Areas

**Phase Numbering and Renumbering System:**
- Files: `get-shit-done/bin/gsd-tools.cjs`, `get-shit-done/workflows/remove-phase.md`
- Why fragile:
  - Supports both whole numbers (1, 2, 3) and decimals (1.1, 1.2, 1.3) for phase insertion
  - Renumbering all subsequent phases is error-prone when phases contain multiple files
  - Regex-based phase header matching supports `##` and `###` and `####` but could break with different markdown styles
- Safe modification: All phase operations delegated to `gsd-tools.cjs` commands (`phase add`, `phase insert`, `phase remove`) which handle validation and renumbering atomically
- Test coverage: Needs comprehensive tests for edge cases (empty phases, phases with special characters, circular dependencies)

**Milestone Completion Archive Logic:**
- Files: `get-shit-done/bin/gsd-tools.cjs`, `get-shit-done/workflows/complete-milestone.md`
- Why fragile: Multiple data sources must be kept in sync (ROADMAP.md, REQUIREMENTS.md, VERIFICATION.md, git tags)
- Current state: v1.20.3 introduced 3-source cross-reference checking to catch orphaned requirements
- Safe modification: Use `milestone complete` command which handles all archival atomically
- Test coverage: Gaps in testing orphaned requirement scenarios

**Verifier Requirements Coverage Detection:**
- Files: `agents/gsd-verifier.md`
- Why fragile: Requirements can be referenced in multiple places (phase frontmatter, plan MUST_HAVES, verification evidence), making it easy to miss uncovered requirements
- Current state: v1.20.2 added stricter validation (requirements field in plan frontmatter, bracket syntax stripping)
- Safe modification: Always route through `requirements mark-complete` command which updates REQUIREMENTS.md traceability atomically

**Auto-Advance Checkpoint Bypass:**
- Files: `agents/gsd-executor.md`, `get-shit-done/workflows/execute-phase.md`
- Why fragile: Auto-advance mode (`workflow.auto_advance`) bypasses checkpoints by auto-approving human-verify steps and auto-selecting first option on decisions
- Risk: User automation intent could cause automatic progression through architectural decisions that should be reviewed
- Safe modification: Document that auto-advance should only be used on routine phases, not architectural ones. Add prompt confirmation before executing architecture checkpoints in auto mode

## Scaling Limits

**Agent Context Window Optimization:**
- Current capacity: Executor uses 200k token context per plan, orchestrator stays at 30-40%
- Limit: Projects with >10 plans per phase risk context starvation in orchestrator
- Scaling path:
  1. Further optimize orchestrator by delegating more work to gsd-tools
  2. Implement plan batching for phases with many small independent tasks
  3. Consider spillover to separate orchestration agents if phase plan count exceeds 15

**Wave Execution Dependency Graph Complexity:**
- Current capacity: Handles simple dependency chains (Plan A → B → C)
- Limit: Complex multi-node dependency graphs could require sophisticated topological sort
- Current implementation: Simple wave grouping using `depends_on` field
- Scaling path: If dependency graphs become complex, implement proper DAG solver instead of wave-based approach

**File System Lookup Performance:**
- Current approach: Multiple filesystem walks across `.planning/` directory to discover plans, phases, todos
- Impact: Projects with 50+ phases and 200+ total plans might see measurable slowdown in initialization
- Scaling path: Implement `.planning/INDEX.json` cache (similar to `history-digest`) that caches phase/plan structure

**Markdown Parsing Fragility at Scale:**
- Current approach: Regex-based parsing of markdown headers and frontmatter
- Problem: Becomes unreliable with complex documents (ROADMAP.md >2000 lines with complex structure)
- Limit: Projects with >50 phases and detailed requirements per phase
- Scaling path: Consider YAML-only alternatives or dedicated markdown library for parsing

## Dependencies at Risk

**Node.js EOL Risk:**
- Package requirement: `node >= 16.7.0` (specified in package.json)
- Risk: Node 16 reached EOL in September 2023; Node 18 reaches EOL April 2025
- Impact: Security vulnerabilities accumulate in old runtimes
- Migration plan: Update to `node >= 18` (stable LTS) or `>= 20` (newer LTS). Document in README

**esbuild Maintenance:**
- Dependency: `"esbuild": "^24.0.0"`
- Risk: esbuild is heavily used but single-maintainer project
- Impact: Build hooks might break if esbuild changes bundle format
- Mitigation: Low-complexity hook bundles are resilient. Monitor esbuild releases. Test on each GSD update

**Hook System Execution Risk:**
- Files: `hooks/gsd-check-update.js`, `hooks/gsd-statusline.js`
- Risk: Hooks run automatically on session start. Bugs could break user's IDE integration
- Current mitigation: Hooks fail silently and log to `.planning/hook-errors.log` (if implemented)
- Recommendation: Add explicit error logging to hooks. Document hook behavior in troubleshooting section

## Missing Critical Features

**Comprehensive Hook Logging:**
- Problem: Session start hooks (`gsd-check-update`, `gsd-statusline`) run silently; failures are invisible
- Impact: Users don't know hooks failed, can't debug issues
- Blocks: Reliable auto-update and session continuation features
- Solution: Implement structured logging to `.planning/hook-errors.log` with timestamp, hook name, error details

**Integration Testing for Multi-Runtime:**
- Problem: Each of 3 runtimes (Claude Code, OpenCode, Gemini) has unique installation and execution paths
- Impact: Platform-specific bugs discovered only through production usage (slow feedback loop)
- Blocks: Confident releases, rapid iteration on runtime support
- Solution: Add integration test suite that verifies install → command execution → output on each runtime

**Deterministic Verification of Plan Execution:**
- Problem: Verifier checks code exists and tests pass, but doesn't verify behavior matches plan intent
- Impact: Some "completed" plans don't actually deliver what was promised
- Blocks: Reliable milestone audits
- Solution: Implement behavior-driven verification that cross-references plan tasks against commit diffs and execution logs

## Test Coverage Gaps

**Phase Operations Edge Cases:**
- What's not tested: Removing phases with special characters, renumbering phases after failures, inserting decimal phases that conflict with existing
- Files: `get-shit-done/bin/gsd-tools.cjs` (phase commands), `get-shit-done/bin/gsd-tools.test.cjs`
- Risk: Phase management bugs could silently corrupt ROADMAP.md and disk state
- Priority: High — phase operations are high-impact and infrequently tested in production

**Milestone Archive Atomicity:**
- What's not tested: Atomicity of milestone completion when file writes partially fail (e.g., archival succeeds but MILESTONES.md write fails)
- Files: `get-shit-done/bin/gsd-tools.cjs` (milestone complete command), `get-shit-done/workflows/complete-milestone.md`
- Risk: Milestone state could become inconsistent (marked complete but not archived)
- Priority: High — affects project state integrity

**Parallel Plan Execution Ordering:**
- What's not tested: Whether plans in the same wave execute truly in parallel when spawned, or if sequential execution in orchestrator affects results
- Files: `get-shit-done/workflows/execute-phase.md`
- Risk: Concurrent writes to same files could cause merge conflicts or data loss
- Priority: Medium — only manifests with complex multi-file plans

**Context Fidelity Enforcement:**
- What's not tested: Whether CONTEXT.md decisions are actually honored throughout execution (vs. executor making different choices)
- Files: `agents/gsd-executor.md`, `get-shit-done/templates/phase-prompt.md`
- Risk: Executor ignores user preferences, builds something different than intended
- Priority: Medium — user-visible quality issue

---

*Concerns audit: 2026-02-20*
