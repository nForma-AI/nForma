# VERIFICATION_TOOLS.md — Formal Verification Prerequisites

This file documents installation and usage for all QGSD formal verification tools.

## Shared Prerequisite: Java 17

TLA+, Alloy, and PRISM are all JVM-based tools. **Install Java 17 once** and all three tools work.

### Install Java 17

Download from https://adoptium.net/ — select Java 17 (LTS).

After install, set JAVA_HOME:

```bash
# macOS (after Adoptium install)
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Linux
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk

# Verify
java --version  # must show "openjdk 17.x.x" or higher
```

---

## TLA+ (QGSDQuorum.tla)

**Download tla2tools.jar** (one-time, gitignored):

```bash
curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \
     -o formal/tla/tla2tools.jar
```

**Run:**

```bash
node bin/run-tlc.cjs MCsafety    # safety check (N=5, symmetry sets, ~30s)
node bin/run-tlc.cjs MCliveness  # liveness check (N=3, no symmetry, ~60s)
```

Exit code 0 = no violations. Exit code 1 = violation or configuration error.

---

## Alloy 6 (quorum-votes.als)

**Download org.alloytools.alloy.dist.jar** (one-time, gitignored):

```bash
curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \
     -o formal/alloy/org.alloytools.alloy.dist.jar
```

**Run:**

```bash
node bin/run-alloy.cjs  # checks NoSpuriousApproval assertion
# Expect: "No counterexample found" (correct model) or counterexample (spec bug)
```

**Important:** Alloy 6 exits 0 even when counterexamples are found. The `run-alloy.cjs` wrapper scans stdout for "Counterexample found" and exits 1 if detected.

---

## PRISM (quorum.pm)

**Install PRISM** (one-time, per platform — not a single JAR):

- Download from https://prismmodelchecker.org/download.php
- Extract and set `PRISM_BIN=/path/to/prism/bin/prism`

**Important:** Always invoke PRISM via its shell script (`bin/prism`), not `java -jar`. PRISM uses JNI native libraries that require its launcher script for correct classpath setup.

**Run the model:**

```bash
$PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]"
# Returns: probability of eventually reaching DECIDED state
```

**Export empirical rates from scoreboard:**

```bash
node bin/export-prism-constants.cjs
# Writes: formal/prism/rates.const
# Copy the const declarations into quorum.pm, or use as -const CLI flags:
$PRISM_BIN formal/prism/quorum.pm -pf "P=? [ F s=1 ]" \
    -const tp_rate=0.9274 -const unavail=0.0215
```

**Note:** PRISM has no file-include mechanism. `rates.const` is a snippet, not a PRISM import.

---

## Petri Net (no Java required)

```bash
node bin/generate-petri-net.cjs
# Writes: formal/petri/quorum-petri-net.dot (DOT source)
#         formal/petri/quorum-petri-net.svg  (SVG via @hpcc-js/wasm-graphviz)
# No system Graphviz install required.
```

---

## npm test (no Java required)

All unit tests in `npm test` run without Java, PRISM, or system Graphviz installed.
JVM invocations are in separate CLI scripts gated on JAVA_HOME/PRISM_BIN.

```bash
npm test
# Runs: lint-isolation + all node:test suites
# All tests pass without any external tool downloads.
```
