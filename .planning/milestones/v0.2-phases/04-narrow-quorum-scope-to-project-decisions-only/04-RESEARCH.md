# Phase 4: Narrow Quorum Scope to Project Decisions Only - Research

**Researched:** 2026-02-20
**Domain:** Claude Code Stop hook — transcript analysis, GSD command turn classification
**Confidence:** HIGH (this is entirely a self-contained codebase problem; all evidence is local)

---

## Summary

Phase 4 addresses a scoping problem in the Stop hook: quorum fires on every Stop event within a turn that contains an allowlisted GSD command, regardless of whether Claude's response in that turn is a final project decision or an intermediate GSD-internal operation (routing, questioning, agent orchestration, file management).

The user's observation is precise: `/gsd:map-codebase`, `/gsd:new-project` routing steps, `/gsd:discuss-phase` intermediate messages, `/gsd:add-phase` confirmation, and `/gsd:plan-phase` intermediate turns (spawning agents, waiting for results) all trigger the quorum gate even though none of these turns deliver a project decision. Only turns where Claude actually delivers a plan, roadmap, research result, or verification report to the user require quorum.

The fix requires distinguishing "GSD internal operation" turns from "project decision delivery" turns within the same session. There are two candidate signals for this classification: (1) the `last_assistant_message` field in the Stop event payload, and (2) the final assistant message content in the JSONL transcript. The critical architectural constraint, established in Phase 1, is that `last_assistant_message` substring matching was rejected as an unreliable signal — JSONL parsing is the authoritative path. Phase 4 must resolve the correct signal for turn classification without violating this constraint.

**Primary recommendation:** Introduce a GSD-specific structured marker in Claude's output that identifies "decision delivery" turns, and have the Stop hook scan for this marker before triggering quorum verification. The marker approach is reliable, explicit, and does not require heuristic substring matching.

---

## The Core Problem in Depth

### Current behavior

`hasQuorumCommand()` in `qgsd-stop.js` checks whether any user message in the current turn contains a `quorum_commands` entry. If true, quorum is enforced on that Stop event. But a multi-turn GSD workflow generates many Stop events within a single logical user session. Example trace for `/gsd:plan-phase 1`:

```
Turn 1: User types /gsd:plan-phase 1
  → Claude spawns gsd-phase-researcher agent
  → Stop fires: quorum enforced ← OVERKILL (intermediate agent spawn)

Turn 2: Agent spawning complete message
  → Stop fires: hasQuorumCommand still true (same user message in window)
  → quorum enforced ← OVERKILL (status message)

Turn 3: Claude spawns gsd-planner agent
  → Stop fires: quorum enforced ← OVERKILL

Turn 4: Claude presents final plan
  → Stop fires: quorum enforced ← CORRECT
```

The root cause: `getCurrentTurnLines()` finds the most recent human message boundary and returns all lines since then. Since the user typed `/gsd:plan-phase 1` once, that user message remains the boundary for all subsequent Stop events in the same workflow run, so `hasQuorumCommand()` returns true for every Stop call in the workflow.

### What constitutes a "project decision" turn

From the user's design principle and the CLAUDE.md R3.1 mandate, quorum is required only when Claude is delivering:
- A phase plan (PLAN.md files created, presented to user)
- A roadmap (ROADMAP.md created)
- A research result (RESEARCH.md presented)
- A verification report (verify-work output)
- A requirements document (new-project output)
- A discuss-phase filtered question list

GSD internal operations that do NOT require quorum:
- Routing steps ("Running /gsd:map-codebase first...")
- Questioning steps ("What do you want to build?")
- Agent spawning messages ("Spawning researcher...")
- Status banners (GSD progress indicators)
- File operation confirmations ("Committed: docs...")
- `/gsd:add-phase` updating roadmap
- `/gsd:map-codebase` file output
- Any turn that ends with AskUserQuestion (a question, not a decision)

---

## Signal Analysis: How to Classify a Turn

### Signal 1: last_assistant_message (REJECTED in Phase 1)

The Stop event payload includes `last_assistant_message` (a string). This was analyzed during Phase 1 gap closure and explicitly rejected as unreliable:

> "last_assistant_message substring matching is not a reliable signal; Claude could summarize results in prose without naming tool prefixes"

The same rejection logic applies to turn classification: Claude could describe a routing step in prose that happens to use words from the decision vocabulary, or could deliver a final decision without using any distinguishing keywords. Substring matching on this field is fragile.

**Verdict: Do not use last_assistant_message for turn classification.**

### Signal 2: Structured output markers in JSONL

The JSONL transcript is the authoritative signal. If Claude writes a structured marker into its output as part of delivering a project decision, the Stop hook can find this marker in the final assistant message block in the JSONL and use it as a reliable trigger.

Two sub-options:

**Option A: Claude adds a structured text token to decision outputs**

A token like `<!-- QUORUM_DECISION -->` or `<quorum-decision/>` embedded in the final assistant message. The Stop hook scans the last assistant message block in `currentTurnLines` for this token. If found: enforce quorum. If not found: pass.

- **Pro:** Explicit, reliable, no heuristics.
- **Con:** Requires Claude to remember to add the marker. This is behavioral, not structural — the same failure mode as pre-Phase 1 quorum instruction following.

**Option B: Claude adds the marker via UserPromptSubmit injection**

The UserPromptSubmit hook already injects quorum instructions into Claude's context. It could additionally inject an instruction to include a specific structured token in its final output when delivering a project decision. The Stop hook then looks for that token.

- **Pro:** Reinforces the behavioral expectation from the injection side.
- **Con:** Same fragility as Option A — still behavioral.

**Option C: Classify turns by what Claude's output contains (content-based heuristics)**

Scan the final assistant message block for patterns that strongly indicate a project decision was delivered:
- Presence of a PLAN.md file write (Bash tool call with `gsd-tools.cjs commit` for plan files)
- Presence of a ROADMAP.md commit
- Presence of a RESEARCH.md write

This would not scan prose — it would scan tool_use blocks in the JSONL for the gsd-tools commit pattern. If the current turn includes a commit of plan/research/roadmap artifacts, quorum is required.

- **Pro:** Structurally enforced — Claude writes files, not prose. The Bash tool_use blocks are reliable JSONL evidence.
- **Con:** Not all decision deliveries commit files (e.g., a verification report might be purely text). Verification must be covered separately.

**Option D: Quorum scope narrowed at command level — remove intermediate commands from allowlist**

Instead of modifying the Stop hook's turn detection logic, narrow the allowlist. `/gsd:map-codebase` is not a planning command. `/gsd:add-phase` is not a planning command. The current allowlist (`plan-phase`, `new-project`, `new-milestone`, `discuss-phase`, `verify-work`, `research-phase`) already excludes `map-codebase` and `add-phase` from the UserPromptSubmit injection — but the Stop hook still sees the `/gsd:plan-phase` user message from earlier in the session.

This is the key insight: the Stop hook's `hasQuorumCommand()` is doing command-level filtering correctly. The problem is not the command list — it is that intermediate turns within an allowlisted command are indistinguishable from the final turn.

**Verdict for Signal 2:** Option C (artifact commit detection) is the most structurally reliable sub-option for the artifact-producing cases. Option B is the backstop for non-artifact-producing decisions (verification reports). A hybrid is the correct approach.

### Signal 3: Turn position detection — "is this the last turn in the workflow?"

The Stop hook cannot know if a turn is "the last turn" before the next user message — it fires on every Stop event. This is not a usable signal.

### Signal 4: GSD-outputted structured JSON marker via tool call

Instead of embedded text, Claude could call a lightweight MCP tool or Bash command that writes a marker file (e.g., `/tmp/qgsd-decision-{session_id}`) when about to deliver a project decision. The Stop hook reads this file to determine if quorum is required.

- **Pro:** Durable across context compaction (file persists). No JSONL parsing complexity.
- **Con:** Adds a session-state file; cleanup required; introduces new failure mode if file not written.
- **Verdict:** Interesting but adds complexity. The JSONL approach is self-contained.

---

## Architecture Patterns

### Pattern 1: Artifact Commit Detection (Recommended Primary Signal)

The most robust approach for plan/research/roadmap decisions:

In `qgsd-stop.js`, after `hasQuorumCommand()` confirms an allowlisted command is in scope, scan `currentTurnLines` for Bash `tool_use` blocks that call `gsd-tools.cjs commit` with plan, research, or roadmap file arguments.

```javascript
// Returns true if any Bash tool call in currentTurnLines committed planning artifacts
function hasArtifactCommit(currentTurnLines) {
  const artifactPatterns = [
    /-PLAN\.md/,
    /-RESEARCH\.md/,
    /ROADMAP\.md/,
    /REQUIREMENTS\.md/,
  ];
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        if (block.name !== 'Bash') continue;
        const cmd = JSON.stringify(block.input || '');
        if (artifactPatterns.some(p => p.test(cmd))) return true;
      }
    } catch { /* skip */ }
  }
  return false;
}
```

If `hasArtifactCommit()` returns false, the Stop hook passes regardless of whether an allowlisted command was issued.

**Coverage by command:**

| Command | Artifact committed? | Covered by this signal? |
|---------|--------------------|-----------------------|
| `/gsd:plan-phase` (final) | Yes — PLAN.md files | Yes |
| `/gsd:plan-phase` (intermediate spawning turn) | No | Correctly excluded |
| `/gsd:new-project` (routing, questioning) | No | Correctly excluded |
| `/gsd:new-project` (final — roadmap created) | Yes — ROADMAP.md, REQUIREMENTS.md | Yes |
| `/gsd:research-phase` (final) | Yes — RESEARCH.md | Yes |
| `/gsd:verify-work` (final) | Possibly — verification docs | Needs verification |
| `/gsd:discuss-phase` (intermediate) | No | Correctly excluded |
| `/gsd:discuss-phase` (final — CONTEXT.md) | Yes — CONTEXT.md | Must add CONTEXT.md to patterns |
| `/gsd:map-codebase` (any turn) | Only codebase/*.md | Must NOT match these |
| `/gsd:add-phase` (confirmation) | Yes — ROADMAP.md update | Need to distinguish from plan-phase roadmap |
| `/gsd:new-milestone` (final) | Yes — roadmap update | Yes |

**Critical edge cases:**

1. `/gsd:map-codebase` does commit `.planning/codebase/*.md` files — these must NOT trigger quorum. The artifact pattern must be precise enough to match planning artifacts but not codebase mapping artifacts. Paths like `STACK.md`, `ARCHITECTURE.md` appear in both codebase mapping and project research; pattern matching must use path context (`-PLAN.md`, `-RESEARCH.md`, `ROADMAP.md`, `REQUIREMENTS.md`).

2. `/gsd:add-phase` commits `ROADMAP.md` — this is a GSD file management operation, not a project decision. If `ROADMAP.md` commit triggers quorum, `/gsd:add-phase` would be incorrectly caught. However, `/gsd:add-phase` is not in the `quorum_commands` list, so `hasQuorumCommand()` would not find it — no issue.

3. `/gsd:discuss-phase` commits `CONTEXT.md` (via `padded_phase-CONTEXT.md`). This is a planning decision that should require quorum (it is the filtered question list for the phase). Adding `-CONTEXT.md` to the artifact pattern covers it.

4. `/gsd:verify-work` — need to check what files it commits. If it produces a VERIFICATION.md or similar structured output, the pattern covers it.

### Pattern 2: Explicit Decision Marker (Backstop Signal)

For turns where a decision is delivered without a file commit (e.g., a verbal verification report, an intermediate discuss-phase result, or a research summary presented in chat without a file), the UserPromptSubmit hook should inject a supplemental instruction:

```
When you have completed all planning work and are about to deliver your FINAL output
(not an intermediate status message), include this exact token in your response:
<!-- GSD_DECISION -->
```

The Stop hook scans for `<!-- GSD_DECISION -->` in the final assistant message block in JSONL. If found, quorum is required regardless of artifact detection.

This is a behavioral backstop — it can be defeated by Claude omitting the token — but it mirrors the existing quorum call instruction (also behavioral, also verified structurally). The combination of artifact detection (structural) + decision marker (behavioral backstop) provides defense in depth.

### Pattern 3: Exclusion List for GSD-Internal Operations

An alternative approach: instead of detecting decision turns positively, explicitly exclude known GSD-internal operations from quorum enforcement.

The Stop hook could check whether the current turn contains only:
- AskUserQuestion tool calls (questions, not decisions)
- Bash tool calls matching GSD status/routing patterns
- Agent spawn (Task tool calls without a preceding artifact commit)

If only these are found, pass without quorum.

**Assessment:** This is a negative-exclusion approach (block unless excluded) versus the positive-detection approach (pass unless decision detected). Negative exclusion is harder to maintain — each new GSD internal operation requires adding to the exclusion list. The positive detection approach (artifact + marker) is more robust because it only triggers on explicit decision signals.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distinguishing final turn from intermediate turns | Custom session state tracking | Artifact commit detection in JSONL | Session state is fragile; JSONL is authoritative |
| Turn intent classification | Prose NLP / keyword matching | Structured artifact patterns | NLP is fragile; file paths are machine-readable |
| Behavioral enforcement | Trusting Claude's marker | Structural artifact detection as primary | Behavioral is fragile; structural is the Phase 1 lesson |

---

## Common Pitfalls

### Pitfall 1: Treating last_assistant_message as reliable

**What goes wrong:** The developer adds `last_assistant_message.includes('PLAN')` or similar substring check to classify turns.
**Why it happens:** It's the lowest-effort path — the field is right there in the Stop payload.
**How to avoid:** Phase 1 explicitly rejected this. The JSONL is authoritative. Use `currentTurnLines` assistant blocks only.
**Warning signs:** Any test that relies on the content of `last_assistant_message` for classification.

### Pitfall 2: Missing the /gsd:map-codebase false-positive edge case

**What goes wrong:** The artifact pattern `STACK.md` matches both `/gsd:map-codebase` (codebase/STACK.md) and project research (research/STACK.md). Quorum fires on map-codebase.
**Why it happens:** Shared file names across GSD operations.
**How to avoid:** Use path-specific patterns. `codebase/STACK.md` is not a planning artifact; `-RESEARCH.md` suffix patterns are specific to phase research. Never match bare `STACK.md` or `ARCHITECTURE.md`.
**Warning signs:** A TC covering map-codebase that passes when it should (no quorum triggered).

### Pitfall 3: Over-broad artifact patterns catch /gsd:add-phase

**What goes wrong:** Pattern `ROADMAP.md` triggers quorum when `/gsd:add-phase` updates the roadmap, even though add-phase is not a planning decision.
**Why it happens:** `ROADMAP.md` is committed by both `new-project` (decision) and `add-phase` (GSD management).
**How to avoid:** `/gsd:add-phase` is not in `quorum_commands`, so `hasQuorumCommand()` will not match it. The guards run in order: hasQuorumCommand first, then artifact detection. This is already safe by the existing architecture — no change needed.
**Warning signs:** Removing the `hasQuorumCommand` guard check before artifact detection.

### Pitfall 4: Breaking the Phase 1 behavioral instruction for discuss-phase

**What goes wrong:** CLAUDE.md R3.1 says discuss-phase question filtering is "structurally enforced" via hooks. Narrowing scope might inadvertently exclude the discuss-phase final output from quorum.
**Why it happens:** Discuss-phase commits `CONTEXT.md` (e.g., `01-CONTEXT.md`). If the artifact pattern does not include `-CONTEXT.md`, the discuss-phase final turn is excluded from quorum.
**How to avoid:** Include `-CONTEXT.md` in the artifact pattern list. Verify with a dedicated TC.
**Warning signs:** Discuss-phase completes without quorum firing.

### Pitfall 5: Intermediate plan-phase turns with partial artifacts

**What goes wrong:** During a plan-phase run, the planner agent may write one PLAN.md, triggering quorum, but the orchestrator is not yet done — it is about to spawn the plan-checker. Quorum fires mid-workflow.
**Why it happens:** The planner commits plan files and the orchestrator continues. Each commit triggers a Stop event.
**How to avoid:** The planner agent runs as a subagent (`SubagentStop` exclusion — STOP-03 guard). The orchestrator's Stop fires when it presents the final summary. At that point the PLAN.md artifacts are already committed — the orchestrator's commit of STATE.md or another artifact marks the decision delivery. The artifact pattern should match what the orchestrator commits in its final turn, not what subagents commit.
**Warning signs:** Quorum fires during a subagent's Stop event. This should already be excluded by the `SubagentStop` guard — verify this is working correctly.

### Pitfall 6: Multi-turn accumulation across a new /clear

**What goes wrong:** User runs `/gsd:plan-phase 1`, then `/clear`, then continues in the same session. The JSONL transcript continues but the current turn window is clean. No user message with `/gsd:plan-phase` exists in the new window — `hasQuorumCommand` correctly returns false. No problem here. But if quorum scope narrowing introduces session state, `/clear` might reset it incorrectly.
**How to avoid:** Keep the implementation stateless — derive everything from the current JSONL window. No session state files.

---

## Code Examples

### Artifact commit detection in JSONL (primary signal)

```javascript
// Source: analysis of qgsd-stop.js + GSD workflow artifacts
// Scan currentTurnLines for Bash tool_use blocks committing planning artifacts.
// Returns true if this turn contains a planning decision artifact commit.
function hasArtifactCommit(currentTurnLines) {
  // Patterns matching planning artifacts only (not codebase mapping artifacts)
  const artifactPatterns = [
    /-PLAN\.md/,       // Phase plan files: 01-01-PLAN.md
    /-RESEARCH\.md/,   // Phase research: 04-RESEARCH.md
    /-CONTEXT\.md/,    // Discuss-phase output: 04-CONTEXT.md
    /ROADMAP\.md/,     // New-project, new-milestone
    /REQUIREMENTS\.md/, // New-project requirements
  ];
  for (const line of currentTurnLines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        // Match both Bash tool calls and the gsd-tools commit invocation
        if (block.name !== 'Bash') continue;
        const cmdStr = JSON.stringify(block.input || '');
        if (artifactPatterns.some(p => p.test(cmdStr))) return true;
      }
    } catch { /* skip */ }
  }
  return false;
}
```

### Decision marker detection (backstop signal)

```javascript
// Source: analysis of Phase 1 STOP-05 decision
// Scan the last assistant text block in currentTurnLines for the decision marker.
const DECISION_MARKER = '<!-- GSD_DECISION -->';

function hasDecisionMarker(currentTurnLines) {
  // Walk lines in reverse to find the last assistant text block
  for (let i = currentTurnLines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(currentTurnLines[i]);
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'text') continue;
        if (block.text && block.text.includes(DECISION_MARKER)) return true;
      }
      // Found the last assistant entry — no need to go further back
      break;
    } catch { /* skip */ }
  }
  return false;
}
```

### Updated main logic flow

```javascript
// After existing GUARD 4 (hasQuorumCommand check):

// GUARD 5: Only enforce quorum on project decision turns (Phase 4)
// A turn is a project decision turn if it contains a planning artifact commit
// OR an explicit decision marker. If neither, pass — this is a GSD-internal turn.
const isDecisionTurn = hasArtifactCommit(currentTurnLines) || hasDecisionMarker(currentTurnLines);
if (!isDecisionTurn) {
  process.exit(0); // GSD-internal operation — quorum not required
}

// Existing quorum evidence scan follows...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Quorum on all turns with an allowlisted command | Quorum only on project decision turns | Phase 4 | Eliminates false positives for intermediate GSD operations |
| `last_assistant_message` pre-check (rejected) | JSONL-only authoritative source | Phase 1 gap closure | Phase 4 extends this principle to turn classification |

---

## Requirements Coverage

<phase_requirements>
## Phase Requirements

This phase has no pre-assigned requirement IDs in REQUIREMENTS.md. The phase was added post-roadmap via `/gsd:add-phase` (STATE.md: "Phase 4 added: Narrow quorum scope to project decisions only"). The requirements are derived from the user's design principle stated in the additional context.

Derived requirements (to be formalized in PLAN.md):

| Derived ID | Description | Research Support |
|------------|-------------|-----------------|
| SCOPE-01 | Stop hook passes on GSD-internal operation turns within an allowlisted command session | Artifact commit detection: if no planning artifact committed, pass. Eliminates map-codebase, routing, questioning, and agent-spawning false positives. |
| SCOPE-02 | Stop hook enforces quorum when a planning artifact (PLAN.md, RESEARCH.md, CONTEXT.md, ROADMAP.md, REQUIREMENTS.md) is committed in the current turn | Primary structural signal: Bash tool_use blocks with gsd-tools commit pattern. |
| SCOPE-03 | Stop hook enforces quorum when a decision marker `<!-- GSD_DECISION -->` is present in the final assistant text block | Backstop behavioral signal for non-artifact-producing decision turns (verification reports, etc.). |
| SCOPE-04 | UserPromptSubmit hook injects instruction to include decision marker in final decision outputs | Behavioral reinforcement of SCOPE-03. |
| SCOPE-05 | Artifact pattern matching must not match codebase mapping artifacts (`.planning/codebase/*.md`) | Pitfall prevention: pattern specificity. Verified by TC covering map-codebase. |
| SCOPE-06 | All 13 existing test cases (TC1–TC13) continue to pass unchanged | Regression prevention: the Phase 1 and 2 behavior is preserved. |
| SCOPE-07 | New test cases cover: intermediate plan-phase turn (pass), final plan-phase turn (quorum required), map-codebase turn (pass), new-project routing turn (pass), discuss-phase final CONTEXT.md turn (quorum required), verify-work final turn with marker (quorum required) | Test coverage for the new turn classification logic. |

</phase_requirements>

---

## Open Questions

1. **Does `/gsd:verify-work` commit a file with a recognizable artifact pattern?**
   - What we know: verify-work is in the quorum allowlist; it produces a verification report.
   - What's unclear: Whether the report is committed as a file with a VERIFICATION.md or similar name vs. presented as pure text.
   - Recommendation: Read verify-work workflow (not done in this research — not in the files_to_read list). If it commits a recognizable artifact, add the pattern. If not, the decision marker backstop covers it.

2. **Does the decision marker injection create a new UserPromptSubmit failure mode?**
   - What we know: The marker approach is behavioral — Claude must include it in its output.
   - What's unclear: Whether the existing `additionalContext` injection reliably reaches Claude in all turn configurations (context compaction, long sessions).
   - Recommendation: The marker is a backstop, not the primary signal. The artifact detection is the primary structural enforcement. If the marker is absent but the artifact is committed, quorum fires correctly.

3. **Do any GSD commands commit `REQUIREMENTS.md` in intermediate turns?**
   - What we know: `/gsd:new-project` commits REQUIREMENTS.md as part of its final output.
   - What's unclear: Whether any other command (e.g., plan-gaps, verify-work) updates REQUIREMENTS.md in a non-decision turn.
   - Recommendation: Check GSD workflow files for REQUIREMENTS.md commits beyond new-project. If found, ensure those are also final-output turns.

4. **Pattern for `CONTEXT.md` — could a non-discuss-phase command commit a file matching `-CONTEXT.md`?**
   - What we know: discuss-phase commits `XX-CONTEXT.md`.
   - What's unclear: Whether any other GSD workflow commits a file with the same name pattern.
   - Recommendation: Low risk — CONTEXT.md is a well-known GSD artifact name specific to discuss-phase. Proceed with the pattern.

---

## Sources

### Primary (HIGH confidence)
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — Full stop hook implementation; guard ordering; JSONL parsing
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — UserPromptSubmit injection logic
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — Config loading; quorum_commands list
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.test.js` — 13 test cases; TC10 regression for tool_result user messages
- `/Users/jonathanborduas/.claude/get-shit-done/workflows/plan-phase.md` — Full plan-phase workflow; spawning pattern; artifact commits
- `/Users/jonathanborduas/.claude/get-shit-done/workflows/new-project.md` — Full new-project workflow; routing step; questioning step; roadmap agent spawn
- `/Users/jonathanborduas/.claude/get-shit-done/workflows/discuss-phase.md` — Full discuss-phase workflow; CONTEXT.md commit
- `/Users/jonathanborduas/.claude/get-shit-done/workflows/map-codebase.md` — map-codebase workflow; codebase/*.md commits
- `/Users/jonathanborduas/.claude/get-shit-done/workflows/add-phase.md` — add-phase workflow; ROADMAP.md update (not a quorum command)
- `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — v1 requirements; STOP-05 gap closure decision
- `/Users/jonathanborduas/code/QGSD/.planning/STATE.md` — Phase 4 added context; Phase 1 gap closure decision

### Secondary (MEDIUM confidence)
- Phase 1 gap closure rationale (STOP-05 revision): "last_assistant_message substring matching is not a reliable signal" — established design constraint that governs signal selection for Phase 4

---

## Metadata

**Confidence breakdown:**
- Turn classification approach (artifact detection): HIGH — all evidence is local; no external dependencies; the Bash tool_use JSONL pattern is observable and testable
- Decision marker backstop: MEDIUM — behavioral signal; verified indirectly through existing behavioral injection infrastructure
- Edge case coverage (map-codebase, add-phase, discuss-phase): HIGH — all workflows read and analyzed; GSD artifact name patterns confirmed from source
- Open questions (verify-work artifact): LOW — verify-work workflow not read; covered by backstop marker regardless

**Research date:** 2026-02-20
**Valid until:** Stable indefinitely (self-contained codebase; no external dependencies)
