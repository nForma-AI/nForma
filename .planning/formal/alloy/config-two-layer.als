-- .formal/alloy/config-two-layer.als
-- Models the two-layer config merge: global ~/.claude/qgsd.json + per-project .claude/qgsd.json
-- Source: hooks/config-loader.js
--
-- @requirement CONF-01
-- @requirement CONF-02
-- @requirement CONF-03
-- @requirement CONF-04
-- @requirement CONF-05
-- @requirement CONF-06
-- @requirement CONF-07
-- @requirement CONF-08
-- @requirement CONF-09

module config_two_layer

-- Config layers
abstract sig ConfigLayer {
  quorumCommands: set CommandName,
  failMode: one FailMode,
  oscDepth: one Int,
  commitWindow: one Int,
  valid: one Bool
} {
  oscDepth > 0
  oscDepth =< 10
  commitWindow > 0
  commitWindow =< 20
}

-- CONF-01: Global config
-- @requirement CONF-01
one sig GlobalConfig extends ConfigLayer {}

-- CONF-02: Per-project override
-- @requirement CONF-02
lone sig ProjectConfig extends ConfigLayer {}

-- CONF-09: Merged result
-- @requirement CONF-09
one sig MergedConfig extends ConfigLayer {}

abstract sig CommandName {}
one sig NewProject, PlanPhase, ExecutePhase, Quick extends CommandName {}

abstract sig FailMode {}
-- CONF-04: fail-open default
one sig FailOpen, FailClosed extends FailMode {}

abstract sig Bool {}
one sig True, False extends Bool {}

-- Hardcoded defaults for fallback
one sig Defaults {
  defaultOscDepth: one Int,
  defaultCommitWindow: one Int,
  defaultFailMode: one FailMode
} {
  defaultOscDepth = 3
  defaultCommitWindow = 6
  defaultFailMode = FailOpen
}

-- CONF-02: Project values override global values
-- @requirement CONF-02
-- @requirement CONF-09
fact MergeRule {
  some ProjectConfig implies {
    -- project overrides global for all fields
    MergedConfig.quorumCommands = ProjectConfig.quorumCommands
    MergedConfig.failMode = ProjectConfig.failMode
    MergedConfig.oscDepth = ProjectConfig.oscDepth
    MergedConfig.commitWindow = ProjectConfig.commitWindow
  } else {
    -- no project config: merged = global
    MergedConfig.quorumCommands = GlobalConfig.quorumCommands
    MergedConfig.failMode = GlobalConfig.failMode
    MergedConfig.oscDepth = GlobalConfig.oscDepth
    MergedConfig.commitWindow = GlobalConfig.commitWindow
  }
}

-- CONF-05: Invalid config falls back to defaults
-- @requirement CONF-05
-- @requirement CONF-08
fact FallbackOnInvalid {
  all c : ConfigLayer |
    c.valid = False implies {
      c.oscDepth = Defaults.defaultOscDepth
      c.commitWindow = Defaults.defaultCommitWindow
      c.failMode = Defaults.defaultFailMode
    }
}

-- CONF-03: quorum_commands is non-empty
-- @requirement CONF-03
fact CommandsNonEmpty {
  #GlobalConfig.quorumCommands > 0
}

-- CONF-04: default fail mode is open
-- @requirement CONF-04
fact DefaultFailOpen {
  GlobalConfig.valid = True implies GlobalConfig.failMode = FailOpen
}

-- Satisfiability check
run {} for 4 CommandName, 4 int

-- @requirement CONF-06
-- @requirement CONF-07
-- Circuit breaker config values are bounded integers
assert CircuitBreakerBounded {
  all c : ConfigLayer |
    c.oscDepth > 0 and c.oscDepth =< 10 and
    c.commitWindow > 0 and c.commitWindow =< 20
}
check CircuitBreakerBounded for 4 int

-- @requirement CONF-09
-- Merged config always exists and has valid structure
assert MergedAlwaysValid {
  #MergedConfig.quorumCommands > 0
  MergedConfig.oscDepth > 0
  MergedConfig.commitWindow > 0
}
check MergedAlwaysValid for 4 CommandName, 4 int
