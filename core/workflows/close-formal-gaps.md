<purpose>
Close formal model coverage gaps. Analyzes which requirements lack formal models,
clusters related requirements into model candidates, selects the appropriate
formalism (TLA+, Alloy, PRISM, Petri), generates the spec, runs the checker,
and updates the model registry. Operates in batch mode (one category at a time)
or targeted mode (specific requirement IDs).
</purpose>

<process>

<step name="detect_gaps">
## Step 1 — Detect Coverage Gaps

Read `.planning/formal/requirements.json` and `.planning/formal/model-registry.json`.
Build the set of covered requirement IDs (from both registry `models` object `requirements` arrays
and requirement-level `formal_models` fields).

**IMPORTANT**: All model entries live under `registry.models` (the nested object).
Do NOT iterate top-level keys of the registry — only `registry.models` contains model entries.
Top-level keys are metadata only: `version`, `last_sync`, `search_dirs`, `models`.

Compute uncovered requirements grouped by category. Display a summary table:

```
Category                     Total  Covered  Gap
─────────────────────────────────────────────────
Hooks & Enforcement            34       19    15
Installer & CLI                33        5    28
...
─────────────────────────────────────────────────
TOTAL                         226       79   147
```

If `--batch` is provided:
- Treat as `--all` if no `--ids`/`--category` is specified
- Skip ALL AskUserQuestion calls throughout the workflow
- Auto-approve proposed clusters in Step 2 without user confirmation
- Log decisions instead of asking for input

When `--batch` is active, do NOT use AskUserQuestion at any point in this workflow.

If `--category` is provided, filter to that category only.
If `--ids` is provided (comma-separated), filter to those specific IDs.
If `--all` is provided, process all uncovered requirements.
Otherwise, present the categories via AskUserQuestion and let the user pick one (unless --batch).
</step>

<step name="cluster_requirements">
## Step 2 — Cluster Requirements into Model Candidates

For the selected uncovered requirements:

1. **Read each requirement's text and background** to understand what it specifies
2. **Read the source code** referenced by the requirement's provenance (if available)
3. **Group requirements** that describe the same subsystem or behavior into clusters
   - Requirements sharing the same ID prefix (e.g., all `DISP-*`) are natural candidates
   - Cross-prefix clusters are allowed when requirements describe the same component

Each cluster becomes one formal model candidate. A cluster should have 2–8 requirements.
Single-requirement models are acceptable when the requirement is self-contained.

Present the proposed clusters to the user for approval:

```
Cluster 1: "Dispatch Pipeline" (5 reqs)
  DISP-01: Slot dispatch uses parallel Task calls
  DISP-02: Direct MCP calls are prohibited
  DISP-03: Timeout enforcement per slot
  DISP-04: Failed slots do not block others
  DISP-05: Results aggregated after all slots complete
  Proposed formalism: TLA+ (state machine with concurrent actors)

Cluster 2: ...
```

If `--batch` is active, auto-approve the proposed clusters as-is. Log:
"[batch] Auto-approving {N} clusters with {M} total requirements"

Otherwise, wait for user approval. User may merge, split, skip, or reorder clusters.
</step>

<step name="select_formalism">
## Step 3 — Select Formalism

For each approved cluster, select the most appropriate formalism based on these heuristics:

| Pattern | Formalism | When |
|---|---|---|
| Sequential state transitions, protocols, lifecycle | **TLA+** | State machines, multi-step workflows, liveness/safety |
| Structural constraints, relationships, configurations | **Alloy** | Data models, configuration validity, structural invariants |
| Probabilistic behavior, availability, reliability | **PRISM** | Timeout probabilities, availability models, SLAs |
| Real-time constraints, timed deadlines, heartbeats | **UPPAAL** | Timeout enforcement, race conditions, timed protocol phases, SLA deadlines |
| Concurrent workflows, resource contention, pipelines | **Petri net** | Pipeline stages, token-based concurrency, producer-consumer, resource pools |

### Formalism Selection Disambiguation

When multiple formalisms could apply, prefer:
- **UPPAAL over TLA+** when the requirement explicitly mentions clock-based timing (ms/s deadlines, timeout enforcement, heartbeat intervals, SLA response times). TLA+ models logical ordering; UPPAAL models real-time clocks.
- **UPPAAL over PRISM** when the requirement asks "will X complete within Y ms?" (reachability under timing) rather than "what is the probability X completes?" (stochastic).
- **Petri net over TLA+** when the requirement focuses on concurrent resource flow (tokens, pipeline stages, pool allocation) rather than protocol state transitions.
- **Petri net over Alloy** when the requirement is about dynamic flow/reachability rather than static structural constraints.

If the user overrides the heuristic via `--formalism=tla|alloy|prism|petri|uppaal`, use that instead.

For each cluster, also determine:
- **File name**: following existing conventions (e.g., `NFDispatch.tla`, `dispatch-pipeline.als`)
- **What to model**: the key state variables, transitions, and properties
- **What properties to verify**: safety invariants, liveness, structural constraints
</step>

<step name="read_existing_models">
## Step 4 — Study Existing Models

Before generating, read 1–2 existing models of the same formalism to learn the project's conventions:

- **TLA+**: Read a `.tla` file from `.planning/formal/tla/` and its corresponding `MC*.cfg`
- **Alloy**: Read a `.als` file from `.planning/formal/alloy/`
- **PRISM**: Read a `.pm` + `.props` pair from `.planning/formal/prism/`
- **UPPAAL**: Read `.planning/formal/uppaal/quorum-races.xml` and its `.q` query file. Note the XML structure with `<nta>`, `<declaration>` (global constants), `<template>` (timed automata), `<system>` (process instantiation), and the `.q` query syntax (`A[] not deadlock`, `E<> location`, etc.).
- **Petri**: Read a `.dot` file from `.planning/formal/petri/`

Note the header format, variable naming, comment style, and property naming conventions.
Follow these conventions exactly in the generated model.
</step>

<step name="generate_model">
## Step 5 — Generate the Formal Model

For each cluster, generate the formal specification:

### TLA+ models
- Create the `.tla` module file with:
  - Header comment listing source files and `@requirement` annotations
  - CONSTANTS, VARIABLES, type invariant (TypeOK)
  - Init and Next state relation
  - Safety invariants (one per requirement where applicable)
  - Temporal properties if the requirement specifies liveness
- Create the corresponding `MC*.cfg` model-checking configuration:
  - SPECIFICATION Spec
  - INVARIANT TypeOK plus safety invariants
  - PROPERTY for temporal properties
  - CONSTANT assignments with small bounds (e.g., MaxSlots = 3)

### Alloy models
- Create the `.als` module file with:
  - Signatures modeling the domain entities
  - Facts encoding structural constraints
  - Assertions (one per requirement)
  - Check commands with appropriate scope (e.g., `check AssertionName for 5`)

### PRISM models
- Create `.pm` (model) and `.props` (properties) files
- Use DTMC or CTMC as appropriate
- Include probability annotations from requirement text or reasonable defaults

### UPPAAL timed automata
- Create a `.xml` file in UPPAAL flat system DTD format:
  - `<nta>` root with `<declaration>` for global constants and channels
  - One `<template>` per concurrent actor/process with:
    - `<declaration>` for local clocks (e.g., `clock x;`)
    - `<location>` elements with `id`, `name`, and optional `<label kind="invariant">` for clock bounds
    - `<init ref="..."/>` pointing to initial location
    - `<transition>` elements with `<source>`, `<target>`, and optional:
      - `<label kind="guard">` for clock guards (e.g., `x >= MIN_MS`)
      - `<label kind="synchronisation">` for channel sync (e.g., `chan!` or `chan?`)
      - `<label kind="assignment">` for variable/clock updates (e.g., `x = 0, count++`)
  - `<system>` block instantiating templates (e.g., `system Worker, Orchestrator;`)
  - Timing constants should be declared as `const int` in `<declaration>` with sensible defaults
  - Use `broadcast chan` for one-to-many signaling, regular `chan` for handshake
  - XML entities: use `&lt;` for `<`, `&gt;` for `>`, `&amp;` for `&` in guard/invariant labels
  - **Concrete escaping example**: A guard like `x < 500` in a `<label kind="guard">` MUST be written as `<label kind="guard">x &lt; 500</label>`. Likewise an invariant `x <= TIMEOUT` becomes `<label kind="invariant">x &lt;= TIMEOUT</label>`. Failing to escape produces malformed XML that verifyta silently rejects.
- Create a corresponding `.q` query file with:
  - Safety queries: `A[] not deadlock`, `A[] (condition)`
  - Reachability queries: `E<> location.State`
  - Bounded liveness: `E<> location.State and clock < BOUND`
  - Each query on its own line, preceded by a `//` comment with `@requirement` annotation
- File naming convention: `<descriptive-name>.xml` and `<descriptive-name>.q` in `.planning/formal/uppaal/`
- Use requirement IDs in XML comments and query file comments: `// @requirement REQ-ID`

### Petri net models
- Create `.dot` file in Graphviz DOT format following bipartite graph convention:
  - Places (circles): represent states/buffers/resource pools — `node [shape=circle]`
  - Transitions (rectangles): represent actions/events — `node [shape=rect, style=filled, fillcolor=black, fontcolor=white]`
  - Arcs: ONLY place->transition or transition->place (bipartite constraint)
  - Use `rankdir=LR` for left-to-right flow
  - Label places with state names, transitions with action descriptions
  - Include token annotations in labels where initial marking matters (e.g., `label="pool\n(3 tokens)"`)
- Optionally create a `.json` companion file with:
  - `places`: array of `{ id, name, initial_tokens }`
  - `transitions`: array of `{ id, name, input_places, output_places }`
  - This enables programmatic reachability analysis beyond visual rendering
- Include `@requirement` annotations in DOT comments: `// @requirement REQ-ID`
- The `@hpcc-js/wasm-graphviz` renderer will auto-render DOT to SVG via run-formal-verify.cjs discovery

**IMPORTANT**: Every generated model MUST include `@requirement` annotations in comments
linking back to the requirement IDs it covers. Format: `\* @requirement REQ-ID` (TLA+/Alloy), `// @requirement REQ-ID` (UPPAAL/Petri/PRISM)
</step>

<step name="run_checker">
## Step 6 — Run the Model Checker

Run the appropriate verification tool:

- **TLA+**: `node bin/run-tlc.cjs MC<ModelName>` — must report `Model checking completed. No error has been found.`
- **Alloy**: `java -jar .planning/formal/alloy/org.alloytools.alloy.dist.jar -c <file.als>` — all assertions must hold
- **PRISM**: `prism .planning/formal/prism/<file.pm> .planning/formal/prism/<file.props>` — all properties verified
- **UPPAAL**: `verifyta <model.xml> <model.q>` — all queries must report "satisfied". If verifyta is not installed (no VERIFYTA_BIN env var), `run-uppaal.cjs` writes a warning to **stderr** (not stdout), sets result to `inconclusive` with triage tag `no-verifyta`, and exits 0 (no crash). The workflow should register the model as pending verification. The verification runner (run-formal-verify.cjs) will discover and attempt to run any `.xml` files in `.planning/formal/uppaal/` automatically; `run-uppaal.cjs` is marked `nonCritical: true` in the step registry so a missing verifyta never fails the overall suite.
- **Petri**: Validate DOT syntax via `dot -Tsvg` (structural check only)

If verification fails:
1. Read the error output carefully
2. Diagnose whether the issue is in the model (fix it) or reveals a genuine specification conflict
3. If model bug: fix and re-run (up to 3 attempts)
4. If spec conflict: report to user — this is valuable formal verification output

If the checker tool is not available (e.g., Java not installed), warn the user
and proceed to registration with a note that verification is pending.
</step>

<step name="update_registry">
## Step 7 — Update Model Registry

For each successfully generated (and ideally verified) model:

1. **Add entry to `.planning/formal/model-registry.json`**:
   ```json
   ".planning/formal/<formalism>/<filename>": {
     "version": 1,
     "last_updated": "<ISO timestamp>",
     "update_source": "generate",
     "source_id": "close-formal-gaps",
     "session_id": null,
     "description": "<one-line description>",
     "requirements": ["REQ-01", "REQ-02", ...]
   }
   ```

2. **Optionally update requirements** with `formal_models` field pointing back to the model path

3. **Recompute `content_hash`** if requirements.json was modified (same SHA-256 envelope lifecycle as add-requirement)
</step>

<step name="summary">
## Step 8 — Summary

Display results:

```
Formal Model Coverage Report
─────────────────────────────────────
Models created:     3
Requirements covered: 12
Verification:       2 passed, 1 pending

New models:
  .planning/formal/tla/NFDispatch.tla        → DISP-01..05  ✓ verified
  .planning/formal/alloy/config-validation.als → CONF-01..04  ✓ verified
  .planning/formal/prism/mcp-health.pm         → HLTH-01..03  ⏳ pending

Coverage: 79/226 → 91/226 (35.0% → 40.3%)
```

If `--all` was used and more categories remain, loop back to Step 2 for the next batch.
</step>

</process>

<constraints>
- NEVER modify existing formal models — only create new ones
- NEVER remove requirements from the registry — only add linkages
- Each model must be self-contained and runnable independently
- Follow existing naming conventions strictly (check `.planning/formal/` directory structure)
- Small model bounds for TLC (state explosion): MaxSlots ≤ 4, MaxDepth ≤ 3, etc.
- If a requirement is purely procedural (e.g., "run this command") and has no formalizable behavior, skip it and note why
- The `@requirement` annotation in model comments is MANDATORY for traceability
</constraints>

<success_criteria>
- [ ] Gap analysis table correctly shows uncovered requirements
- [ ] Requirements clustered into coherent model candidates (2–8 reqs each)
- [ ] Appropriate formalism selected per cluster
- [ ] Generated models follow existing project conventions
- [ ] Model checker runs without errors (or pending note if tool unavailable)
- [ ] Model registry updated with new entries and requirement links
- [ ] Coverage percentage improved in summary
</success_criteria>
