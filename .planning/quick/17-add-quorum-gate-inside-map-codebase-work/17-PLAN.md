---
task: "Add quorum gate inside map-codebase workflow"
date: 2026-02-21
mode: quick
quorum_override: true
quorum_override_reason: "All 4 external models UNAVAILABLE (Codex limit, Gemini quota, OpenCode timeout, Copilot unavailable). Docs-only change — user approved override."

must_haves:
  truths:
    - map-codebase.md has a new quorum_validate step between verify_output and scan_for_secrets
    - The quorum step presents all 4 docs to quorum models for consistency/completeness/concern-triage review
    - USER-GUIDE.md brownfield diagram shows [QUORUM VALIDATES] gate between mapper outputs and new-project
  artifacts:
    - get-shit-done/workflows/map-codebase.md (new quorum_validate step added)
    - docs/USER-GUIDE.md (brownfield diagram updated)
  key_links:
    - get-shit-done/workflows/map-codebase.md:verify_output → quorum_validate → scan_for_secrets
    - docs/USER-GUIDE.md:192-205 (brownfield diagram)
---

## Task 1 — Add quorum_validate step to map-codebase.md

**Goal:** Insert a new `<step name="quorum_validate">` between `verify_output` and `scan_for_secrets`. After the 7 docs are confirmed to exist, quorum reviews them for consistency, completeness, blind spots, and concern triage before finalizing to disk.

files:
  - get-shit-done/workflows/map-codebase.md

action: |
  Insert a new step between `verify_output` and `scan_for_secrets`:

  ```xml
  <step name="quorum_validate">
  Run quorum validation on the 4 key mapper documents.

  **What quorum checks:**
  - Internal consistency across STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md
  - Completeness — obvious areas not covered by any mapper
  - Blind spots — what the parallel agents likely missed
  - Concern triage — which items in CONCERNS.md should block new work vs be deferred

  **Quorum prompt (use with each available model per R3 and R6):**

  > You are reviewing 4 codebase analysis documents produced by independent mapper agents.
  > Read: .planning/codebase/STACK.md, ARCHITECTURE.md, CONVENTIONS.md, CONCERNS.md
  >
  > Check for:
  > 1. CONSISTENCY — Do the docs contradict each other? (e.g. STACK says event-driven but ARCH says synchronous)
  > 2. COMPLETENESS — Are there obvious areas (security, scaling, auth, data layer) absent from all docs?
  > 3. BLIND SPOTS — What did the parallel agents likely miss by working in isolation?
  > 4. CONCERN TRIAGE — Which CONCERNS.md items should block new feature work vs be deferred?
  >
  > Return: APPROVED (if no significant issues) or ISSUES: [structured list].

  Apply R3 (sequential model calls) and R6 (reduced quorum if models unavailable).

  **On APPROVED (consensus):** Continue to scan_for_secrets.

  **On ISSUES found:**

  Present issues to user:
  ```
  ⚠ Quorum flagged issues in codebase map:

  [List issues — e.g. "STACK says React 18 but ARCH references React 17 hooks pattern"]

  Options:
  1. Edit the affected documents now, then re-run quorum
  2. Accept as-is and proceed to commit (issues noted in CONCERNS.md)
  3. Abort and re-run /qgsd:map-codebase
  ```

  Wait for user response before continuing.

  **If all quorum models UNAVAILABLE (R6.6):** Note reduced quorum, continue to scan_for_secrets (documents are still better than nothing).
  </step>
  ```

  Insert after `verify_output` step closing tag and before `scan_for_secrets` step.
  Also update the `<success_criteria>` to include: "Quorum validates mapper docs before commit".

verify: |
  grep -n "quorum_validate" get-shit-done/workflows/map-codebase.md | wc -l
  # Should be >= 2 (step name + reference)

done: quorum_validate step inserted between verify_output and scan_for_secrets in map-codebase.md

---

## Task 2 — Update USER-GUIDE.md brownfield diagram

**Goal:** Update the brownfield workflow diagram at line ~192 to show the quorum gate between mapper outputs and `/qgsd:new-project`.

files:
  - docs/USER-GUIDE.md

action: |
  Replace the existing brownfield diagram (lines 194-205) with:

  ```
  ### Brownfield Workflow (Existing Codebase)

  ```
    /qgsd:map-codebase
           │
           ├── Stack Mapper     -> codebase/STACK.md
           ├── Arch Mapper      -> codebase/ARCHITECTURE.md
           ├── Convention Mapper -> codebase/CONVENTIONS.md
           └── Concern Mapper   -> codebase/CONCERNS.md
                  │
           [QUORUM VALIDATES]
           • Internal consistency across all 4 docs
           • Completeness & blind spots
           • Concern triage (blocks vs deferred)
                  │
          ┌───────▼──────────┐
          │ /qgsd:new-project │  <- Questions focus on what you're ADDING
          └──────────────────┘
  ```

verify: |
  grep -n "QUORUM VALIDATES" docs/USER-GUIDE.md | wc -l
  # Should be 1

done: USER-GUIDE.md brownfield diagram updated with quorum gate
