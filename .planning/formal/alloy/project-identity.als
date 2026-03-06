-- .planning/formal/alloy/project-identity.als
-- Models project identity and naming constraints.
-- Source: bin/install.js, commands/nf/
--
-- @requirement PROJECT-01
-- @requirement PROJECT-02

module project_identity

abstract sig Bool {}
one sig True, False extends Bool {}

-- Context types where the project name appears
abstract sig ContextType {}
one sig UserFacing, Internal extends ContextType {}

-- A context where the project is referenced
sig ProjectReference {
  context: one ContextType,
  usesNForma: one Bool
}

-- PROJECT-01: User-facing contexts use 'nForma'
-- @requirement PROJECT-01
fact UserFacingUsesNForma {
  all r: ProjectReference |
    r.context = UserFacing implies r.usesNForma = True
}

-- Skill shortcuts
sig SkillShortcut {
  usesNfPrefix: one Bool
}

-- PROJECT-02: All skill shortcuts use 'nf:' prefix
-- @requirement PROJECT-02
fact SkillsUseNfPrefix {
  all s: SkillShortcut | s.usesNfPrefix = True
}

-- Assertions
assert AllUserFacingRefsUseNForma {
  all r: ProjectReference |
    r.context = UserFacing implies r.usesNForma = True
}

assert AllSkillsHaveNfPrefix {
  all s: SkillShortcut | s.usesNfPrefix = True
}

check AllUserFacingRefsUseNForma for 5 but 8 ProjectReference
check AllSkillsHaveNfPrefix for 5 but 8 SkillShortcut
