<purpose>

Start a new milestone cycle for an existing project. Loads project context, gathers milestone goals (from MILESTONE-CONTEXT.md or conversation), updates PROJECT.md and STATE.md, optionally runs parallel research, defines scoped requirements with REQ-IDs, spawns the roadmapper to create phased execution plan, and commits all artifacts. Brownfield equivalent of new-project.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Load Context

- Read PROJECT.md (existing project, validated requirements, decisions)
- Read MILESTONES.md (what shipped previously)
- Read STATE.md (pending todos, blockers)
- Check for MILESTONE-CONTEXT.md (from /nf:discuss-milestone)

## 2. Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:**
- Use features and scope from discuss-milestone
- Present summary for confirmation

**If no context file:**
- Present what shipped in last milestone
- Ask: "What do you want to build next?"
- Use AskUserQuestion to explore features, priorities, constraints, scope

## 3. Determine Milestone Version

- Parse last version from MILESTONES.md
- Suggest next version (v1.0 → v1.1, or v2.0 for major)
- Confirm with user

## 4. Update PROJECT.md

Add/update:

```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence describing milestone focus]

**Target features:**
- [Feature 1]
- [Feature 2]
- [Feature 3]
```

Update Active requirements section and "Last updated" footer.

## 5. Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section from previous milestone.

## 6. Cleanup and Commit

Delete MILESTONE-CONTEXT.md if exists (consumed).

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs: start milestone v[X.Y] [Name]" --files .planning/PROJECT.md .planning/STATE.md
```

## 7. Load Context and Resolve Models

```bash
INIT=$(node ~/.claude/qgsd/bin/gsd-tools.cjs init new-milestone)
```

Extract from init JSON: `researcher_model`, `synthesizer_model`, `roadmapper_model`, `commit_docs`, `research_enabled`, `current_milestone`, `project_exists`, `roadmap_exists`.

## 8. Research Decision

AskUserQuestion: "Research the domain ecosystem for new features before defining requirements?"
- "Research first (Recommended)" — Discover patterns, features, architecture for NEW capabilities
- "Skip research" — Go straight to requirements

**Persist choice to config** (so future `/nf:plan-phase` honors it):

```bash
# If "Research first": persist true
node ~/.claude/qgsd/bin/gsd-tools.cjs config-set workflow.research true

# If "Skip research": persist false
node ~/.claude/qgsd/bin/gsd-tools.cjs config-set workflow.research false
```

**If "Research first":**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► RESEARCHING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning 4 researchers in parallel...
  → Stack, Features, Architecture, Pitfalls
```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"new_milestone\",\"sub_activity\":\"researching\"}"
```

```bash
mkdir -p .planning/research
```

Spawn 4 parallel qgsd-project-researcher agents. Each uses this template with dimension-specific fields:

**Common structure for all 4 researchers:**
```
Task(prompt="
<research_type>Project Research — {DIMENSION} for [new features].</research_type>

<milestone_context>
SUBSEQUENT MILESTONE — Adding [target features] to existing app.
{EXISTING_CONTEXT}
Focus ONLY on what's needed for the NEW features.
</milestone_context>

<question>{QUESTION}</question>

<files_to_read>
- .planning/PROJECT.md (Project context)
</files_to_read>

<downstream_consumer>{CONSUMER}</downstream_consumer>

<quality_gate>{GATES}</quality_gate>

<output>
Write to: .planning/research/{FILE}
Use template: ~/.claude/qgsd/templates/research-project/{FILE}
</output>
", subagent_type="qgsd-project-researcher", model="{researcher_model}", description="{DIMENSION} research")
```

**Dimension-specific fields:**

| Field | Stack | Features | Architecture | Pitfalls |
|-------|-------|----------|-------------|----------|
| EXISTING_CONTEXT | Existing validated capabilities (DO NOT re-research): [from PROJECT.md] | Existing features (already built): [from PROJECT.md] | Existing architecture: [from PROJECT.md or codebase map] | Focus on common mistakes when ADDING these features to existing system |
| QUESTION | What stack additions/changes are needed for [new features]? | How do [target features] typically work? Expected behavior? | How do [target features] integrate with existing architecture? | Common mistakes when adding [target features] to [domain]? |
| CONSUMER | Specific libraries with versions for NEW capabilities, integration points, what NOT to add | Table stakes vs differentiators vs anti-features, complexity noted, dependencies on existing | Integration points, new components, data flow changes, suggested build order | Warning signs, prevention strategy, which phase should address it |
| GATES | Versions current (verify with Context7), rationale explains WHY, integration considered | Categories clear, complexity noted, dependencies identified | Integration points identified, new vs modified explicit, build order considers deps | Pitfalls specific to adding these features, integration pitfalls covered, prevention actionable |
| FILE | STACK.md | FEATURES.md | ARCHITECTURE.md | PITFALLS.md |

After all 4 complete, spawn synthesizer:

```
Task(prompt="
Synthesize research outputs into SUMMARY.md.

<files_to_read>
- .planning/research/STACK.md
- .planning/research/FEATURES.md
- .planning/research/ARCHITECTURE.md
- .planning/research/PITFALLS.md
</files_to_read>

Write to: .planning/research/SUMMARY.md
Use template: ~/.claude/qgsd/templates/research-project/SUMMARY.md
Commit after writing.
", subagent_type="qgsd-research-synthesizer", model="{synthesizer_model}", description="Synthesize research")
```

Display key findings from SUMMARY.md:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► RESEARCH COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Stack additions:** [from SUMMARY.md]
**Feature table stakes:** [from SUMMARY.md]
**Watch Out For:** [from SUMMARY.md]
```

**If "Skip research":** Continue to Step 8.5.

## 8.5. Project Profile Selection

**Check for existing profile in PROJECT.md:**

```bash
EXISTING_PROFILE=$(grep -oP 'Profile:\s*\K\w+' .planning/PROJECT.md 2>/dev/null || echo "")
```

**If profile exists:** Present it for confirmation:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "Continue with existing project profile?",
    multiSelect: false,
    options: [
      { label: "Keep: [existing profile label]", description: "Same project type as previous milestone" },
      { label: "Change profile", description: "Project type has changed" }
    ]
  }
])
```

If "Keep" -> use existing profile. If "Change" -> show full picker (same as new-project Step 6.5).

**If no profile exists:** Show full picker:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "What type of project is this?",
    multiSelect: false,
    options: [
      { label: "Web Application", description: "Browser-based app with UI, APIs, and user sessions" },
      { label: "Mobile Application", description: "Native or hybrid mobile app" },
      { label: "Desktop Application", description: "Native desktop app (Electron, Tauri, etc.)" },
      { label: "API Service", description: "Backend API without a user-facing UI" },
      { label: "CLI Tool", description: "Command-line interface tool or script" },
      { label: "Library / Package", description: "Reusable library consumed by other projects" }
    ]
  }
])
```

Map selection to profile key (same mapping as new-project).

Store `PROJECT_PROFILE` variable. Update PROJECT.md with `Profile: [key]` if not already present.

## 8.6. Load Baseline Requirements

**Check for existing baseline requirements in REQUIREMENTS.md:**

```bash
HAS_BASELINE=$(grep -c '## Baseline Requirements' .planning/REQUIREMENTS.md 2>/dev/null || echo "0")
```

**If baselines already exist (HAS_BASELINE > 0):**

Baseline requirements carry forward from previous milestone. Present a summary:

```
Baseline requirements from previous milestone carry forward.

[N] baseline requirements active across [M] categories.

Review baselines? (yes/no)
```

If "yes" -> present the same opt-out flow as new-project Step 6.6.
If "no" -> carry forward as-is.

**If no baselines exist (HAS_BASELINE = 0):**

Load and present baselines (same flow as new-project Step 6.6):

```bash
BASELINE=$(node bin/load-baseline-requirements.cjs --profile "$PROJECT_PROFILE")
```

Present for opt-out with multiSelect per category.

## 8.7. Sync Baselines into Formal Envelope

After baseline requirements are loaded/confirmed in Step 8.6, sync them into `.planning/formal/requirements.json`:

```bash
node bin/sync-baseline-requirements.cjs --profile "$PROJECT_PROFILE"
```

This is idempotent -- if baselines were already synced in a previous milestone, they will be skipped. Display the sync summary (added/skipped counts).

If any requirements were added, include `.planning/formal/requirements.json` in the next commit (Step 9 requirements commit or Step 6 cleanup commit, whichever comes next).

## 9. Define Requirements

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► DEFINING REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Read PROJECT.md: core value, current milestone goals, validated requirements (what exists).

**If research exists:** Read FEATURES.md, extract feature categories.

Present features by category:
```
## [Category 1]
**Table stakes:** Feature A, Feature B
**Differentiators:** Feature C, Feature D
**Research notes:** [any relevant notes]
```

**If no research:** Gather requirements through conversation. Ask: "What are the main things users need to do with [new features]?" Clarify, probe for related capabilities, group into categories.

**Scope each category** via AskUserQuestion (multiSelect: true, header max 12 chars):
- "[Feature 1]" — [brief description]
- "[Feature 2]" — [brief description]
- "None for this milestone" — Defer entire category

Track: Selected → this milestone. Unselected table stakes → future. Unselected differentiators → out of scope.

**Identify gaps** via AskUserQuestion:
- "No, research covered it" — Proceed
- "Yes, let me add some" — Capture additions

**Generate REQUIREMENTS.md:**
- Baseline Requirements section (if new to this milestone)
- Milestone v[X.Y] Requirements grouped by category (checkboxes, REQ-IDs)
- Future Requirements (deferred)
- Out of Scope (explicit exclusions with reasoning)
- Traceability section (empty, filled by roadmap)

**Include baseline requirements in REQUIREMENTS.md:**

If this is the first milestone with baselines, add a `## Baseline Requirements` section before `## Milestone v[X.Y] Requirements`:

```markdown
## Baseline Requirements

*Included from QGSD baseline defaults (profile: [profile]). Cross-cutting quality gates.*

### [Category]
- [x] **UX-01**: [text]
...
```

If baselines carried forward from a previous milestone, preserve the existing `## Baseline Requirements` section (with any user modifications from Step 8.6).

**REQ-ID format:** `[CATEGORY]-[NUMBER]` (AUTH-01, NOTIF-02). Continue numbering from existing.

**Requirement quality criteria:**

Good requirements are:
- **Specific and testable:** "User can reset password via email link" (not "Handle password reset")
- **User-centric:** "User can X" (not "System does Y")
- **Atomic:** One capability per requirement (not "User can login and manage profile")
- **Independent:** Minimal dependencies on other requirements

Present FULL requirements list for confirmation:

```
## Milestone v[X.Y] Requirements

### [Category 1]
- [ ] **CAT1-01**: User can do X
- [ ] **CAT1-02**: User can do Y

### [Category 2]
- [ ] **CAT2-01**: User can do Z

Does this capture what you're building? (yes / adjust)
```

If "adjust": Return to scoping.

**Commit requirements:**
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs: define milestone v[X.Y] requirements" --files .planning/REQUIREMENTS.md
```

## 9.5. Formal Scope Scan (Pre-Roadmapper)

```bash
## Step 9.5: Formal scope scan (pre-roadmapper)

FORMAL_SPEC_CONTEXT=()

if [ -d ".planning/formal/spec" ]; then
  echo "◆ Formal scope scan (pre-roadmapper)..."
  # Use milestone goal description as keyword source.
  # Extract from PROJECT.md ## Current Milestone section (written by Step 4).
  MILESTONE_GOAL=$(grep -A3 "## Current Milestone" .planning/PROJECT.md 2>/dev/null | grep -v "## Current Milestone" | head -1 | sed 's/^[[:space:]]*//')
  if [ -z "$MILESTONE_GOAL" ]; then
    # Fallback: use milestone name variable if goal not found in PROJECT.md
    MILESTONE_GOAL="${MILESTONE_NAME:-}"
  fi
  MILESTONE_DESC_LOWER=$(echo "${MILESTONE_GOAL}" | tr '[:upper:]' '[:lower:]')

  for MODULE_DIR in .planning/formal/spec/*/; do
    MODULE=$(basename "$MODULE_DIR")
    INVARIANTS_FILE=".planning/formal/spec/${MODULE}/invariants.md"
    if [ -f "$INVARIANTS_FILE" ]; then
      MODULE_LOWER=$(echo "$MODULE" | tr '[:upper:]' '[:lower:]')
      MATCHED=0
      for KEYWORD in $(echo "$MILESTONE_DESC_LOWER" | tr ' -/' '\n' | grep -v '^$'); do
        if echo "$MODULE_LOWER" | grep -qF "$KEYWORD" || echo "$KEYWORD" | grep -qF "$MODULE_LOWER"; then
          MATCHED=1
          break
        fi
      done
      if [ "$MATCHED" -eq 1 ]; then
        FORMAL_SPEC_CONTEXT+=("{\"module\":\"${MODULE}\",\"path\":\"${INVARIANTS_FILE}\"}")
      fi
    fi
  done

  MATCH_COUNT=${#FORMAL_SPEC_CONTEXT[@]}
  if [ "$MATCH_COUNT" -gt 0 ]; then
    MATCHED_MODULES=$(for e in "${FORMAL_SPEC_CONTEXT[@]}"; do echo "$e" | sed 's/.*"module":"\([^"]*\)".*/\1/'; done | tr '\n' ',' | sed 's/,$//')
    echo "◆ Formal scope scan: found ${MATCH_COUNT} module(s): ${MATCHED_MODULES}"
  else
    echo "◆ Formal scope scan: no keyword-matched modules (fail-open)"
  fi
fi

# Build formal files list for injection
FORMAL_FILES_BLOCK=""
if [ ${#FORMAL_SPEC_CONTEXT[@]} -gt 0 ]; then
  for ENTRY in "${FORMAL_SPEC_CONTEXT[@]}"; do
    MODULE=$(echo "$ENTRY" | sed 's/.*"module":"\([^"]*\)".*/\1/')
    FPATH=$(echo "$ENTRY" | sed 's/.*"path":"\([^"]*\)".*/\1/')
    FORMAL_FILES_BLOCK+="- ${FPATH} (Formal invariants for module: ${MODULE})"$'\n'
  done
fi

# Build formal_context block for injection
if [ ${#FORMAL_SPEC_CONTEXT[@]} -gt 0 ]; then
  MATCHED_MODULES_LIST=$(for e in "${FORMAL_SPEC_CONTEXT[@]}"; do echo "$e" | sed 's/.*"module":"\([^"]*\)".*/\1/'; done | tr '\n' ',' | sed 's/,$//')
  FORMAL_CONTEXT_BLOCK="Relevant formal modules identified: ${MATCHED_MODULES_LIST}

When deriving success criteria for phases that cover these modules:
- Read the injected invariants.md files
- Include at least one success criterion per matched-module phase that reflects the formal invariant's observable behavior
- Success criteria must be observable behaviors, not formal notation (translate invariants to user-visible outcomes)
- Example: EventualConsensus invariant -> \"Quorum reaches a DECIDED state on every run with at least one responding slot\""
else
  FORMAL_CONTEXT_BLOCK="No formal modules matched this milestone scope. Proceed with standard roadmap creation."
fi
```

## 10. Create Roadmap

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► CREATING ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning roadmapper...
```

**Starting phase number:** Read MILESTONES.md for last phase number. Continue from there (v1.0 ended at phase 5 → v1.1 starts at phase 6).

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"new_milestone\",\"sub_activity\":\"creating_roadmap\"}"
```

```
Task(prompt="
<planning_context>
<files_to_read>
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json
- .planning/MILESTONES.md
${FORMAL_FILES_BLOCK}
</files_to_read>
</planning_context>

<formal_context>
${FORMAL_CONTEXT_BLOCK}
</formal_context>

<instructions>
Create roadmap for milestone v[X.Y]:
1. Start phase numbering from [N]
2. Derive phases from THIS MILESTONE's requirements only
3. Map every requirement to exactly one phase
4. Derive 2-5 success criteria per phase (observable user behaviors)
5. When formal context is non-empty, use invariants to sharpen criteria for matched phases
6. Validate 100% coverage
7. Write files immediately (ROADMAP.md, STATE.md, update REQUIREMENTS.md traceability)
8. Return ROADMAP CREATED with summary

Write files first, then return.
</instructions>
", subagent_type="qgsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**Handle return:**

**If `## ROADMAP BLOCKED`:** Present blocker, work with user, re-spawn.

**If `## ROADMAP CREATED`:** Read ROADMAP.md, present inline:

```
## Proposed Roadmap

**[N] phases** | **[X] requirements mapped** | All covered ✓

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| [N] | [Name] | [Goal] | [REQ-IDs] | [count] |

### Phase Details

**Phase [N]: [Name]**
Goal: [goal]
Requirements: [REQ-IDs]
Success criteria:
1. [criterion]
2. [criterion]
```

**Ask for approval** via AskUserQuestion:
- "Approve" — Commit and continue
- "Adjust phases" — Tell me what to change
- "Review full file" — Show raw ROADMAP.md

**If "Adjust":** Get notes, re-spawn roadmapper with revision context, loop until approved.
**If "Review":** Display raw ROADMAP.md, re-ask.

**Commit roadmap** (after approval):
```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "docs: create milestone v[X.Y] roadmap ([N] phases)" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

## 11. Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal]

`/nf:discuss-phase [N]` — gather context and clarify approach

<sub>`/clear` first → fresh context window</sub>

Also: `/nf:plan-phase [N]` — skip discussion, plan directly
```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

**Auto-advance check:**

```bash
AUTO_CFG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs config-get workflow.auto_advance 2>/dev/null || echo "true")
FIRST_PHASE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs roadmap list-phases 2>/dev/null | jq -r '.[0].phase_number // empty')
# Fallback: extract first phase number from ROADMAP.md if tool unavailable
if [ -z "$FIRST_PHASE" ]; then
  FIRST_PHASE=$(grep -m1 "^### Phase [0-9]" .planning/ROADMAP.md | grep -o '[0-9]*' | head -1)
fi
```

**If `AUTO_CFG` is true AND `FIRST_PHASE` is set:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 QGSD ► AUTO-ADVANCING TO PLAN PHASE ${FIRST_PHASE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Roadmap complete. Spawning plan-phase...
```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-set \
  "{\"activity\":\"new_milestone\",\"sub_activity\":\"plan_phase_${FIRST_PHASE}\"}"
```

```
Task(
  prompt="Run /nf:plan-phase ${FIRST_PHASE}",
  subagent_type="general-purpose",
  description="Plan Phase ${FIRST_PHASE}"
)
```

**Handle plan-phase return:**
- **PLANNING COMPLETE** → Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   QGSD ► PHASE ${FIRST_PHASE} PLANNED ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished.

  Next: /nf:execute-phase ${FIRST_PHASE}
  ```
- **Other / error** → Display result, stop chain:
  ```
  Auto-advance stopped: Planning needs review.

  Continue manually:
  /nf:plan-phase ${FIRST_PHASE}
  ```

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs activity-clear
```

**If `AUTO_CFG` is false OR `FIRST_PHASE` is empty:**

Show existing "Next Up" prompt (already in the Done banner — no change needed to that section).

</process>

<success_criteria>
- [ ] PROJECT.md updated with Current Milestone section
- [ ] STATE.md reset for new milestone
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Project profile confirmed or selected
- [ ] Baseline requirements loaded (new) or carried forward (existing)
- [ ] Research completed (if selected) — 4 parallel agents, milestone-aware
- [ ] Requirements gathered and scoped per category
- [ ] REQUIREMENTS.md includes Baseline Requirements section
- [ ] REQUIREMENTS.md created with REQ-IDs
- [ ] qgsd-roadmapper spawned with phase numbering context
- [ ] Roadmap files written immediately (not draft)
- [ ] User feedback incorporated (if any)
- [ ] ROADMAP.md phases continue from previous milestone
- [ ] All commits made (if planning docs committed)
- [ ] Auto-advance spawns plan-phase task when AUTO_CFG is true; otherwise user sees `/nf:discuss-phase [N]`

**Atomic commits:** Each phase commits its artifacts immediately.
</success_criteria>
