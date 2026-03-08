---
paths:
  - "hooks/**/*.js"
  - "hooks/dist/**/*.js"
  - "bin/install.js"
  - ".planning/**"
---

# Git Workflow Rules

- Install sync required: edits to hook source files in `hooks/` MUST be copied to `hooks/dist/` then run `node bin/install.js --claude --global`
- The installer reads from `hooks/dist/` NOT `hooks/` -- the dist copy is what gets installed to `~/.claude/hooks/`
- Planning artifacts use `node bin/gsd-tools.cjs commit` for commits
- Machine build: `npm run build:machines` produces `dist/machines/nf-workflow.machine.js` (NOT .cjs)
- Skill prefix is `/nf:` -- all commands use this prefix (e.g., /nf:quick, /nf:solve)
- Never force-push to main without explicit user approval
- Hook migration: OLD_HOOK_MAP in install.js removes old qgsd-* hook entries automatically
