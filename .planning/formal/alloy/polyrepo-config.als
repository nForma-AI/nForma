-- .formal/alloy/polyrepo-config.als
-- Models the polyrepo configuration structure: global registry + per-repo markers.
-- Source: bin/polyrepo.cjs
--
-- @requirement CONF-11
-- @requirement CONF-12

module polyrepo_config

-- A polyrepo group has a name and contains repos
-- @requirement CONF-11
sig PolyrepoGroup {
  repos: set Repo
} {
  #repos > 0  -- a group must have at least one repo
}

-- @requirement CONF-11
sig Repo {
  marker: lone RepoMarker  -- per-repo .planning/polyrepo.json (optional)
}

-- @requirement CONF-12
sig RepoMarker {
  docs: set DocEntry  -- optional docs field with merge-semantic entries
}

-- @requirement CONF-12
sig DocEntry {
  semantic: one DocSemantic,
  path: one Path
}

abstract sig DocSemantic {}
one sig User, Developer, Examples, Custom extends DocSemantic {}

sig Path {}

-- @requirement CONF-11
-- Global registry at ~/.claude/polyrepos/<name>.json
one sig GlobalRegistry {
  groups: set PolyrepoGroup
}

-- @requirement CONF-11
-- Each repo belongs to at most one group
fact RepoSingleGroup {
  all r : Repo | lone g : PolyrepoGroup | r in g.repos
}

-- @requirement CONF-12
-- Doc entries within a marker have unique semantics (merge-semantic keys)
fact UniqueDocSemantics {
  all m : RepoMarker |
    all d1, d2 : m.docs |
      d1 != d2 implies d1.semantic != d2.semantic
}

-- @requirement CONF-12
-- Each path belongs to exactly one doc entry
fact PathUniqueness {
  all p : Path | one d : DocEntry | d.path = p
}

-- Satisfiability
run {} for 5

-- @requirement CONF-11
-- Groups in the registry are non-empty (each has at least one repo)
assert GroupsNonEmpty {
  all g : GlobalRegistry.groups | #g.repos > 0
}
check GroupsNonEmpty for 5

-- @requirement CONF-12
-- A marker can have at most 4 doc entries (one per semantic type)
assert MaxFourDocEntries {
  all m : RepoMarker | #m.docs =< 4
}
check MaxFourDocEntries for 5

-- @requirement CONF-12
-- Docs field entries have valid semantics
assert DocSemanticsValid {
  all m : RepoMarker, d : m.docs |
    d.semantic in User + Developer + Examples + Custom
}
check DocSemanticsValid for 5
