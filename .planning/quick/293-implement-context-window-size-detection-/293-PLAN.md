---
phase: quick-293
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/nf-statusline.js
  - hooks/nf-statusline.test.js
  - hooks/dist/nf-statusline.js
autonomous: true
formal_artifacts: none
requirements: []
must_haves:
  truths:
    - "When context_window_size is present in data, it is used as-is for token estimation instead of hardcoded 1M"
    - "When context_window_size is absent, display_name is parsed for '1M context' or '200K context' to infer context tier"
    - "When neither context_window_size nor display_name provide a tier, the fallback is null/unknown and percentage-only display is used without token estimate"
    - "Color thresholds scale proportionally to detected context size (e.g., 200K session: green < 20K, yellow < 40K, orange < 70K, red >= 70K)"
  artifacts:
    - path: "hooks/nf-statusline.js"
      provides: "Context tier detection via context_window_size and display_name parsing, scaled color thresholds"
    - path: "hooks/nf-statusline.test.js"
      provides: "Tests for 200K detection, 1M detection, unknown fallback, and scaled thresholds"
    - path: "hooks/dist/nf-statusline.js"
      provides: "Synced copy of updated hook for installer"
  key_links:
    - from: "hooks/nf-statusline.js"
      to: "data.context_window.context_window_size"
      via: "direct property access"
      pattern: "context_window_size"
    - from: "hooks/nf-statusline.js"
      to: "data.model.display_name"
      via: "regex extraction of context tier"
      pattern: "\\d+[KM]\\s*context"
---

<objective>
Fix incorrect 1M default for context_window_size in nf-statusline.js and add context tier detection from model display_name. Scale color thresholds proportionally to detected context size so 200K sessions show accurate quality-degradation colors.

Purpose: 200K sessions currently show wrong token estimates and misleading color bands because the code assumes 1M when context_window_size is absent. This produces incorrect green/yellow/orange/red indicators.
Output: Updated nf-statusline.js with tier detection, scaled thresholds, tests, and synced dist copy.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@hooks/nf-statusline.js
@hooks/nf-statusline.test.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add context tier detection and scale color thresholds in nf-statusline.js</name>
  <files>hooks/nf-statusline.js</files>
  <action>
In hooks/nf-statusline.js, make the following changes:

1. ADD a `detectContextSize(data)` helper function before the main stdin handler. This function determines the context window size using a three-tier cascade:

```javascript
function detectContextSize(data) {
  // Tier 1: explicit context_window_size from API
  const explicit = data.context_window?.context_window_size;
  if (explicit && explicit > 0) return explicit;

  // Tier 2: parse display_name for context tier hint
  const displayName = data.model?.display_name || '';
  const match = displayName.match(/\((?:with\s+)?(\d+)([KM])\s*context/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2].toUpperCase();
    return unit === 'M' ? num * 1_000_000 : num * 1_000;
  }

  // Tier 3: unknown — return null (fail-open)
  return null;
}
```

2. REPLACE line 54:
```javascript
const ctxSize = data.context_window?.context_window_size || 1_000_000;
```
WITH:
```javascript
const ctxSize = detectContextSize(data);
```

3. UPDATE the token estimation block (lines 55-58). When `ctxSize` is null (unknown), skip token estimation entirely and show percentage only:
```javascript
let inputTokens, tokensK, tokenLabel;
if (totalTokens > 0) {
  inputTokens = totalTokens;
  tokensK = Math.round(inputTokens / 1000);
  tokenLabel = tokensK >= 1000 ? `${(tokensK / 1000).toFixed(1)}M` : `${tokensK}K`;
} else if (ctxSize) {
  inputTokens = Math.round((used / 100) * ctxSize);
  tokensK = Math.round(inputTokens / 1000);
  tokenLabel = tokensK >= 1000 ? `${(tokensK / 1000).toFixed(1)}M` : `${tokensK}K`;
} else {
  inputTokens = null;
  tokenLabel = null;
}
```

4. REPLACE the fixed color threshold block (lines 61-70) with proportional thresholds:
```javascript
// Named threshold constants for maintainability
const TIER1_PCT = 0.10;  // green ceiling
const TIER2_PCT = 0.20;  // yellow ceiling
const TIER3_PCT = 0.35;  // orange ceiling (>= this → red)

let color;
if (inputTokens != null && ctxSize) {
  // Scale thresholds proportionally: green < 10%, yellow < 20%, orange < 35%, red >= 35%
  const t1 = ctxSize * TIER1_PCT;  // 1M: 100K, 200K: 20K
  const t2 = ctxSize * TIER2_PCT;  // 1M: 200K, 200K: 40K
  const t3 = ctxSize * TIER3_PCT;  // 1M: 350K, 200K: 70K
  if (inputTokens < t1) {
    color = '\x1b[32m';           // green
  } else if (inputTokens < t2) {
    color = '\x1b[33m';           // yellow
  } else if (inputTokens < t3) {
    color = '\x1b[38;5;208m';     // orange
  } else {
    color = '\x1b[5;31m';         // blinking red
  }
} else if (inputTokens != null) {
  // Have tokens but no ctxSize — use original fixed thresholds as fallback
  if (inputTokens < 100_000) {
    color = '\x1b[32m';
  } else if (inputTokens < 200_000) {
    color = '\x1b[33m';
  } else if (inputTokens < 350_000) {
    color = '\x1b[38;5;208m';
  } else {
    color = '\x1b[5;31m';
  }
} else {
  // No token info at all — use percentage-based color
  if (used < 30) {
    color = '\x1b[32m';           // green
  } else if (used < 50) {
    color = '\x1b[33m';           // yellow
  } else if (used < 70) {
    color = '\x1b[38;5;208m';     // orange
  } else {
    color = '\x1b[5;31m';         // blinking red
  }
}
```

5. UPDATE the ctx display string (line 72) to handle null tokenLabel:
```javascript
ctx = tokenLabel
  ? ` ${color}${bar} ${used}% (${tokenLabel})\x1b[0m`
  : ` ${color}${bar} ${used}%\x1b[0m`;
```

IMPORTANT: The proportional thresholds at 10%/20%/35% produce identical absolute values to the old fixed thresholds for 1M sessions (100K/200K/350K), so existing 1M behavior is preserved exactly. For 200K sessions, the thresholds become 20K/40K/70K which correctly reflect quality degradation at those levels.
  </action>
  <verify>
node -c hooks/nf-statusline.js
grep -n 'detectContextSize\|TIER1_PCT\|TIER2_PCT\|TIER3_PCT' hooks/nf-statusline.js
  </verify>
  <done>
`detectContextSize` function present with 3-tier cascade (explicit > display_name > null). Regex omits trailing paren to handle variant display_name formats (e.g., "context window"). Threshold multipliers extracted as named constants (TIER1_PCT, TIER2_PCT, TIER3_PCT). Color thresholds scale proportionally to detected context size. 1M sessions produce identical thresholds to before. 200K sessions get correctly scaled thresholds. Unknown context size falls back to percentage-based coloring.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add tests for context tier detection and sync to dist + reinstall</name>
  <files>hooks/nf-statusline.test.js, hooks/dist/nf-statusline.js</files>
  <action>
**Part A — Add test cases to hooks/nf-statusline.test.js:**

TC9: "200K context detected from display_name scales thresholds correctly"
- Payload: `{ model: { display_name: 'Opus 4.6 (200K context)' }, context_window: { remaining_percentage: 85 } }`
- 15% used of 200K = 30K estimated tokens
- 30K is above t1 (20K) but below t2 (40K) → YELLOW
- Assert: stdout includes `30K`, stdout includes yellow ANSI `\x1b[33m`

TC10: "1M context detected from display_name preserves existing thresholds"
- Payload: `{ model: { display_name: 'Opus 4.6 (with 1M context)' }, context_window: { remaining_percentage: 85 } }`
- 15% used of 1M = 150K estimated tokens → YELLOW (same as TC2b)
- Assert: stdout includes `150K`, stdout includes yellow ANSI `\x1b[33m`

TC11: "explicit context_window_size takes priority over display_name"
- Payload: `{ model: { display_name: 'Opus 4.6 (with 1M context)' }, context_window: { remaining_percentage: 85, context_window_size: 200000 } }`
- 15% used of 200K = 30K → YELLOW
- Assert: stdout includes `30K` (NOT 150K — proving explicit size wins)

TC12: "unknown context tier with no current_usage shows percentage-only (no token label)"
- Payload: `{ model: { display_name: 'SomeModel' }, context_window: { remaining_percentage: 85 } }`
- No context_window_size, no tier in display_name, no current_usage → tokenLabel is null
- Assert: stdout includes `15%`, stdout does NOT include `K)` or `M)` token labels

TC13: "200K session with actual token usage uses real tokens for color"
- Payload: `{ model: { display_name: 'Opus 4.6 (200K context)' }, context_window: { remaining_percentage: 50, context_window_size: 200000, current_usage: { input_tokens: 80000 } } }`
- 80K tokens with 200K context → above t3 (70K) → BLINKING RED
- Assert: stdout includes `80K`, stdout includes blinking red `\x1b[5;31m`

TC14: "200K session with 15K tokens shows green (below 20K threshold)"
- Payload: `{ model: { display_name: 'Opus 4.6 (200K context)' }, context_window: { remaining_percentage: 90, current_usage: { input_tokens: 15000 } } }`
- 15K tokens with 200K context → below t1 (20K) → GREEN
- Assert: stdout includes `15K`, stdout includes green `\x1b[32m`

**Part B — Update existing TC2b to account for new behavior:**

TC2b currently expects 150K yellow for 15% used with no context_window_size and no display_name tier hint. With the new code, when display_name is just 'M' (no tier hint) and no current_usage, tokenLabel will be null. UPDATE TC2b:
- Change display_name from `'M'` to `'M (with 1M context)'` to preserve the existing test intent (testing 1M estimation)
- OR keep display_name as `'M'` and update assertion: since ctxSize is null and totalTokens is 0, the output should show percentage-only without token label

Choose the second option (update assertion) to properly test the unknown-tier fallback. The test should then assert: stdout includes `15%`, stdout does NOT include `150K`, stdout includes green ANSI `\x1b[32m` (because 15% used → percentage-based color → green since 15 < 30).

Also update TC3, TC4, TC5 display_names to include a context tier hint so they continue testing what they intended (token-based color thresholds). Change their display_name from `'M'` to `'M (with 1M context)'`.

**Part C — Sync and reinstall:**

Run:
```
cp hooks/nf-statusline.js hooks/dist/nf-statusline.js && node bin/install.js --claude --global
```

Verify:
```
grep -c 'detectContextSize' ~/.claude/hooks/nf-statusline.js
```
  </action>
  <verify>
node --test hooks/nf-statusline.test.js 2>&1 | tail -30
grep -c 'detectContextSize' hooks/dist/nf-statusline.js
grep -c 'detectContextSize' ~/.claude/hooks/nf-statusline.js
  </verify>
  <done>
All existing tests pass (TC1-TC8 with updated display_names where needed). New tests TC9-TC14 pass. hooks/dist/nf-statusline.js is synced. Installed hook at ~/.claude/hooks/ contains `detectContextSize`. No regressions in npm test suite.
  </done>
</task>

</tasks>

<verification>
1. `node --test hooks/nf-statusline.test.js` — all tests pass (TC1-TC14)
2. `grep -n 'detectContextSize' hooks/nf-statusline.js` — function exists
3. `grep -n '|| 1_000_000' hooks/nf-statusline.js` — returns NO matches (incorrect default removed)
4. `grep -c 'detectContextSize' hooks/dist/nf-statusline.js` — returns non-zero (synced)
5. `grep -c 'detectContextSize' ~/.claude/hooks/nf-statusline.js` — returns non-zero (installed)
6. Verify 1M backward compatibility: TC10 shows 150K yellow (identical to old TC2b behavior)
</verification>

<success_criteria>
- context_window_size is used when present, not overridden by 1M default
- display_name regex extracts context tier (200K, 1M) when context_window_size is absent
- Unknown context tier falls back to percentage-only display (no misleading token estimate)
- Color thresholds scale proportionally: 200K sessions get 20K/40K/70K boundaries, 1M sessions get 100K/200K/350K (unchanged)
- All behavior is fail-open: missing data never crashes the statusline
- hooks/dist/nf-statusline.js synced and installed globally
</success_criteria>

<output>
After completion, create `.planning/quick/293-implement-context-window-size-detection-/293-SUMMARY.md`
</output>
