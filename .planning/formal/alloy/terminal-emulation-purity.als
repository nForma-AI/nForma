-- .formal/alloy/terminal-emulation-purity.als
-- Models the structural constraint that the Sessions terminal widget
-- uses pure-JavaScript terminal emulation without native addon dependencies.
-- Source: bin/blessed-terminal.cjs
--
-- @requirement NAV-03

module terminal_emulation_purity

abstract sig DependencyType {}
one sig PureJS, NativeAddon extends DependencyType {}

abstract sig TerminalBackend {
  depType: one DependencyType
}

-- @requirement NAV-03
-- @xterm/headless is pure JavaScript — no native compilation needed
one sig XtermHeadless extends TerminalBackend {} {
  depType = PureJS
}

-- child_process.spawn is built into Node.js — no external native addon
one sig ChildProcessSpawn extends TerminalBackend {} {
  depType = PureJS
}

-- node-pty is a native C++ addon — the banned alternative
one sig NodePty extends TerminalBackend {} {
  depType = NativeAddon
}

-- @requirement NAV-03
sig SessionsWidget {
  termParser: one TerminalBackend,
  processSpawner: one TerminalBackend
} {
  -- Must use pure-JS backends only
  termParser.depType = PureJS
  processSpawner.depType = PureJS
  -- Specifically: xterm/headless + child_process.spawn
  termParser = XtermHeadless
  processSpawner = ChildProcessSpawn
}

run {} for 4

-- @requirement NAV-03
-- No SessionsWidget uses a native addon backend
assert NoNativeAddons {
  all w : SessionsWidget |
    w.termParser.depType = PureJS and
    w.processSpawner.depType = PureJS
}
check NoNativeAddons for 5

-- @requirement NAV-03
-- SessionsWidget never uses node-pty
assert NoNodePty {
  all w : SessionsWidget |
    w.termParser != NodePty and
    w.processSpawner != NodePty
}
check NoNodePty for 5

-- @requirement NAV-03
-- All backends in any widget are compatible across Node.js versions
assert CrossVersionCompatible {
  all w : SessionsWidget |
    no b : w.termParser + w.processSpawner | b.depType = NativeAddon
}
check CrossVersionCompatible for 5
