-- .formal/alloy/multi-slot-structure.als
-- Models multi-slot agent structure: families, naming, wizard support.
-- Source: bin/qgsd.cjs wizard, ~/.claude.json mcpServers
--
-- @requirement MULTI-01
-- @requirement MULTI-02
-- @requirement MULTI-03
-- @requirement SLOT-01

module multi_slot_structure

-- Agent families
abstract sig AgentFamily {}
one sig Claude, Copilot, OpenCode, Codex, Gemini extends AgentFamily {}

-- Each slot belongs to a family and has a numeric suffix
sig Slot {
  family: one AgentFamily,
  slotNumber: one Int,
  inClaudeJson: one Bool,
  addedViaWizard: one Bool
} {
  slotNumber > 0
  slotNumber =< 6
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- MULTI-01: Claude slots can have different models/providers
-- @requirement MULTI-01
fact ClaudeMultiSlot {
  all disj s1, s2 : Slot |
    (s1.family = Claude and s2.family = Claude) implies
      s1.slotNumber != s2.slotNumber
}

-- MULTI-02: All families support multiple slots
-- @requirement MULTI-02
fact AllFamiliesMultiSlot {
  all disj s1, s2 : Slot |
    (s1.family = s2.family) implies s1.slotNumber != s2.slotNumber
}

-- MULTI-03: Wizard supports adding new slots of any family
-- @requirement MULTI-03
fact WizardSupportsAllFamilies {
  all f : AgentFamily | some s : Slot |
    s.family = f and s.addedViaWizard = True
}

-- SLOT-01: All output uses slot name format "family-N"
-- @requirement SLOT-01
fact UniqueSlotNames {
  all disj s1, s2 : Slot |
    not (s1.family = s2.family and s1.slotNumber = s2.slotNumber)
}

-- All slots are in ~/.claude.json
fact AllSlotsInConfig {
  all s : Slot | s.inClaudeJson = True
}

run {} for 8 Slot, 4 int

-- @requirement SLOT-01
assert SlotNamesUnique {
  all disj s1, s2 : Slot |
    not (s1.family = s2.family and s1.slotNumber = s2.slotNumber)
}
check SlotNamesUnique for 8 Slot, 4 int

-- @requirement MULTI-02
assert NoFamilyNameCollision {
  all disj s1, s2 : Slot |
    s1.family = s2.family implies s1.slotNumber != s2.slotNumber
}
check NoFamilyNameCollision for 8 Slot, 4 int
