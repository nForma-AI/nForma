# Debug Subagent Prompt Template

Template for spawning debug agents from diagnose-issues workflow. Each agent investigates one UAT issue with symptoms pre-filled.

---

## Template

```markdown
<objective>
Investigate UAT issue and find root cause. Do NOT fix - only diagnose.

**Issue:** {issue_id}
**Summary:** {issue_summary}
**Severity:** {severity}

Symptoms are pre-filled from UAT testing. Skip symptom gathering, start investigating immediately.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/debug.md
@~/.claude/get-shit-done/templates/DEBUG.md
@~/.claude/get-shit-done/references/debugging/debugging-mindset.md
@~/.claude/get-shit-done/references/debugging/hypothesis-testing.md
@~/.claude/get-shit-done/references/debugging/investigation-techniques.md
</execution_context>

<context>
**Symptoms (from UAT):**
- expected: {expected}
- actual: {reported}
- severity: {severity}
- reproduction: Test {test_num} in UAT

@.planning/STATE.md
@.planning/phases/{phase_dir}/{phase}-UAT.md
</context>

<mode>
**symptoms_prefilled: true**

Skip the symptom_gathering step entirely. Symptoms section is already filled.
Start directly at investigation_loop.

**goal: find_root_cause_only**

Do NOT apply fixes. Your job is to:
1. Investigate the issue
2. Form and test hypotheses
3. Find the root cause with evidence
4. Return the diagnosis

The fix will be planned and applied separately by /gsd:plan-fix.
</mode>

<debug_file>
**Path constant:** DEBUG_DIR=.planning/debug

Create: `${DEBUG_DIR}/{slug}.md`

Generate slug from issue summary (same as regular /gsd:debug).
Example: `.planning/debug/comment-not-refreshing.md`

Pre-fill Symptoms section:
```markdown
## Symptoms

expected: {expected}
actual: {reported}
errors: [investigate to find]
reproduction: Test {test_num} - {test_name}
started: discovered during UAT
```

The debug file is identical to a regular debug session. The only difference is symptoms are pre-filled. UAT.md tracks the link via `debug_session` field.

Then proceed with investigation.
</debug_file>

<return_format>
When root cause is confirmed, return:

```
## DEBUG COMPLETE: {issue_id}

**Root Cause:** [specific cause with evidence]

**Evidence:**
- [key finding 1]
- [key finding 2]
- [key finding 3]

**Files Involved:**
- [file1.ts]: [what's wrong]
- [file2.ts]: [related issue]

**Debug Session:** ${DEBUG_DIR}/{slug}.md

**Suggested Fix Direction:** [brief hint for plan-fix, not implementation]
```

If unable to determine root cause after thorough investigation:

```
## DEBUG INCONCLUSIVE: {issue_id}

**Investigation Summary:**
- [what was checked]
- [what was eliminated]

**Hypotheses Remaining:**
- [possible cause 1]
- [possible cause 2]

**Recommendation:** Manual review needed

**Debug Session:** ${DEBUG_DIR}/{slug}.md
```
</return_format>

<success_criteria>
- [ ] Debug file created with symptoms pre-filled
- [ ] Investigation completed (evidence gathered, hypotheses tested)
- [ ] Root cause identified with supporting evidence
- [ ] Debug session file updated throughout
- [ ] Clear return format for orchestrator
</success_criteria>
```

---

## Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{issue_id}` | UAT issue ID | `UAT-001` |
| `{issue_summary}` | Brief description | `Comment doesn't appear until refresh` |
| `{expected}` | From UAT test | `Submit comment, appears in list` |
| `{reported}` | User's description | `works but doesn't show until refresh` |
| `{severity}` | blocker/major/minor/cosmetic | `major` |
| `{test_num}` | Test number in UAT | `2` |
| `{test_name}` | Test name | `Create Top-Level Comment` |
| `{phase}` | Phase number | `04` |
| `{phase_dir}` | Phase directory name | `04-comments` |
| `{slug}` | Generated from summary | `comment-not-refreshing` |

---

## Usage

Orchestrator (diagnose-issues.md) fills placeholders and spawns:

```python
# Spawn all debug agents in parallel
Task(prompt=filled_template_001, subagent_type="general-purpose", description="Debug UAT-001")
Task(prompt=filled_template_002, subagent_type="general-purpose", description="Debug UAT-002")
Task(prompt=filled_template_003, subagent_type="general-purpose", description="Debug UAT-003")
```

All agents run simultaneously. Each returns with root cause or inconclusive result.
