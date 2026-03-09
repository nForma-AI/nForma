## Quick Task 243: Fix 87 XState model gaps identified by Gate A grounding check

### What was done
Regenerated `.planning/formal/semantics/observed-fsm.json` from the current conformance trace corpus using `node bin/observed-fsm.cjs`. The previous FSM was stale — generated from older trace data — causing 87 model_gap entries when per-model gate scoring replayed newer traces against it.

### Results
- States observed: 4 (COLLECTING_VOTES, DECIDED, DELIBERATING, IDLE)
- Model coverage: 62.5%
- Vocabulary coverage: 100.0%
- Events: 63048 total, 63032 mapped, 16 unmapped
- Replay modes: per_event=4, per_session=16, sessions=433
- Model comparison: matching=5, missing_in_observed=2, missing_in_model=11

### Files modified
- `.planning/formal/semantics/observed-fsm.json` — regenerated from current trace corpus
