---
name: nf:resolve
description: Guided triage wizard — walk through solve items one-by-one with enriched context, brainstorm ambiguous cases, and take action
argument-hint: "[--category dtoc|ctor|ttor|dtor] [--verdict genuine|review|unclassified] [--limit N]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
---

<objective>
Walk the user through unresolved solve items one at a time with enriched context.
For each item: present evidence, assess confidence, then either recommend an action (for obvious cases) or ask targeted questions (for ambiguous cases). Take the agreed action before moving to the next item.

This is a CONVERSATIONAL skill — the user drives decisions, you provide analysis. Never take action without explicit user confirmation.

Output: Each resolved item gets one of: FP acknowledgment, archive, TODO creation, requirement creation, or skip.
</objective>

<execution_context>
CRITICAL SHELL ESCAPING RULE: Node.js v25+ mangles `!` in `node -e` strings (both single and double quotes).
ALWAYS write JavaScript to a temp file and run it with `node /private/tmp/<name>.cjs`. NEVER use `node -e` for anything with `!` or complex logic.

CRITICAL INTERACTIVITY RULE: This skill is CONVERSATIONAL. After presenting each item with its evidence and recommendation/questions, you MUST use the AskUserQuestion tool to pause and wait for the user's response. Do NOT present multiple items in a single turn. The flow is:
1. Present ONE item (or a batch of identical-pattern items) with evidence
2. Call AskUserQuestion to get user's decision
3. Execute the chosen action
4. Present the NEXT item
5. Repeat

When batching similar items, still use AskUserQuestion to confirm the batch action.
</execution_context>

<process>

## Step 1: Load data and parse arguments

Write this to /private/tmp/nf-resolve-load.cjs and run it:
```javascript
const st = require("<PROJECT_ROOT>/bin/solve-tui.cjs");
const data = st.loadSweepData();
const cache = st.readClassificationCache();
const archive = st.readArchiveFile();
const summary = {};
for (const catKey of ["dtoc", "ctor", "ttor", "dtor"]) {
  const cat = data[catKey];
  if (!cat || !cat.items) { summary[catKey] = { total: 0 }; continue; }
  const items = cat.items.filter(i => !st.isArchived(i));
  const classified = items.map(i => {
    const k = st.itemKey(catKey, i);
    return { ...i, verdict: (cache[catKey] || {})[k] || "unclassified" };
  });
  summary[catKey] = {
    total: items.length,
    genuine: classified.filter(i => i.verdict === "genuine").length,
    review: classified.filter(i => i.verdict === "review").length,
    fp: classified.filter(i => i.verdict === "fp").length,
    unclassified: classified.filter(i => i.verdict === "unclassified").length,
  };
}
console.log(JSON.stringify({ summary, archived: archive.entries.length }));
```

Parse `$ARGUMENTS` for:
- `--category <catKey>` → filter to one category (default: all, prioritized dtoc → dtor → ctor → ttor)
- `--verdict <verdict>` → filter to items with this Haiku classification (default: genuine first, then review, then unclassified; skip fp)
- `--limit <N>` → max items to process (default: 10)

Display overview:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► RESOLVE: N items to triage (M archived)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 D→C Broken Claims:   X genuine, Y review, Z unclassified
 C→R Untraced:        ...
 T→R Orphan Tests:    ...
 D→R Unbacked Claims: ...
```

## Step 2: Build prioritized queue

Write to /private/tmp/nf-resolve-queue.cjs and run it. This script should:
1. Load sweep data and classifications
2. Filter out archived and FP items
3. Sort: genuine → review → unclassified, then by category: dtoc → dtor → ctor → ttor
4. For each item, gather evidence:
   - **dtoc**: check if file exists (normalize .formal/ → .planning/formal/), find similar files, check for generator scripts, read full claim context
   - **ctor**: check if infrastructure/utility, check for test file, read purpose from comments
   - **ttor**: check if source module exists, read test describes
   - **dtor**: extract action verbs, search requirements.json for keyword matches
5. Output JSON array of enriched items (capped at --limit)

Apply `--category` and `--verdict` filters if specified. Take up to `--limit` items.

## Step 3: Present items one at a time (interactive loop)

**CRITICAL: Present ONE item (or one batch of same-pattern items), then call AskUserQuestion to get the user's decision. Do NOT present all items at once.**

### Batching identical patterns

Before presenting item-by-item, scan the queue for groups of 3+ items sharing the same pattern (e.g., all reference ".formal/X" where ".planning/formal/X" exists). Present these as a batch with a single confirmation.

### For each item (or batch):

#### Step 3a: Display the evidence

Present using this format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Item N/Total — <Category Label>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Haiku:     [verdict badge]
 Type/File: [key identifier]
 Reason:    [why it was flagged]

── Evidence ──────────────────────────────────────────
 [✓/✗/○ checks with explanations]

── Full Claim / Context ──────────────────────────────
 [word-wrapped claim text or file purpose]
```

#### Step 3b: Assess confidence

**HIGH confidence — present recommendation:**
- File doesn't exist AND generator script also missing → "Feature likely removed → FP?"
- File doesn't exist BUT generator exists → "Run the generator → TODO?"
- File path alias (.formal/ → .planning/formal/) and file EXISTS → "Path alias FP"
- Package is an English word with no npm match → "Misidentified word → FP?"
- Infrastructure/utility file untraced → "Infrastructure doesn't need tracing → FP?"
- Claim matches existing requirements (2+ keywords) → "Already covered → FP?"

Append recommendation. **When the recommended action is "Requirement"**, you MUST also form your own opinion on what the requirement text should say — don't just echo the mechanical default from `proposeRequirementText`. Read the file/claim context, understand what it actually does, and draft a meaningful description. Show both the default and your recommended text:
```
── Recommendation ────────────────────────────────────
 [Assessment with reasoning]

 → [Recommended action]?

── Proposed Requirement Text ─────────────────────────
 Default:     "[mechanical text from proposeRequirementText]"
 Recommended: "[your opinionated, descriptive text based on evidence]"

   [y] Yes (use recommended)  [d] Use default  [e] Edit  [a] Archive  [f] FP  [s] Skip  [q] Quit
```

For batches of requirements, show a numbered table with both default and recommended texts for every item. The user can approve all, edit by number, or override individually.

**LOW confidence — ask probing questions:**
- File doesn't exist, no generator, but similar files exist → "Did this move?"
- Package not installed but real npm name → "Removed dependency or missing install?"
- Feature module untraced → "User-facing or internal plumbing?"
- Claim with action verbs, no requirement match → "Real promise or just description?"

Append questions:
```
── Questions ─────────────────────────────────────────
 [Numbered probing questions with trade-offs]

 What do you think? (describe your reasoning, or pick:
 [t]odo / [a]rchive / [f]p / [r]equirement / [s]kip / [q]uit)
```

#### Step 3c: WAIT FOR USER INPUT

**Use AskUserQuestion tool** with the action choices as the question. This is what makes the skill interactive — without this, it just dumps everything and exits.

#### Step 3d: Process the response

- Single letter (`y`, `f`, `a`, `s`, `q`, `t`, `r`): execute corresponding action
- Free text: the user is reasoning through the item. Engage with their analysis, provide additional context if helpful, then re-present the action choices and AskUserQuestion again
- `q`: jump to Step 4 (session summary)

#### Step 3e: Execute the chosen action

Write action scripts to /private/tmp/nf-resolve-action.cjs:

- **TODO**: `st.createTodoFromItem(item)` → confirm TODO ID
- **FP**: `st.acknowledgeItem(item)` → confirm suppression
- **Archive**: `st.archiveItem(item)` → confirm archival
- **Requirement**: First show proposed text using `st.proposeRequirementText(item, catKey)`. Display it clearly so the user can review/edit. If the user provides custom text, pass it as the third argument: `st.createRequirementFromItem(item, catKey, customText)`. If the user approves the default, call `st.createRequirementFromItem(item, catKey)`. For batches, show ALL proposed texts in a numbered list before confirming, and let the user edit individual entries by number.

Display one-line confirmation, then loop to next item.

## Step 4: Session summary

After all items processed or user quits:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► RESOLVE: Session complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Processed: N items
 ✓ TODOs created:     X
 ✓ Marked FP:         Y
 ✓ Archived:          Z
 ✓ Reqs created:      W
 ○ Skipped:           S

 Remaining: R items (run /nf:resolve to continue)
```

</process>
