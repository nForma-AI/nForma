---
name: gsd:audit-milestone
description: Audit milestone completion against original intent before archiving
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
---

<objective>
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

Spawns gsd-milestone-auditor to orchestrate parallel verification, then presents actionable results.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
</execution_context>

<context>
Version: $ARGUMENTS (optional — defaults to current milestone)

**Original Intent:**
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md

**Planned Work:**
@.planning/ROADMAP.md
@.planning/config.json (if exists)

**Completed Work:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
1. **Determine milestone scope**
   - Parse version from arguments or detect current milestone from ROADMAP.md
   - Identify phases in this milestone
   - Extract milestone definition of done

2. **Spawn milestone auditor**
   ```
   Task(
     prompt="Audit milestone {version} completion.

   Milestone scope: Phases {X}-{Y}
   Definition of done: {from ROADMAP.md}

   Check:
   1. Requirements coverage (all milestone REQs satisfied)
   2. Phase goal achievement (re-verify each phase)
   3. Cross-phase integration (wiring between phases)
   4. E2E flows (user can complete promised workflows)

   Create MILESTONE-AUDIT.md with structured gaps.",
     subagent_type="gsd-milestone-auditor"
   )
   ```

3. **Present results**
   Route by status from MILESTONE-AUDIT.md:
   - `passed` → Ready for `/gsd:complete-milestone`
   - `gaps_found` → Present gaps, offer `/gsd:plan-milestone-gaps`
</process>

<offer_next>
**If passed:**

```markdown
## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/MILESTONE-AUDIT.md

All requirements covered. Cross-phase integration verified. E2E flows complete.

---

## ▶ Next Up

**Complete milestone** — archive and tag

`/gsd:complete-milestone {version}`

<sub>`/clear` first → fresh context window</sub>
```

---

**If gaps_found:**

```markdown
## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

### Broken Flows

{For each flow gap:}
- **{flow name}:** breaks at {step}

---

## ▶ Next Up

**Plan gap closure** — create phases to complete milestone

`/gsd:plan-milestone-gaps`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `cat .planning/MILESTONE-AUDIT.md` — see full report
- `/gsd:complete-milestone {version}` — proceed anyway (accept tech debt)
```
</offer_next>

<success_criteria>
- [ ] Milestone scope identified
- [ ] gsd-milestone-auditor spawned with full context
- [ ] MILESTONE-AUDIT.md created
- [ ] Results presented with actionable next steps
</success_criteria>
