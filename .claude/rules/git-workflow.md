# Git Workflow Rules

- Install sync required: edits to hook source files in `hooks/` MUST be copied to `hooks/dist/` then run `node bin/install.js --claude --global`
- The installer reads from `hooks/dist/` NOT `hooks/` -- the dist copy is what gets installed to `~/.claude/hooks/`
- Planning artifacts use `node bin/gsd-tools.cjs commit` for commits
- Machine build: `npm run build:machines` produces `dist/machines/nf-workflow.machine.js` (NOT .cjs)
- Skill prefix is `/nf:` -- all commands use this prefix (e.g., /nf:quick, /nf:solve)
- Never force-push to main without explicit user approval
- Hook migration: OLD_HOOK_MAP in install.js removes old qgsd-* hook entries automatically

## Destructive Operations Guard

1. **Commit before destructive git ops**: Before running `git stash`, `git checkout -- .`, `git reset --hard`, or `git clean -f`, ALWAYS commit or confirm that all modified files are either committed or intentionally discardable. Rationale: 15-session analysis showed git stash repeatedly reverted already-completed fixes, creating re-do cycles.

2. **Verify stash is necessary**: Before `git stash`, check if the working changes conflict with the intended operation. Often a targeted `git checkout -- <specific-file>` is safer than a blanket stash. Never stash as a "just in case" step.

3. **Post-stash verification**: After any `git stash pop` or `git stash apply`, immediately verify that the previously-completed work is still intact by running relevant tests or diffing against the expected state.
