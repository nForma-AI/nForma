# MCP Environment Process Specification

**Requirement:** MCPENV-01
**Phase:** v0.19-05 (MCP Environment Model)
**Status:** Formal specification (machine-checkable encoding in `formal/tla/QGSDMCPEnv.tla`)

---

## 1. MCP as Environment Process

MCP servers (`codex-1`, `gemini-1`, `opencode-1`, `copilot-1`, `claude-1`…`claude-6`) are
**nondeterministic environment processes** from QGSD's perspective. QGSD treats them as black-box
services that can respond, fail, or become unavailable at any time.

### Interaction Model

1. QGSD invokes `call-quorum-slot.cjs` as a subprocess for each quorum slot.
2. Each subprocess issues a CLI or MCP call to the target model.
3. QGSD waits for outcomes up to a configurable timeout.
4. `qgsd-prompt.js` applies consensus logic to the collected outcomes.

This specification defines the **allowed behavior of the MCP environment**, not QGSD's internal
quorum logic. The environment can behave adversarially within these bounds; QGSD must remain correct.

### Scope

- **In scope:** Call outcomes (SUCCESS/FAILURE/TIMEOUT/REORDER), retry timing, and nondeterminism.
- **Out of scope:** MCP protocol wire format, authentication, and model-specific response parsing.

---

## 2. Response Set

Each call-quorum-slot.cjs invocation for slot `s` in round `r` produces exactly one outcome:

| Outcome | Definition |
|---------|-----------|
| **SUCCESS** | Response received within timeout; vote value parsed successfully. `exit(0)` from the subprocess. |
| **FAILURE** | Non-zero exit code; CLI error; HTTP non-200 response; or vote parsing failure (e.g., no parseable APPROVE/BLOCK in output). |
| **TIMEOUT** | No response within the configured timeout (default: `CLAUDE_MCP_TIMEOUT_MS` env var or 120 000 ms hardcoded in `call-quorum-slot.cjs`). |
| **REORDER** | A response arrives for a slot in a previously-cancelled or already-decided round. Handled by `roundCounter` guard in `qgsd-prompt.js`; outcome is silently discarded. |

**Note on REORDER:** REORDER is not modeled as a separate TLC branch in `QGSDMCPEnv.tla`. The
`roundCounter` guard in `qgsd-prompt.js` rejects late responses at the QGSD layer, so TLC treats
each call as atomic within a round. REORDER is documented here for completeness and out-of-band
testing purposes.

---

## 3. Timing Model

### Timeout Defaults

| Source | Value |
|--------|-------|
| `CLAUDE_MCP_TIMEOUT_MS` env var | User-configurable; overrides hardcoded default |
| Hardcoded default in `call-quorum-slot.cjs` | 120 000 ms (2 minutes) |
| Per-provider `quorum_timeout_ms` in `providers.json` | Typically 120 000 ms; overridable |
| `--timeout` flag | Per-invocation override |

### Retry Limits

`call-quorum-slot.cjs` uses `runSubprocessWithRotation()` which reads
`provider.rotation.retry_limit` from `providers.json`. Typical values:

- 2–3 retries per provider before escalating to UNAVAILABLE
- Retries are exhausted per-round, not per-session

### Backoff

`runSubprocessWithRotation()` applies **exponential backoff with jitter**:

- Approximately 1 s, 2 s, 4 s between retries
- Jitter prevents thundering-herd when multiple slots fail simultaneously

### Fairness Assumption

**Weak fairness:** Every enabled MCP slot process eventually receives an outcome
(SUCCESS, FAILURE, or TIMEOUT) within finite time. No permanent suppression of a slot.

This assumption is required for the `EventualDecision` liveness property in `QGSDMCPEnv.tla`.
It is justified by the timeout bound: a slot that never responds will TIMEOUT at most
`MaxRetries × timeout_ms` after being called.

---

## 4. Safety Invariants Quorum Must Preserve

These four invariants must hold for all possible environment behaviors.

### Invariant 1 — Consensus Under Partial Availability

> If ≥ ⌊N/2⌋ + 1 slots respond SUCCESS, quorum reaches consensus.

QGSD's fail-open rule (CLAUDE.md R6) ensures that UNAVAILABLE or TIMEOUT slots are counted as
absent, not as BLOCK votes. Consensus is computed over **available** models only.

### Invariant 2 — Escalation Under Degradation

> If > ⌊N/2⌋ slots become UNAVAILABLE or TIMEOUT, quorum escalates to the user (R6 fail-open)
> rather than deadlocking.

QGSD never blocks indefinitely waiting for unavailable models. The R6 fail-open rule plus per-round
timeout guarantees finite-time escalation.

### Invariant 3 — No Deadlock

> The retry + backoff + timeout combination ensures quorum always makes finite-time progress.

Every round either: (a) collects enough responses for consensus, (b) exhausts retries and marks
slots UNAVAILABLE, or (c) times out and escalates. The combination of per-slot timeouts and
`MaxRetries` bounds ensures no infinite waiting.

### Invariant 4 — Order Independence

> Unanimity check in `qgsd-stop.js` does not depend on response arrival order.

The `roundCounter` guard in `qgsd-prompt.js` discards REORDER responses. The unanimity check
accumulates votes into a set; set membership is order-independent. A quorum round with 3 APPROVE
responses produces the same outcome regardless of the order in which those responses arrive.

---

## 5. Nondeterminism Scope

### TLC Exploration Space

For K active slots, TLC explores:

- **Per slot:** {SUCCESS, FAIL, TIMEOUT} → 3^K combinations per round
- **Availability:** slotStatus ∈ {AVAILABLE, UNAVAILABLE} → 2^K additional combinations
- **Total state space:** bounded by `NumSlots` constant in `MCMCPEnv.cfg` (default K=2)

### REORDER Handling

REORDER is handled by QGSD's `roundCounter` guard, not modeled as a separate TLC branch.
Justification: the guard makes REORDER semantically equivalent to TIMEOUT from the quorum
state machine's perspective. Separate TLC branching would not find additional safety violations.

### Conservative Exploration

TLC explores failure states more aggressively than real-world base rates suggest. This is
intentional — PRISM calibration (see `formal/prism/mcp-availability.pm`) adds empirical rates
from `quorum-scoreboard.json` for probabilistic analysis. TLC provides exhaustive correctness
checking; PRISM provides quantitative availability estimates.

### Symmetry Reduction

Slots are treated as symmetric: slot `1` and slot `2` are interchangeable. Rather than
declaring a TLC `SYMMETRY` set (which requires careful operator compatibility verification),
`NumSlots = 2` is used as a conservative model size that keeps the state space tractable.
Full symmetry sets may be added in a future refinement.

---

## References

- `bin/call-quorum-slot.cjs` — subprocess implementation with retry/timeout logic
- `hooks/qgsd-prompt.js` — `roundCounter` guard and fail-open R6 application
- `hooks/qgsd-stop.js` — unanimity check (order-independent)
- `formal/tla/QGSDMCPEnv.tla` — machine-checkable encoding of this specification
- `formal/tla/MCMCPEnv.cfg` — TLC configuration (NumSlots, QuorumThreshold, invariants)
- `formal/prism/mcp-availability.pm` — probabilistic model calibrated from scoreboard
- CLAUDE.md R6 — Availability and Fail-Open Policy
