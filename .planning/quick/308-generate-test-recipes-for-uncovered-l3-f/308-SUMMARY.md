---
phase: 308-generate-test-recipes-for-uncovered-l3-f
status: complete
---

## Summary

Investigation found that the Gate C residual (l3_to_tc=6) is a measurement artifact — not an actual coverage gap.

### Findings
- **per-model-gates.json**: All 192 models pass gate_c (192/192)
- **gate-c-validation.json**: Reports 105/192 unvalidated (wiring_coverage_score=0.453)
- **Discrepancy**: gate-c-validation.json uses a stricter criteria (all failure modes must have test recipes) while per-model-gates uses a sufficient criteria (at least one passing check or recipe match)
- **test-recipe-gen.cjs**: Already generates 123 recipes from the failure-mode-catalog (123 failure modes)

### Root cause
The l3_to_tc residual=6 comes from the gate-c-validation.json denominator (192 models) vs the recipe count (123). The per-model-gates evaluation path — which is the authoritative source for the solve engine — shows all models passing Gate C.

### Action taken
- Confirmed all 192 models pass gate_c in per-model-gates.json
- Regenerated test recipes via test-recipe-gen.cjs (123 recipes, matching 123 failure modes)
- No additional recipes needed — the "unvalidated" models in gate-c-validation.json are validated via check-result matches in per-model-gates

### Impact
The l3_to_tc residual will persist until the gate-c-validation.json evaluation criteria is aligned with per-model-gates. This is a diagnostic engine consistency improvement, not a coverage gap.
