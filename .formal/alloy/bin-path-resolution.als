-- .formal/alloy/bin-path-resolution.als
-- Models the bin script ROOT path resolution invariant.
-- Source: bin/*.cjs scripts
--
-- @requirement INST-11

module bin_path_resolution

-- Directories in the filesystem
abstract sig Dir {}

-- The user's project directory (where they run commands)
-- @requirement INST-11
one sig ProjectDir extends Dir {}

-- The script install location (~/.claude/bin/ or ~/.claude/qgsd-bin/)
one sig InstallDir extends Dir {}

-- process.cwd() returns the invoking project directory
-- @requirement INST-11
one sig ProcessCwd {
  resolves: one Dir
} {
  resolves = ProjectDir
}

-- __dirname returns the script's own location
one sig Dirname {
  resolves: one Dir
} {
  resolves = InstallDir
}

-- The ROOT variable used by bin scripts
-- @requirement INST-11
one sig ROOT {
  source: one RootSource,
  value: one Dir
}

abstract sig RootSource {}
one sig FromCwd, FromDirname, FromFlag extends RootSource {}

-- @requirement INST-11
-- ROOT defaults to process.cwd(), never __dirname
fact RootDefaultsCwd {
  ROOT.source = FromCwd implies ROOT.value = ProcessCwd.resolves
  ROOT.source = FromFlag implies ROOT.value in Dir  -- explicit override allowed
  ROOT.source != FromDirname  -- __dirname is NEVER used as default
}

-- @requirement INST-11
-- When using default (no --project-root flag), ROOT = process.cwd()
fact DefaultIsCwd {
  ROOT.source in (FromCwd + FromFlag)
}

-- Satisfiability
run {} for 3

-- @requirement INST-11
-- ROOT never resolves to InstallDir when using default
assert NeverResolvesToInstallDir {
  ROOT.source = FromCwd implies ROOT.value != InstallDir
}
check NeverResolvesToInstallDir for 3

-- @requirement INST-11
-- ROOT always points to ProjectDir when no override
assert DefaultIsProjectDir {
  ROOT.source = FromCwd implies ROOT.value = ProjectDir
}
check DefaultIsProjectDir for 3
