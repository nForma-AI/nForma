---
phase: quick-68
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "README Commands table lists every shipped command including fix-tests and mcp-setup"
    - "Quorum setup section references mcp-setup wizard instead of only manual claude mcp add steps"
    - "A new MCP Management section describes mcp-status, mcp-set-model, mcp-update, mcp-restart, and mcp-setup at the same depth as other commands"
    - "Agent slot naming (claude-1, gemini-cli-1, etc.) is explained in the quorum setup context"
    - "quorum_active composition config and multi-slot support are documented"
    - "fix-tests command is documented with its key capabilities (discovery, ddmin isolation, AI categorization)"
    - "debug command description is expanded beyond placeholder text"
    - "No command present in commands/qgsd/ directory is missing from the README commands table"
  artifacts:
    - path: "README.md"
      provides: "Updated user-facing documentation reflecting v0.1-v0.7"
      contains: "mcp-setup"
  key_links:
    - from: "README.md quorum setup section"
      to: "/qgsd:mcp-setup wizard"
      via: "cross-reference text"
      pattern: "mcp-setup"
    - from: "README.md Commands table"
      to: "fix-tests command"
      via: "table row"
      pattern: "fix-tests"
---

<objective>
Audit README.md against every feature shipped in v0.1–v0.7 and update it to fill all gaps: missing commands, outdated quorum setup instructions, undocumented MCP management layer, agent slot naming, composition config, and multi-slot support.

Purpose: README is the first thing new users read. It currently reflects v0.1–v0.2 state and silently omits six months of shipped capabilities.
Output: Updated README.md with accurate, complete documentation of all shipped commands and features through v0.7.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md
@/Users/jonathanborduas/code/QGSD/.planning/MILESTONES.md
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/code/QGSD/README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit README against shipped features and produce gap list</name>
  <files>README.md</files>
  <action>
Read README.md in full and cross-reference it against the shipped feature set from v0.1–v0.7 (documented in MILESTONES.md). Produce a structured gap list before making any edits. The gap list must cover:

1. Commands present in `commands/qgsd/` but absent from README Commands tables:
   - `fix-tests` (v0.3) — completely missing
   - `mcp-setup` (v0.5) — completely missing
   - Any other commands visible in the directory listing that are not in the table

2. Commands listed in the table but with stale or placeholder descriptions:
   - `debug` — "Systematic debugging with persistent state" is adequate but the command is new (v0.4+); verify description matches actual behavior
   - `quorum-test` vs `quorum` — table has both; clarify distinction

3. Quorum setup section (line 66–138) — still documents manual `claude mcp add codex-cli`, `claude mcp add gemini-cli`, etc. with old package names and old server names:
   - v0.6 renamed all agents to slot-based names: `claude-1`, `copilot-1`, `gemini-cli-1`, `codex-cli-1`, `opencode-1` (family-N scheme)
   - v0.5 shipped `/qgsd:mcp-setup` wizard — the setup section should reference the wizard as the primary path and keep manual steps as a fallback/advanced option
   - Old server names `@tuannvm/gemini-mcp-server`, `@tuannvm/opencode-mcp-server` may be outdated (verify against MILESTONES.md — v0.4 standardized the repos)

4. Missing feature sections not in README:
   - MCP Management commands (v0.4): mcp-status, mcp-set-model, mcp-update, mcp-restart — these are listed in the Commands table under no group (check if they're grouped or just floating); need a prose section explaining what MCP management is and why it matters
   - Test Suite Maintenance (v0.3): `/qgsd:fix-tests` — not documented anywhere in the README prose
   - Agent Slots (v0.6): slot-based naming scheme explained nowhere
   - Composition Config (v0.7): `quorum_active`, multi-slot, wizard composition screen — not documented

After producing the gap list mentally, proceed immediately to Task 2 (editing). This task produces no file output — it is a prerequisite mental model for the edit.
  </action>
  <verify>Internal step — no file output. Gap list is mentally held for Task 2.</verify>
  <done>All gaps identified across: missing commands, stale quorum setup, absent feature sections.</done>
</task>

<task type="auto">
  <name>Task 2: Update README.md with all v0.1-v0.7 gaps filled</name>
  <files>README.md</files>
  <action>
Edit README.md to fill all gaps identified in Task 1. Make the following specific changes:

**A. Commands table — add missing commands and create MCP Management group**

In the Commands section, add a new "MCP Management" group after the existing "Utilities" group (or after "Brownfield" — choose the most logical location):

```
### MCP Management

| Command | What it does |
|---------|--------------|
| `/qgsd:mcp-setup` | Interactive wizard: first-run onboarding or reconfigure any agent (key, provider, model, composition) |
| `/qgsd:mcp-status` | Poll all quorum agents for identity + availability; show scoreboard |
| `/qgsd:mcp-set-model` | Switch a quorum agent's model with live validation + preference persistence |
| `/qgsd:mcp-update` | Update all quorum agent MCP servers (npm/npx/git install methods auto-detected) |
| `/qgsd:mcp-restart` | Restart all quorum agent processes + verify reconnection via identity ping |
```

Add `fix-tests` to the Utilities table (or create a "Test Maintenance" group):

```
| `/qgsd:fix-tests` | Discover all tests, AI-categorize failures into 5 types, dispatch fixes, loop until clean |
```

**B. Quorum setup section — modernize to wizard-first flow**

Replace the current "Setting Up Your Quorum" section (lines 66–138) with a wizard-first approach:

```markdown
### Setting Up Your Quorum

The fastest path is the interactive wizard — it handles everything from installing CLI tools to registering MCP servers and configuring API keys:

```
/qgsd:mcp-setup
```

First run: linear onboarding — picks provider, configures API key (stored in system keychain), registers MCP server with Claude Code, verifies live connectivity via identity ping.

Re-run: navigable agent menu — reconfigure any agent's key, provider, model, or toggle which agents participate in quorum (composition screen).
```

Then keep the manual steps as a `<details>` block titled "Manual setup (advanced)" so power users still have the reference, but they're de-emphasized. Update the manual steps to use slot-based registration names:

- Old: `claude mcp add codex-cli -- npx -y codex-mcp-server`
- New: `claude mcp add codex-cli-1 -- npx -y codex-mcp-server`
- Old: `claude mcp add gemini-cli -- npx -y @tuannvm/gemini-mcp-server`
- New: `claude mcp add gemini-cli-1 -- npx -y gemini-mcp-server` (package name updated in v0.4)
- Old: `claude mcp add opencode -- npx -y @tuannvm/opencode-mcp-server`
- New: `claude mcp add opencode-1 -- npx -y opencode-mcp-server`
- Old: `claude mcp add copilot-cli -- npx -y copilot-mcp-server`
- New: `claude mcp add copilot-1 -- npx -y copilot-mcp-server`
- Add: `claude mcp add claude-1 -- npx -y claude-mcp-server`

Add a brief note about agent slots: "QGSD uses a slot-based naming scheme (`<family>-<N>`) so you can run multiple instances of the same agent family. `claude-1` is the first Claude slot, `copilot-1` is the first Copilot slot, etc. Adding a second Copilot would be `copilot-2`."

**C. Add "Test Suite Maintenance" prose section**

After the "Quick Mode" section and before "Why It Works", add a new section:

```markdown
### Test Suite Maintenance

```
/qgsd:fix-tests
```

An autonomous command that discovers every test in your project, runs them, diagnoses failures, and dispatches fix tasks — looping until all tests are either passing or classified.

**How it works:**

1. **Discover** — Framework-native discovery (Jest, Playwright, pytest); never globs
2. **Batch & run** — Random batch order with flakiness detection (runs each batch twice)
3. **Categorize** — AI classifies each failure into one of 5 types:
   - `valid-skip` — Test is intentionally skipped; no action needed
   - `adapt` — Test broke because code changed; links to the causative commit via git pickaxe
   - `isolate` — Test only fails alongside specific other tests (pollution); ddmin algorithm finds the minimal polluter set
   - `real-bug` — Genuine regression; deferred to user report
   - `fixture` — Missing test data or environment setup
4. **Dispatch** — `adapt`, `fixture`, and `isolate` failures are dispatched as `/qgsd:quick` fix tasks automatically
5. **Loop** — Repeats until all tests pass or no progress for 5 consecutive batches

Interrupted runs resume to the exact batch step via `/qgsd:resume-work`.
```

**D. Add composition config note to Configuration section**

In the Configuration section, after the existing Core Settings table, add a brief subsection:

```markdown
### Quorum Composition

Control which agent slots participate in quorum via `quorum_active` in your `qgsd.json`:

```json
{
  "quorum_active": ["claude-1", "gemini-cli-1", "copilot-1"]
}
```

This is auto-populated at install time based on your registered MCP servers. Toggle slots on/off via `/qgsd:mcp-setup` → "Edit Quorum Composition" without editing config files directly.

You can run multiple instances of the same agent family (multi-slot): `claude-1` and `claude-2` for two Claude agent slots, `copilot-1` and `copilot-2` for two Copilot slots, etc.
```

**E. Expand debug command description**

The debug command row currently reads: `Systematic debugging with persistent state`. Update to be more descriptive:

`/qgsd:debug [desc]` — Start a debugging session with persistent state: spawns quorum diagnosis on failure, tracks hypotheses across invocations, resumes where it left off.

**F. Verify no command in `commands/qgsd/` directory is absent from README**

Commands directory contains: add-phase, add-todo, audit-milestone, check-todos, cleanup, complete-milestone, debug, discuss-phase, execute-phase, fix-tests, health, help, insert-phase, join-discord, list-phase-assumptions, map-codebase, mcp-restart, mcp-set-model, mcp-setup, mcp-status, mcp-update, new-milestone, new-project, pause-work, plan-milestone-gaps, plan-phase, progress, quick, quorum-test, quorum, reapply-patches, remove-phase, research-phase, resume-work, set-profile, settings, update, verify-work.

Cross-check each against the README commands tables after editing. Any command present in the directory but absent from the README must be added with a one-line description.

**Style constraints:**
- Match existing table formatting exactly
- Keep additions concise — one-line descriptions in tables, short paragraphs in prose sections
- Do not alter the "Why I Built QGSD", "Why It Works", or "Atomic Git Commits" sections — they are intentional marketing copy
- Do not remove the manual MCP setup steps — move them to a `<details>` block
- Preserve all existing badges, star history, and footer
  </action>
  <verify>
After editing, run these checks:
1. `grep -c "fix-tests" README.md` — must be >= 2 (table row + prose section)
2. `grep -c "mcp-setup" README.md` — must be >= 3 (quorum setup section + MCP management table + composition screen mention)
3. `grep -c "quorum_active" README.md` — must be >= 1 (composition config subsection)
4. `grep -c "codex-cli-1\|gemini-cli-1\|copilot-1\|opencode-1\|claude-1" README.md` — must be >= 4 (slot-based names in setup section)
5. Scan the Commands section and confirm every command in the `commands/qgsd/` directory list appears at least once in a README commands table
  </verify>
  <done>
README.md contains:
- All commands from commands/qgsd/ directory represented in a table row
- Quorum setup section leads with /qgsd:mcp-setup wizard; manual steps in a details block with slot-based names
- MCP Management command group exists with all 5 mcp-* commands
- Test Suite Maintenance section documents fix-tests with the 5-category system and ddmin isolation
- Composition config (quorum_active, multi-slot) documented in Configuration section
- All grep checks pass
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. `grep -c "fix-tests" /Users/jonathanborduas/code/QGSD/README.md` returns >= 2
2. `grep -c "mcp-setup" /Users/jonathanborduas/code/QGSD/README.md` returns >= 3
3. `grep -c "quorum_active" /Users/jonathanborduas/code/QGSD/README.md` returns >= 1
4. `grep -c "claude-1\|gemini-cli-1\|copilot-1\|opencode-1" /Users/jonathanborduas/code/QGSD/README.md` returns >= 4
5. No command in commands/qgsd/ is absent from the README commands tables
</verification>

<success_criteria>
README.md accurately reflects all features shipped in v0.1–v0.7:
- fix-tests and mcp-setup commands are documented with prose explanations
- Quorum setup leads with the wizard; manual steps are de-emphasized but preserved
- MCP Management commands are grouped and described
- Agent slot naming scheme is explained
- Composition config (quorum_active) and multi-slot are documented
- All commands in the commands directory appear in the README
</success_criteria>

<output>
After completion, create `/Users/jonathanborduas/code/QGSD/.planning/quick/68-audit-and-update-readme-and-documentatio/68-SUMMARY.md` with what changed, which gaps were filled, and the final grep check results.
</output>
