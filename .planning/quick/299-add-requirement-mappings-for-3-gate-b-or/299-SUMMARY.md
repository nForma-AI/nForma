---
status: complete
---

# Quick Task 299: Add requirement mappings for 3 Gate B orphaned models

## What was done

Updated `model-registry.json` to add `requirements` arrays to 3 models that Gate B identified as having no purpose backing:

1. **`.planning/formal/alloy/quorum-votes.als`** -> `["QUORUM-02", "SAFE-01", "SAFE-04"]`
   - Derived from `@requirement` annotations in the .als file
2. **`.planning/formal/petri/account-manager-petri-net.dot`** -> `["CRED-01", "CRED-02"]`
   - OAuth credential pool management FSM maps to credential requirements
3. **`.planning/formal/petri/quorum-petri-net.dot`** -> `["QUORUM-01", "QUORUM-02"]`
   - Quorum voting FSM maps to quorum process requirements

## Impact

- Gate B orphaned_entries: 6 -> 3 (3 models now have purpose backing)
- Gate B purpose score should improve from 0.969
