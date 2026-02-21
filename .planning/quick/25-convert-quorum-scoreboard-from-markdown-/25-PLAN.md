---
phase: quick-25
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/update-scoreboard.cjs
  - .planning/quorum-scoreboard.json
  - commands/qgsd/quorum.md
autonomous: true
requirements: [SCORE-01, SCORE-02, SCORE-03]

must_haves:
  truths:
    - "Running `node bin/update-scoreboard.cjs --model claude --result TP --task quick-25 --round 1 --verdict APPROVE` updates the JSON file correctly with no arithmetic errors"
    - "The JSON scoreboard contains all historical data from quorum-scoreboard.md"
    - "The quorum.md workflow calls the CLI script instead of instructing AI to do arithmetic"
    - "Invalid CLI arguments print a usage error and exit non-zero"
  artifacts:
    - path: "bin/update-scoreboard.cjs"
      provides: "CLI script: reads JSON, applies score delta, appends round log entry, writes back"
      exports: []
    - path: ".planning/quorum-scoreboard.json"
      provides: "Machine-readable scoreboard with cumulative scores + round log"
      contains: "models"
    - path: "commands/qgsd/quorum.md"
      provides: "Updated R8 instructions using CLI script"
      contains: "update-scoreboard.cjs"
  key_links:
    - from: "commands/qgsd/quorum.md"
      to: "bin/update-scoreboard.cjs"
      via: "Bash node call replacing manual markdown edit"
      pattern: "update-scoreboard\\.cjs"
    - from: "bin/update-scoreboard.cjs"
      to: ".planning/quorum-scoreboard.json"
      via: "fs.readFileSync / fs.writeFileSync"
      pattern: "quorum-scoreboard\\.json"
---

<objective>
Replace the manual markdown scoreboard with a machine-readable JSON file and a CLI script that performs all arithmetic. Update quorum.md to call the script via Bash so Claude never hand-computes scores again.

Purpose: Eliminate AI arithmetic errors in scoreboard updates. The script is the single source of truth for score computation; the AI only supplies the inputs (model name, result code, task, round, verdict).
Output: bin/update-scoreboard.cjs, .planning/quorum-scoreboard.json, updated quorum.md workflow
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quorum-scoreboard.md
@commands/qgsd/quorum.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create bin/update-scoreboard.cjs and migrate existing data to JSON</name>
  <files>bin/update-scoreboard.cjs, .planning/quorum-scoreboard.json</files>
  <action>
Create `bin/update-scoreboard.cjs` as a CommonJS script. The script:

1. Parses CLI arguments from process.argv:
   - `--model <name>` — required: claude | gemini | opencode | copilot | codex
   - `--result <code>` — required: TP | TN | FP | FN | TP+ | UNAVAIL | blank (empty string)
   - `--task <label>` — required: e.g. "quick-25"
   - `--round <n>` — required: integer, e.g. 1
   - `--verdict <v>` — required: APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND | —
   - `--scoreboard <path>` — optional: defaults to `.planning/quorum-scoreboard.json` (relative to cwd)

2. Score delta lookup (matches quorum-scoreboard.md header legend):
   - TP → +1
   - TN → +5
   - FP → -3
   - FN → -1
   - TP+ → +1 for TP, +2 for improvement accepted (total +3)
   - UNAVAIL → 0 (model skipped, no score change)
   - blank/empty → 0 (model not scored this round)

3. On load: if JSON file does not exist, initialise with empty structure (no error).

4. JSON schema:
```json
{
  "models": {
    "claude":   { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 },
    "gemini":   { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 },
    "opencode": { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 },
    "copilot":  { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 },
    "codex":    { "score": 0, "tp": 0, "tn": 0, "fp": 0, "fn": 0, "impr": 0 }
  },
  "rounds": [
    {
      "date": "02-21",
      "task": "quick-2: R3.6 rule",
      "round": 1,
      "votes": {
        "claude": "TP",
        "codex": "UNAVAIL",
        "gemini": "TP+",
        "opencode": "TP",
        "copilot": "TP"
      },
      "verdict": "APPROVE"
    }
  ]
}
```

5. Update logic:
   - Find existing round entry matching `task + round`. If found, add/update the vote for `model`. Recalculate model cumulative stats from scratch (sum all rounds) to avoid drift. If not found, append new round entry with `date` = today's date in MM-DD format, `votes: { [model]: result }`, and `verdict`.
   - After updating votes for the model, recompute the model's cumulative score from all rounds:
     - Walk all rounds, collect this model's vote, apply delta. This is safer than incremental math.
   - Write JSON back with `JSON.stringify(data, null, 2)`.

6. Validation: if required arguments are missing, print usage to stderr and exit(1):
```
Usage: node bin/update-scoreboard.cjs --model <name> --result <code> --task <label> --round <n> --verdict <v> [--scoreboard <path>]
  --model     claude | gemini | opencode | copilot | codex
  --result    TP | TN | FP | FN | TP+ | UNAVAIL | (empty for not scored)
  --task      task label, e.g. "quick-25"
  --round     round number (integer)
  --verdict   APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND | —
```

7. On success, print a single confirmation line to stdout:
```
[update-scoreboard] claude: TP (+1) → score: 37 | quick-25 R1 APPROVE
```

After creating the script, create `.planning/quorum-scoreboard.json` by migrating all historical data from `.planning/quorum-scoreboard.md`. Read the markdown file and manually construct the full JSON with all rounds from the Round Log table, and compute cumulative model scores. The final JSON must exactly match the current markdown state (scores: Claude +36, Gemini +25, OpenCode +45, Copilot +43, Codex 0; all round log rows preserved).

Note: `.planning/quorum-scoreboard.md` is gitignored per project convention. The new `.planning/quorum-scoreboard.json` should also be gitignored — verify `.gitignore` includes `quorum-scoreboard.json` (add if missing).
  </action>
  <verify>
node /Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs --model claude --result TP --task "test-25" --round 99 --verdict APPROVE

Then verify:
- Exit code is 0
- Output line contains "claude: TP (+1)"
- .planning/quorum-scoreboard.json has updated claude.score = 37 (was 36)
- .planning/quorum-scoreboard.json rounds array contains entry with task "test-25" round 99

Then run with missing argument to verify validation:
node /Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs --model claude
Exit code should be 1 and stderr should contain "Usage:".

After verifying, undo the test entry (either by re-running migration or manually removing the test-25 round entry from JSON).
  </verify>
  <done>
Script exits 0 on valid input, updates JSON correctly, exits 1 on invalid input.
JSON file exists with all historical data matching the markdown scoreboard.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update quorum.md to call update-scoreboard.cjs via Bash</name>
  <files>commands/qgsd/quorum.md</files>
  <action>
Replace the three occurrences of:
```
Update `.planning/quorum-scoreboard.md` per R8.
```

With the following instruction block. Each occurrence is at the end of a consensus/verdict step (Step 6 Mode A, Step 7 Mode A escalation, Step 6 Mode B). Replace each with:

```
Update the scoreboard: for each model that voted this round, run:

```bash
node bin/update-scoreboard.cjs \
  --model <model_name> \
  --result <vote_code> \
  --task "<task_label>" \
  --round <round_number> \
  --verdict <VERDICT>
```

`--model` values: claude, gemini, opencode, copilot, codex
`--result` values: TP, TN, FP, FN, TP+ (improvement accepted), UNAVAIL (model skipped), or leave as empty string if model did not participate
`--task` label: short identifier, e.g. "quick-25" or "plan-ph17"
`--round`: the round number that just completed
`--verdict`: the consensus verdict (APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND)

Run one command per model per round. Each call is atomic and idempotent — if re-run for the same task+round+model it overwrites that model's vote and recalculates from scratch.
```

Note: The backtick code fence inside the replacement text should use proper markdown code fencing — the bash block above should be a fenced code block with ```bash markers. Preserve all surrounding quorum.md content exactly.

This replaces the instruction to manually edit quorum-scoreboard.md. The markdown file `.planning/quorum-scoreboard.md` is now deprecated and can be left in place as a historical record — no deletion required.
  </action>
  <verify>
grep -c "update-scoreboard.cjs" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

Should return 3 (one occurrence per verdict step).

grep -c "quorum-scoreboard.md" /Users/jonathanborduas/code/QGSD/commands/qgsd/quorum.md

Should return 0 (all old instructions replaced).
  </verify>
  <done>
All three "Update .planning/quorum-scoreboard.md per R8" instructions replaced with CLI Bash calls.
No remaining references to the deprecated markdown file in quorum.md.
  </done>
</task>

</tasks>

<verification>
1. `node bin/update-scoreboard.cjs --model gemini --result TN --task "quick-25-verify" --round 1 --verdict APPROVE` exits 0 and prints confirmation
2. `.planning/quorum-scoreboard.json` reflects the update (gemini.tn incremented by 1, gemini.score +5)
3. `grep "update-scoreboard.cjs" commands/qgsd/quorum.md | wc -l` returns 3
4. `grep "quorum-scoreboard\.md" commands/qgsd/quorum.md | wc -l` returns 0
5. `.gitignore` contains `quorum-scoreboard.json`
</verification>

<success_criteria>
- bin/update-scoreboard.cjs exists, is executable via node, handles all result codes correctly
- .planning/quorum-scoreboard.json exists with complete historical data from quorum-scoreboard.md
- commands/qgsd/quorum.md uses CLI calls for all three scoreboard update steps
- No AI arithmetic required — the script computes all cumulative scores from round history
</success_criteria>

<output>
After completion, create `.planning/quick/25-convert-quorum-scoreboard-from-markdown-/25-SUMMARY.md` following the summary template.
</output>
