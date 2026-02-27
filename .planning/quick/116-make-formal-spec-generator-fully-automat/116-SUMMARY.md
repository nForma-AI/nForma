---
quick: 116
slug: make-formal-spec-generator-fully-automat
description: Make formal spec generator fully automatic by adding XState context fields and GUARD_REGISTRY
status: completed
date: 2026-02-27
commits:
  - 17ee34a  # docs: create plan
  - ad5e1ad  # feat: add maxSize/polledCount context and unanimityMet guard to XState machine
  - 4618236  # feat: add GUARD_REGISTRY to generator, regenerate all formal specs with unanimity semantics
---

# Quick Task 116 — Summary

## Objective

Make the formal spec generator fully automatic. quick-115 extended QGSDQuorum.tla by hand (unanimity semantics, MaxSize constant, polledCount variable) — this task updated the generator to produce those same semantics automatically, closing the drift between the machine and the specs.

## What Was Built

### Task 1: XState Machine — maxSize, polledCount, unanimityMet

Added to `src/machines/qgsd-workflow.machine.ts`:
- `maxSize: number` and `polledCount: number` fields to `QGSDContext` interface
- `maxSize: 3` and `polledCount: 0` to the machine context initializer
- `unanimityMet: ({ context }) => context.successCount >= context.polledCount` guard

`minQuorumMet` was preserved — `unanimityMet` is additive, giving the generator a named guard it can read and translate.

### Task 2: Generator — GUARD_REGISTRY + regeneration

Updated `bin/generate-formal-specs.cjs` with:
- **GUARD_REGISTRY**: maps guard names (`unanimityMet`, `minQuorumMet`, `noInfiniteDeliberation`) to their TLA+, Alloy, PRISM, and TypeScript translations — guard formulas are no longer baked into template strings
- **maxSize extraction**: regex reads `maxSize:\s*(\d+)` from the machine source; `MaxSize = 3` flows into all generated specs without hardcoding
- **polledCount extraction**: reads initial value from machine context
- **TLA+ spec**: MaxSize constant, polledCount variable, UnanimityMet + QuorumCeilingMet invariants, CollectVotes(n,p) with unanimity branch
- **MCsafety.cfg**: MaxSize + INVARIANT UnanimityMet + INVARIANT QuorumCeilingMet
- **MCliveness.cfg**: MaxSize constant
- **Alloy**: UnanimityReached predicate (replaces MajorityReached), polled field on VoteRound
- **PRISM**: unanimityMet comment references from registry

Header restored from "Hand-extended" to "GENERATED — do not edit by hand."

## Verification Results

```
Generator: node bin/generate-formal-specs.cjs → exits 0, writes all 6 files
GUARD_REGISTRY: 51 occurrences in generate-formal-specs.cjs
TLA+ header: "GENERATED — do not edit by hand"
MaxSize: present in QGSDQuorum.tla, MCsafety.cfg, MCliveness.cfg
UnanimityMet: present in QGSDQuorum.tla, MCsafety.cfg
polledCount: present in QGSDQuorum.tla
Stop hook tests: 32/32 pass
```

## Artifacts

| File | Status | Contains |
|------|--------|---------|
| `src/machines/qgsd-workflow.machine.ts` | Updated | maxSize, polledCount, unanimityMet guard |
| `bin/generate-formal-specs.cjs` | Updated | GUARD_REGISTRY, maxSize extraction |
| `formal/tla/QGSDQuorum.tla` | Regenerated | MaxSize, polledCount, UnanimityMet, QuorumCeilingMet |
| `formal/tla/MCsafety.cfg` | Regenerated | MaxSize, UnanimityMet, QuorumCeilingMet |
| `formal/tla/MCliveness.cfg` | Regenerated | MaxSize |
| `formal/alloy/quorum-votes.als` | Regenerated | UnanimityReached, polled field |
| `formal/prism/quorum.pm` | Regenerated | unanimityMet comment reference |
| `formal/prism/quorum.props` | Regenerated | Updated comments |

## Key Decision

`minQuorumMet` remains in the machine for backward compatibility — it was the original majority guard, now deprecated in favor of unanimityMet but kept so existing machine transitions don't break. The generator uses `unanimityMet` exclusively for formal spec output.
