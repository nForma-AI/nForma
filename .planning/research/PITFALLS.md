# Domain Pitfalls Research: v0.26 Operational Completeness

**Domain:** Adding portable installers, credential management, policy configuration, terminal dashboards, architecture constraints, and cross-model decomposition analysis to an existing Claude Code plugin with formal verification enforcement.

**Researched:** 2026-03-03

**Overall Confidence:** HIGH

---

## Executive Summary

v0.26 targets six operational features: portable cross-platform installation, credential lifecycle management, policy-driven configuration, real-time terminal observability, structural architecture constraints, and formal model composition analysis. These features integrate into an existing system with rigid architectural boundaries:

- Global ~/.claude/ hook installations with no per-project override capability
- Shallow config merge semantics that silently lose nested overrides
- Installed hook copies that diverge from source files when not synced
- Hardcoded paths throughout hook source and installer logic
- Plugin-to-hook signal channels (YAML Task envelopes, `--n N` flags) that are hard contracts
- Formal verification pipelines with strict 5-minute budgets and state space explosion risk

Adding these features creates integration seams where small mistakes compound into silent failures. Portable installers introduce path handling fragility. Credential management adds secret leakage risks and rotation complexity. Policy configuration enables misconfiguration that violates R3 quorum protocol. Dashboards create state consistency issues between the hook layer and display layer. Architecture linting has false-positive/negative tuning problems. Cross-model decomposition merges state spaces that can explode beyond time budgets.

This document catalogs 12 critical pitfalls, 11 technical debt patterns, 9 integration gotchas, 5 performance traps, 3 security mistakes, and 2 UX anti-patterns specific to this integration problem.

---

## Critical Pitfalls

### Pitfall 1: Hardcoded Paths in Installer Break Portable Installs

**What goes wrong:**

The existing `bin/install.js` contains hardcoded absolute paths like `/opt/homebrew/bin/codex` in `bin/providers.json` and absolute home directory expansions. When the installer runs on a different machine or OS, these paths are invalid, causing provider health checks to fail silently and quorum dispatch to halt with cryptic "provider unavailable" errors. The user has no indication that the CLI path is wrong — the provider just doesn't appear in the available slots.

**Why it happens:**

The macOS development environment has standard homebrew paths. The installer was initially written to work "on Jonathan's machine" where homebrew is installed at `/opt/homebrew/bin/`. When ported to Linux, Windows, or non-homebrew environments, the same paths are hardcoded into the installed hooks and config, creating environment-specific binaries that don't travel.

**How to avoid:**

1. Eliminate hardcoded CLI paths from `bin/providers.json`. Instead, store only the binary name (`codex`, `gemini`, `copilot`) and use dynamic `resolve-cli.cjs` (already exists in the codebase) to locate them at runtime via `which` / `where.exe`.
2. In `bin/install.js`, replace any absolute home expansions with parameterized templates. For example, instead of writing `/Users/jonathan/.claude/`, write a template like `${HOME}/.claude/` that `bin/install.js` expands during installation, with the expansion happening at install-time using `os.homedir()`, not at source-code-time.
3. For macOS-specific paths (like OpenCode's XDG paths), use environment variable detection (`OPENCODE_CONFIG_DIR`, `XDG_CONFIG_HOME`) at installation time, not at source time. The `install.js` already does this for OpenCode (lines 82-100) — apply the same pattern to all runtime paths.
4. All paths written to installed files must go through a template expansion phase in `install.js`. Source files should contain placeholder tokens like `{HOME}` or `{HOMEBREW_PREFIX}` that are replaced during `node bin/install.js --global`.

**Warning signs:**

- Provider health check passes locally but fails on CI or a different machine
- `check-provider-health.cjs --json` shows providers as "unavailable" immediately after fresh install
- Installation log shows `Installed ~/.claude/` but actual files contain `/Users/jonathan/.claude/`
- New developer tries to install QGSD on their machine and quorum dispatch fails with "no providers available"
- `diff ~/.claude/hooks/qgsd-prompt.js bin/install.js` reveals that the installed file has different paths than what `install.js` would produce

**Phase to address:**

Portable installer phase (PORT-01, PORT-02, PORT-03). This is a blocker for any subsequent feature: if paths are hardcoded, all downstream installers will fail on non-development machines.

---

### Pitfall 2: Shallow Config Merge Loses Nested Policy Configuration

**What goes wrong:**

Policy configuration (PLCY-01..03) introduces a new nested config block: `policy: { quorum_gate_threshold, model_selection_rules, escalation_policy }`. When a user sets `.claude/qgsd.json` with only `policy.quorum_gate_threshold`, the entire `policy` object replaces the global config's `policy` object due to shallow merge. Any keys not in the project config revert to undefined, and the policy validation logic fails silently or uses undefined defaults.

```javascript
// hooks/config-loader.js shallow merge (line 259)
const merged = { ...DEFAULT_CONFIG, ...globalConfig, ...projectConfig };
// If DEFAULT_CONFIG.policy = { quorum_gate_threshold: 0.8, model_selection_rules: [...], escalation_policy: {...} }
// And projectConfig = { policy: { quorum_gate_threshold: 0.9 } }
// Then merged.policy = { quorum_gate_threshold: 0.9 } — other fields are gone
```

This is a documented Key Decision ("shallow merge for config layering") but is a silent data-loss trap for nested config blocks where partial override is the expected user behavior.

**Why it happens:**

The shallow merge rule was designed for `required_models` and `quorum_active` where full replacement is the intent. Policy configuration is additive metadata where users expect to override only one sub-key without specifying the entire block. The shallow merge contract is not documented for policy configuration, creating a mismatch between user expectations and implementation.

**How to avoid:**

1. Policy configuration must use flat config keys, not a nested object. Instead of `policy.quorum_gate_threshold`, use `policy_quorum_gate_threshold`. Flat keys survive shallow merge correctly.
2. Alternatively, if nested config is unavoidable, add a validator in `validateConfig()` (hooks/config-loader.js) that warns when a partial override is detected. For example:
   ```javascript
   if (projectConfig.policy && DEFAULT_CONFIG.policy) {
     const defaultKeys = Object.keys(DEFAULT_CONFIG.policy);
     const projectKeys = Object.keys(projectConfig.policy);
     if (projectKeys.length < defaultKeys.length) {
       console.warn(`Policy config partial override detected. Project specifies ${projectKeys} but global has ${defaultKeys}. Backfilling missing keys from defaults.`);
       // Backfill missing keys from DEFAULT_CONFIG.policy
     }
   }
   ```
3. Document the config merge behavior explicitly in the policy configuration section of ~/.claude/qgsd.json template comments.

**Warning signs:**

- Policy configuration validation passes locally with full DEFAULT_CONFIG but fails in CI where project config exists
- `node -e "console.log(require('./hooks/config-loader.js').loadConfig())"` shows undefined policy sub-keys
- Fallback defaults appear to be used instead of user-set policy values
- No validator output when partial policy override is detected
- Test coverage of `loadConfig()` only tests full block replacement, not partial override

**Phase to address:**

Policy configuration schema phase (PLCY-01..03). The flat-vs-nested decision must be made before any code reads the policy config — schema changes require updating `validateConfig()`, DEFAULT_CONFIG, and documentation in the same commit.

---

### Pitfall 3: Dashboard State Diverges from Hook Layer — Display Lies

**What goes wrong:**

The terminal dashboard (DASH-01..03) reads quorum status from `quorum-scoreboard.json` and displays it in real-time. Meanwhile, the hook layer (`qgsd-stop.js`, `qgsd-prompt.js`) is dispatching quorum in parallel and updating the scoreboard atomically. Due to timing windows between scoreboard reads and writes, the dashboard displays stale state or shows consensus complete when it's actually still pending. Users see "APPROVED" on the dashboard and assume the decision is made, but the Stop hook hasn't seen the evidence yet and will block the plan delivery.

**Why it happens:**

The dashboard reads `quorum-scoreboard.json` via `fs.readFileSync()` without coordination with the atomic write path. The scoreboard is updated via `update-scoreboard.cjs` which uses `tmpPath + fs.renameSync()` for atomicity. Between the dashboard's read and the actual quorum completion, the file can be stale. The dashboard also doesn't track which turn it last read — it can miss updates if reads slow down and the hook writes faster than the display refreshes.

**How to avoid:**

1. Dashboard state must derive from a single source of truth with explicit versioning. Add a `version` field to `quorum-scoreboard.json` that increments on every write. The dashboard caches the last seen `version` and only updates the display when a new version is detected.
   ```json
   { "version": 47, "rounds": [...], "final_verdict": "PENDING" }
   ```
2. Dashboard reads must be synchronized with hook writes using a lock-free, atomic read pattern. Instead of reading the scoreboard directly, read a "manifest" file that points to the current scoreboard version. The hook writes both the new scoreboard AND the manifest atomically (write manifest last).
3. For real-time updates, don't poll the scoreboard on a fixed interval. Use `fs.watch()` on the scoreboard file and only refresh the display when the file changes.
4. Dashboard must never display a state that contradicts the Stop hook's decision channel. If the dashboard shows "APPROVED" but the Stop hook hasn't injected a decision, the dashboard is lying.

**Warning signs:**

- Dashboard shows "Quorum APPROVED" but Stop hook immediately blocks the turn (check `conformance-events.jsonl`)
- Stale quorum state persists in the display even after `update-scoreboard.cjs` has written new data
- Dashboard refresh rate misses rapid quorum rounds (multiple rounds within 1 second)
- No versioning mechanism on the scoreboard — every read is treated as equally current
- Dashboard state diverges from `conformance-events.jsonl` truth log

**Phase to address:**

Dashboard & observability phase (DASH-01..03). Dashboard implementation must include explicit synchronization with the hook layer's scoreboard writes. Test must compare dashboard display with `conformance-events.jsonl` to verify consistency.

---

### Pitfall 4: Credential Rotation Without Offline Fallback Causes Quorum Deadlock

**What goes wrong:**

Credential management (CRED-01, CRED-02) introduces OAuth token rotation to the provider slots. A background task rotates credentials every 24 hours. If the rotation fails or takes too long, and the CLI slot is mid-quorum dispatch, the slot worker receives an expired token and hangs. The quorum orchestrator waits for the slot-worker response with the old timeout. The slot worker is in a retry loop trying to rotate, exceeding the timeout. The quorum round fails. The Stop hook never sees 3+ consensus votes, so it blocks the plan delivery. The user cannot proceed with the plan because the credentials are stale but also cannot be rotated because quorum is blocked.

**Why it happens:**

Token rotation is implemented as a synchronous pre-dispatch check in the quorum orchestrator. If rotation takes longer than expected or fails, the orchestrator has no offline fallback. The quorum timeout is global (e.g., 30s per slot). If rotation takes 25s, the slot worker has only 5s to complete its work before timeout.

Additionally, the rotation machinery and the quorum dispatch machinery are tightly coupled. A failure in rotation should not block quorum — the slot should either use the old token or be marked unavailable, not hang the entire orchestrator.

**How to avoid:**

1. Credential rotation must be asynchronous and decoupled from quorum dispatch. Implement a background rotation service (separate from the dispatcher) that rotates credentials in the background. Store both the current token and the next token. At dispatch time, the slot checks if the current token is expired; if so, it atomically swaps to the next token (which was refreshed in the background). No synchronous rotation at dispatch time.
2. Implement a credential staleness heuristic. If the credential is within 5 minutes of expiration but the background rotator hasn't finished yet, mark the slot as "stale_cred" and exclude it from the available pool for that round. Don't block the rotation — just deprioritize the slot.
3. Implement an offline fallback. If rotation fails, the slot should fall back to the last known-good token (cached in secure storage) with a "fallback" flag in the scoreboard. This allows quorum to complete even if rotation is broken, with explicit fallback notation per R6.4.
4. Set a separate timeout for credential rotation (e.g., 3s) that is much shorter than the quorum slot timeout (30s). If rotation takes longer than 3s, fail fast and fall back to offline.

**Warning signs:**

- Slot worker hangs with timeout waiting for token rotation to complete
- Quorum round fails with "timeout" error while credentials are being rotated
- No explicit handling of rotation failures in the quorum dispatch path
- Credentials are checked/rotated at dispatch time, not in the background
- No fallback token mechanism if rotation fails

**Phase to address:**

Credential management phase (CRED-01, CRED-02). Must be designed before any slot worker dispatches with rotated credentials. The async/background architecture decision must be made during the schema design phase.

---

### Pitfall 5: Policy as Code Lets Users Violate R3 Quorum Protocol

**What goes wrong:**

Policy configuration (PLCY-01..03) allows users to set `policy.model_selection_rules` that exclude all available external models, reducing the quorum to just Claude (1 model). This violates R3.5: "CONSENSUS requires agreement from all available models" (minimum 2). Or a user sets `policy.quorum_gate_threshold: 0.99`, which in a 4-model quorum requires 3.96 votes (impossible), causing consensus to never succeed. The hook layer has no validation of policy rules against R3 protocol requirements. The policy layer silently violates the requirement.

**Why it happens:**

Policy configuration is designed to be flexible and user-editable. The assumption is that users know what they're doing. But QGSD's R3 quorum protocol has non-negotiable constraints. A mismatch between what policy allows and what R3 requires creates silent protocol violations.

**How to avoid:**

1. Implement R3 protocol validation in the policy loading layer. Add a `validatePolicyAgainstR3()` function in `hooks/config-loader.js` that checks:
   - `policy.model_selection_rules` do not exclude all external models (minimum 1 external required after filtering)
   - `policy.quorum_gate_threshold` is between 0.5 (strict majority) and 1.0 (full consensus)
   - `policy.escalation_policy` steps do not violate the consensus gate (e.g., escalation cannot reduce quorum size below R3.5 minimum)
2. If policy violates R3, emit a CRITICAL warning to stderr and fail the planning command with a specific error message. Do NOT silently downgrade to a reduced protocol.
3. Document the R3 constraints explicitly in the policy configuration schema comment.

**Warning signs:**

- Planning command proceeds with a quorum that violates R3.5 (only 1 model available)
- Policy configuration allows setting impossible thresholds (>1.0, <0.5)
- No R3 compliance check in the policy validation layer
- Consensus gate behavior changes based on user-set policy without protocol constraints

**Phase to address:**

Policy configuration schema phase (PLCY-01..03). R3 validation must be in `validateConfig()` before any policy is ever used. This is a "must-have" pre-shipping validation, not a nice-to-have.

---

### Pitfall 6: Architecture Linting False Positives Cause Alert Fatigue

**What goes wrong:**

Architecture constraint enforcement (ARCH-10: no LLM SDK bundling) is implemented as a linting rule that scans the codebase for `require('openai')`, `require('anthropic')`, etc. The rule works initially but produces false positives: it flags vendored dependencies in `node_modules`, it flags example code in comments, it flags error messages that mention SDK names. The user sees dozens of alerts, all false. They add `.architecture-lintignore` files everywhere to silence the linter. The linting rule becomes noise and is ignored. One day an actual SDK is bundled and nobody notices.

**Why it happens:**

Linting rules are tuned for one codebase and one use case. QGSD is a plugin system where it depends on external CLIs and the host Claude Code environment. A blanket "no SDK" rule is too broad. The rule needs nuance: SDKs are forbidden in the core plugin code but permitted in test fixtures, documentation, etc.

**How to avoid:**

1. Architecture linting must support scoping. Define which file globs are subject to the rule: `forbidden_sdks: { pattern: ["bin/**", "hooks/**"], exclude: ["**/*.test.cjs", "docs/**"] }`. This allows legitimate SDK references in test/doc files without triggering the linter.
2. Implement a "baseline" feature where the linting rule generates a baseline report on first run, and subsequent runs only flag NEW violations. Existing violations are grandfathered in but tracked separately.
3. Keep linting rule documentation up-to-date with examples of false positives and explain why they're false positives. This helps users understand the rule and reduces the impulse to ignore it.
4. When a linting rule starts producing >5% false positives (measured over a month), trigger a review and either refine the rule or document the exceptions.

**Warning signs:**

- `check-architecture.cjs` flags 20+ violations on a clean codebase
- Users add large `.architecture-lintignore` files to silence the linter
- Linting rule catches SDK references in comments, vendored code, or test files
- CI passes with linting warnings; developers stop reading the output
- Architecture violations appear without triggering the linter

**Phase to address:**

Architecture enforcement phase (ARCH-10). Linting rules must be tuned with realistic false-positive expectations from the start. This includes scoping, baselining, and documentation.

---

### Pitfall 7: Cross-Model Decomposition Exceeds TLC Time Budget

**What goes wrong:**

Cross-model decomposition analysis (DECOMP-05) merges state spaces from multiple TLA+ models to analyze interactions. For example, merging the QGSDQuorum.tla model (interactions between slots) with QGSDHook.tla model (hook lifecycle) and QGSDConfig.tla (config validation). The merge creates a combined state space with thousands more states. TLC is given a 5-minute budget per model (line in PROJECT.md). The combined model exceeds the budget and TLC times out without completing the analysis. The user has no result and cannot proceed with the plan.

**Why it happens:**

State space explosion is a known problem in model checking. Combining two models multiplicatively increases the state space. If Model A has 1M states and Model B has 100k states, the combined model can have 100B+ states depending on synchronization points. The 5-minute budget is reasonable for individual models but becomes a bottleneck when decomposing into sub-models.

**How to avoid:**

1. Decomposition analysis must include a state space size estimate BEFORE running TLC. Use a lightweight heuristic (count variables, compute upper bounds on their domains) to estimate the state space. If estimated states exceed a threshold (e.g., 10M), alert the user that TLC will likely timeout and offer to run a reduced analysis (fewer variables, fewer steps).
2. Implement state space reduction techniques in the merged model: symmetry declarations, abstract models (ignore irrelevant variables), fairness constraints (reduce interleavings). The TLA+ model repository already uses these; apply them to merged models.
3. Increase the time budget for decomposition analysis specifically. The 5-minute budget is for single-model checking. Decomposition analysis can have a separate 15-minute budget to allow for the larger combined state space.
4. Implement a "decomposition depth" limit. If decomposing beyond 2 models, require explicit user approval and additional time budget. Decomposition is valuable for finding interactions but is expensive.

**Warning signs:**

- TLC times out on decomposition analysis after exactly 5 minutes
- No pre-flight estimate of merged state space size
- Decomposition analysis is attempted on large models without reduction techniques
- User has no alternative if TLC exceeds budget (can't proceed with the plan)
- Merged model includes all variables from both parent models (should prune irrelevant ones)

**Phase to address:**

Cross-model decomposition phase (DECOMP-05). Requires TLC time budget review and state space estimation heuristics before any decomposition is attempted. This is a "must-have" for shipping decomposition analysis.

---

### Pitfall 8: Hook Sync Omitted After Config-Loader.js Edit — Installed Config Is Stale

**What goes wrong:**

Policy configuration (PLCY-01..03) requires adding new validation logic to `hooks/config-loader.js`. A developer edits the file with new `validatePolicyConfig()` function. They commit and push. But they forget to sync the file: `cp hooks/config-loader.js hooks/dist/config-loader.js && node bin/install.js --claude --global`. The source file has new logic, but the installed copy at `~/.claude/hooks/config-loader.js` is stale. In production, the new validation never runs. Users can set invalid policy values. Quorum behavior diverges from what was designed.

This is Pitfall 5 from the v0.18 research ("Hook Install Sync Omitted After Hook Edits — Silent Non-Deployment") applied to v0.26 with policy config changes.

**Why it happens:**

QGSD's architecture has two copies of each hook: source in `hooks/` and installed in `~/.claude/hooks/`. The installer reads from `hooks/dist/`, not `hooks/`. If a developer forgets to sync, the installed copy is outdated. CI tests run against the source, so tests pass. But production behavior is unchanged. This is the most common integration mistake in QGSD.

**How to avoid:**

Apply the existing v0.18 pattern:
1. Every plan that modifies a hook source file MUST include an explicit install sync task:
   ```
   - [ ] Sync to dist and reinstall: cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js && node bin/install.js --claude --global
   - [ ] Verify installed copy updated: diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js
   ```
2. The verification diff step is mandatory — it confirms the installed copy matches the source.
3. Plans that modify hooks without this step should be flagged during plan-phase review.

**Warning signs:**

- A plan that edits a hook source file with no `cp hooks/...` step
- New hook behavior not observed in a live session despite tests passing
- `diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js` showing differences after a plan run
- Policy validation logic not firing even though the code was added to config-loader.js

**Phase to address:**

Every phase that modifies any hook file. This is a process requirement, not a one-time fix. Applied at each phase through plan review and execution checklist.

---

### Pitfall 9: Installer Paths Parameterized But Not Expanded for Users

**What goes wrong:**

The installer (PORT-01..03) has been updated to use template paths: `${HOME}/.claude/` in source files, expanded to `/Users/jonathan/.claude/` at install time. But the user-facing installation documentation says "Clone the repo and run `node bin/install.js --global`". What actually happens? The installer reads source files, expands templates, and writes to the installed location. But if a user later edits the installed file directly (thinking it's the source), their edit is lost next time the installer runs. Worse, if the user copies the installed file to another machine, the templates are already expanded and the paths are machine-specific.

**Why it happens:**

Template expansion is a runtime decision. The installer chooses the expansion at install time. But users don't understand that the installed files contain expanded paths and shouldn't be edited or copied to other machines.

**How to avoid:**

1. Document in the installation guide that `node bin/install.js --global` is a one-way operation. Installed files are generated and should not be hand-edited. If the user needs to customize behavior, they edit `.claude/qgsd.json` config, not the installed hooks.
2. If a user wants to share QGSD with a teammate, they share the SOURCE repo (bin/, hooks/), not the installed files. The teammate runs the installer on their own machine to get machine-specific paths.
3. Consider adding a "reinstall" safeguard in the installer. If the user runs `node bin/install.js --global` again, the installer checks if installed files are stale and offers to refresh them. This prevents divergence.

**Warning signs:**

- User edits installed hooks directly and complains the changes were lost
- User copies `~/.claude/hooks/` to another machine and quorum dispatch fails with invalid paths
- Installer documentation doesn't mention template expansion
- No mechanism to detect stale installed files vs. the source repo

**Phase to address:**

Portable installer phase (PORT-01..03). Documentation and installer safety mechanisms must be in place during initial release.

---

### Pitfall 10: Credential Secrets Checked Into Git History

**What goes wrong:**

Credential management (CRED-01, CRED-02) uses keytar to store secrets securely. But if a developer hardcodes a test credential in a test file or in `.claude/qgsd.json` during development, the credential gets committed to the repo. Even if it's later deleted, Git history preserves it. An attacker can browse the commit history and extract credentials. Additionally, GitHub now scans for hardcoded secrets, but the detector might miss domain-specific credentials used by QGSD (e.g., a provider API key that doesn't match GitHub's regex patterns).

**Why it happens:**

Credentials are sensitive but credentials are also necessary for development and testing. Developers create test credentials to verify the rotation logic works. They check them in for easy testing. Later they realize the mistake and delete the files. But Git history is forever.

**How to avoid:**

1. Use environment variable injection for test credentials, never hardcoded values. Tests read credentials from `process.env.TEST_CRED_*` and skip credential tests if the env var is not set. This way, credentials never touch the source tree.
2. Add a pre-commit hook that scans for common credential patterns: API_KEY, SECRET, TOKEN in config files and source code. Use a tool like `detect-secrets` or GitHub's `secret-scanning` locally.
3. Provide a `.credentials.template.json` file in the repo showing the structure of credentials, but with all values as placeholders: `{ "provider_api_key": "your-key-here" }`. Users copy this to `.credentials.json` (in .gitignore), fill in real values, and source code never sees them.

**Warning signs:**

- Test file contains hardcoded API keys or tokens
- `.claude/qgsd.json` in a commit includes real credentials
- `git log --all -S "SECRET_KEY"` returns results
- GitHub secret-scanning alerts are being ignored or dismissed

**Phase to address:**

Credential management phase (CRED-01, CRED-02). Credential handling patterns must be enforced from the start of development, not retrofitted later.

---

### Pitfall 11: Terminal Dashboard Renders While TTY Disconnects

**What goes wrong:**

The terminal dashboard (DASH-01..03) uses a terminal UI library (blessed, ink, etc.) to render real-time quorum status. The dashboard listens to stdin for keyboard input and renders to stdout. If the terminal disconnects (user closes the terminal window, SSH session drops, or the terminal is piped to a file), the dashboard tries to write to a closed stdout and crashes with EPIPE error. The quorum orchestrator is still running in the background, but the user sees nothing on the display.

**Why it happens:**

Terminal UI libraries expect an interactive terminal. When stdout is not a TTY (e.g., piped to a file), the library's rendering calls fail. The dashboard code doesn't check for TTY before rendering.

**How to avoid:**

1. Before starting the dashboard, check `process.stdout.isTTY`. If false, don't render the TUI; instead, log quorum status to plain text (no colors, no formatting).
2. If the terminal disconnects during operation, the EPIPE error should be caught and logged without crashing. The quorum dispatcher should continue operating in the background.
3. Implement a fallback "non-interactive" mode for the dashboard. If no TTY, the dashboard outputs structured JSON or plaintext status updates to stdout/stderr, which can be piped to files or parsed by other tools.

**Warning signs:**

- Dashboard crashes with "EPIPE" or "write after close" error
- Dashboard only works in an interactive terminal; fails when piped or in CI
- No output if stdout is redirected to a file
- User loses visibility into quorum status because the TUI crashed

**Phase to address:**

Dashboard & observability phase (DASH-01..03). Must handle TTY detection and fallback modes from day 1.

---

### Pitfall 12: Formal Model Annotations Drift From Actual Implementation

**What goes wrong:**

Cross-model decomposition (DECOMP-05) relies on `@requirement` annotations in TLA+ model files (established in v0.25). Each annotation links a formal property to a requirement ID (e.g., `@requirement R3.5`). The annotation says the model verifies R3.5 (quorum consensus). But the planner updates the quorum logic in `quorum.md` without updating the TLA+ model. The annotation is now stale — the model no longer captures the actual behavior. When decomposition analysis composes models, it merges outdated models with current implementation, creating a false sense of verification coverage.

**Why it happens:**

Annotations are metadata that must be maintained alongside code. When code changes and specs don't change (or vice versa), the annotations become stale. There's no enforcement mechanism to keep them in sync.

**How to avoid:**

1. Implement a drift detection step: before decomposition analysis runs, verify that all `@requirement` annotations in the merged models have corresponding requirements in `.formal/requirements.json`. If an annotation references a requirement that doesn't exist, flag as stale annotation.
2. Add a mandatory update step in the planning process: when a planner modifies a core workflow (quorum.md, plan-phase.md, etc.), the planner must update the corresponding TLA+ model or explicitly mark the annotation as "pending spec update". This creates a backlog of spec updates that are tracked.
3. Implement a "spec-drift" check in CI that runs after every plan execution. If any formal specs are older than the last implementation change for their linked requirement, flag it as requiring a spec update.

**Warning signs:**

- `@requirement` annotations reference requirements that don't exist in `.formal/requirements.json`
- Formal model state space size doesn't match actual implementation complexity
- Decomposition analysis reports "all properties verified" but a real bug exists in the implementation
- No tracking of when formal specs were last updated vs. when requirements changed
- TLA+ model hasn't been regenerated after quorum.md logic change

**Phase to address:**

Cross-model decomposition phase (DECOMP-05) and formal model maintenance (v0.25 ongoing). Annotation drift must be detected at plan time, not after the fact.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded homebrew paths in providers.json | Works immediately on macOS | Installer fails on Linux/Windows; not portable | Never — use dynamic `resolve-cli.cjs` from the start |
| Nested policy config (policy.quorum_gate_threshold) | More readable config file | Silent data loss on partial project override due to shallow merge | Never — use flat keys (policy_quorum_gate_threshold) always |
| No validator for policy config | Faster to ship | Users silently violate R3 protocol; hard to debug | Never — R3 validation is non-negotiable |
| Dashboard reads scoreboard without versioning | Simple implementation | Stale state in display; user confusion | Never — state version tracking is required |
| Credential rotation in the quorum dispatch path | Simple, synchronous code | Rotation failures block quorum; users stuck | Never — rotation must be async/background |
| Skipping install sync for hook changes | Faster iteration | Production hook behavior diverges; silent non-deployment | Never — install sync is mandatory for all hook changes |
| Architecture linting without scoping or baselining | Easy to implement | False positives cause alert fatigue; rule is ignored | Only in MVP with explicit backlog for scoping/baselining |
| No state space estimate before TLC | Faster to run analysis | TLC timeout exceeds budget; user blocked; no fallback | Never — pre-flight estimate is required |
| Test credentials hardcoded in source | Easier to test | Credentials in Git history; security breach | Never — use environment variables or test fixtures in .gitignore |
| Dashboard doesn't check for TTY | Simpler code | EPIPE crashes when piped to file or in CI | Never — TTY check and fallback required |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Portable installer & provider paths | Hardcode `/opt/homebrew/bin/codex` in providers.json | Use dynamic `resolve-cli.cjs` at runtime; installer writes template tokens {HOME}, {HOMEBREW_PREFIX}, etc. |
| Config-loader shallow merge | Add nested policy config expecting partial override to work | Use flat config keys (policy_quorum_gate_threshold) or implement deep-merge with warning in validateConfig() |
| Policy config & R3 protocol | Allow policy.quorum_gate_threshold > 1.0 or < 0.5 | Validate policy against R3 constraints in validateConfig(); emit CRITICAL error if violated |
| Dashboard & scoreboard sync | Dashboard polls scoreboard without versioning; reads can be stale | Add version field to scoreboard; dashboard caches last seen version; only refresh on new version detected |
| Credential rotation & quorum dispatch | Rotate credentials synchronously at dispatch time | Implement async background rotation; cache current + next token; swap at dispatch with offline fallback |
| Hook edit & installation | Edit hooks/config-loader.js without syncing to hooks/dist/ | Always: `cp hooks/config-loader.js hooks/dist/config-loader.js && node bin/install.js --claude --global`; verify with diff |
| Policy config & user override | Document "project config overrides global" without specifying full block replacement | Document that shallow merge replaces entire policy object; if partial override is needed, use flat keys |
| TLC decomposition & time budget | Merge two large models without state space estimate | Pre-flight estimate with heuristic (count variables, compute bounds); offer reduced analysis if >10M states |
| Credentials & Git history | Hardcode test credentials in .claude/qgsd.json | Use environment variables; add pre-commit hook for secret scanning; provide .credentials.template.json in .gitignore |
| Terminal dashboard & TTY detection | Render TUI without checking if stdout is a TTY | Check process.stdout.isTTY; fallback to plaintext output if no TTY; catch EPIPE errors gracefully |
| Formal models & requirement annotations | Don't update @requirement annotations when quorum logic changes | Add drift detection step before decomposition; track when specs were last updated; flag stale annotations |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Dashboard refreshes on fixed interval while scoreboard updates asynchronously | Display lags behind actual state; user confusion | Use fs.watch() on scoreboard file; refresh only on change detected, not on fixed interval | When quorum completes faster than refresh interval (e.g., sub-second rounds) |
| Policy validation runs on every config load | Config loading latency increases | Cache validated policy in memory; invalidate cache only when config file changes or on explicit reload | At 100+ planning commands per session; noticeable latency in startup |
| Credentials rotated for every slot dispatch | Token rotation overhead exceeds slot timeout | Rotate credentials async in background every 20 hours; cache rotation result; swap at dispatch time | When 4+ slots are dispatched in parallel; rotation delays exceed quorum timeout |
| Architecture linting runs on entire codebase | Lint time exceeds user patience | Scope linting to changed files via git diff; run baseline on full codebase only once; incremental linting after | At 100k+ lines of code; linting takes >5s on each planning command |
| Decomposition analysis merges all models regardless of complexity | TLC timeout occurs on every decomposition attempt | Estimate state space size before merging; skip decomposition if estimated >10M states; offer reduced merge | When decomposing 3+ large models simultaneously |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|----------|
| Credentials hardcoded in config files or source code | Leaked secrets in Git history; attacker can impersonate provider calls | Use keytar for secure storage; environment variables for tests; .credentials.template.json template; pre-commit scanning for secrets |
| Policy configuration allows users to disable all quorum models | Reduces to single-model decision; violates R3.5 protocol; allows plan delivery without consensus | Validate policy.model_selection_rules to ensure >= 1 external model available after filtering; emit CRITICAL error if violated |
| Installed hook files expose sensitive paths or credentials in plaintext | Path disclosure enables targeted attacks; credential exposure in installed files | Sanitize installed files; don't write real credentials to hooks; use config layer for sensitive data; installed files should be read-only (chmod 644) |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Portable installer fails silently with "provider unavailable" | User can't run quorum; no indication that install failed; assumes quorum is broken | Show installer verification step that tests each provider health; report failure with specific remediation (e.g., "Codex CLI not found at /opt/homebrew/bin/codex. Install with brew install codex.") |
| Dashboard state diverges from hook layer; shows "APPROVED" but plan blocks | User sees confusing conflict; trusts dashboard, plan is blocked, user confused about reason | Ensure dashboard state always matches Stop hook decision channel; use versioned scoreboard; sync mechanism explicit |
| Policy configuration allows invalid thresholds; silently fails consensus | User sets policy.quorum_gate_threshold: 1.5; consensus never succeeds; user has no idea why | Emit CRITICAL error at policy load time with specific reason and correct values; offer to reset to defaults |

---

## "Looks Done But Isn't" Checklist

- [ ] **Portable installer:** Verify that `node bin/install.js --global` works on a fresh Linux machine (not just macOS) — hardcoded paths are discovered immediately
- [ ] **Template path expansion:** Run `diff ~/.claude/hooks/config-loader.js <(node bin/install.js --claude --show-files | grep config-loader)` to verify installed files have expanded paths, not templates
- [ ] **Config shallow merge:** Run `node -e "const c = require('./hooks/config-loader.js'); console.log(JSON.stringify(c.loadConfig('.'), null, 2))"` with a partial project policy override — verify no policy sub-keys are undefined
- [ ] **Policy R3 validation:** Try to set policy.quorum_gate_threshold: 0.99 in project config and run `node bin/install.js --claude --global` — verify CRITICAL error is emitted, not silent failure
- [ ] **Dashboard state sync:** Open dashboard, watch scoreboard file with `tail -f .planning/quorum-scoreboard.json`, run quorum, compare dashboard display to latest scoreboard version field — must match exactly
- [ ] **Credential rotation offline fallback:** Simulate a provider API being down during credential rotation — verify quorum dispatch either falls back to old token or marks slot unavailable, doesn't timeout
- [ ] **Hook install sync:** Edit `hooks/config-loader.js`, don't sync, run test that reads config — verify test passes (source is used), but installed config is stale (would fail in production)
- [ ] **TLC decomposition budget:** Attempt to decompose two large models (e.g., QGSDQuorum.tla + QGSDHook.tla) — verify pre-flight estimate is shown and TLC respects 5-min budget without timeout
- [ ] **Credential secrets:** Run `git log --all --full-history -S "CRED_" -- "." ":!node_modules"` — verify no hardcoded credentials in history
- [ ] **Dashboard TTY fallback:** Run `node bin/quorum.md 2>&1 | tee quorum.log` to pipe dashboard output to file — verify fallback plaintext mode is used, not EPIPE crash

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hardcoded paths in installer cause provider unavailability | MEDIUM | Refactor providers.json to use dynamic resolve-cli.cjs; update installer to template expand {HOME} and {HOMEBREW_PREFIX}; regenerate ~/.claude/ with fresh install |
| Config shallow merge loses policy sub-keys | LOW | Flatten policy config keys (policy_quorum_gate_threshold instead of policy.quorum_gate_threshold); update validateConfig() and DEFAULT_CONFIG; document the change |
| Dashboard state diverges from Stop hook | MEDIUM | Add version field to scoreboard; implement fs.watch() on scoreboard; verify dashboard matches version before displaying decision; test sync against conformance-events.jsonl |
| Credential rotation blocks quorum dispatch | MEDIUM | Decouple rotation from dispatch; implement async background rotation; add offline fallback token with atomic swap; test with provider API down scenario |
| Policy violates R3 protocol silently | LOW | Add validatePolicyAgainstR3() to config-loader.js; emit CRITICAL error if threshold > 1.0 or model count < 2; provide reset-to-defaults option |
| Hook edit without install sync (stale production behavior) | LOW | `cp hooks/config-loader.js hooks/dist/config-loader.js && node bin/install.js --claude --global`; verify with `diff hooks/dist/config-loader.js ~/.claude/hooks/config-loader.js` |
| Credentials in Git history | MEDIUM | Use `git filter-repo` to purge commit history (requires repo rewrite); regenerate all credentials; add pre-commit hook for secret scanning; rotate all potentially exposed credentials at providers |
| TLC decomposition timeout | LOW | Implement state space size estimate heuristic; if > 10M states, offer reduced analysis (fewer variables or steps); increase TLC time budget for decomposition to 15 min |
| Terminal dashboard TTY failure (EPIPE) | LOW | Add process.stdout.isTTY check before rendering TUI; implement fallback plaintext mode; wrap render calls in try/catch for EPIPE |
| Formal model annotations drift from implementation | MEDIUM | Add drift detection step before decomposition; run spec-drift check in CI; update @requirement annotations when implementation changes; track spec last-modified date |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hardcoded paths in installer (Pitfall 1) | Portable installer phase (PORT-01, PORT-02, PORT-03) | `node bin/install.js --global` works on fresh Linux/Windows machine; `check-provider-health.cjs --json` shows all providers available |
| Shallow config merge loses policy (Pitfall 2) | Policy config schema phase (PLCY-01, PLCY-02, PLCY-03) | `loadConfig()` partial override test passes with no undefined policy fields; `validateConfig()` emits warning on partial override |
| Dashboard state diverges (Pitfall 3) | Dashboard & observability phase (DASH-01, DASH-02, DASH-03) | Dashboard display matches latest scoreboard version field; compare dashboard with `conformance-events.jsonl` to verify consistency |
| Credential rotation deadlock (Pitfall 4) | Credential management phase (CRED-01, CRED-02) | Simulate provider API down during rotation; verify quorum either falls back or marks slot unavailable; test succeeds without timeout |
| Policy violates R3 protocol (Pitfall 5) | Policy config schema phase (PLCY-01..03) | Attempt to set invalid policy threshold; verify CRITICAL error is emitted; cannot proceed with quorum |
| Architecture linting false positives (Pitfall 6) | Architecture enforcement phase (ARCH-10) | Run `check-architecture.cjs` on clean codebase; verify < 5% false positives; scope linting to core/ exclude test/ docs/ |
| Cross-model decomposition timeout (Pitfall 7) | Cross-model decomposition phase (DECOMP-05) | Pre-flight state space estimate is shown; TLC completes within 5-min budget; offer reduced analysis if >10M states |
| Hook sync omitted (Pitfall 8) | Every phase modifying hooks | `diff hooks/dist/config-loader.js ~/.claude/hooks/config-loader.js` is empty after plan execution; new validation logic fires in production |
| Installer paths parameterized but not expanded (Pitfall 9) | Portable installer phase (PORT-01..03) | Documentation states "don't edit installed files"; installer checks for stale files on re-run; user guide recommends reinstall after OS upgrade |
| Credentials in Git history (Pitfall 10) | Credential management phase (CRED-01, CRED-02) | Pre-commit hook scans for secrets; test credentials use environment variables; no credentials in any commit history |
| Dashboard renders without TTY check (Pitfall 11) | Dashboard & observability phase (DASH-01..03) | `process.stdout.isTTY` is checked before TUI rendering; plaintext fallback works when piped to file; no EPIPE crashes |
| Formal model annotations drift (Pitfall 12) | Cross-model decomposition phase (DECOMP-05) | Drift detection runs before decomposition; stale annotations are flagged with specific requirement IDs; spec-drift CI check passes |

---

## Sources

- **Live source analysis** (HIGH confidence):
  - `/Users/jonathanborduas/code/QGSD/bin/install.js` — hardcoded paths, template expansion patterns
  - `/Users/jonathanborduas/code/QGSD/hooks/dist/config-loader.js` — shallow merge at line 259; DEFAULT_CONFIG structure
  - `/Users/jonathanborduas/code/QGSD/bin/providers.json` — provider path definitions; no dynamic resolution
  - `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — Key Decisions on hook install sync (v0.13-06 INT-03), shallow merge (Phase 2 CONF-02), atomic writes (Phase v0.24)
  - `/Users/jonathanborduas/code/QGSD/CLAUDE.md` — R3 protocol requirements (R3.5: consensus from all available models; R6.2: minimum valid quorum)

- **Prior research** (HIGH confidence):
  - `.planning/research/PITFALLS.md` (v0.18) — Pitfalls 1-5 from token efficiency work; hook sync pattern; config merge semantics; Stop hook contract
  - `.planning/research/ARCHITECTURE.md` (v0.18) — Integration seams, component boundaries, atomic write patterns, fail-open design
  - `.planning/PROJECT.md` current milestone v0.26 — Lists all 6 target features (PORT, CRED, PLCY, DASH, ARCH, DECOMP)

- **External research** (MEDIUM-HIGH confidence):
  - Node.js portable installer guidance: [portable-node-guide on GitHub](https://github.com/tumregels/portable-node-guide); path handling via path.normalize(), os.homedir(); cross-platform spawning pitfalls
  - Terminal UI/TUI in Node.js: [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/); TTY detection with process.stdout.isTTY; Ink/blessed frameworks; EPIPE error handling
  - Credential management: [npm security changes](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/); token rotation strategies [How to Create Token Rotation Strategies](https://oneuptime.com/blog/post/2026-01-30-token-rotation-strategies/view); async patterns; fallback mechanisms
  - Policy as code: [Spacelift Policy as Code tools](https://spacelift.io/blog/policy-as-code-tools); validation patterns; YAML configuration pitfalls [Your configs suck? Try a real programming language](https://beepb00p.xyz/configs-suck.html)
  - Architecture linting: [OWASP linting guidelines](https://owasp.org/www-project-devsecops-guideline/latest/01b-Linting-Code); scoping strategies; false-positive tuning
  - Formal verification: [TLA+ state space explosion](https://pzuliani.github.io/papers/LASER2011-Model-Checking.pdf); [Model checking survey](https://www.sciencedirect.com/science/article/pii/S1474667017372166); [Alibaba TLA+ intro](https://www.alibabacloud.com/blog/formal-verification-tool-tla%2B-an-introduction-from-the-perspective-of-a-programmer_598373); compositional verification; PRISM [Wikipedia](https://en.wikipedia.org/wiki/PRISM_model_checker) and [manual](https://prismmodelchecker.org/manual/Main/AllOnOnePage)

---

*Pitfalls research for: QGSD v0.26 Operational Completeness*
*Domain: Portable installers, credential management, policy configuration, terminal dashboards, architecture constraints, and cross-model formal model composition*
*Researched: 2026-03-03*
