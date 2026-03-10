---
phase: quick-268
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - commands/nf/mcp-repair.md
autonomous: true
requirements: [51, 74]
formal_artifacts: none

must_haves:
  truths:
    - "Running /nf:mcp-repair reads bin/providers.json and diagnoses all configured quorum slots"
    - "Auto-fixable issues (claude-mcp server down) are repaired automatically via pkill + reconnect"
    - "Non-auto-fixable issues (auth expired, quota) produce actionable user guidance"
    - "Before/after health summary shows what changed after repairs"
  artifacts:
    - path: "commands/nf/mcp-repair.md"
      provides: "Skill command for /nf:mcp-repair"
      min_lines: 150
  key_links:
    - from: "commands/nf/mcp-repair.md"
      to: "bin/providers.json"
      via: "Read tool for slot configuration"
      pattern: "providers.json"
    - from: "commands/nf/mcp-repair.md"
      to: "commands/nf/mcp-status.md"
      via: "Follows same MCP tool calling pattern for identity + health_check"
      pattern: "health_check"
    - from: "commands/nf/mcp-repair.md"
      to: "commands/nf/mcp-restart.md"
      via: "Reuses same pkill restart pattern for claude-mcp servers"
      pattern: "pkill"
---

<objective>
Create the /nf:mcp-repair skill command that auto-diagnoses all quorum slot connectivity issues and applies automatic repairs where possible.

Purpose: When quorum slots fail (MCP servers down, CLI auth expired, quota exhausted), users currently must manually diagnose and fix each one. This skill automates the diagnosis-repair-verify cycle.
Output: Single command file at commands/nf/mcp-repair.md
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@commands/nf/mcp-restart.md
@commands/nf/mcp-status.md
@bin/providers.json
@bin/check-mcp-health.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /nf:mcp-repair skill command</name>
  <files>commands/nf/mcp-repair.md</files>
  <action>
Create `commands/nf/mcp-repair.md` following the established mcp-* command pattern (see mcp-status.md and mcp-restart.md for structure).

**Frontmatter:**
- name: nf:mcp-repair
- description: Auto-diagnose and repair quorum slot connectivity — restarts MCP servers, checks CLI binaries, reports unfixable issues
- allowed-tools: Bash, Read, Task, plus all identity and health_check MCP tools for all configured slots (read slot names from bin/providers.json) — copy the exact tool list from mcp-status.md

**Process steps:**

**Step 1 — Initial diagnosis (before state).**
Use the same Task() sub-agent pattern as mcp-status.md Step 3 to collect identity + health_check results for all configured slots (read from bin/providers.json). Store as BEFORE_STATE. This prevents raw MCP tool output from cluttering the conversation.

**Step 2 — Classify each slot's health.**
For each slot, classify into one of these categories using a Bash node inline script:

| Category | Condition | Auto-fixable? |
|---|---|---|
| healthy | identity OK + health_check healthy | No action needed |
| mcp-down | identity threw (claude-1..6 only) | YES — pkill + reconnect |
| cli-missing | `which <binary>` fails (CLI slots only) | NO — tell user to install |
| auth-expired | identity OK but health_check fails with auth error (401/403) | NO — tell user to re-auth |
| quota-exceeded | identity OK but health_check fails with 402/429 | NO — report wait time |
| timeout | identity or health_check timed out | NO — classify and suggest `/nf:mcp-restart <slot>` |
| unknown | any other failure | NO — report raw error |

For CLI agents, use a three-tier binary resolution check:
1. First check the `cli` field from providers.json (exact absolute path) — `test -x <cli_path>`
2. If no `cli` field or path not executable, fall back to `which <tool-name>`
3. If both fail, classify as `cli-missing`
This three-tier approach prevents false positives when a CLI is installed at a non-standard path.

**Step 3 — Display diagnosis table.**
Render a diagnosis table showing all configured slots with columns: Slot | Type | Status | Issue | Action. Use box-drawing characters matching the mcp-status.md table style. Example:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► MCP REPAIR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Diagnosing N quorum slots...    (where N = providers.json count)

┌─────────────┬──────────┬──────────┬─────────────────────┬──────────────────┐
│ Slot        │ Type     │ Status   │ Issue               │ Action           │
├─────────────┼──────────┼──────────┼─────────────────────┼──────────────────┤
│ codex-1     │ CLI      │ healthy  │ —                   │ —                │
│ gemini-1    │ CLI      │ quota    │ 429 rate limited    │ wait ~30min      │
│ claude-1    │ MCP      │ down     │ identity failed     │ auto-restarting  │
│ ...         │          │          │                     │                  │
└─────────────┴──────────┴──────────┴─────────────────────┴──────────────────┘
```

**Step 4 — Auto-repair: restart downed MCP servers.**
For each slot classified as `mcp-down` (claude-1..6 only):
1. Read ~/.claude.json to find the exact process command/path for that slot's MCP server entry (same logic as mcp-restart.md Step 3)
2. Run `pkill -f "<exact_process_path>"` using the exact path from ~/.claude.json — do NOT use broad patterns like `pkill -f "claude"` which would over-match. The exact process path prevents killing unrelated processes (same pattern proven safe in mcp-restart.md)
3. Wait 3 seconds for Claude Code to auto-restart it
4. Call the identity tool to verify reconnection

Print progress for each repair: `Restarting <slot>... [OK|FAILED]`

If NO slots need auto-repair, print: `No auto-fixable issues found.`

**Step 5 — Report manual actions needed.**
For each non-auto-fixable slot, print specific guidance:

- cli-missing: `<slot>: Binary not found. Install with: <install command>`
  - codex-1: `npm install -g @anthropic-ai/codex` (or whatever the correct install)
  - gemini-1: `npm install -g @anthropic-ai/gemini-cli`
  - opencode-1: `go install github.com/anthropics/opencode@latest`
  - copilot-1: `gh extension install github/gh-copilot`
- auth-expired: `<slot>: Auth expired. Run in a separate terminal: <auth command>`
  - codex-1: `codex auth login`
  - gemini-1: `gemini auth login`
  - opencode-1: `opencode auth login`
  - copilot-1: `gh auth login`
- quota-exceeded: `<slot>: Quota exceeded (429). Resets in ~30 minutes. Use --force-quorum to skip this slot.`
- timeout: `<slot>: Timed out (no auto-retry in v1). Run: /nf:mcp-restart <slot>`
- unknown: `<slot>: Unknown error: <raw error message>`

**Step 6 — Post-repair verification (after state).**
If any auto-repairs were attempted in Step 4, re-run identity + health_check on ONLY the repaired slots using the same Task() sub-agent pattern. Store as AFTER_STATE.

**Step 7 — Before/after summary.**
If repairs were attempted, show a before/after comparison:
```
━━━ REPAIR SUMMARY ━━━

  Before: 7/N healthy
  After:  9/N healthy      (N = total configured slots)

  Repaired:
    claude-1: down → healthy
    claude-3: down → healthy

  Still broken (manual action needed):
    gemini-1: quota exceeded — wait ~30min
```

If no repairs were needed and all slots are healthy:
```
All N quorum slots healthy. No repairs needed.   (N = total configured slots)
```

If no repairs were needed but some slots are broken (all non-auto-fixable):
```
No auto-fixable issues found. Manual action needed for N slot(s) — see above.
```

**Important implementation notes:**
- Follow the SEQUENTIAL Bash execution pattern from mcp-status.md (one Bash call at a time, never parallel — "A failure in one parallel sibling cancels all other parallel siblings")
- Use Task() sub-agent for MCP tool calls (same pattern as mcp-status.md Step 3) to keep raw tool output out of main conversation
- The command is NOT in quorum_commands — it does not invoke quorum
- Read bin/providers.json to get the slot list and CLI binary paths (the `cli` field has absolute paths)
- For CLI binary checks, use the `cli` field from providers.json if available, falling back to `which <tool-name>`

**Quorum invariant compliance:**
- This command does NOT modify quorum voting, consensus, or dispatch logic
- It only reads slot configuration and calls identity/health_check tools (observation only, except for the pkill restart action)
- The pkill restart only affects claude-mcp servers (subprocess servers), not the quorum orchestration itself
  </action>
  <verify>
1. File exists: `test -f commands/nf/mcp-repair.md && echo "EXISTS"`
2. Has correct frontmatter: `head -5 commands/nf/mcp-repair.md` shows name: nf:mcp-repair
3. Has all required allowed-tools: `grep -c "mcp__" commands/nf/mcp-repair.md` returns 20 (10 identity + 10 health_check)
4. Has process steps: `grep -c "## Step" commands/nf/mcp-repair.md` returns 7
5. References pkill pattern: `grep "pkill" commands/nf/mcp-repair.md` returns matches
6. References providers.json: `grep "providers.json" commands/nf/mcp-repair.md` returns matches
7. Has success_criteria section: `grep "success_criteria" commands/nf/mcp-repair.md` returns match
  </verify>
  <done>
- commands/nf/mcp-repair.md exists with valid frontmatter (name, description, allowed-tools)
- Command implements 7-step process: diagnose, classify, display, auto-repair, report manual, verify, summarize
- All configured slot types covered (dynamically read from bin/providers.json)
- Auto-repair logic uses pkill pattern from mcp-restart.md for downed MCP servers
- Manual action guidance provided for non-fixable issues (auth, quota, missing binary)
- Before/after health summary rendered after repairs
- Sequential Bash execution pattern followed (matching mcp-status.md)
- Task() sub-agent pattern used for MCP tool calls (matching mcp-status.md)
  </done>
</task>

</tasks>

<verification>
- `ls commands/nf/mcp-repair.md` — file exists
- `grep "nf:mcp-repair" commands/nf/mcp-repair.md` — correct skill name
- `grep -c "## Step" commands/nf/mcp-repair.md` — has 7 process steps
- The command follows the same structural patterns as mcp-status.md and mcp-restart.md
</verification>

<success_criteria>
- /nf:mcp-repair command file exists at commands/nf/mcp-repair.md
- Running `/nf:mcp-repair` would diagnose all configured slots (from bin/providers.json), auto-fix downed MCP servers, and report non-fixable issues with actionable guidance
- Command follows established mcp-* command patterns (frontmatter, process steps, success_criteria)
- No quorum invariants violated (command is observational + restart only)
</success_criteria>

<output>
After completion, create `.planning/quick/268-add-nf-mcp-repair-skill-auto-diagnose-an/268-SUMMARY.md`
</output>
