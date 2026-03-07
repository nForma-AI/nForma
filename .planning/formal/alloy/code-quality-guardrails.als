-- .planning/formal/alloy/code-quality-guardrails.als
-- Models the hook system's three code-quality guardrails:
-- post-edit auto-format, console.log guard on Stop, and modular rules directory.
-- Source: hooks/nf-post-edit.js, hooks/nf-stop.js, .claude/rules/
--
-- @requirement GUARD-01

module code_quality_guardrails

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── GUARD-01: Three guardrail types ────────────────────────────────────

-- @requirement GUARD-01
abstract sig GuardrailType {}
one sig PostEditFormat, ConsoleLogGuard, ModularRulesDir extends GuardrailType {}

-- @requirement GUARD-01
sig Guardrail {
  guardrailType: one GuardrailType,
  hookBacked: one Bool,
  active: one Bool
}

-- @requirement GUARD-01
-- PostEditFormat: auto-formats JS/TS files after Edit using prettier/eslint
sig EditEvent {
  fileType: one FileType,
  formatted: one Bool,
  guardrail: one Guardrail
}

abstract sig FileType {}
one sig JavaScript, TypeScript, OtherFile extends FileType {}

-- @requirement GUARD-01
-- Only JS/TS files trigger auto-format
fact FormatOnlyJSTS {
  all e: EditEvent |
    e.guardrail.guardrailType = PostEditFormat implies
      (e.formatted = True iff e.fileType in JavaScript + TypeScript)
}

-- @requirement GUARD-01
-- ConsoleLogGuard: Stop hook checks for console.log in committed code
sig StopCheck {
  hasConsoleLog: one Bool,
  blocked: one Bool,
  guardrail: one Guardrail
}

-- @requirement GUARD-01
-- console.log detected implies block
fact ConsoleLogBlocks {
  all s: StopCheck |
    s.guardrail.guardrailType = ConsoleLogGuard implies
      (s.hasConsoleLog = True implies s.blocked = True)
}

-- @requirement GUARD-01
-- ModularRulesDir: .claude/rules/ directory structure
sig RulesDirectory {
  ruleFiles: set RuleFile,
  isModular: one Bool
}

sig RuleFile {
  scopedToProject: one Bool
}

-- @requirement GUARD-01
-- Modular rules directory has at least one scoped rule file
fact ModularHasRules {
  all d: RulesDirectory |
    d.isModular = True implies some d.ruleFiles
}

-- @requirement GUARD-01
-- All three guardrail types exist
fact AllGuardrailsPresent {
  all t: GuardrailType | some g: Guardrail | g.guardrailType = t
}

-- @requirement GUARD-01
-- All guardrails are hook-backed
fact AllHookBacked {
  all g: Guardrail | g.hookBacked = True
}

-- ── Assertions ─────────────────────────────────────────────────────────

-- @requirement GUARD-01
assert AllThreeGuardrailsExist {
  #GuardrailType = 3 and
  all t: GuardrailType | some g: Guardrail | g.guardrailType = t
}
check AllThreeGuardrailsExist for 5

-- @requirement GUARD-01
assert FormatOnlyCodeFiles {
  all e: EditEvent |
    e.guardrail.guardrailType = PostEditFormat implies
      (e.formatted = True implies e.fileType in JavaScript + TypeScript)
}
check FormatOnlyCodeFiles for 5

-- @requirement GUARD-01
assert ConsoleLogAlwaysBlocked {
  all s: StopCheck |
    (s.guardrail.guardrailType = ConsoleLogGuard and s.hasConsoleLog = True)
      implies s.blocked = True
}
check ConsoleLogAlwaysBlocked for 5
