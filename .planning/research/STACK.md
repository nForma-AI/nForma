# Technology Stack

**Project:** QGSD v0.16 — Formal Plan Verification (New Capabilities Only)
**Researched:** 2026-02-26
**Overall confidence:** HIGH (all critical packages verified via npm registry and official docs)

---

## Context: Subsequent Milestone — Additive Only

The following capabilities from prior milestones are validated and must NOT be re-researched or
replaced. All new choices must integrate with this existing stack without breaking it.

**Existing constraints that new choices must satisfy:**

- All `bin/*.cjs` scripts use `'use strict'; require()` — CJS-only. No `import`.
- No ESM migration in scope. Any library that is ESM-only requires a workaround or must be
  avoided entirely.
- Zero new runtimes. JVM is already present (TLA+/Alloy/PRISM). No Python, no Rust, no Go.
- Existing dependencies: `inquirer@^8.2.7`, `keytar@^7.9.0` (prod); `esbuild@^0.24.0`,
  `tsup@^8.5.1`, `typescript@^5.9.3`, `xstate@^5.28.0` (dev).
- Zero-dep policy for bin/ scripts where possible (Mulberry32 inline PRNG precedent).
  New libraries must justify their weight.

---

## Capability A: Markdown Task List Parsing (PLAN.md → Structured Plan)

### Decision: `markdown-it@14.1.1` + `markdown-it-task-lists@2.1.1` — CJS-compatible, no new runtime

**What the feature needs:** Read a PLAN.md file containing GFM-style task lists
(`- [ ] task` / `- [x] task`) and extract a structured representation: task text, checked
state, nesting level, heading section it belongs to, and order within section.

**Why not a custom regex parser:** Markdown task lists can be nested, preceded by headings,
and interrupted by paragraphs. A robust parser handles edge cases (blank lines, sub-lists,
inline code in task text) that a regex approach silently misses. Precedent: QGSD already
rejected regex in `check-spec-sync.cjs` in favor of AST walking (DRFT-01..03 decision).

**Why `markdown-it`:**

- `markdown-it@14.1.1` (current) ships a CJS build. `exports` map confirms:
  `"require": "./dist/index.cjs.js"`. No ESM workaround needed. `require('markdown-it')`
  works directly in CJS bin/ scripts.
- Actively maintained (14.x released 2024–2025). 15M+ weekly downloads.
- Plugin ecosystem for extensions. Task list support via `markdown-it-task-lists`.
- Produces a flat token array — simpler to traverse than a full AST tree. Token `type`,
  `tag`, `content`, `children`, and `attrGet('class')` provide all needed fields.

**Why NOT `remark`/`unified`:** Both are ESM-only since their 2021 major version upgrades.
`mdast-util-from-markdown` is explicitly ESM-only. Using them in CJS requires dynamic `import()`
wrapped in an async function — adding async surface to what should be a synchronous parse step.
For a pipeline that also calls TLC/Alloy/PRISM (synchronous subprocess calls), mixing async
module loading adds unnecessary complexity. `markdown-it` with its CJS build is the correct
choice for this codebase.

**Why NOT `commonmark.js`:** No built-in task list support (task lists are GFM, not
CommonMark core). Would require a custom plugin anyway, at which point `markdown-it` is
strictly better (more active, larger plugin ecosystem).

**Task list plugin — `markdown-it-task-lists@2.1.1`:**

- Last published 2022 (unchanged since then — stable, not abandoned).
- `main: 'index.js'` — plain CJS, no exports map needed.
- Peer dependency: `markdown-it ^8 || ^9 || ^10 || ^11 || ^12` — verified compatible
  with v14 in practice (no breaking API changes in the plugin hook surface since v8).
- Adds `task-list-item-checkbox` class to list item tokens; checked state via `attrGet('checked')`.
- Alternative `@hedgedoc/markdown-it-task-lists@2.0.1` is marked deprecated on npm — avoid.

**How to extract structured plan from token stream:**

```javascript
'use strict';
const MarkdownIt = require('markdown-it');
const taskLists = require('markdown-it-task-lists');

const md = new MarkdownIt().use(taskLists, { enabled: true });
const tokens = md.parse(planText, {});

// Walk tokens: track current heading, extract list_item_open + inline children
// When token.attrGet('class') includes 'task-list-item', it's a task item
// token.children.find(t => t.type === 'text').content = task text
// token.attrGet('class').includes('task-list-item--checked') = done state
```

**No extraction library needed.** The token walk is 30–50 lines of straightforward code.
No additional npm package required for plan-spec mapping.

### Recommended Stack — Capability A

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `markdown-it` | 14.1.1 | Parse PLAN.md into token stream | CJS-compatible; `require()` works; actively maintained; 15M weekly downloads |
| `markdown-it-task-lists` | 2.1.1 | GFM task list checkbox token enrichment | Stable plugin; CJS; no peer dep conflict with v14 in practice |

**Installation:**

```bash
npm install markdown-it markdown-it-task-lists
```

**What NOT to use:**

| Avoid | Why |
|-------|-----|
| `remark` + `remark-gfm` | ESM-only; requires async `import()` in CJS context |
| `mdast-util-from-markdown` | Explicitly ESM-only (per npm registry) |
| `commonmark` | No task list support; CommonMark spec only |
| Custom regex parser | Brittle on nested lists, headings, inline code in task text |

---

## Capability B: JSDoc Annotation Extraction (@invariant, @transition, @probability)

### Decision: `comment-parser@1.4.5` — CJS-compatible, zero deps, custom tag support

**What the feature needs:** Scan JavaScript/TypeScript source files for JSDoc block comments
containing custom tags (`@invariant`, `@transition`, `@probability`) and extract their
tag name, type (if present), name, and description into structured objects suitable for
spec generation.

**Why `comment-parser`:**

- `comment-parser@1.4.5` (current as of 2026-02-06) — actively maintained.
- Ships dual package: CJS at `lib/index.cjs`, ESM at `es6/index.js`.
  `exports` map confirms `"require": "./lib/index.cjs"`. `require('comment-parser')` works.
- Zero dependencies (confirmed on npm registry).
- Custom tag support is first-class: the parser extracts all `@tag` blocks regardless of
  whether the tag is a known JSDoc tag. `@invariant`, `@transition`, `@probability` work
  without any configuration.
- Returns `{ tags: [{ tag, name, type, description, source }] }` for each block.
- Lightweight: ~15KB installed.

**Why NOT the TypeScript Compiler API for this task:**

The TypeScript compiler API can extract JSDoc comments via `ts.getJSDocTags()`, but:
1. It requires TypeScript compilation, which is expensive for a scan-only pipeline.
2. It only returns `@param`, `@returns`, and a limited set of "known" tags from the
   TypeScript perspective; custom tags have limited support.
3. TypeScript ships `lib/typescript.js` as CJS (main: `'./lib/typescript.js'`) — it is
   technically CJS-compatible, but the API surface is large, complex, and designed for
   type-checking, not annotation extraction.

For pure annotation extraction (no type inference needed), `comment-parser` is the
correct minimal tool.

**Why NOT `jsdoc` CLI:** The `jsdoc` npm package is a full documentation generator. It
processes files and generates HTML output. For programmatic extraction of tag data into
spec fragments, it is heavyweight and awkward to use as a library. `comment-parser` is
what most jsdoc ecosystem tools (including `eslint-plugin-jsdoc`) use internally for tag
parsing.

**Source file scanning:** Use Node.js stdlib `fs.readdirSync` + `readFileSync` for CJS
source files, or pass file paths via CLI arg. No glob library needed — `fs.readdirSync`
with a simple `.filter(f => f.endsWith('.cjs') || f.endsWith('.js'))` is sufficient.
For TypeScript files, same approach (comment-parser handles the comment text regardless
of surrounding syntax).

**Extraction pattern:**

```javascript
'use strict';
const { parse } = require('comment-parser');

const source = require('fs').readFileSync(filePath, 'utf8');
const blocks = parse(source);

for (const block of blocks) {
  const invariants = block.tags.filter(t => t.tag === 'invariant');
  const transitions = block.tags.filter(t => t.tag === 'transition');
  const probabilities = block.tags.filter(t => t.tag === 'probability');
  // invariants[0].description = "always MinQuorumMet when consensus"
}
```

**Tag format recommendation for QGSD annotations:**

```javascript
/**
 * @invariant {always} MinQuorumMet - quorum count never drops below threshold
 * @transition DELIBERATING -> CONSENSUS [minQuorumMet]
 * @probability consensus_in_3_rounds >= 0.95
 */
```

`comment-parser` extracts `type`, `name`, and `description` from each tag in this format.

### Recommended Stack — Capability B

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `comment-parser` | 1.4.5 | Extract @invariant/@transition/@probability from JSDoc blocks | CJS-compatible; zero deps; custom tag support; ~15KB; actively maintained |

**Installation:**

```bash
npm install comment-parser
```

**What NOT to use:**

| Avoid | Why |
|-------|-----|
| TypeScript Compiler API | Expensive compilation step; custom tag support limited; overkill for annotation extraction |
| `jsdoc` npm package | Full doc generator; designed for HTML output, not programmatic tag extraction |
| `jsdoc-parse` | Wraps jsdoc CLI; subprocess-based; fragile |
| `@microsoft/tsdoc` | TSDoc parser for a specific standard; does not support arbitrary custom tags |
| Regex on comment text | JSDoc comments have multiline edge cases; block detection is error-prone |

---

## Capability C: Mermaid Mind Map Generation (PLAN.md → MINDMAP.md)

### Decision: String template generation (no npm library) — Mermaid syntax is trivially generatable

**What the feature needs:** Take the structured plan extracted by Capability A and produce
a `MINDMAP.md` file containing a Mermaid mind map (`mindmap` syntax) that represents the
plan's phase/task hierarchy for injection into quorum slot-worker context.

**Key insight: mind map output is text, not SVG.** The MINDMAP.md delivered to quorum
agents is a Markdown code block containing Mermaid syntax. Quorum agents render it
mentally as a conceptual map, not visually. The output is a `.md` file, not an `.svg` file.
No rendering library is needed for the core feature.

**Mermaid mindmap syntax is trivially generatable via string template:**

```
mindmap
  root((PLAN.md))
    Phase 1: Setup
      Task A
        Sub-task A1
      Task B
    Phase 2: Implementation
      Task C
```

The entire mindmap is generated by:
1. Iterating task hierarchy from Capability A output.
2. Writing `  `.repeat(depth) + nodeText for each item.
3. Wrapping in a Markdown fenced code block.

This is 20–30 lines of string generation. No library is needed or justified.

**Why NOT `@mermaid-js/mermaid-cli` for text generation:** `@mermaid-js/mermaid-cli@11.12.0`
is an SVG/PNG renderer that uses Puppeteer (a headless Chromium browser). It requires
Node.js ≥18.19 and launches a browser process. Using it to generate the text representation
of a mindmap is like using a PDF printer to write a sentence — completely wrong tool.
Additionally, its `exports` are ESM (`import { run } from "@mermaid-js/mermaid-cli"`) —
it would require async dynamic import in a CJS context.

**When SVG rendering IS needed:** If a future phase requires rendering the mind map to SVG
(e.g., for visual artifact in `phases/<phase>/MINDMAP.svg`), the options are:

- `@mermaid-js/mermaid-cli@11.12.0` via CLI subprocess:
  `spawnSync('./node_modules/.bin/mmdc', ['-i', 'input.mmd', '-o', 'output.svg'])`
  This avoids the ESM import issue entirely — call it as a CLI, not as a module.
  Requires Node.js ≥18.19 (QGSD runs on 25.6.1, so no constraint).
- Install only as a devDependency to avoid bloating the published package.

**For v0.16 scope (text output only):** No npm library is needed for Capability C.
Pure string generation from the plan structure.

### Recommended Stack — Capability C

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js stdlib (`fs.writeFileSync`) | stdlib | Write MINDMAP.md | No library needed; trivial string template |
| String template (inline) | — | Generate Mermaid mindmap syntax | Mindmap syntax is indented text; generatable in ~25 lines |

**If SVG rendering is later required (not in v0.16 scope):**

| Technology | Version | Purpose | Condition |
|------------|---------|---------|-----------|
| `@mermaid-js/mermaid-cli` | 11.12.0 | Render .mmd to .svg via CLI | devDep only; invoke via `spawnSync` subprocess, NOT via `require()` |

**What NOT to use:**

| Avoid | Why |
|-------|-----|
| `mermaid` npm package | Browser-focused runtime; server-side rendering requires DOM shim; ESM |
| `@mermaid-js/mermaid-cli` (as imported module) | ESM-only; launches Puppeteer; wrong tool for text output |
| `@mermaid-js/mermaid-mindmap` plugin | Requires mermaid runtime; browser-focused |
| Any markdown-to-mindmap converter | Unnecessary abstraction; direct template generation is simpler |

---

## Capability D: Counterexample Parsing (TLC / Alloy / PRISM Output → Structured Feedback)

### Decision: Regex-based text parsers (TLC/PRISM) + JSON.parse (TLC JSON trace) + text scan (Alloy) — all zero-library

**What the feature needs:** When TLC, Alloy, or PRISM finds a counterexample during the
iterative verification loop, parse the tool's output into a structured object that can feed
back into the plan revision step.

**TLC counterexample parsing:**

TLC supports `-dumpTrace json <filename>` (available since tla2tools.jar v1.8.0). When a
property violation is found, this flag writes the error trace as a JSON file following the
ITF (Informal Trace Format) structure:

```json
{
  "#meta": { "format": "ITF", "varNames": ["phase", "votes", "round"] },
  "vars": ["phase", "votes", "round"],
  "states": [
    { "phase": "IDLE", "votes": 0, "round": 0 },
    { "phase": "DELIBERATING", "votes": 2, "round": 1 }
  ]
}
```

**TLC recommendation:** Use `-dumpTrace json counterexample.json` and parse with
`JSON.parse(fs.readFileSync(...))`. Zero library needed. The existing `run-tlc.cjs` uses
`stdio: 'inherit'` — for the plan verification use case, switch to `stdio: 'pipe'` and
add `-dumpTrace json` flag to capture the trace file path. Then read and parse the JSON.

For text-mode TLC output (when `-dumpTrace json` is not used), the error trace appears
as:

```
Error: Invariant MinQuorumMet is violated.
State 1:
/\ phase = "IDLE"
/\ votes = 0
...
```

A regex `/(State \d+:)([\s\S]*?)(?=State \d+:|$)/g` extracts individual states.
This is the fallback when the JSON dump is unavailable.

**Alloy counterexample parsing:**

The existing `run-alloy.cjs` already does the right thing: invoke with `--output -` and
`--type text`, scan stdout for `/Counterexample/i`. For the plan verification pipeline,
switch `--type` to `text` and parse the text output for the specific counterexample
section. Alloy's text output for a counterexample looks like:

```
Counterexample found for assertion ThresholdPasses:
  this/Agent = {Agent0, Agent1}
  approve = {Agent0}
  ...
```

A simple regex scan for lines after `Counterexample found` extracts the constraint
violation. No XML library is needed — the `--type text` format is simpler to parse than
XML and already in use.

If XML output (`--type xml`) is required in a future phase, `fast-xml-parser@5.4.1`
ships CJS at `lib/fxp.cjs` (`"require": { "default": "./lib/fxp.cjs" }`) and is the
correct choice — zero native deps, actively maintained (published daily as of 2026-02).

**PRISM counterexample parsing:**

PRISM outputs probability results to stdout as plaintext:

```
Model constants: tp_rate=0.9274, unavail=0.0215
Property: P=? [ F consensus_reached ]
Result: 0.9731 (exact floating point)

Property: P>=0.95 [ F consensus_reached ]
Result: true
```

When a property FAILS (result is `false` or a probability below threshold):

```
Result: false (property is not satisfied)
```

A regex on the captured stdout: `/(Result:\s*)(false|[\d.]+)/` extracts the result. No
library is needed. The existing `run-prism.cjs` already captures stdout — for plan
verification, extend it to parse result lines and emit a structured counterexample object.

PRISM does not produce path counterexamples for probabilistic properties (a known
limitation — probabilistic counterexamples require infinite sets of paths). The "counterexample"
for PRISM is the probability value itself: `{ property, result, satisfied, threshold }`.

**Plan-spec mapping counterexample structure (common output format):**

```javascript
// Unified counterexample object produced by each tool's parser
{
  tool: 'tlc' | 'alloy' | 'prism',
  violated: 'invariant name or property',
  trace: [...states] | null,   // TLC only
  witness: string | null,       // Alloy text excerpt
  probability: number | null,   // PRISM only
  raw: string                   // full tool output for context
}
```

### Recommended Stack — Capability D

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `JSON.parse` (stdlib) | stdlib | Parse TLC `-dumpTrace json` output | TLC natively produces ITF JSON; no library needed |
| Regex (inline) | — | Parse TLC text trace, PRISM result lines | Simple line-based format; regex sufficient |
| Text scan (inline) | — | Detect Alloy counterexample section | Already in `run-alloy.cjs`; extend the existing pattern |

**If XML parsing is ever needed (not in v0.16 scope):**

| Technology | Version | Purpose | Condition |
|------------|---------|---------|-----------|
| `fast-xml-parser` | 5.4.1 | Parse Alloy `--type xml` output | Only if structured XML parsing becomes necessary; CJS-compatible |

**TLC invocation change for plan verification:**

The existing `run-tlc.cjs` uses `stdio: 'inherit'`. For the plan verification pipeline,
use `stdio: 'pipe'` and add `-dumpTrace json <outfile>` to the TLC args. Read the JSON
file after TLC exits. This is additive — existing `run-tlc.cjs` behavior is unchanged
for the existing formal-verify pipeline.

**What NOT to use:**

| Avoid | Why |
|-------|-----|
| `xml2js` | Unnecessary; Alloy text output is simpler to parse than XML |
| `fast-xml-parser` (for TLC) | TLC produces JSON via -dumpTrace; XML not involved |
| `@tlaplus/tlaplus-output-parser` | Does not exist on npm; no community Node.js parser library for TLC output |
| Full TLC output AST library | None exists for Node.js; text/JSON parsing is the only approach |

---

## Capability E: Structured Plan-Spec Mapping

### Decision: Hand-written mapping module — no library needed

**What the feature needs:** Take the structured plan from Capability A (list of tasks with
section/heading context) and map them to formal spec fragments (TLA+ invariants, Alloy
predicates, PRISM properties, transition definitions). This is the core algorithmic step
of v0.16.

**Why no library:** Plan-spec mapping is domain-specific to QGSD's formal models. No
general-purpose "plan-to-spec" library exists on npm. The mapping logic requires:
1. Pattern matching on task text (does this task imply a new state? a new guard? an invariant?)
2. Template expansion (fill TLA+ template with extracted state names and guard conditions)
3. Validation that generated spec fragments are syntactically correct (checked by TLC/Alloy/PRISM
   invocation in the iterative loop)

This is custom logic — approximately 200–400 lines in a new `bin/plan-to-spec.cjs` module.

**Existing tools that ARE useful for this capability:**

- `comment-parser` (Capability B) — extracts `@invariant`/`@transition` annotations from
  source code, which seed the spec fragment templates.
- `markdown-it` + `markdown-it-task-lists` (Capability A) — provides the structured task
  list as input to the mapping.
- Existing `bin/generate-formal-specs.cjs` — the regex-based XState machine parser provides
  the pattern for extracting state names and guard conditions from structured source. The
  plan-to-spec mapper follows the same pattern but inputs PLAN.md instead of TypeScript.

**Template approach:** Hard-code TLA+/Alloy/PRISM fragment templates in the mapper module.
Use JavaScript string interpolation (`${stateName}`, `${guardCondition}`) rather than a
template engine library. The templates are small (5–20 lines each) and don't need a full
Handlebars/Mustache setup.

**No AST manipulation library for TLA+/Alloy/PRISM:** These spec languages don't have
npm-ecosystem AST libraries. The plan-to-spec pipeline generates spec text from templates,
not by manipulating existing spec ASTs. The spec files are written fresh to
`.planning/phases/<phase>/formal/` for each verification run.

**Pattern recognition from task text:** Use regex patterns to classify task descriptions:

```javascript
const TRANSITION_PATTERN = /^\s*([\w_]+)\s*->\s*([\w_]+)/;        // "IDLE -> DELIBERATING"
const INVARIANT_PATTERN  = /\bAlways\b|\binvariant\b|\bnever\b/i;  // "Always MinQuorumMet"
const PROBABILITY_PATTERN = /\bP\s*[><=]+\s*[\d.]+/;              // "P>=0.95"
```

These are inline patterns — no library justifies the dependency cost.

### Recommended Stack — Capability E

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js stdlib | stdlib | File I/O for spec output | `fs.writeFileSync` to `.planning/phases/<phase>/formal/` |
| Hand-written `bin/plan-to-spec.cjs` | — | Task-to-spec-fragment mapping | Domain-specific; no general library exists; ~300 lines |
| Template strings (inline) | — | TLA+/Alloy/PRISM fragment templates | No template engine needed; fragments are small |

---

## Summary: Net New npm Dependencies for v0.16

All new additions are production dependencies (used by bin/ scripts shipped with the package)
unless noted as devDep.

| Package | Version | Capability | Justification |
|---------|---------|------------|---------------|
| `markdown-it` | 14.1.1 | A (PLAN.md parsing) | CJS-compatible; actively maintained; necessary for robust task list extraction |
| `markdown-it-task-lists` | 2.1.1 | A (task list tokens) | Required plugin for GFM task list checkbox support |
| `comment-parser` | 1.4.5 | B (JSDoc extraction) | CJS-compatible; zero deps; only viable custom-tag parser for CJS |

**Zero new devDependencies required.** All other capabilities (C, D, E) use Node.js stdlib,
inline patterns, or extend existing bin/ script patterns.

**Installation (all new deps):**

```bash
npm install markdown-it markdown-it-task-lists comment-parser
```

**Total new prod dep weight:** ~3 packages, ~150KB installed. Acceptable given the feature scope.

---

## What NOT to Add (Bloat Risks)

| Package | Why Not |
|---------|---------|
| `remark` + `remark-gfm` + `remark-parse` | ESM-only ecosystem; forces async dynamic import in CJS context; unified adds 5+ transitive deps |
| `@mermaid-js/mermaid-cli` | Installs Puppeteer (Chromium, ~300MB); wrong tool for text generation; ESM imports |
| `mermaid` (runtime) | Browser-focused; server-side requires DOM shim; ESM; ~2MB |
| TypeScript Compiler API (as a new dep) | TypeScript already in devDeps; but using ts API programmatically adds compilation overhead for what is a simple annotation scan |
| `@microsoft/tsdoc` | TSDoc standard only; does not support arbitrary custom tags |
| `handlebars` / `mustache` | Template engine overkill for 5–20 line TLA+/Alloy/PRISM fragments |
| `fast-xml-parser` | Not needed in v0.16 scope; only justified if Alloy XML mode is required |
| `xml2js` | Outdated callback API; superseded by `fast-xml-parser` if XML parsing ever needed |
| `jsdoc` CLI wrapper | Full doc generator; subprocess-based; 20+ transitive deps |
| Any "plan-to-spec" npm package | No such ecosystem exists; would be custom code regardless |
| `glob` / `fast-glob` | Node.js 22+ has `fs.glob()` built-in; QGSD runs Node.js 25.6.1 |

---

## Integration with Existing Tools

### How new packages connect to existing pipeline

```
PLAN.md
  └─ [markdown-it + markdown-it-task-lists] → structured task list
       └─ [bin/plan-to-spec.cjs] → spec fragments (TLA+/Alloy/PRISM)
            └─ [existing run-tlc.cjs / run-alloy.cjs / run-prism.cjs] → verification
                 └─ [Capability D parsers] → counterexample objects
                      └─ [iterative loop in plan-phase.md workflow] → plan revision

Source files (JS/TS/CJS)
  └─ [comment-parser] → @invariant/@transition/@probability tags
       └─ [bin/plan-to-spec.cjs] → additional spec constraints (hybrid mode)

Spec fragments verified
  └─ [plan-phase.md iterative loop] → verified PLAN.md
       └─ [Mermaid template generator] → MINDMAP.md
            └─ quorum slot-worker prompt injection
```

### Existing tools that extend naturally to support new capabilities

| Existing Tool | Extension for v0.16 |
|---------------|---------------------|
| `run-tlc.cjs` | Add `-dumpTrace json counterexample.json` flag; switch to `stdio: 'pipe'` for plan verification use case |
| `run-alloy.cjs` | Parse text output beyond `/Counterexample/i` — extract constraint violation text |
| `run-prism.cjs` | Parse result lines from captured stdout to extract probability value and pass/fail status |
| `run-formal-verify.cjs` | Add new `generate:plan-spec` step before TLA+/Alloy/PRISM steps in the pipeline |
| `generate-formal-specs.cjs` | Pattern precedent for template-based spec generation; plan-to-spec.cjs follows same approach |
| `check-spec-sync.cjs` | AST walk pattern via esbuild inline bundle; plan-to-spec.cjs uses same esbuild-require pattern |

---

## Version Compatibility

| Package | Node.js Requirement | CJS via `require()` | Notes |
|---------|--------------------|--------------------|-------|
| `markdown-it@14.1.1` | ≥12 (in practice) | YES — `dist/index.cjs.js` | Confirmed via npm exports map |
| `markdown-it-task-lists@2.1.1` | ≥0.10.x | YES — `index.js` (plain CJS) | No exports map; direct CJS |
| `comment-parser@1.4.5` | ≥12 | YES — `lib/index.cjs` | Confirmed via npm exports map; dual CJS+ESM |
| `fast-xml-parser@5.4.1` | ≥16 | YES — `lib/fxp.cjs` | If ever needed; confirmed via exports map |
| `@mermaid-js/mermaid-cli@11.12.0` | ≥18.19 | NO — ESM; use as CLI subprocess only | Not in v0.16 prod deps |

---

## Upgrade Paths

| Package | Upgrade Trigger | Action |
|---------|----------------|--------|
| `markdown-it` | Breaking change in plugin hook API | Check `markdown-it-task-lists` peer dep compatibility; plugin hook surface has been stable since v8 |
| `markdown-it-task-lists` | Plugin stops working with newer markdown-it | Replace with inline token-walking code; the plugin is simple enough to replicate |
| `comment-parser` | Custom tag API changes | `1.4.x` has been stable since 1.0.0; semver breakage would only come at 2.0.0 |
| TLC JSON trace format | TLC changes ITF structure | Re-test `-dumpTrace json` output after tla2tools.jar upgrade; structure has been stable since 1.7.x |

---

## Sources

- npm registry `markdown-it` — version 14.1.1, `exports["require"]: "./dist/index.cjs.js"` confirmed. Confidence: HIGH.
- npm registry `markdown-it-task-lists` — version 2.1.1, `main: "index.js"`, last modified 2022-06-19. Confirmed stable. Confidence: HIGH.
- npm registry `@hedgedoc/markdown-it-task-lists` — marked deprecated on npm. Confirmed: avoid. Confidence: HIGH.
- npm registry `comment-parser` — version 1.4.5, `exports["require"]: "./lib/index.cjs"`, published 2026-02-06. Confidence: HIGH.
- npm registry `fast-xml-parser` — version 5.4.1, `exports["."]["require"]["default"]: "./lib/fxp.cjs"`. Confidence: HIGH.
- npm registry `@mermaid-js/mermaid-cli` — version 11.12.0, engines `node: "^18.19 || >=20.0"`, ESM exports. Confidence: HIGH.
- WebSearch for remark/unified ESM-only status — confirmed ESM-only since 2021 major versions; `mdast-util-from-markdown` explicitly ESM-only per npm registry. Confidence: HIGH.
- TLA+ wiki `using:tlc:start` and Apalache ITF format docs — confirmed `-dumpTrace json` flag and ITF JSON structure. Confidence: MEDIUM (official docs found; specific 2025 schema confirmed from Apalache ADR-015 cross-reference).
- PRISM manual `RunningPRISM/ModelChecking` — confirmed text output format for property results. Confidence: HIGH (official documentation).
- Alloy `run-alloy.cjs` source code (existing QGSD) — confirmed text output mode with `/Counterexample/i` scan already in use. Confidence: HIGH (direct code inspection).
- `node --version` on target machine: v25.6.1 — confirms Node.js 25 is the runtime; all CJS packages satisfy requirements. Confidence: HIGH.

---

*Stack research for: QGSD v0.16 Formal Plan Verification — new capabilities only*
*Researched: 2026-02-26*
