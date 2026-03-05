-- .formal/alloy/codebase-arch-constraints.als
-- Models codebase architecture constraints.
-- Source: package.json, bin/gsd-tools.cjs, ~/.claude.json
--
-- @requirement ARCH-10
-- @requirement REN-03
-- @requirement STD-10

module codebase_arch_constraints

abstract sig Bool {}
one sig True, False extends Bool {}

-- A dependency in the package
sig Dependency {
  isLLMSDK: one Bool,
  bundled: one Bool
}

-- ARCH-10: QGSD must not bundle LLM SDKs
-- @requirement ARCH-10
fact NoLLMSDKBundled {
  all d : Dependency |
    d.isLLMSDK = True implies d.bundled = False
}

-- Source file with path references
sig SourceFile {
  hasHardcodedGSDPath: one Bool,
  fileType: one FileType
}

abstract sig FileType {}
one sig BinFile, WorkflowFile, AgentFile, TemplateFile extends FileType {}

-- REN-03: No hardcoded get-shit-done/ paths remain
-- @requirement REN-03
fact NoHardcodedPaths {
  all f : SourceFile |
    f.hasHardcodedGSDPath = False
}

-- NPM package name configuration
abstract sig PackageName {}
one sig Unscoped, Scoped extends PackageName {}

-- STD-10: Gemini MCP server uses unscoped package name
-- @requirement STD-10
one sig GeminiMCPConfig {
  packageName: one PackageName
} {
  packageName = Unscoped
}

-- Satisfiability
run {} for 3 but 3 Dependency, 4 SourceFile

-- @requirement ARCH-10
-- No LLM SDK is ever bundled
assert NoLLMSDKs {
  no d : Dependency | d.isLLMSDK = True and d.bundled = True
}
check NoLLMSDKs for 3 but 5 Dependency, 4 SourceFile

-- @requirement REN-03
-- No file has hardcoded get-shit-done/ paths
assert NoHardcodedGSDPaths {
  no f : SourceFile | f.hasHardcodedGSDPath = True
}
check NoHardcodedGSDPaths for 3 but 3 Dependency, 5 SourceFile

-- @requirement STD-10
-- Gemini package is always unscoped
assert GeminiUnscoped {
  GeminiMCPConfig.packageName = Unscoped
}
check GeminiUnscoped for 3 but 3 Dependency, 4 SourceFile
