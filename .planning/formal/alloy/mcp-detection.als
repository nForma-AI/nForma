-- .formal/alloy/mcp-detection.als
-- Models MCP server auto-detection from ~/.claude.json
-- Source: bin/install.js (MCP detection logic)
--
-- @requirement MCP-01
-- @requirement MCP-02
-- @requirement MCP-03
-- @requirement MCP-04
-- @requirement MCP-05
-- @requirement MCP-06

module mcp_detection

-- MCP servers declared in ~/.claude.json
sig MCPServer {
  name: one ServerName,
  toolPrefix: one ToolPrefix
}

-- Detected vs fallback
abstract sig DetectionMode {}
one sig AutoDetected, HardcodedFallback, ManualOverride extends DetectionMode {}

-- Server names (keyword matching)
abstract sig ServerName {}
one sig CodexServer, GeminiServer, OpenCodeServer, OtherServer extends ServerName {}

-- Tool prefixes used by stop hook
abstract sig ToolPrefix {}
one sig CodexPrefix, GeminiPrefix, OpenCodePrefix, OtherPrefix extends ToolPrefix {}

-- The detection result written to qgsd.json
one sig DetectionResult {
  mode: one DetectionMode,
  detectedServers: set MCPServer,
  configuredPrefixes: set ToolPrefix
}

-- A tool_use event that the stop hook checks
sig ToolUse {
  prefix: one ToolPrefix,
  matched: one Bool
}

abstract sig Bool {}
one sig True, False extends Bool {}

-- MCP-01: Installer reads ~/.claude.json to detect servers
-- MCP-02: Detection matches by keyword (case-insensitive)
-- @requirement MCP-01
-- @requirement MCP-02
fact KeywordDetection {
  all s : MCPServer | {
    s.name = CodexServer implies s.toolPrefix = CodexPrefix
    s.name = GeminiServer implies s.toolPrefix = GeminiPrefix
    s.name = OpenCodeServer implies s.toolPrefix = OpenCodePrefix
  }
}

-- MCP-03: Detected names written to qgsd.json
-- @requirement MCP-03
fact DetectedWritten {
  DetectionResult.mode = AutoDetected implies
    #DetectionResult.detectedServers > 0
}

-- MCP-04: No servers found => fallback to hardcoded defaults
-- @requirement MCP-04
fact FallbackWhenEmpty {
  (#MCPServer = 0) implies DetectionResult.mode = HardcodedFallback
  DetectionResult.mode = HardcodedFallback implies
    (CodexPrefix in DetectionResult.configuredPrefixes and
     GeminiPrefix in DetectionResult.configuredPrefixes and
     OpenCodePrefix in DetectionResult.configuredPrefixes)
}

-- MCP-05: Manual override always honored
-- @requirement MCP-05
fact ManualOverrideHonored {
  DetectionResult.mode = ManualOverride implies
    #DetectionResult.configuredPrefixes > 0
}

-- MCP-06: Stop hook matches by prefix
-- @requirement MCP-06
fact PrefixMatching {
  all t : ToolUse |
    t.matched = True iff t.prefix in DetectionResult.configuredPrefixes
}

run {} for 5 MCPServer, 5 ToolUse, 4 int

-- @requirement MCP-04
assert FallbackHasDefaults {
  DetectionResult.mode = HardcodedFallback implies
    #DetectionResult.configuredPrefixes >= 3
}
check FallbackHasDefaults for 5 MCPServer, 5 ToolUse, 4 int

-- @requirement MCP-06
assert PrefixMatchConsistent {
  all t : ToolUse |
    (t.prefix in DetectionResult.configuredPrefixes) iff (t.matched = True)
}
check PrefixMatchConsistent for 5 MCPServer, 5 ToolUse, 4 int
