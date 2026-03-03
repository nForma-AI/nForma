# Liveness Fairness Declarations: recruiting

**Spec source:** `formal/tla/QGSDRecruiting.tla`
**Config:** `formal/tla/MCrecruiting-liveness.cfg`

## FullRecruitment

**Property:** `FullRecruitment == EnoughResponsive => <>(Cardinality(recruited) = MaxSize)`
**Config line:** `PROPERTIES FullRecruitment` (MCrecruiting-liveness.cfg)
**Fairness assumption:** WF_vars on Finish plus per-slot WF_vars for each SubSlot (TrySubSlot) and ApiSlot (TryApiSlot)
**Realism rationale:** The QGSD quorum slot-trying loop in `bin/call-quorum-slot.cjs` dispatches sub-slots and API slots sequentially. For each responsive slot, the TrySubSlot or TryApiSlot action eventually fires (guaranteed by the slot dispatcher's sequential try loop). WF captures that no responsive slot is permanently skipped. Finish fires once MaxSize slots are recruited; by WF it must eventually fire when enabled. When EnoughResponsive holds (at least MaxSize slots are responsive), termination is guaranteed by these fairness conditions.

**Source:** `formal/tla/QGSDRecruiting.tla`, lines 122, 129–131
