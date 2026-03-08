# Phase v0.30-04: Continuous Learning - Research

**Researched:** 2026-03-07
**Domain:** Automatic pattern extraction, correction capture, quorum-validated skills, and failure catalogs
**Confidence:** HIGH

## Summary

This phase builds on the memory persistence infrastructure completed in v0.30-03 (MEMP-01 through MEMP-04). The existing `bin/memory-store.cjs` provides JSONL-based append/query/prune for three categories (decisions, errors, quorum-decisions). The four LRNG requirements extend this system with: (1) automatic extraction of error patterns from session transcripts at session boundaries, (2) detection and recording of user corrections, (3) quorum-validated skill persistence, and (4) a failure catalog with confidence scoring and decay.

The key architectural discovery is that Claude Code provides a **SessionEnd** hook event, which fires when a session terminates and receives `transcript_path` and `reason` fields. This is the correct boundary for LRNG-01 (error extraction) and LRNG-02 (correction capture). The SessionEnd hook has no decision control (cannot block termination) and is used purely for side effects -- exactly what we need. The transcript is a JSONL file containing the full conversation, which can be parsed to extract error patterns and user corrections.

For LRNG-03 (quorum-validated skills), the existing quorum dispatch infrastructure via `nf-quorum-slot-worker` Task calls can be repurposed. A dedicated CLI command extracts candidate skills from recent session data and dispatches them for multi-model validation before persisting. For LRNG-04 (failure catalog), a new JSONL category in memory-store extends the existing pattern with confidence scoring and time-based decay.

**Primary recommendation:** Create `hooks/nf-session-end.js` for transcript analysis at session boundaries (LRNG-01, LRNG-02). Extend `bin/memory-store.cjs` with two new categories (`skills` and `failures`). Create `bin/learning-extractor.cjs` for the transcript analysis logic. Inject relevant learned patterns into session start and compaction contexts via existing hooks. Keep extraction lightweight -- parse only the last N user/assistant message pairs, not the entire transcript.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LRNG-01 | Automatic error resolution extraction at session boundaries -- symptom/root-cause/fix patterns extracted from session transcript into searchable catalog | New `hooks/nf-session-end.js` (SessionEnd hook) parses transcript JSONL for error-fix sequences; calls `bin/memory-store.cjs append-error` for each extracted pattern |
| LRNG-02 | User corrections to Claude's approach automatically recorded as learned patterns for future sessions | Same SessionEnd hook scans for correction markers (user messages following assistant responses that indicate "don't do X, do Y instead"); persists to new `corrections.jsonl` category |
| LRNG-03 | Quorum-validated skill extraction -- only patterns multiple models agree are valuable get persisted as reusable skills | New `bin/skill-extractor.cjs` CLI command reads recent error/correction/decision entries, formulates candidate skills, dispatches to quorum slot-workers for validation, persists agreed skills to `skills.jsonl` |
| LRNG-04 | Failure catalog tracking failed approaches with confidence scores to prevent re-attempting dead ends | New `failures` category in memory-store with confidence field (0.0-1.0), decay on time, boost on reconfirmation; injected into session reminders |
</phase_requirements>

## Standard Stack

### Core (Already Present -- No New Dependencies)

| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Node.js | >= 16.7.0 | Runtime for hooks and bin/ scripts | Already required; built-ins sufficient |
| CommonJS modules | N/A | Module system | Project convention per coding-style.md |
| Claude Code Hooks API | Current | SessionEnd lifecycle event for extraction, SessionStart/PreCompact for injection | SessionEnd confirmed in official docs with transcript_path input |
| JSONL file persistence | N/A | Append-only stores for skills, corrections, failures | Same pattern as existing decisions/errors/quorum-decisions JSONL files |
| memory-store.cjs | Current | Base CRUD operations for JSONL categories | Extend with new categories rather than building a new module |
| config-loader.js | Current | Two-layer config for feature flags | Enable/disable learning features per project |

### No New Libraries Required

| Problem | Do Not Install | Use Instead |
|---------|----------------|-------------|
| Transcript parsing | any NLP library | Line-by-line JSONL parse of transcript file (already done in nf-stop.js) |
| Pattern matching for corrections | NLP/sentiment analysis | Simple heuristic regex: negation patterns, "instead", "don't", "actually", "wrong" |
| Confidence scoring | ML libraries | Simple arithmetic: initial=0.7, decay=0.05/day, boost=+0.2 on reconfirmation, clamp [0.0,1.0] |
| Skill validation | embedding similarity | Existing quorum slot-worker dispatch via Task subagents |

## Architecture Patterns

### Recommended New Files

```
bin/
  learning-extractor.cjs       # LRNG-01/02: transcript analysis logic (pure functions)
  learning-extractor.test.cjs  # Unit tests
  skill-extractor.cjs          # LRNG-03: candidate skill extraction + quorum dispatch CLI
  skill-extractor.test.cjs     # Unit tests
hooks/
  nf-session-end.js            # LRNG-01/02: SessionEnd hook, calls learning-extractor
  nf-session-end.test.js       # Unit tests
.planning/memory/
  corrections.jsonl            # LRNG-02: user correction patterns
  skills.jsonl                 # LRNG-03: quorum-validated skills
  failures.jsonl               # LRNG-04: failed approaches with confidence scores
```

### Modifications to Existing Files

```
bin/memory-store.cjs           # Add 3 new categories: corrections, skills, failures
                               # Add confidence-aware query (sort by confidence desc)
                               # Add decay/boost commands for failure confidence
hooks/nf-session-start.js      # Extend memory reminder to include skills + active failures
hooks/nf-precompact.js         # Extend memory injection to include relevant skills
hooks/config-loader.js         # Add learning config defaults (learning_enabled, etc.)
hooks/dist/                    # Sync all modified hooks
bin/install.js                 # Register nf-session-end.js hook
```

### Pattern 1: SessionEnd Transcript Extraction (LRNG-01, LRNG-02)

**What:** A new `nf-session-end.js` hook fires at session termination. It reads the transcript JSONL, scans for error-resolution sequences and user corrections, and persists extracted patterns to memory stores.

**When to use:** Automatically at every session end. Must be lightweight (< 5 second execution).

**How SessionEnd works:**
```javascript
// hooks/nf-session-end.js
// SessionEnd hook input (from stdin):
// {
//   "session_id": "abc123",
//   "transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl",
//   "cwd": "/Users/...",
//   "hook_event_name": "SessionEnd",
//   "reason": "other"  // or "clear", "logout", "prompt_input_exit"
// }
//
// SessionEnd has NO decision control -- purely side-effect.
// Output: nothing to stdout. Errors to stderr. Always exit(0).
```

**Extraction strategy for LRNG-01 (error patterns):**
```javascript
// Scan transcript for error-resolution sequences:
// 1. Find assistant messages containing error indicators:
//    - "Error:", "error:", "failed", "ENOENT", "EACCES", stack traces
//    - tool_result blocks with is_error: true or tool_error type
// 2. For each error, look forward for the resolution:
//    - Next successful tool_result (same tool, no error)
//    - Assistant message containing "fixed", "resolved", "solution"
// 3. Extract: { symptom, root_cause, fix, files, tags }
// 4. Dedup against existing errors.jsonl before appending

function extractErrorPatterns(transcriptLines) {
  const patterns = [];
  // Walk lines, find error sequences, extract symptom/fix pairs
  // Cap at 10 extractions per session to bound runtime
  return patterns;
}
```

**Extraction strategy for LRNG-02 (user corrections):**
```javascript
// Scan for user correction patterns:
// 1. Find user messages that follow assistant actions and contain:
//    - "don't", "do not", "instead", "wrong", "not like that"
//    - "actually", "I said", "that's not what I meant"
//    - "use X not Y", "prefer X over Y"
// 2. Extract the correction as: { wrong_approach, correct_approach, context }
// 3. Persist to corrections.jsonl
// 4. Cap at 5 corrections per session

const CORRECTION_INDICATORS = [
  /\bdon'?t\b.*\binstead\b/i,
  /\bwrong\b.*\bshould\b/i,
  /\bactually\b.*\bnot\b/i,
  /\bprefer\b.*\bover\b/i,
  /\bnot like that\b/i,
  /\binstead of\b/i,
  /\bI said\b/i,
  /\bthat's not\b/i,
];
```

### Pattern 2: Failure Catalog with Confidence Scoring (LRNG-04)

**What:** A failure catalog that tracks approaches that did not work, with confidence scores that decay over time (approach might work with newer tools/versions) and boost on reconfirmation (if the same failure is seen again).

**Schema:**
```javascript
// .planning/memory/failures.jsonl -- one entry per line
{
  "type": "failure",
  "ts": "2026-03-07T14:30:00Z",
  "approach": "Using spawnSync for async operations in hooks",
  "context": "nf-session-start.js needed async keytar calls",
  "why_failed": "spawnSync blocks event loop, keytar returns promise",
  "confidence": 0.85,           // 0.0 - 1.0
  "last_confirmed": "2026-03-07T14:30:00Z",
  "confirmation_count": 1,
  "tags": ["hooks", "async", "spawnSync"]
}
```

**Confidence scoring algorithm:**
```javascript
// Initial confidence: 0.7 (first observation)
// Decay: -0.05 per 7 days since last_confirmed (weekly decay)
// Boost: +0.2 on reconfirmation (same failure seen again), clamp to 1.0
// Floor: 0.1 (never fully forget, but deprioritize)
// Prune threshold: entries below 0.1 confidence removed on prune

function computeCurrentConfidence(entry) {
  const daysSinceConfirmed = (Date.now() - new Date(entry.last_confirmed).getTime()) / (86400 * 1000);
  const weekDecay = Math.floor(daysSinceConfirmed / 7) * 0.05;
  return Math.max(0.1, entry.confidence - weekDecay);
}

function boostConfidence(entry) {
  entry.confidence = Math.min(1.0, entry.confidence + 0.2);
  entry.last_confirmed = new Date().toISOString();
  entry.confirmation_count++;
  return entry;
}
```

**Injection into session context:**
```javascript
// In nf-session-start.js, extend generateSessionReminder:
// Include top 3 failures with confidence > 0.3 in reminder
// Format: "Known failures: <approach> (conf: 0.85) -- <why_failed>"
// Budget: ~200 chars within existing 800-char session reminder cap
```

### Pattern 3: Quorum-Validated Skill Extraction (LRNG-03)

**What:** A batch process (not real-time) that extracts candidate skills from accumulated memory, validates them via multi-model quorum, and persists validated skills.

**When to run:** Manually via CLI command or at milestone boundaries. NOT at every session end (too expensive, too noisy).

**How it works:**
```javascript
// bin/skill-extractor.cjs
// 1. Read recent entries from errors, corrections, decisions (last 30 days)
// 2. Cluster by tags -- identify recurring patterns
// 3. Formulate candidate skills as structured objects:
//    { skill: "description", evidence: [...entries], tags: [...] }
// 4. For each candidate, dispatch quorum validation:
//    Task(subagent_type="nf-quorum-slot-worker",
//         prompt="Evaluate if this is a reusable skill: <skill>")
// 5. Only persist if >= 2 models agree the skill is valuable
// 6. Store in skills.jsonl

// Schema:
{
  "type": "skill",
  "ts": "2026-03-07T14:30:00Z",
  "skill": "Use async IIFE pattern for hooks requiring async operations",
  "evidence_count": 3,
  "validated_by": ["codex-1", "gemini-1"],
  "tags": ["hooks", "async"],
  "confidence": 0.9  // quorum agreement level
}
```

**Important constraint:** Skill extraction is an explicit user-triggered action, not automatic. The Out of Scope section in REQUIREMENTS.md explicitly states: "Real-time skill extraction during every tool call -- Massive overhead; batch at session/workflow boundaries instead." The SessionEnd hook is a session boundary, but quorum dispatch at session end is unreliable (session is terminating). Use a separate CLI command instead.

### Pattern 4: Memory Store Extension

**What:** Extend `bin/memory-store.cjs` with three new JSONL categories.

**Implementation:**
```javascript
// Add to FILES constant:
const FILES = {
  decisions: 'decisions.jsonl',
  errors: 'errors.jsonl',
  quorum: 'quorum-decisions.jsonl',
  corrections: 'corrections.jsonl',    // NEW: LRNG-02
  skills: 'skills.jsonl',             // NEW: LRNG-03
  failures: 'failures.jsonl',         // NEW: LRNG-04
};

// Add CLI commands:
// append-correction --wrong "..." --correct "..." --context "..." --tags "..."
// append-skill --skill "..." --evidence-count N --validated-by "codex-1,gemini-1" --tags "..."
// append-failure --approach "..." --context "..." --why-failed "..." --tags "..."
// query-failures --tag "..." --min-confidence 0.3 --limit 5
// query-skills --tag "..." --limit 5
// query-corrections --last 5
// boost-failure --approach "..."  (reconfirm a known failure)
// decay-failures  (apply time-based decay to all failures)
```

### Anti-Patterns to Avoid

- **Real-time extraction during tool calls:** Massive overhead. Extract at session boundaries only.
- **Full transcript parsing:** Transcripts can be 10K+ lines. Scan only last 200 messages for corrections, last 500 for error patterns.
- **Blocking session exit:** SessionEnd has no decision control and MUST exit quickly. Use sync I/O only, cap at 5 seconds.
- **Quorum dispatch in SessionEnd:** Session is terminating. Quorum workers would be orphaned. Extract candidates at session end, validate via separate CLI.
- **Storing raw transcript excerpts:** Privacy and size concerns. Extract structured patterns only.
- **Auto-writing to CLAUDE.md:** Explicitly out of scope per REQUIREMENTS.md.

## Don't Hand-Roll

| Problem | Do Not Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL storage | Custom file format, SQLite | Existing memory-store.cjs JSONL pattern | Already proven, zero deps, appendFileSync atomic |
| Transcript parsing | Complex NLP pipeline | Line-by-line JSON.parse with regex heuristics | Transcripts are structured JSONL, not free text |
| Quorum validation | Custom multi-model dispatch | Existing nf-quorum-slot-worker Task dispatch | Fully wired, scoreboard integration, failover built-in |
| Deduplication | Hash-based dedup system | Existing isDuplicate() bidirectional substring match | Already in memory-store.cjs, handles case insensitivity |
| Config merge | New config file | Existing config-loader.js two-layer merge | Add keys to DEFAULT_CONFIG, get global/project override free |

## Common Pitfalls

### Pitfall 1: SessionEnd Hook Timeout
**What goes wrong:** SessionEnd hook takes too long parsing a large transcript, causing the session to hang on exit.
**Why it happens:** Transcripts can be thousands of lines. Parsing entire transcript is O(n) with JSON.parse per line.
**How to avoid:** Cap transcript scanning: read only last 500 lines for errors, last 200 for corrections. Use a streaming approach (read from end of file). Set a hard 5-second timeout via setTimeout + process.exit(0).
**Warning signs:** Users report slow session exits, or session-end extraction silently produces no output because it hit the timeout.

### Pitfall 2: False Positive Corrections
**What goes wrong:** Normal conversation is misidentified as user corrections, polluting the corrections store.
**Why it happens:** Words like "don't", "instead", "actually" appear in normal instructions, not just corrections.
**How to avoid:** Require corrections to appear in user messages that FOLLOW assistant tool_use or assistant text (i.e., the user is reacting to something Claude did). Also require the user message to reference the assistant's prior action. Use a minimum message length threshold (> 20 chars) to skip "ok" or "yes" responses.
**Warning signs:** corrections.jsonl fills with noise entries that do not represent actual corrections.

### Pitfall 3: Confidence Score Inflation
**What goes wrong:** Failure confidence scores never decay because the decay function is not called regularly.
**Why it happens:** Decay must be explicitly triggered -- it does not happen automatically on read.
**How to avoid:** Apply decay on read (compute current confidence dynamically from stored `confidence` + `last_confirmed` timestamp). Only rewrite the stored value on explicit prune or boost operations.
**Warning signs:** Old failures show high confidence despite not being seen in months.

### Pitfall 4: Token Budget Overflow in Session Reminders
**What goes wrong:** Adding skills + failures to session reminders exceeds the 800-char cap or the 4000-char additionalContext budget.
**Why it happens:** More memory categories = more text injected.
**How to avoid:** Strict per-category budgets in generateSessionReminder: decisions=300 chars, errors=150 chars, skills=150 chars, failures=150 chars, overhead=50 chars. Total <= 800. Truncate summaries aggressively.
**Warning signs:** Session start additionalContext exceeds 4000 chars, causing silent truncation by Claude Code.

### Pitfall 5: Install Sync Omission
**What goes wrong:** New hook (nf-session-end.js) is created in hooks/ but never synced to hooks/dist/ and never registered in install.js.
**Why it happens:** This is a NEW hook file, not a modification. It needs both dist sync AND installer registration.
**How to avoid:** Plan tasks MUST include: (1) create hooks/nf-session-end.js, (2) copy to hooks/dist/, (3) add to install.js hook registration, (4) run `node bin/install.js --claude --global`, (5) add to HOOK_PROFILE_MAP in config-loader.js.
**Warning signs:** Hook never fires because it was never installed to ~/.claude/hooks/.

## Code Examples

### SessionEnd Hook Structure
```javascript
// hooks/nf-session-end.js
// Source: Claude Code official docs + existing nf-session-start.js pattern
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadConfig, shouldRunHook } = require('./config-loader');

// Hard timeout: never block session exit longer than 5 seconds
const HARD_TIMEOUT = setTimeout(() => process.exit(0), 5000);
HARD_TIMEOUT.unref(); // do not keep process alive

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => raw += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cwd = input.cwd || process.cwd();
    const transcriptPath = input.transcript_path;

    // Profile guard
    const config = loadConfig(cwd);
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('nf-session-end', profile)) {
      process.exit(0);
    }

    // Feature flag guard
    if (config.learning_enabled === false) {
      process.exit(0);
    }

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      process.exit(0); // No transcript available
    }

    // Load extractor module
    const extractor = findLearningExtractor();
    if (!extractor) {
      process.exit(0);
    }

    // Read last N lines of transcript (avoid loading entire file)
    const lines = readLastLines(transcriptPath, 500);

    // LRNG-01: Extract error patterns
    const errorPatterns = extractor.extractErrorPatterns(lines);
    // LRNG-02: Extract user corrections
    const corrections = extractor.extractCorrections(lines);

    // Persist via memory-store
    const memStore = findMemoryStore();
    if (memStore) {
      for (const ep of errorPatterns) {
        if (!memStore.isDuplicate(cwd, 'errors', 'symptom', ep.symptom)) {
          memStore.appendEntry(cwd, 'errors', ep);
        }
      }
      for (const cor of corrections) {
        if (!memStore.isDuplicate(cwd, 'corrections', 'wrong_approach', cor.wrong_approach)) {
          memStore.appendEntry(cwd, 'corrections', cor);
        }
      }
    }
  } catch (e) {
    process.stderr.write('[nf-session-end] Error: ' + e.message + '\n');
  }
  process.exit(0); // Always exit cleanly
});
```

### Transcript Line Scanning
```javascript
// bin/learning-extractor.cjs — extractErrorPatterns
// Source: Pattern derived from nf-stop.js transcript parsing

function extractErrorPatterns(lines, maxPatterns = 10) {
  const patterns = [];
  for (let i = 0; i < lines.length && patterns.length < maxPatterns; i++) {
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }

    // Look for tool_result with errors
    if (entry.type === 'user') {
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type !== 'tool_result') continue;
        if (!block.is_error && !JSON.stringify(block.content || '').includes('Error')) continue;

        // Found an error -- look forward for resolution
        const symptom = extractSymptom(block);
        const fix = findResolution(lines, i);
        if (symptom && fix) {
          patterns.push({
            type: 'error_resolution',
            symptom,
            root_cause: '', // extracted from assistant explanation if available
            fix,
            tags: [],
            confidence: 'high',
          });
        }
      }
    }
  }
  return patterns;
}
```

### Reading Last N Lines Efficiently
```javascript
// Read last N lines of a file without loading entire file into memory
// Source: Standard Node.js pattern for tail-reading
function readLastLines(filePath, n) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return lines.slice(-n);
}
// NOTE: For very large transcripts, a streaming reverse-read would be better,
// but readFileSync + slice is sufficient for typical session transcripts
// (< 5MB) and avoids adding complexity. The 5-second hard timeout
// provides a safety net for unusually large files.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No session end hook | SessionEnd hook available | Claude Code 2025 | Enables automatic extraction at session boundaries |
| Manual error logging | MEMP-03 structured errors via memory-store.cjs | v0.30-03 (2026-03-07) | Base infrastructure for LRNG-01 extension |
| No correction tracking | User corrections lost between sessions | Current | LRNG-02 addresses this gap |
| No failure tracking | Same failed approaches retried across sessions | Current | LRNG-04 addresses this gap |

## Open Questions

1. **Transcript size variability**
   - What we know: Transcripts are JSONL, one entry per message/tool call. Typical sessions are 100-2000 lines.
   - What is unclear: Maximum transcript size in practice. Very long sessions could have 10K+ lines.
   - Recommendation: Read last 500 lines for error extraction, last 200 for corrections. The hard timeout (5s) prevents runaway parsing.

2. **Correction detection accuracy**
   - What we know: Simple regex heuristics will have false positives.
   - What is unclear: What false positive rate is acceptable.
   - Recommendation: Start conservative -- require multiple indicators (negation word + reference to prior action). Log extraction statistics to stderr for monitoring. Can tighten heuristics later.

3. **Skill extraction trigger point**
   - What we know: Cannot run quorum dispatch during SessionEnd (session terminating). Cannot run on every tool call (out of scope).
   - What is unclear: When the user will run skill extraction.
   - Recommendation: Make it a manual CLI command (`node bin/skill-extractor.cjs --validate`). Could optionally integrate with milestone completion or verification workflows in future phases.

4. **Failure catalog vs error catalog overlap**
   - What we know: errors.jsonl stores symptom/fix pairs. failures.jsonl stores "approach X failed."
   - What is unclear: Where the boundary is between "error resolution" and "failed approach."
   - Recommendation: Errors = specific technical issues with fixes. Failures = higher-level approach decisions that did not work. Example: "ENOENT when reading config.json" is an error. "Using SQLite for memory storage" is a failure (approach-level). Keep separate stores, allow cross-referencing via tags.

## Sources

### Primary (HIGH confidence)
- Claude Code Hooks Reference (https://code.claude.com/docs/en/hooks) -- SessionEnd hook event confirmed with transcript_path input, no decision control, reason field for exit type
- Existing codebase: `bin/memory-store.cjs` -- JSONL append/query/prune infrastructure (verified by reading source)
- Existing codebase: `hooks/nf-stop.js` -- transcript JSONL parsing patterns (verified by reading source)
- Existing codebase: `hooks/nf-session-start.js` -- SessionStart hook pattern with additionalContext injection (verified by reading source)
- Existing codebase: `hooks/config-loader.js` -- HOOK_PROFILE_MAP and shouldRunHook patterns (verified by reading source)

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md Out of Scope section -- confirms "Real-time skill extraction during every tool call" and "Automatic CLAUDE.md updates from memory" are out of scope
- v0.30-03-RESEARCH.md -- architecture patterns for memory stores, token budget allocations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, extending existing proven infrastructure
- Architecture: HIGH -- SessionEnd hook is documented in official Claude Code docs, transcript parsing is proven in nf-stop.js
- Pitfalls: HIGH -- based on analysis of existing hook patterns and known constraints
- Correction detection heuristics: MEDIUM -- regex-based detection will need tuning; start conservative

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days -- stable infrastructure, well-documented hook API)
