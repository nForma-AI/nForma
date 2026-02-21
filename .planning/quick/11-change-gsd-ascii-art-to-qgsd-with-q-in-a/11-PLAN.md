---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/install.js
autonomous: true
requirements: [QUICK-11]

must_haves:
  truths:
    - "Running the installer prints a QGSD banner with Q in pink-orange (salmon) and GSD in cyan"
    - "The Q block-letter is visually proportional and aligned with the GSD letters on every row"
    - "The tagline reads 'Quorum Gets Shit Done' (updated from 'Get Shit Done')"
    - "No color bleed between Q (salmon) and GSD (cyan) — each row resets and re-applies color correctly"
  artifacts:
    - path: "bin/install.js"
      provides: "Updated banner constant with QGSD block letters"
      contains: "salmon + "
  key_links:
    - from: "bin/install.js banner constant"
      to: "console output on install run"
      via: "console.log(banner) at installer startup"
      pattern: "console\\.log\\(banner\\)"
---

<objective>
Update the ASCII art banner in bin/install.js from "GSD" to "QGSD" by prepending a block-letter "Q" rendered in pink-orange (salmon, `\x1b[38;5;209m`), while keeping the existing "GSD" block letters in cyan.

Purpose: The project was rebranded to QGSD (quick task 1) but the installer banner still shows "GSD". This visual inconsistency should be corrected so the banner reflects the current project name.
Output: bin/install.js with an updated `banner` constant showing QGSD in block letters.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace banner constant with QGSD block letters</name>
  <files>bin/install.js</files>
  <action>
Locate the `banner` constant at lines 131–141 of bin/install.js. Replace it with a new version that prepends a block-letter Q in salmon on each row, followed by the existing GSD block letters in cyan.

Add a `salmon` variable at the top of the color block: `const salmon = '\x1b[38;5;209m';` — this is a pink-orange (salmon) 256-color ANSI code. It sits alongside `cyan`, `dim`, and `reset`.

Replace the banner constant with exactly this:

```javascript
const banner = '\n' +
  salmon + '  ██████╗ ' + cyan + ' ██████╗ ███████╗██████╗\n' +
  salmon + ' ██╔═══██╗' + cyan + '██╔════╝ ██╔════╝██╔══██╗\n' +
  salmon + ' ██║   ██║' + cyan + '██║  ███╗███████╗██║  ██║\n' +
  salmon + ' ██║▄▄ ██║' + cyan + '██║   ██║╚════██║██║  ██║\n' +
  salmon + ' ╚██████╔╝' + cyan + '╚██████╔╝███████║██████╔╝\n' +
  salmon + '  ╚══▀▀═╝ ' + cyan + ' ╚═════╝ ╚══════╝╚═════╝' + reset + '\n' +
  '\n' +
  '  Quorum Gets Shit Done ' + dim + 'v' + pkg.version + reset + '\n' +
  '  A meta-prompting, context engineering and spec-driven\n' +
  '  development system for Claude Code, OpenCode, and Gemini by TÂCHES.\n';
```

Key points:
- Each row starts with `salmon +` for the Q column, then `+ cyan +` for the GSD column
- The Q shape uses `▄` (lower block) on row 4 for the tail — this is standard FIGlet "big" Q style
- The final row of Q uses `▀` (upper block half) on row 6 to suggest the tail ending
- Both color codes appear inline per row so there is no ambiguity about which color applies to which characters
- The `reset` appears only once at the end of row 6 (after the GSD portion), same as the original
- Change the tagline from `'  Get Shit Done '` to `'  Quorum Gets Shit Done '`
- Do NOT change any other lines in the file
  </action>
  <verify>
Run `node bin/install.js --help 2>&1 | head -15` from the repo root to confirm the banner prints. Also run `node -e "const b = require('./bin/install.js')" 2>&1` to confirm no syntax errors. If the file runs without error and the top of output shows the banner, the task is complete.

A simpler syntax check: `node --check bin/install.js && echo SYNTAX_OK`
  </verify>
  <done>
- `node --check bin/install.js` exits 0 with output `SYNTAX_OK`
- The banner constant in bin/install.js contains both `salmon +` and `cyan +` per row
- The Q column (salmon) appears before the G column (cyan) on every banner row
- The tagline reads "Quorum Gets Shit Done v{version}"
  </done>
</task>

</tasks>

<verification>
After task completion:
1. `node --check bin/install.js` passes (no syntax errors)
2. `grep -c "salmon +" bin/install.js` returns at least 6 (one per banner row)
3. `grep "Quorum Gets Shit Done" bin/install.js` shows the updated tagline
4. Visually: running `node bin/install.js 2>&1 | head -12` shows a 6-row Q column followed by a 6-row GSD column
</verification>

<success_criteria>
- bin/install.js parses without error
- Banner constant contains a salmon Q prepended to the cyan GSD on all 6 rows
- Tagline updated to "Quorum Gets Shit Done v{version}"
- No other lines in bin/install.js are changed
</success_criteria>

<output>
After completion, create `.planning/quick/11-change-gsd-ascii-art-to-qgsd-with-q-in-a/11-SUMMARY.md`
</output>
