---
phase: 323-add-ccr-auto-install-and-dynamic-path-re
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/providers.json
  - bin/install.js
autonomous: true
requirements: [XPLAT-01]
formal_artifacts: none

must_haves:
  truths:
    - "CCR slots (claude-1..6) in providers.json use bare 'ccr' as cli value, not a hardcoded Homebrew path"
    - "When ccr is not installed and a CCR slot is selected, install.js warns with the npm install command"
    - "resolveCli('ccr') is called at dispatch time for CCR providers, resolving the actual path dynamically"
    - "CCR hint appears in CLI_INSTALL_HINTS so the promptProviders display is consistent with other providers"
  artifacts:
    - path: "bin/providers.json"
      provides: "CCR provider definitions with bare cli values"
      contains: "\"cli\": \"ccr\""
    - path: "bin/install.js"
      provides: "CCR detection + install hint"
      contains: "npm install -g @musistudio/claude-code-router"
  key_links:
    - from: "bin/install.js classifyProviders()"
      to: "providers.json ccr slots"
      via: "path.basename(p.cli) === 'ccr'"
      pattern: "cliBase === 'ccr'"
    - from: "bin/call-quorum-slot.cjs runSubprocess()"
      to: "resolveCli('ccr')"
      via: "provider.cli.split('/').pop() -> bareName -> resolveCli(bareName)"
      pattern: "resolveCli"
---

<objective>
Replace hardcoded `/opt/homebrew/bin/ccr` paths in providers.json with bare `ccr`, and add CCR availability detection with an install hint in install.js.

Purpose: The hardcoded Homebrew path breaks on non-standard macOS installs and Linux. Using the bare name `ccr` makes the config macOS/Linux path-agnostic — `resolveCli()` (already called at dispatch time in call-quorum-slot.cjs) finds the binary dynamically. Note: resolve-cli.cjs is not Windows-safe; this change targets macOS and Linux only. The install hint lets users know how to install CCR when it is missing.

Output: providers.json with `"cli": "ccr"` for all ccr-type slots; install.js with CCR detection that warns and shows the npm install command when ccr is absent.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@bin/install.js
@bin/resolve-cli.cjs
@bin/call-quorum-slot.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace hardcoded ccr paths in providers.json with bare 'ccr'</name>
  <files>bin/providers.json</files>
  <action>
In bin/providers.json, for all provider entries where `"cli": "/opt/homebrew/bin/ccr"` appears (claude-1 through claude-6), replace the value with `"ccr"`.

This is a pure string replacement — change every occurrence of:
  `"cli": "/opt/homebrew/bin/ccr"`
to:
  `"cli": "ccr"`

There are 6 such entries (claude-1, claude-2, claude-3, claude-4, claude-5, claude-6).

Do NOT change any other `cli` fields (codex, gemini, opencode, copilot remain as `/opt/homebrew/bin/<name>`).

Rationale: call-quorum-slot.cjs already calls `resolveCli(provider.cli.split('/').pop())` at dispatch time (line ~310), so bare `ccr` will be resolved correctly. The hardcoded Homebrew prefix is redundant and breaks non-macOS installs.
  </action>
  <verify>node -e "const p = require('./bin/providers.json'); const ccr = p.providers.filter(x => x.display_type === 'claude-code-router'); console.log(ccr.map(x => x.cli).join('\n'));"</verify>
  <done>All 6 claude-1..6 provider entries have `"cli": "ccr"` (bare name, no path prefix). No other cli fields changed.</done>
</task>

<task type="auto">
  <name>Task 2: Add CCR to CLI_INSTALL_HINTS and add CCR availability detection in install.js</name>
  <files>bin/install.js</files>
  <action>
Two targeted edits to bin/install.js:

**Edit 1 — Add CCR to CLI_INSTALL_HINTS (line ~18):**
Add `ccr` entry to the existing `CLI_INSTALL_HINTS` object so the hint appears consistently when ccr is not found:

```js
const CLI_INSTALL_HINTS = {
  codex:    'npm i -g @openai/codex',
  gemini:   'npm i -g @google/gemini-cli',
  opencode: 'npm i -g opencode',
  copilot:  'npm i -g @githubnext/github-copilot-cli',
  ccr:      'npm install -g @musistudio/claude-code-router',
};
```

**Edit 2 — Add detectCcrCli() function after detectExternalClis() (~line 291):**
Add a new function that checks whether `ccr` is available:

```js
/**
 * Detect whether the ccr (Claude Code Router) binary is available.
 * @returns {{ found: boolean, resolvedPath: string|null }}
 */
function detectCcrCli() {
  const { resolveCli } = require('./resolve-cli.cjs');
  const result = resolveCli('ccr');
  const found = result !== 'ccr';
  return { found, resolvedPath: found ? result : null };
}
```

**Edit 3 — Warn when CCR is selected but not installed (non-interactive path only):**
The warning MUST only fire in the non-interactive default Claude path where CCR slots are actually assigned. `promptProviders()` explicitly excludes CCR slots entirely (lines 2858-2862) — there is no interactive path that sets CCR slots — so the warning belongs in exactly one place.

**Non-interactive / default Claude path (~line 3225):**
Immediately after the assignment `selectedProviderSlots = classified.ccr.map(p => p.name)`, guarded on `selectedProviderSlots.length > 0` and `!detectCcrCli().found`:

```js
    selectedProviderSlots = classified.ccr.map(p => p.name);
    if (selectedProviderSlots.length > 0) {
      const ccrStatus = detectCcrCli();
      if (!ccrStatus.found) {
        const hint = CLI_INSTALL_HINTS['ccr'] || '';
        console.log(`  ${yellow}⚠${reset} ccr not found — claude-1..6 slots require it${hint ? `. Install: ${hint}` : ''}`);
      }
    }
```

Do NOT place the CCR warning anywhere inside `promptProviders()` or the provider detection loop — CCR slots are never selected through the interactive path.

Do NOT add a warning in the non-TTY fallback path (~line 3235-3247) — that path explicitly sets `selectedProviderSlots = []`, meaning CCR is intentionally excluded in CI/non-interactive contexts. Warning there would be incorrect.

Do NOT add to `module.exports` — `detectCcrCli` is install.js-internal only.
  </action>
  <verify>grep -c "musistudio/claude-code-router" bin/install.js && grep -c "detectCcrCli" bin/install.js</verify>
  <done>bin/install.js exports unchanged, `CLI_INSTALL_HINTS.ccr` is set to `'npm install -g @musistudio/claude-code-router'`, `detectCcrCli()` function exists, and ccr absence warning appears only in the non-interactive default Claude path immediately after `selectedProviderSlots = classified.ccr.map(p => p.name)` (~line 3225), gated on `selectedProviderSlots.length > 0 && !detectCcrCli().found`. The warning is NOT placed in `promptProviders()` or the provider detection loop.</done>
</task>

</tasks>

<verification>
1. `node -e "const p = require('./bin/providers.json'); const ccr = p.providers.filter(x => x.display_type === 'claude-code-router'); const allBare = ccr.every(x => x.cli === 'ccr'); console.log('All CCR bare:', allBare, '| Count:', ccr.length);"` — should print `All CCR bare: true | Count: 6`
2. `grep "musistudio/claude-code-router" bin/install.js` — returns the hint line
3. `grep "detectCcrCli" bin/install.js | wc -l` — returns 2+ (definition + 1 call site in the non-interactive default Claude path, gated on CCR slot selection)
4. `node -e "const m = require('./bin/install.js'); console.log(Object.keys(m));"` — exports unchanged (no detectCcrCli in exports)
</verification>

<success_criteria>
- All 6 CCR provider entries in providers.json use `"cli": "ccr"` (bare name)
- install.js `CLI_INSTALL_HINTS` includes `ccr: 'npm install -g @musistudio/claude-code-router'`
- `detectCcrCli()` function added to install.js, called only in the non-interactive default Claude path immediately after `selectedProviderSlots = classified.ccr.map(p => p.name)` (~line 3225), gated on `selectedProviderSlots.length > 0` — NOT placed in `promptProviders()` or the provider detection loop (CCR slots are never selected through the interactive path)
- No existing tests broken (`npm test` passes for install-related test files)
- classifyProviders() continues to identify CCR slots via `path.basename(p.cli) === 'ccr'` (works with bare name since basename of 'ccr' is 'ccr')
</success_criteria>

<output>
After completion, create `.planning/quick/323-add-ccr-auto-install-and-dynamic-path-re/323-SUMMARY.md`
</output>
