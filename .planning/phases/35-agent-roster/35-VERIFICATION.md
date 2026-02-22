# Phase 35 Verification

status: passed
date: 2026-02-22

## Requirements Verified

### AGENT-01: Add new agent flow
- Roster menu "Add new agent" option: present, no Phase 35 suffix
- Template selection: 5 templates, filtered by existing mcpServers keys
- API key collection via keytar (AGENT_KEY + API_KEY env vars)
- CLAUDE_MCP_PATH resolution: Strategy 1 (read from existing entries) + Strategy 2 (npm root fallback)
- mcpServers entry written via env vars (AGENT_NAME/BASE_URL/MODEL/MCP_PATH/API_KEY_ENV)
- syncToClaudeJson called after write
- mcp-restart invoked after write
- Evidence: `grep -c "CLAUDE_MCP_PATH" commands/qgsd/mcp-setup.md` = 6

### AGENT-02: Remove agent flow
- Sub-menu Option 3 "Remove agent": present, no Phase 35 suffix
- Confirmation prompt with agent name via AskUserQuestion
- Backup: `cp ~/.claude.json ~/.claude.json.backup-$(date ...)`
- Delete: `delete claudeJson.mcpServers[agentName]` via AGENT_NAME env var
- Confirmation display after removal
- No mcp-restart (deregisters on next Claude Code restart)
- Evidence: `grep -c "delete.*mcpServers\|mcpServers.*agentName" commands/qgsd/mcp-setup.md` = 12

### AGENT-03: Identity ping after add
- After mcp-restart, identity tool invoked on new agent
- On success: displays name/version/model
- On timeout/error: graceful message, directs to mcp-status
- Evidence: `grep -c "identity" commands/qgsd/mcp-setup.md` = 10

## File Integrity
- Source line count: 1072
- diff source vs installed: clean (0 differences)
- No Phase 35 stub text in operational sections: confirmed
