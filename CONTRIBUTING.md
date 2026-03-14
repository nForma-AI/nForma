# Contributing to nForma

Thanks for your interest in contributing! nForma welcomes contributions of all kinds — bug reports, documentation improvements, new features, and formal verification specs.

## Prerequisites

- **Node.js 18+** (22.x recommended). Use [nvm](https://github.com/nvm-sh/nvm) to manage versions:
  ```bash
  nvm install 22
  nvm use 22
  ```
- **Java 17+** (only if working on formal verification specs). Install via [Adoptium](https://adoptium.net/).

## Getting Started

```bash
git clone https://github.com/nForma-AI/nForma.git
cd nForma
npm install
node bin/install.js --claude --local
```

## Running Tests

```bash
# Full suite (unit + TUI + formal)
npm test

# Unit tests only (fast, no Java needed)
npm run test:ci

# TUI regression tests
npm run test:tui

# Formal verification tests (requires Java 17+)
npm run test:formal

# Run only tests affected by your changes
npm run test:changed
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `bin/` | CLI scripts, installers, formal verification runners |
| `commands/nf/` | Slash command definitions (skill markdown files) |
| `core/` | Workflows, templates, references |
| `hooks/` | Claude Code lifecycle hooks (source) |
| `hooks/dist/` | Built hook files (synced by install) |
| `agents/` | Subagent definitions |
| `src/machines/` | XState state machine definitions |
| `test/` | Integration and regression tests |
| `.planning/formal/` | Formal verification specs (TLA+, Alloy, PRISM) |

## Common Workflows

### Editing hooks

Hook source files live in `hooks/`. After editing, sync and install:

```bash
cp hooks/your-hook.js hooks/dist/
node bin/install.js --claude --global
```

The installer reads from `hooks/dist/`, not `hooks/` directly.

### Editing workflows

Workflow source lives in `core/workflows/`. After editing, sync:

```bash
cp core/workflows/your-workflow.md ~/.claude/nf/workflows/
```

Or re-run the installer to sync all files.

### Formal verification

```bash
# Run full pipeline
node bin/run-formal-verify.cjs

# Run specific tool
node bin/run-formal-verify.cjs --only=tla
node bin/run-formal-verify.cjs --only=alloy
```

See [VERIFICATION_TOOLS.md](VERIFICATION_TOOLS.md) for setup details.

## Pull Request Guidelines

1. **Keep PRs focused** — one feature or fix per PR
2. **Run tests** — `npm run test:ci` must pass before submitting
3. **Describe the "why"** — PR descriptions should explain motivation, not just what changed
4. **Follow existing patterns** — match the style of surrounding code

## Good First Issues

Look for issues labeled [`good first issue`](https://github.com/nForma-AI/nForma/labels/good%20first%20issue) for approachable starting points. These typically include:

- Documentation improvements
- Hook behavior enhancements
- TUI module additions
- Test coverage improvements

## Questions?

- Start a [Discussion](https://github.com/nForma-AI/nForma/discussions) on GitHub
- Join the [Discord](https://discord.gg/M8SevJEuZG)
