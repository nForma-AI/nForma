<purpose>
Orchestrate parallel debug agents to investigate UAT issues and find root causes.

After UAT finds issues, spawn one debug agent per issue. Each agent investigates autonomously with symptoms pre-filled from UAT. Collect root causes, update UAT.md, then hand off to plan-fix with actual diagnoses.

Orchestrator stays lean: parse issues, spawn agents, collect results, update UAT.
</purpose>

<paths>
DEBUG_DIR=.planning/debug

Debug files use the `.planning/debug/` path (hidden directory with leading dot).
</paths>

<core_principle>
**Diagnose before planning fixes.**

UAT tells us WHAT is broken (symptoms). Debug agents find WHY (root cause). Plan-fix then creates targeted fixes based on actual causes, not guesses.

Without diagnosis: "Comment doesn't refresh" → guess at fix → maybe wrong
With diagnosis: "Comment doesn't refresh" → "useEffect missing dependency" → precise fix
</core_principle>

<process>

<step name="parse_issues">
**Extract issues from UAT.md:**

Read the "Issues for /gsd:plan-fix" section:
```
- UAT-001: Comment doesn't appear until refresh (major) - Test 2
- UAT-002: Reply button position wrong (minor) - Test 5
- UAT-003: Delete doesn't work (blocker) - Test 6
```

For each issue, also read the corresponding test from "Tests" section to get:
- expected: What should happen
- reported: What user described (verbatim)
- severity: blocker/major/minor/cosmetic

Build issue list:
```
issues = [
  {id: "UAT-001", summary: "Comment doesn't appear until refresh", severity: "major", test_num: 2, expected: "...", reported: "..."},
  {id: "UAT-002", summary: "Reply button position wrong", severity: "minor", test_num: 5, expected: "...", reported: "..."},
  ...
]
```
</step>

<step name="report_plan">
**Report diagnosis plan to user:**

```
## Diagnosing {N} Issues

Spawning parallel debug agents to investigate root causes:

| Issue | Summary | Severity |
|-------|---------|----------|
| UAT-001 | Comment doesn't appear until refresh | major |
| UAT-002 | Reply button position wrong | minor |
| UAT-003 | Delete doesn't work | blocker |

Each agent will:
1. Create DEBUG-UAT-{NNN}.md with symptoms pre-filled
2. Investigate autonomously (read code, form hypotheses, test)
3. Return root cause

This runs in parallel - all issues investigated simultaneously.
```
</step>

<step name="spawn_agents">
**Spawn debug agents in parallel:**

For each issue, fill the debug-subagent-prompt template and spawn:

```
Task(
  prompt=filled_debug_subagent_prompt,
  subagent_type="general-purpose",
  description="Debug UAT-{NNN}"
)
```

**All agents spawn in single message** (parallel execution).

Template placeholders:
- `{issue_id}`: UAT-001, UAT-002, etc.
- `{issue_summary}`: Brief description
- `{expected}`: From UAT test
- `{reported}`: Verbatim user description
- `{severity}`: blocker/major/minor/cosmetic
- `{phase}`: Phase being tested
- `{phase_dir}`: Path to phase directory
</step>

<step name="collect_results">
**Collect root causes from agents:**

Each agent returns with:
```
## DEBUG COMPLETE: UAT-{NNN}

**Root Cause:** {specific cause with evidence}
**Files Involved:** {list of files}
**Debug Session:** ${DEBUG_DIR}/{slug}.md

**Evidence Summary:**
- {key finding 1}
- {key finding 2}
```

Parse each return to extract:
- root_cause: The diagnosed cause
- files: Files involved
- debug_path: Path to debug session file (standard debug location)

If agent fails or can't determine root cause:
- root_cause: "Investigation inconclusive - manual review needed"
- Note which issue needs manual attention
</step>

<step name="update_uat">
**Update UAT.md with root causes:**

For each issue in the Tests section, add root_cause field:

```markdown
### 2. Create Top-Level Comment
expected: Submit comment via rich text editor, appears in list with author info
result: issue
reported: "works but doesn't show until I refresh the page"
severity: major
root_cause: "useEffect in CommentList.tsx missing commentCount dependency - doesn't re-render when new comment added"
debug_session: ${DEBUG_DIR}/comment-not-refreshing.md
```

Update the "Issues for /gsd:plan-fix" section with root causes:

```markdown
## Issues for /gsd:plan-fix

- UAT-001: Comment doesn't appear until refresh (major) - Test 2
  root_cause: useEffect missing dependency in CommentList.tsx

- UAT-002: Reply button position wrong (minor) - Test 5
  root_cause: CSS flex order incorrect in ReplyButton.tsx

- UAT-003: Delete doesn't work (blocker) - Test 6
  root_cause: API endpoint returns 403 - missing auth header
```

Commit the updated UAT.md:
```bash
git add ".planning/phases/XX-name/{phase}-UAT.md"
git commit -m "docs({phase}): add root causes from diagnosis"
```
</step>

<step name="report_results">
**Report diagnosis results:**

```
## Diagnosis Complete

| Issue | Root Cause | Files |
|-------|------------|-------|
| UAT-001 | useEffect missing dependency | CommentList.tsx |
| UAT-002 | CSS flex order incorrect | ReplyButton.tsx |
| UAT-003 | API missing auth header | api/comments.ts |

Debug sessions saved to ${DEBUG_DIR}/

---

Next steps:
- `/gsd:plan-fix {phase}` — Create fix plan with root causes
- Review debug sessions for details
```
</step>

<step name="offer_next">
**Offer plan-fix:**

```
Root causes identified. Ready to plan fixes?

`/gsd:plan-fix {phase}`

The fix plan will use diagnosed root causes for targeted fixes.
```
</step>

</process>

<context_efficiency>
**Orchestrator context:** ~15%
- Parse UAT.md issues
- Fill template strings
- Spawn parallel Task calls
- Collect results
- Update UAT.md

**Each debug agent:** Fresh 200k context
- Loads full debug workflow
- Loads debugging references
- Investigates with full capacity
- Returns root cause

**No symptom gathering.** Agents start with symptoms pre-filled from UAT.
**No fix application.** Agents only diagnose - plan-fix handles fixes.
</context_efficiency>

<failure_handling>
**Agent fails to find root cause:**
- Mark issue as "needs manual review"
- Continue with other issues
- Report incomplete diagnosis

**Agent times out:**
- Check DEBUG-UAT-{NNN}.md for partial progress
- Can resume with /gsd:debug

**All agents fail:**
- Something systemic (permissions, git, etc.)
- Report for manual investigation
- Fall back to plan-fix without root causes
</failure_handling>

<success_criteria>
- [ ] Issues parsed from UAT.md
- [ ] Debug agents spawned in parallel
- [ ] Root causes collected from all agents
- [ ] UAT.md updated with root causes
- [ ] Debug sessions saved to ${DEBUG_DIR}/
- [ ] User knows next steps (plan-fix)
</success_criteria>
