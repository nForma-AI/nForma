# Requirements: QGSD v0.24 Quorum Reliability Hardening

**Defined:** 2026-03-02
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following — a Stop hook that reads the transcript makes it impossible for Claude to skip quorum.

## v0.24 Requirements — Quorum Reliability Hardening

Make quorum dispatch reliable end-to-end — every quorum call reliably delivers 3 votes by detecting dead slots pre-dispatch, self-healing around mid-session failures without user action, and providing observability into slot health, success rates, and flakiness.

### Dispatch Reliability

- [ ] **DISP-01**: qgsd-prompt.js runs a fast health probe (<3s) per provider before building the dispatch list — dead providers' slots excluded from DISPATCH_LIST
- [ ] **DISP-02**: qgsd-prompt.js reads scoreboard `availability` windows and excludes slots whose `available_at` is in the future from dispatch
- [ ] **DISP-03**: Dispatch list ordered by recent success rate (from scoreboard slot stats) rather than static FALLBACK-01 tier sequence — most reliable slots dispatched first

### Failover & Recovery

- [ ] **FAIL-01**: call-quorum-slot.cjs retries a failed slot call up to 2 times with exponential backoff (1s, 3s) before recording UNAVAIL in quorum-failures.json
- [ ] **FAIL-02**: providers.json contains explicit slot-to-provider mapping; when a provider probe returns DOWN, all slots on that provider skipped in a single dispatch decision

### Observability

- [ ] **OBS-01**: Each quorum round emits structured telemetry (slot, round, verdict, latency_ms, provider status) to a per-session log file
- [ ] **OBS-02**: Scoreboard tracks quorum delivery rate — percentage of calls that achieved target vote count (3/3 vs degraded 2/3)
- [ ] **OBS-03**: Each slot gets a flakiness score from recent UNAVAIL/timeout frequency; high-flakiness slots deprioritized in dispatch ordering

### Self-Healing

- [ ] **HEAL-01**: After each deliberation round, system computes P(consensus | remaining rounds); if P < threshold (default 10%), escalation fires early instead of exhausting maxDeliberation
- [ ] **HEAL-02**: When verify-quorum-health detects P(consensus) < 95%, it recommends and auto-adjusts maxDeliberation in qgsd.json (with user approval)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mid-run provider re-probe during deliberation | Complex MCP interception; defer to v0.25 |
| Request rate limiting per provider | Not a current pain point; defer to v0.25+ |
| Direct MCP health_check without CLI intermediary | Requires MCP stdio protocol; defer |
| Comprehensive fallback integration tests | Important but orthogonal to reliability features; separate quick task |
| Dynamic fan-out size adjustment | Existing adaptive fan-out (risk_level mapping) is sufficient for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DISP-01 | — | Pending |
| DISP-02 | — | Pending |
| DISP-03 | — | Pending |
| FAIL-01 | — | Pending |
| FAIL-02 | — | Pending |
| OBS-01 | — | Pending |
| OBS-02 | — | Pending |
| OBS-03 | — | Pending |
| HEAL-01 | — | Pending |
| HEAL-02 | — | Pending |

**Coverage:**
- v0.24 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
