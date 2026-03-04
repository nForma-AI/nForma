---
name: qgsd:sync-baselines
description: Sync baseline requirements into .formal/requirements.json (idempotent merge by text match, with optional auto-detect)
argument-hint: [--profile <web|mobile|desktop|api|cli|library>] [--detect]
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Sync baseline requirements from the QGSD defaults into `.formal/requirements.json`. Supports three modes: profile-based (explicit or from config), intent-based with auto-detect (scans repo for signals), or intent-file (manual JSON). Runs `node bin/sync-baseline-requirements.cjs`, displays results, and commits if requirements were added.
</objective>

<process>

## Step 1: Determine Intent/Profile

Check in priority order:

### 1a. Parse `--profile` from $ARGUMENTS
If present, use it directly. Jump to Step 2.

### 1b. Parse `--detect` from $ARGUMENTS
If present, run auto-detect:

```bash
node bin/detect-project-intent.cjs --root . --json > /tmp/detection.json
DETECTION=$(cat /tmp/detection.json)
```

Display signals table to user from `signals` array (dimension, confidence, evidence).

If `needs_confirmation` array is non-empty, ask user for confirmation on each dimension:

```
AskUserQuestion([
  {
    header: "Confirm Intent Dimensions",
    question: "Please confirm detected project dimensions:",
    multiSelect: false,
    options: [
      { label: "Use suggested intent as-is", description: "Accept auto-detected values" },
      { label: "Customize dimensions", description: "Adjust specific values" }
    ]
  }
])
```

If "customize", prompt for each dimension in `needs_confirmation`:

```
AskUserQuestion([
  {
    header: "base_profile",
    question: "What is your project profile?",
    multiSelect: false,
    options: [
      { label: "web", description: "Web Application" },
      { label: "mobile", description: "Mobile Application" },
      { label: "desktop", description: "Desktop Application" },
      { label: "api", description: "API Service" },
      { label: "cli", description: "CLI Tool" },
      { label: "library", description: "Library / Package" }
    ]
  }
])
```

Build confirmed intent JSON and write to temp file. Jump to Step 2 with `--intent-file` flag.

### 1c. Read `.planning/config.json`

Check for existing `intent` field (takes priority over `profile`):

```bash
INTENT=$(node -e "const c = require('./.planning/config.json'); const i = c.intent; process.stdout.write(i ? JSON.stringify(i) : '')")
```

If intent found, use it. Jump to Step 2 with intent object.

Otherwise, check for `profile` field:

```bash
PROFILE=$(node -e "const c = require('./.planning/config.json'); console.log(c.profile || '')")
```

If neither available, ask the user:

```
AskUserQuestion([
  {
    header: "Choose Sync Mode",
    question: "How would you like to sync baseline requirements?",
    multiSelect: false,
    options: [
      { label: "auto-detect", description: "Automatically detect project intent from repo signals" },
      { label: "manual-profile", description: "Choose a project profile manually" }
    ]
  }
])
```

If "auto-detect", jump to Step 1b. Otherwise continue to profile selection:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "Which project profile should be used for baseline requirements?",
    multiSelect: false,
    options: [
      { label: "web", description: "Web Application" },
      { label: "mobile", description: "Mobile Application" },
      { label: "desktop", description: "Desktop Application" },
      { label: "api", description: "API Service" },
      { label: "cli", description: "CLI Tool" },
      { label: "library", description: "Library / Package" }
    ]
  }
])
```

Store as `$PROFILE`.

## Step 2: Run Sync

If using profile mode:

```bash
node bin/sync-baseline-requirements.cjs --profile "$PROFILE" --json
```

If using intent mode (from auto-detect or intent-file):

```bash
node bin/sync-baseline-requirements.cjs --intent-file /tmp/confirmed-intent.json --json
```

Or directly with --detect:

```bash
node bin/sync-baseline-requirements.cjs --detect --json
```

Parse the JSON output. Display a human-readable summary:

```
Baseline sync complete (profile/intent)
  Added:   N new requirements
  Skipped: M (already present)
  Total:   K requirements
```

If added > 0, list each added requirement:

```
  + [ID] text
```

## Step 3: Store Intent (if auto-detected)

If intent was auto-detected or manually confirmed, persist it to config:

```bash
# Merge confirmed intent into .planning/config.json
node -e "
const fs = require('fs');
const path = require('path');
const configPath = '.planning/config.json';
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
config.intent = <confirmed_intent_object>;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
"
```

## Step 4: Commit if Needed

If `added.length > 0`:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "req(baseline): sync N baseline requirements" --files .formal/requirements.json
```

Also commit config if intent was stored:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "chore(baseline): store detected project intent" --files .planning/config.json
```

Where N is the count of added requirements.

If `added.length === 0`: display "No new requirements to sync -- .formal/requirements.json is up to date."

</process>

<success_criteria>
- [ ] sync-baseline-requirements.cjs ran without error
- [ ] Results displayed with added/skipped counts
- [ ] .formal/requirements.json committed if changed
</success_criteria>
