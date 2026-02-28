---
phase: quick-119
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - docs/USER-GUIDE.md
autonomous: true
requirements: [DOCS-119]

must_haves:
  truths:
    - "Every command that exists in commands/qgsd/ appears in the README Commands table"
    - "All active hooks (Stop, PreToolUse, PostToolUse, SessionStart, PreCompact, SubagentStop) are described in README"
    - "Token efficiency features (tiered sizing, task envelope, adaptive fan-out, health token display) are documented"
    - "Autonomous milestone execution capability (v0.13 zero-AskUserQuestion loop) is documented"
    - "USER-GUIDE.md Command Reference includes triage and queue commands"
  artifacts:
    - path: "README.md"
      provides: "Updated commands table, hooks section, token efficiency section, autonomous execution note"
    - path: "docs/USER-GUIDE.md"
      provides: "Updated command reference with triage and queue entries"
  key_links:
    - from: "README.md Commands table"
      to: "commands/qgsd/*.md"
      via: "Manual cross-check — every .md file in commands/qgsd/ must appear"
---

<objective>
Update README.md and docs/USER-GUIDE.md to reflect all features built since the last
documentation pass — specifically the hooks ecosystem (4 new hooks), token efficiency
system (v0.18), autonomous milestone loop (v0.13), Nyquist validation layer (v0.9-02),
and two undocumented commands (triage, queue).

Purpose: Users reading README discover everything QGSD actually does. Commands that exist
but aren't listed make features invisible and undermine discoverability.

Output: README.md and docs/USER-GUIDE.md updated — no missing commands, no missing hooks,
no missing capability sections.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@README.md
@docs/USER-GUIDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add missing commands to README and USER-GUIDE</name>
  <files>README.md, docs/USER-GUIDE.md</files>
  <action>
    Two commands exist in commands/qgsd/ but are absent from the README Commands table:
    - `/qgsd:triage [--source github|sentry|sentry-feedback|bash] [--since 24h|7d] [--limit N]`
      What it does: Fetches issues/errors from configured sources (GitHub, Sentry, custom),
      deduplicates, renders a prioritized triage table, and routes selected issues to QGSD
      workflows. Requires .planning/triage-sources.md to configure sources.
    - `/qgsd:queue <command>`
      What it does: Queues a command to auto-invoke after the next /clear. Writes a
      session-scoped pending-task file so the queued command runs on the next prompt
      after clearing context.

    In README.md:
    1. Find the "### Utilities" table in the Commands section (around line 769)
    2. Add `/qgsd:triage` row to Utilities table:
       `| /qgsd:triage [--source github|sentry|bash] [--since 24h|7d] | Fetch and prioritize issues from GitHub, Sentry, or custom sources; route selected issue to QGSD workflow |`
    3. Add `/qgsd:queue <command>` row to Utilities table:
       `| /qgsd:queue <command> | Queue a command to auto-invoke after the next /clear — survives context compaction |`

    In docs/USER-GUIDE.md:
    1. Find the Command Reference section
    2. Add triage and queue entries with their argument hints and brief description matching
       the pattern used for other commands in that file.

    Do not alter any other sections. Minimal targeted edits only.
  </action>
  <verify>
    grep -n "qgsd:triage" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "qgsd:queue" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "qgsd:triage" /Users/jonathanborduas/code/QGSD/docs/USER-GUIDE.md
  </verify>
  <done>
    Both /qgsd:triage and /qgsd:queue appear in the README Commands table and in
    the USER-GUIDE.md command reference.
  </done>
</task>

<task type="auto">
  <name>Task 2: Document the full hooks ecosystem in README</name>
  <files>README.md</files>
  <action>
    The README currently mentions the Stop hook and PreToolUse circuit breaker hook in
    "How It Works," but four other active hooks are completely undocumented:

    1. **Context Window Monitor** (PostToolUse, gsd-context-monitor.js, v0.9-01)
       - Fires after every tool use, reads context_window metrics from the payload
       - Injects WARNING into additionalContext at 70% usage, CRITICAL at 90%
       - Configurable via `context_monitor.warn_pct` / `context_monitor.critical_pct` in qgsd.json

    2. **Session Start Hook** (SessionStart, qgsd-session-start.js)
       - Fires once per Claude Code session startup
       - Syncs QGSD keychain secrets into ~/.claude.json (bootstrap write-through)
       - Zero macOS keychain prompts during normal sessions after first bootstrap

    3. **PreCompact Hook** (PreCompact, qgsd-precompact.js, quick task 117)
       - Fires before Claude Code compacts the context window
       - Reads STATE.md "Current Position" section and any pending task files
       - Injects current position into additionalContext so it survives compaction
       - Enables seamless continuation after automatic context compaction

    4. **Token Collector** (SubagentStop, qgsd-token-collector.js, v0.18-01)
       - Fires when a quorum slot-worker sub-agent finishes
       - Reads agent_transcript_path, sums message.usage fields per-slot
       - Appends structured records to .planning/token-usage.jsonl
       - Data surfaced in /qgsd:health ranked token consumption view

    Find the "Ping-Pong Commit Loop Breaker" section in README (which documents the
    circuit breaker / PreToolUse hook). After the existing circuit breaker content and
    before the "Atomic Git Commits" section, add a new subsection:

    ### Hooks Ecosystem

    QGSD installs six Claude Code hooks that fire at different lifecycle points:

    | Hook Type | File | When it fires | What it does |
    |-----------|------|---------------|--------------|
    | UserPromptSubmit | qgsd-prompt.js | Every user message | Injects quorum instructions at planning turns |
    | Stop | qgsd-stop.js | Before Claude delivers output | Verifies quorum actually happened by parsing the transcript; blocks non-compliant responses |
    | PreToolUse | qgsd-circuit-breaker.js | Before every tool execution | Detects ping-pong oscillation in git history; blocks Bash when breaker is active |
    | PostToolUse | gsd-context-monitor.js | After every tool execution | Monitors context usage; injects WARNING at 70%, CRITICAL at 90% |
    | SubagentStop | qgsd-token-collector.js | When a quorum slot finishes | Reads token usage from transcript and appends to token-usage.jsonl |
    | PreCompact | qgsd-precompact.js | Before context compaction | Injects current STATE.md position so context survives compaction without losing progress |
    | SessionStart | qgsd-session-start.js | Once per Claude Code session | Syncs keychain secrets into ~/.claude.json (zero prompts after bootstrap) |

    All hooks fail open — any hook error exits 0 and never blocks Claude.

    Write this new subsection with the table and the fail-open note. Keep the existing
    circuit breaker content intact above it.
  </action>
  <verify>
    grep -n "Hooks Ecosystem" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "PreCompact" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "Token Collector\|qgsd-token-collector\|SubagentStop" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "Context Window Monitor\|gsd-context-monitor\|PostToolUse" /Users/jonathanborduas/code/QGSD/README.md
  </verify>
  <done>
    README.md contains a "Hooks Ecosystem" subsection with a table covering all six hook
    types (UserPromptSubmit, Stop, PreToolUse, PostToolUse, SubagentStop, PreCompact,
    SessionStart) and a note that all hooks fail open.
  </done>
</task>

<task type="auto">
  <name>Task 3: Document token efficiency, autonomous execution, and Nyquist validation</name>
  <files>README.md</files>
  <action>
    Three significant capability areas shipped since the last documentation update but
    are absent from the README:

    **A. Token Efficiency System (v0.18)**
    QGSD ships infrastructure to reduce per-run token consumption:
    - Tiered model sizing: researcher and plan-checker sub-agents use model=haiku (15-20x
      cost reduction vs sonnet); planner retains sonnet. Configurable via
      `model_tier_planner` / `model_tier_worker` flat keys in qgsd.json.
    - Task envelope: bin/task-envelope.cjs writes task-envelope.json sidecar after
      research and planning with objective/constraints/risk_level/target_files. Quorum
      reads risk_level from envelope to avoid N * full PLAN.md re-reads per round.
    - Adaptive fan-out: quorum dispatches 2/3/max workers for routine/medium/high risk
      instead of always running at max. User --n N override preserved.
    - Token observability: /qgsd:health displays ranked per-slot token consumption from
      .planning/token-usage.jsonl.

    **B. Autonomous Milestone Execution (v0.13)**
    The milestone execution loop is fully autonomous — zero AskUserQuestion calls from
    new-milestone through complete-milestone:
    - audit-milestone auto-spawns plan-milestone-gaps when gaps found
    - All confirmation gates replaced with R3 quorum consensus
    - IS_GAP_CLOSURE detection routes gap-closure phases to re-audit automatically
    - STATE.md updated with audit result after each milestone audit

    **C. Nyquist Validation Layer (v0.9-02)**
    plan-phase generates a VALIDATION.md test-map before producing plans:
    - Lists pre-execution requirements: which tests must pass before any plan runs
    - Lists per-task test sampling: what to verify after each task in the plan
    - Configurable: nyquist_validation_enabled in qgsd.json (default true)
    - Fails open: if VALIDATION.md generation fails, plan-phase continues

    Find the "## Why It Works" section. After the "Multi-Agent Orchestration" subsection
    and before the "Ping-Pong Commit Loop Breaker" subsection, add three new subsections:

    ### Token Efficiency

    QGSD manages token consumption automatically across three mechanisms:

    **Tiered model sizing** — Researcher and plan-checker sub-agents use a smaller model
    (haiku by default) for a 15–20x cost reduction vs. using sonnet everywhere. The
    primary planner and executor retain sonnet. Configure via `model_tier_planner` and
    `model_tier_worker` keys in qgsd.json, or switch via `/qgsd:set-profile`.

    **Adaptive quorum fan-out** — Quorum dispatches fewer workers for routine tasks
    (2 workers) than for high-risk ones (max). The task envelope's `risk_level` field
    drives this automatically. Override with `--n N` in any quorum call.

    **Token observability** — The SubagentStop hook collects per-slot token usage and
    writes to `.planning/token-usage.jsonl`. Run `/qgsd:health` to see a ranked breakdown
    of token consumption by slot and stage — spot which agents are spending the most
    before it becomes a problem.

    ### Autonomous Milestone Loop

    From `/qgsd:new-milestone` through `/qgsd:complete-milestone`, the execution chain
    runs without AskUserQuestion interruptions. When audit-milestone detects gaps,
    plan-milestone-gaps is spawned automatically. All confirmation gates (plan approval,
    gap resolution, gray-area discussion) route to quorum consensus instead of pausing
    for a human. The loop only escalates when the quorum cannot reach consensus — which
    is the signal that a human judgment call is actually needed.

    Enable auto-chaining via the `workflow.auto_advance` setting.

    ### Pre-Execution Test Mapping (Nyquist)

    Before producing plans, plan-phase generates a `VALIDATION.md` test map for the
    phase — listing which tests must pass before execution starts (Wave 0) and what to
    verify after each task. This surfaces test-to-task traceability early and catches
    missing test coverage before a single line of code runs. Controlled by
    `nyquist_validation_enabled` in qgsd.json (default: true).

    Write these three subsections in order (Token Efficiency, Autonomous Milestone Loop,
    Pre-Execution Test Mapping) between Multi-Agent Orchestration and Ping-Pong Commit
    Loop Breaker. Keep all existing content intact.
  </action>
  <verify>
    grep -n "Token Efficiency" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "Autonomous Milestone Loop\|auto_advance" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "Nyquist\|VALIDATION.md\|Pre-Execution Test" /Users/jonathanborduas/code/QGSD/README.md
    grep -n "tiered\|model_tier\|adaptive.*fan-out\|token-usage" /Users/jonathanborduas/code/QGSD/README.md
  </verify>
  <done>
    README.md contains three new subsections — Token Efficiency, Autonomous Milestone
    Loop, and Pre-Execution Test Mapping — between Multi-Agent Orchestration and the
    Ping-Pong Commit Loop Breaker section. All existing content remains intact.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete:

1. Cross-check commands: count files in commands/qgsd/ and verify each has a row in README
   ```bash
   ls commands/qgsd/ | wc -l
   grep "qgsd:" README.md | grep "^|" | wc -l
   ```
   Note: some commands intentionally internal or alias — discrepancy is acceptable if
   explained. Specifically verify triage and queue are present.

2. Hooks coverage check:
   ```bash
   grep -c "PreCompact\|SubagentStop\|PostToolUse\|SessionStart\|UserPromptSubmit\|PreToolUse" README.md
   ```
   Expect 6+ matches (one per hook type in the new table).

3. Section presence check:
   ```bash
   grep -n "Token Efficiency\|Autonomous Milestone Loop\|Nyquist\|Hooks Ecosystem" README.md
   ```
   Expect all four section headers present.
</verification>

<success_criteria>
- /qgsd:triage and /qgsd:queue appear in README Commands table
- README "Hooks Ecosystem" table covers all 7 hook types with type/file/trigger/purpose
- README "Token Efficiency" section covers tiered sizing, adaptive fan-out, and token observability
- README "Autonomous Milestone Loop" section explains v0.13 zero-AskUserQuestion capability
- README "Pre-Execution Test Mapping" section explains Nyquist VALIDATION.md
- docs/USER-GUIDE.md command reference includes triage and queue entries
- All existing README content remains intact (no regressions)
</success_criteria>

<output>
After completion, create `.planning/quick/119-major-documentation-refresh-update-all-d/119-SUMMARY.md`
</output>
