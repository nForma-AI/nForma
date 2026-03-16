---
phase: 307-fix-4-xstate-model-gaps-identified-by-ga
status: complete
---

## Summary

Fixed 2 of 4 Gate A model gaps by replacing phantom requirement IDs in model-registry.json:

### Fixed (phantom requirement IDs)
- **formalism-selection.als**: UPPAAL-04 (non-existent) → SCHEMA-03 (verification runners emit requirement_ids per formalism)
- **model-registry-parity.als**: UPPAAL-05 (non-existent) → INTG-05 (model registry extended with gate fields per formalism)

### Remaining (real requirements, need grounding traces)
- **v8-coverage-digest.als** → TC-01: Real requirement, needs passing trace or unit test coverage path
- **hypothesis-measurement.als** → H2M-01: Real requirement, needs passing trace or unit test coverage path

These 2 remaining gaps will be picked up by the next solve iteration's forward flow (R->F->T->C) since TC-01 and H2M-01 have valid requirements but lack grounding evidence.

### Impact
Gate A grounding score should improve from 0.979 (188/192) to at least 0.990 (190/192) on next diagnostic sweep.
