-- .planning/formal/alloy/hook-module-existence.als
-- Models the structural existence of solver-discovered hook and config modules.
-- Each module is a required component of the nForma hook subsystem.
-- Source: hooks/config-loader.js, hooks/nf-circuit-breaker.js, hooks/nf-prompt.js,
--         hooks/nf-stop.js, hooks/nf-mcp-dispatch-guard.js
--
-- @requirement SOLVE-19
-- @requirement SOLVE-20
-- @requirement SOLVE-21
-- @requirement SOLVE-22
-- @requirement SOLVE-23

module hook_module_existence

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── Hook modules discovered by the solver ─────────────────────────────

-- @requirement SOLVE-19
-- @requirement SOLVE-20
-- @requirement SOLVE-21
-- @requirement SOLVE-22
-- @requirement SOLVE-23
abstract sig HookModule {
  fileExists: one Bool,
  exportsFunction: one Bool
}

-- @requirement SOLVE-19
one sig ConfigLoader extends HookModule {}

-- @requirement SOLVE-20
one sig CircuitBreaker extends HookModule {}

-- @requirement SOLVE-21
one sig PromptHook extends HookModule {}

-- @requirement SOLVE-22
one sig StopHook extends HookModule {}

-- @requirement SOLVE-23
one sig MCPDispatchGuard extends HookModule {}

-- All discovered modules must exist and export their handler function
-- @requirement SOLVE-19
-- @requirement SOLVE-20
-- @requirement SOLVE-21
-- @requirement SOLVE-22
-- @requirement SOLVE-23
fact AllModulesExist {
  all m: HookModule |
    m.fileExists = True and
    m.exportsFunction = True
}

-- There are exactly 5 solver-discovered hook modules
fact ExactlyFiveModules {
  #HookModule = 5
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement SOLVE-19
assert ConfigLoaderExists {
  ConfigLoader.fileExists = True
}
check ConfigLoaderExists for 5

-- @requirement SOLVE-20
assert CircuitBreakerExists {
  CircuitBreaker.fileExists = True
}
check CircuitBreakerExists for 5

-- @requirement SOLVE-21
assert PromptHookExists {
  PromptHook.fileExists = True
}
check PromptHookExists for 5

-- @requirement SOLVE-22
assert StopHookExists {
  StopHook.fileExists = True
}
check StopHookExists for 5

-- @requirement SOLVE-23
assert MCPDispatchGuardExists {
  MCPDispatchGuard.fileExists = True
}
check MCPDispatchGuardExists for 5
