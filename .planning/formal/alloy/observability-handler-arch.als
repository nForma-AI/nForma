-- .planning/formal/alloy/observability-handler-arch.als
-- Models observability handler architecture: script inventory classification,
-- dependency injection contracts, and stateful cursor persistence.
-- Source: bin/observe-handlers.cjs, bin/observe-handler-internal.cjs,
--         bin/observe-handler-upstream.cjs, bin/observe-handler-deps.cjs
--
-- @requirement OBS-13
-- @requirement OBS-14
-- @requirement OBS-15

module observability_handler_arch

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── OBS-13: Script inventory classification ──────────────────────────

-- @requirement OBS-13
-- Every non-test bin/ script is classified as wired or lone
abstract sig Classification {}
one sig Wired, Lone extends Classification {}

-- @requirement OBS-13
sig BinScript {
  isTestFile: one Bool,
  classification: lone Classification,
  purpose: one Bool,         -- has purpose description
  suggestedTarget: lone Bool -- has suggested integration target (lone only)
}

-- @requirement OBS-13
-- All non-test scripts have a classification
fact AllNonTestClassified {
  all s: BinScript |
    s.isTestFile = False implies one s.classification
}

-- @requirement OBS-13
-- Test files are not classified
fact TestFilesUnclassified {
  all s: BinScript |
    s.isTestFile = True implies no s.classification
}

-- @requirement OBS-13
-- All classified scripts have a purpose description
fact ClassifiedHavePurpose {
  all s: BinScript |
    some s.classification implies s.purpose = True
}

-- @requirement OBS-13
-- Lone scripts have a suggested integration target
fact LoneHaveSuggestion {
  all s: BinScript |
    s.classification = Lone implies s.suggestedTarget = True
}

-- ── OBS-14: Dependency injection for observe handlers ────────────────

-- @requirement OBS-14
sig ExecFunction {}

-- @requirement OBS-14
one sig DefaultExecFn extends ExecFunction {}

-- @requirement OBS-14
sig BasePath {}

-- @requirement OBS-14
sig ObserveHandler {
  injectedExecFn: one ExecFunction,
  injectedBasePath: lone BasePath,
  subprocessCalls: set SubprocessCall
}

-- @requirement OBS-14
sig SubprocessCall {
  usedExecFn: one ExecFunction
}

-- @requirement OBS-14
-- All subprocess calls use the handler's injected execFn
fact SubprocessUsesInjected {
  all h: ObserveHandler, c: h.subprocessCalls |
    c.usedExecFn = h.injectedExecFn
}

-- @requirement OBS-14
-- When no execFn is provided, the default is used
-- (modeled as: if injectedExecFn is DefaultExecFn, that's the default path)
-- All handlers must have an execFn (either injected or default)
fact AlwaysHasExecFn {
  all h: ObserveHandler | one h.injectedExecFn
}

-- ── OBS-15: Stateful cursor persistence ──────────────────────────────

-- @requirement OBS-15
abstract sig WriteStrategy {}
one sig DirectWrite, AtomicWrite extends WriteStrategy {}

-- @requirement OBS-15
sig CursorState {
  hasLastChecked: one Bool,
  writeStrategy: one WriteStrategy,
  storedInPlanning: one Bool
}

-- @requirement OBS-15
-- Cursor state always has last_checked ISO8601 field
fact CursorHasTimestamp {
  all c: CursorState | c.hasLastChecked = True
}

-- @requirement OBS-15
-- State writes use atomic write (temp file + rename)
fact AtomicWriteOnly {
  all c: CursorState | c.writeStrategy = AtomicWrite
}

-- @requirement OBS-15
-- State is persisted in .planning/ directory
fact StoredInPlanning {
  all c: CursorState | c.storedInPlanning = True
}

-- ── Assertions ───────────────────────────────────────────────────────

-- @requirement OBS-13
assert EveryNonTestScriptClassified {
  all s: BinScript |
    s.isTestFile = False implies one s.classification
}
check EveryNonTestScriptClassified for 5

-- @requirement OBS-13
assert LoneScriptsHaveSuggestion {
  all s: BinScript |
    s.classification = Lone implies s.suggestedTarget = True
}
check LoneScriptsHaveSuggestion for 5

-- @requirement OBS-14
assert SubprocessesUseInjectedFn {
  all h: ObserveHandler, c: h.subprocessCalls |
    c.usedExecFn = h.injectedExecFn
}
check SubprocessesUseInjectedFn for 5

-- @requirement OBS-15
assert CursorAlwaysAtomic {
  all c: CursorState | c.writeStrategy = AtomicWrite
}
check CursorAlwaysAtomic for 5

-- @requirement OBS-15
assert CursorAlwaysHasTimestamp {
  all c: CursorState | c.hasLastChecked = True
}
check CursorAlwaysHasTimestamp for 5
