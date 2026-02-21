---
type: quick-full
num: 2
slug: in-qgsd-if-a-quorum-approved-a-plan-but-
description: "in QGSD, if a quorum approved a plan, but a member also proposed improvement, the improvements can also be presented to the quorum as a new iteration of the plan, and then another quorum is required on the plan + improvements. This can go on up to 10 times"
date: 2026-02-21

must_haves:
  truths:
    - R3.6 rule exists in CLAUDE.md under R3 (Quorum Protocol), after R3.5
    - Rule clearly states: approval + improvement suggestion triggers a new quorum round on the revised plan
    - Rule caps iterations at 10
    - Rule specifies termination: either no further improvements proposed OR 10 iterations reached
    - Rule handles regression-to-BLOCK: if a refinement causes a model to BLOCK, revert to R3.3 deliberation
    - Rule handles conflicting improvements: Claude acts as tie-breaker after 1 round of conflict
  artifacts:
    - CLAUDE.md (modified — R3.6 added)
  key_links: []
---

# Quick Task 2: Add R3.6 — Iterative Improvement Protocol

## Quorum Result

**CONSENSUS REACHED** (Reduced quorum — Codex UNAVAILABLE/usage limit, noted per R6.3)

- Claude: APPROVE — R3.6, 10 iterations, handle regression + conflicts
- Gemini: APPROVE (revised) — initially suggested 3 rounds, updated to accept 10 after deliberation clarified this is planning-phase policy with a hard ceiling
- OpenCode: APPROVE — R3.6, 10 iterations, revert to R3.3 if consensus fails mid-iteration
- Copilot: APPROVE — R3.6, 10 iterations, escalate on mutually incompatible improvements

## Tasks

### Task 1: Add R3.6 to CLAUDE.md

```yaml
files:
  - CLAUDE.md
action: >
  Insert R3.6 — Iterative Improvement Protocol after R3.5 (Consensus Rules)
  and before the closing --- separator. The new rule governs what happens
  when quorum reaches CONSENSUS but any member also proposes specific
  actionable improvements.
verify: >
  grep -n "R3.6" CLAUDE.md shows the new section.
  The rule appears between R3.5 and the --- closing R3's section.
  Rule text includes: "up to 10", "BLOCK", tie-breaker language.
done: R3.6 section present and correctly positioned in CLAUDE.md
```

**Rule text to insert (after R3.5, before the closing `---`):**

```markdown
### R3.6 — Iterative Improvement Protocol

IF CONSENSUS is reached (all available models APPROVE) but one or more models also propose specific, actionable improvements:

1. Claude MUST incorporate the improvements into a revised plan iteration.
2. Claude MUST present the revised plan to a new QUORUM round.
3. This process MAY repeat up to **10 total iterations**.
4. Claude MUST stop iterating when either:
   - No quorum member proposes further improvements, OR
   - 10 iterations have completed.
5. The final approved plan proceeds to execution.

**Regression handling:** IF a refinement causes any model to switch from APPROVE to BLOCK, Claude MUST treat this as a new BLOCKER (R3.5) and halt execution until the blocking issue is resolved via R3.3 deliberation.

**Conflict handling:** IF quorum members propose mutually incompatible improvements, Claude acts as tie-breaker after 1 deliberation round. IF still unresolved, Claude MUST escalate to the user with all conflicting positions.
```
