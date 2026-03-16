---
phase: 306-fix-f-c-conformance-trace-divergences-ci
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/formal/.divergences.json
autonomous: true
requirements: []
formal_artifacts: none
---

<objective>
Fix F->C conformance trace divergences: the solver reported 2 F->C residual based on stale .divergences.json (dated 2026-03-05). Running validate-traces.cjs fresh shows 100.0% valid (77820/77820 traces). The fix is removing the stale divergences file so the next diagnostic sweep reads zero divergences.
</objective>

<tasks>
<task type="auto">
  <name>Remove stale divergences file</name>
  <files>.planning/formal/.divergences.json</files>
  <action>
  1. Run validate-traces.cjs to confirm 0 divergences
  2. Remove stale .planning/formal/.divergences.json (dated 2026-03-05)
  </action>
  <verify>ls .planning/formal/.divergences.json should return "not found"</verify>
  <done>Stale divergences file removed. Next diagnostic sweep will read 0 F->C residual.</done>
</task>
</tasks>
