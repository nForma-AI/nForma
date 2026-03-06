-- .planning/formal/alloy/headless-execution.als
-- Models the headless execution constraint for formal model runners.
-- Source: bin/run-tlc.cjs, bin/run-alloy.cjs, bin/run-audit-alloy.cjs
--
-- @requirement VERIFY-03

module headless_execution

abstract sig Bool {}
one sig True, False extends Bool {}

-- Formal tool types that use Java
abstract sig FormalTool {}
one sig AlloyTool, TLCTool, PRISMTool, UPPAALTool extends FormalTool {}

-- Whether a tool is Java-based
fun javaTools : set FormalTool {
  AlloyTool + TLCTool + PRISMTool
}

-- A tool invocation with its configuration
sig ToolInvocation {
  tool: one FormalTool,
  headlessFlag: one Bool,
  hasGUI: one Bool
}

-- VERIFY-03: Java-based tools MUST have headless flag
-- @requirement VERIFY-03
fact HeadlessMandatoryForJava {
  all inv : ToolInvocation |
    inv.tool in javaTools implies inv.headlessFlag = True
}

-- VERIFY-03: Headless flag prevents GUI initialization
-- @requirement VERIFY-03
fact HeadlessPreventsGUI {
  all inv : ToolInvocation |
    inv.headlessFlag = True implies inv.hasGUI = False
}

-- VERIFY-03: Non-headless Java tools would have GUI (contrapositive check)
fact NonHeadlessAllowsGUI {
  all inv : ToolInvocation |
    (inv.headlessFlag = False and inv.tool in javaTools) implies inv.hasGUI = True
}

-- Satisfiability: find a valid configuration with multiple invocations
run {} for 3 but 5 ToolInvocation

-- @requirement VERIFY-03
-- All Java tool invocations are headless
assert JavaToolsAlwaysHeadless {
  all inv : ToolInvocation |
    inv.tool in javaTools implies inv.headlessFlag = True
}
check JavaToolsAlwaysHeadless for 5 but 8 ToolInvocation

-- @requirement VERIFY-03
-- No Java tool invocation produces a GUI window
assert NoGUIForJavaTools {
  all inv : ToolInvocation |
    inv.tool in javaTools implies inv.hasGUI = False
}
check NoGUIForJavaTools for 5 but 8 ToolInvocation
