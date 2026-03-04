---
phase: quick-150
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - .husky/pre-commit
  - .gitleaks.toml
  - .secrets.baseline
  - .gitignore
  - scripts/secret-audit.sh
  - SECURITY.md
  - .github/workflows/secret-scan.yml
autonomous: true
requirements: [QUICK-150]
formal_artifacts: none

must_haves:
  truths:
    - "Running `git commit` triggers Husky pre-commit hook which runs gitleaks via lint-staged on staged files"
    - "Gitleaks allowlists test fixtures and planning files so commits with mock tokens in test files pass pre-commit"
    - "CI secret-scan.yml runs 3 parallel jobs (TruffleHog history scan, Gitleaks backup, detect-secrets baseline check) on push/PR to main"
    - "Running `npm run secrets:gitleaks` scans the full repo with gitleaks locally"
    - "Running `npm run secrets:scan` re-generates the detect-secrets baseline"
    - "Running `npm run secrets:audit` opens the detect-secrets audit workflow"
    - "Running `npm run secrets:history` runs the full-history audit script"
    - ".secrets.baseline is tracked in git (NOT gitignored)"
    - ".gitleaks-report.json and .trufflehog-report.json are gitignored"
    - "SECURITY.md contains a Secret Detection section documenting the 3-tool 2-layer architecture"
  artifacts:
    - path: ".gitleaks.toml"
      provides: "Gitleaks config with rules and allowlists for test fixtures, planning files, and mock tokens"
      contains: "allowlist"
      min_lines: 30
    - path: ".husky/pre-commit"
      provides: "Husky pre-commit hook that runs lint-staged"
      contains: "lint-staged"
    - path: ".github/workflows/secret-scan.yml"
      provides: "CI workflow with 3 parallel jobs: trufflehog, gitleaks-ci, detect-secrets-ci"
      contains: "trufflehog"
      min_lines: 40
    - path: ".secrets.baseline"
      provides: "detect-secrets baseline file for CI comparison"
      contains: "generated_at"
    - path: "scripts/secret-audit.sh"
      provides: "Full-history audit script running gitleaks and trufflehog against entire git history"
      contains: "gitleaks detect"
      min_lines: 15
    - path: "package.json"
      provides: "Updated with husky, lint-staged devDeps, prepare script, lint-staged config, secrets:* npm scripts"
      contains: "lint-staged"
    - path: "SECURITY.md"
      provides: "Updated with Secret Detection section describing 3-tool 2-layer architecture"
      contains: "Secret Detection"
    - path: ".gitignore"
      provides: "Updated with .gitleaks-report.json and .trufflehog-report.json entries"
      contains: "gitleaks-report"
  key_links:
    - from: ".husky/pre-commit"
      to: "package.json"
      via: "npx lint-staged reads lint-staged config from package.json"
      pattern: "lint-staged"
    - from: "package.json (lint-staged config)"
      to: ".gitleaks.toml"
      via: "gitleaks detect --config .gitleaks.toml references the config file"
      pattern: "\\.gitleaks\\.toml"
    - from: ".github/workflows/secret-scan.yml (detect-secrets-ci job)"
      to: ".secrets.baseline"
      via: "detect-secrets audit --baseline .secrets.baseline compares against tracked baseline"
      pattern: "\\.secrets\\.baseline"
    - from: "package.json (prepare script)"
      to: ".husky/pre-commit"
      via: "npm prepare runs husky which activates .husky/ hooks"
      pattern: "\"prepare\".*husky"
---

<objective>
Set up 3-tool 2-layer secret detection for the QGSD repository. Layer 1 (local pre-commit): Gitleaks via Husky + lint-staged. Layer 2 (CI): TruffleHog full-history scan, Gitleaks backup scan, and detect-secrets baseline check -- all in a dedicated secret-scan.yml workflow with 3 parallel jobs.

Purpose: Prevent accidental secret commits at the earliest possible point (pre-commit) and catch anything that slips through with defense-in-depth CI scanning. The architecture balances speed (gitleaks is fast for pre-commit) with thoroughness (trufflehog history scan, detect-secrets pattern detection).

Output: Husky pre-commit hook, .gitleaks.toml config, .secrets.baseline, secret-scan.yml CI workflow, secret-audit.sh script, updated package.json/SECURITY.md/.gitignore.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@package.json
@.gitignore
@SECURITY.md
@.github/workflows/ci.yml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Husky + lint-staged, create gitleaks config, wire pre-commit hook</name>
  <files>
    package.json
    .husky/pre-commit
    .gitleaks.toml
    .gitignore
  </files>
  <action>
**Step 1 -- Install devDependencies and init Husky:**

Run `npm install --save-dev husky lint-staged` to add both packages. Then run `npx husky init` to create the `.husky/` directory and add the `prepare` script to package.json. Husky init creates a `.husky/pre-commit` file with a default command -- overwrite its contents.

**Step 2 -- Configure .husky/pre-commit:**

Overwrite `.husky/pre-commit` with:
```
npx lint-staged
```

No shebang needed (Husky v9+ uses shell directly). File must be executable (`chmod +x`).

**Step 3 -- Add lint-staged config to package.json:**

Add to package.json top-level:
```json
"lint-staged": {
  "*": "gitleaks detect --no-banner --no-git --redact --verbose --config .gitleaks.toml"
}
```

The `--no-git` flag is critical -- lint-staged already provides only staged files, so gitleaks should scan the provided files directly, not the git repo.

Note: `npx lint-staged` will pass staged file paths to gitleaks. Gitleaks scans those files against `.gitleaks.toml` rules. The `*` glob ensures ALL staged files are checked, not just code files.

**Step 4 -- Add npm scripts to package.json:**

Add these to the `scripts` section of package.json (keeping all existing scripts):
```json
"secrets:gitleaks": "gitleaks detect --no-banner --source . --config .gitleaks.toml --redact --verbose",
"secrets:scan": "detect-secrets scan --baseline .secrets.baseline",
"secrets:audit": "detect-secrets audit .secrets.baseline",
"secrets:history": "bash scripts/secret-audit.sh"
```

Also verify the `prepare` script was added by `npx husky init`. It should be `"prepare": "husky"`. If `npx husky init` already added it, do not duplicate.

**Step 5 -- Create .gitleaks.toml:**

Create `.gitleaks.toml` at repo root with:

```toml
# QGSD Gitleaks Configuration
# Defense-in-depth: local pre-commit gate + CI backup scan

title = "QGSD Secret Detection"

[extend]
# Use the default gitleaks rules as a base
# (gitleaks built-in rules cover AWS, GCP, GitHub, Slack, Stripe, generic API keys, etc.)

[allowlist]
description = "QGSD global allowlist"

# Path-based allowlist: test fixtures, planning data, formal verification, generated stubs
paths = [
  '''bin/secrets\.test\.cjs''',
  '''bin/ccr-secure-config\.test\.cjs''',
  '''bin/set-secret\.test\.cjs''',
  '''\.planning/.*\.jsonl''',
  '''\.formal/''',
  '''hooks/generated-stubs/''',
  '''\.secrets\.baseline''',
  '''\.gitleaks\.toml''',
  '''node_modules/''',
]

# Regex-based allowlist: mock/test token patterns used in test fixtures
regexes = [
  '''ak-secret-[a-zA-Z0-9-]+''',
  '''tg-secret-[a-zA-Z0-9-]+''',
  '''fw-secret-[a-zA-Z0-9-]+''',
  '''sk-test-[a-zA-Z0-9-]+''',
  '''sk-ant-[a-zA-Z0-9-]+''',
  '''old-[a-zA-Z0-9-]+''',
  '''new-[a-zA-Z0-9-]+''',
  '''mock-password''',
  '''test-api-key-[a-zA-Z0-9]+''',
  '''fake-secret-[a-zA-Z0-9]+''',
  '''placeholder-key-[a-zA-Z0-9]+''',
]
```

**Step 6 -- Update .gitignore:**

Append these lines to `.gitignore` (under a new comment section):
```
# Secret scanning report artifacts (local only)
.gitleaks-report.json
.trufflehog-report.json
```

Do NOT add `.secrets.baseline` to .gitignore -- it must be tracked in git.

**Step 7 -- Verify gitleaks is available:**

Run `which gitleaks` to check if gitleaks is installed. If not, note in output that user needs to install it (`brew install gitleaks` on macOS). The pre-commit hook will gracefully fail with a helpful message if gitleaks is not installed. This is acceptable for the plan -- gitleaks is a development tool, not a runtime dependency.

Similarly, `detect-secrets` requires Python. It is a CI-only concern and is NOT needed locally for pre-commit.
  </action>
  <verify>
    1. `cat package.json | node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(p.devDependencies.husky ? 'husky OK' : 'MISSING'); console.log(p.devDependencies['lint-staged'] ? 'lint-staged OK' : 'MISSING'); console.log(p.scripts.prepare ? 'prepare OK' : 'MISSING'); console.log(p['lint-staged'] ? 'lint-staged config OK' : 'MISSING'); console.log(p.scripts['secrets:gitleaks'] ? 'secrets:gitleaks OK' : 'MISSING')"` -- all print OK.
    2. `test -f .husky/pre-commit && grep -q 'lint-staged' .husky/pre-commit && echo "pre-commit OK"` -- prints OK.
    3. `test -f .gitleaks.toml && grep -q 'allowlist' .gitleaks.toml && echo "gitleaks config OK"` -- prints OK.
    4. `grep -q 'gitleaks-report' .gitignore && echo "gitignore OK"` -- prints OK.
    5. If gitleaks is installed: `gitleaks detect --no-banner --source . --config .gitleaks.toml --redact --verbose 2>&1 | tail -5` -- exits without errors (may report findings or clean scan).
  </verify>
  <done>
    Husky v9 pre-commit hook wired to lint-staged which runs gitleaks on all staged files. .gitleaks.toml has path-based allowlists for test fixtures (bin/secrets.test.cjs, bin/ccr-secure-config.test.cjs, bin/set-secret.test.cjs), .planning/*.jsonl, .formal/, hooks/generated-stubs/ and regex allowlists for mock token patterns. package.json has prepare, lint-staged config, and 4 secrets:* npm scripts. .gitignore updated with report artifacts. .secrets.baseline is NOT gitignored.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create CI workflow, detect-secrets baseline, audit script, and update SECURITY.md</name>
  <files>
    .github/workflows/secret-scan.yml
    .secrets.baseline
    scripts/secret-audit.sh
    SECURITY.md
  </files>
  <action>
**Step 1 -- Create .github/workflows/secret-scan.yml:**

Create a new workflow file (separate from ci.yml) with 3 parallel jobs:

```yaml
name: Secret Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  trufflehog:
    name: TruffleHog (history scan)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout (full history)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog scan
        uses: trufflesecurity/trufflehog@v3
        with:
          extra_args: --only-verified --results=verified,unknown

  gitleaks-ci:
    name: Gitleaks (backup scan)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  detect-secrets-ci:
    name: detect-secrets (baseline check)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install detect-secrets
        run: pip install detect-secrets

      - name: Check baseline
        run: |
          # Scan current state and compare to committed baseline
          detect-secrets scan --baseline .secrets.baseline
          # Audit for any unresolved secrets in baseline
          detect-secrets audit --report --baseline .secrets.baseline
```

**Step 2 -- Create .secrets.baseline:**

Generate the baseline file. If `detect-secrets` is not installed locally (Python tool), create a minimal valid baseline JSON manually:

```json
{
  "version": "1.5.0",
  "plugins_used": [
    { "name": "ArtifactoryDetector" },
    { "name": "AWSKeyDetector" },
    { "name": "AzureStorageKeyDetector" },
    { "name": "BasicAuthDetector" },
    { "name": "CloudantDetector" },
    { "name": "DiscordBotTokenDetector" },
    { "name": "GitHubTokenDetector" },
    { "name": "HexHighEntropyString", "limit": 3.0 },
    { "name": "IbmCloudIamDetector" },
    { "name": "IbmCosHmacDetector" },
    { "name": "JwtTokenDetector" },
    { "name": "KeywordDetector" },
    { "name": "MailchimpDetector" },
    { "name": "NpmDetector" },
    { "name": "PrivateKeyDetector" },
    { "name": "SendGridDetector" },
    { "name": "SlackDetector" },
    { "name": "SoftlayerDetector" },
    { "name": "SquareOAuthDetector" },
    { "name": "StripeDetector" },
    { "name": "TwilioKeyDetector" }
  ],
  "filters_used": [
    { "path": "detect_secrets.filters.allowlist_filter" },
    { "path": "detect_secrets.filters.common.is_baseline_file", "filename": ".secrets.baseline" },
    { "path": "detect_secrets.filters.common.is_ignored_due_to_verification_policies", "min_level": 2 },
    { "path": "detect_secrets.filters.heuristic.is_indirect_reference" },
    { "path": "detect_secrets.filters.heuristic.is_likely_id_string" },
    { "path": "detect_secrets.filters.heuristic.is_lock_file" },
    { "path": "detect_secrets.filters.heuristic.is_not_alphanumeric_string" },
    { "path": "detect_secrets.filters.heuristic.is_potential_uuid" },
    { "path": "detect_secrets.filters.heuristic.is_prefixed_with_dollar_sign" },
    { "path": "detect_secrets.filters.heuristic.is_sequential_string" },
    { "path": "detect_secrets.filters.heuristic.is_swagger_file" },
    { "path": "detect_secrets.filters.heuristic.is_templated_secret" }
  ],
  "results": {},
  "generated_at": "2026-03-04T00:00:00Z"
}
```

If `detect-secrets` IS available locally (check via `which detect-secrets`), prefer generating the baseline properly:
```bash
detect-secrets scan \
  --exclude-files 'node_modules/.*' \
  --exclude-files '\.planning/.*\.jsonl' \
  --exclude-files 'bin/secrets\.test\.cjs' \
  --exclude-files 'bin/ccr-secure-config\.test\.cjs' \
  --exclude-files 'bin/set-secret\.test\.cjs' \
  --exclude-files 'hooks/generated-stubs/.*' \
  --exclude-files '\.formal/.*' \
  > .secrets.baseline
```

**Step 3 -- Create scripts/secret-audit.sh:**

```bash
#!/usr/bin/env bash
# secret-audit.sh — Full-history secret audit using gitleaks and trufflehog
# Usage: bash scripts/secret-audit.sh
# Runs locally; install gitleaks and trufflehog first.

set -euo pipefail

echo "=== QGSD Full-History Secret Audit ==="
echo ""

# --- Gitleaks full-history scan ---
echo "[1/2] Running gitleaks full-history scan..."
if command -v gitleaks &>/dev/null; then
  gitleaks detect \
    --source . \
    --config .gitleaks.toml \
    --redact \
    --verbose \
    --report-format json \
    --report-path .gitleaks-report.json \
    || echo "  -> gitleaks found potential secrets (see .gitleaks-report.json)"
  echo "  -> gitleaks report: .gitleaks-report.json"
else
  echo "  -> SKIPPED: gitleaks not installed (brew install gitleaks)"
fi

echo ""

# --- TruffleHog full-history scan ---
echo "[2/2] Running trufflehog full-history scan..."
if command -v trufflehog &>/dev/null; then
  trufflehog git \
    file://. \
    --only-verified \
    --json \
    > .trufflehog-report.json 2>&1 \
    || echo "  -> trufflehog found potential secrets (see .trufflehog-report.json)"
  echo "  -> trufflehog report: .trufflehog-report.json"
else
  echo "  -> SKIPPED: trufflehog not installed (brew install trufflehog)"
fi

echo ""
echo "=== Audit complete ==="
echo "Report files (.gitleaks-report.json, .trufflehog-report.json) are gitignored."
```

Mark executable: `chmod +x scripts/secret-audit.sh`.

**Step 4 -- Update SECURITY.md:**

Append a new section to the existing SECURITY.md (do NOT overwrite existing content):

```markdown

## Secret Detection

QGSD uses a 3-tool, 2-layer secret detection architecture:

### Layer 1: Local (Pre-commit)

| Tool | Trigger | Purpose |
|------|---------|---------|
| **Gitleaks** | `git commit` (via Husky + lint-staged) | Scans staged files for secrets before they enter git history |

Configuration: `.gitleaks.toml` (rules + allowlists for test fixtures)

### Layer 2: CI (GitHub Actions)

| Tool | Job | Purpose |
|------|-----|---------|
| **TruffleHog** | `trufflehog` | Full git history scan with `--only-verified` to reduce noise |
| **Gitleaks** | `gitleaks-ci` | Backup scan (defense in depth) |
| **detect-secrets** | `detect-secrets-ci` | Pattern-based scan against tracked `.secrets.baseline` |

Workflow: `.github/workflows/secret-scan.yml` (3 parallel jobs)

### Local Commands

```bash
npm run secrets:gitleaks   # Full repo scan with gitleaks
npm run secrets:scan       # Re-generate detect-secrets baseline
npm run secrets:audit      # Audit detect-secrets baseline interactively
npm run secrets:history    # Full-history audit (gitleaks + trufflehog)
```

### Allowlisted Paths

Test fixtures and planning data are allowlisted to prevent false positives:

- `bin/secrets.test.cjs`, `bin/ccr-secure-config.test.cjs`, `bin/set-secret.test.cjs`
- `.planning/*.jsonl`
- `.formal/` (formal verification fixtures)
- `hooks/generated-stubs/`
```
  </action>
  <verify>
    1. `test -f .github/workflows/secret-scan.yml && grep -q 'trufflehog' .github/workflows/secret-scan.yml && grep -q 'gitleaks' .github/workflows/secret-scan.yml && grep -q 'detect-secrets' .github/workflows/secret-scan.yml && echo "CI workflow OK"` -- prints OK.
    2. `node -e "const b=JSON.parse(require('fs').readFileSync('.secrets.baseline','utf8')); console.log(b.generated_at ? 'baseline OK' : 'MISSING')"` -- prints OK.
    3. `test -x scripts/secret-audit.sh && grep -q 'gitleaks detect' scripts/secret-audit.sh && echo "audit script OK"` -- prints OK.
    4. `grep -q 'Secret Detection' SECURITY.md && grep -q 'TruffleHog' SECURITY.md && echo "SECURITY.md OK"` -- prints OK.
    5. `grep -c 'jobs:' .github/workflows/secret-scan.yml` -- returns 1 (single jobs block with 3 jobs inside).
  </verify>
  <done>
    secret-scan.yml has 3 parallel CI jobs: trufflehog (full history, --only-verified), gitleaks-ci (backup via gitleaks-action), detect-secrets-ci (Python 3.12, baseline comparison). .secrets.baseline exists and is tracked in git. scripts/secret-audit.sh is executable and runs gitleaks + trufflehog locally for one-time full-history audits. SECURITY.md documents the complete 3-tool 2-layer architecture with commands and allowlisted paths.
  </done>
</task>

</tasks>

<verification>
1. `cat package.json | node -e "const p=JSON.parse(require('fs').readFileSync(0,'utf8')); const checks=['husky' in p.devDependencies,'lint-staged' in p.devDependencies,'prepare' in p.scripts,'lint-staged' in p,'secrets:gitleaks' in p.scripts,'secrets:scan' in p.scripts,'secrets:audit' in p.scripts,'secrets:history' in p.scripts]; console.log(checks.every(Boolean) ? 'package.json PASS' : 'FAIL: '+checks)"` -- prints PASS
2. `test -f .husky/pre-commit && grep -q 'lint-staged' .husky/pre-commit && echo "PASS"` -- pre-commit hook exists and invokes lint-staged
3. `test -f .gitleaks.toml && grep -q 'secrets\.test\.cjs' .gitleaks.toml && echo "PASS"` -- gitleaks config has test fixture allowlists
4. `test -f .github/workflows/secret-scan.yml && echo "PASS"` -- CI workflow exists
5. `test -f .secrets.baseline && echo "PASS"` -- baseline tracked in git
6. `test -x scripts/secret-audit.sh && echo "PASS"` -- audit script executable
7. `grep -q 'Secret Detection' SECURITY.md && echo "PASS"` -- docs updated
8. `grep -q 'gitleaks-report' .gitignore && echo "PASS"` -- report files gitignored
9. `! grep -q 'secrets\.baseline' .gitignore && echo "PASS"` -- baseline NOT gitignored
</verification>

<success_criteria>
- Husky v9 pre-commit hook runs lint-staged on every `git commit`
- lint-staged runs gitleaks on all staged files using .gitleaks.toml config
- .gitleaks.toml allowlists test fixtures, planning files, formal verification, and mock token patterns
- secret-scan.yml has 3 parallel CI jobs: trufflehog (full history), gitleaks (backup), detect-secrets (baseline)
- .secrets.baseline is tracked in git, report artifacts (.gitleaks-report.json, .trufflehog-report.json) are gitignored
- 4 npm scripts exist: secrets:gitleaks, secrets:scan, secrets:audit, secrets:history
- scripts/secret-audit.sh is executable and runs full-history audit locally
- SECURITY.md documents the 3-tool 2-layer architecture
- detect-secrets is NOT in pre-commit (Python dependency; gitleaks is the local gate)
- Existing ci.yml is untouched (secret scanning is in separate workflow)
</success_criteria>

<output>
After completion, create `.planning/quick/150-set-up-3-tool-2-layer-secret-detection-g/150-SUMMARY.md`
</output>
