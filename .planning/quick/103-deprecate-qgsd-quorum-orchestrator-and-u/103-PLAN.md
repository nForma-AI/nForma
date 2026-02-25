---
phase: quick-103
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - agents/qgsd-quorum-orchestrator.md
  - commands/qgsd/quorum.md
autonomous: true
requirements: [QUICK-103]
must_haves:
  truths:
    - "qgsd-quorum-orchestrator.md has a DEPRECATED notice at the top (matching QT-101 pattern for retired workers)"
    - "commands/qgsd/quorum.md <orchestrator_delegation> block is replaced with direct parallel dispatch pattern"
    - "commands/qgsd/quorum.md dispatch banner includes Fallback pool line"
    - "commands/qgsd/quorum.md results table uses 30-char Model column with tree chars for fallback hierarchy"
    - "CLAUDE.md R3.2 contains no stale reference to spawning the orchestrator agent (dispatch is direct)"
  artifacts:
    - path: "agents/qgsd-quorum-orchestrator.md"
      provides: "Deprecated orchestrator with notice at top"
      contains: "<!-- DEPRECATED"
    - path: "commands/qgsd/quorum.md"
      provides: "Direct dispatch quorum fallback with updated banner and results table"
      contains: "Fallback pool: claude-1..claude-6"
  key_links:
    - from: "commands/qgsd/quorum.md"
      to: "agents/qgsd-quorum-slot-worker.md"
      via: "direct Task dispatch (no orchestrator intermediary)"
      pattern: "subagent_type.*qgsd-quorum-slot-worker"
---

<objective>
Deprecate the `qgsd-quorum-orchestrator` agent (same pattern QT-101 used for the old worker/synthesizer) and update the quorum dispatch UX in `commands/qgsd/quorum.md` with a fallback pool banner and wider results table showing the fallback hierarchy with tree characters.

Purpose: The orchestrator was introduced before QT-101 unified the quorum stack. Now that `quorum.md` includes a full inline fallback and slot-workers handle everything via Bash, the orchestrator is redundant. Deprecating it (rather than deleting) preserves the reference. The UX changes make it clear when claude-N slots are acting as fallbacks for unavailable primaries.

Output:
- `agents/qgsd-quorum-orchestrator.md` — deprecated notice prepended
- `commands/qgsd/quorum.md` — `<orchestrator_delegation>` replaced with direct dispatch; banner + results table updated
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/101-unified-quorum-new-slot-worker-agent-orc/101-SUMMARY.md
@.planning/quick/102-full-review-of-quick-task-101/102-SUMMARY.md
@agents/qgsd-quorum-orchestrator.md
@commands/qgsd/quorum.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Deprecate qgsd-quorum-orchestrator.md</name>
  <files>agents/qgsd-quorum-orchestrator.md</files>
  <action>
Prepend the following deprecation notice at the very top of `agents/qgsd-quorum-orchestrator.md`, BEFORE the `---` frontmatter block (line 1 of the file), matching the exact pattern used for `qgsd-quorum-worker.md` and `qgsd-quorum-synthesizer.md` in QT-101:

```
<!-- DEPRECATED: This agent is superseded by direct inline dispatch in commands/qgsd/quorum.md as of quick-103. The orchestrator Task-spawn indirection is no longer needed — quorum.md now contains the full R3 protocol inline (with qgsd-quorum-slot-worker for per-slot dispatch). Retained for reference only. Do not spawn this agent. -->
```

Leave the rest of the file untouched. The goal is a single-line HTML comment at the very top.
  </action>
  <verify>
Run: `head -2 /Users/jonathanborduas/code/QGSD/agents/qgsd-quorum-orchestrator.md`
Expected: first line is the `<!-- DEPRECATED: ...` comment, second line is `---` (start of frontmatter).
  </verify>
  <done>
`agents/qgsd-quorum-orchestrator.md` has a DEPRECATED HTML comment as its first line, identical in pattern to the QT-101 deprecation notices on qgsd-quorum-worker.md and qgsd-quorum-synthesizer.md.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace orchestrator_delegation with direct dispatch in quorum.md</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
In `commands/qgsd/quorum.md`, make two sets of changes:

**Change 1 — Replace the `<orchestrator_delegation>` block:**

Remove the entire `<orchestrator_delegation>` block (lines from `<orchestrator_delegation>` through `</orchestrator_delegation>` inclusive). Replace it with a `<dispatch_pattern>` block that documents direct dispatch (no orchestrator intermediary):

```
<dispatch_pattern>
**Execution path:** Claude runs the full R3 protocol directly in the main conversation thread.
Dispatch slot-workers via sibling Task calls (one per active slot per round).
No orchestrator intermediary — the fallback logic, round loop, and scoreboard are all inline.

Resolve the question to pass:

1. If $ARGUMENTS is non-empty → use it directly as the question/prompt.
2. If $ARGUMENTS is empty → scan the current conversation using this priority order:
   - **Priority 1** — Most recent message containing `?` without a substantive answer yet.
   - **Priority 2** — Most recent message describing a choice/trade-off (keywords: "should we", "which approach", "option A vs", "do we", "whether to").
   - **Priority 3** — Most recent open concern or blocker ("not sure", "concern", "blocker", "unclear", "wondering").
   - If none found: stop with `"No open question found. Provide one explicitly: /qgsd:quorum <question>"`

When question is inferred, display before dispatching:
```
Using conversation context as question (Priority N - [type]):
"[inferred question text]"
```
</dispatch_pattern>
```

**Change 2 — Update the Mode A dispatch banner in "Parse question" section:**

Find the existing banner block in the Mode A "Parse question" section:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Mode A — Pure Question
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]
```

Replace it with the new banner that includes the Active/Fallback lines:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► QUORUM: Round 1 — N workers dispatched
 Active: gemini-1, opencode-1, copilot-1, codex-1
 Fallback pool: claude-1..claude-6 (on UNAVAIL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Question: [question]
```
(The Active line lists the actual active slots resolved at runtime, not hardcoded names. The example above is illustrative — the executor renders it dynamically using the resolved slot list from provider pre-flight.)

**Change 3 — Update the Mode A results table (Evaluate Round 1 section):**

Find the existing Mode A results table:
```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ Model        │ Round 1 Position                                         │
├──────────────┼──────────────────────────────────────────────────────────┤
│ Claude       │ [summary]                                                │
│ Codex        │ [summary or UNAVAIL]                                     │
│ Gemini       │ [summary or UNAVAIL]                                     │
│ OpenCode     │ [summary or UNAVAIL]                                     │
│ Copilot      │ [summary or UNAVAIL]                                     │
│ <display-name for each claude-mcp server, dynamically> │ [summary or UNAVAIL] │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Replace with the wider Model column (30 chars) + tree chars for fallback hierarchy:
```
┌────────────────────────────────┬──────────────────────────────────────────────────────────┐
│ Model                          │ Round N Position                                         │
├────────────────────────────────┼──────────────────────────────────────────────────────────┤
│ Claude                         │ [summary — $CLAUDE_POSITION]                            │
│ gemini-1 (primary)             │ [summary or UNAVAIL]                                     │
│   └─ claude-1 (fallback)       │ [summary or UNAVAIL — only shown if primary UNAVAIL]    │
│ codex-1 (primary)              │ [summary or UNAVAIL]                                     │
│   ├─ claude-3 (fallback)       │ [summary or UNAVAIL — only shown if primary UNAVAIL]    │
│   └─ claude-4 (fallback)       │ [summary or UNAVAIL — only shown if still need quorum]  │
│ opencode-1 (primary)           │ [summary or UNAVAIL]                                     │
│ copilot-1 (primary)            │ [summary or UNAVAIL]                                     │
└────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

Add a brief prose note directly after the table:
```
Fallback rows (├─ / └─) are only rendered when the corresponding primary slot returned UNAVAIL and a claude-N fallback was dispatched in its place. If the primary responded, no fallback row is shown.
```

**Change 4 — Update the Mode B results table similarly:**

Find the Mode B verdict table (in "Output consensus verdict" section):
```
┌──────────────┬──────────────┬──────────────────────────────────────────┐
│ Model        │ Verdict      │ Reasoning                                │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ Claude       │ [verdict]    │ [summary]                                │
│ Gemini       │ [verdict]    │ [summary or UNAVAIL]                     │
│ OpenCode     │ [verdict]    │ [summary or UNAVAIL]                     │
│ Copilot      │ [verdict]    │ [summary or UNAVAIL]                     │
│ Codex        │ [verdict]    │ [summary or UNAVAIL]                     │
│ <display-name for each claude-mcp server, dynamically> │ [verdict] │ [summary or UNAVAIL] │
├──────────────┼──────────────┼──────────────────────────────────────────┤
│ CONSENSUS    │ [verdict]    │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└──────────────┴──────────────┴──────────────────────────────────────────┘
```

Replace with the wider Model column (30 chars) + tree chars:
```
┌────────────────────────────────┬──────────────┬──────────────────────────────────────────┐
│ Model                          │ Verdict      │ Reasoning                                │
├────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
│ Claude                         │ [verdict]    │ [summary]                                │
│ gemini-1 (primary)             │ [verdict]    │ [summary or UNAVAIL]                     │
│   └─ claude-1 (fallback)       │ [verdict]    │ [summary or UNAVAIL]                     │
│ codex-1 (primary)              │ [verdict]    │ [summary or UNAVAIL]                     │
│   ├─ claude-3 (fallback)       │ [verdict]    │ [summary or UNAVAIL]                     │
│   └─ claude-4 (fallback)       │ [verdict]    │ [summary or UNAVAIL]                     │
│ opencode-1 (primary)           │ [verdict]    │ [summary or UNAVAIL]                     │
│ copilot-1 (primary)            │ [verdict]    │ [summary or UNAVAIL]                     │
├────────────────────────────────┼──────────────┼──────────────────────────────────────────┤
│ CONSENSUS                      │ [verdict]    │ [N APPROVE, N REJECT, N FLAG, N UNAVAIL] │
└────────────────────────────────┴──────────────┴──────────────────────────────────────────┘
```

Add the same fallback prose note below this table as well.

**Important:** Do not change any other content in quorum.md — the scoreboard update logic, Mode A/B deliberation prose, provider pre-flight code, and team identity capture sections are correct as-is.
  </action>
  <verify>
1. `grep -n "orchestrator_delegation" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return no matches (block removed)
2. `grep -n "dispatch_pattern" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return at least 2 lines (open and close tags)
3. `grep -n "Fallback pool" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return at least 1 match
4. `grep -n "claude-1 (fallback)" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return at least 1 match (tree char rows present)
5. `grep -n "qgsd-quorum-orchestrator" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md` — must return 0 matches (orchestrator reference removed)
  </verify>
  <done>
`commands/qgsd/quorum.md` no longer references `qgsd-quorum-orchestrator`. The `<orchestrator_delegation>` block is replaced by `<dispatch_pattern>`. The dispatch banner includes the Fallback pool line. Both Mode A and Mode B results tables use a 30-char Model column with tree characters showing the fallback hierarchy. A prose note explains when fallback rows appear.
  </done>
</task>

<task type="auto">
  <name>Task 3: Commit changes</name>
  <files>agents/qgsd-quorum-orchestrator.md, commands/qgsd/quorum.md</files>
  <action>
Stage and commit both modified files with a descriptive commit message:

```bash
cd /Users/jonathanborduas/code/QGSD && \
git add agents/qgsd-quorum-orchestrator.md commands/qgsd/quorum.md && \
git commit -m "$(cat <<'EOF'
feat(quick-103): deprecate orchestrator agent, update quorum dispatch UX

- Prepend DEPRECATED notice to agents/qgsd-quorum-orchestrator.md
  (same pattern as QT-101 for retired worker/synthesizer)
- Replace <orchestrator_delegation> with <dispatch_pattern> in quorum.md
  (direct slot-worker dispatch — no orchestrator intermediary)
- Add Round N banner with Active and Fallback pool lines to quorum.md
- Update Mode A and Mode B results tables: 30-char Model column,
  tree chars (├─ / └─) for fallback hierarchy, fallback prose note

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

Then write the SUMMARY.md to `.planning/quick/103-deprecate-qgsd-quorum-orchestrator-and-u/103-SUMMARY.md`.
  </action>
  <verify>
Run: `git log --oneline -3 /Users/jonathanborduas/code/QGSD`
Expected: top commit contains "quick-103" and both files appear in `git show --stat HEAD`.
  </verify>
  <done>
Both files committed. SUMMARY.md written. Quick task 103 artifacts complete.
  </done>
</task>

</tasks>

<verification>
1. `head -1 agents/qgsd-quorum-orchestrator.md` starts with `<!-- DEPRECATED:`
2. `grep -c "orchestrator_delegation" commands/qgsd/quorum.md` returns 0
3. `grep -c "dispatch_pattern" commands/qgsd/quorum.md` returns 2 (open + close)
4. `grep -c "Fallback pool" commands/qgsd/quorum.md` returns 1+
5. `grep -c "fallback)" commands/qgsd/quorum.md` returns 1+ (tree-char rows)
6. `git log --oneline -1` shows quick-103 commit
</verification>

<success_criteria>
- qgsd-quorum-orchestrator.md deprecated with HTML comment at line 1
- quorum.md has no reference to spawning the orchestrator agent
- quorum.md dispatch banner shows Active slots + Fallback pool line
- quorum.md Mode A and Mode B tables use 30-char Model column with tree chars
- Both files committed in git under quick-103 label
</success_criteria>

<output>
After completion, create `.planning/quick/103-deprecate-qgsd-quorum-orchestrator-and-u/103-SUMMARY.md`
using the standard summary template. Include: what was changed in each file, the deprecation decision, the UX design decisions (banner format, tree chars, fallback prose note), and the commit hash.
</output>
