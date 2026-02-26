# Feature Landscape

**Domain:** Formal plan verification integrated into AI multi-model quorum planning workflows (QGSD v0.16)
**Researched:** 2026-02-26
**Confidence:** HIGH for Mermaid mindmap syntax (official docs); HIGH for plan-to-TLA+ fragment patterns (arxiv research + existing xstate-to-tla.cjs precedent); MEDIUM for JSON intermediate representation design (academic pattern + first-principles); MEDIUM for JSDoc annotation extraction (ts-morph/TypeScript AST confirmed; custom tags are convention, not standard); LOW for ideal iteration cap (4/delta bound gives math, not a fixed number)

---

## Context: What Is Already Built

This is a SUBSEQUENT MILESTONE. QGSD v0.14 has a fully operational formal verification pipeline:

- `bin/xstate-to-tla.cjs` — XState TypeScript machine → TLA+ spec + TLC config (esbuild + require() extraction)
- `bin/generate-formal-specs.cjs` — XState machine → TLA+, Alloy, PRISM (regex-based extraction, regex fallback)
- `bin/check-spec-sync.cjs` — drift detector: XState machine vs TLA+/Alloy/guards JSON (esbuild AST + regex)
- `bin/run-formal-verify.cjs` — parallel verification runner: generate (sequential) then tla/alloy/prism/petri (concurrent via Promise.all), --watch mode
- `bin/run-prism.cjs` — PRISM runner with `readScoreboardRates()` injecting empirical TP/unavail rates as -const flags
- `formal/tla/QGSDQuorum.tla` — hand-authored canonical TLA+ spec (states, invariants, safety, liveness)
- `formal/tla/guards/qgsd-workflow.json` — guard name → TLA+ expression mapping
- `formal/alloy/*.als` (7 files), `formal/prism/*.pm` (2 files), `formal/petri/*.dot` (2 files)
- `plan-phase.md` — orchestrates researcher → planner → plan-checker → quorum → execute

The 6 features below are NEW for v0.16.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that the v0.16 milestone cannot ship without. These are the minimum for the milestone title "Formal Plan Verification" to be credible.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Plan-to-spec pipeline (PLAN.md → formal spec fragments) | Any workflow claiming "plan verification" must produce machine-checkable artifacts from the plan. Without spec generation, the verification loop has nothing to check — it is just a linting step. Research (arxiv 2510.03469, Self-Spec 2024) confirms the pattern: NL plan → structured IR → formal spec fragment → model check. | HIGH | PLAN.md contains tasks, preconditions, goals in markdown. The pipeline extracts state-relevant facts (new states introduced, guards modified, variables changed) and emits TLA+ action fragments and/or Alloy predicate stubs to `.planning/phases/<phase>/formal/`. Output format: a partial TLA+ module extending `QGSDQuorum` with proposed new actions. The verifier checks these fragments against the existing spec for type safety and invariant preservation. |
| Iterative verification loop (revise until verification passes or cap reached) | An AI that generates a spec fragment and immediately presents it to quorum without checking it first defeats the purpose of formal verification. The loop is the core innovation — it turns formal verification from an audit into a correctness gate. VeriPlan (CHI 2025) and the 4/delta bound paper (arXiv 2512.02080) both validate this pattern. | HIGH | Claude generates PLAN.md, generates spec fragments, runs `run-formal-verify.cjs --only=generate && run-tlc.cjs`, reads result. If TLC fails: revise PLAN.md or spec fragment, re-run. Cap at 5 iterations (see Anti-Features for rationale). On verification pass: present plan + proof summary to quorum. The loop runs inside plan-phase.md, between planner return and quorum dispatch. |
| Quorum formal context injection (slot-workers receive spec summary + verification result) | Quorum slot-workers currently vote on plan text alone. Formal verification results are evidence — without injecting them into the slot-worker prompt, the quorum cannot weigh mathematical proof against subjective review. This is the bridge between the verification loop and the quorum system. | MEDIUM | Two new fields in the quorum slot-worker YAML prompt block: `formal_spec_summary: |` (human-readable summary of what the spec fragment proves/disproves, max 300 tokens) and `verification_result: PASS | FAIL | TIMEOUT`. Workers receive the proof summary as part of their review context. No spec file injection — summaries only, to keep token cost bounded. |
| Mind map generation (PLAN.md → Mermaid mindmap → MINDMAP.md) | AI agents reviewing plans benefit from hierarchical visual structure. Mermaid mindmaps give slot-workers a cognitive scaffolding that lets them identify structural gaps faster than reading flat markdown. ChatPRD workflow research confirms injecting Mermaid diagrams into agent context reduces missed dependencies. | MEDIUM | `PLAN.md` → parse tasks, dependencies, waves → emit `mindmap` Mermaid block. Output written to `.planning/phases/<phase>/MINDMAP.md`. Injected into quorum slot-worker context as a fenced code block (not rendered, but LLMs can parse Mermaid syntax accurately). Structure: root = phase name; L1 = waves; L2 = plans per wave; L3 = tasks per plan; leaf annotations for dependencies. |

---

### Differentiators (What Sets v0.16 Apart)

Features that no existing AI planning tool combines in one pipeline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| QGSD self-application: code → all spec types via hybrid AST + JSDoc annotations | Existing `generate-formal-specs.cjs` uses regex extraction from a single XState machine file. V0.16 upgrades to AST-based extraction that also reads `@invariant`, `@transition`, and `@probability` JSDoc annotations embedded in QGSD's source code. This means any QGSD developer can declare a new invariant or transition in code and have it automatically appear in TLA+, Alloy, and PRISM specs without manually editing spec files. Kleppmann (2025) identifies this "spec-from-code" pattern as the key to making formal verification sustainable. | HIGH | New annotation schema: `/** @invariant TypeOK -- phase must be in {"IDLE", "COLLECTING_VOTES", ...} */`, `/** @transition StartQuorum -- precondition: phase="IDLE", effect: phase="COLLECTING_VOTES" */`, `/** @probability unavailRate -- conservative prior 0.15 */`. Extracted via esbuild + ts-morph JSDoc node visitor. Each annotation type feeds its target spec: `@invariant` → TLA+ `INVARIANT` + Alloy `assert`; `@transition` → TLA+ `Action`; `@probability` → PRISM `const`. QGSD's own source becomes the single canonical source for all four spec types. |
| General-purpose code → spec pipeline (expose for user projects) | QGSD users who adopt the annotation scheme in their own projects get the same four-spec pipeline for free. This is the outward-facing version of the QGSD self-application feature — turns QGSD from a planning tool into a formal verification framework that other projects can adopt. | MEDIUM | `bin/extract-annotations.cjs <input-file.ts> [--spec=tla|alloy|prism|all] [--out-dir=formal/]`. Accepts any TypeScript or JavaScript file with `@invariant`/`@transition`/`@probability` annotations. Emits spec fragments to `--out-dir`. No knowledge of QGSD-specific state machine required — uses annotation content directly. Integrates with `run-formal-verify.cjs` via a new `generate:annotations` step added to STEPS[]. |

---

### Anti-Features (Explicitly Out of Scope for v0.16)

| Anti-Feature | Why Requested | Why Avoid | What to Do Instead |
|--------------|---------------|-----------|-------------------|
| Full proof generation (not just TLC model checking) | "Prove correctness, not just model-check" | TLC model checking over bounded state spaces (N=5 agents, MaxDelib=7) is complete for finite-state safety properties. Full Lean/Isabelle proofs require PhD-level expertise per spec and are 10-100x the implementation cost. The "vericoding" wave (Kleppmann 2025) hasn't produced usable tooling for this yet. | TLC with concrete small-N instantiation. Document that bounded checking covers the intended operating range (N ≤ 11 agents per providers.json). |
| Natural language → complete TLA+ spec (one shot) | "Just have Claude write the whole spec" | LLM-generated TLA+ has high hallucination rate for temporal operators and invariant expressions. arXiv 2510.03469 uses a constrained translation with only 4 transformation rules because unconstrained generation fails. | Structured fragment generation: extract a specific, bounded subset of spec changes (new actions + their guards) from a structured PLAN.md intermediate representation, not free-form generation. The existing hand-authored `QGSDQuorum.tla` stays canonical; fragments extend it. |
| Iteration cap above 5 | "More iterations = more likely to converge" | The 4/delta bound paper (arXiv 2512.02080) shows E[iterations] = 4/delta where delta is per-stage success probability. At delta=0.5 (generous), expected iterations = 8. Beyond 5 iterations, if verification still fails, the spec fragment is likely wrong — not the PLAN.md. The right action is to flag for human review, not continue iterating. Context cost grows linearly with each iteration. | Cap at 5. On exhaustion: surface the TLC error log + spec fragment to quorum as evidence of complexity; let quorum decide whether to approve with known limitations or block. |
| Spec fragments injected verbatim into slot-worker prompts | "Workers should read the actual TLA+ spec" | A full TLA+ module is 80-200 lines. Injecting this into every slot-worker context window inflates token cost by ~600 tokens per worker per round. With 11 workers × 2 rounds, that's ~13,000 extra tokens per quorum cycle at current QGSD scale. | `formal_spec_summary` field: a 3-5 sentence human-readable summary of what the fragment proves, what invariants it checks, and whether TLC found violations. Workers vote on this summary. Full spec available on disk at a known path they can read if they want (inject path, not content). |
| Per-commit verification CI | "Run formal verification on every git push" | TLC for the full 21-step pipeline takes ~2 minutes (v0.14 parallelized). Running this on every commit to a busy QGSD repo would block PR pipelines. TLC state space grows with each new spec fragment added per phase. | On-demand: `run-formal-verify.cjs` remains manually invoked. The verification loop runs inside `plan-phase.md` (before quorum) — that is the right gate, not CI. CI can run `check-spec-sync.cjs` (fast drift check, <5s) on every push. |
| Mermaid mindmap rendered to image | "Inject PNG into quorum context" | LLMs do not benefit from PNG mindmap images — they cannot render Mermaid to image inline, and injecting a base64 PNG wastes tokens. Claude Code can parse Mermaid syntax as text. | Inject the Mermaid code block as text. All current LLMs in QGSD's quorum (Claude, DeepSeek, Qwen, Kimi, Llama) can parse Mermaid mindmap syntax and reason about hierarchical structure from the text. |
| Icon and CSS class annotations in Mermaid mindmaps | "Add icons for visual clarity" | Mermaid mindmap icons require Font Awesome or Material Design CSS loaded by the host. GitHub markdown renders mindmaps but does not load icon fonts — icons silently disappear. Alloy/PRISM/Claude Code rendered contexts also don't have icon fonts. | Plain indentation-based Mermaid mindmaps with clear text labels. Use `(round node)` for intermediate nodes and `[square node]` for leaf tasks. No `::icon()` syntax. This matches the GitHub mindmap rendering constraint confirmed in Mermaid docs. |

---

## Feature Dependencies

```
PLAN.md (existing planner output)
    └──input to──> plan-to-spec pipeline (NEW: bin/plan-to-spec.cjs)
                        └──writes──> .planning/phases/<phase>/formal/<phase>-spec-fragment.tla
                        └──writes──> .planning/phases/<phase>/formal/<phase>-spec-fragment.als (optional)
                        └──input to──> iterative verification loop (NEW: inside plan-phase.md step)
                                            └──calls──> run-formal-verify.cjs --only=generate,tla (EXISTING)
                                            └──reads──> TLC exit code + error summary
                                            └──revises PLAN.md or spec fragment (up to 5 iterations)
                                            └──on PASS──> generates formal_spec_summary (short text)
                                            └──on CAP EXHAUSTED──> surfaces TLC errors to quorum

PLAN.md (verified or verification-exhausted)
    └──input to──> mind map generator (NEW: bin/plan-to-mindmap.cjs)
                        └──writes──> .planning/phases/<phase>/MINDMAP.md

quorum dispatch (EXISTING: plan-phase.md step 8.5)
    └──now receives──> formal_spec_summary (NEW: verification result text)
    └──now receives──> verification_result: PASS | FAIL | TIMEOUT (NEW: field)
    └──now receives──> MINDMAP.md content as fenced code block (NEW: injection)
    └──slot-worker YAML prompt gains two new fields (NEW)

QGSD source code (*.ts, *.cjs in src/, hooks/, bin/)
    └──annotated with──> @invariant / @transition / @probability JSDoc (NEW: convention)
    └──extracted by──> bin/extract-annotations.cjs (NEW: AST + JSDoc node visitor)
                        └──feeds──> TLA+ actions/invariants (existing formal/tla/*.tla)
                        └──feeds──> Alloy assertions (existing formal/alloy/*.als)
                        └──feeds──> PRISM const declarations (existing formal/prism/*.pm)
                        └──replaces partial reliance on generate-formal-specs.cjs regex extraction
                        └──added as STEPS[0b] in run-formal-verify.cjs (before tla/alloy/prism groups)

User project source (any *.ts / *.js with annotations)
    └──extracted by──> bin/extract-annotations.cjs --spec=all --out-dir=formal/ (general-purpose mode)
    └──same bin/ script as QGSD self-application; project-agnostic
```

### Dependency Notes

- **plan-to-spec pipeline is the critical path.** Verification loop, formal_spec_summary, and quorum context injection all depend on it. If plan-to-spec generates no usable fragment, verification loop must handle gracefully (TIMEOUT verdict, no spec generated — proceed to quorum without formal evidence).
- **MINDMAP.md is independent of the verification result.** It can be generated from PLAN.md before verification starts. No coupling to TLC outcome.
- **Quorum formal context injection is additive.** The two new fields (`formal_spec_summary`, `verification_result`) are optional additions to the existing YAML block format. Existing slot-workers that don't parse them are unaffected (fail-open — R6 principle applies to new fields too).
- **extract-annotations.cjs requires esbuild (already a devDependency) and ts-morph.** ts-morph is not currently in package.json. If ts-morph adds too much weight, use TypeScript compiler API directly (`ts.createSourceFile` + JSDoc node walker) — no external package, same result.
- **Hand-authored TLA+ specs stay canonical.** `formal/tla/QGSDQuorum.tla` is NOT overwritten by spec fragments. Fragments are additive modules in `.planning/phases/<phase>/formal/` that the verifier checks for compatibility with the canonical spec. The `_xstate.tla` suffix convention (from v0.14 BROKEN-01 decision) applies here too.

---

## Expected Outputs Per Feature

### 1. Plan-to-Spec Pipeline

**Input:** `.planning/phases/<phase>/<plan>-PLAN.md`

**Extraction step:** Parse PLAN.md for:
- "New states introduced" (e.g., `VERIFYING_PLAN`) → TLA+ `TypeOK` additions
- "Guards modified" (e.g., `planVerified`) → TLA+ guard expressions
- "Variables changed" (e.g., `verificationResult`) → TLA+ variable declarations

**Intermediate representation format (JSON):**
```json
{
  "phase": "v0.16-01",
  "plan": "v0.16-01-01-PLAN",
  "new_states": ["VERIFYING_PLAN"],
  "new_guards": [
    { "name": "planVerified", "tla_expr": "verificationResult = \"PASS\"" }
  ],
  "new_variables": [
    { "name": "verificationResult", "type": "string", "initial": "\"NONE\"" }
  ],
  "new_actions": [
    {
      "name": "StartPlanVerification",
      "precondition": "phase = \"PLANNING\"",
      "effect": "phase' = \"VERIFYING_PLAN\" /\\ UNCHANGED verificationResult"
    }
  ],
  "invariants_to_check": ["TypeOK", "PlanVerificationBounded"]
}
```

**Output:** `.planning/phases/<phase>/formal/<phase>-spec-fragment.tla`

A partial TLA+ module that adds only the new states/actions to the existing `QGSDQuorum` spec. The TLC run checks this fragment against the existing invariants.

**Confidence:** MEDIUM. The JSON IR format is designed from the OnionL/REQ2LTL pattern (arxiv 2512.17334) and the existing xstate-to-tla.cjs extraction model. No direct prior art for PLAN.md-specific extraction. The specific fields are first-principles.

---

### 2. Iterative Verification Loop

**Where it runs:** Inside `plan-phase.md`, between planner return (step 8) and quorum dispatch (step 8.5). New step 8.3: "Formal Verification Loop".

**Algorithm:**
```
iteration = 0
max_iterations = 5
while iteration < max_iterations:
    1. Run plan-to-spec pipeline → spec fragment
    2. Run: node bin/run-formal-verify.cjs --only=generate,tla (focused: no alloy/prism)
    3. If exit 0 (PASS):
         - Generate formal_spec_summary from TLC output
         - verification_result = "PASS"
         - Break
    4. If exit 1 (FAIL):
         - Parse TLC error: which invariant violated, which action caused it
         - Revise PLAN.md (remove/modify the offending action) OR
           revise spec fragment guard expression
         - iteration++
5. If iteration == max_iterations:
     - verification_result = "FAIL"
     - formal_spec_summary = "Verification exhausted after 5 iterations: [TLC error summary]"
```

**Cap rationale:** The 4/delta bound paper (arXiv 2512.02080) derives E[iterations] = 4/delta. For a plan-to-spec pipeline where the generation step succeeds ~50% of the time (conservative for structured extraction), expected iterations = 8. A cap of 5 covers the practical zone and aligns with the existing plan-checker revision loop (also capped at 3). Beyond 5 iterations, the TLC error is likely a genuine semantic incompatibility (not a syntax fix), warranting human review via quorum.

**Confidence:** MEDIUM. The 5-iteration cap is derived from the 4/delta bound (academic, verified) combined with context-budget considerations and analogy to the existing 3-iteration plan-checker loop. No direct prior art for this specific plan verification loop cap.

---

### 3. Mind Map Generation

**Input:** All `*-PLAN.md` files in the phase directory.

**Output:** `.planning/phases/<phase>/MINDMAP.md`

**Mermaid mindmap structure:**
```
mindmap
  root((Phase v0.16-01))
    Wave 1
      Plan 01: plan-to-spec pipeline
        Extract states from PLAN.md
        Generate spec fragment TLA+
        Write to formal/ dir
      Plan 02: verification loop
        Run TLC on fragment
        Revise on failure
    Wave 2
      Plan 03: quorum context injection
        formal_spec_summary field
        verification_result field
```

**Node shape choices:**
- Root: `((double circle))` — phase identifier
- Wave groups: plain text (default shape) — grouping label
- Plans: `[square bracket]` — plan unit
- Tasks: plain text — leaf items
- Dependencies: annotated with `depends: Plan XX` text on leaf node

**GitHub rendering constraint:** Use only plain indentation + brackets/parens/double-parens. No `::icon()` syntax (requires icon fonts not available on GitHub). No CSS class annotations. This constraint is confirmed in Mermaid docs and community reports.

**Injection into quorum:** Quorum slot-worker YAML prompt gains:
```yaml
mindmap: |
  ```mermaid
  mindmap
    ...
  ```
```

Token budget estimate: 50-150 tokens per mindmap (10-30 nodes × 5 tokens/node average). Well within slot-worker context limits.

**Confidence:** HIGH for syntax constraints (Mermaid official docs confirmed). MEDIUM for usefulness as quorum context (no direct benchmark; ChatPRD workflow research supports the pattern; LLMs confirmed to parse Mermaid text accurately).

---

### 4. Quorum Formal Context Injection

**What changes:** Two new fields added to the quorum slot-worker YAML prompt block in `plan-phase.md` step 8.5.

**Before (existing format):**
```yaml
slot: <slotName>
round: 1
timeout_ms: 30000
repo_dir: <path>
mode: A
question: "Do these plans correctly address the phase goal?"
artifact_path: .planning/phases/<phase>/<plan>-PLAN.md
```

**After (v0.16 addition):**
```yaml
slot: <slotName>
round: 1
timeout_ms: 30000
repo_dir: <path>
mode: A
question: "Do these plans correctly address the phase goal?"
artifact_path: .planning/phases/<phase>/<plan>-PLAN.md
formal_spec_summary: |
  TLC verified: StartPlanVerification action preserves TypeOK and PlanVerificationBounded invariants.
  New state VERIFYING_PLAN is reachable from PLANNING and transitions only to PLANNING_COMPLETE.
  No deadlock states found. Safety: verificationResult stays in {"NONE","PASS","FAIL"}.
  Verification result: PASS (2 TLC iterations, 847 states explored).
verification_result: PASS
mindmap: |
  ```mermaid
  mindmap
    root((Phase v0.16-01))
      ...
  ```
```

**Slot-worker behavior:** Workers that parse these fields include the proof summary in their reasoning. Workers that don't parse them (UNAVAIL, legacy) are unaffected — fields are advisory context, not required input. This is consistent with R6 fail-open policy.

**Confidence:** HIGH. The pattern is additive to existing YAML format. YAML injection is already used for `artifact_path`. Token cost analysis above confirms budget fit.

---

### 5. QGSD Self-Application: Code → All Spec Types

**Annotation scheme:**

Three new JSDoc annotation types, read by `bin/extract-annotations.cjs`:

```javascript
/**
 * @invariant TypeOK
 * phase \in {"IDLE", "COLLECTING_VOTES", "DELIBERATING", "DECIDED"}
 */
const VALID_PHASES = ['IDLE', 'COLLECTING_VOTES', 'DELIBERATING', 'DECIDED'];

/**
 * @transition StartQuorum
 * precondition: phase = "IDLE"
 * effect: phase' = "COLLECTING_VOTES", UNCHANGED <<successCount, deliberationRounds>>
 */
function startQuorum(state) { ... }

/**
 * @probability unavailRate
 * description: P(slot is UNAVAILABLE in a given round)
 * conservative_prior: 0.15
 * empirical_source: quorum-scoreboard.json aggregated mean
 */
const DEFAULT_UNAVAIL_RATE = 0.15;
```

**Extraction algorithm:**
1. Parse file with esbuild → temp CJS bundle (existing pattern from xstate-to-tla.cjs)
2. Walk AST via TypeScript compiler API JSDoc node visitor (no external dep) OR ts-morph `JSDocTag` API
3. For each `@invariant` tag: extract tag name + multi-line body → emit TLA+ INVARIANT block + Alloy assert block
4. For each `@transition` tag: extract name + precondition/effect lines → emit TLA+ action block
5. For each `@probability` tag: extract name + conservative_prior value → emit PRISM const declaration
6. Write fragments to output directory (defaults to `formal/`)

**Spec output mapping:**
| Annotation | TLA+ output | Alloy output | PRISM output |
|---|---|---|---|
| `@invariant` | `INVARIANT <name>` + predicate body | `assert <name> {}` with equivalent predicate | N/A |
| `@transition` | `<name> ==` action block | N/A (transitions are TLA+ concept) | N/A |
| `@probability` | N/A | N/A | `const double <name> = <prior>` |

**Dependency on existing infrastructure:** Plugs into `run-formal-verify.cjs` as a new `generate:annotations` step added between `generate:tla-from-xstate` and `generate:alloy-prism-specs` in STEPS[]. This makes annotation extraction part of the existing parallel pipeline.

**Confidence:** MEDIUM. esbuild extraction pattern is proven (xstate-to-tla.cjs). TypeScript JSDoc AST walking is standard (ts.getJSDocTags, ts.getAllJSDocTags). Custom annotation names (`@invariant`, `@transition`, `@probability`) are conventions, not TypeScript compiler directives — the extraction relies on tag name matching, which is straightforward. Risk: if a codebase uses `@invariant` for a different purpose (UI animation libraries, test frameworks), false positives are possible. Mitigation: scope extraction to files with `@qgsd-spec` marker annotation.

---

### 6. General-Purpose Code → Spec

**What it is:** The same `bin/extract-annotations.cjs` script with a project-agnostic CLI interface.

**CLI:**
```bash
node bin/extract-annotations.cjs <input-file.ts> [--spec=tla|alloy|prism|all] [--out-dir=formal/]
node bin/extract-annotations.cjs src/**/*.ts --spec=all --out-dir=formal/
```

**What makes it general-purpose vs QGSD-specific:**
- No hardcoded QGSD state names, no XState dependency
- Reads annotation content verbatim into spec fragments (annotation body IS the spec content)
- `--spec=tla` emits a `.tla` file with annotated invariants/actions extracted from the target files
- Works on any TypeScript or JavaScript project that adopts the annotation convention

**Integration with QGSD user workflow:** Documented as an optional `plan-phase` flag: `--extract-annotations <glob>`. When provided, `plan-phase.md` runs `extract-annotations.cjs` before the plan-to-spec pipeline, seeding the formal context with project-specific invariants already declared in code.

**Confidence:** MEDIUM. The CLI generalization is straightforward given the QGSD self-application implementation exists. Risk: annotation format is bespoke — competing annotation approaches (Dafny contracts, Hoare annotations) are more established but require different toolchains. The QGSD annotation convention is pragmatic and zero-dependency.

---

## MVP Definition

### Must Ship (v0.16)

All 4 table-stakes features are required for the milestone to be credible. Differentiators are high-value but can slip to v0.16.x if time-constrained.

Priority order reflects dependency chain:

1. **Plan-to-spec pipeline** — critical path; everything else reads its output
2. **Iterative verification loop** — gates PLAN.md before quorum; highest correctness value
3. **Quorum formal context injection** — the quorum-side integration; delivers the proof to voters
4. **Mind map generation** — independent of verification result; high DX value, low risk
5. **QGSD self-application** — differentiator; replaces partial regex extraction with annotation-based approach
6. **General-purpose code → spec** — differentiator; extends QGSD self-application outward

### Suggested Phase Split

**Phase v0.16-01 (plan-to-spec pipeline + verification loop):** `bin/plan-to-spec.cjs` (JSON IR + TLA+ fragment emitter), integration of verification loop into `plan-phase.md` step 8.3, `formal_spec_summary` generation. These three are tightly coupled — they must ship together for the loop to be testable end-to-end.

**Phase v0.16-02 (quorum context injection + mind map):** New YAML fields in quorum slot-worker prompts, `bin/plan-to-mindmap.cjs`, mindmap injection into quorum context. These two are independent of verification (mindmap reads PLAN.md, not TLC output) but belong in the same phase as context-enhancement.

**Phase v0.16-03 (QGSD self-application: extract-annotations.cjs):** JSDoc annotation extraction, `@invariant`/`@transition`/`@probability` schema, integration into `run-formal-verify.cjs` STEPS[]. QGSD source files annotated as a self-application demonstration.

**Phase v0.16-04 (general-purpose CLI + documentation):** Project-agnostic CLI interface for `extract-annotations.cjs`, `--extract-annotations` flag in `plan-phase.md`, user-facing documentation.

---

## Feature Complexity Summary

| Feature | Phase | Complexity | Primary Risk |
|---------|-------|------------|--------------|
| Plan-to-spec pipeline | v0.16-01 | HIGH | PLAN.md parsing is unstructured markdown — extraction rules must be robust to planner formatting variance |
| Iterative verification loop | v0.16-01 | HIGH | TLC error output parsing is fragile; error → plan revision requires Claude to understand TLA+ error messages |
| Quorum formal context injection | v0.16-02 | LOW | Additive YAML fields; no breaking changes to existing slot-worker protocol |
| Mind map generation | v0.16-02 | LOW | Mermaid mindmap syntax is simple; PLAN.md structure is well-defined with wave/plan/task hierarchy |
| QGSD self-application | v0.16-03 | MEDIUM | JSDoc extraction is straightforward; annotation schema design requires careful spec coverage |
| General-purpose code → spec | v0.16-04 | LOW | Thin wrapper over self-application; CLI generalization adds no new algorithms |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — PRIMARY SOURCE. v0.16 milestone goals, 6 target features confirmed.
- `/Users/jonathanborduas/code/QGSD/bin/xstate-to-tla.cjs` — PRIMARY SOURCE. esbuild+require() extraction pattern for TLA+ generation; JSDoc config annotation schema; action name derivation algorithm.
- `/Users/jonathanborduas/code/QGSD/bin/generate-formal-specs.cjs` — PRIMARY SOURCE. Existing regex-based spec generation for TLA+/Alloy/PRISM; shows what annotation extraction must replace.
- `/Users/jonathanborduas/code/QGSD/bin/check-spec-sync.cjs` — PRIMARY SOURCE. AST-based drift detection pattern; esbuild + TypeScript require() for machine extraction.
- `/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs` — PRIMARY SOURCE. STEPS[] structure, parallel group runner, --only= filter; verification loop must integrate here.
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — PRIMARY SOURCE. Step 8.5 quorum dispatch YAML format; step structure that verification loop must fit into.
- [arXiv 2510.03469 — Bridging LLM Planning Agents and Formal Methods](https://arxiv.org/html/2510.03469v1) — MEDIUM confidence. Kripke structure + LTL intermediate representation approach for LLM-generated plans. Four-step translation (variables, initial conditions, actions as transitions, sequencing) informs JSON IR design. One-shot approach confirmed inadequate for complex plans.
- [arXiv 2512.02080 — The 4/delta Bound: Designing Predictable LLM-Verifier Systems](https://arxiv.org/abs/2512.02080) — MEDIUM confidence. Mathematical framework for iteration convergence in LLM-verifier loops. E[n] = 4/delta bound informs 5-iteration cap choice. Three operating zones (marginal/practical/high-performance) map to low/medium/high plan complexity.
- [VeriPlan: Integrating Formal Verification and LLMs into End-User Planning (CHI 2025)](https://dl.acm.org/doi/10.1145/3706598.3714113) — MEDIUM confidence (abstract only, no full text access). Confirms iterative plan verification loop is a recognized CHI 2025 pattern. LLM + formal verification loop for end-user planning validated as usable paradigm.
- [Kleppmann blog — AI will make formal verification go mainstream (2025-12-08)](https://martin.kleppmann.com/2025/12/08/ai-formal-verification.html) — MEDIUM confidence. Core argument: AI + proof checker is the right pattern (hallucinated proofs are rejected by checker, so hallucination risk is contained). Spec-from-code pattern identified as key to sustainable formal verification.
- [Self-Spec: Model-Authored Specifications (OpenReview 2024)](https://openreview.net/pdf?id=6pr7BUGkLp) — LOW confidence (WebSearch only). Supports model-invented IRs for specification; confirms JSON as valid intermediate representation format.
- [arXiv 2512.17334 — Bridging Natural Language and Formal Specification](https://arxiv.org/pdf/2512.17334) — LOW confidence (WebSearch only, not fetched). OnionL/REQ2LTL JSON-based intermediate representation for NL → LTL formulas. JSON IR design pattern confirmed.
- [Mermaid mindmap official docs](https://mermaid.ai/open-source/syntax/mindmap.html) — HIGH confidence. Node shape syntax, icon constraint (requires site admin CSS), class annotation syntax confirmed. No explicit node count limit documented.
- [ChatPRD workflow: Mermaid diagram context for AI code awareness](https://www.chatprd.ai/how-i-ai/workflows/improve-ai-code-awareness-with-mermaid-diagram-context) — LOW confidence (WebSearch summary only). Injecting Mermaid diagrams into AI agent context improves structural reasoning confirmed.
- [TypeScript JSDoc docs](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html) — HIGH confidence. JSDoc tags are part of TypeScript AST. Custom tag names are supported via `ts.getAllJSDocTags()`. No TypeScript version restriction on custom tag names.
- [On the Effectiveness of LLMs in Writing Alloy Formulas (arXiv 2502.15441)](https://arxiv.org/pdf/2502.15441) — MEDIUM confidence. LLMs can write Alloy from NL but require constrained output format. Annotation-based extraction sidesteps LLM generation entirely — deterministic extraction from code.

---

*Feature research for: QGSD v0.16 — Formal Plan Verification (6 new features)*
*Researched: 2026-02-26*
