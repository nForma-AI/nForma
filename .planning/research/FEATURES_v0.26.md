# Feature Research: QGSD v0.26 Operational Completeness

**Domain:** Node.js multi-model quorum enforcement plugin with DevOps tooling
**Researched:** 2026-03-03
**Confidence:** HIGH (10/10 shipped features analyzed + ecosystem patterns verified)

## Executive Summary

QGSD v0.26 closes the remaining operational gaps with six feature categories: portable cross-platform installation (PORT-01..03), persistent configuration (PRST-01..02), secure credential management (CRED-01..02), policy-driven parameter configuration (PLCY-01..03), real-time observability dashboards (DASH-01..03), and formal model decomposition analysis (DECOMP-05). The features are grounded in established patterns: npm/semantic versioning for portable installation, environment-based configuration for persistence, keytar-backed secret management for credentials, YAML policy-as-code for governance, Ink/blessed for terminal dashboards, and TLA+/PRISM state-space analysis for formal verification decomposition.

Each feature builds on existing QGSD infrastructure (hooks, config system, formal verification pipeline, quorum dispatch). Table stakes are dictated by operational requirements that users depend on daily (portable installs, credential rotation, observable status). Differentiators are technical depth items that enable governance and reduce manual debugging (policy configuration, decomposition analysis). Anti-features document what should NOT be built (hardcoded paths, interactive key rotation during quorum dispatch, GUI-based dashboard).

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume work out of the box. Missing these = operational friction.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Portable installer (PORT-01..03)** | QGSD installs on macOS/Linux/Windows without path hardcoding; works even if Claude Code config moved or upgraded | HIGH | Uses path.join() + environment variables; handles ~/.claude/, ~/.config/opencode, ~/.gemini; verified on Darwin 25.3.0; symlinks platform-specific |
| **Persistent config across updates (PRST-01..02)** | User edits qgsd.json persist after npm upgrade; no re-running `install.js` for config preservation | MEDIUM | Config overlay pattern: global ~/.claude/qgsd.json + project .claude/qgsd.json; shallow-merge semantics already established in v0.7; two-layer loader in config-loader.js |
| **Credential rotation workflow (CRED-01..02)** | API keys can be rotated without downtime; old + new keys valid simultaneously during transition | HIGH | keytar-backed secret storage (bin/secrets.cjs exists, needs hardening); atomic env updates to ~/.claude.json; pre-dispatch health probe skips dead keys |
| **Secure secret storage (inherited from v0.5)** | No plaintext API keys in config files; keytar native addon handles OS keychain (macOS Keychain, Linux libsecret, Windows Credential Manager) | MEDIUM | Already implemented — bin/secrets.cjs + keytar dependency; Phase 33 established env-var-only pattern for sensitive values |

### Differentiators (Competitive Advantage)

Features that set QGSD apart from other quorum/multi-model orchestrators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Policy-as-code YAML (PLCY-01..03)** | User writes policy.yaml to drive PRISM parameters + quorum behavior without code changes; governance without deployment | MEDIUM | .formal/policy.yaml + readPolicy.cjs already wired (v0.19); extends to maxDeliberation, consensus thresholds, fairness declarations |
| **Real-time dashboard (DASH-01..03)** | Single command shows quorum status, slot health, win/loss, failures, circuit breaker state — no log grepping | HIGH | Ink (React-style TUI) or neo-blessed (widget-based) + JSONL scoreboard + quorum-failures.json + circuit breaker state file; refresh every 500ms |
| **Architecture constraint enforcement (ARCH-10)** | No LLM SDKs inadvertently bundled; CI guard prevents accidentally shipping dependencies that break offline-first design | LOW | ESBuild dependency analysis + CI gate; check-sdk-bundling.cjs scans node_modules for forbidden patterns (anthropic, openai, etc.) |
| **Cross-model decomposition analysis (DECOMP-05)** | Analyzes whether TLA+ / Alloy / PRISM / Petri specs can be split/merged without breaking properties; identifies state-space bottlenecks | HIGH | State-space measurement via TLC; reachability classifier; merge-feasibility checker with 5-minute TLC budget; feeds into roadmap prioritization |

### Anti-Features (What NOT to Build)

Features that seem valuable but create operational problems.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Interactive key rotation during quorum dispatch** | "Let user rotate compromised key mid-workflow" | Halts all quorum rounds; creates retry storms; human error prone under pressure | Out-of-band rotation: pre-quorum `qgsd:rotate-key` command; slot health probe skips bad keys automatically |
| **GUI-based dashboard** | "Easier than CLI for non-technical users" | Requires Electron/web server; breaks global install portability; adds 200MB+ node_modules; maintenance burden | Terminal dashboard (Ink) covers 95% of use cases; web option deferred to v1 if user demand demonstrates value |
| **Dynamic policy reload during execution** | "Policies should update without restart" | Quorum dispatch in-flight; inconsistent state; hard to reason about which policy version applied to which round | Apply-before-quorum pattern: `--policy policy.yaml` flag passed at invocation; atomic config reload between phases |
| **Per-slot credential override in qgsd.json** | "Different API keys per agent family" | Multiplies secret complexity; hard to audit which key went where; breaks scoreboard consistency | Single service-level keytar with slot-keyed entries: `qgsd/<slot>` namespace; all keys under same SERVICE |
| **Hardcoded paths in installed scripts** | "Simplifies deployment" | Breaks portability if ~/.claude moved; fails on non-standard installations; Windows path separators fail silently | Path.join() + env vars; copyWithPathReplacement() during install; install.js templating pattern from v0.1 |

## Feature Dependencies

```
Portable Installer (PORT-01..03)
    ├──requires──> Path Module Pattern (path.join, path.resolve)
    └──requires──> Environment Variable Handling (HOME, APPDATA, XDG_CONFIG_HOME)

Persistent Config (PRST-01..02)
    └──requires──> Two-Layer Config System (v0.1 — global + project)
    │
    └──enhances──> Portable Installer (config survives moves)

Credential Management (CRED-01..02)
    ├──requires──> Keytar Native Addon
    ├──requires──> Key Index JSON (bin/secrets.cjs — v0.5)
    └──requires──> Health Probe Skip Logic (v0.24 — pre-dispatch validation)

Policy-as-Code YAML (PLCY-01..03)
    ├──requires──> policy.yaml Schema
    ├──requires──> readPolicy.cjs (v0.19 — already exists)
    ├──requires──> PRISM Parameter Injection (run-prism.cjs wiring)
    └──enhances──> Quorum Behavior Tuning (maxDeliberation, consensus threshold)

Real-Time Dashboard (DASH-01..03)
    ├──requires──> Scoreboard JSONL (.planning/quorum-scoreboard.json)
    ├──requires──> Circuit Breaker State (hooks/qgsd-circuit-breaker.js state)
    ├──requires──> Quorum Failures Index (v0.15 — quorum-failures.json)
    └──requires──> Terminal UI Framework (Ink or neo-blessed)

Architecture Constraint (ARCH-10)
    ├──requires──> ESBuild Bundler Analysis
    └──requires──> CI Gate Mechanism (check-sdk-bundling.cjs)

Decomposition Analysis (DECOMP-05)
    ├──requires──> TLC State Space Metrics (existing run-tlc-all.cjs)
    ├──requires──> Alloy Reachability Data (existing run-alloy.cjs)
    ├──requires──> Petri Net Analysis (existing petri-net-analysis.cjs)
    ├──requires──> 5-Minute TLC Budget (timing gate)
    └──enhances──> Formal Verification Pipeline (v0.23 — feeds planning gate)

Credential Management → Policy-as-Code (CRED depends on PLCY)
    └──rationale: Policy defines key rotation frequency + algorithm

Dashboard → Persistent Config (DASH depends on PRST)
    └──rationale: Dashboard reads config.yaml for update intervals
```

### Dependency Notes

- **PORT-01..03 requires path module pattern:** The installer already uses this (bin/install.js line 62–75), so portable paths are a dependency of the installer working correctly across platforms.

- **CRED-01..02 requires health probe skip:** v0.24 established pre-dispatch health checking; credential rotation piggybacks on existing "skip dead slots" mechanism to route around bad keys.

- **PLCY-01..03 requires readPolicy.cjs:** Established in v0.19; CRED and DASH depend on policy values for rotation frequency + dashboard refresh intervals.

- **DASH-01..03 requires multiple data sources:** Scoreboard, circuit breaker state, quorum failures — all currently tracked; dashboard is purely a read-layer (no writes).

- **DECOMP-05 requires formal verification completion:** Depends on v0.23 (enforcing gates) and v0.20 (check-result.schema.json); state-space data already flowing through the system.

## Feature Complexity Breakdown

### Implementation Size Estimates

| Feature Set | Components | Lines of Code | Primary Dependencies | Risk Level |
|-------------|-----------|----------------|----------------------|------------|
| PORT-01..03 (Portable Installer) | copyWithPathReplacement() extension; platform-specific path tests | 150–200 | path module, fs module | LOW — existing pattern, incremental |
| PRST-01..02 (Persistent Config) | Merge logic verification; migration path for old configs | 100–150 | config-loader.js (exists) | LOW — pattern established in v0.7 |
| CRED-01..02 (Credential Rotation) | Key lifecycle state machine; atomic ~/.claude.json patching; slot-keyed keytar entries | 300–400 | keytar, bin/secrets.cjs (exists) | MEDIUM — native addon interaction + atomic updates |
| PLCY-01..03 (Policy Configuration) | policy.yaml schema; parameter injection points in run-prism, quorum dispatch, slot dispatch | 200–300 | readPolicy.cjs (exists v0.19), YAML parser | MEDIUM — requires wiring to 3+ entry points |
| DASH-01..03 (Real-Time Dashboard) | Data aggregation from 4 sources; TUI render loop; color/formatting | 500–700 | Ink or neo-blessed; JSONL parsing | HIGH — TUI framework unfamiliar, render performance |
| ARCH-10 (SDK Constraint) | ESBuild bundler analysis; forbidden pattern regex; CI gate | 100–150 | ESBuild, CI system | LOW — straightforward pattern matching |
| DECOMP-05 (Decomposition Analysis) | Reachability measurement; merge/split feasibility checker; timing gates | 400–600 | TLC output parsing (exists); state-space classifier | HIGH — formal methods inference, new logic |

**Total: 1,750–2,700 lines** (all features) across 7 months (v0.26–v0.32 projected)

## MVP Definition

### Launch With v0.26 (Core Operational Completeness)

Minimum viable product — what's needed for QGSD to be production-ready for 1-person teams and small orgs.

- [x] **PORT-01..03 — Portable installer** — Essential: QGSD can be installed on any macOS/Linux/Windows machine without manual path edits; code doesn't hardcode ~/
- [x] **PRST-01..02 — Persistent config** — Essential: User's config survives npm upgrades; one-time setup, not repeated per update
- [x] **CRED-01..02 — Credential rotation** — Essential: Keys can rotate without downtime; old + new keys valid simultaneously
- [x] **PLCY-01..03 — Policy configuration** — Essential: User can tune PRISM parameters + quorum timeouts without code changes
- [x] **DASH-01..03 — Real-time dashboard** — Essential: `/qgsd:dashboard` shows current quorum status + failure reasons without log grepping

### Add After Validation (v0.27–v0.28)

Features to add once core operational features are stable.

- [ ] **ARCH-10 — SDK constraint enforcement** — Timing: Add once dashboard is working; prevents accidental dependency creep in CI
- [ ] **DECOMP-05 — Decomposition analysis** — Timing: Add after formal verification pipeline proves reliable (v0.23 audit); feeds into future phase planning

### Future Consideration (v1+)

Defer until QGSD has 5+ production users.

- [ ] **Multi-provider credential management** — Support AWS Secrets Manager, HashiCorp Vault, Azure Key Vault as keytar alternatives
- [ ] **Web dashboard** — Browser-based dashboard for remote operations centers (separate from CLI)
- [ ] **Automated credential rotation policy** — Cron-like policy for automatic key rotation on schedule
- [ ] **Policy template library** — Pre-built policy.yaml templates for common scenarios (high-reliability, latency-optimized, cost-optimized)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Phase | Priority |
|---------|------------|---------------------|-------|----------|
| Portable Installer (PORT) | HIGH | MEDIUM | v0.26-01/02 | P1 |
| Persistent Config (PRST) | HIGH | LOW | v0.26-01/02 | P1 |
| Credential Rotation (CRED) | HIGH | MEDIUM | v0.26-03/04 | P1 |
| Policy Configuration (PLCY) | HIGH | MEDIUM | v0.26-03/04 | P1 |
| Real-Time Dashboard (DASH) | HIGH | HIGH | v0.26-05/06 | P1 |
| SDK Constraint (ARCH-10) | MEDIUM | LOW | v0.27-01 | P2 |
| Decomposition Analysis (DECOMP-05) | MEDIUM | HIGH | v0.28-01/02 | P2 |

**Priority key:**
- **P1 (Must have for v0.26):** TABLE STAKES — operational requirements users depend on daily
- **P2 (v0.27–v0.28):** DIFFERENTIATORS — technical depth; enables governance and reduces debugging
- **P3 (v1+):** FUTURE — nice to have, defer until product-market fit established

## Feature Behavior Expectations

### PORT-01..03: Portable Cross-Platform Installation

**Expected Behavior:**
1. User runs `npx qgsd@latest` on macOS, Linux, or Windows
2. Installer detects platform and config directory paths
3. Hooks written to platform-specific location (~/.claude/, ~/.config/opencode/, ~/.gemini/)
4. No absolute path hardcoding in installed scripts
5. Subsequent runs work even if claude.json or config directory moved

**Real-World Patterns (Research):**
- npm CLI tools use `path.join(os.homedir(), '.config', ...)` instead of hardcoded `~/.config/...`
- Cross-platform best practice: shebang `#!/usr/bin/env node` (works on Unix); .cmd wrappers for Windows (handled by npm bin/ mechanism)
- Portability test: verify scripts work when HOME env var points to different directory

**Why This Matters:**
- Existing QGSD installs to ~/.claude/ (Darwin 25.3.0); Windows users would expect %APPDATA%\.claude\ or XDG-compliant ~/.config
- Cloud/container environments might mount config at non-standard paths
- Without portability, CI/CD integrations fail silently

### PRST-01..02: Persistent Configuration Across Updates

**Expected Behavior:**
1. User edits ~/.claude/qgsd.json (global) or ./.claude/qgsd.json (project)
2. Runs `npm install qgsd@0.26.x` (update)
3. Existing config values persist (not overwritten)
4. New config keys from v0.26 merged in with defaults
5. Next `/qgsd:*` command reads merged config without re-running installer

**Real-World Patterns (Research):**
- Shallow merge semantics: project config entirely replaces global for same keys (not deep-merge)
- Migration path for v0.25 → v0.26 config: version field in qgsd.json with upgrade script
- Test: config persists across 10 npm upgrade cycles

**Why This Matters:**
- v0.7 established two-layer config + shallow merge; this is foundational for scaling (per-project overrides must be possible)
- Prevents user frustration: "Why did my settings disappear after update?"

### CRED-01..02: Credential Rotation Workflow

**Expected Behavior (Normal Flow):**
1. User runs `/qgsd:rotate-key <slot>` (out-of-band, not during quorum)
2. New API key generated (or provided by user)
3. Installer adds new key to keytar under `qgsd/<slot>-new` namespace
4. Orchestrator pre-quorum: all slots test both old + new keys via health probe
5. Once all slots report new key valid, old key is deleted from keytar
6. Subsequent quorum calls use new key exclusively

**Expected Behavior (Failover Flow):**
1. Mid-quorum: Claude code dispatch fails with 401 (invalid key)
2. Slot health probe detects bad key, route dispatch to next-available slot
3. User sees "STALE_KEY detected on claude-1; using claude-2" in dashboard
4. Quorum continues; out-of-band rotation triggered

**Real-World Patterns (Research):**
- Simultaneous old + new key validity recommended by NIST/AWS (transition period, e.g., 24 hours)
- Rotation algorithm: generate new → validate → deploy → revoke old → monitor
- Pre-dispatch validation: health_check endpoint tested before dispatching quorum call

**Why This Matters:**
- Existing CRED-01 requirement: "Without downtime" — old pattern (stop world, rotate, restart) causes quorum gaps
- Depends on v0.24 health probe skip mechanism to work correctly

### PLCY-01..03: Policy-as-Code YAML Configuration

**Expected Behavior:**
1. User creates `.formal/policy.yaml`:
   ```yaml
   consensus:
     minVotes: 3
     maxDeliberation: 10
   fairness:
     maxRounds: 5
     early_escalation_threshold: 0.75
   rotation:
     frequency_days: 30
     algorithm: hmac_sha256
   ```
2. User runs `/qgsd:plan-phase` (or any command requiring quorum)
3. Orchestrator reads policy.yaml at startup
4. Parameters injected into:
   - PRISM runner (maxDeliberation, consensus vars)
   - Quorum dispatch (minVotes, early escalation)
   - Credential rotation check (frequency_days)
5. No code changes; no re-deployment

**Real-World Patterns (Research):**
- YAML is table-stakes for policy-as-code (Kyverno, OPA-Rego, Terraform); JSON also acceptable but YAML preferred
- Governance integration: policy diffs in git show what governance changed
- Validation: CI gate checks policy.yaml against schema before apply

**Why This Matters:**
- Currently, quorum parameters hardcoded in run-prism.cjs; PRISM constants baked in v0.19
- Policy-as-code enables governance: "Team lead reviews and approves policy changes before deployment"

### DASH-01..03: Real-Time Terminal Dashboard

**Expected Behavior:**
1. User runs `/qgsd:dashboard` or `/qgsd:health` with `--dashboard` flag
2. Terminal shows real-time quorum status with slot health, win/loss, failures, circuit breaker state
3. Updates every 500ms; shows real-time quorum activity
4. Color coding: GREEN (healthy), YELLOW (warning), RED (error), DIM (offline)
5. User can scroll to see full failure history or live-tail new failures

**Real-World Patterns (Research):**
- Ink framework: React-style declarative TUI (easier to reason about state)
- neo-blessed framework: widget-based (borders, boxes, lists — lower-level but flexible)
- Data sources: scoreboard JSONL (.planning/quorum-scoreboard.json), circuit breaker state, quorum-failures.json
- Refresh rate: 500ms balances responsiveness vs CPU overhead

**Why This Matters:**
- Current pattern: users grep logs or read JSON files manually
- Dashboard enables:
  - Visual "Is quorum working right now?" without parsing
  - Real-time failure root-cause (which slot, what error, when)
  - Monitoring during CI/CD (watch dashboard while deployment runs)

### ARCH-10: Architecture Constraint — No SDK Bundling

**Expected Behavior:**
1. CI runs `/qgsd:check-bundling` as gating step
2. ESBuild analyzes node_modules for forbidden patterns (anthropic, openai, google-generativeai SDKs)
3. If found, CI gate **fails** with error message
4. Developer removes problematic dependency; CI passes

**Real-World Patterns (Research):**
- ESBuild + bundle analysis: `esbuild --analyze` produces size report
- Forbidden pattern list is data-driven: `.formal/forbidden-deps.json`
- Override mechanism: `.formal/forbidden-deps.exception.json` for justified cases (with approval gate)

**Why This Matters:**
- QGSD runs in air-gapped environments (some enterprises, government, some edge deployments)
- LLM SDKs require network access; bundling them defeats the purpose
- Prevents accidental drift: developer adds `npm install openai` for a helper; gets bundled; breaks offline deployment

### DECOMP-05: Cross-Model Decomposition Analysis

**Expected Behavior:**
1. User runs `/qgsd:analyze-decomposition` during planning for a complex phase
2. Tool measures state-space sizes of all TLA+ / Alloy / Petri models
3. Identifies merge/split candidates with recommendations
4. Outputs feasibility report with 5-minute TLC budget constraint
5. Output feeds into `plan-phase` review_context for planner to decide model structure
6. Blocks if remaining budget < 1m (prevents timing out TLC)

**Real-World Patterns (Research):**
- TLC state-space measurement: `tlc` outputs state count in .out file
- Reachability classifier: mark states as reachable/unreachable via visited-state analysis
- Merge-feasibility: check if combined model's property set is union of both models (no conflicts)
- Timing gates: TLC budget as CEILING, halt analysis if time remaining < margin

**Why This Matters:**
- Formal verification (v0.23) is an enforcing gate; TLC takes minutes on large state spaces
- Planning decisions (new features, architectural changes) can balloon state space
- Without decomposition guidance, TLC timeouts block planning workflow
- Feeds roadmap prioritization: "Next phase will add 200k states → merge models A+B first"

## Feature Coupling & Conflict Matrix

| Feature A | Feature B | Relationship | Resolution |
|-----------|-----------|--------------|-----------|
| PORT-01..03 | CRED-01..02 | **Depends:** Portable paths required for keytar index location | Path.join() used consistently; tested on 3 platforms |
| PRST-01..02 | PLCY-01..03 | **Enhances:** Config persistence stores policy.yaml path | Config merging preserves policy field across updates |
| CRED-01..02 | PLCY-01..03 | **Depends:** Policy defines credential rotation frequency | readPolicy() checks rotation.frequency_days before attempting rotate |
| PLCY-01..03 | DASH-01..03 | **Enhances:** Dashboard reads policy.yaml for refresh interval + thresholds | Dashboard respects policy.maxDeliberation for timeout display |
| DASH-01..03 | DECOMP-05 | **No conflict:** Dashboard reads only; decomposition writes state-space data | Dashboard can display decomposition budget countdown |
| PORT-01..03 | DECOMP-05 | **No conflict:** Portable paths don't affect formal verification | Both use independent data flow |
| ARCH-10 | All others | **Orthogonal:** SDK constraint is CI-only; doesn't affect runtime | Check-sdk-bundling runs in GitHub Actions; no runtime dependency |

**Critical Coupling:** CRED-01..02 → PLCY-01..03 → DASH-01..03. If policy-as-code is deferred, credential rotation and dashboard both become harder (manual timeouts, no policy-driven parameters).

## Sources

**Portable Cross-Platform Installation:**
- [Node.js CLI Apps Best Practices](https://github.com/lirantal/nodejs-cli-apps-best-practices)
- [Portable Node.js Guide](https://github.com/zoonderkins/portable-node-guide)
- [Cross-Platform Installation Best Practices](https://app.studyraid.com/en/read/12362/399047/cross-platform-installation-best-practices)

**Credential Rotation & API Key Management:**
- [API Key Rotation Best Practices (2026)](https://oneuptime.com/blog/post/2026-01-30-api-key-rotation/)
- [API Key Management Best Practices (Feb 2026)](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices-for-secure-services/)
- [Token Rotation Strategies (2026)](https://oneuptime.com/blog/post/2026-01-30-token-rotation-strategies/)

**Policy-as-Code Configuration:**
- [Top 12 Policy as Code Tools (2026)](https://spacelift.io/blog/policy-as-code-tools)
- [Configuration as Code Best Practices](https://circleci.com/blog/configuration-as-code/)
- [YAML-Based Policy in Kubernetes (Kyverno)](https://kyverno.io) (referenced in PaC tools article)

**Terminal User Interfaces (TUIs):**
- [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/)
- [nodejs-dashboard GitHub](https://github.com/FormidableLabs/nodejs-dashboard)
- [Awesome TUIs](https://github.com/rothgar/awesome-tuis)
- [TUI Building Guide (DEV Community)](https://dev.to/sfundomhlungu/how-to-build-beautiful-terminal-uis-in-javascript-74j)

**Formal Methods & Decomposition:**
- [Verification of Liveness Properties Using Compositional Reachability Analysis](https://www.academia.edu/104774536/)
- [Formal Verification of Autonomous System Software](https://ijeret.org/index.php/ijeret/article/download/266/253/563)
- [TLA+ Examples Repository](https://github.com/tlaplus/Examples)
- [TLA+ Liveness Properties (2026)](https://roscidus.com/blog/blog/2026/01/01/tla-liveness/)

**Semantic Versioning & Plugin Architecture:**
- [npm Semantic Versioning Docs](https://docs.npmjs.com/about-semantic-versioning/)
- [semantic-release Plugin System](https://github.com/semantic-release/npm)
- [Semantic Versioning Automation (2026)](https://oneuptime.com/blog/post/2026-01-25-semantic-versioning-automation/)

---

**Research Summary for:** QGSD v0.26 Operational Completeness
**Researched:** 2026-03-03
**Status:** Ready for roadmap phase planning
**Next Step:** Phase 1 allocate PORT-01..03 + PRST-01..02 to v0.26-01/02; CRED-01..02 + PLCY-01..03 to v0.26-03/04; DASH-01..03 to v0.26-05/06
