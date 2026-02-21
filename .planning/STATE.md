# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21 after v0.2 milestone complete)

**Core value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.
**Current focus:** v0.2 milestone complete — all 17 phases, 40 plans shipped. Ready for /qgsd:new-milestone.

## Current Position

Phase: Milestone v0.2 complete
Plan: N/A — milestone archived
Status: v0.2 SHIPPED — 17 phases complete, 40/40 plans, git tag v0.2.0 pushed. Milestone archived to .planning/milestones/. REQUIREMENTS.md deleted (fresh for next milestone). npm publish (RLS-04) deferred.
Last activity: 2026-02-21 — Completed quick task 31: tighten execute-phase auto-spawn resume — replace vague resume line with 3-step post-fix verification block (cap: 1 retry)

Progress: [████████████████████] 40/40 plans (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 2.5 min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-hook-enforcement | 4 | 10 min | 2.5 min |
| 02-config-mcp-detection | 4 | 38 min | 9.5 min |

**Recent Trend:**
- Last 5 plans: 5 min, 2 min, 2 min, 1 min, 12 min, 8 min, 10 min, 8 min
- Trend: stable (Phase 2 plans longer due to TDD + migration scope)

*Updated after each plan completion*

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01-hook-enforcement P01 | 5 min | 3 tasks | 3 files |
| Phase 01-hook-enforcement P02 | 2 min | 1 task | 1 file |
| Phase 01-hook-enforcement P03 | 2 min | 2 tasks | 2 files |
| Phase 01-hook-enforcement P04 | 1 min | 2 tasks | 2 files |
| Phase 01-hook-enforcement P05 | 1 min | 2 tasks | 0 files |
| Phase 02-config-mcp-detection P01 | 12 min | 2 tasks | 4 files |
| Phase 02-config-mcp-detection P02 | 10 min | 1 task | 2 files |
| Phase 02-config-mcp-detection P03 | 8 min | 1 task | 1 file |
| Phase 02-config-mcp-detection P04 | 8 min | 3 tasks | 2 files |
| Phase 03-installer-distribution P01 | 1 min | 2 tasks | 2 files |
| Phase 03-installer-distribution P02 | 1 min | 4 tasks | 1 file |
| Phase 04-narrow-quorum-scope P01 | 8 min | 1 task (TDD) | 2 files |
| Phase 04-narrow-quorum-scope P02 | 1 min | 1 task | 1 file |
| Phase 07-enforcement-config-integration P01 | 8 min | 2 tasks (TDD) | 2 files |
| Phase 07-enforcement-config-integration P02 | 10 min | 2 tasks (TDD) | 2 files |
| Phase 08-installer-integration P01 | 2 | 3 tasks | 2 files |
| Phase 09-verify-phases-5-6 P01 | 5 min | 1 task (verify) | 1 file |
| Phase 09-verify-phases-5-6 P03 | 2 | 3 tasks | 2 files |
| Phase 13-circuit-breaker-oscillation-resolution-mode P01 | 2 min | 3 tasks | 3 files |
| Phase 13-circuit-breaker-oscillation-resolution-mode P02 | 3 min | 2 tasks | 2 files |
| Phase 10-fix-bugs-verify-phases-7-8 P01 | 3 min | 3 tasks | 2 files |
| Phase 10-fix-bugs-verify-phases-7-8 P02 | 5 min | 1 task (verify) | 1 file |
| Phase 10-fix-bugs-verify-phases-7-8 P03 | 4 min | 1 task (verify) | 1 file |
| Phase 10-fix-bugs-verify-phases-7-8 P04 | 2 min | 2 tasks | 3 files |
| Phase 11-changelog-build P01 | 3 min | 1 task | 1 file |
| Phase 11-changelog-build P02 | 3 min | 2 tasks | 6 files |
| Phase 12-version-publish P01 | 2 min | 3 tasks | 2 files |
| Phase 14-activity-tracking P01 | 2min | 2 tasks | 2 files |
| Phase 14-activity-tracking P02 | 2 | 2 tasks | 2 files |
| Phase 14-activity-tracking P03 | 3 min | 3 tasks | 8 files |
| Phase 14-activity-tracking P04 | 1 min | 2 tasks | 3 files |
| Phase 17-fix-installed-agent-name-typos P01 | 2 | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Architecture: UserPromptSubmit injection + Stop hook gate (three-model quorum consensus: Claude + Codex + OpenCode)
- Hook installation: Write to ~/.claude/settings.json directly — never via plugin hooks.json (confirmed Claude Code bug #10225 silently discards plugin UserPromptSubmit output)
- Fail-open: When a model is unavailable, proceed with available models and note reduced quorum (matches CLAUDE.md R6)
- Global install only: No per-project install in v1 — matches GSD's behavior
- [Phase 01-hook-enforcement]: Config file named qgsd.json for stop hook; matches PLAN.md artifact spec; Phase 2 CONF-01 may rename
- [Phase 01-hook-enforcement]: buildCommandPattern() extracted in REFACTOR to build quorum command regex once and reuse across hasQuorumCommand and extractCommand
- [Phase 01-hook-enforcement P02]: UserPromptSubmit hook uses ~/.claude/qgsd.json (same file as stop hook); loadConfig() returns null on missing/malformed so caller controls fallback
- [Phase 01-hook-enforcement P02]: Anchored regex ^\\s*\\/qgsd:(cmd)(\\s|$) with mandatory /qgsd: prefix matches stop hook pattern exactly — no optional (gsd:)? group
- META behavior (META-01/02/03): discuss-phase question auto-resolution is satisfied structurally — /qgsd:discuss-phase is in the QGSD hook allowlist, so quorum runs before output delivery. Only questions without consensus are escalated to the user; auto-resolved questions are presented as assumptions first. This is enforced by hooks, not by behavioral instruction.
- [Phase 01-hook-enforcement]: Build wiring: qgsd-prompt.js and qgsd-stop.js added to HOOKS_TO_COPY in build-hooks.js; installer registers both in settings.json with idempotency guards
- [Phase 01-hook-enforcement]: Task 1 produces no git commit because installation targets ~/.claude/ outside repo and hooks/dist/ is gitignored; wiring committed in Plan 04
- [Phase 01-hook-enforcement gap closure]: STOP-05 fast-path omitted by design — last_assistant_message substring matching is not a reliable signal (Claude could summarize results in prose without naming tool prefixes); transcript JSONL is the authoritative and sole source of quorum evidence. Requirement revised to match implementation. (quorum consensus: Claude + Codex + Gemini; OpenCode unavailable)
- [Phase 02-config-mcp-detection P01]: Shallow merge chosen for config layering — project `required_models` fully replaces global; no deep merge. This is intentional: a project that needs only one model should be able to declare that without merging global model list.
- [Phase 02-config-mcp-detection P01]: TC1 in config-loader.test.js adjusted — cannot assert deepEqual to DEFAULT_CONFIG when real ~/.claude/qgsd.json exists on test machine; asserts valid config shape instead
- [Phase 02-config-mcp-detection P02]: QGSD_CLAUDE_JSON env var for testing getAvailableMcpPrefixes() without mutating real ~/.claude.json — production always reads real file
- [Phase 02-config-mcp-detection P02]: KNOWN LIMITATION: getAvailableMcpPrefixes() only reads ~/.claude.json (user-scoped); project-scoped .mcp.json not checked — quorum models are global tools in practice
- [Phase 02-config-mcp-detection P03]: QGSD_KEYWORD_MAP named with QGSD_ prefix to avoid collision in 1874-line install.js; quorum_instructions generated from detected prefixes (not template copy) to prevent behavioral/structural mismatch when servers are renamed
- [Phase 02-config-mcp-detection P04]: REQUIREMENTS.md MCP-01 path corrected (settings.json → ~/.claude.json verified live); CONF-03/MCP-03 field name corrected (quorum_models → required_models, approved divergence)
- [Phase 03-installer-distribution planning]: Edit package.json in-place (no separate qgsd-specific file) — rename to 'qgsd', version 0.1.0, keep get-shit-done-cc bin entry for backward compat, add peerDependencies
- [Phase 03-installer-distribution planning]: INST-05 validation runs on every install (not just first-time) — per-model yellow warning, fail-open always (quorum: Claude + Codex + Gemini + OpenCode)
- [Phase 03-installer-distribution planning]: hooks/dist/ is STALE (Phase 2 not built to dist yet; config-loader.js missing from dist) — Plan 03-03 must run build:hooks before verify
- [Phase 03-installer-distribution planning]: SYNC-04 pre-verified — QGSD hooks import only Node stdlib and ./config-loader; zero GSD source imports confirmed
- [Phase 03-installer-distribution P03]: hooks/dist/ was STALE at plan start (config-loader.js missing — Phase 2 not propagated); build:hooks must run before any npm pack or install verification
- [Phase 03-installer-distribution P03]: Human checkpoint approved 2026-02-20; multi-model consensus (Codex + Gemini + OpenCode) all returned PASS — all 11 Phase 3 requirements satisfied
- [Phase 03-installer-distribution P03]: INST-03/INST-04/INST-07 marked complete — settings.json direct write (Phase 1), idempotency guards (Phase 1+2), per-project config honored via two-layer merge (Phase 2)
- [Phase 03-installer-distribution planning]: CHANGELOG.md update (not create) — file already exists at repo root in Keep-a-Changelog format
- [Phase 03-installer-distribution P02]: warnMissingMcpServers() reads QGSD_KEYWORD_MAP directly — warning set stays in sync with detection set automatically without separate maintenance
- [Phase 03-installer-distribution P02]: INST-06 catch block falls back to original 'already exists — skipping' message for malformed qgsd.json (safe degradation)
- [Phase 04-narrow-quorum-scope P01]: GUARD 5 position: after GUARD 4 (hasQuorumCommand) but before findQuorumEvidence — quorum command is prerequisite; decision turn is the narrowing gate
- [Phase 04-narrow-quorum-scope P01]: hasArtifactCommit requires BOTH gsd-tools.cjs commit AND artifact pattern in same Bash block — prevents false positives from ls/cat/grep mentioning artifact names
- [Phase 04-narrow-quorum-scope P01]: DECISION_MARKER = '<!-- GSD_DECISION -->' defined at module level as constant for consistency between detection and future injection
- [Phase 04-narrow-quorum-scope P02]: DEFAULT_QUORUM_INSTRUCTIONS_FALLBACK only — users with custom quorum_instructions in qgsd.json bypass step 5; acceptable per fail-open philosophy
- [Phase 04-narrow-quorum-scope P02]: Injection mechanism (hookSpecificOutput.additionalContext, cmdPattern, config-loading) unchanged; only the fallback string content was modified
- [Phase 04-narrow-quorum-scope P01]: TC6/TC9/TC12 updated (step 1a) to include artifact commit signals — preserves decision:block invariant after GUARD 5 is added
- [Phase 07-01]: circuit_breaker sub-key validation is independent — oscillation_depth and commit_window each get their own validation branch, own default, and own stderr warning; shallow merge carries circuit_breaker through automatically (CONF-09)
- [Phase 07-01]: Undefined fill-in step handles TC-CB6 (partial project config with only oscillation_depth set): after range checks, missing optional sub-keys get assigned defaults
- [Phase 07-02]: hookSpecificOutput deny format is CRITICAL: { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason } } — { "decision": "block" } silently allows the command
- [Phase 07-02]: loadConfig(gitRoot) called AFTER active-state branch — config only needed for detection; when already blocked, config cost is unnecessary
- [Phase 07-02]: Read-only commands always pass even during active block — diagnostic ops (git log, grep, cat) must remain available for root cause analysis workflow
- [v0.2 roadmap]: Circuit breaker hook is a new file hooks/qgsd-circuit-breaker.js (PreToolUse on Bash); uses existing config-loader.js; state at .claude/circuit-breaker-state.json (project-relative)
- [v0.2 roadmap revision]: RECV-01 moved from Future to Phase 8 — deadlock fix; npx qgsd --reset-breaker clears state file; consensus Gemini+OpenCode+Copilot. DETECT-03 clarified to strict set equality (not intersection). ENFC-03 updated to explicitly instruct user to manually commit the fix.
- [quick-4 scoring]: CLAUDE.md gitignored by project design — R8 rule applied to disk only, no git commit (matches quick-2/R3.6 precedent); scoreboard at .planning/quorum-scoreboard.md committed separately
- [quick-4 scoring]: Improvement Accepted rows recorded as separate round log entries (not merged with TP row) to allow independent point visibility per round
- [Phase 08-installer-integration]: --reset-breaker uses process.cwd() for state file path (project-relative, not global dir)
- [Phase 08-installer-integration]: PreToolUse registration inside !isOpencode guard — circuit breaker is Claude Code-only in v0.2; timeout:10 (lighter than Stop hook's 30)
- [Phase 08-installer-integration]: Reinstall backfill checks only top-level circuit_breaker key presence — user-modified sub-keys never touched
- [v0.3 roadmap]: Phases 11-12 added for Release Preparation. Phase 11 (Changelog & Build) covers CL-01, CL-02, BLD-01, BLD-02. Phase 12 (Version & Publish) covers RLS-01, RLS-02, RLS-03, RLS-04. Phase 11 depends on Phase 10; Phase 12 depends on Phase 11.
- [Phase 09-01 verification]: gsd-tools verify artifacts/key-links returned parse errors (frontmatter format mismatch) — fell back to manual grep verification; results are equivalent and independently confirmed. Phase 5 verified PASSED (4/4 truths, 5/5 artifacts, 2/2 key links).
- [Phase 09-01 verification]: hooks/dist/ is gitignored — dist files are not in git history; their on-disk state is authoritative; source-to-dist diff confirms GAP-01 closure.
- [Phase 09-verify-phases-5-6]: Gate confirmed: 06-VERIFICATION.md status passed before REQUIREMENTS.md modified — no speculative updates
- [Phase 13-circuit-breaker-oscillation-resolution-mode]: CB-TC17 assertion updated from 'root cause' to 'Oscillation Resolution Mode per R5' — old Required Actions block was replaced by R5 reference; test updated to match
- [Phase 13-circuit-breaker-oscillation-resolution-mode]: hookSpecificOutput JSON format unchanged — only permissionDecisionReason string content modified with commit graph table + R5 reference
- [Phase 13-01]: CLAUDE.md is gitignored by project design — R5 oscillation resolution mode update applied to disk only (consistent with quick-4 precedent)
- [Phase 13-01]: Environmental file fast-path in R5.2: config/lock files skip quorum entirely and escalate directly to user — structural diagnosis not applicable to external dependency oscillations
- [Phase 13-01]: ORES requirements defined as pending (not implemented yet) — Phase 13 plans will implement the actual hook behavior changes
- [Phase 13-02]: buildBlockReason() renders commit_window_snapshot as markdown table; graceful fallback to "(commit graph unavailable)" when snapshot absent or empty; hookSpecificOutput structure unchanged
- [Phase 13-02]: require.main === module guard + module.exports — standard pattern for testable Node CLI hook files; allows unit tests to call buildBlockReason() directly without stdin/process.exit
- [Phase 10]: ENFC-03: Phase 13 updated block reason to 'Oscillation Resolution Mode per R5' — requirement satisfied as R5 IS the root cause procedure
- [Phase 10]: Test count 141 vs 138: Phase 8 and Phase 13 added tests; 141 all green, no regressions
- [Phase 10]: INST-08 uninstall fix: added PreToolUse removal block to uninstall() mirroring existing Stop/UserPromptSubmit pattern
- [Phase 10]: RECV-01 fix: --reset-breaker uses git rev-parse --show-toplevel with process.cwd() fallback — consistent with how qgsd-circuit-breaker.js resolves gitRoot
- [Phase 10]: INST-10 fix: sub-key backfill uses === undefined check (not falsy) to preserve user-set values including potentially 0; validateConfig() handles validation at runtime
- [Phase 14-activity-tracking]: activity-set always overwrites updated with new Date().toISOString() for timestamp consistency — caller values are discarded
- [Phase 14-activity-tracking]: activity-get returns {} on missing file (not an error) — resume-work can safely call without checking file existence first
- [Phase 14-activity-tracking]: Activity tracking in execute-phase: variable names ${PHASE_NUMBER} (existing), ${PLAN_FILE}/${WAVE_N}/${DEBUG_ROUND} introduced; prose instruction blocks format matching workflow style
- [Phase 14-03]: quorum activity-set added in Step 8.5 (new section) in plan-phase — most accurate point where per-R3 quorum runs before user output; oscillation-resolution-mode.md does NOT get activity-clear as circuit_breaker states persist until parent workflow completes
- [Phase Phase 14-04]: activity-get called in initialize step before state routing — HAS_ACTIVITY flag available to all downstream steps; routing table maps 13 sub_activity values to recovery commands; HAS_ACTIVITY=false is silent (graceful degradation when no interruption)
- [Phase 16-verify-phase-15]: INT-02 fix (planning row disambiguation) included in Phase 16 scope — routing table now fully unambiguous with all ambiguous sub_activity values carrying (activity=X) qualifiers; disk-only update to installed resume-project.md per project convention (outside git repo)
- [Phase 17-fix-installed-agent-name-typos]: Installed files corrected disk-only (no git commit) — consistent with project convention for ~/.claude/qgsd/ files

### Roadmap Evolution

- Phase 4 added: Narrow quorum scope to project decisions only
- Phase 5 added: Fix GUARD 5 delivery gaps
- Phases 6–8 added: v0.2 Anti-Oscillation Pattern (circuit breaker structural enforcement)
- Phases 9–10 added: v0.3 gap closure (verification of v0.2 work)
- Phases 11–12 added: v0.3 Release Preparation (changelog, build, version bump, npm publish)
- Phase 13 added: circuit-breaker oscillation resolution mode

### Pending Todos

- `2026-02-20-add-gsd-quorum-command-for-consensus-answers.md` — Add qgsd:quorum command for consensus answers (area: planning)

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 1 | Rebrand project to QGSD: Quorum Gets Shit Done | 2026-02-20 | f55eebf | | [1-rebrand-project-to-qgsd-quorum-gets-shit](./quick/1-rebrand-project-to-qgsd-quorum-gets-shit/) |
| 2 | Add R3.6 — Iterative Improvement Protocol to CLAUDE.md | 2026-02-21 | ff20e54 | Verified | [2-in-qgsd-if-a-quorum-approved-a-plan-but-](./quick/2-in-qgsd-if-a-quorum-approved-a-plan-but-/) |
| 3 | Replace human test checkpoints with /qgsd:quorum-test; create /qgsd:debug command | 2026-02-21 | 8a1f5df | Verified | [3-replace-human-test-checkpoints-with-qgsd](./quick/3-replace-human-test-checkpoints-with-qgsd/) |
| 4 | Quorum agent scoring: TP/TN/FP/FN schema, weighted scoreboard per model | 2026-02-21 | b075c01 | Verified | [4-quorum-agent-scoring-track-initial-votes](./quick/4-quorum-agent-scoring-track-initial-votes/) |
| 4 | Quorum agent scoring: track initial votes vs final consensus (TP/TN/FP/FN + improvement rates) | 2026-02-21 | 177c2c1 | Verified | [4-quorum-agent-scoring-track-initial-votes](./quick/4-quorum-agent-scoring-track-initial-votes/) |
| 5 | qgsd:quorum-test pre-flight validation — validate artifact collection before running tests | 2026-02-21 | 072c755 | Verified | [5-an-qgsd-quorum-test-should-probably-firs](./quick/5-an-qgsd-quorum-test-should-probably-firs/) |
| 6 | Build checkpoint:verify flow into qgsd:execute-phase with debug loop and escalation | 2026-02-21 | 8b4d4ad | Verified | [6-build-checkpoint-verify-flow-into-qgsd-e](./quick/6-build-checkpoint-verify-flow-into-qgsd-e/) |
| 7 | Update docs/USER-GUIDE.md Execution Wave Coordination diagram with checkpoint:verify pipeline | 2026-02-21 | 6cffc3f | Verified | [7-update-docs-user-guide-md-with-checkpoin](./quick/7-update-docs-user-guide-md-with-checkpoin/) |
| 8 | Update qgsd-stop.js and qgsd-prompt.js to recognize /qgsd: prefix; fix fallback to /qgsd:plan-phase | 2026-02-21 | 2e201c6 | Verified | [8-update-qgsd-stop-js-and-qgsd-prompt-js-t](./quick/8-update-qgsd-stop-js-and-qgsd-prompt-js-t/) |
| 11 | Change GSD ASCII art banner to QGSD with Q in salmon; update tagline to "Quorum Gets Shit Done" | 2026-02-21 | 3819d38 | Verified | [11-change-gsd-ascii-art-to-qgsd-with-q-in-a](./quick/11-change-gsd-ascii-art-to-qgsd-with-q-in-a/) |
| 9 | Update active policy docs: replace /gsd: with /qgsd: in REQUIREMENTS.md, STATE.md, PROJECT.md, 01-05-PLAN.md, quorum todo | 2026-02-21 | c50cebe | Verified | [9-make-sure-that-qgsd-wil-now-use-qgsd-com](./quick/9-make-sure-that-qgsd-wil-now-use-qgsd-com/) |
| 10 | Review all docs for QGSD framework sync: add /qgsd:quorum-test to tables, fix GSD prose in README + CHANGELOG | 2026-02-21 | 4066bb4 | Verified | [10-review-all-docs-for-qgsd-framework-sync-](./quick/10-review-all-docs-for-qgsd-framework-sync-/) |
| 12 | Fix qgsd:debug to auto-proceed when quorum reaches consensus instead of asking user permission | 2026-02-21 | a39d422 | Verified | [12-fix-qgsd-debug-to-auto-proceed-when-quor](./quick/12-fix-qgsd-debug-to-auto-proceed-when-quor/) |
| 12 | Fix /qgsd:debug Step 7 to auto-execute consensus next step instead of user-permission gate | 2026-02-21 | a39d422 | Verified | [12-fix-qgsd-debug-to-auto-proceed-when-quor](./quick/12-fix-qgsd-debug-to-auto-proceed-when-quor/) |
| 14 | Add Circuit Breaker & Oscillation Resolution diagram to docs/USER-GUIDE.md | 2026-02-21 | b637f65 | Complete | [14-add-oscillation-resolution-mode-diagram-](./quick/14-add-oscillation-resolution-mode-diagram-/) |
| 15 | Rename gsd-statusline.js, gsd-check-update.js, gsd-file-manifest.json to qgsd-* namespace | 2026-02-21 | 061df09 | Complete | [15-rename-shared-gsd-files-to-qgsd-to-elimi](./quick/15-rename-shared-gsd-files-to-qgsd-to-elimi/) |
| 16 | Improve discuss-phase skill with quorum pre-filter: add quorum_filter step, auto-resolve classification, preference questions with Claude recommendations | 2026-02-21 | 9a33365 | Complete | [16-improve-discuss-phase-skill-with-quorum-](./quick/16-improve-discuss-phase-skill-with-quorum-/) |
| 18 | Clarify Claude as full voting quorum member in CLAUDE.md Appendix table, R3.2 step 1, and scoreboard Notes | 2026-02-21 | disk-only | Complete | [18-clarify-claude-as-full-quorum-member-wit](./quick/18-clarify-claude-as-full-quorum-member-wit/) |
| 17 | Add quorum gate inside map-codebase workflow: quorum validates mapper docs before finalization | 2026-02-21 | 1be247d | Complete (quorum override) | [17-add-quorum-gate-inside-map-codebase-work](./quick/17-add-quorum-gate-inside-map-codebase-work/) |
| 19 | Fix Stop hook false positive on new-project: XML-tag-first command matching in hasQuorumCommand/extractCommand | 2026-02-21 | 02b73bf | Complete | [19-fix-stop-hook-false-positive-on-new-proj](./quick/19-fix-stop-hook-false-positive-on-new-proj/) |
| 20 | Create qgsd-quorum-orchestrator + qgsd-oscillation-resolver agents; recolor qgsd-quorum-test-worker to magenta | 2026-02-21 | disk-only | Verified | [20-create-qgsd-quorum-orchestrator-qgsd-osc](./quick/20-create-qgsd-quorum-orchestrator-qgsd-osc/) |
| 21 | Fix QGSD gaps: add Copilot to required_models, quick to quorum_commands, Step 5.7 quorum gate in quick.md | 2026-02-21 | 3306a9e | Complete | [21-fix-qgsd-gaps-add-copilot-to-required-mo](./quick/21-fix-qgsd-gaps-add-copilot-to-required-mo/) |
| 22 | Update orchestrator r8_scoreboard compact row format + quorum.md round-evolution display | 2026-02-21 | disk-only | Verified | [22-update-both-files-scoreboard-write-logic](./quick/22-update-both-files-scoreboard-write-logic/) |
| 23 | Insert r4_pre_filter step into discuss-phase workflow between analyze_phase and present_gray_areas | 2026-02-21 | 646a412 | Verified | [23-add-the-r4-pre-filter-step-to-the-discus](./quick/23-add-the-r4-pre-filter-step-to-the-discus/) |
| 24 | Canonicalize quorum pattern: role visibility (CONTRARIAN/AGREEING/IMPROVING), improvement round in debug.md, auto-execute gate | 2026-02-21 | 0a9b773 | Complete | [24-improve-qgsd-debug-quorum-discussion-flo](./quick/24-improve-qgsd-debug-quorum-discussion-flo/) |
| 25 | Convert quorum scoreboard from markdown to JSON with bin/update-scoreboard.cjs script | 2026-02-21 | 30078e8 | Complete | [25-convert-quorum-scoreboard-from-markdown-](./quick/25-convert-quorum-scoreboard-from-markdown-/) |
| 25 | Convert quorum scoreboard from markdown to JSON with CLI script (update-scoreboard.cjs) | 2026-02-21 | d24f1ad | Complete | [25-convert-quorum-scoreboard-from-markdown-](./quick/25-convert-quorum-scoreboard-from-markdown-/) |
| 26 | apply two copy tweaks to Ping-Pong Commit Breaker section in README and USER-GUIDE | 2026-02-21 | 2e761d2 | Complete | [26-apply-two-copy-tweaks-to-ping-pong-commi](./quick/26-apply-two-copy-tweaks-to-ping-pong-commi/) |
| 27 | Compact quorum.md output format: 1-sentence summaries, tighter banners, no supporting positions block | 2026-02-21 | 2f8ba26 | Complete | [27-compact-quorum-md-output-format-1-line-m](./quick/27-compact-quorum-md-output-format-1-line-m/) |
| 28 | Rename gsd-integration-checker to qgsd-integration-checker in MODEL_PROFILES | 2026-02-21 | e2974fe | Complete | [28-rename-gsd-integration-checker-to-qgsd-i](./quick/28-rename-gsd-integration-checker-to-qgsd-i/) |
| 29 | Make executor auto-proceed with CI failures revealed by a masking fix (SCOPE BOUNDARY exception) | 2026-02-21 | 1c12561 | Complete | [29-make-executor-auto-proceed-with-ci-failu](./quick/29-make-executor-auto-proceed-with-ci-failu/) |
| 30 | fix execute-phase orchestrator CI failure gate: auto-spawn quick task when executor SUMMARY.md has diagnosed root causes | 2026-02-21 | f13a22d | Complete | [30-fix-execute-phase-orchestrator-ci-failur](.planning/quick/30-fix-execute-phase-orchestrator-ci-failur/) |
| 31 | Tighten execute-phase auto-spawn resume: replace vague resume line with post-fix verification block (cap: 1 retry) | 2026-02-21 | 845e627 | Complete | [31-tighten-execute-phase-auto-spawn-resume-](./quick/31-tighten-execute-phase-auto-spawn-resume-/) |

### Blockers/Concerns

- [Phase 1 carry-forward] Integration test: `stop_hook_active` behavior on second Stop invocations with GSD subagents must be empirically confirmed against live Claude Code runtime — documented behavior but not end-to-end tested
- [Phase 2 carry-forward] KNOWN LIMITATION: getAvailableMcpPrefixes() only reads ~/.claude.json (user-scoped MCPs). Project-scoped MCPs configured in .mcp.json are not checked — Phase 3 / future work to extend
- [Phase 3 blocker resolved] Human Check 6 confirmed live quorum enforcement works end-to-end — Stop hook blocks and passes correctly in real Claude Code session

## Session Continuity

Last session: 2026-02-21
Stopped at: quick-31 complete — replaced vague resume line with post-fix verification block (cap: 1 retry) in execute-phase auto-spawn mechanism (source + installed)
Resume file: None
