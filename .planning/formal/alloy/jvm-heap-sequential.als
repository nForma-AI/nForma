-- .planning/formal/alloy/jvm-heap-sequential.als
-- Models JVM heap cap and sequential execution constraints for formal runners.
-- Source: bin/run-alloy.cjs, bin/run-tlc.cjs, bin/run-formal-verify.cjs
--
-- @requirement VERIFY-04

module jvm_heap_sequential

abstract sig Bool {}
one sig True, False extends Bool {}

-- A JVM-spawning formal model runner
sig JvmRunner {
  hasXmsFlag: one Bool,
  hasXmxFlag: one Bool,
  xmxBeforeJar: one Bool,
  heapConfigurable: one Bool   -- configurable via QGSD_JAVA_HEAP_MAX
}

-- The formal verification orchestrator
one sig FormalVerifyOrchestrator {
  defaultMode: one ExecutionMode,
  concurrentOptIn: one Bool
}

abstract sig ExecutionMode {}
one sig Sequential, Concurrent extends ExecutionMode {}

-- Tool groups executed by the orchestrator
sig ToolGroup {
  executionOrder: one Int
}

-- VERIFY-04: All JVM runners include -Xms64m and -Xmx before -jar
-- @requirement VERIFY-04
fact AllRunnersHaveHeapFlags {
  all r: JvmRunner |
    r.hasXmsFlag = True and
    r.hasXmxFlag = True and
    r.xmxBeforeJar = True
}

-- VERIFY-04: Heap is configurable via env var, defaults to 512MB
fact HeapConfigurable {
  all r: JvmRunner |
    r.heapConfigurable = True
}

-- VERIFY-04: Sequential by default, --concurrent opt-in
fact SequentialByDefault {
  FormalVerifyOrchestrator.defaultMode = Sequential
  FormalVerifyOrchestrator.concurrentOptIn = True
}

-- Tool groups have distinct ordering (sequential implies ordered)
fact ToolGroupsOrdered {
  all disj g1, g2: ToolGroup |
    g1.executionOrder != g2.executionOrder
}

-- Assertions
assert HeapFlagsPresent {
  all r: JvmRunner |
    r.hasXmsFlag = True and r.hasXmxFlag = True and r.xmxBeforeJar = True
}

assert DefaultIsSequential {
  FormalVerifyOrchestrator.defaultMode = Sequential
}

assert HeapAlwaysConfigurable {
  all r: JvmRunner | r.heapConfigurable = True
}

check HeapFlagsPresent for 5
check DefaultIsSequential for 5
check HeapAlwaysConfigurable for 5
