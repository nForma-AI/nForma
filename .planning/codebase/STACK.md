# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- JavaScript (Node.js) - CLI tool, hooks, installer
- CommonJS (`.cjs`) - GSD tools, build scripts, server-side utilities
- Markdown/YAML - Configuration, templates, documentation

## Runtime

**Environment:**
- Node.js >= 16.7.0 (per `package.json` engines)

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Vanilla Node.js - No framework dependency; uses native modules only

**Build/Dev:**
- esbuild ^0.24.0 - Bundling and minification (installed via package.json)

**Testing:**
- Node.js native `--test` flag - Test runner via `node --test` (see `package.json` scripts)
- Test files: `get-shit-done/bin/gsd-tools.test.cjs`

## Key Dependencies

**None in production** - The codebase uses only Node.js built-in modules:
- `fs` - File system operations
- `path` - Path utilities
- `os` - Operating system utilities
- `readline` - Interactive CLI prompts
- `child_process` - Subprocess and shell command execution (`spawn`, `execSync`)
- `crypto` - File hashing and integrity verification

**Dev Only:**
- `esbuild` ^0.24.0 - Build script for hooks bundling

## Configuration

**Environment:**
- BRAVE_API_KEY - Optional, enables web search via Brave Search API
  - Location: Can be set as env var or stored in `~/.gsd/brave_api_key`
- CLAUDE_CONFIG_DIR - Override default Claude Code config location (default: `~/.claude`)
- OPENCODE_CONFIG_DIR - Override OpenCode config location (default: `~/.config/opencode` per XDG)
- GEMINI_CONFIG_DIR - Override Gemini config location (default: `~/.gemini`)
- XDG_CONFIG_HOME - Used for OpenCode (XDG Base Directory spec)

**Build:**
- `scripts/build-hooks.js` - Copies hooks from `hooks/` to `hooks/dist/` before publish
- `npm run build:hooks` - Executed via `prepublishOnly` hook before npm publish
- No bundler config files (esbuild used only for hook copying)

**Installation Config:**
- `.claude/settings.json` (Claude Code) - Hook registration, statusline config
- `.config/opencode/opencode.json` (OpenCode) - Permission config, disabled_ai_attribution
- `.gemini/settings.json` (Gemini) - Hook registration, experimental.enableAgents
- `.planning/config.json` - User project config (model profile, workflow preferences, Brave Search flag)
- `.planning/gsd-file-manifest.json` - SHA256 hashes of installed files for update detection

## Platform Requirements

**Development:**
- macOS, Windows, or Linux
- Node.js >= 16.7.0
- Git (for version control, commit operations)
- npm (for installation)

**Production (installed to):**
- Claude Code (Windows/macOS) - `~/.claude/` or `./.claude/`
- OpenCode (all platforms) - `~/.config/opencode/` (global) or `./.opencode/` (local)
- Gemini CLI (all platforms) - `~/.gemini/` or `./.gemini/`

## Distribution

**Package:**
- Name: `get-shit-done-cc`
- Version: 1.20.5 (per `package.json`)
- Published to: npm registry
- Installation: `npx get-shit-done-cc@latest`
- Install script: `bin/install.js` - Multi-runtime installer with interactive prompts

**Bin Entry:**
- `get-shit-done-cc` command → `bin/install.js`

**Included Artifacts:**
- `bin/install.js` - Interactive installer (1816 lines, handles Claude Code/OpenCode/Gemini)
- `hooks/gsd-check-update.js` - Update check hook (runs at session start via npm registry query)
- `hooks/gsd-statusline.js` - Status line display hook
- `get-shit-done/` - Core workflow templates, agents, commands, references
- `agents/` - 12 sub-agents (planner, executor, debugger, mapper, etc.)
- `commands/gsd/` - CLI command definitions (~50 markdown files)
- `scripts/build-hooks.js` - Build script to copy hooks to dist before publishing

---

*Stack analysis: 2026-02-20*
