# VERIFICATION_TOOLS.md — Formal Verification Prerequisites

This file documents installation and usage for all nForma formal verification tools.

## Prerequisites

Install all formal verification tools in one step:

```bash
node bin/install-formal-tools.cjs
# or via the installer:
node bin/install.js --formal
```

This script:
- Checks for Java 17+ (required by TLA+, Alloy, PRISM) and warns if missing
- Downloads `tla2tools.jar` into `~/.local/share/nf-formal/tla/`
- Downloads `org.alloytools.alloy.dist.jar` into `~/.local/share/nf-formal/alloy/`
- Downloads and installs PRISM for your platform, prints `PRISM_BIN` export
- Notes that Petri nets require no install (bundled via npm)
- Offers to add `~/.local/bin` to your PATH if not already configured

Idempotent — safe to run multiple times. Tools are installed system-wide so they persist across projects.

**Uninstall:**

```bash
node bin/install.js --uninstall-formal    # formal tools only
node bin/install.js --uninstall --global  # full nForma uninstall (includes formal tools)
```

If you prefer manual installation, download Java 17 from https://adoptium.net/
and follow the per-tool instructions below.

---

## TLA+ (NFQuorum.tla)

**Download tla2tools.jar** (one-time, gitignored):

```bash
mkdir -p ~/.local/share/nf-formal/tla
curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \
     -o ~/.local/share/nf-formal/tla/tla2tools.jar
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
mkdir -p ~/.local/share/nf-formal/alloy
curl -L https://github.com/AlloyTools/org.alloytools.alloy/releases/download/v6.2.0/org.alloytools.alloy.dist.jar \
     -o ~/.local/share/nf-formal/alloy/org.alloytools.alloy.dist.jar
```

**Run:**

```bash
node bin/run-alloy.cjs  # checks ThresholdPasses / BelowThresholdFails / ZeroApprovalsFail assertions
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
$PRISM_BIN .planning/formal/prism/quorum.pm -pf "P=? [ F s=1 ]"
# Returns: probability of eventually reaching DECIDED state
```

**Export empirical rates from scoreboard:**

```bash
node bin/export-prism-constants.cjs
# Writes: .planning/formal/prism/rates.const
# Copy the const declarations into quorum.pm, or use as -const CLI flags:
$PRISM_BIN .planning/formal/prism/quorum.pm -pf "P=? [ F s=1 ]" \
    -const tp_rate=0.9274 -const unavail=0.0215
```

**Note on variable names:** `rates.const` contains per-slot variables (`tp_gemini`,
`tp_opencode`, `tp_copilot`, `tp_codex`, and their `unavail_*` counterparts). `quorum.pm`
uses aggregate constants (`tp_rate`, `unavail`). A manual aggregation step is required:

```bash
# Example: compute aggregate tp_rate as mean of per-slot rates
# (adjust values from rates.const output)
tp_rate=$(node -e "console.log(((0.9 + 0.85 + 0.88 + 0.92) / 4).toFixed(4))")
unavail=$(node -e "console.log(((0.05 + 0.10 + 0.08 + 0.20) / 4).toFixed(4))")

$PRISM_BIN .planning/formal/prism/quorum.pm -pf "P=? [ F s=1 ]" \
    -const tp_rate=$tp_rate -const unavail=$unavail
```

Replace the example values with the actual values from `.planning/formal/prism/rates.const`.

**Note:** PRISM has no file-include mechanism. `rates.const` is a snippet, not a PRISM import.

---

## Petri Net (no Java required)

```bash
node bin/generate-petri-net.cjs
# Writes: .planning/formal/petri/quorum-petri-net.dot (DOT source)
#         .planning/formal/petri/quorum-petri-net.svg  (SVG via @hpcc-js/wasm-graphviz)
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
