---
phase: quick-157
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - qgsd-core/defaults/baseline-requirements/iac.json
  - qgsd-core/defaults/baseline-requirements/index.json
  - bin/load-baseline-requirements.cjs
  - bin/detect-project-intent.cjs
  - bin/sync-baseline-requirements.cjs
  - commands/qgsd/sync-baselines.md
  - bin/detect-project-intent.test.cjs
  - bin/load-baseline-requirements.test.cjs
  - bin/sync-baseline-requirements.test.cjs
autonomous: true
formal_artifacts: none
requirements: [QUICK-157]

must_haves:
  truths:
    - "loadBaselineRequirementsFromIntent({base_profile:'cli'}) returns same count as loadBaselineRequirements('cli') (13 reqs)"
    - "loadBaselineRequirementsFromIntent({base_profile:'web', iac:true}) returns 34 + IaC web reqs"
    - "detect-project-intent.cjs --json produces valid intent suggestion from repo traces"
    - "sync-baseline-requirements.cjs --detect works end-to-end"
    - "Existing loadBaselineRequirements(profile) and syncBaselineRequirements(profile) are backwards-compatible"
  artifacts:
    - path: "qgsd-core/defaults/baseline-requirements/iac.json"
      provides: "12 IaC baseline requirements"
      contains: "Infrastructure as Code"
    - path: "qgsd-core/defaults/baseline-requirements/index.json"
      provides: "Unified pack model with activation rules"
      contains: "packs"
    - path: "bin/load-baseline-requirements.cjs"
      provides: "loadBaselineRequirementsFromIntent function"
      exports: ["loadBaselineRequirements", "loadBaselineRequirementsFromIntent"]
    - path: "bin/detect-project-intent.cjs"
      provides: "Repo trace scanner producing intent object"
      exports: ["detectProjectIntent"]
    - path: "bin/sync-baseline-requirements.cjs"
      provides: "Intent-based sync with --detect and --intent-file flags"
      exports: ["syncBaselineRequirements", "syncBaselineRequirementsFromIntent"]
    - path: "bin/detect-project-intent.test.cjs"
      provides: "Detection unit tests"
      min_lines: 40
    - path: "bin/load-baseline-requirements.test.cjs"
      provides: "Extended intent loading tests"
      min_lines: 150
    - path: "bin/sync-baseline-requirements.test.cjs"
      provides: "Extended intent sync tests"
      min_lines: 250
  key_links:
    - from: "bin/load-baseline-requirements.cjs"
      to: "qgsd-core/defaults/baseline-requirements/index.json"
      via: "reads packs section"
      pattern: "index\\.packs"
    - from: "bin/sync-baseline-requirements.cjs"
      to: "bin/load-baseline-requirements.cjs"
      via: "calls loadBaselineRequirementsFromIntent"
      pattern: "loadBaselineRequirementsFromIntent"
    - from: "bin/sync-baseline-requirements.cjs"
      to: "bin/detect-project-intent.cjs"
      via: "calls detectProjectIntent for --detect flag"
      pattern: "detectProjectIntent"
    - from: "commands/qgsd/sync-baselines.md"
      to: "bin/sync-baseline-requirements.cjs"
      via: "invokes with --detect flag"
      pattern: "\\-\\-detect"
---

<objective>
Implement the intent-driven baseline requirements pack system. Unifies all requirement categories into packs with activation rules, adds auto-detection of project intent from repo traces, and provides intent-based sync.

Purpose: Enable conditional requirement packs (IaC, etc.) activated by multi-dimensional intent objects instead of simple profile strings, with optional auto-detection from repo file presence.
Output: 3 new files (iac.json, detect-project-intent.cjs, detect-project-intent.test.cjs), 5 modified files with backwards compatibility preserved.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@/Users/jonathanborduas/.claude/plans/tranquil-hopping-hoare.md

Source files (read before modifying):
@qgsd-core/defaults/baseline-requirements/index.json
@qgsd-core/defaults/baseline-requirements/security.json
@bin/load-baseline-requirements.cjs
@bin/sync-baseline-requirements.cjs
@commands/qgsd/sync-baselines.md
@bin/load-baseline-requirements.test.cjs
@bin/sync-baseline-requirements.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create IaC pack, extend index.json with packs model, add loadBaselineRequirementsFromIntent</name>
  <files>
    qgsd-core/defaults/baseline-requirements/iac.json
    qgsd-core/defaults/baseline-requirements/index.json
    bin/load-baseline-requirements.cjs
  </files>
  <action>
**1a. Create `iac.json`** -- 12 IaC requirements following exact same format as `security.json`:
- `category: "Infrastructure as Code"`
- `description`: Brief description of IaC baseline requirements
- `profiles: ["web", "api", "cli", "desktop"]` (all except mobile/library at the category level)
- `id_template: "IAC-{N}"`
- Each requirement has: `id_template`, `text`, `intent`, `verifiable_by`, `profiles` (per-requirement array)
- Requirements (all with profiles `["web", "api", "cli", "desktop"]`):
  1. IaC definitions exist for all deployed infrastructure
  2. Single deploy entrypoint (make/script) documented in README
  3. IaC files pass formatting checks (terraform fmt / equivalent)
  4. IaC linter runs in CI (tflint / equivalent)
  5. CI validates IaC on every PR (plan/preview, not just apply)
  6. No plaintext secrets in IaC -- use secret manager references
  7. Environment separation (dev/staging/prod) via workspaces or separate configs
  8. Remote state backend configured with locking
  9. Reusable modules for repeated patterns
  10. Infrastructure changes require PR review before apply
  11. Provider and module versions pinned to exact or minor range
  12. IaC README documents architecture, variables, and bootstrap steps

**1b. Extend `index.json`** -- Add `packs` section alongside existing `profiles` and `categories` (keep those for backwards compat). The packs section maps every category plus iac:

```json
"packs": {
  "security":      { "file": "security.json",      "activation": "always" },
  "reliability":   { "file": "reliability.json",    "activation": "always" },
  "observability": { "file": "observability.json",  "activation": "always" },
  "ci-cd":         { "file": "ci-cd.json",          "activation": "always" },
  "ux-heuristics": { "file": "ux-heuristics.json",  "activation": "conditional", "intent_key": "has_ui", "intent_value": true },
  "performance":   { "file": "performance.json",    "activation": "conditional", "intent_key": "has_ui", "intent_value": true },
  "iac":           { "file": "iac.json",            "activation": "conditional", "intent_key": "iac",    "intent_value": true }
}
```

Update `total_requirements` to 46 (34 existing + 12 IaC).

**1c. Add `loadBaselineRequirementsFromIntent(intent, basePath)`** to `bin/load-baseline-requirements.cjs`:

```javascript
function loadBaselineRequirementsFromIntent(intent, basePath) {
  // 1. Validate intent.base_profile exists and is valid (web/mobile/desktop/api/cli/library)
  // 2. Derive has_ui: base_profile in ['web','mobile','desktop']
  // 3. Build enriched intent: { ...defaultIntent, ...intent, has_ui }
  //    Default intent: { iac: false, deploy: "none", sensitive: false, oss: false, monorepo: false }
  // 4. Read index.json, iterate packs:
  //    - "always" -> include
  //    - "conditional" -> check enrichedIntent[pack.intent_key] === pack.intent_value
  // 5. For included packs: load file, filter reqs by profiles array containing base_profile
  // 6. Assign sequential IDs per prefix (same logic as existing loadBaselineRequirements)
  // 7. Return { profile: intent.base_profile, label, intent: enrichedIntent, categories, packs_applied: [...packNames], total }
}
```

- The existing `loadBaselineRequirements(profile)` MUST remain completely unchanged -- do NOT modify its function body
- Export both: `module.exports = { loadBaselineRequirements, loadBaselineRequirementsFromIntent }`
- Add CLI support: `--intent-file <path>` reads JSON intent from file (alongside existing `--profile`)
- Profile label for intent mode: look up from index.profiles[base_profile].label

CRITICAL: Do NOT modify the existing `loadBaselineRequirements` function body. The new function reads `packs` from index.json independently.
  </action>
  <verify>
Run: `node bin/load-baseline-requirements.cjs --profile cli` -- must still return 13 reqs (backwards compat).
Run: `echo '{"base_profile":"cli"}' > /tmp/test-intent.json && node bin/load-baseline-requirements.cjs --intent-file /tmp/test-intent.json` -- must return cli-equivalent reqs with packs_applied field.
Run: `echo '{"base_profile":"web","iac":true}' > /tmp/test-intent2.json && node bin/load-baseline-requirements.cjs --intent-file /tmp/test-intent2.json` -- must return 34 + IaC web reqs (46).
Run: `node --test bin/load-baseline-requirements.test.cjs` -- all 20 existing tests pass.
  </verify>
  <done>
- iac.json has 12 requirements with proper id_template, profiles, text, intent, verifiable_by fields
- index.json has `packs` section with all 7 packs, existing `profiles` and `categories` unchanged
- loadBaselineRequirementsFromIntent works for all profile+intent combos
- loadBaselineRequirements is unchanged and backwards compatible
- CLI supports --intent-file flag
  </done>
</task>

<task type="auto">
  <name>Task 2: Create detect-project-intent, extend sync-baseline-requirements, update skill</name>
  <files>
    bin/detect-project-intent.cjs
    bin/sync-baseline-requirements.cjs
    commands/qgsd/sync-baselines.md
  </files>
  <action>
**2a. Create `bin/detect-project-intent.cjs`** -- Repo trace scanner:

Exported function: `detectProjectIntent(rootPath)`

Detection signals (all use `fs.existsSync` or glob-like directory scans):

| Dimension | Signals | Confidence |
|---|---|---|
| `base_profile` | package.json deps/scripts (next/vite->web, react-native->mobile, electron->desktop), `bin` field->cli, openapi->api | medium |
| `iac` | `*.tf` in root or `terraform/`, `Pulumi.yaml`, `cdk.json`, `serverless.yml`, `infra/` dir | high |
| `deploy` | `Dockerfile`, `docker-compose.yml`, `fly.toml`, `vercel.json`, `Procfile` | high |
| `sensitive` | Auth libs (passport, next-auth), payment libs (stripe) in package.json deps | medium |
| `oss` | `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | high |
| `monorepo` | `pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json` | high |

For base_profile detection from package.json:
- Read package.json if exists, check `dependencies` and `devDependencies`
- next/nuxt/vite/gatsby/remix -> web
- react-native/expo -> mobile
- electron/tauri -> desktop
- Check `bin` field presence -> cli
- Check for `openapi.json`/`openapi.yaml`/`swagger.json` -> api
- If nothing detected -> "unknown"

For deploy dimension, use string values: "docker" if Dockerfile, "fly" if fly.toml, "vercel" if vercel.json, "heroku" if Procfile, "none" if nothing. Use first match.

Output shape:
```json
{
  "suggested": { "base_profile": "cli", "iac": true, "deploy": "docker", "sensitive": false, "oss": true, "monorepo": false },
  "signals": [ { "dimension": "iac", "confidence": "high", "evidence": ["terraform/main.tf"] } ],
  "needs_confirmation": ["base_profile", "sensitive"]
}
```

- Conservative: medium-confidence dimensions go into `needs_confirmation`
- If no base_profile detected, set to `"unknown"` and add to needs_confirmation
- CLI: `node bin/detect-project-intent.cjs [--root <path>] [--json]`
- Without `--json`, print human-readable table of dimensions + confidence + evidence
- Export: `module.exports = { detectProjectIntent }`
- Use only `fs` and `path` -- no external dependencies

**2b. Extend `bin/sync-baseline-requirements.cjs`**:

Refactor: extract the merge logic (steps 2-7 of the existing function: read existing reqs, build lookup, assign IDs, write) into a private helper `_syncFromBaseline(baseline, projectRoot)`. Then:

```javascript
function syncBaselineRequirements(profile, projectRoot) {
  const { loadBaselineRequirements } = require('./load-baseline-requirements.cjs');
  const baseline = loadBaselineRequirements(profile);
  return _syncFromBaseline(baseline, projectRoot || process.cwd());
}

function syncBaselineRequirementsFromIntent(intent, projectRoot) {
  const { loadBaselineRequirementsFromIntent } = require('./load-baseline-requirements.cjs');
  const baseline = loadBaselineRequirementsFromIntent(intent);
  return _syncFromBaseline(baseline, projectRoot || process.cwd());
}
```

The existing `syncBaselineRequirements` MUST produce identical results after refactoring.

New CLI flags (in the `if (require.main === module)` block):
- `--detect` -- runs `require('./detect-project-intent.cjs').detectProjectIntent(process.cwd())`, uses `result.suggested` as intent
- `--intent-file <path>` -- reads intent JSON from file

Priority: `--intent-file` > `--detect` > `--profile` > config.json `intent` > config.json `profile`

Exports: `{ syncBaselineRequirements, syncBaselineRequirementsFromIntent }`

**2c. Update `commands/qgsd/sync-baselines.md`**:

- Update `argument-hint` to: `[--profile <web|mobile|desktop|api|cli|library>] [--detect]`
- Add `--detect` mode to Step 1:
  - If `--detect` flag: run `node bin/detect-project-intent.cjs --root . --json`, parse output, display signals table to user, use AskUserQuestion for medium-confidence dimensions (`needs_confirmation` array), build confirmed intent, write to temp file, run sync with `--intent-file`
  - If no flag and no profile in config: offer choice between profile picker (existing) and auto-detect
  - After successful intent-based sync, store confirmed intent in `.planning/config.json` as `intent: {...}` field
- Keep existing profile-based flow completely intact
  </action>
  <verify>
Run: `node bin/detect-project-intent.cjs --root /Users/jonathanborduas/code/QGSD --json` -- must produce valid JSON with suggested intent.
Run: `node bin/sync-baseline-requirements.cjs --profile cli --json` -- must still work (backwards compat).
Run: `node --test bin/sync-baseline-requirements.test.cjs` -- all 12 existing tests pass.
  </verify>
  <done>
- detect-project-intent.cjs produces valid intent from repo traces with confidence levels
- sync-baseline-requirements.cjs supports --detect and --intent-file flags
- Refactored internals use _syncFromBaseline helper, identical behavior for profile mode
- sync-baselines.md skill documents --detect mode with user confirmation flow
- Existing --profile flow is unchanged
  </done>
</task>

<task type="auto">
  <name>Task 3: Add tests for detect-project-intent, extend load-baseline and sync-baseline tests</name>
  <files>
    bin/detect-project-intent.test.cjs
    bin/load-baseline-requirements.test.cjs
    bin/sync-baseline-requirements.test.cjs
  </files>
  <action>
**3a. Create `bin/detect-project-intent.test.cjs`** using `node:test` and `node:assert/strict` (same pattern as existing test files). Use temp directories with `fs.mkdtempSync` for isolation:

1. Empty dir -> all false/none, base_profile "unknown", needs_confirmation includes "base_profile"
2. Dir with `main.tf` file -> iac: true, confidence: "high"
3. Dir with `LICENSE` file -> oss: true, confidence: "high"
4. Dir with `Dockerfile` -> deploy: "docker", confidence: "high"
5. Dir with `pnpm-workspace.yaml` -> monorepo: true
6. Dir with package.json containing `next` in dependencies -> base_profile: "web"
7. Dir with package.json containing `electron` in devDependencies -> base_profile: "desktop"
8. Combined signals merge correctly (main.tf + LICENSE + Dockerfile -> iac:true, oss:true, deploy:"docker")
9. Return shape has `suggested`, `signals`, `needs_confirmation` fields and they are correct types
10. CLI `--json --root <tmpdir>` flag produces valid JSON output (use `require('child_process').execFileSync` with `node` as command and script path as argument -- NOT exec/execSync with string interpolation)

Clean up temp dirs in afterEach.

**3b. Extend `bin/load-baseline-requirements.test.cjs`** -- add new tests AFTER existing test 20 (append, do not modify existing tests):

21. `loadBaselineRequirementsFromIntent({base_profile:"web"})` returns 34 reqs (same as web profile)
22. `loadBaselineRequirementsFromIntent({base_profile:"cli"})` returns 13 reqs (same as cli profile)
23. `loadBaselineRequirementsFromIntent({base_profile:"web", iac:true})` returns 46 (34 + 12 IaC for web)
24. `loadBaselineRequirementsFromIntent({base_profile:"library", iac:true})` returns 6 (library base + 0 IaC since library not in IaC profiles)
25. web+iac intent `packs_applied` contains all 7 pack names
26. cli intent (no extras) `packs_applied` contains only 4 always packs (security, reliability, observability, ci-cd)
27. Missing base_profile throws error
28. Minimal intent `{base_profile:"api"}` works with defaults applied, returns 18 reqs
29. Intent result has `intent` field in return object with has_ui derived

Import `loadBaselineRequirementsFromIntent` from the module.

**3c. Extend `bin/sync-baseline-requirements.test.cjs`** -- add new tests AFTER existing test 12 inside the describe block (append, do not modify existing tests):

13. `syncBaselineRequirementsFromIntent({base_profile:"cli"}, tmpDir)` on empty project adds same count as profile-based sync
14. `syncBaselineRequirementsFromIntent` idempotency: second run adds nothing
15. IAC prefix gets independent counter: pre-populate IAC-05 in temp project, sync with `{base_profile:"web", iac:true}`, new IAC reqs should start at IAC-06+
16. Backwards compat: `syncBaselineRequirements("cli", tmpDir)` still works after refactor
17. Sequential: profile sync "cli" then intent sync `{base_profile:"cli", iac:true}` -> only IaC reqs added on second call
18. Return shape of syncBaselineRequirementsFromIntent includes added, skipped, total_before, total_after

Import `syncBaselineRequirementsFromIntent` from the module.
  </action>
  <verify>
Run: `node --test bin/detect-project-intent.test.cjs` -- all 10 tests pass.
Run: `node --test bin/load-baseline-requirements.test.cjs` -- all 29 tests pass (20 existing + 9 new).
Run: `node --test bin/sync-baseline-requirements.test.cjs` -- all 18 tests pass (12 existing + 6 new).
Run: `node --test bin/detect-project-intent.test.cjs bin/load-baseline-requirements.test.cjs bin/sync-baseline-requirements.test.cjs` -- full suite green.
  </verify>
  <done>
- detect-project-intent.test.cjs has 10 tests covering all detection dimensions and CLI
- load-baseline-requirements.test.cjs has 29 tests total (20 existing unchanged + 9 new intent tests)
- sync-baseline-requirements.test.cjs has 18 tests total (12 existing unchanged + 6 new intent sync tests)
- All tests pass with zero failures
  </done>
</task>

</tasks>

<verification>
1. Backwards compatibility: `node bin/load-baseline-requirements.cjs --profile cli` returns 13 reqs
2. Intent loading: `echo '{"base_profile":"web","iac":true}' > /tmp/i.json && node bin/load-baseline-requirements.cjs --intent-file /tmp/i.json` returns 46 reqs
3. Detection: `node bin/detect-project-intent.cjs --root . --json` produces valid intent
4. Intent sync: `node bin/sync-baseline-requirements.cjs --detect --json` works end-to-end
5. Full test suite: `node --test bin/detect-project-intent.test.cjs bin/load-baseline-requirements.test.cjs bin/sync-baseline-requirements.test.cjs` all green
</verification>

<success_criteria>
- iac.json has 12 requirements in correct format matching security.json structure
- index.json has packs section with 7 entries (4 always, 3 conditional)
- loadBaselineRequirementsFromIntent produces correct filtered requirement sets
- detectProjectIntent scans repo traces and produces intent suggestions with confidence
- syncBaselineRequirementsFromIntent merges intent-based baselines idempotently
- sync-baselines.md skill supports --detect mode with user confirmation flow
- All 20 existing load-baseline tests pass unchanged
- All 12 existing sync-baseline tests pass unchanged
- 25 new tests cover intent loading, detection, and intent sync
</success_criteria>

<output>
After completion, create `.planning/quick/157-implement-intent-driven-baseline-require/157-SUMMARY.md`
</output>
