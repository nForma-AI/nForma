# Contributing to Get Shit Done

No enterprise theater. Ship useful code.

## Philosophy

GSD optimizes for **solo developer + Claude workflow**. The release process follows the same principle: complexity lives in automation, not your workflow.

## Branch Strategy

```
main ════════════════════════════════════════════►
         ▲         ▲         ▲         ▲
         │         │         │         │
      v1.9.0    v1.9.1    v1.10.0   v2.0.0
```

### `main`

Production. Always installable via `npx get-shit-done-cc`.

- Must pass CI (catches Windows/cross-platform issues)
- Protected from force pushes

### Who Can Commit Directly to Main

| Role | Direct commits | Branch + PR |
|------|----------------|-------------|
| Maintainers | Any change | Never required |
| Contributors | Typo/doc fixes only | All code changes |

**Why no PRs for maintainers?** Self-reviewed PRs are ceremony without value. CI still runs on push. For risky features, use pre-release tags instead.

### Feature Branches (Contributors)

```bash
git checkout -b feat/model-profiles
# or fix/windows-paths, docs/examples

git push origin feat/model-profiles
# Open PR, get review, merge
```

**Branch naming:**
- `feat/description` — New capability
- `fix/description` — Bug fix
- `docs/description` — Documentation only
- `refactor/description` — Internal changes

## Commits

Use conventional commits.

```
feat(checkpoints): add rollback capability
fix(install): use absolute paths on Windows (#207)
docs(readme): update installation instructions
refactor(orchestrator): extract context loading
```

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code change without behavior change |
| `chore` | Maintenance, dependencies |
| `revert` | Undoing previous commit |

## Releases

### Tag Strategy

| Change Type | Tag? | Version Bump |
|-------------|------|--------------|
| Breaking change | Yes | MAJOR (2.0.0) |
| New feature | Yes | MINOR (1.10.0) |
| Bug fix | Batch weekly | PATCH (1.9.x) |
| Documentation | No | — |

### Pre-release Tags for Risky Features

For experimental features, use pre-release tags:

```bash
npm version prerelease --preid=alpha  # v1.10.0-alpha.0
git push origin main --tags
```

Users opt-in: `npm install get-shit-done-cc@1.10.0-alpha.0`

If it doesn't work out, delete the tag. No messy public revert.

### Creating a Release

Run `/gsd-publish-version` which walks you through:
1. Changelog generation from commits
2. Version bump
3. Push to GitHub

GitHub Actions automatically:
- Creates the GitHub Release from CHANGELOG.md
- Publishes to npm

## Pull Request Guidelines (Contributors)

### Title

Use conventional commit format:
```
feat(checkpoints): add rollback capability
fix(install): use absolute paths on Windows
```

### Description

- **What:** One sentence describing the change
- **Why:** One sentence explaining the need
- **Testing:** How you verified it works
- **Breaking Changes:** List any, or "None"

### Checklist

- [ ] Follows GSD style (no enterprise patterns)
- [ ] Updates CHANGELOG.md for user-facing changes
- [ ] No unnecessary dependencies
- [ ] Works on Windows (test backslash paths)

## What NOT to Do

**Enterprise patterns (banned):**
- Story points, sprint ceremonies
- RACI matrices, release committees
- Multi-week stabilization branches

**Vague commits (banned):**
```
# Bad
"Improve performance"
"Fix bugs"

# Good
"Reduce orchestrator context load from 12KB to 4KB"
"Fix Windows path handling in hook commands (#207)"
```

## Development Setup

```bash
git clone https://github.com/glittercowboy/get-shit-done.git
cd get-shit-done
npm install
npm link
npx get-shit-done-cc --version
```

## Getting Help

- **Issues:** Bug reports, feature requests
- **Discussions:** Questions, ideas
