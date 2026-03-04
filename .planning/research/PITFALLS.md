# Domain Pitfalls: Production Feedback Loop & Debt Tracking Integration

**Domain:** Adding production feedback loops (observe, fingerprint, aggregate), debt tracking ledgers, and P→F (production-to-formal) residual integration to an existing formal verification system with 7 active consistency layers.

**Researched:** 2026-03-04

**Overall Confidence:** HIGH

---

## Executive Summary

QGSD currently has:
- A **triage system** (GitHub, Sentry, bash-scripted sources) routing issues to `/qgsd:debug` and `/qgsd:quick`
- A **Solve layer** (7 consistency transitions: R→F, F→T, C→F, T→C, F→C, R→D, D→C) that auto-closes gaps
- A **formal verification pipeline** (TLA+, Alloy, PRISM) with 5-minute budgets and state space constraints
- **Requirements envelope** (214 requirements, 9 category groups) with strict schema validation

Adding production feedback loops and debt tracking creates **integration seams** where small mistakes compound silently:

1. **False positive floods** — Sources like Sentry, GitHub, and bash commands emit noise at scale; naïve aggregation creates 10x duplication and overwhelms triage lanes
2. **Unbounded debt ledgers** — Without retention policies and automatic cleanup, the debt registry grows ~5% per sprint, consuming storage and slowing checks
3. **Fingerprint collisions/splits** — Coarse fingerprints mask separate bugs as one issue; fine fingerprints fragment single bugs across 20 issues
4. **Solve layer instability** — Adding P→F as a new residual layer shifts the equilibrium point; the 7-layer solver can diverge or oscillate instead of converge
5. **Source abstraction leaks** — Framework-specific patterns (Prometheus labels, Sentry fingerprinting rules, GitHub label semantics) bleed into domain logic, making new sources require deep patches
6. **Human gate bypass** — Automatic promotion of high-confidence observations to requirements violates R3 quorum protocol, allowing bad data to enter the formal layer

This document catalogs 10 critical pitfalls, 8 technical debt patterns, 9 integration gotchas, 4 performance traps, 3 security mistakes, and 2 UX anti-patterns specific to this integration problem.

---

## Critical Pitfalls

### Pitfall 1: False Positive Floods from Noisy Observe Sources

**What goes wrong:**

After renaming `/qgsd:triage` to `/qgsd:observe` and adding a persistent Sentry connection, false positives from noisy sources accumulate faster than deduplication can handle. A single common error (e.g., "TypeError in React hydration") appears as 5+ distinct issues in Sentry due to variation in stack depth, module names, and browser versions. The triage table grows from 4 issues to 47 in a single day. The user sees a wall of duplicates and stops using the system.

**Why it happens:**

- **Sentry's fingerprinting is too coarse by default** — Built-in fingerprinting groups errors by exception type + message, ignoring call site variation. A hydration error triggered from 10 different components appears as 1 issue in raw Sentry but as 10 separate issues after custom fingerprinting rules are applied.
- **Bash triage sources run unchecked** — Custom `command: "grep TODO *"` or `command: "gh run list --status=failure"` queries are not rate-limited or deduplicated. A CI that fails on every commit generates 20+ issues daily without dedup logic.
- **No pre-aggregation filtering** — The observe command fetches and deduplicates, but sources emit data at different cadences. Sentry fires every 30s, GitHub updates every 5min, bash scripts run on-demand. Without dedup *per source*, aggregation happens too late.

**How to avoid:**

1. **Implement per-source deduplication before aggregation:**
   - For **Sentry**: Use Sentry's fingerprinting API to collapse similar stack traces before ingestion. Configure fingerprint rules in `.planning/observe-sources.md`:
     ```yaml
     sentry_fingerprint_rules:
       - name: "hydration-errors"
         pattern: "TypeError.*hydration"
         strategy: "group_by_component"  # Group by top-level component, not call site
         max_variants: 3  # Cap to 3 variants; merge older ones
     ```
   - For **GitHub**: Deduplicate by URL before fetching full details. Return only the latest issue per label combination.
   - For **Bash sources**: Add `--dedupe-cache=~/.cache/qgsd/observe-bash-{source_hash}` to cache and skip identical outputs within 1 hour.

2. **Add a noise filter gate** before issues enter the triage table:
   ```javascript
   // Hook: before rendering triage table, filter by signal quality
   const filtered = issues.filter(issue => {
     const signalScore = computeSignal(issue); // entropy of metadata
     return signalScore > 0.3; // Only issues with >30% unique metadata
   });
   ```

3. **Limit observe source output** by default:
   - Sentry: Cap to top 10 by event count (not creation time)
   - GitHub: Show only issues updated in the last 3 days
   - Bash: Apply strict regex validation — reject commands that produce >50 lines per run

4. **Add a `--dedupe-strict` mode** for production:
   ```bash
   /qgsd:observe --dedupe-strict --since 24h  # Uses AI embeddings to cluster duplicates
   ```

**Warning signs:**

- Triage table grows to 20+ items after a single day of running observe
- Scrolling through triage shows the same bug title repeated 5+ times with minor variation
- `node bin/generate-triage-bundle.cjs --json | jq '.issues | length'` shows count > 20 when expected max is 10
- Sentry dashboard shows "Issues: 150" but observe CLI shows "Issues: 47" (footprint mismatch)
- Users report: "Triage is a wall of duplicates; I stopped using it"

**Phase to address:**

Observe integration phase. This is a **blocker** — if false positives flood the triage table, the feedback loop loses signal and users bypass the system. Must implement source-specific dedup logic and AI-powered similarity clustering before going production.

---

### Pitfall 2: Debt Ledger Grows Unbounded

**What goes wrong:**

The debt registry (`.formal/debt.json` or similar) tracks unresolved observations: "Error X occurred 5 times, created but not resolved, needs investigation." Without cleanup policies, the ledger grows ~100 items per sprint. After 12 sprints, it contains 1,200 items. The `/qgsd:solve` command slows from 2s to 45s because it scans the entire ledger. The ledger.json file is 50MB. Users disable debt tracking to speed up the solver.

**Why it happens:**

- **No retention policy** — Observations accumulate without automatic cleanup. An issue fixed in production is still marked "open" in the ledger because the feedback loop didn't update it.
- **Stale observations not culled** — An observation with `last_occurrence: 2026-01-01` is still in the ledger on 2026-03-04, taking up space and cluttering reports.
- **Promotions to requirements** — Each observation that becomes a requirement is copied to the requirements envelope. If 50 observations are promoted per milestone, the 214-requirement envelope grows by 23% per release.
- **Duplicate entries due to fingerprint drift** — A fingerprint that changes (e.g., build hash in stack trace) creates a new debt entry instead of updating the existing one. The same bug appears as 3 separate debt items.

**How to avoid:**

1. **Implement automatic cleanup in the debt ledger:**
   ```json
   {
     "$schema": "debt-ledger-1.0",
     "retention_policy": {
       "max_age_days": 90,
       "max_entries": 500,
       "promotion_holds_days": 14
     },
     "entries": [...]
   }
   ```
   - Entries older than 90 days are automatically archived to `.formal/debt-archive/{date}.json`
   - If debt count exceeds 500, evict oldest entries first
   - Observations promoted to requirements are held for 14 days (grace period for reversal), then archived

2. **Add fingerprint stability tracking:**
   ```javascript
   // Each debt entry must include:
   {
     "id": "debt-001",
     "fingerprint": {
       "hash": "sha256:...",
       "variant_count": 1,  // How many times this fingerprint changed
       "stable_since": "2026-02-15"
     },
     "created_at": "2026-02-01",
     "last_occurrence": "2026-03-04",
     "occurrences_total": 47
   }
   ```
   If `variant_count > 3`, the fingerprint is unstable; merge with manual review before next solve run.

3. **Implement debt status transitions** to track lifecycle:
   ```
   OPEN → INVESTIGATING → FIXED_IN_STAGING → FIXED_IN_PRODUCTION → ARCHIVED
   ```
   - Debt entry is automatically transitioned to `FIXED_IN_PRODUCTION` if no occurrence seen for 7 days AND the corresponding code fix is deployed.
   - Use `/qgsd:solve` output to detect deployments that should close debt items.

4. **Add garbage collection to the solve command:**
   ```bash
   /qgsd:solve --gc-debt  # Before main solver run, evict stale entries and compact
   ```

**Warning signs:**

- `.formal/debt.json` grows >10MB or has >500 entries
- `node bin/qgsd-solve.cjs --report-only` takes >10s to complete (was <2s previously)
- Users report: "Solve is slow now; it used to be instant"
- Debt ledger contains entries from 60+ days ago with `last_occurrence: null` (never seen again)
- Solver output shows debt items that contradict production behavior (e.g., "debt: bug happened 5 times" but no related code change in the last 30 days)

**Phase to address:**

Debt tracking phase. Must establish retention and cleanup policies **before** adding observations to the ledger. Without auto-cleanup, the ledger becomes a technical debt sink that slows down the solver and obscures signal.

---

### Pitfall 3: Fingerprint Collision or Splitting Hides Real Issues

**What goes wrong:**

The fingerprinting strategy for observations is either too coarse or too fine. **Too coarse:** All "network errors" map to one fingerprint, so a timeout bug and a DNS resolution bug appear as the same issue, hiding the real cause. **Too fine:** Each unique stack trace gets a unique fingerprint, so the same bug triggered from 20 components creates 20 separate debt items. The triage table is either empty (everything collapsed) or contains 100+ duplicates.

**Why it happens:**

- **Fingerprinting algorithm is simplistic** — Default: hash(exception_type, message). This ignores context (which component, which endpoint, which user cohort). The hash collides across unrelated errors.
- **No collision detection** — When two very different errors collide (e.g., both map to "Error"), the system logs the collision but doesn't alert the user. The user doesn't know the fingerprint is wrong.
- **Fingerprint rules are unmaintained** — Custom rules in `.planning/observe-sources.md` are written once and never updated. As the codebase evolves, rules become stale and cause splits/collisions.
- **Fingerprinting strategy is hard-coded** — Sentry uses one strategy, Prometheus uses another, GitHub uses labels. The integration layer doesn't expose strategy choice to the user; it's buried in the source handler.

**How to avoid:**

1. **Implement configurable fingerprinting strategies:**
   ```yaml
   # .planning/observe-sources.md
   fingerprinting:
     strategy: "semantic"  # or "hash", "rules-based", "ai-embedding"
     parameters:
       - name: exception_type
         weight: 0.4
       - name: root_cause_file
         weight: 0.3
       - name: affected_component
         weight: 0.3
     collision_threshold: 0.85  # If similarity > 85%, consider a collision
     split_threshold: 0.60      # If similarity < 60%, consider a split
   ```

2. **Add automatic collision and split detection:**
   ```javascript
   // In observe aggregation phase:
   const collisions = issues.filter(i => i.fingerprint_variants > 2 && i.issue_count === 1);
   const splits = issues.filter(i => i.fingerprint_variants === 1 && i.issue_count > 5);

   if (collisions.length > 0) {
     console.warn(`FINGERPRINT COLLISION: ${collisions.map(c => c.id).join(', ')}`);
     // Alert user before triage
   }
   if (splits.length > 0) {
     console.warn(`FINGERPRINT SPLIT: ${splits.map(s => s.id).join(', ')}`);
     // Suggest merging these entries
   }
   ```

3. **Implement an AI-based similarity check** (not just hash):
   - Use embeddings (sentence-transformers or similar) to cluster error descriptions
   - If two fingerprints have embeddings with cosine similarity > 0.85, flag as collision
   - If one fingerprint's variants cluster into N sub-groups (cosine distance > 0.4 within group), flag as split

4. **Publish fingerprint metrics** in the solver output:
   ```
   Fingerprinting Health:
   ──────────────────────
   Collisions detected: 0
   Splits detected: 0
   Avg variant count: 1.2
   Coverage: 98% (2 errors could not be fingerprinted)
   ```

**Warning signs:**

- Triage table shows the same issue title under two different IDs on the same day
- Fingerprint hash collisions detected in logs: `"Fingerprint hash collision for error_type:TypeError"`
- An issue's `occurrences_total` is huge (>100) but `last_7_day_count` is 0 (old fingerprint no longer matched)
- Manually reviewing debt items reveals duplicates that should have been merged
- Users report: "I see the same bug listed 10 different ways"

**Phase to address:**

Observe phase (fingerprinting strategy), and Debt phase (collision/split detection). Cannot proceed to P→F integration without stable fingerprinting — fingerprint errors will cascade into requirements.

---

### Pitfall 4: Solve Layer Instability When Adding P→F Residual

**What goes wrong:**

The Solve layer currently tracks 7 transitions (R→F, F→T, C→F, T→C, F→C, R→D, D→C). Adding P→F (observations-to-formal) as an 8th transition destabilizes the convergence loop. The solver runs: fixes R→F gaps (creates new F→T gaps), fixes F→T gaps (creates new T→C gaps), runs again, and on iteration 5, the residual vector oscillates between [3, 2, 1, 0, 0, 0, 0] and [2, 3, 1, 0, 0, 0, 0]. It never hits zero. The user runs `solve --max-iterations=10` and after 10 iterations, total residual is still 4. The solve loop gives up.

**Why it happens:**

- **P→F feedback loop is decoupled from formal verification** — When an observation is promoted to a requirement (P→F), it creates a new requirement that doesn't have formal coverage (R→F gap). But the solver doesn't know that observations → requirements, so it treats P→F gaps and R→F gaps separately. The R→F solver creates formal models for the new requirements, but those models might conflict with existing models or introduce new bugs.
- **Cascade ordering is wrong** — The solve command dispatches remediations in order: R→F, F→T, C→F, T→C, F→C, R→D, D→C. It doesn't include P→F in the order. So observations never get properly triaged and promoted; they pile up in the ledger while formal gaps are fixed around them.
- **Solve input assumptions break** — The solver assumes requirements are stable (they don't change during a solve run). But if P→F promotion happens during the run, requirements change, invalidating the initial diagnostic. The solve loop's "re-diagnose" phase doesn't account for new observations arriving mid-run.
- **Residual vector is multi-objective, not unimodal** — Fixing one layer (R→F) often creates gaps in the next layer (F→T). The total residual goes DOWN (good) but oscillates. The convergence check `if (post_residual.total < baseline_residual.total) continue loop` is too coarse; it hides oscillation.

**How to avoid:**

1. **Integrate P→F into the solver's layer ordering:**
   ```
   1. Diagnose P→F: how many observations are promotion-ready?
   2. Dispatch observation triage and promotion (Observe phase)
   3. Diagnose R→F: how many requirements lack formal coverage? (includes newly promoted requirements)
   4. Dispatch R→F remediation (close-formal-gaps)
   5. [... rest of layers ...]
   7. Diagnose R→F again (re-check after P→F promotion)
   ```

2. **Add per-layer "change detection" to stop oscillation:**
   ```javascript
   // Instead of checking total residual, check if ANY automatable layer changed
   const layerChanges = {
     r_to_f: residual_prev.r_to_f.residual - residual_curr.r_to_f.residual,
     f_to_t: residual_prev.f_to_t.residual - residual_curr.f_to_t.residual,
     // ... for all automatable layers (exclude R->D, D->C which are manual)
   };

   const anyLayerChanged = Object.values(layerChanges).some(delta => Math.abs(delta) > 0);
   const stillConverging = anyLayerChanged && iteration < maxIterations;

   if (stillConverging) {
     // Continue loop
   } else {
     // Exit: no change detected or max iterations reached
   }
   ```
   This prevents oscillation: if residual swaps between [3, 2] and [2, 3], change detection sees zero net change and stops.

3. **Freeze observations during a solve run:**
   - P→F promotion happens only at the START of a solve run (Step 1), not during.
   - New observations that arrive during solving are queued for the NEXT solve run.
   - This prevents requirements from changing mid-run and invalidating diagnostics.

4. **Add oscillation detection to the circuit breaker:**
   ```javascript
   // In hooks/qgsd-circuit-breaker.js
   if (solve_residual_oscillates_between_N_states(last_5_iterations)) {
     console.error("Solve loop oscillating — manual review required");
     // Trigger oscillation resolution mode
   }
   ```

**Warning signs:**

- `solve --max-iterations=10` completes but `post_residual.total >= baseline_residual.total`
- The before/after table shows R→F goes from 3 to 2, then 2 to 3, then 3 to 2 across iterations
- Solver output logs: `"Iteration 1: total=5 → 4, Iteration 2: total=4 → 5, Iteration 3: total=5 → 4"`
- `/qgsd:solve` runs for >5 minutes (iteration loop timeout)
- Users report: "Solve doesn't finish; it gets stuck"

**Phase to address:**

P→F integration phase. Must integrate observation promotion into the solver's layer ordering and add oscillation detection **before** P→F becomes a formal residual. Without this, the solver destabilizes.

---

### Pitfall 5: Source Type Abstraction Leaks

**What goes wrong:**

The observe command abstracts sources (GitHub, Sentry, bash). Each source handler returns the same JSON schema: `{ id, title, url, severity, age, meta }`. But framework-specific details bleed through:

- **Sentry:** The `meta` field contains `"<file>:<line> · 7,086 divergences"` (Sentry-specific event counting).
- **GitHub:** The `meta` field contains `"assignee: @alice, labels: bug,critical"` (GitHub-specific label semantics).
- **Bash:** The `meta` field is undefined because custom scripts don't provide it.

When you add a new source (e.g., Grafana alerts, PagerDuty), the domain logic has to know about Grafana's "severity" level mapping and PagerDuty's "incident status" enum. Each new source requires patches to:
- The source handler (obvious)
- The dedup logic (is Grafana severity "CRITICAL" the same as GitHub severity "critical"?)
- The fingerprinting strategy (how to hash a PagerDuty incident ID?)
- The debt ledger promotion logic (does a Grafana alert automatically become a requirement?)

The system is not extensible; each source is a special case.

**Why it happens:**

- **Source semantics are implicit, not declared** — There's no interface contract that sources must implement. Handlers are written as scripts, not classes with interfaces.
- **Severity level mapping is ad-hoc** — GitHub labels are strings ("bug", "critical"); Sentry levels are enums ("fatal", "error", "warning"); Grafana alerts have numeric severity (1-5). The triage command maps these to a common "error|warning|info" scale, but the mapping is buried in code, not declared.
- **No abstraction layer** — Observe directly calls source handlers and returns raw data. The data is not normalized through a schema validator.

**How to avoid:**

1. **Define a source interface contract:**
   ```typescript
   // observe-source.interface.ts
   interface ObserveSource {
     id: string;              // Unique source type ID
     normalize(raw: any): Issue[];  // Convert source's format to canonical schema
     getDeduplicator(): (issues: Issue[]) => Issue[];  // Source-specific dedup logic
     getSeverityMap(): Record<string, "error"|"warning"|"info">;
   }
   ```

2. **Require all sources to declare severity mapping upfront:**
   ```yaml
   # .planning/observe-sources.md
   sources:
     - type: sentry
       severity_map:
         fatal: error
         error: error
         warning: warning
         info: info
       fingerprinting_strategy: "sentry_builtin"

     - type: github
       severity_map:
         bug: error
         critical: error
         warning: warning
         enhancement: info
       fingerprinting_strategy: "label_based"
   ```

3. **Add a schema validator** that all sources must conform to:
   ```javascript
   // In observe aggregation:
   const issue_schema = {
     id: /^[a-z]+-\d+$/, // source-id
     title: string,
     url: string,
     severity: enum("error", "warning", "info"),
     age: string,
     meta: string,
     source_type: enum("github", "sentry", "bash", ...), // known types
     source_original_data: object  // For debugging; hidden from triage table
   };

   issues.forEach(issue => {
     if (!validate(issue, issue_schema)) {
       throw new Error(`Issue ${issue.id} violates schema`);
     }
   });
   ```

4. **Segregate source-specific logic in adapter classes:**
   ```
   sources/
   ├── sentry-adapter.js     (implements ObserveSource interface)
   ├── github-adapter.js
   └── bash-adapter.js
   ```
   Each adapter is self-contained; adding a new source means adding one new file, not patching the core logic.

**Warning signs:**

- Adding a new observe source requires changes to 3+ files outside the source handler
- Fingerprinting logic contains `if (source === 'sentry')` or `if (source === 'github')` conditionals
- Severity mappings are duplicated across multiple files
- Users report: "Adding a new alert source is hard; I need help from the core team"

**Phase to address:**

Observe phase (source abstraction), before adding framework-specific sources. Critical for long-term extensibility.

---

### Pitfall 6: Human Quorum Gate Bypass via Auto-Promotion

**What goes wrong:**

The design sketches auto-promotion from observation to requirement: "If an observation occurs in production 5+ times with high confidence (fingerprint stability > 0.9), automatically promote it to the requirements envelope and dispatch formal coverage." This is efficient — humans don't have to review every stable observation.

But it violates **R3 quorum consensus** requirement: "All requirements must be approved by quorum before entering the formal verification envelope." An observation might be high-confidence (numerically) but low-value (strategically). For example:

- A network timeout in a fallback service that users work around
- A deprecation warning in a non-critical library
- A performance regression in an internal dashboard

All are "high-confidence" in the data (fingerprint is stable, occurs repeatedly), but none should be formal requirements. Auto-promotion bypasses the human decision gate, polluting the requirements envelope.

Downstream effects:
- Formal models are generated for non-requirements, wasting verification budget
- The 214-requirement envelope grows to 250+ requirements with mixed signal
- Quorum consensus is undermined: "The solver added these, not us"
- Requirements traceability breaks: no provenance link to original observation

**Why it happens:**

- **Efficiency pressure** — Processing observations manually is slow. Auto-promotion seems like a productivity boost.
- **Confidence ≠ Value confusion** — High fingerprint confidence (data signal) is conflated with high business value (product signal). They're orthogonal.
- **No human gate in the pipeline** — The observe → debt → requirements path has no explicit quorum checkpoint.

**How to avoid:**

1. **Never auto-promote observations to requirements.** Period. Require explicit human approval.
   - Observations can auto-transition to **debt items** (no quorum needed).
   - Debt items can be **flagged for human review** (e.g., "likely a requirement").
   - Humans explicitly promote: `/qgsd:add-requirement --from-debt=debt-001`

2. **Add a human review queue** in the observe pipeline:
   ```
   Observation → Stable (after 7 days, >5 occurrences) → FLAGGED_FOR_REVIEW → Human approves → Debt item
   ```
   Not: `Observation → Auto-promoted requirement`

3. **Implement debt-to-requirement promotion as an explicit command:**
   ```bash
   /qgsd:observe --show-promotable  # List stable observations ready for human review
   /qgsd:add-requirement --from-debt=debt-001 --quorum # Triggers R3 quorum consensus
   ```

4. **Decorate auto-flagged debt items with confidence metadata** so humans can quickly filter:
   ```json
   {
     "id": "debt-001",
     "title": "TypeError in React hydration",
     "promotion_confidence": 0.92,  // High fingerprint stability
     "promotion_value_signal": "UNKNOWN",  // No human judgment yet
     "promotion_recommended": false  // <- Set to false by default
   }
   ```

**Warning signs:**

- The requirements envelope grows >20% in a sprint with no explicit `/qgsd:add-requirement` commands
- Requirements added by the solver lack provenance ("source_file": null, "milestone": "unknown")
- Formal verification budget is consumed by non-essential requirements
- Users report: "Requirements are being added without our input"

**Phase to address:**

P→F integration phase. Must establish quorum consensus gate **before** adding observation-to-requirement promotion. This is a critical control to prevent pollution of the formal layer.

---

### Pitfall 7: Production Signal Jitter Overloads Formal Verification Budget

**What goes wrong:**

Observations arrive from production at unpredictable rates. A deployment spike might generate 50 new observations in 1 hour. The P→F promotion logic flags them as promotion-ready. The solver's next run (which is scheduled or manual) attempts to generate formal models for all 50, expecting a few formal specs. Instead, the formal verification tools (TLA+, Alloy) are asked to verify 50 new models in parallel. The verifier runs out of memory or hits the 5-minute budget timeout. Formal verification hangs or produces inconclusive results. The solver stalls.

**Why it happens:**

- **Observe rate is unbounded** — Production signals arrive continuously; there's no throttling between observation arrival and formal model generation.
- **Solver is greedy** — When the solver runs, it processes ALL promotion-ready debt items in one batch, not in priority order.
- **Formal verification has hard time budgets** — TLA+ and Alloy have ~5 minute limits per run. If 50 models are queued, the batch fails.

**How to avoid:**

1. **Throttle P→F promotion by observation rate:**
   ```javascript
   // In the solver, before dispatching P→F:
   const promotionReadyCount = debt.filter(d => d.promotion_confidence > 0.9).length;
   const maxNewRequirementsPerRun = 3;  // Conservative batch size

   if (promotionReadyCount > maxNewRequirementsPerRun) {
     const toPromote = debt
       .filter(d => d.promotion_confidence > 0.9)
       .sort((a, b) => b.occurrences_total - a.occurrences_total)  // Prioritize high-signal
       .slice(0, maxNewRequirementsPerRun);

     console.log(`Promotion throttled: ${promotionReadyCount} ready, promoting top ${maxNewRequirementsPerRun}`);
   }
   ```

2. **Add formal verification budget tracking:**
   ```javascript
   // In solve.md step 3a (R→F remediation):
   const formalVerfBudgetMs = 5 * 60 * 1000;  // 5 minutes
   const startTime = Date.now();

   for (const req of newRequirements) {
     const elapsed = Date.now() - startTime;
     const remaining = formalVerfBudgetMs - elapsed;
     if (remaining < 30_000) {  // Less than 30s left
       console.warn(`Formal verification budget exhausted. ${newRequirements.length - i} requirements deferred to next run.`);
       break;  // Stop processing, save the rest for next iteration
     }
     // Process req...
   }
   ```

3. **Implement observation coalescing** — batch observations that arrive within a time window:
   ```yaml
   # .planning/observe-sources.md
   observe:
     coalescing_window_ms: 300000  # 5 minutes
     batch_promotion_on: "timer"   # Don't promote immediately; wait for batch
   ```
   Instead of promoting an observation the instant it's stable, wait 5 minutes and batch all stable observations together. This smooths out jitter.

4. **Add a "high-stress" mode** that disables P→F promotion temporarily:
   ```bash
   /qgsd:observe --stress-level=high  # Collects observations but doesn't promote
   /qgsd:solve --stress-level=high     # Solves only existing gaps, no new promotions
   ```

**Warning signs:**

- Formal verification times out during a solve run: `"Formal verification timeout after 5 minutes"`
- The solver's iteration loop hits max iterations with residual still high
- Production incident spikes → following day's solve run fails
- Users report: "Solve started hanging after we added Sentry integration"

**Phase to address:**

P→F integration phase. Must add throttling and budget tracking **before** connecting to high-volume production signals.

---

### Pitfall 8: Debt Fingerprint Drift Causes Requirement Fragmentation

**What goes wrong:**

An observation's fingerprint changes over time due to non-semantic variations (build hash in stack trace, minor version bump in dependency, code optimization). The fingerprint hash for "TypeError in component X" might be `hash1` on day 1 and `hash2` on day 2 due to a rebuild. The debt tracker treats them as separate issues: debt-001 (hash1) and debt-002 (hash2). Both are promoted to requirements as separate items. Now there are two formal models for the same logical bug. The requirement envelope is polluted with duplicates.

**Why it happens:**

- **Fingerprints include build-specific data** — Stack traces include line numbers, build hashes, or optimization levels that change between builds without semantic change.
- **No fingerprint variant consolidation** — The debt tracker doesn't detect when a fingerprint changes and consolidate variants back to the original entry.

**How to avoid:**

1. **Implement fingerprint variant tracking** in the debt ledger:
   ```json
   {
     "id": "debt-001",
     "primary_fingerprint": "hash1",
     "fingerprint_variants": ["hash1", "hash2", "hash3"],
     "variant_first_seen": {
       "hash1": "2026-02-01",
       "hash2": "2026-02-15",
       "hash3": "2026-03-02"
     },
     "occurrences_by_variant": {
       "hash1": 15,
       "hash2": 8,
       "hash3": 4
     }
   }
   ```

2. **Detect fingerprint drift during aggregation:**
   ```javascript
   // In observe aggregation:
   const issue = issues.find(i => i.id === "debt-001");
   if (issue.fingerprint !== issue.primary_fingerprint) {
     if (areSemanticallyEquivalent(issue.fingerprint, issue.primary_fingerprint)) {
       // Same bug, variant of primary fingerprint
       issue.fingerprint_variants.push(issue.fingerprint);
     } else {
       // Different bug, needs separate entry
     }
   }
   ```

3. **Pin promotions to primary fingerprint:**
   ```bash
   # When promoting debt-001 to requirement:
   # Use the primary fingerprint's description, not the current variant
   /qgsd:add-requirement --from-debt=debt-001 --use-primary-fingerprint
   ```

**Warning signs:**

- A single logical bug appears as 3+ separate debt entries with nearly identical titles
- Requirement envelope contains duplicates that only differ in build hash or line number
- The solver output shows "3 requirements to formalize" but 2 are actually the same bug

**Phase to address:**

Debt tracking phase. Implement fingerprint variant consolidation before any P→F promotion.

---

### Pitfall 9: No Observability into Which Observations Will Become Requirements

**What goes wrong:**

A user runs `/qgsd:observe` and sees a list of issues. But there's no indication which ones are "close to becoming a requirement" or which ones are "stable enough to promote." The user has to manually guess based on occurrence counts and timestamps. This is opaque. Alternatively, if there IS an automatic promotion list shown, the user can't challenge it — the criteria are hidden in code.

**Why it happens:**

- **Promotion criteria are implicit** — The code checks fingerprint_confidence > 0.9, but this threshold is hardcoded, not declared.
- **No criteria audit trail** — When an observation is flagged for promotion, there's no explanation of WHY. "Why is this debt item ready for promotion?"

**How to avoid:**

1. **Declare promotion criteria explicitly** in the observe config:
   ```yaml
   # .planning/observe-sources.md
   promotion_criteria:
     - name: "fingerprint_stability"
       threshold: 0.9
       window: 7d
       description: "Fingerprint must not change more than 10% in last 7 days"

     - name: "occurrence_frequency"
       threshold: 5
       window: 7d
       description: "Must occur at least 5 times in the last 7 days"

     - name: "user_impact"
       threshold: "high"
       window: 7d
       description: "Must affect >10 users or >100 transactions"
   ```

2. **Add promotion reasoning to the debt entry:**
   ```json
   {
     "id": "debt-001",
     "title": "TypeError in component X",
     "promotion_candidate": true,
     "promotion_reasoning": {
       "fingerprint_stability": { "value": 0.94, "passed": true },
       "occurrence_frequency": { "value": 12, "passed": true },
       "user_impact": { "value": "high" (23 users affected), "passed": true }
     },
     "promotion_ready_since": "2026-03-02"
   }
   ```

3. **Add a `--explain` flag to observe:**
   ```bash
   /qgsd:observe --show-promotable --explain
   # Output:
   # debt-001: TypeError in component X
   #   WILL PROMOTE in 2 days (2026-03-06) if criteria continue to hold
   #   Fingerprint stability: 0.94/0.90 ✓
   #   Occurrence frequency: 12/5 in 7d ✓
   #   User impact: high (23 users) ✓
   ```

**Warning signs:**

- Users ask: "Why is this debt item ready for promotion? How did it get there?"
- No way to challenge or override the promotion criteria
- Promotion happens silently; users only notice when new requirements appear in the envelope

**Phase to address:**

Observe phase. Transparency is essential before any automatic promotion.

---

### Pitfall 10: Debt Ledger Schema Incompatibility with Formal Verification Envelope

**What goes wrong:**

The debt ledger has its own schema (`.formal/debt.json`). The formal requirements envelope has its own schema (`.formal/requirements.json`). When a debt item is promoted to a requirement, the fields don't map cleanly:

- Debt entry has `occurrences_total: 47`, but requirements don't. New requirement is created with no count.
- Debt entry has `fingerprint: {hash: "...", stable_since: "2026-02-15"}`, but requirements expect `provenance: {source_file: ..., milestone: ...}`. Fingerprint metadata is lost.
- Debt entry has `source_type: "sentry"`, but requirements expect `category: "..."` (from category-groups.json). The mapping is ambiguous.

When the solver runs and tries to compute R→F gaps, it sees a requirement with incomplete metadata. The requirement can't be matched to a formal model. The solver gets confused.

**Why it happens:**

- **Debt schema and requirements schema were designed independently** — They don't overlap. Promotion logic has to "translate" between them, and the translation is lossy.
- **Requirements expect provenance from code/doc, not from production** — A requirement's `provenance.source_file` is something like `docs/REQUIREMENTS.md` or `.planning/quick-001-PLAN.md`. But an observation-promoted requirement has no source_file — its source is Sentry.

**How to avoid:**

1. **Extend the requirements schema to accommodate observation-promoted requirements:**
   ```json
   {
     "$schema": "requirements-2.0",
     "requirements": [
       {
         "id": "REQ-001",
         "text": "...",
         "category": "...",
         "status": "Pending|Complete",
         "provenance": {
           "source_file": "docs/REQUIREMENTS.md",  // For code/doc-sourced reqs
           "milestone": "v0.27",
           "observation_source": "sentry",          // NEW: for observation-sourced reqs
           "observation_fingerprint": "hash:...",
           "observation_first_seen": "2026-02-01",
           "observation_occurrences": 47
         }
       }
     ]
   }
   ```

2. **Implement a debt-to-requirement mapping** with field translation:
   ```javascript
   function promoteDebtToRequirement(debt, requirementId) {
     return {
       id: requirementId,
       text: debt.title,  // Debt's title becomes requirement text
       category: mapSourceToCategory(debt.source_type),  // "sentry" → "Observability"
       phase: getCurrentPhase(),
       status: "Pending",
       provenance: {
         observation_source: debt.source_type,
         observation_fingerprint: debt.fingerprint.hash,
         observation_first_seen: debt.created_at,
         observation_occurrences: debt.occurrences_total,
         promoted_at: new Date().toISOString()
       }
     };
   }
   ```

3. **Validate promoted requirements against the requirements schema:**
   ```javascript
   // After promotion, before adding to the envelope:
   const promoted = promoteDebtToRequirement(debt, "REQ-215");
   const validationResult = validateAgainstSchema(promoted, requirements_schema);
   if (!validationResult.valid) {
     throw new Error(`Promoted requirement ${promoted.id} fails schema validation: ${validationResult.errors}`);
   }
   ```

**Warning signs:**

- Promoted requirements have incomplete fields: `provenance.source_file: null`
- The solver skips R→F checking for observation-promoted requirements
- Users manually edit promoted requirements to fill in missing fields
- Solver output shows "Warning: {N} requirements have incomplete provenance"

**Phase to address:**

P→F integration phase. Debt and requirements schemas must be aligned **before** any promotion happens.

---

## Technical Debt Patterns

Common shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| **Hardcoded fingerprint thresholds in source handlers** | Fast deployment; no config needed | Fingerprinting is tuned for one source type; adding new sources requires code changes | Only in prototype phase; must move to config before production |
| **Fingerprint collisions logged but not fixed** | Reduces work during observe deployment | Collisions accumulate; duplicate debt entries pollute the ledger | Never; collisions must be detected and auto-merged or warned |
| **Skipping fingerprint stability check on high-confidence observations** | Faster promotion; high-signal observations go to requirements immediately | Noisy observations escape to requirements; formal verification budget is wasted | Only if human review gate is in place; never with auto-promotion |
| **Debt ledger stored in a single `.formal/debt.json` file** | Simple; easy to read/write | File grows unbounded; slow queries; difficult to archive old entries | Only for <1000 entries; must migrate to database or split by date range at larger scale |
| **Observation → Requirement mapping is implicit (observation.id.startswith('obs-') becomes REQ-XXX)** | Quick to implement | Traceability is fragile; if observation IDs change, requirement provenance breaks | Only in prototype; must implement explicit mapping table before production |
| **P→F promotion happens inside the solve loop** | Simplifies orchestration; one command does everything | Destabilizes solver convergence; observations created during solve run invalidate diagnostics | Never; promotion must happen before solve run starts |
| **Debt status transitions are inferred from last_occurrence timestamp** | No explicit state machine; saves code | Status is ambiguous; a debt item with no recent occurrence might be "resolved" or "stale", unclear which | Only in prototype; implement explicit state machine (OPEN → INVESTIGATING → FIXED → ARCHIVED) |
| **Fingerprint algorithm is embedded in source handler** | Source handler is self-contained | Adding a new source requires understanding fingerprinting; no code reuse | Acceptable if <3 sources; must abstract fingerprinting to pluggable interface for >3 sources |

---

## Integration Gotchas

Common mistakes when connecting observe, debt, and formal verification.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Observe → Debt** | Storing raw observations without dedup; ledger fills with duplicates | Deduplicate per source before adding to ledger; use fingerprint as dedup key; consolidate variants |
| **Debt → Promote to Requirement** | Auto-promoting without human gate; requirements polluted with low-value debt | Require explicit human approval; flag candidate requirements for review, human approves with `/qgsd:add-requirement --from-debt` |
| **Requirement → Formal Model** | Assuming all requirements have similar verification complexity; simple ones timeout | Estimate complexity per requirement before generating models; batch only similar-complexity requirements together |
| **Formal Model → Test Stubs** | Generating stubs for models without checking if the requirement can be tested in unit tests | Separate "formal-only" requirements from "testable" requirements; only stub testable ones |
| **Production signals → Priority ranking** | Treating observation frequency as priority; most-frequent bug becomes most-important requirement | Separate "signal frequency" (how many times it occurs) from "business value" (how much it costs when it breaks); rank by value, not frequency |
| **Debt ledger growth** | No cleanup; ledger grows indefinitely | Implement retention policy: auto-archive entries >90 days old or when debt count >500 |
| **Fingerprinting across sources** | Each source uses its own fingerprinting; GitHub issues and Sentry errors can't be deduplicated across sources | Implement a "canonical fingerprint" that all sources map to; use AI similarity to detect cross-source duplicates |
| **Solve loop and observation arrival rate mismatch** | Solver runs on a fixed schedule; high-volume production incidents create bottleneck | Decouple observation arrival from solve scheduling; use async promotion queue, batch observations, throttle P→F to avoid overwhelming formal verification |
| **Debt promotion criteria not auditable** | Criteria hardcoded; user can't understand why an observation was promoted | Declare promotion criteria in config; include reasoning in promoted requirement's provenance |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **Deduplicating observations with naive string similarity (Levenshtein distance)** | Dedup is O(N²) for N observations; takes 30s to dedup 100 items | Use AI embeddings or multi-pass filtering; cluster by fingerprint first, then similarity within cluster | >50 observations per run |
| **Debt ledger stored as single JSON file** | Loading `.formal/debt.json` takes >1s; adding new entries requires reading + re-writing entire file | Split ledger by date: `.formal/debt-2026-02.json`, `.formal/debt-2026-03.json`; archive old files | >10MB file size or >500 entries |
| **Formal model verification runs in sequence for each requirement** | Each TLA+ or Alloy model takes 30s; verifying 10 models takes 5+ minutes | Batch models; run verifiers in parallel with time budget per model | >5 requirements per solve run |
| **Fingerprint matching uses exact hash lookup** | Adding a new source with slightly different fingerprint format breaks matching; fingerprints collide due to hash collision | Use semantic similarity for fingerprint matching, not just hash equality; detect collisions | New source type added; scale to >10k observations |
| **Observation aggregation fetches from all sources sequentially** | Observe command takes 2 minutes when fetching from 5 sources (GitHub 20s, Sentry 30s, bash commands 50s) | Parallelize source fetches using async/await; set per-source timeout (10s for GitHub, 15s for Sentry) | >3 sources configured |
| **Requirements envelope grows unbounded** | Checking R→F gaps requires scanning all 214+ requirements; `/qgsd:solve --report-only` takes 15s | Index requirements by status; only check "Pending" requirements for coverage | >300 requirements |
| **Solve convergence loop doesn't detect oscillation** | Solver loops forever or hits max iterations with residual still high | Add per-layer change detection; exit if no layer changed between iterations | Adding P→F layer (iteration count increases) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Storing Sentry auth tokens in `.planning/observe-sources.md` as plain text** | Tokens exposed in git history; anyone with repo access can fetch all Sentry data | Never store secrets in `.planning/`; use environment variables or a secrets manager (`~/.claude/secrets.enc`); validate that `.planning/` is in `.gitignore` |
| **Observations contain sensitive user data (emails, IP addresses, PII from stack traces)** | Privacy leak; GDPR violation if user PII is logged in debt ledger | Implement PII redaction in source handlers; mask emails as `user-***@company.com`, IPs as `IP:***`, before adding to ledger |
| **Promoted requirements expose internal service names or architecture details via observation titles** | Architecture reconnaissance; attacker learns internal service structure from public requirements | Sanitize observation titles before promotion; replace internal service names with generic placeholders (`ServiceA` instead of `AuthTokenCache`) |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Observe command shows raw Sentry data without context** | User sees 47 issues and doesn't know which are critical or duplicates | Render deduplicated triage table with signal strength indicator (e.g., "5x in 24h", "23 users affected"); sort by impact, not recency |
| **Promotion candidate list is not visible; observations disappear into debt ledger with no explanation** | User doesn't know when an observation is ready to become a requirement | Add `/qgsd:observe --show-promotable` command; show countdown: "Will promote in 2 days if criteria hold"; let user intervene manually |
| **No feedback after human approves a debt item for promotion** | User approves an observation, nothing visibly happens; they don't know if it was actually promoted | After `/qgsd:add-requirement --from-debt=debt-001`, show confirmation: "Promoted to REQ-215, will be formalized in next solve run" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Observe source integrated:** Often missing deduplication per source and severity mapping declaration — verify `.planning/observe-sources.md` includes `severity_map` and `fingerprinting_strategy` for every source
- [ ] **Debt ledger created:** Often missing cleanup policy and retention rules — verify `.formal/debt.json` includes `retention_policy` with `max_age_days`, `max_entries`
- [ ] **Fingerprinting strategy chosen:** Often missing collision detection and variant consolidation — verify fingerprint drift is tracked and variants are consolidated before promotion
- [ ] **P→F integration designed:** Often missing quorum consensus gate and throttling logic — verify `/qgsd:add-requirement --from-debt` requires human approval, not auto-promotion
- [ ] **Solve loop updated for P→F:** Often missing oscillation detection and per-layer change tracking — verify solve command includes cascade-aware convergence detection
- [ ] **Promotion criteria declared:** Often missing audit trail and user visibility — verify `.planning/observe-sources.md` includes explicit criteria with thresholds; verify `--explain` flag works
- [ ] **Debt schema maps to requirements schema:** Often missing provenance translation — verify promoted requirements can be validated against `requirements.schema.json`
- [ ] **Performance regression testing:** Often missing benchmarks for large-scale debt — verify observe and solve commands still complete <10s with 500+ debt entries

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **False positive flood (Pitfall 1)** | MEDIUM | 1. Disable noisy source (`--source github` only). 2. Review recent Sentry fingerprint rules; adjust collision threshold. 3. Re-run observe with stricter filters. 4. Archive false-positive debt entries. |
| **Unbounded debt ledger (Pitfall 2)** | MEDIUM-HIGH | 1. Run debt GC: `node bin/compact-debt.cjs --max-age 60 --archive`. 2. Review debt-to-requirement promotions; undo non-essential ones. 3. Establish retention policy going forward. |
| **Fingerprint collision/split (Pitfall 3)** | HIGH | 1. Manually review all fingerprints with >1 variant; consolidate variants. 2. Regenerate fingerprints for all observations using new strategy. 3. Merge duplicate debt entries. 4. Rebuild debt ledger from archive if original is corrupted. |
| **Solve layer instability (Pitfall 4)** | HIGH | 1. Disable P→F integration temporarily: `--no-promote-observations`. 2. Run solve with lower max iterations: `--max-iterations 3`. 3. Diagnose oscillation; check which layer is flip-flopping. 4. Manually fix the oscillating layer's entries. 5. Re-enable P→F after investigation. |
| **Source abstraction leak (Pitfall 5)** | MEDIUM | 1. List all source-specific conditionals in code: `grep -r "source ===" bin/`. 2. Extract conditional logic into source-specific adapters. 3. Define a common interface that all adapters implement. |
| **Auto-promotion bypass (Pitfall 6)** | HIGH | 1. Remove auto-promotion logic from P→F integration. 2. Audit requirements added in last sprint; undo observation-sourced ones that lack human approval. 3. Implement explicit `/qgsd:add-requirement` workflow. |
| **Formal verification budget exhaustion (Pitfall 7)** | MEDIUM | 1. Reduce max new requirements per solve run: `--max-new-reqs 2`. 2. Increase formal verification timeout: `QGSD_FORMAL_VERIFY_TIMEOUT_MS=600000` (10 min). 3. Batch observations; throttle P→F promotion. |
| **Fingerprint drift fragmentation (Pitfall 8)** | MEDIUM | 1. Compute fingerprint variants for all debt entries. 2. Merge variants back to primary fingerprint. 3. Audit promoted requirements; undo duplicates. 4. Implement variant consolidation going forward. |
| **Lack of observability (Pitfall 9)** | LOW | 1. Add promotion criteria to config. 2. Add `--explain` flag to observe command. 3. Log promotion reasoning to each promoted requirement. |
| **Schema incompatibility (Pitfall 10)** | HIGH | 1. Extend requirements.schema.json to include `observation_source`, `observation_fingerprint` in provenance. 2. Implement debt-to-requirement mapping with field translation. 3. Validate promoted requirements before adding to envelope. 4. Rebuild requirement envelope if schema changed; audit existing promoted requirements. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| **1. False positive floods** | Observe: Implement per-source dedup + AI similarity clustering | Test observe with 50+ Sentry issues; verify triage table is <15 items after dedup |
| **2. Unbounded debt ledger** | Debt Tracking: Establish retention policy + GC logic | Run observe for 30 days; verify debt ledger stays <500 entries via auto-cleanup |
| **3. Fingerprint collision/split** | Observe: Implement collision/split detection + variant consolidation | Generate fingerprints for 100+ similar errors; verify no collisions detected |
| **4. Solve layer instability** | P→F Integration: Add oscillation detection + per-layer change tracking | Run solve with P→F enabled; verify convergence in <5 iterations; monitor residual vector for oscillation |
| **5. Source abstraction leak** | Observe: Define source interface contract + adapter pattern | Add 2 new sources without modifying core observe logic; all source-specific code is in adapters |
| **6. Auto-promotion bypass** | P→F Integration: Implement human review gate + explicit approval command | Attempt auto-promotion; verify it fails without human approval; verify `/qgsd:add-requirement --from-debt` works |
| **7. Formal verification budget exhaustion** | P→F Integration: Add throttling + budget tracking | Generate 50 observations; verify formal model generation batches to ≤3 models per run |
| **8. Fingerprint drift fragmentation** | Debt Tracking: Implement variant tracking + consolidation | Rebuild the same error 3 times (with build hash changes); verify all 3 occurrences map to same debt entry |
| **9. Lack of observability** | Observe: Declare promotion criteria + explain command | Run `observe --show-promotable --explain`; verify output explains why each observation is ready for promotion |
| **10. Schema incompatibility** | P→F Integration: Extend requirements schema + implement mapping | Promote 10 debt items; verify all mapped requirements pass schema validation; verify provenance includes observation metadata |

---

## Phase Structure Recommendations

Based on these pitfalls, the roadmap should be structured as:

### Phase A: Observe Integration
- **Pitfalls addressed:** 1, 5, 9
- **Deliverables:** Per-source dedup, severity mapping config, AI similarity clustering, collision/split detection
- **Success criteria:** Triage table is dedup'd; no false duplicate detection; can add new sources without code changes

### Phase B: Debt Tracking
- **Pitfalls addressed:** 2, 8
- **Deliverables:** Debt ledger schema, retention policy, GC logic, fingerprint variant tracking
- **Success criteria:** Ledger stays bounded; variants consolidate automatically; old entries auto-archive

### Phase C: P→F Integration
- **Pitfalls addressed:** 3, 4, 6, 7, 10
- **Deliverables:** Human review gate, oscillation detection, formal verification throttling, requirements schema extension, debt-to-requirement mapping
- **Success criteria:** Auto-promotion is prevented; solve loop converges in <5 iterations; promoted requirements validate against schema

---

## Sources

- [Sentry's Event Grouping and Fingerprinting Rules](https://docs.sentry.io/concepts/data-management/event-grouping/)
- [Sentry's AI-Powered Similarity Detection](https://blog.sentry.io/how-sentry-decreased-issue-noise-with-ai/)
- [Grafana's 2026 Observability Trends](https://grafana.com/blog/2026-observability-trends-predictions-from-grafana-labs-unified-intelligent-and-open/)
- [Architectural Observability for Managing Technical Debt](https://vfunction.com/blog/why-mastering-architectural-observability-is-pivotal-to-managing-technical-debt/)
- [On the Impact of Formal Verification on Software Development](https://ranjitjhala.github.io/static/oopsla25-formal.pdf)
- [Verification of Strong Eventual Consistency in Distributed Systems](https://arxiv.org/pdf/1707.01747)

---

*Pitfalls research for: Production Feedback Loops & Debt Tracking Integration*
*Researched: 2026-03-04*
*Confidence: HIGH (based on QGSD's existing architecture, Solve layer 7-transition design, and production observability best practices)*
