# QGSD Formal Verification — TLA+

## Prerequisites

Java >=17 required. Download: https://adoptium.net/

## Setup: Download tla2tools.jar

```bash
curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \
     -o formal/tla/tla2tools.jar
```

tla2tools.jar is gitignored (~50MB). Run the curl command once after cloning.

## Running TLC

```bash
# Safety check (N=5 agents, symmetry, ~30s with -workers auto)
node bin/run-tlc.cjs MCsafety

# Liveness check (N=3 agents, no symmetry, ~60s, -workers 1)
node bin/run-tlc.cjs MCliveness
```

Exit code 0 = no violations found. Exit code 1 = violation or configuration error.

## Files

| File | Purpose |
|------|---------|
| `QGSDQuorum.tla` | TLA+ spec: states, actions, invariants, liveness |
| `MCsafety.cfg` | TLC safety model: N=5, symmetry, INVARIANT + PROPERTY |
| `MCliveness.cfg` | TLC liveness model: N=3, no symmetry, PROPERTY only |

State names mirror the XState machine in `src/machines/qgsd-workflow.machine.ts`.
