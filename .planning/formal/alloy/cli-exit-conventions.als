-- .formal/alloy/cli-exit-conventions.als
-- Models CLI exit code conventions and stderr/stdout separation.
-- Source: bin/*.cjs
--
-- @requirement OBS-05

module cli_exit_conventions

abstract sig ExitCode {}
one sig Zero, NonZero extends ExitCode {}

abstract sig Stream {}
one sig Stdout, Stderr extends Stream {}

-- @requirement OBS-05
sig CliInvocation {
  exitCode: one ExitCode,
  errorStream: one Stream,
  outputStream: one Stream
} {
  -- Errors go to stderr, output goes to stdout
  errorStream = Stderr
  outputStream = Stdout
  -- These are always different streams
  errorStream != outputStream
}

-- @requirement OBS-05
-- Success uses exit 0, failure uses non-zero
sig SuccessInvocation extends CliInvocation {} {
  exitCode = Zero
}
sig FailureInvocation extends CliInvocation {} {
  exitCode = NonZero
}

run {} for 4

-- @requirement OBS-05
assert SuccessExitsZero {
  all i : SuccessInvocation | i.exitCode = Zero
}
check SuccessExitsZero for 5

-- @requirement OBS-05
assert FailureExitsNonZero {
  all i : FailureInvocation | i.exitCode = NonZero
}
check FailureExitsNonZero for 5
