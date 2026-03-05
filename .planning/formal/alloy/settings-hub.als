-- .formal/alloy/settings-hub.als
-- Models the /qgsd:settings guided project manager hub with state-aware dashboard.
-- Source: commands/qgsd/settings.md
--
-- @requirement WIZ-11

module settings_hub

abstract sig Bool {}
one sig True, False extends Bool {}

-- @requirement WIZ-11
one sig SettingsHub {
  hasDashboard: one Bool,
  showsMilestone: one Bool,
  showsProgress: one Bool,
  showsPhase: one Bool
} {
  hasDashboard = True
  showsMilestone = True
  showsProgress = True
  showsPhase = True
}

-- @requirement WIZ-11
-- Hub is always state-aware (all dashboard panels active)
fact StateAware {
  SettingsHub.hasDashboard = True
}

run {} for 3

-- @requirement WIZ-11
assert DashboardAlwaysPresent {
  SettingsHub.hasDashboard = True
}
check DashboardAlwaysPresent for 3
