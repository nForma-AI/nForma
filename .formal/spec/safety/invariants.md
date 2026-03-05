# Liveness Fairness Declarations: safety

**Spec source:** `formal/tla/QGSDQuorum.tla`
**Config:** `formal/tla/MCsafety.cfg`

## AllTransitionsValid

**Property:** `AllTransitionsValid == [][phase = "IDLE" => phase' \in {"IDLE", "COLLECTING_VOTES"}]_vars /\ ...`
**Config line:** `PROPERTY AllTransitionsValid` (MCsafety.cfg)
**Fairness assumption:** None required (temporal safety property — box formula over transitions).

AllTransitionsValid is a conjunction of four `[][P => Q]_vars` clauses — one per state. Each clause constrains which successor states are reachable from a given phase. This is a pure safety property (no `<>` or `~>` operators), so no WF/SF fairness assumption is needed. TLC verifies it by exhaustive state enumeration.

**Source:** `formal/tla/QGSDQuorum.tla`, lines 128–132

## DeliberationMonotone

**Property:** `DeliberationMonotone == [][deliberationRounds' >= deliberationRounds]_vars`
**Config line:** `PROPERTY DeliberationMonotone` (MCsafety.cfg)
**Fairness assumption:** None required (temporal safety property — box formula).

DeliberationMonotone asserts that the deliberation round counter never decreases. This is a `[][...]_vars` formula — a pure safety property checking that every transition preserves monotonicity. No fairness needed.

**Source:** `formal/tla/QGSDQuorum.tla`, lines 143–144
