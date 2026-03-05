-- .formal/alloy/config-zero-providers.als
-- Models graceful degradation when providers.json has zero providers.
-- Source: hooks/config-loader.js, bin/providers.json
--
-- @requirement CONF-10

module config_zero_providers

abstract sig Bool {}
one sig True, False extends Bool {}

-- Provider configuration
sig ProviderConfig {
  providerCount: one Int,
  fallbackActive: one Bool,
  soloMode: one Bool
}

-- CONF-10: Zero providers triggers solo mode fallback
-- @requirement CONF-10
fact ZeroProvidersFallback {
  all c: ProviderConfig |
    c.providerCount = 0 implies (c.fallbackActive = True and c.soloMode = True)
}

-- Non-negative provider count
fact ValidProviderCount {
  all c: ProviderConfig | c.providerCount >= 0
}

-- Normal mode when providers exist
fact NormalWithProviders {
  all c: ProviderConfig |
    c.providerCount > 0 implies c.soloMode = False
}

assert FallbackOnZero {
  all c: ProviderConfig |
    c.providerCount = 0 implies c.soloMode = True
}

check FallbackOnZero for 5
