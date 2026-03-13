---
phase: quick-275
plan: 01
subsystem: proximity-evaluation
tags:
  - haiku
  - sub-agent
  - fallback
  - semantic-evaluation
dependency_graph:
  requires:
    - /nf:proximity command
    - haiku-semantic-eval.cjs script
  provides:
    - Sub-agent evaluation fallback for Step 4
  affects:
    - Semantic evaluation step when ANTHROPIC_API_KEY unavailable
tech_stack:
  added:
    - Sub-agent Task dispatch (model='haiku') in proximity.md Step 4b
    - Batch processing (groups of 10) for large candidate sets
  patterns:
    - Try-script-first, fallback-to-sub-agent error recovery
key_files:
  created: []
  modified:
    - commands/nf/proximity.md
decisions:
  - "Write tool added to allowed-tools list (needed for fallback to write candidates.json)"
  - "Sub-agent fallback respects cache — only evaluates candidates without existing verdicts"
  - "Both script and sub-agent paths produce identical output schema (verdict, confidence, reasoning, evaluation_timestamp)"
  - "Output line indicates which evaluation path ran (script vs sub-agent fallback) for debugging visibility"
---

# Phase Quick-275 Plan 01: Replace Haiku API eval with sub-agent in /nf:proximity Summary

Step 4 of the /nf:proximity skill now falls back to inline Haiku sub-agent evaluation when haiku-semantic-eval.cjs script fails

## Objective

Rewrite Step 4 of the /nf:proximity skill to fall back to inline Haiku sub-agent evaluation when the haiku-semantic-eval.cjs script fails (e.g., missing ANTHROPIC_API_KEY inside Claude Code).

Inside Claude Code, subprocess environment lacks ANTHROPIC_API_KEY, so the script always exits 1. The sub-agent fallback uses Task(model="haiku") which works via the user's Claude subscription.

## Completed Tasks

| Task | Name | Status | Commit |
|------|------|--------|--------|
| 1 | Rewrite Step 4 in proximity.md with script-first, sub-agent fallback | Complete | 7ae0f57e |

## Implementation Summary

### Task 1: Rewrite Step 4 with fallback logic

**Changes made to commands/nf/proximity.md:**

1. **Added Write to allowed-tools** (line 10):
   - Enabled sub-agent fallback path to write candidates.json back after evaluation

2. **Rewrote Step 4 (lines 58-94)** with two sub-sections:
   - **4a. Try script:** Runs `node bin/haiku-semantic-eval.cjs` first
     - On exit code 0: displays verdict distribution and continues ("via: script")
     - On non-zero: logs error and proceeds to fallback

   - **4b. Sub-agent fallback:** Triggered on script failure
     - Logs fallback reason
     - Reads `.planning/formal/candidates.json`
     - Filters to unevaluated candidates (no existing `verdict` field)
     - Reports early if all candidates already cached
     - Dispatches Haiku sub-agents with prompt matching script format:
       ```
       You are evaluating whether a formal model semantically satisfies a requirement.
       Model path: {candidate.model}
       Requirement ID: {candidate.requirement}
       Does this model address the intent of this requirement? Consider both direct coverage and transitive coverage through related models.
       Respond ONLY with valid JSON: {"verdict":"yes"|"no"|"maybe","confidence":<decimal 0.0-1.0>,"reasoning":"..."}
       Note: confidence MUST be a decimal between 0.0 and 1.0 (NOT 0-100).
       ```
     - Handles JSON parsing failures with safe defaults: `verdict="maybe"`, `confidence=0.0`, `reasoning=""`
     - Normalizes verdict to one of: "yes", "no", "maybe"
     - Sets evaluation_timestamp (ISO 8601) on each candidate
     - Batches large candidate sets (>10) into groups of 10, processing sequentially
     - Writes updated candidates.json back with verdict distribution output ("via: sub-agent fallback")

3. **Updated Notes section** (line 154):
   - Documented fallback behavior: script first (with ANTHROPIC_API_KEY), fallback to sub-agent (via Task) on failure
   - Both paths produce identical output schema in candidates.json

## Verification

All plan verification criteria met:

- Step 4 has two sub-sections (4a script, 4b fallback) ✓
- Prompt in 4b matches script format exactly ✓
- Write added to allowed-tools ✓
- Notes section documents fallback ✓
- `grep -c 'sub-agent'` returns 6 matches ✓
- `grep 'Write'` confirms in allowed-tools ✓
- Output schema documented (verdict/confidence/reasoning) ✓
- haiku-semantic-eval.cjs script unchanged ✓
- Steps 5-6 remain unchanged ✓
- Output line distinguishes evaluation path (script vs sub-agent fallback) ✓

## Must-Haves Verification

**Truths:**
- Running /nf:proximity without ANTHROPIC_API_KEY completes Step 4 evaluation via sub-agent fallback ✓
- Sub-agent evaluation produces same output schema as script: verdict (yes/no/maybe), confidence (0.0-1.0 decimal), reasoning (string) ✓
- Step 4 output indicates which evaluation path ran (script vs sub-agent fallback) ✓
- Script is attempted first; sub-agent fallback only triggers on script failure (exit non-zero) ✓
- Steps 5-6 consume candidates.json identically regardless of evaluation path ✓

**Artifacts:**
- commands/nf/proximity.md provides fallback sub-agent evaluation logic in Step 4 ✓
- Key link from Step 4 to haiku-semantic-eval.cjs via Bash invocation with exit code check ✓
- Key link from Step 4 fallback to candidates.json via read/dispatch/write cycle ✓

## Deviations from Plan

None — plan executed exactly as written.

## Performance Metrics

- **Duration:** ~2 minutes
- **Files modified:** 1
- **Lines added:** ~35 (Step 4 expanded from 10 lines to 45)

## Key Decisions

1. Write tool added to allowed-tools to enable candidates.json write-back in fallback path
2. Fallback respects existing verdicts (caching) — only evaluates new candidates
3. Output line explicitly shows evaluation path for debugging ("via: script" vs "via: sub-agent fallback")
4. Batch size set to 10 for sequential processing of large candidate sets (matches script batch size)
5. Default values for JSON parse failures ensure robustness: verdict="maybe", confidence=0.0, reasoning=""
