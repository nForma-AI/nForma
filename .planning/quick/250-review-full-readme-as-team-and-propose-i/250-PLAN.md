# Quick Task 250 — README Improvement Plan (Quorum-Reviewed)

formal_artifacts: none

## must_haves

truths:
- All factual numbers in README match reality (milestone count, command count, model count)
- Git branch template defaults use `nf/` prefix post-rebrand
- No redundant content (formal verification section deduplicated)
- Prerequisite information visible near install command
- Audience framing inclusive of all supported runtimes (not just Claude Code)

artifacts:
- README.md — updated with all improvements

key_links:
- README.md
- commands/nf/ (command count verification)
- docs/assets/ (screenshot deduplication check)

## Task 1: Fix factual inconsistencies and stale references

**files:** README.md
**action:**
1. Update "By the Numbers" table: "31 milestones shipped" → "32 milestones shipped"
2. Update "By the Numbers" table: "30+" slash commands → count actual commands in `commands/nf/` and use real number
3. Clarify "15+ formal verification models" → "15+ formal specifications across 5 tools" (distinguish tools from individual specs)
4. Update git branch template defaults in Configuration Reference: `gsd/phase-{phase}-{slug}` → `nf/phase-{phase}-{slug}`, `gsd/{milestone}-{slug}` → `nf/{milestone}-{slug}`
5. Remove duplicate `tui-solve.png` reference (appears in both Solve Loop section and Observability & Triage collapsible — keep only in Solve Loop)

**verify:** grep for "31 milestones", "gsd/" in branch templates, duplicate tui-solve references — all should be resolved
**done:** All factual numbers correct, git templates rebranded, no duplicate screenshots

## Task 2: Improve information hierarchy and editorial quality

**files:** README.md
**action:**
1. Remove or collapse the redundant "Formal Verification" details block under Features — replace with a single-line cross-reference to the top-level Formal Methods section
2. Add prerequisite note near the install command: "Requires Node.js 18+ and Claude Code (or OpenCode/Gemini CLI)."
3. Broaden "Who This Is For" opening: "If you use Claude Code" → "If you use AI coding agents" (pain points apply to any single-model workflow)
4. Broaden "With vs. Without" table header: "Claude Code Alone" → "Single Agent Alone"
5. Add a one-sentence bridging paragraph after the "How It Works" pipeline diagram, before the numbered workflow steps
6. Add WSL2 note in Node.js support table: Windows row gets "No (WSL2 works)" or similar
7. Soften formal methods CI claim: "CI runs the full verification pipeline on every push" → link to actual CI workflow or qualify the statement
8. Move TUI launch command (`node bin/nForma.cjs`) into the top-level Terminal UI section so it's immediately visible

**verify:** Read through the README top-to-bottom — prerequisite info should be visible near install, no redundant formal section, audience framing is inclusive
**done:** README reads cleanly with improved hierarchy, no redundancy, inclusive framing
