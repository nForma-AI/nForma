---
phase: quick-43
plan: 43
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
autonomous: true
requirements: [QUICK-43]

must_haves:
  truths:
    - "The quick workflow orchestrator reads no plan file contents into its own context"
    - "STATE.md update and final commit are performed inside the executor sub-agent, not inline by the orchestrator"
    - "Quorum step passes the plan file path to the quorum orchestrator rather than embedding plan content in the orchestrator prompt"
    - "The orchestrator remains a pure coordinator: init, spawn agents, route on results"
  artifacts:
    - path: "/Users/jonathanborduas/.claude/qgsd/workflows/quick.md"
      provides: "Updated quick workflow with sub-agent-delegated execution"
      contains: "Step 7 and Step 8 moved inside executor prompt"
  key_links:
    - from: "quick.md Step 5.7 (Quorum)"
      to: "qgsd-quorum-orchestrator sub-agent"
      via: "plan_path reference instead of embedded plan content"
      pattern: "plan_path.*PLAN.md"
    - from: "quick.md Step 6 (Executor)"
      to: "STATE.md update + final commit"
      via: "executor sub-agent prompt includes STATE.md update and commit instructions"
      pattern: "Update STATE.md.*commit"
---

<objective>
Refactor the qgsd:quick workflow so that all execution, state-tracking, and commit work is
performed inside sub-agent Task() calls rather than inline by the main orchestrator agent.

Purpose: The orchestrator currently accumulates context by reading plan files, editing STATE.md,
and running commit commands inline between sub-agent calls. This defeats the purpose of sub-agent
delegation and causes the orchestrator to consume excessive context on every quick task.

Output: An updated `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md` where:
- Step 5.7 (Quorum) passes the plan file path to the quorum orchestrator instead of reading the
  plan content into the orchestrator's context
- Step 6 (Executor) includes STATE.md update and final commit inside its Task() prompt
- Step 7 (STATE.md update) and Step 8 (Final commit) are removed as standalone orchestrator steps
  (their logic moves into the executor sub-agent prompt)
- The orchestrator only: parses args, runs init bash call, creates directory, spawns sub-agents,
  routes on results, and displays the final completion banner
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jonathanborduas/code/QGSD/.planning/STATE.md
@/Users/jonathanborduas/.claude/qgsd/workflows/quick.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move STATE.md update and final commit into executor sub-agent prompt</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/quick.md</files>
  <action>
    Read the current `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md`.

    The current Step 6 executor Task() prompt only says:
    - Execute all tasks in the plan
    - Commit each task atomically
    - Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
    - Do NOT update ROADMAP.md

    The current Step 7 and Step 8 are standalone sections that the orchestrator runs inline after
    the executor returns.

    Make the following changes:

    1. **Expand the Step 6 executor Task() prompt** to include the full STATE.md update and
       final commit logic. The executor prompt constraints section should become:

       ```
       <constraints>
       - Execute all tasks in the plan
       - Commit each task atomically (use the gsd-tools.cjs commit command per the execute-plan workflow)
       - Create summary at: ${QUICK_DIR}/${next_num}-SUMMARY.md
       - Do NOT update ROADMAP.md (quick tasks are separate from planned phases)
       - After creating the SUMMARY.md, update STATE.md "Quick Tasks Completed" table:
         - If the table doesn't exist, create it after "### Blockers/Concerns" with columns:
           | # | Description | Date | Commit | Status | Directory |
         - Append a new row: | ${next_num} | ${DESCRIPTION} | ${date} | {commit_hash} | {VERIFICATION_STATUS_placeholder} | [${next_num}-${slug}](./quick/${next_num}-${slug}/) |
           Use VERIFICATION_STATUS = "Pending" as placeholder (orchestrator will update when verifier runs, if --full)
         - Update "Last activity" line: "${date} - Completed quick task ${next_num}: ${DESCRIPTION}"
       - Commit STATE.md alongside PLAN.md and SUMMARY.md in a single final commit:
         node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(quick-${next_num}): ${DESCRIPTION}" \
           --files ${QUICK_DIR}/${next_num}-PLAN.md ${QUICK_DIR}/${next_num}-SUMMARY.md .planning/STATE.md
       - After committing, run: node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
       - Return the final commit hash in your completion response (format: "Commit: {hash}")
       </constraints>
       ```

    2. **Remove the standalone Step 7 and Step 8 sections** from the orchestrator (the "Update
       STATE.md" and "Final commit and completion" steps). The orchestrator should no longer call
       Edit tool on STATE.md or run commit commands directly.

    3. **Update the "After executor returns" logic** in Step 6. Change it to:
       - Verify summary exists at `${QUICK_DIR}/${next_num}-SUMMARY.md`
       - Extract commit hash from executor output ("Commit: {hash}" pattern)
       - Display the final completion banner (the GSD > QUICK TASK COMPLETE block that was
         previously in Step 8)

    4. **Update Step 6.5 (Verification, --full only)**: After the verifier runs and
       VERIFICATION_STATUS is determined, the orchestrator must update the Status cell in STATE.md.
       This is a small targeted edit — the orchestrator reads STATE.md, finds the row for
       `${next_num}`, replaces "Pending" with the actual `$VERIFICATION_STATUS`, then commits:
       ```bash
       node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs(quick-${next_num}): update verification status" \
         --files .planning/STATE.md ${QUICK_DIR}/${next_num}-VERIFICATION.md
       ```
       (This keeps verification status accurate without the orchestrator doing the full STATE.md
       write initially.)

    5. **Update the success_criteria** at the bottom to reflect the new flow:
       - Remove "Artifacts committed" (handled by executor)
       - Add "Executor commits PLAN.md + SUMMARY.md + STATE.md atomically"
       - Add "(--full) Orchestrator updates STATE.md Status cell after verification"

    The gsd (non-qgsd) version at `/Users/jonathanborduas/.claude/get-shit-done/workflows/quick.md`
    does NOT have quorum (Step 5.7) or the quorum resolution loop in Step 6.5 — only apply
    structural changes (Steps 7/8 → executor) to that file as well in a parallel update within
    this same task.

    Apply the same executor-handles-state pattern to the gsd version:
    - Expand its Step 6 executor prompt with the same STATE.md + commit constraints
    - Remove its standalone Step 7 and Step 8
    - Update "After executor returns" to display the completion banner
    - For --full mode Step 6.5: orchestrator updates Status cell after verifier runs
  </action>
  <verify>
    Read the updated `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md`:
    - Confirm Step 7 ("Update STATE.md") is gone as a standalone orchestrator section
    - Confirm Step 8 ("Final commit and completion") is gone as a standalone orchestrator section
    - Confirm the Step 6 executor Task() prompt constraints include STATE.md update instructions
    - Confirm the Step 6 executor Task() prompt constraints include the final commit command
    - Confirm Step 6 "After executor returns" displays the completion banner

    Read the updated `/Users/jonathanborduas/.claude/get-shit-done/workflows/quick.md`:
    - Same checks (no standalone Steps 7/8, executor handles state + commit)
  </verify>
  <done>
    Both quick.md workflow files have Steps 7 and 8 removed as orchestrator-inline sections.
    The executor Task() prompt contains STATE.md update and final commit instructions.
    The orchestrator's role is: init, spawn planner, (optional) spawn checker, spawn quorum,
    spawn executor, (optional) spawn verifier + status update, display completion banner.
  </done>
</task>

<task type="auto">
  <name>Task 2: Move quorum plan-content read into sub-agent (pass path, not content)</name>
  <files>/Users/jonathanborduas/.claude/qgsd/workflows/quick.md</files>
  <action>
    In Step 5.7 of `/Users/jonathanborduas/.claude/qgsd/workflows/quick.md`, the current
    instruction is:

    > "Read the full plan content from `${QUICK_DIR}/${next_num}-PLAN.md`."
    > "Spawn the quorum orchestrator sub-agent:"
    > prompt: "claude_vote: [...]\nartifact: [Full plan content from ${QUICK_DIR}/${next_num}-PLAN.md]"

    This causes the orchestrator to read the plan file into its own context before passing it to
    the quorum sub-agent — defeating the purpose of delegation.

    Change Step 5.7 as follows:

    1. **Remove the "Read the full plan content" instruction** from the orchestrator.
       The orchestrator must NOT read the plan file itself.

    2. **Change the quorum orchestrator prompt** to pass the plan file path instead of content.
       Update the prompt to:

       ```
       Task(
         subagent_type="qgsd-quorum-orchestrator",
         description="Quorum review: quick plan ${next_num}",
         prompt="claude_vote: [Your APPROVE/BLOCK vote with 1-2 sentence rationale based on the
       task description: ${DESCRIPTION}. Vote based on whether the plan structure addresses the
       task, not on plan file content — you have not read it.]

       artifact_path: ${QUICK_DIR}/${next_num}-PLAN.md

       Instructions for quorum orchestrator: Read the plan file at artifact_path before polling
       quorum workers. Pass the plan content to workers as part of your quorum prompt."
       )
       ```

    3. **Update the orchestrator's "Form your own position" instruction** in Step 5.7 to say:
       "Form your own position based on the task description and the planner's reported summary
       (do NOT read the plan file — pass the path to the quorum orchestrator instead)."

    Also update the `qgsd-quorum-orchestrator.md` agent file if it needs to be taught to read
    a `artifact_path` reference. First read
    `/Users/jonathanborduas/.claude/agents/qgsd-quorum-orchestrator.md` to understand its current
    protocol. If it already handles file paths for artifacts, no change needed. If it only accepts
    inline content, add a note that when `artifact_path` is provided instead of `artifact`, it
    should read the file at that path before forming its questions for quorum workers.
  </action>
  <verify>
    Read the updated quick.md Step 5.7:
    - Confirm there is no "Read the full plan content from..." instruction in the orchestrator step
    - Confirm the Task() prompt passes `artifact_path:` not `artifact: [Full plan content]`
    - Confirm orchestrator's self-vote is based on task description, not file content

    Read qgsd-quorum-orchestrator.md:
    - Confirm it handles artifact_path (reads file if path provided) or already did
  </verify>
  <done>
    The orchestrator no longer reads plan file contents into its own context at Step 5.7.
    The quorum orchestrator sub-agent receives the plan file path and reads it independently.
    Orchestrator context savings: entire plan file content no longer loaded between sub-agent calls.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:
1. Run: grep -n "Read the full plan content" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
   Expected: no match (plan content read removed from orchestrator)
2. Run: grep -n "Step 7\|Step 8\|Update STATE.md\|Final commit" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
   Expected: Step 7 and Step 8 should not appear as section headers; STATE.md update should only
   appear inside the executor Task() prompt block
3. Run: grep -n "artifact_path" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
   Expected: at least one match in Step 5.7
4. Run: grep -n "activity-clear\|commit.*docs(quick" /Users/jonathanborduas/.claude/qgsd/workflows/quick.md
   Expected: these appear inside the executor constraints block, not as standalone orchestrator steps
</verification>

<success_criteria>
- Orchestrator reads no file content between sub-agent calls (no inline Read of plan files)
- STATE.md update is inside executor Task() prompt constraints
- Final commit is inside executor Task() prompt constraints
- Quorum step uses artifact_path, not embedded plan content
- Orchestrator role reduced to: init bash, create dir, spawn agents, route results, display banner
- Both qgsd and gsd versions of quick.md updated consistently
</success_criteria>

<output>
After completion, create `.planning/quick/43-we-need-to-review-the-qgsd-quick-command/43-SUMMARY.md`
</output>
