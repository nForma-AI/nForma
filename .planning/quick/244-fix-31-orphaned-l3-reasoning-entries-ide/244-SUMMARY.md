## Quick Task 244: Fix 31 orphaned L3 reasoning entries identified by Gate B

### What was done
Regenerated all L3 reasoning artifacts from current L2 semantics data:
- `failure-mode-catalog.cjs` — 32 failure modes (16 omission, 11 commission, 5 corruption)
- `hazard-model.cjs` — 16 hazards scored, 3 critical (max RPN 256), 6 high
- `risk-heatmap.cjs` — 16 risk entries (7 critical, 7 high, 1 medium, 1 low)

### Files modified
- `.planning/formal/reasoning/failure-mode-catalog.json`
- `.planning/formal/reasoning/hazard-model.json`
- `.planning/formal/reasoning/risk-heatmap.json`
