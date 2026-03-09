# Formal Proximity Index — Design Document

**Status:** Draft
**Date:** 2026-03-07
**Goal:** Replace isolated formal↔code lookups with a unified graph that enables traversal from _any_ element to _all_ connected elements.

---

## 1. The Problem

Today, nForma has **10+ independent data sources** that each know something about formal↔code relationships, but they're consumed in isolation:

| Artifact | Knows About | Used By |
|---|---|---|
| `spec/*/scope.json` | file → module, concept → module | `formal-scope-scan.cjs` |
| `constants-mapping.json` | formal constant → config path | `formal-test-sync.cjs` |
| `traceability-matrix.json` | requirement → model property | `generate-traceability-matrix.cjs` |
| `instrumentation-map.json` | code line → formal action → xstate event | `instrumentation-map.cjs` |
| `git-heatmap.json` | constant drift across commits | `git-heatmap.cjs` |
| `model-registry.json` | model file → requirements, layer, maturity | `nf-solve.cjs` |
| `invariant-catalog.json` | invariant name → source model, formalism | `invariant-catalog.cjs` |
| `unit-test-coverage.json` | requirement → test file | `formal-test-sync.cjs` |
| `event-vocabulary.json` | action name → source hook → xstate event | `instrumentation-map.cjs` |
| `observed-fsm.json` | state → event → state (with counts) | `risk-heatmap.cjs` |
| `risk-heatmap.json` | transition → RPN → risk tier | `hazard-model.cjs` |
| `debt.json` | debt entry → status, source | `nf-solve.cjs` |

**Every "where does this connect?" question requires manually chaining 3-4 tools.** There is no single structure you can query with "given X, what touches X?"

---

## 2. The Graph Model

### 2.1 Node Types

Every element in the formal ecosystem is a **node** with a type:

```
NODE TYPES
──────────────────────────────────────────────────────
code_file       Source file path (hooks/nf-stop.js)
code_line       Specific emission point (hooks/nf-stop.js:555)
constant        Named constant (Depth, CommitWindow)
config_path     Runtime config key (circuit_breaker.oscillation_depth)
requirement     Requirement ID (SAFE-01, CRED-07)
formal_model    Model file path (.formal/alloy/quorum-votes.als)
formal_module   Spec module name (breaker, quorum, oscillation)
invariant       Named invariant (BreakerTypeOK, TypeOK)
formal_action   Event vocabulary action (quorum_start, circuit_break)
xstate_event    XState event name (QUORUM_START, CIRCUIT_BREAK)
fsm_state       Observed FSM state (IDLE, COLLECTING_VOTES)
test_file       Test file path (generated-stubs/ACT-01.stub.test.js)
concept         Semantic concept (oscillation, consensus, voting)
debt_entry      Debt ledger entry ID
risk_transition Risk-scored FSM transition
```

### 2.2 Edge Types

Edges are **typed and directional**, derived from existing artifacts:

```
EDGE TYPES                          SOURCE ARTIFACT
──────────────────────────────────────────────────────
code_file    ──owns──>     formal_module     spec/*/scope.json (source_files)
concept      ──describes──> formal_module    spec/*/scope.json (concepts)
requirement  ──modeled_by──> formal_model    model-registry.json
formal_model ──declares──>  invariant        invariant-catalog.json
requirement  ──verified_by──> invariant      traceability-matrix.json
requirement  ──tested_by──>  test_file       unit-test-coverage.json
constant     ──maps_to──>   config_path      constants-mapping.json
constant     ──declared_in──> formal_model   constants-mapping.json (source)
code_line    ──emits──>      formal_action   instrumentation-map.json
formal_action ──triggers──> xstate_event     event-vocabulary.json
xstate_event ──transitions──> fsm_state      observed-fsm.json
risk_transition ──scores──> fsm_state        risk-heatmap.json
constant     ──drifts──>    (self)           git-heatmap.json (metadata)
debt_entry   ──affects──>   requirement      debt.json
code_file    ──tested_by──> test_file        (derived: test file naming)
```

### 2.3 The Adjacency Index

The core data structure is a **bidirectional adjacency list** stored as a single JSON file:

```json
{
  "schema_version": "1",
  "generated": "2026-03-07T...",
  "nodes": {
    "code_file::hooks/nf-circuit-breaker.js": {
      "type": "code_file",
      "id": "hooks/nf-circuit-breaker.js",
      "edges": [
        { "to": "formal_module::breaker",       "rel": "owns",    "source": "scope.json" },
        { "to": "formal_module::oscillation",    "rel": "owns",    "source": "scope.json" },
        { "to": "code_line::hooks/nf-circuit-breaker.js:676", "rel": "contains", "source": "instrumentation-map" },
        { "to": "test_file::hooks/dist/nf-circuit-breaker.test.js", "rel": "tested_by", "source": "derived" }
      ]
    },
    "code_line::hooks/nf-circuit-breaker.js:676": {
      "type": "code_line",
      "id": "hooks/nf-circuit-breaker.js:676",
      "edges": [
        { "to": "formal_action::circuit_break",  "rel": "emits",   "source": "instrumentation-map" },
        { "to": "code_file::hooks/nf-circuit-breaker.js", "rel": "in_file", "source": "instrumentation-map" }
      ]
    },
    "formal_action::circuit_break": {
      "type": "formal_action",
      "id": "circuit_break",
      "edges": [
        { "to": "xstate_event::CIRCUIT_BREAK",   "rel": "triggers", "source": "event-vocabulary" },
        { "to": "code_line::hooks/nf-circuit-breaker.js:676", "rel": "emitted_by", "source": "instrumentation-map" }
      ]
    },
    "xstate_event::CIRCUIT_BREAK": {
      "type": "xstate_event",
      "id": "CIRCUIT_BREAK",
      "edges": [
        { "to": "fsm_state::IDLE",               "rel": "from_state",  "source": "observed-fsm" },
        { "to": "fsm_state::COLLECTING_VOTES",    "rel": "from_state",  "source": "observed-fsm" },
        { "to": "formal_action::circuit_break",   "rel": "triggered_by","source": "event-vocabulary" }
      ]
    },
    "constant::Depth": {
      "type": "constant",
      "id": "Depth",
      "formal_value": 3,
      "edges": [
        { "to": "config_path::circuit_breaker.oscillation_depth", "rel": "maps_to",     "source": "constants-mapping" },
        { "to": "formal_model::.formal/tla/MCoscillation.cfg",    "rel": "declared_in",  "source": "constants-mapping" },
        { "to": "formal_module::oscillation",                      "rel": "constrains",   "source": "derived" }
      ],
      "drift": {
        "direction": "stable",
        "touch_count": 0
      }
    }
  }
}
```

**Key property: every edge has a reverse.** If `A ──owns──> B` exists, then `B ──owned_by──> A` also exists. This means you can start at ANY node and walk in any direction.

---

## 3. Traversal API

### 3.1 Core Operations

```
reach(startNode, maxDepth)          → all reachable nodes within N hops
reach(startNode, maxDepth, filter)  → reachable nodes of specific type(s)
path(from, to)                      → shortest path between two nodes
neighbors(node)                     → direct edges only (depth=1)
impact(codeFile)                    → all formal elements affected by a code change
coverage(requirement)               → full chain: req → model → invariant → test → code
```

### 3.2 Example Queries

**"What does changing `hooks/nf-circuit-breaker.js` affect formally?"**
```
reach("code_file::hooks/nf-circuit-breaker.js", depth=3, filter=[invariant, requirement])

Result:
  depth 1: formal_module::breaker, formal_module::oscillation
  depth 2: invariant::BreakerTypeOK, invariant::MonotonicTrip,
           formal_model::.formal/tla/QGSDBreakerState.tla
  depth 3: requirement::SAFE-01, requirement::SAFE-02
```

**"What code implements requirement CRED-07?"**
```
reach("requirement::CRED-07", depth=4, filter=[code_file, code_line, test_file])

Result:
  depth 1: formal_model::alloy/account-pool-structure.als
  depth 2: invariant::AddPreservesValidity
  depth 3: test_file::generated-stubs/CRED-07.stub.test.js
  depth 4: (code_file linkage via scope.json — if account-manager module has source_files)
```

**"Which constants are near this code and are they drifting?"**
```
reach("code_file::hooks/nf-circuit-breaker.js", depth=2, filter=[constant])

Result:
  constant::Depth         formal=3, config=3, drift=stable
  constant::CommitWindow  formal=5, config=6, drift=intentional_divergence
```

---

## 4. Build Pipeline

The index is **generated** (not hand-maintained) by reading all source artifacts:

```
STEP   INPUT                           OUTPUT
─────────────────────────────────────────────────────────────
1      spec/*/scope.json               code_file ↔ formal_module ↔ concept
2      constants-mapping.json          constant ↔ config_path ↔ formal_model
3      model-registry.json             formal_model ↔ requirement (+ layer metadata)
4      invariant-catalog.json          invariant ↔ formal_model
5      traceability-matrix.json        requirement ↔ invariant (via property)
6      unit-test-coverage.json         requirement ↔ test_file
7      instrumentation-map.json        code_line ↔ formal_action
8      event-vocabulary.json           formal_action ↔ xstate_event
9      observed-fsm.json               xstate_event ↔ fsm_state
10     risk-heatmap.json               risk_transition ↔ fsm_state (with score)
11     git-heatmap.json                constant drift metadata (decorates constant nodes)
12     debt.json                       debt_entry ↔ requirement
13     REVERSE PASS                    Generate all reverse edges
14     VALIDATE                        Check for orphan nodes (no edges)
```

Output: `.planning/formal/proximity-index.json`

### 4.1 Incremental Rebuild

Full rebuild reads ~12 files, all small JSON. Expected time: <500ms.
No need for incremental — just regenerate on every `nf-solve` run (step 0).

---

## 5. Proximity Scoring

When querying "how close is code file X to formal module Y?", compute a **proximity score** from the graph:

```
proximity(A, B) = Σ  (weight(path) * decay^depth)
                 paths

where:
  weight(path) = min(edge_weight for each edge in path)
  decay = 0.7 per hop
```

### 5.1 Edge Weights (by relationship type)

```
RELATIONSHIP          WEIGHT    RATIONALE
──────────────────────────────────────────────────────
owns / owned_by       1.0       Direct file ↔ module binding
contains / in_file    1.0       Line within file (structural)
emits / emitted_by    0.9       Code emitting formal action
maps_to / mapped_from 0.9       Constant ↔ config direct binding
declared_in           0.9       Constant in formal model
modeled_by            0.8       Requirement has formal model
declares              0.8       Model declares invariant
verified_by           0.8       Requirement verified by invariant
tested_by             0.7       Requirement/file has test
triggers              0.7       Action triggers xstate event
transitions           0.6       Event causes FSM transition
describes             0.5       Concept describes module
constrains            0.5       Derived/inferred relationship
scores                0.4       Risk score on transition
affects               0.4       Debt entry affects requirement
```

### 5.2 Scoring Tiers (aligned with L1/L2/L3)

```
TIER           SCORE RANGE    MEANING
──────────────────────────────────────────────────────
Definitive     0.8 - 1.0      Direct structural link (file ownership, constant mapping)
Structural     0.4 - 0.79     Formal model chain (req → model → invariant)
Semantic       0.1 - 0.39     Concept match, risk association, debt linkage
Unrelated      < 0.1          No meaningful path found
```

This aligns naturally with the existing 3-layer architecture:
- **L1 (Grounding)** → Definitive tier: are the code artifacts actually there?
- **L2 (Abstraction)** → Structural tier: do the formal chains connect?
- **L3 (Validation)** → Semantic tier: do risk/concept/debt signals corroborate?

---

## 6. Integration Points

### 6.1 `nf-solve.cjs` — Replace C→F with graph walk

Current `sweepCtoF()` only checks `constants_validation` mismatches.

New approach:
```
For each constant node with drift.direction != "stable":
  walk graph to find:
    - affected formal models
    - affected invariants
    - affected requirements
  Return enriched residual with full impact chain
```

### 6.2 `formal-scope-scan.cjs` — Proximity-aware matching

Current: exact token match against `concepts` array.

New approach:
```
1. If --files provided: start from code_file nodes, walk to formal_modules
2. If --description provided: match against concept nodes, walk to formal_modules
3. Score each formal_module by proximity
4. Return modules above threshold (default 0.3)
5. Include: affected invariants, constants at risk, requirement coverage
```

### 6.3 `/nf:quick` planner — Pre-flight formal context

Before planning, run:
```
For each file likely to be modified:
  reach(code_file, depth=3)
  If any invariant or requirement is reachable:
    Inject into planner context: "This task touches formal module X.
    Invariants to preserve: [...]. Constants to check: [...]."
```

### 6.4 `/nf:observe` — Debt tagging

When creating debt entries:
```
For each observed drift/issue:
  reach(affected_element, depth=2, filter=[requirement, formal_module])
  Tag debt entry with: modules=[], requirements=[], risk_tier=...
```

---

## 7. File Layout

```
bin/
  formal-proximity.cjs          # Builder: reads all artifacts, emits index
  formal-proximity.test.cjs     # Tests for builder + traversal
  formal-query.cjs              # CLI: query the index (reach, path, neighbors, impact)

.planning/formal/
  proximity-index.json          # The generated graph (bidirectional adjacency list)
  proximity-index.schema.json   # JSON Schema for the index
```

---

## 8. Design Decisions (resolved by quorum 2026-03-07)

Debate record: `.planning/quorum/debates/2026-03-07-formal-proximity-index-design-questions.md`

### 8.1 Graph storage — DECIDED: Flat adjacency list (Option A)

One `nodes` object keyed by `type::id`, each node has an `edges` array. O(1) node lookup, uniform BFS/DFS traversal code. Type-filtered queries use a simple predicate on `node.type` during traversal. If bulk type enumeration is needed later, add a secondary `typeIndex` without restructuring.

### 8.2 Provenance timestamps — DECIDED: Per-source, not per-edge

Add a top-level `sources` block with mtime + content hash per source artifact:

```json
{
  "sources": {
    "constants-mapping.json": { "mtime": "2026-03-07T...", "hash": "abc123" },
    "model-registry.json": { "mtime": "2026-03-05T...", "hash": "def456" }
  }
}
```

Each edge already carries a `source` field — join `edge.source` against `sources[edge.source].mtime` for staleness detection. ~12 entries instead of ~1500 per-edge timestamps. ~1% size increase, not 30%. Full staleness detection preserved.

### 8.3 Cross-repo edges — DECIDED: Deferred, namespace reserved

No current consumer exists. Reserve `repo:type::id` key format in the schema:

```json
{ "node_key_format": "type::id", "note": "Future: repo:type::id for polyrepo" }
```

This prevents a schema break when polyrepo proximity is needed. Build the feature when a concrete integration point (e.g., cross-repo solve sweep) drives the design.

---

## 9. Example: Full Chain Walk

Starting from a code change to `hooks/nf-circuit-breaker.js`:

```
hooks/nf-circuit-breaker.js                    [code_file]
  ├── owns ──> breaker                         [formal_module]
  │     ├── declared_in ──> QGSDBreakerState.tla     [formal_model]
  │     │     ├── declares ──> BreakerTypeOK         [invariant]
  │     │     ├── declares ──> MonotonicTrip          [invariant]
  │     │     └── modeled_by ◄── SAFE-01             [requirement]
  │     │           └── tested_by ──> SAFE-01.stub.test.js  [test_file]
  │     └── describes ◄── circuit-breaker            [concept]
  │
  ├── owns ──> oscillation                     [formal_module]
  │     └── declared_in ──> MCoscillation.cfg        [formal_model]
  │           └── declares ──> Depth                  [constant]
  │                 ├── maps_to ──> circuit_breaker.oscillation_depth  [config_path]
  │                 └── drift: stable, touches: 0
  │
  ├── contains ──> :676                        [code_line]
  │     └── emits ──> circuit_break                  [formal_action]
  │           └── triggers ──> CIRCUIT_BREAK          [xstate_event]
  │                 ├── transitions ──> IDLE → IDLE   [fsm_state]
  │                 │     └── risk_score: 120 (high)
  │                 └── transitions ──> COLLECTING_VOTES → COLLECTING_VOTES
  │                       └── risk_score: 180 (high), coverage_gap: true
  │
  └── tested_by ──> nf-circuit-breaker.test.js [test_file]
```

**One query. Full picture. Every relationship sourced and typed.**
