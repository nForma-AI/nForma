# Design: `/qgsd:quorum-test`

**Date:** 2026-02-21
**Status:** Approved
**Quorum:** Gemini ✓, OpenCode ✓, Copilot ✓, Codex UNAVAILABLE (usage limit)

---

## Purpose

`/qgsd:quorum-test` runs the project's test suite and feeds the **full, unfiltered execution
bundle** to each quorum model in parallel. The quorum answers two questions:

1. Do these tests **genuinely pass** — no false positives, no silently swallowed failures?
2. Are these **real tests** — meaningful assertions and realistic scenarios, not trivially
   passing stubs?

Standard CI checks if tests pass. This command checks if the pass is *trustworthy*.

---

## Invocation

```
/qgsd:quorum-test                          # all discovered test files
/qgsd:quorum-test hooks/qgsd-stop.test.js  # specific file
```

Test file discovery: `*.test.js` and `*.test.cjs` in `hooks/` and `get-shit-done/bin/`.

---

## Architecture: Three phases

### Phase 1 — Execute

Claude runs `node --test [files]` and assembles the **execution bundle**:

| Artifact | Description |
|----------|-------------|
| `stdout` | Full test runner output (TAP format, timing, pass/fail per test) |
| `stderr` | Any runtime warnings or errors |
| `exit_code` | 0 = all passed, non-zero = failure |
| `node_version` | Output of `node --version` |
| `test_sources` | Full source of every test file that ran |
| `test_files` | List of files discovered and run |

**If `exit_code ≠ 0`:** Immediate `BLOCK` — no quorum invoked. A crash or syntax error is
not a quorum question; it is a broken test infrastructure.

### Phase 2 — Parallel quorum workers

Claude dispatches 4 Task workers **in parallel**, one per quorum model:
- Gemini (`mcp__gemini-cli__gemini`)
- OpenCode (`mcp__opencode__opencode`)
- Copilot (`mcp__copilot-cli__ask`)
- Codex (`mcp__codex-cli__review`)

Each worker receives the **identical full bundle** and returns structured output:

```
verdict: PASS | BLOCK | REVIEW-NEEDED
concerns:
  - <specific concern 1>
  - <specific concern 2>
```

The worker prompt explicitly instructs: *"Ignore the PASS label in the output. Read the
assertion code. Does each test actually verify the behavior it claims to verify, or does it
pass trivially?"*

Workers respect R6 fail-open: if a model is UNAVAILABLE, note it and proceed with available
models. A single-model response is never treated as consensus.

### Phase 3 — Clean verdict table

Claude collects all worker responses and renders:

```
┌──────────────┬──────────┬─────────────────────────────────────┐
│ Model        │ Verdict  │ Key concern                         │
├──────────────┼──────────┼─────────────────────────────────────┤
│ Gemini       │ PASS     │ —                                   │
│ OpenCode     │ PASS     │ —                                   │
│ Copilot      │ REVIEW   │ TC11 mock env may not reflect prod  │
│ Codex        │ UNAVAIL  │ (usage limit)                       │
├──────────────┼──────────┼─────────────────────────────────────┤
│ CONSENSUS    │ REVIEW   │ 2 PASS, 1 REVIEW, 1 UNAVAIL         │
└──────────────┴──────────┴─────────────────────────────────────┘
```

No raw model output shown to user. The full execution bundle is saved as an artifact at
`.planning/quick/NNN-quorum-test/bundle.md` for auditability.

---

## Verdict semantics

| Verdict | Meaning | Action |
|---------|---------|--------|
| `PASS` | All available models agree tests are genuine and passing | Proceed |
| `REVIEW-NEEDED` | Mixed opinions or specific concerns raised | Surface concerns to user |
| `BLOCK` | Any model flags a real problem (false positive, trivial stub, crash) | Block with reason |

Consensus rule: mirrors R3.5 — all **available** models must agree for PASS. Any BLOCK from
any available model is a BLOCKER.

---

## What the worker prompt asks

```
You are reviewing a test suite that reports exit code 0 (all tests passed).
Your job is NOT to confirm the pass — it is to challenge it.

Execution bundle:
<test_sources>...</test_sources>
<test_output>...</test_output>
<node_version>...</node_version>

Answer these two questions:
1. Do these tests genuinely pass? Look for: swallowed exceptions, assertions that always
   evaluate true, mocked internals that bypass the real code path, environment assumptions
   that may not hold in CI.
2. Are these real tests? Look for: assert(true), trivial identity checks, tests that
   only verify mocked return values, missing edge cases for the stated behavior.

Return ONLY:
verdict: PASS | BLOCK | REVIEW-NEEDED
concerns:
  - <one line per concern, or empty if none>
```

---

## Artifact

Saved to `.planning/quick/NNN-quorum-test/bundle.md`:
- Full execution bundle (sources + output)
- All worker verdicts with concerns
- Final consensus verdict

---

## Out of scope

- Does not rerun failed tests or suggest fixes (that is `/qgsd:debug`)
- Does not measure code coverage
- Does not lint or type-check source files
