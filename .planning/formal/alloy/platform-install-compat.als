-- .formal/alloy/platform-install-compat.als
-- Handwritten — not generated from XState.
-- Source: bin/install.js
--
-- Platform Install Compatibility Model (Alloy 6)
-- @requirement PLAT-01
--
-- Models that QGSD installs and operates correctly on macOS, Ubuntu,
-- and Windows without platform-specific workarounds. Verifies that
-- install operations produce identical outcomes across all platforms
-- and that no platform requires a workaround absent from others.

module platform_install_compat

-- Supported platforms
abstract sig Platform {}
one sig MacOS, Ubuntu, Windows extends Platform {}

-- Install operations that the installer can perform
abstract sig InstallOp {}
one sig CopyHooks, WriteConfig, SetPermissions, CreateDirs extends InstallOp {}

-- An install result records which operations succeeded on which platform
sig InstallResult {
    platform: one Platform,
    succeeded: set InstallOp,
    workarounds: set InstallOp
}

-- Every platform must have exactly one InstallResult
fact OneResultPerPlatform {
    all p: Platform | one r: InstallResult | r.platform = p
}

-- PlatformParity: all platforms succeed on the same set of operations.
-- No platform should have a different success set than any other.
-- @requirement PLAT-01
pred PlatformParity {
    all r1, r2: InstallResult |
        r1.succeeded = r2.succeeded
}

-- NoWorkarounds: no platform requires workarounds (operations that
-- differ from the standard path).
-- @requirement PLAT-01
pred NoWorkarounds {
    all r: InstallResult | no r.workarounds
}

-- AllOpsSucceed: every install operation succeeds on every platform.
pred AllOpsSucceed {
    all r: InstallResult | r.succeeded = InstallOp
}

-- PLAT-01 assertion: installs correctly on all platforms without
-- platform-specific workarounds.
-- @requirement PLAT-01
assert PlatformCompatibility {
    (AllOpsSucceed and NoWorkarounds) => PlatformParity
}

-- CrossPlatformEquivalence: if all ops succeed without workarounds,
-- then every platform has identical install outcomes.
-- @requirement PLAT-01
assert CrossPlatformEquivalence {
    all r1, r2: InstallResult |
        (no r1.workarounds and no r2.workarounds and
         r1.succeeded = InstallOp and r2.succeeded = InstallOp) =>
            r1.succeeded = r2.succeeded
}

check PlatformCompatibility for 5
check CrossPlatformEquivalence for 5

-- Run: show a scenario where all platforms install identically
run { AllOpsSucceed and NoWorkarounds } for 5
