# Liveness Fairness Declarations: installer

**Spec source:** `formal/tla/QGSDInstallerIdempotency.tla`
**Config:** `formal/tla/MCinstaller.cfg`

## OverridesPreserved

**Property:** `OverridesPreserved == [][projectOverrides = TRUE => projectOverrides' = TRUE]_vars`
**Config line:** `PROPERTY OverridesPreserved` (MCinstaller.cfg)
**Fairness assumption:** None required (temporal safety property — box formula).

OverridesPreserved asserts that once project overrides are set, they are never cleared by subsequent install operations. This is a `[][...]_vars` formula — a pure safety property over transitions. No WF/SF fairness assumption is needed. The installer Spec definition contains no fairness clauses (`Spec == Init /\ [][Next]_vars`), confirming this is purely a safety model.

**Source:** `formal/tla/QGSDInstallerIdempotency.tla`, lines 79–80, 82–85
