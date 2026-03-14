---
phase: quick-289
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - core/workflows/close-formal-gaps.md
  - commands/nf/close-formal-gaps.md
autonomous: true
formal_artifacts: none
requirements: [QUICK-289]

must_haves:
  truths:
    - "close-formal-gaps selects UPPAAL for requirements involving real-time constraints (timeouts, heartbeats, SLAs, deadlines)"
    - "close-formal-gaps selects Petri net for requirements involving concurrency, pipelines, resource contention, or token-based workflows"
    - "close-formal-gaps generates UPPAAL .xml + .q files following the quorum-races.xml convention when UPPAAL formalism is selected"
    - "close-formal-gaps generates Petri .dot files following the quorum-petri-net.dot convention when Petri formalism is selected"
    - "The --formalism flag accepts uppaal as a valid override option and is verified in both workflow and skill command"
    - "run-formal-verify.cjs already discovers and runs UPPAAL and Petri models from .planning/formal/{uppaal,petri}/ with no code changes needed"
    - "run-uppaal.cjs gracefully degrades when verifyta is missing: writes warning to stderr, exits 0 with result=inconclusive, never crashes the verification suite"
  artifacts:
    - path: "core/workflows/close-formal-gaps.md"
      provides: "Extended workflow with UPPAAL and Petri generation instructions"
      contains: "uppaal"
    - path: "commands/nf/close-formal-gaps.md"
      provides: "Skill command with uppaal in --formalism flag"
      contains: "uppaal"
  key_links:
    - from: "core/workflows/close-formal-gaps.md"
      to: ".planning/formal/uppaal/"
      via: "Step 5 UPPAAL generation instructions"
      pattern: "UPPAAL"
    - from: "core/workflows/close-formal-gaps.md"
      to: "bin/run-uppaal.cjs"
      via: "Step 6 checker invocation reference"
      pattern: "run-uppaal"
    - from: "commands/nf/close-formal-gaps.md"
      to: "core/workflows/close-formal-gaps.md"
      via: "execution_context reference"
      pattern: "close-formal-gaps.md"
---

<objective>
Extend the close-formal-gaps workflow to support UPPAAL timed automata and Petri net spec generation for user project requirements, not just nForma internal models.

Purpose: Currently close-formal-gaps only generates TLA+, Alloy, and PRISM specs. UPPAAL and Petri are referenced in the formalism table but lack generation templates and detailed heuristics. The verification runner (run-formal-verify.cjs) already discovers and executes UPPAAL/Petri models dynamically, so the only gap is in the workflow instructions that tell Claude WHEN to select these formalisms and HOW to generate the spec files.

Output: Updated workflow with UPPAAL and Petri generation templates, extended heuristics, and updated skill command.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@core/workflows/close-formal-gaps.md
@commands/nf/close-formal-gaps.md
@.planning/formal/uppaal/quorum-races.xml
@.planning/formal/uppaal/quorum-races.q
@.planning/formal/petri/quorum-petri-net.dot
@bin/run-uppaal.cjs
@bin/generate-petri-net.cjs
@bin/run-formal-verify.cjs
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend close-formal-gaps workflow with UPPAAL and Petri generation instructions</name>
  <files>core/workflows/close-formal-gaps.md</files>
  <action>
Edit the close-formal-gaps workflow at `core/workflows/close-formal-gaps.md` with these changes:

**Step 3 (Select Formalism) — Extend the heuristic table:**

Replace the existing 4-row formalism table with a 5-row table adding UPPAAL:

| Pattern | Formalism | When |
|---|---|---|
| Sequential state transitions, protocols, lifecycle | **TLA+** | State machines, multi-step workflows, liveness/safety |
| Structural constraints, relationships, configurations | **Alloy** | Data models, configuration validity, structural invariants |
| Probabilistic behavior, availability, reliability | **PRISM** | Timeout probabilities, availability models, SLAs |
| Real-time constraints, timed deadlines, heartbeats | **UPPAAL** | Timeout enforcement, race conditions, timed protocol phases, SLA deadlines |
| Concurrent workflows, resource contention, pipelines | **Petri net** | Pipeline stages, token-based concurrency, producer-consumer, resource pools |

Add a sub-section after the table with **detailed selection heuristics** to help Claude disambiguate:

```
### Formalism Selection Disambiguation

When multiple formalisms could apply, prefer:
- **UPPAAL over TLA+** when the requirement explicitly mentions clock-based timing (ms/s deadlines, timeout enforcement, heartbeat intervals, SLA response times). TLA+ models logical ordering; UPPAAL models real-time clocks.
- **UPPAAL over PRISM** when the requirement asks "will X complete within Y ms?" (reachability under timing) rather than "what is the probability X completes?" (stochastic).
- **Petri net over TLA+** when the requirement focuses on concurrent resource flow (tokens, pipeline stages, pool allocation) rather than protocol state transitions.
- **Petri net over Alloy** when the requirement is about dynamic flow/reachability rather than static structural constraints.
```

Also update the `--formalism` override line to include `uppaal`:
```
If the user overrides the heuristic via `--formalism=tla|alloy|prism|petri|uppaal`, use that instead.
```

**Step 4 (Study Existing Models) — Add UPPAAL entry:**

Add after the Petri bullet:
```
- **UPPAAL**: Read `.planning/formal/uppaal/quorum-races.xml` and its `.q` query file. Note the XML structure with `<nta>`, `<declaration>` (global constants), `<template>` (timed automata), `<system>` (process instantiation), and the `.q` query syntax (`A[] not deadlock`, `E<> location`, etc.).
```

**Step 5 (Generate the Formal Model) — Add UPPAAL and enhance Petri sections:**

Add a new `### UPPAAL timed automata` subsection:

```
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
```

Enhance the existing `### Petri net models` subsection to be more explicit:

```
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
```

**Step 6 (Run the Model Checker) — Add UPPAAL entry:**

Add after the Petri bullet:
```
- **UPPAAL**: `verifyta <model.xml> <model.q>` — all queries must report "satisfied". If verifyta is not installed (no VERIFYTA_BIN env var), `run-uppaal.cjs` writes a warning to **stderr** (not stdout), sets result to `inconclusive` with triage tag `no-verifyta`, and exits 0 (no crash). The workflow should register the model as pending verification. The verification runner (run-formal-verify.cjs) will discover and attempt to run any `.xml` files in `.planning/formal/uppaal/` automatically; `run-uppaal.cjs` is marked `nonCritical: true` in the step registry so a missing verifyta never fails the overall suite.
```
  </action>
  <verify>
Run these checks:
1. `grep -c 'uppaal' core/workflows/close-formal-gaps.md` — should return 5+ matches (heuristic table, study step, generate step, checker step, formalism flag)
2. `grep -c 'UPPAAL' core/workflows/close-formal-gaps.md` — should return 5+ matches
3. `grep 'tla|alloy|prism|petri|uppaal' core/workflows/close-formal-gaps.md` — should find the updated formalism override line
4. `grep 'verifyta' core/workflows/close-formal-gaps.md` — should find the checker reference
5. `grep 'bipartite' core/workflows/close-formal-gaps.md` — should find the enhanced Petri instructions
6. `grep 'Disambiguation' core/workflows/close-formal-gaps.md` — should find the new disambiguation section
  </verify>
  <done>
The close-formal-gaps workflow includes: (1) UPPAAL in the formalism selection heuristic table with clear disambiguation guidance, (2) UPPAAL study reference to quorum-races.xml, (3) detailed UPPAAL .xml + .q generation template, (4) enhanced Petri .dot + optional .json generation template, (5) UPPAAL checker invocation via verifyta, (6) the --formalism flag accepts uppaal.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update skill command and sync installed workflow</name>
  <files>commands/nf/close-formal-gaps.md</files>
  <action>
1. **Update the skill command** at `commands/nf/close-formal-gaps.md`:
   - In the `argument-hint` line, change `--formalism=tla|alloy|prism|petri` to `--formalism=tla|alloy|prism|petri|uppaal`
   - In the `description` line, update to mention UPPAAL: "selects formalism (TLA+/Alloy/PRISM/Petri/UPPAAL)"
   - In the `<process>` section's flag documentation, update the --formalism line to: `--formalism=tla|alloy|prism|petri|uppaal  Override formalism selection`

2. **Sync the workflow to the installed location**:
   - Copy `core/workflows/close-formal-gaps.md` to `~/.claude/nf/workflows/close-formal-gaps.md`
   - This is required per the "Workflow sync required" convention from MEMORY.md
  </action>
  <verify>
1. `grep 'uppaal' commands/nf/close-formal-gaps.md` — should show uppaal in argument-hint and formalism flag
2. `grep 'UPPAAL' commands/nf/close-formal-gaps.md` — should show UPPAAL in description
3. `diff core/workflows/close-formal-gaps.md ~/.claude/nf/workflows/close-formal-gaps.md` — should show no differences (sync confirmed)
4. **Flag parsing round-trip**: Confirm the workflow's `--formalism=` line lists `uppaal` as a valid pipe-delimited option by running `grep 'formalism=tla|alloy|prism|petri|uppaal' core/workflows/close-formal-gaps.md` — must match. Also confirm `commands/nf/close-formal-gaps.md` has the same pipe set in both `argument-hint` and `<process>` flag docs (two separate grep hits).
  </verify>
  <done>
The skill command accepts `--formalism=uppaal` as a valid option, the description mentions all 5 formalisms, the flag parsing is verified in both the workflow and skill command, and the installed workflow at ~/.claude/nf/workflows/ is in sync with the repo source.
  </done>
</task>

</tasks>

<verification>
- `grep -c 'uppaal\|UPPAAL' core/workflows/close-formal-gaps.md` returns 10+ (comprehensive coverage)
- `grep 'formalism=tla|alloy|prism|petri|uppaal' commands/nf/close-formal-gaps.md` finds the updated flag in both argument-hint and process flag docs
- `grep 'formalism=tla|alloy|prism|petri|uppaal' core/workflows/close-formal-gaps.md` finds the updated flag in the workflow
- `diff core/workflows/close-formal-gaps.md ~/.claude/nf/workflows/close-formal-gaps.md` returns empty (in sync)
- The run-formal-verify.cjs already has dynamic UPPAAL and Petri discovery (no code changes needed — verified by reading lines 196-211 and 179-194)
- The UPPAAL template section includes a concrete XML entity escaping example (`x &lt; 500`) to prevent malformed XML generation
- The UPPAAL checker step documents that run-uppaal.cjs exits 0 with inconclusive when verifyta is missing (stderr warning, no crash)
</verification>

<success_criteria>
- close-formal-gaps workflow has UPPAAL in formalism selection table with disambiguation heuristics
- close-formal-gaps workflow has UPPAAL .xml + .q generation template with full XML DTD structure reference
- close-formal-gaps workflow has enhanced Petri .dot generation template with bipartite constraint and optional .json
- close-formal-gaps workflow references verifyta for UPPAAL checking with graceful degradation details
- close-formal-gaps workflow UPPAAL template includes concrete XML entity escaping example
- Skill command accepts --formalism=uppaal (verified in both argument-hint and process flag docs)
- Installed workflow is synced to ~/.claude/nf/workflows/
</success_criteria>

<output>
After completion, create `.planning/quick/289-wire-uppaal-and-petri-net-support-into-c/289-SUMMARY.md`
</output>
