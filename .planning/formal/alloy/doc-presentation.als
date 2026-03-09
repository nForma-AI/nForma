-- .planning/formal/alloy/doc-presentation.als
-- Models documentation presentation constraints: README formal verification
-- section hides internals, and TUI asset generation is deterministic from live modules.
-- Source: README.md, bin/generate-tui-assets.cjs, bin/nForma.cjs
--
-- @requirement DOC-02
-- @requirement DOC-03

module doc_presentation

abstract sig Bool {}
one sig True, False extends Bool {}

-- ── DOC-02: README Formal Verification section ─────────────────────────

-- @requirement DOC-02
sig ReadmeSection {
  presentsCapabilities: one Bool,
  exposesInternalModelNames: one Bool,
  exposesDirectoryTrees: one Bool,
  exposesCIPipelineDetails: one Bool,
  linksToVerificationTools: one Bool
}

-- @requirement DOC-02
-- The formal verification section presents user-facing capabilities
-- without exposing internal model names, directory trees, or CI details
fact FormalVerificationSectionUserFacing {
  all s: ReadmeSection |
    s.presentsCapabilities = True and
    s.exposesInternalModelNames = False and
    s.exposesDirectoryTrees = False and
    s.exposesCIPipelineDetails = False and
    s.linksToVerificationTools = True
}

-- ── DOC-03: TUI asset generation pipeline ───────────────────────────────

-- @requirement DOC-03
sig TUIModule {
  hasHeadlessOutput: one Bool
}

-- @requirement DOC-03
sig SVGAsset {
  generatedFrom: one TUIModule,
  usesTokyoNightTheme: one Bool,
  outputDir: one AssetDir
}

one sig DocsAssetsDir extends AssetDir {}
abstract sig AssetDir {}

-- @requirement DOC-03
-- nForma.cjs --screenshot renders each module headlessly as synthetic ANSI
fact HeadlessScreenshot {
  all m: TUIModule | m.hasHeadlessOutput = True
}

-- @requirement DOC-03
-- generate-tui-assets.cjs converts ANSI output to Tokyo Night SVG in docs/assets/
fact DeterministicSVGGeneration {
  all svg: SVGAsset |
    svg.usesTokyoNightTheme = True and
    svg.outputDir = DocsAssetsDir and
    svg.generatedFrom.hasHeadlessOutput = True
}

-- @requirement DOC-03
-- Every TUI module produces exactly one SVG asset
fact OneAssetPerModule {
  all m: TUIModule | one svg: SVGAsset | svg.generatedFrom = m
}

-- Assertions
assert NoInternalExposure {
  all s: ReadmeSection |
    s.exposesInternalModelNames = False and
    s.exposesDirectoryTrees = False and
    s.exposesCIPipelineDetails = False
}

assert AllAssetsFromLiveModules {
  all svg: SVGAsset | svg.generatedFrom.hasHeadlessOutput = True
}

check NoInternalExposure for 5 but 3 ReadmeSection
check AllAssetsFromLiveModules for 5 but 5 TUIModule, 5 SVGAsset
