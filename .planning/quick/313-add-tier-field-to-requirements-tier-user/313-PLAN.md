---
phase: quick-313
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/aggregate-requirements.cjs
  - bin/aggregate-requirements.test.cjs
  - bin/nf-solve.cjs
  - bin/sweep-reverse.test.cjs
  - .planning/formal/requirements.json
autonomous: true
formal_artifacts: none
must_haves:
  truths:
    - "Every requirement in requirements.json has a tier field (user or technical)"
    - "Existing requirements default to tier: user"
    - "C->R and T->R scanners classify infrastructure files as tier: technical instead of FP-ing as missing user requirements"
    - "classifyCandidate returns a proposed_tier field for Category A module/test candidates"
  artifacts:
    - path: "bin/aggregate-requirements.cjs"
      provides: "tier field injection during aggregation"
      contains: "tier"
    - path: "bin/nf-solve.cjs"
      provides: "tier-aware classifyCandidate and sweep functions"
      contains: "proposed_tier"
    - path: ".planning/formal/requirements.json"
      provides: "all requirements with tier field"
      contains: "tier"
  key_links:
    - from: "bin/aggregate-requirements.cjs"
      to: ".planning/formal/requirements.json"
      via: "aggregateRequirements writes tier field"
      pattern: "tier.*user"
    - from: "bin/nf-solve.cjs classifyCandidate"
      to: "assembleReverseCandidates"
      via: "proposed_tier propagated to candidate output"
      pattern: "proposed_tier"
---

<objective>
Add a `tier` field to the requirements schema (`user` | `technical`) and make the C->R / T->R reverse scanners propose `tier: technical` for infrastructure/tooling files instead of flagging them as false-positive missing user requirements.

Purpose: Infrastructure modules (build scripts, test harnesses, config loaders, install scripts) currently show up as C->R residual items needing user-facing requirements. They genuinely need requirements, but *technical* ones — not user-tier. Adding a tier distinction lets the solve loop propose the right kind of requirement and reduces noise.

Output: Updated requirements.json schema with tier field, tier-aware classification in sweeps.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/aggregate-requirements.cjs
@bin/aggregate-requirements.test.cjs
@bin/nf-solve.cjs
@bin/sweep-reverse.test.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add tier field to requirements schema and aggregation</name>
  <files>
    bin/aggregate-requirements.cjs
    bin/aggregate-requirements.test.cjs
    .planning/formal/requirements.json
  </files>
  <action>
1. In `aggregate-requirements.cjs`, in the `aggregateRequirements()` function, after the category group consolidation loop (around line 318), add a step that defaults `tier` for every merged requirement:

```javascript
// Default tier: all existing requirements are user-tier unless explicitly marked
merged.forEach(function(req) {
  if (!req.tier) {
    req.tier = 'user';
  }
});
```

This ensures backward compatibility — all 287 existing requirements get `tier: "user"`.

2. In `parseRequirements()`, update the requirement bullet parsing to detect an optional `(technical)` suffix in the requirement text. If present, set `tier: 'technical'` on the parsed requirement and strip the suffix from the text. Otherwise default to `tier: 'user'`.

3. In `validateEnvelope()`, if it validates requirement fields, add `tier` as an accepted optional field (no breaking changes to validation).

4. In `aggregate-requirements.test.cjs`, add a test that verifies:
   - Parsed requirements without `(technical)` suffix get `tier: 'user'`
   - Parsed requirements with `(technical)` suffix get `tier: 'technical'` and the suffix is stripped from text
   - Aggregated envelope requirements all have a `tier` field

5. Re-run aggregation to update `requirements.json` with tier fields:
   `node bin/aggregate-requirements.cjs`
  </action>
  <verify>
    node --test bin/aggregate-requirements.test.cjs 2>&1 | tail -20
    node -p "const d=JSON.parse(require('fs').readFileSync('.planning/formal/requirements.json','utf8')); const all=d.requirements.length; const withTier=d.requirements.filter(r=>r.tier).length; all+'='+withTier"
  </verify>
  <done>All requirements in requirements.json have a tier field. Existing requirements default to "user". Tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Make C->R and T->R classifiers propose tier for infrastructure candidates</name>
  <files>
    bin/nf-solve.cjs
    bin/sweep-reverse.test.cjs
  </files>
  <action>
1. In `classifyCandidate()` (line ~2201 in nf-solve.cjs), add infrastructure detection logic for module and test type candidates. When the candidate file path matches infrastructure patterns, set `proposed_tier: 'technical'`; otherwise `proposed_tier: 'user'`.

Infrastructure patterns to detect (file basename or path matching):
- Build/tooling: `install`, `aggregate-`, `build-`, `compute-`, `validate-`, `token-dashboard`, `solve-tui`, `solve-worker`, `solve-wave-dag`, `solve-debt-bridge`
- Config: `config-loader`, `layer-constants`, `providers`
- MCP/internal: `unified-mcp-server`, `review-mcp-logs`, `check-mcp-health`
- Security/ops: `security-sweep`
- Hooks infrastructure: files under `hooks/` path

The classification should add `proposed_tier` to the returned object alongside existing `category`, `reason`, `suggestion` fields:

```javascript
// For module/test candidates, determine tier
const infraPatterns = [
  /^(install|aggregate-|build-|compute-|validate-|solve-tui|solve-worker|solve-wave-dag|solve-debt-bridge|token-dashboard|config-loader|layer-constants|providers|unified-mcp-server|review-mcp-logs|check-mcp-health|security-sweep)/,
];
const baseName = path.basename(candidate.file_or_claim || '').replace(/\.(test\.)?(cjs|js|mjs)$/, '');
const isInfra = infraPatterns.some(p => p.test(baseName)) || (candidate.file_or_claim || '').startsWith('hooks/');
const proposed_tier = isInfra ? 'technical' : 'user';
```

Return the `proposed_tier` in the classification result object so it propagates through `assembleReverseCandidates`.

2. In `assembleReverseCandidates()` (line ~2364), after calling `classifyCandidate(c)`, also copy `proposed_tier` onto the candidate:
```javascript
c.proposed_tier = classification.proposed_tier || 'user';
```

3. In `sweep-reverse.test.cjs`, add tests:
   - `classifyCandidate` returns `proposed_tier: 'technical'` for an infrastructure module candidate (e.g., `{ file_or_claim: 'bin/install.js', type: 'module' }`)
   - `classifyCandidate` returns `proposed_tier: 'user'` for a feature module candidate (e.g., `{ file_or_claim: 'bin/nf-solve.cjs', type: 'module' }`)
   - `classifyCandidate` returns `proposed_tier: 'technical'` for a hooks file (e.g., `{ file_or_claim: 'hooks/nf-prompt.js', type: 'module' }`)

Import `classifyCandidate` from `./nf-solve.cjs` if not already imported in the test file.
  </action>
  <verify>
    node --test bin/sweep-reverse.test.cjs 2>&1 | tail -20
    grep -c 'proposed_tier' bin/nf-solve.cjs
  </verify>
  <done>classifyCandidate returns proposed_tier for all candidate types. Infrastructure files get "technical", feature files get "user". Tests pass. The solve loop can now distinguish infra candidates from user-facing ones.</done>
</task>

</tasks>

<verification>
- `node --test bin/aggregate-requirements.test.cjs` passes
- `node --test bin/sweep-reverse.test.cjs` passes
- All requirements in requirements.json have a `tier` field
- classifyCandidate returns `proposed_tier` for module/test candidates
- No existing tests broken: `node --test bin/nf-solve.test.cjs` passes
</verification>

<success_criteria>
1. Every requirement in `.planning/formal/requirements.json` has `"tier": "user"` (default for existing)
2. `classifyCandidate()` returns `proposed_tier: "technical"` for infrastructure file candidates
3. `classifyCandidate()` returns `proposed_tier: "user"` for feature module candidates
4. All existing tests continue to pass
5. New tests validate both tier assignment paths
</success_criteria>

<output>
After completion, create `.planning/quick/313-add-tier-field-to-requirements-tier-user/313-SUMMARY.md`
</output>
