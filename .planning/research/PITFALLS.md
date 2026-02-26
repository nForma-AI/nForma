# Domain Pitfalls: v0.16 Formal Plan Verification

**Domain:** Adding formal plan verification to an existing AI planning workflow (QGSD)
**Researched:** 2026-02-26
**Confidence:** HIGH — sources include VeriPlan CHI 2025 paper (arxiv 2502.17898), "Bridging LLM Planning Agents and Formal Methods" (arxiv 2510.03469), Loop Invariant Hybrid Framework (arxiv 2508.00419), MAD conformity research (ACL 2025), direct inspection of QGSD FV pipeline (bin/generate-formal-specs.cjs, bin/run-formal-verify.cjs, formal/tla/, formal/alloy/, formal/prism/), and existing v0.12 PITFALLS.md

> **Scope:** These pitfalls cover v0.16's five new features: (1) plan-to-spec extraction, (2) iterative verification loop, (3) mind map generation, (4) code annotation extraction pipeline, (5) formal evidence injection into multi-model quorum. They complement (not replace) the v0.12 PITFALLS.md, which covers the base FV pipeline. Both files apply to v0.16.

---

## Critical Pitfalls

### Pitfall 1: False Positive Verification — The Spec Passes But Does Not Capture Plan Intent

**What goes wrong:**
Claude extracts a TLA+/Alloy/PRISM spec fragment from PLAN.md. TLC runs successfully and reports no violations. The plan proceeds to quorum. But the generated spec was incomplete — it modeled only the easy-to-express parts of the plan (state names, transition counts) and silently omitted the hard semantic constraints (ordering invariants, conditional dependencies, mutual exclusion requirements). Quorum and the user are told "formally verified" when in reality only a partial skeleton was verified.

This is the dominant real-world failure mode in LLM-to-spec translation, documented directly in "Bridging LLM Planning Agents and Formal Methods" (arxiv 2510.03469): "GPT-5 produced models that passed verification but did not fully capture the intent of the original plan." GPT-4o achieved only 52.06% accuracy with a 34.61% unknown rate.

**Why it happens:**
LLMs extract the syntactically simple parts of a plan (phases, task names, dependencies that look like DAG edges) and skip the semantically complex parts (conditional execution, resource constraints, timing invariants). The extracted spec is syntactically valid and small — TLC verifies it quickly because there is little to check. Nothing in the pipeline warns that the spec is incomplete relative to the plan.

**Consequences:**
Quorum votes with "mathematically verified" confidence attached to an incomplete proof. Real plan defects (ordering violations, missing preconditions) reach execution undetected. The verification adds false confidence without improving actual plan quality.

**Prevention:**
Implement a coverage check: after spec extraction, run a prompt asking Claude to list every task dependency, ordering constraint, and conditional branch in PLAN.md, then verify that each appears as an explicit invariant or transition constraint in the extracted spec. Any PLAN.md element with no corresponding spec element must be flagged as `unmodeled_coverage_gap`. The verification summary injected into quorum must include the gap list, not just the pass/fail result.

**Detection:**
- Extracted spec has fewer invariants than the PLAN.md has explicit dependency or ordering statements
- PLAN.md contains "if X then Y" language but extracted spec has no conditional transition
- Spec verification runs in under 3 seconds for a plan with 15+ tasks (almost certainly underconstrained)
- Verification summary says "PASS" with zero invariants listed

**Phase to address:** Plan-to-spec extraction phase (v0.16-01 or whichever phase implements PLAN.md → spec fragment). Coverage check must be a required output of the extraction step, not an afterthought.

---

### Pitfall 2: Iterative Verification Loop Oscillation — The Loop Never Converges

**What goes wrong:**
Claude enters the iterative verification loop: extract spec → run TLC/Alloy → get counterexample → ask Claude to fix PLAN.md or the spec → extract again → repeat. The loop hits the configurable cap (say, 5 iterations) without converging. But the cap exhaustion is not meaningfully communicated to quorum — instead the plan is marked "verification inconclusive" and proceeds. Quorum does not understand what the failure means, and approves anyway.

A second failure mode: the loop oscillates. Claude fixes one TLC counterexample in iteration 2, but the fix introduces a new violation caught in iteration 3. The fix in iteration 3 re-introduces the violation from iteration 1. The loop alternates between two broken states until the cap is hit. This mirrors the exact oscillation pattern QGSD's circuit breaker was built to detect in git history.

**Why it happens:**
Counterexample-guided refinement with LLMs does not guarantee monotonic progress. Each fix is a local perturbation — it repairs the specific violated path but may break a different path. The "4/δ Bound" research (arxiv 2512.02080) shows that iterative LLM-verifier loops require approximately 4/δ steps where δ is the probability of making a net-forward step. With δ < 0.5 (common for complex specs), the loop exceeds reasonable bounds. VeriPlan found that three iterations was the practical limit before user intervention was required.

**Consequences:**
Either the loop wastes context window (every iteration consumes significant token budget) and exits with an unconverged plan, or it silently passes an unverified plan to quorum because the exit condition is not strict enough.

**Prevention:**

1. **Strict convergence signal:** The iterative loop must track whether each iteration reduces the number of spec violations. If violations increase or stay equal across two consecutive iterations, declare oscillation — stop the loop immediately. Do not continue to the cap.

2. **Hard cap with clear escalation:** The cap (configurable, default 5) must produce a hard escalation path. If cap is hit: do not proceed to quorum automatically. Present the user with the last-best plan iteration, the remaining counterexample(s), and the specific spec elements that failed. Require explicit user override to proceed.

3. **Partial progress reporting:** Each iteration's pass/fail rate (number of satisfied invariants vs. total) must be tracked. Even if the loop fails to converge, a plan that satisfies 8/10 invariants after the loop is better characterized than one that satisfies 3/10.

4. **Deduplicate counterexamples:** Before re-running TLC, check whether the current counterexample is identical (same violated trace) to a previous iteration's counterexample. If identical, the fix failed — force a different repair strategy or escalate.

**Detection:**
- TLC counterexample in iteration N is identical to iteration N-2
- Iteration N satisfies fewer invariants than iteration N-1
- Loop exits at cap with no improvement between last two iterations
- No per-iteration progress metric in verification summary

**Phase to address:** Iterative verification loop phase. The convergence signal and oscillation detection must be defined before the first loop implementation. The cap escalation path must be tested explicitly.

---

### Pitfall 3: LLM Counterexample Misinterpretation — Fixes Address Syntax Not Semantics

**What goes wrong:**
TLC or Alloy generates a counterexample — a specific violating trace or counterexample instance. Claude receives this as a block of TLA+ state sequences or Alloy instance output. Claude's fix addresses the surface-level error in the spec (changing a variable name, adjusting an invariant's arithmetic expression) rather than identifying the underlying plan defect the counterexample is pointing at. The spec is patched to pass the counterexample check without the actual plan being changed.

This is documented in the Loop Invariant Framework research (arxiv 2508.00419): LLMs "often focus on syntactic fixes and may introduce subtle bugs due to their statistical nature and lack of formal guarantees." The feedback loop architecture assumed LLMs understand counterexample semantics, but they frequently perform pattern matching on the error message format instead.

**Why it happens:**
TLC counterexamples are expressed in TLA+ state notation, which is not the same language as PLAN.md. Claude is asked to translate a violation in the spec language back to a defect in the plan language — a bidirectional translation without a formal bridge. The easier move is to locally patch the spec rather than reason about the underlying planning intent.

**Consequences:**
The plan reaches quorum with a verified spec that has been "debugged" rather than a plan that was genuinely corrected. The spec and plan diverge: the spec satisfies TLC, but the plan may still contain the original defect. The code that gets executed will implement the plan, not the spec.

**Prevention:**

Separate the counterexample interpretation step from the fix step using a two-pass prompt:

- Pass 1 prompt: "Here is the TLC counterexample. Translate it to a natural language description of what plan behavior it shows is problematic. Do not propose a fix yet."
- Pass 2 prompt: "Here is the plan behavior identified as problematic: [Pass 1 output]. Now propose a specific change to PLAN.md that addresses this behavior. Identify the exact task, dependency, or ordering statement that must change."

Both passes must be in the verification summary injected into quorum. Quorum sees both the machine-readable violation AND the natural language interpretation, enabling slot workers to detect misinterpretations.

**Detection:**
- Spec changes between iterations with no corresponding change to PLAN.md
- Iterations only modify TLA+ invariant bounds (e.g., changing `N >= 2` to `N >= 1`) without touching the underlying predicate logic
- Pass 1 and Pass 2 outputs are inconsistent (proposed fix does not address stated problem)

**Phase to address:** Iterative verification loop phase. Two-pass counterexample interpretation must be the default pattern, not an optimization. Single-pass is prohibited for plan-affecting counterexamples.

---

### Pitfall 4: Overconstrained Spec Blocks All Valid Plans

**What goes wrong:**
Claude extracts a spec from PLAN.md that includes every mentioned constraint — including soft preferences stated as hard invariants. ("Task B should run after task A" becomes `A_COMPLETED \in past_states` as a required invariant rather than a recommended ordering.) TLC finds that no valid execution trace exists — the spec is unsatisfiable. The iterative loop cannot produce a passing plan because the constraints are contradictory, yet the loop runs to cap without detecting unsatisfiability.

The inverse also occurs: underconstrained specs (Pitfall 1) pass trivially. Overconstrained specs reject everything. Both failures are indistinguishable from each other without explicit diagnostic output.

**Why it happens:**
PLAN.md uses natural language that expresses both hard requirements and soft preferences with identical syntactic structure ("X must happen before Y" and "ideally X happens before Y" are both natural language ordering statements). The LLM spec extractor does not have a reliable way to distinguish mandatory from advisory constraints from natural language alone, and errs toward inclusion (treating everything as hard constraints) to avoid Pitfall 1.

**Consequences:**
Every plan PLAN.md generates will fail TLC. The iterative loop always hits the cap. Quorum never sees a verified plan. The feature appears broken. If the unsatisfiability is not clearly diagnosed, Claude will waste all iterations attempting local repairs that cannot succeed.

**Prevention:**

1. **Explicit constraint tier extraction:** The spec extraction prompt must classify each extracted constraint as HARD (invariant — must hold in all traces) or SOFT (preference — verified as liveness, not safety). PLAN.md language triggers:
   - "must", "required", "shall" → HARD invariant
   - "should", "ideally", "prefer" → SOFT liveness property
   - Default (ambiguous language) → SOFT, not HARD

2. **Satisfiability pre-check:** Before running the full TLC model check, run a brief Alloy `run {}` with no constraints to verify the state space is non-empty. An empty state space with no constraints means the hard invariants are contradictory. Diagnose and report this immediately rather than running TLC iterations.

3. **Constraint count ratio check:** If the extracted spec has more hard invariants than tasks in the plan, flag for manual review. A 20-task plan with 25+ hard invariants is almost certainly overconstrained.

**Detection:**
- TLC reports "No initial states" or "Invariant violated in initial state"
- Alloy `run {}` with no predicates returns "No instance found"
- Spec has more `Invariant` declarations than the plan has tasks
- All loop iterations fail at the same TLC check (same invariant, different trace)

**Phase to address:** Plan-to-spec extraction phase. Constraint tier extraction (HARD vs. SOFT) and satisfiability pre-check must be part of the extraction output before any TLC run.

---

### Pitfall 5: Mermaid Syntax Failures Silently Corrupt Mind Map Injection

**What goes wrong:**
Claude generates a Mermaid mind map from PLAN.md. The generated Mermaid has a syntax error — special characters in task names (parentheses, quotes, colons, brackets), node labels exceeding line length limits, or nesting depth violations. The `mindmap` block in MINDMAP.md silently produces no rendered output. When injected into quorum slot-worker prompts, the slot workers receive a broken diagram block rather than a structured visualization. Since no tool validates Mermaid syntax before injection, the workers see garbage — but no error is surfaced.

This is a documented and active problem in the LLM-Mermaid ecosystem: "It's not uncommon for LLMs to generate invalid Mermaid syntax" (GenAIScript documentation, 2025). Roo Code issue tracker and LMStudio both document Mermaid rendering failures from LLM output with no warning.

**Why it happens:**
PLAN.md task names are written by Claude during plan generation and often contain characters that Mermaid requires escaping: colons (`:`) break label parsing, forward slashes interfere with path notation, and parentheses are special in some Mermaid diagram types. The `mindmap` diagram type is particularly restrictive about indentation (spaces, not tabs) and line length. Claude generates valid-looking Mermaid that fails at render time.

**Consequences:**
Slot workers receive an injected context block that says `formal_spec_summary: [valid]` but shows a broken diagram under `mindmap`. Workers cannot visually process the plan structure. The mind map feature provides no benefit to quorum while consuming context tokens.

**Prevention:**

1. **Post-generation syntax validation:** After generating the Mermaid block, pass it through `mermaid.parse()` (available via the `mermaid` npm package's parser, or the `@mermaid-js/mermaid-zenuml` parser for CI). Any parse error triggers a repair prompt immediately — not a full regeneration, just the specific broken node.

2. **Character sanitization before generation:** Before generating the mind map prompt, sanitize PLAN.md task names: replace `:` with `-`, strip parentheses, truncate labels to 40 characters. Pass the sanitized task list to the generation prompt, not the raw PLAN.md text.

3. **Fallback plain text:** If Mermaid validation fails after one repair attempt, inject a plain-text bullet-point outline instead of a broken Mermaid block. The slot-worker context must indicate which format was used: `mindmap_format: mermaid | plaintext`.

4. **CI validation gate:** Add a CI test that generates the mind map from a sample PLAN.md and passes it through the Mermaid parser. If this fails, the mind map generation step has regressed.

**Detection:**
- Mermaid block renders as raw text (no diagram) in GitHub or Claude Code markdown preview
- Slot-worker quorum prompts contain unclosed brackets or mismatched indentation in the mindmap block
- `mermaid.parse()` throws on the generated output
- Task names in MINDMAP.md contain colons or parentheses from PLAN.md

**Phase to address:** Mind map generation phase. Validation and character sanitization must be implemented before the first quorum injection integration test.

---

### Pitfall 6: Annotation Extraction Brittleness — @invariant Tags Drift From Runtime Behavior

**What goes wrong:**
The code-as-source-of-truth pipeline extracts `@invariant`, `@transition`, and `@probability` JSDoc annotations from QGSD source files. These annotations are written by the developer alongside the code they describe. Over time, the code changes and the annotation becomes stale — but no enforcement mechanism exists to detect the drift. The spec extracted from annotations describes the old behavior. TLC runs against the old spec and passes. The running code violates the invariant.

This is the general spec drift problem applied to annotation-based extraction. The Pact community's 2025 update and the Spec-Driven Development ecosystem both document "provider drift" as the primary cause of spec-to-implementation divergence: "specs describing system behavior diverge from actual implementation as systems evolve."

For QGSD specifically: `bin/generate-formal-specs.cjs` already reads the XState machine via regex pattern matching (lines 41-54). Adding another extraction layer (JSDoc annotations) doubles the regex surface area. Each regex pattern is a potential breakage point when the code refactors variable names or restructures function bodies.

**Why it happens:**

1. JSDoc `@invariant` is not a standard tag. JSDoc parsers silently drop unknown tags unless configured with custom plugin parsers. If the parser configuration changes or the plugin version updates, extraction silently fails — returning zero annotations without error.

2. Annotations are written as documentation comments, not enforced contracts. Developers refactor the function body without updating the JSDoc. The annotation describes historical intent.

3. The AST walk used for extraction (QGSD already uses esbuild + `require()` for spec sync drift detection in `check-spec-sync.cjs`) is tied to specific esbuild parse behavior. Breaking changes in esbuild's AST node structure silently corrupt extraction output.

**Consequences:**
The code annotation pipeline generates specs that describe code that no longer exists. TLC passes against a stale spec. The "code as source of truth" claim becomes false — the annotations are the source of truth, and they have drifted from the code.

**Prevention:**

1. **Annotation co-location with enforcement:** Every `@invariant` annotation must reference a specific function or variable by name. The extractor must verify that the named entity exists in the current AST. If it does not, fail loudly: "Annotation references `checkMinQuorum` but no function with that name exists in this file."

2. **Round-trip test:** The annotation extraction pipeline must include a round-trip test: extract annotations from source → generate spec → verify that the spec's invariants are satisfiable given the actual current code path. This is distinct from verifying the spec abstractly.

3. **Annotation staleness heuristic:** If the annotated function's last-modified timestamp in git is newer than the annotation's last-modified timestamp (checked via `git log -n 1 --format=%at -- <file>`), flag the annotation as potentially stale.

4. **Pin parser versions:** The esbuild version and JSDoc parser version used for extraction must be pinned in `package.json` with exact version locks. Do not use `^` ranges for these tools.

**Detection:**
- `@invariant` annotates a function that has been renamed or moved
- Extracted invariant count drops between runs without any annotation file being touched
- Spec generated from annotations differs from spec generated from the XState machine for the same behavior
- esbuild AST walk returns an empty annotation list after a minor esbuild update

**Phase to address:** Code annotation extraction phase. The entity-name verification and round-trip test must be implemented before any annotations are added to source files.

---

### Pitfall 7: Formal Evidence Injection Causes Quorum Anchoring and Sycophantic Convergence

**What goes wrong:**
Quorum slot workers receive `formal_spec_summary: PASS (8/10 invariants satisfied)` and `verification_result: VERIFIED` in their prompt context. The statistical evidence creates an anchoring effect: slot workers that would otherwise BLOCK on a plan weakness instead default to APPROVE because the formal context signals correctness. The multi-model consensus that was supposed to provide independent judgment instead anchors to the verification result.

This is documented in 2025 MAD research: "When LLMs provided formal information directly in the chat answer, the anchoring bias was almost completely eliminated [for humans]" — but for LLM agents, the reverse may occur. Research on multi-agent debate (ACL 2025, "Voting or Consensus?") found that "extended deliberation causes confidence to increase while accuracy decreases, with sycophancy through exhaustion causing contrarians to capitulate." Injecting pre-computed evidence that signals correctness accelerates this pattern.

The second failure mode: if the spec verification passes but the spec was incomplete (Pitfall 1), the formal evidence injection launders the false confidence through every slot worker. All workers see "VERIFIED" and none independently detect that the spec was too weak.

**Why it happens:**
Quorum slot workers are LLMs. LLMs are susceptible to the same anchoring biases as humans when presented with authoritative-looking numerical or formal results. A TLC output block with "No violations found" and state count statistics looks authoritative even when the underlying spec is incomplete.

**Consequences:**
The quorum's value as an independent check on plan quality is degraded. Slot workers vote APPROVE on plans they would have blocked before formal evidence injection. BLOCK rates drop; the scoreboard shows a higher TP rate (slot workers approve and consensus approves) but this is actually a quality regression hidden behind the verification theater.

**Prevention:**

1. **Adversarial injection framing:** The formal context injected into slot workers must be framed explicitly as limited evidence, not proof: "Formal verification passed for the extracted spec fragment. Note: the spec covers X of Y plan elements. Elements not covered by the spec: [list]. Evaluate whether these uncovered elements contain risks the spec cannot detect."

2. **Independent plan review prompt:** Separate the formal evidence from the plan review in the slot-worker prompt. Slot workers must first analyze the PLAN.md directly (without seeing verification results), record their preliminary vote, and only then receive the formal evidence context. This prevents first-impression anchoring.

3. **Coverage gap mandatory review:** Any spec with a coverage gap list (Pitfall 1 prevention) must include coverage gaps prominently before the PASS/FAIL verdict in the injected context. Slot workers must be prompted to evaluate the gaps explicitly.

4. **Monitor BLOCK rate:** Track BLOCK rates before and after injecting formal evidence. A sustained drop in BLOCK rate after enabling formal injection is a signal of anchoring effect, not genuine quality improvement.

**Detection:**
- BLOCK rate drops by >30% after enabling formal evidence injection, without a corresponding increase in plan quality signals
- Slot workers cite "VERIFIED" as their primary reason for APPROVE votes rather than substantive plan analysis
- Workers do not mention coverage gaps in their vote rationale when coverage gaps are present
- All workers APPROVE a plan with known gaps after seeing VERIFIED status

**Phase to address:** Quorum formal context injection phase. Adversarial framing and pre-injection preliminary vote must be designed before the first quorum integration test.

---

## Moderate Pitfalls

### Pitfall 8: Plan-Level State Space Explosion from Fine-Grained Task Modeling

**What goes wrong:**
The plan-to-spec pipeline models each PLAN.md task as a TLA+ state. A complex phase plan with 15 tasks, 3 parallel branches, and 4 conditional paths produces a TLA+ state space with millions of reachable states. TLC cannot complete the model check within CI timeout bounds. The iterative verification loop stalls at iteration 1 waiting for TLC.

**Why it happens:**
Plan-level specs are naturally fine-grained — every task is an action. Unlike QGSD's existing system-level specs (which model abstract quorum rounds, not individual slot calls), plan specs model implementation steps. The state space grows exponentially with task parallelism.

**Prevention:**
Apply two constraints at extraction time:

1. **Abstraction level:** Plan specs model task categories (sequential group, parallel group, conditional branch, checkpoint) not individual tasks. A group of 5 sequential tasks is one TLA+ state, not 5. This matches TLA+'s intended use for high-level specification.

2. **Bounded model constants:** The TLC model config generated for plan specs must use tight bounds: max 2 parallel branches checked, max 3 conditional paths. Document these bounds explicitly in the verification summary so quorum knows the scope.

**Detection:**
- TLC does not complete after 5 minutes on a 15-task plan
- State count in TLC output exceeds 500,000 for a single plan verification
- Extracted spec has more `Action` definitions than the plan has tasks

**Phase to address:** Plan-to-spec extraction phase and iterative verification loop phase.

---

### Pitfall 9: Mind Map Node Explosion Degrades Quorum Context Quality

**What goes wrong:**
A complex PLAN.md with 20 tasks and multiple nested sub-tasks generates a Mermaid mind map with 40+ nodes. When injected into slot-worker prompts, the mind map consumes 600-800 tokens of the context window. Slot workers with smaller effective context windows (or context already consumed by prior conversation) process a truncated mind map — missing the most important structural nodes.

**Why it happens:**
Mermaid mind maps have no built-in pagination. The full PLAN.md is mapped 1:1 to nodes. For large plans, the diagram is as long as the original plan but less readable (hierarchical indentation is harder to parse than prose).

**Prevention:**

1. **Two-level summary mindmap:** Generate a summary mind map showing only top-level phases and their direct children (max 2 levels deep, max 15 nodes total). Link to a separate detailed MINDMAP.md for full depth. Inject only the summary into slot-worker prompts.

2. **Token budget guard:** Before injecting, count the approximate token length of the Mermaid block. If it exceeds 500 tokens, use the plaintext fallback (Pitfall 5 prevention). Annotate the quorum prompt: `mindmap: truncated (>500 tokens) — see .planning/phases/<phase>/MINDMAP.md for full diagram`.

**Phase to address:** Mind map generation phase and quorum injection phase.

---

### Pitfall 10: @probability Annotations Conflict With PRISM's Scoreboard-Derived Rates

**What goes wrong:**
The code annotation pipeline extracts `@probability` tags and injects them into PRISM `.pm` files. QGSD already derives PRISM transition probabilities from the quorum scoreboard via `readScoreboardRates()` in `run-prism.cjs`. If both sources provide a probability for the same transition, there is no defined precedence rule — one silently overwrites the other depending on execution order.

**Why it happens:**
The scoreboard-derived probability and the annotation-specified probability may have different intended meanings: scoreboard rates reflect historical observed behavior; annotation rates may reflect theoretical design-time expectations. Neither is wrong, but they conflict.

**Prevention:**
Define explicit precedence in the extraction pipeline: annotation-specified `@probability` takes precedence over scoreboard-derived rates for the specific transition it annotates. The PRISM `.pm` file header must document every transition's probability source: `(annotation)` or `(scoreboard: n=42)`. Mismatches between annotation probability and scoreboard-observed rate exceeding 0.15 must generate a warning in the extraction output.

**Phase to address:** Code annotation extraction phase.

---

### Pitfall 11: Spec Fragment File Management — Stale Fragments From Previous Iterations

**What goes wrong:**
The iterative verification loop writes spec fragments to `.planning/phases/<phase>/formal/`. Each iteration may generate a new fragment. If the loop exits early (convergence, cap hit, or error), stale intermediate fragments from failed iterations remain on disk. The next PLAN.md edit triggers a new extraction, but the pipeline reads the stale fragment from the previous run instead of regenerating.

**Why it happens:**
The fragment directory accumulates files across multiple extraction runs without a cleanup protocol. The extraction step checks for existing fragments and skips regeneration if they are present — a performance optimization that becomes a correctness bug.

**Prevention:**
The extraction step must always regenerate spec fragments at the start of each verification loop run. Never read cached fragments as input for TLC. The directory `.planning/phases/<phase>/formal/` must be cleared at the start of each loop iteration (not each run — just the start of a new loop triggered by PLAN.md modification). Add a `generated_at` timestamp to every fragment and reject fragments older than the PLAN.md modification time.

**Phase to address:** Plan-to-spec extraction phase. Cache invalidation must be defined before the fragment generation logic.

---

### Pitfall 12: Context Window Budget Exhaustion From Cumulative Verification Context

**What goes wrong:**
Each iteration of the verification loop adds to the conversation context: the original plan, the extracted spec, the TLC output, the counterexample interpretation, the proposed fix, the revised plan. By iteration 3, the cumulative verification context may consume 30-40% of the available context window. This leaves insufficient space for quorum round context, the mind map, and the actual slot-worker reasoning. Slot workers receive truncated prompts and provide lower quality votes.

**Why it happens:**
The verification loop was designed as a separate pre-quorum step, but its output is injected into the same context window that quorum uses. The QGSD context monitor hook (v0.9-01) tracks total context usage, but does not specifically track the verification context footprint.

**Prevention:**
Define a verification context budget: the total content injected from the verification loop (spec fragment summary, TLC result, counterexample, coverage gaps) must not exceed 15% of the context window. Enforce this at the injection point. If the verification output exceeds budget, use a summary form: iteration count, final invariant pass rate, top-3 coverage gaps, final verdict — no raw TLC output, no spec text.

**Phase to address:** Quorum formal context injection phase. Budget enforcement must be integrated with the existing context monitor hook.

---

## Minor Pitfalls

### Pitfall 13: Generated Spec File Overwrites Hand-Authored Spec

**What goes wrong:**
The plan-to-spec pipeline generates a spec fragment and writes it to a path in `formal/tla/` or `formal/alloy/`. If the path naming convention is not carefully scoped to the phase directory, the generated file can overwrite an existing hand-authored system-level spec. QGSD already has this pitfall in its history: "xstate-to-tla.cjs writes to QGSDQuorum_xstate.tla, never clobbering hand-authored canonical spec" was resolved in v0.14 (BROKEN-01).

**Prevention:**
Plan-level spec fragments must be written exclusively to `.planning/phases/<phase>/formal/` — never to `formal/tla/`, `formal/alloy/`, or `formal/prism/` at the repo root. Those root directories contain hand-authored or machine-generated system-level specs that represent the QGSD state machine, not plan execution logic. Add a guard in the extraction script that explicitly rejects any output path not under `.planning/`.

**Phase to address:** Plan-to-spec extraction phase.

---

### Pitfall 14: Quorum Round Scoreboard Inflation From Verification-Influenced Votes

**What goes wrong:**
When slot workers see formal verification results (VERIFIED) before voting, their APPROVE votes are counted as TP+ or TP in the scoreboard — correctly per the schema. But the scoreboard's TP rates now reflect verification-anchored votes, not independent evaluation. Future PRISM models derived from the scoreboard (`readScoreboardRates()`) inherit inflated consensus probabilities, producing over-optimistic probabilistic models.

**Prevention:**
Add a `formal_evidence_present` boolean to the scoreboard round metadata. Track TP rates separately for rounds with and without formal evidence injection. The PRISM model generator must use only rounds where `formal_evidence_present: false` for baseline probability estimation, unless explicitly configured otherwise.

**Phase to address:** Quorum formal context injection phase and scoreboard update protocol.

---

### Pitfall 15: Mind Map Injection Order Affects First-Impression Bias

**What goes wrong:**
The mind map is injected at the top of the quorum slot-worker prompt (before the plan text). Workers process the visual hierarchy of the mind map before reading the plan prose. If the mind map misrepresents the plan structure (common after sanitization and node collapsing), workers form an incorrect mental model before encountering the actual plan details. This is a presentation-order bias in multi-agent debate, related to anchoring effects (Pitfall 7).

**Prevention:**
Inject the mind map after the plan text and after the initial analysis request: "Review the plan. [PLAN.md]. Now consider this structural overview: [MINDMAP]. Does the structural overview match your understanding of the plan?" This makes the mind map a check on the worker's prior reading, not a pre-framing of it.

**Phase to address:** Quorum formal context injection phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Plan-to-spec extraction | Pitfall 1 (incomplete spec), Pitfall 4 (overconstrained), Pitfall 11 (stale fragments), Pitfall 13 (path collision) | Coverage check, HARD/SOFT tier extraction, cache invalidation, path guard — all must be in phase 1 |
| Iterative verification loop | Pitfall 2 (oscillation), Pitfall 3 (counterexample misinterpretation), Pitfall 8 (state space explosion) | Convergence signal, two-pass interpretation, bounded model constants — define before first loop |
| Mind map generation | Pitfall 5 (Mermaid syntax), Pitfall 9 (node explosion) | Syntax validation, character sanitization, token budget cap, 2-level summary |
| Code annotation extraction | Pitfall 6 (annotation drift), Pitfall 10 (@probability conflict), Pitfall 14 (scoreboard inflation) | Entity-name verification, round-trip test, explicit precedence rule, separate scoreboard tracking |
| Quorum formal context injection | Pitfall 7 (anchoring bias), Pitfall 12 (context budget), Pitfall 14 (scoreboard inflation), Pitfall 15 (injection order) | Adversarial framing, preliminary vote before evidence, budget enforcement, post-plan injection order |

---

## Integration-Specific Pitfalls With Existing QGSD Pipeline

These pitfalls arise specifically from v0.16 interacting with existing QGSD infrastructure.

### Integration Pitfall A: Verification Loop Triggers Circuit Breaker False Positive

**What goes wrong:**
The iterative verification loop may cause Claude to make multiple sequential file modifications to PLAN.md as it revises the plan through iterations. If the same PLAN.md is modified and re-modified across 3+ iterations, the circuit breaker's run-collapse algorithm may detect it as oscillation and fire — halting all Bash execution mid-loop.

**Why it happens:**
The circuit breaker analyzes git commit history for repeated modifications to the same file set. Plan revision in the verification loop modifies PLAN.md repeatedly in quick succession. The breaker sees alternating commit groups on PLAN.md and fires.

**Prevention:**
The iterative verification loop must not commit PLAN.md changes to git between iterations — it should work in-memory or in a staging file (e.g., `PLAN.md.next`) and only commit the final converged plan. If the loop needs git checkpointing for resumability, use a dedicated branch or a separate staging directory that the circuit breaker's file-set detection excludes.

**Phase to address:** Iterative verification loop phase.

---

### Integration Pitfall B: TLC Runner Timeout Blocks Quorum Round

**What goes wrong:**
The plan-to-spec pipeline is designed to run pre-quorum: Claude verifies the plan, then presents the result to quorum. If TLC takes longer than expected (state space explosion, complex plan), the pre-quorum step blocks the entire quorum round. Claude is waiting for TLC while slot workers time out on their end.

**Why it happens:**
TLC runs as a synchronous subprocess (`spawnSync` in `run-tlc.cjs`). The existing FV pipeline uses `continue-on-error: true` in CI to avoid blocking. But the pre-quorum verification loop does not have an equivalent timeout guard — it is expected to complete before quorum dispatch.

**Prevention:**
The pre-quorum TLC run must have an explicit timeout (configurable, default 60 seconds). If TLC does not complete within the timeout, the verification result is `INCONCLUSIVE (timeout)` — not FAIL, not PASS. The quorum prompt must include the timeout signal prominently. Quorum can then vote on the plan with the knowledge that verification was inconclusive rather than failing to proceed.

**Phase to address:** Iterative verification loop phase and quorum injection phase.

---

### Integration Pitfall C: Spec Fragment Naming Collision With Existing FV Pipeline

**What goes wrong:**
The existing `run-formal-verify.cjs` discovers and runs all spec files it knows about. If a plan-generated spec fragment uses a name that matches a pattern the runner recognizes (e.g., `MC*.cfg`, `*.als`), the runner may attempt to include the plan-level spec in the next full FV run — mixing plan-level constraints with system-level specs. This could cause system-level TLC to fail because plan-level invariants do not apply to the system machine.

**Why it happens:**
The existing pipeline is designed around a fixed set of known spec files. The plan-to-spec pipeline adds dynamic files. No exclusion mechanism exists for plan-generated files in the existing runner.

**Prevention:**
Plan-level spec fragments must use a clearly distinct naming convention: `PLAN-<phase>-<iteration>.tla` and must live exclusively under `.planning/phases/<phase>/formal/`. The existing `run-formal-verify.cjs` STEPS array is a hardcoded list — plan-generated specs are not in it and will not be accidentally included. But if the runner is ever made dynamic (glob-based discovery), add an explicit exclusion pattern for `.planning/phases/` content.

**Phase to address:** Plan-to-spec extraction phase. Name the fragments with the PLAN- prefix from the start.

---

### Integration Pitfall D: Quorum Scoreboard Update Race With Verification Scoreboard Metadata

**What goes wrong:**
The quorum scoreboard update protocol (`update-scoreboard.cjs` with atomic tmpPath + renameSync) is designed for parallel wave workers. The formal evidence injection adds new metadata fields to the round record (`formal_evidence_present`, `spec_coverage_rate`). If the scoreboard update and the metadata write are not atomic, a parallel wave worker may write a round record without the formal evidence metadata — producing an incomplete record that the PRISM rate calculator treats as a non-evidence round.

**Prevention:**
All new scoreboard metadata fields from the verification pipeline must be included in the initial `merge-wave` call payload, not written in a separate post-update step. The round record structure must be extended to include formal evidence fields before the first quorum round runs with formal injection enabled.

**Phase to address:** Quorum formal context injection phase.

---

## "Looks Done But Isn't" Checklist for v0.16

- [ ] **Plan-to-spec extraction:** Spec fragment exists and TLC passes, but coverage check output was not generated — verify that coverage_gaps list appears in the verification summary file alongside the PASS verdict.
- [ ] **Iterative loop:** Loop runs to cap on a deliberately over-constrained plan without escalating to user — verify that cap exhaustion triggers an explicit escalation prompt, not a silent pass.
- [ ] **Counterexample interpretation:** Iteration 2 and 3 fix different TLA+ invariant bounds without changing PLAN.md — verify that every iteration with a spec-only change without a plan change triggers a warning flag.
- [ ] **Mermaid mind map:** MINDMAP.md renders locally in developer's markdown viewer but contains colons in node labels — verify `mermaid.parse()` is called on generated output in the pipeline, not just visual inspection.
- [ ] **Annotation extraction:** `@invariant` annotations extract successfully on current source, but no round-trip test exists — verify that the generated spec invariant is satisfiable when given the actual current function's code behavior.
- [ ] **Formal evidence injection:** Slot workers cite "VERIFIED" without mentioning coverage gaps that are present — verify that coverage gaps appear before the PASS verdict in slot-worker prompt context, and monitor for BLOCK rate changes after enabling injection.
- [ ] **Context budget:** Verification output injected into quorum prompts includes raw TLC output exceeding 500 tokens — verify that budget enforcement truncates to summary form before injection.
- [ ] **Circuit breaker interaction:** PLAN.md is committed between each verification iteration — verify that the iterative loop uses in-memory or staging-file approach without intermediate git commits.
- [ ] **TLC timeout:** TLC subprocess has no timeout in pre-quorum verification run — verify that `INCONCLUSIVE (timeout)` result is handled and propagated to quorum prompt.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| False-positive spec (Pitfall 1) | MEDIUM | Rerun extraction with coverage check enabled; add explicit invariant for each uncovered plan element; re-verify |
| Loop oscillation (Pitfall 2) | LOW | Add convergence tracking before loop restart; configure lower cap (3); enable deduplicate-counterexample check |
| Counterexample misinterpretation (Pitfall 3) | LOW | Switch to two-pass interpretation prompt; re-run failed iteration(s) with new prompt structure |
| Overconstrained spec (Pitfall 4) | LOW | Run Alloy `run {}` satisfiability check; identify contradictory invariant pair; reclassify as SOFT |
| Mermaid syntax failure (Pitfall 5) | LOW | Run sanitization pass on task names; re-generate; if still failing, switch to plaintext fallback |
| Annotation drift (Pitfall 6) | MEDIUM | Run entity-name verification; identify stale annotations; update or remove them; re-extract |
| Anchoring bias detected (Pitfall 7) | MEDIUM | Switch to adversarial framing; implement pre-injection preliminary vote; monitor BLOCK rate over next 10 rounds |
| State space explosion (Pitfall 8) | LOW | Switch to task-category abstraction; reduce model constants to N=3; re-run |
| Circuit breaker false positive (Integration A) | LOW | Switch verification loop to staging-file approach; reset breaker with `npx qgsd --reset-breaker` |
| TLC timeout blocks quorum (Integration B) | LOW | Add timeout flag to TLC subprocess; implement INCONCLUSIVE result handling |

---

## Sources

- [VeriPlan: Integrating Formal Verification and LLMs into End-User Planning](https://arxiv.org/abs/2502.17898) — CHI 2025. Primary source on spec extraction accuracy failures, iterative loop friction, counterexample feedback gaps, multi-model absence issues. HIGH confidence.
- [Bridging LLM Planning Agents and Formal Methods: A Case Study in Plan Verification](https://arxiv.org/html/2510.03469v1) — October 2025. GPT-4o 52% accuracy on formal spec generation; false-positive verification (passes but misses intent); taxonomy of error types. HIGH confidence.
- [Loop Invariant Generation: A Hybrid Framework of Reasoning](https://arxiv.org/html/2508.00419) — August 2025. Counterexample-guided iterative refinement; LLMs focus on syntactic fixes; convergence analysis. HIGH confidence.
- [The 4/δ Bound: Designing Predictable LLM-Verifier](https://arxiv.org/pdf/2512.02080) — December 2025. Convergence theory for LLM-verifier loops; statistical unpredictability of multi-stage AI-formal verification workflows. MEDIUM confidence.
- [Voting or Consensus? Decision-Making in Multi-Agent Debate](https://arxiv.org/html/2502.19130v4) — ACL 2025 Findings. Sycophancy in MAD; anchoring; conformity driving contrarians to capitulate. HIGH confidence.
- [Measuring and Mitigating Identity Bias in Multi-Agent Debate via Anonymization](https://arxiv.org/pdf/2510.07517) — October 2025. Identity-driven sycophancy; conformity vs. obstinacy metrics; anonymization as mitigation. MEDIUM confidence.
- [Genefication: Generative AI + Formal Verification](https://www.mydistributed.systems/2025/01/genefication.html) — January 2025. False confidence from incomplete spec verification; LLM-FM integration workflow design. MEDIUM confidence.
- [Mermaids Unbroken — GenAIScript documentation](https://microsoft.github.io/genaiscript/blog/mermaids/) — Repair pattern for LLM-generated Mermaid; syntax failure frequency documentation. MEDIUM confidence.
- [Roo Code Mermaid chart rendering issues — Issue #4636](https://github.com/RooCodeInc/Roo-Code/issues/4636) — Active 2025 issue documenting LLM Mermaid generation failures in production. MEDIUM confidence.
- [Pact Open Source Update — May 2025](https://docs.pact.io/blog/2025/05/28/pact-open-source-update-may-2025) — Provider drift as primary spec-to-implementation divergence cause in annotation-based pipelines. MEDIUM confidence.
- [Limitations on Formal Verification for AI Safety](https://www.alignmentforum.org/posts/B2bg677TaS4cmDPzL/limitations-on-formal-verification-for-ai-safety) — Incomplete coverage; false confidence from partial specs; overconstrained vs. underconstrained failure modes. MEDIUM confidence.
- Direct inspection of `bin/generate-formal-specs.cjs` — regex-based XState extraction; confirmed pattern matching surface area. HIGH confidence.
- Direct inspection of `bin/run-formal-verify.cjs` — hardcoded STEPS array; confirmed plan-level specs would not accidentally be included in system-level runner. HIGH confidence.
- Direct inspection of `bin/run-prism.cjs` — `readScoreboardRates()` scoreboard-derived probability injection; confirmed conflict potential with annotation-specified `@probability`. HIGH confidence.
- `.planning/PROJECT.md` — v0.16 Formal Plan Verification target features; v0.14 BROKEN-01 xstate-to-tla spec collision resolution; circuit breaker run-collapse algorithm; context monitor hook (v0.9-01). HIGH confidence.
- Existing `.planning/research/PITFALLS.md` (v0.12) — TLA+ state explosion, conformance schema drift, hook stdout contamination, XState ESM, PRISM sparse data, spec granularity mismatch, Alloy overconstrain, JVM dependency, guard incompleteness, hook latency. All remain valid for v0.16 base infrastructure. HIGH confidence.

---
*Pitfalls research for: v0.16 Formal Plan Verification — adding plan-to-spec extraction, iterative verification loop, mind map generation, code annotation extraction, and formal evidence quorum injection to existing QGSD v0.14 FV pipeline*
*Researched: 2026-02-26*
