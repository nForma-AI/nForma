# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**Web Search (Optional):**
- Brave Search API - Optional web search for research agents
  - SDK/Client: Native fetch API (built-in Node.js)
  - Auth: `BRAVE_API_KEY` environment variable
  - Location: `.gsd/brave_api_key` file (alternative to env var)
  - Endpoint: `https://api.search.brave.com/res/v1/web/search`
  - Implementation: `get-shit-done/bin/gsd-tools.cjs` → `cmdWebsearch()` function (lines 2113-2173)
  - Query params: `q`, `count`, `country`, `search_lang`, `text_decorations`, `freshness` (optional)
  - Graceful fallback: If BRAVE_API_KEY not set, returns `{ available: false }` and agents use built-in WebSearch tool

**Package Registry Checks:**
- npm registry - For version update detection
  - Check: `npm view get-shit-done-cc version` (via execSync with 10s timeout)
  - Location: `hooks/gsd-check-update.js` (lines 43-46)
  - Purpose: Background check for available updates, cached to `.claude/cache/gsd-update-check.json`
  - Runs at: Session start (SessionStart hook)
  - Detached process: Yes (background, non-blocking)

## Data Storage

**Databases:**
- None - No database dependency

**File Storage:**
- Local filesystem only
  - User home directory config:
    - `~/.claude/` (Claude Code)
    - `~/.config/opencode/` (OpenCode, XDG compliant)
    - `~/.gemini/` (Gemini CLI)
  - Project config: `.planning/` directory
    - `.planning/config.json` - Project-level configuration
    - `.planning/ROADMAP.md` - Phase/milestone definitions
    - `.planning/phases/` - Phase directories with PLAN.md, SUMMARY.md
    - `.planning/research/` - Research artifacts
    - `.planning/todos/pending/` - Pending todo files
    - `.planning/codebase/` - Generated codebase analysis docs
    - `gsd-file-manifest.json` - SHA256 hashes for file integrity

**Caching:**
- In-memory: None
- Disk cache:
  - `~/.claude/cache/gsd-update-check.json` - Update check cache (JSON, TTL-based)
  - `gsd-local-patches/` - User-modified file backups before reinstall

## Authentication & Identity

**Auth Provider:**
- Custom/None - GSD is a system tool, not user-facing
- No user authentication system

**Integration Auth:**
- BRAVE_API_KEY - Direct API key for Brave Search (optional, graceful degradation if missing)
- AI Runtime Config - Inherits from Claude Code/OpenCode/Gemini settings
  - Model selection: Based on `.planning/config.json` profile (quality/balanced/budget)
  - Agent execution: Delegates to Claude/OpenCode/Gemini CLI with model fallback

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to stdout/stderr in CLI

**Logs:**
- Console output only
  - Status messages: ANSI color codes for terminal UI
  - Errors: Written to stderr via `error()` function
  - JSON output: Optionally via `--raw` flag for machine parsing
  - Hook execution: Silent by default (windowsHide flag on Windows)

**Version Tracking:**
- Update check cache: `~/.claude/cache/gsd-update-check.json`
  - Contains: `update_available`, `installed`, `latest`, `checked` (unix timestamp)
  - Check interval: Once per session (via SessionStart hook)

## CI/CD & Deployment

**Hosting:**
- npm registry (npmjs.com) - Package distribution
- GitHub - Source repository (github.com/glittercowboy/get-shit-done)

**CI Pipeline:**
- GitHub Actions - `.github/workflows/` (not analyzed in detail, files exist)
- Pre-publish hook: `npm run build:hooks` copies hooks to `hooks/dist/`

**Release Process:**
- npm version management via `package.json` (v1.20.5)
- Includes all files from `files` array: bin, commands, get-shit-done, agents, hooks/dist, scripts
- CHANGELOG.md tracked and included in distribution

## Environment Configuration

**Required env vars:**
- None - All have sensible defaults

**Optional env vars:**
- `BRAVE_API_KEY` - Enable web search (Brave Search API token)
- `CLAUDE_CONFIG_DIR` - Override Claude Code config location
- `OPENCODE_CONFIG_DIR` - Override OpenCode config location (takes priority over OPENCODE_CONFIG)
- `OPENCODE_CONFIG` - OpenCode config file path (used to derive config dir)
- `GEMINI_CONFIG_DIR` - Override Gemini CLI config location
- `XDG_CONFIG_HOME` - XDG Base Directory for OpenCode (fallback to ~/.config)

**Secrets location:**
- `BRAVE_API_KEY` - Environment variable (recommended) OR `~/.gsd/brave_api_key` file
- `.env` files - Not used by GSD (GSD is tooling, not a user app)

## Webhooks & Callbacks

**Incoming:**
- None - GSD is a CLI tool, not a web service

**Outgoing:**
- None - GSD doesn't make outgoing webhooks
- Git commits - Writes to local git (respects `git config`, no external calls)

## Sub-Agents & Tool Integration

**AI Runtime Integrations:**
- Claude Code - Primary runtime (`.claude` config location)
  - Agents: Registered in `.claude/agents/gsd-*.md`
  - Commands: Registered in `.claude/commands/gsd/`
  - Hooks: Registered in `.claude/settings.json` (SessionStart for update check, statusLine for display)
  - Tools available to agents: Read, Write, Bash, Grep, Glob, WebSearch, AskUserQuestion, SlashCommand, TodoWrite

- OpenCode (open-source, free models) - Secondary runtime (`.config/opencode` location)
  - Agents: Registered in `.config/opencode/agents/gsd-*.md` (converted from Claude format)
  - Commands: Registered in `.config/opencode/command/gsd-*.md` (flattened structure)
  - Permissions: Configured in `opencode.json` for read access to GSD docs
  - Tools: Mapped via name conversion (Read→read, Write→write, Bash→run_shell_command, etc.)

- Gemini CLI - Tertiary runtime (`.gemini` config location)
  - Agents: Registered in `.gemini/agents/gsd-*.md` (converted from Claude format)
  - Commands: Registered in `.gemini/commands/gsd/` as TOML files (converted from markdown)
  - Experimental agents: Enabled via `settings.json` → `experimental.enableAgents`
  - Tools: Mapped to Gemini snake_case names (Read→read_file, Bash→run_shell_command, etc.)

**Agent Frontmatter Conversion:**
- Claude Code (source format):
  - YAML frontmatter: `allowed-tools:` array, `color:` field
- OpenCode (converted):
  - Tools converted: `Read`→`read`, `AskUserQuestion`→`question`, `SlashCommand`→`skill`, etc.
  - Color: Converted from names (cyan) to hex (#00FFFF)
  - Commands: Flattened (help.md → gsd-help.md)
- Gemini (converted):
  - Tools: Converted to snake_case, excludes MCP tools (auto-discovered), excludes Task tool
  - Color: Removed (not supported by Gemini CLI)
  - Format: Tools as YAML array, body text with template variables escaped ($VAR instead of ${VAR})
  - File format: TOML files instead of markdown

## Model Profile Integration

**Model Selection via Profiles:**
- Location: `get-shit-done/bin/gsd-tools.cjs` → `MODEL_PROFILES` table (lines 132-144)
- Available profiles: quality, balanced, budget
- Profiles map agents to Claude models:
  - `gsd-planner`: quality→opus, balanced→opus, budget→sonnet
  - `gsd-executor`: quality→opus, balanced→sonnet, budget→sonnet
  - `gsd-debugger`: quality→opus, balanced→sonnet, budget→sonnet
  - `gsd-codebase-mapper`: quality→sonnet, balanced→haiku, budget→haiku
  - Others: Mix of opus, sonnet, haiku based on complexity
- Config location: `.planning/config.json` → `model_profile` field
- Resolution: `gsd-tools.cjs` → `cmdResolveModel()` returns model name for agent type

## Version Management

**Local Install Tracking:**
- Manifest file: `.planning/gsd-file-manifest.json`
  - Format: SHA256 hashes keyed by relative path
  - Purpose: Detect user-modified GSD files across updates
  - Backup location: `gsd-local-patches/` directory (if modifications detected)
  - Manual reapply: Via `/gsd:reapply-patches` command

**Update Detection:**
- Hook: `hooks/gsd-check-update.js` runs at SessionStart
- Check: Spawns background process to query npm registry
- Cache: `.claude/cache/gsd-update-check.json` (structured JSON)
- Timeout: 10 seconds (non-blocking)
- Versions compared: installed (from VERSION file) vs latest (from npm)

---

*Integration audit: 2026-02-20*
