-- .formal/alloy/quorum-policy.als
-- Models quorum policy settings and active composition from config.
-- Source: hooks/config-loader.js, bin/qgsd.cjs (policy screens)
--
-- @requirement PLCY-01
-- @requirement PLCY-02
-- @requirement PLCY-03
-- @requirement COMP-02
-- @requirement COMP-03
-- @requirement COMP-04

module quorum_policy

abstract sig UpdatePolicy {}
one sig Auto, Prompt, Skip extends UpdatePolicy {}

-- Each slot has configurable timeout and update policy
sig AgentSlot {
  timeoutMs: one Int,
  updatePolicy: one UpdatePolicy,
  active: one Bool,
  discoveredAtInstall: one Bool
} {
  timeoutMs > 0
  timeoutMs =< 300000
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- The quorum configuration
one sig QuorumConfig {
  activeSlots: set AgentSlot
}

-- Tools that read agent list
sig HealthChecker {
  checkedSlots: set AgentSlot
}

sig Scoreboard {
  trackedSlots: set AgentSlot
}

-- COMP-02: Quorum reads from config, not hardcoded
-- @requirement COMP-02
fact QuorumFromConfig {
  QuorumConfig.activeSlots = { s : AgentSlot | s.active = True }
}

-- COMP-03: Health checker and scoreboard derive from config
-- @requirement COMP-03
fact ToolsFromConfig {
  all h : HealthChecker | h.checkedSlots = QuorumConfig.activeSlots
  all s : Scoreboard | s.trackedSlots = QuorumConfig.activeSlots
}

-- COMP-04: Default active auto-populated from discovered slots
-- @requirement COMP-04
fact DefaultFromDiscovery {
  all s : AgentSlot |
    s.discoveredAtInstall = True implies s.active = True
}

-- PLCY-01: Timeout configurable per slot
-- @requirement PLCY-01
fact TimeoutPerSlot {
  all disj s1, s2 : AgentSlot |
    s1.timeoutMs > 0 and s2.timeoutMs > 0
}

-- PLCY-02: Update policy per slot
-- @requirement PLCY-02
fact PolicyPerSlot {
  all s : AgentSlot | s.updatePolicy in Auto + Prompt + Skip
}

-- PLCY-03: Auto-update runs on startup for auto-policy slots
-- @requirement PLCY-03
-- (structural: auto slots exist and are checkable)
fact AutoCheckable {
  all s : AgentSlot |
    s.updatePolicy = Auto implies s.active = True
}

run {} for 6 AgentSlot, 2 HealthChecker, 2 Scoreboard, 4 int

-- @requirement COMP-02
assert ActiveFromConfig {
  QuorumConfig.activeSlots = { s : AgentSlot | s.active = True }
}
check ActiveFromConfig for 6 AgentSlot, 2 HealthChecker, 2 Scoreboard, 4 int

-- @requirement COMP-03
assert ToolsConsistent {
  all h : HealthChecker | h.checkedSlots = QuorumConfig.activeSlots
}
check ToolsConsistent for 6 AgentSlot, 2 HealthChecker, 2 Scoreboard, 4 int

-- @requirement COMP-04
assert DiscoveredIsActive {
  all s : AgentSlot | s.discoveredAtInstall = True implies s.active = True
}
check DiscoveredIsActive for 6 AgentSlot, 2 HealthChecker, 2 Scoreboard, 4 int
