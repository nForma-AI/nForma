# Pitfalls Research

**Domain:** Retrofitting token efficiency features into an existing multi-agent pipeline (QGSD v0.18)
**Researched:** 2026-02-27
**Confidence:** HIGH

---

## Critical Pitfalls

### Pitfall 1: Token Count Observability Assumed to Be Native — It Is Not

**What goes wrong:**
Implementation proceeds on the assumption that Claude Code hooks expose per-sub-agent token counts in the hook event payload. They do not. The `PostToolUse` hook receives tool name, input, and output — not token consumption metadata for the sub-agent that handled the call. The `Stop` hook receives `transcript_path` and stop reason — not aggregate token totals. There is no documented hook event field for per-slot token counts. An implementation that reads `input.token_usage` or `input.usage_tokens` from the hook payload will silently receive `undefined` and emit no observable error because hooks are fail-open.

**Why it happens:**
The existing `gsd-context-monitor.js` hook (v0.9) successfully reads context window usage percentage from its hook input, which creates a false assumption that fine-grained per-slot token counts are similarly available. They are not the same data source. The context monitor reads aggregate context window fill percentage from the Claude Code session state — a single-agent stat — not per-sub-agent inference cost.

**How to avoid:**
Before writing any observability code, verify the exact shape of each hook event payload using the live MCP logs at `~/.claude/debug/<session-id>.txt` (available via `node bin/review-mcp-logs.cjs`). The only confirmed token data sources are:
1. The `usage` field in MCP tool response payloads from claude-mcp-server instances (which proxy Anthropic API responses including `usage.input_tokens` and `usage.output_tokens`)
2. The stdout/stderr output of `call-quorum-slot.cjs` subprocess calls (if the slot returns token metadata in its response text)
3. External API billing endpoints (not usable in-session)

Design the observability layer to parse token usage from slot-worker response text (the `content` field of the Task result), not from hook event payloads. Any structured token data in response text must use a parseable sentinel pattern (e.g., `<!-- TOKEN_USAGE: { ... } -->`) so it can be extracted without brittleness.

**Warning signs:**
- Token count fields returning `undefined` instead of numbers
- Observability code that never triggers its logging branch in real sessions
- `review-mcp-logs.cjs` showing tool calls with no corresponding token data in the debug file
- Test cases that mock the token field rather than testing against real hook payload shape

**Phase to address:**
Token observability foundation phase (first phase of v0.18). Must be settled before any adaptive logic reads from it.

---

### Pitfall 2: Task Envelope Schema Breaks the Stop Hook's Quorum Evidence Detection

**What goes wrong:**
The Stop hook (`qgsd-stop.js`) verifies quorum occurred by scanning the transcript JSONL for `Task(subagent_type="qgsd-quorum-slot-worker")` tool_use blocks (see `wasSlotWorkerUsed()` at line 157). The exact match checked is:

```js
if (subagentType === 'qgsd-quorum-slot-worker') return true;
```

If token-efficient Task envelopes change the `subagent_type` field, add a wrapper type, or route through a different dispatch mechanism, the Stop hook classifies the turn as not having run quorum and emits `decision: block` — preventing Claude from delivering the plan even after valid quorum completed.

**Why it happens:**
The Stop hook is deliberately conservative. It was designed when there was only one quorum dispatch mechanism. Adding a token-efficient "lite" or "batched" dispatch path that uses a different subagent_type creates a permanent split between what dispatched quorum and what the Stop hook accepts as evidence. This is an R0 violation: Claude cannot deliver planning output even after valid quorum.

**How to avoid:**
The `subagent_type` value `"qgsd-quorum-slot-worker"` is a hard contract between the dispatch layer (qgsd-prompt.js injection, quorum.md instructions) and the verification layer (qgsd-stop.js). Any new dispatch variant MUST either:
1. Continue using `subagent_type="qgsd-quorum-slot-worker"` as the leaf-level Task type — envelope adds fields to the YAML prompt body, not a different subagent_type, OR
2. Update `wasSlotWorkerUsed()` in qgsd-stop.js simultaneously — as a single atomic change, never across separate phases

After any change to qgsd-stop.js, the hook must be synced: `cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js && node bin/install.js --claude --global`. The installed copy at `~/.claude/hooks/` is what actually runs — source edits without install sync are silent non-deployments (see Pitfall 5).

**Warning signs:**
- Stop hook blocking plan delivery after quorum appeared to succeed
- `conformance-events.jsonl` showing `quorum_block` immediately after a turn where Task was dispatched
- New dispatch mechanism described in quorum.md instructions without corresponding Stop hook update in the same plan

**Phase to address:**
Any phase that modifies quorum dispatch YAML format or adds a new Task dispatch path. The hook sync must be in the same phase's plan list, not a follow-on phase.

---

### Pitfall 3: Adaptive Fan-Out Bypasses the Stop Hook's Quorum Size Check

**What goes wrong:**
Adaptive quorum fan-out (reducing the number of slot-workers dispatched based on token budget or plan complexity score) can cause the live quorum round to use fewer slots than `quorum.maxSize` requires. The Stop hook's ceiling check in qgsd-stop.js computes:

```js
const maxSize = quorumSizeOverride !== null && quorumSizeOverride > 1
  ? quorumSizeOverride - 1
  : (config.quorum && Number.isInteger(config.quorum.maxSize) && config.quorum.maxSize >= 1)
    ? config.quorum.maxSize
    : 5;
```

If adaptive fan-out dispatches fewer external slots than `maxSize` without injecting `--n N` into the prompt (which is how the Stop hook detects override intent via `parseQuorumSizeFlag()`), the hook blocks the turn because `successCount < maxSize`. The plan never delivers.

Additionally, R3.5 requires "all available models" for consensus. An adaptive fan-out that silently excludes available models is an R3 protocol violation, not just a hook mismatch — even if the hook somehow passed.

**Why it happens:**
Adaptive fan-out is designed to save tokens by dispatching to fewer agents. But the existing quorum size enforcement assumes fan-out is always full or explicitly overridden via `--n N`. There is no mechanism for the adaptive logic to communicate a reduced fan-out to the Stop hook short of emitting `--n N` into the user prompt text.

**How to avoid:**
Adaptive fan-out MUST use the existing `--n N` override mechanism. The adaptation logic decides N (e.g., N=3 for a low-complexity plan), then ensures `--n 3` appears in the prompt text so the Stop hook reads it via `parseQuorumSizeFlag()`. The qgsd-prompt.js injection already handles `--n N` dynamically (line 191-211). The adaptation logic must produce a `--n N` injection as its output — not silently reduce dispatch.

R3.5 compliance also requires that adaptive exclusion decisions are logged in quorum output with explicit reduced-quorum notation ("reduced quorum — N excluded by token budget policy") per R6.4, not silent omission.

**Warning signs:**
- Adaptive fan-out logic that slices `cappedSlots` to N without a corresponding `--n N` in the prompt text
- Stop hook blocking turns where fewer slots were dispatched than maxSize
- No `--n N` token visible in the `additionalContext` for reduced fan-out rounds
- R3.5/R6.4 compliance review absent from the adaptive fan-out design

**Phase to address:**
Adaptive quorum fan-out phase. Must co-design with both qgsd-prompt.js injection logic and R3 protocol compliance from the start.

---

### Pitfall 4: Tiered Model Sizing Config Lost by Shallow Merge on Partial Project Override

**What goes wrong:**
QGSD config uses `loadConfig()` with a strict shallow spread: `{ ...DEFAULT_CONFIG, ...global, ...project }`. If tiered model sizing introduces a new config block — for example `token_tiers: { cheap: 'model-A', expensive: 'model-B' }` — and a project-level `.claude/qgsd.json` defines the same key but only overrides one sub-key, the entire global `token_tiers` object is silently replaced. The tier that was not explicitly set in the project config reverts to `undefined`, causing the tiering logic to fail silently or fall back to an unexpected default.

This is documented QGSD behavior: "Shallow merge for config layering — Project required_models should fully replace global (not deep-merge)" (Phase 2 Key Decisions). It is correct for `required_models` and `quorum_active` where full replacement is the intent. It is a silent data loss trap for nested config objects where partial override is the expected user behavior.

**Why it happens:**
`quorum_active` and `required_models` are designed for full replacement — a project restricts its quorum subset. But tiered model config is additive metadata: a project might want to override only the `cheap` tier without specifying the `expensive` tier. The user's mental model is deep merge; the implementation is shallow merge.

**How to avoid:**
Tiered model sizing config must be a flat structure, not a nested object. Instead of `token_tiers: { cheap, expensive }`, use parallel flat keys: `token_tier_cheap_model` and `token_tier_expensive_model`. Flat keys survive shallow merge correctly — each is independently overrideable. Alternatively, if a nested key is unavoidable, add a validator in `validateConfig()` in config-loader.js that warns when a partial override is detected (e.g., one tier sub-key present but not the other) and backfills the missing sub-key from defaults.

**Warning signs:**
- New config block with more than one sub-key where user override scenarios involve changing only one sub-key
- No validator logic in `validateConfig()` for the new config block
- Test coverage that only tests full `token_tiers` replacement, not partial project override
- Config documentation that says "project config overrides global" without specifying that it replaces the entire block

**Phase to address:**
Tiered model config schema design phase. The flat-vs-nested decision must be made before any code reads the config — schema changes require updating `validateConfig()`, DEFAULT_CONFIG, and any migration notes.

---

### Pitfall 5: Hook Install Sync Omitted After Hook Edits — Silent Non-Deployment

**What goes wrong:**
Any edit to `hooks/qgsd-stop.js` or `hooks/qgsd-prompt.js` (or any other hook source) that is not followed by `cp hooks/<name>.js hooks/dist/<name>.js && node bin/install.js --claude --global` is silently ignored at runtime. The installed copy at `~/.claude/hooks/` is what Claude Code actually loads. The source file in `hooks/` is not read at runtime. The plan executes, tests may pass against the source file, but the production behavior is unchanged and the old logic continues running.

This pitfall has burned QGSD previously: Phase v0.13-06 added a dedicated INT-03 requirement specifically because "installer sync (node bin/install.js --claude --global) is canonical mechanism for qgsd-core/ edits."

**Why it happens:**
The hooks live in two places: `hooks/` (source) and `hooks/dist/` (installer staging). The installer reads from `hooks/dist/`, not `hooks/`. Source edits without `hooks/dist/` sync leave a gap. CI tests run against the source tree but not the installed copy — a test passing does not guarantee the installed hook is updated.

**How to avoid:**
Every plan that modifies a hook source file MUST include an explicit install sync task as a numbered plan item:
```
- [ ] Sync to dist and reinstall: cp hooks/qgsd-stop.js hooks/dist/qgsd-stop.js && node bin/install.js --claude --global
- [ ] Verify installed copy updated: diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js
```

The verification diff is not optional — it confirms the installed copy matches the source. Plans that modify hooks without this item must be flagged during plan-phase review.

**Warning signs:**
- A plan that edits a hook source file with no `cp hooks/...` step
- A plan with "update qgsd-stop.js" but no `node bin/install.js` step
- New hook behavior not observed in a live session despite tests passing
- `diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js` showing differences after a plan run

**Phase to address:**
Every phase that modifies any hook file. This is a process requirement applied at each phase, not a one-time fix.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reading token counts from response text via regex | No API changes needed; works immediately | Fragile if slot-worker output format changes; breaks silently | Only as v0.18 MVP if format is version-pinned and a sentinel pattern is used |
| Tiered model config as nested object instead of flat keys | More readable config file | Silent data loss on partial project override due to shallow merge; breaks for common user patterns | Never — flat keys are always safer given QGSD's shallow merge semantics |
| Adaptive fan-out without `--n N` injection | Simpler implementation; no prompt injection needed | Stop hook blocks every reduced-fan-out turn; R3 protocol violation | Never |
| Skip install sync in test-only phases | Faster iteration | Production behavior diverges from tested behavior; hook edit has zero effect | Never for Stop/Prompt/PreToolUse hook edits; acceptable for bin/-only changes |
| New subagent_type for token-efficient workers | Clean separation; easier to identify in logs | Stop hook `wasSlotWorkerUsed()` fails; every quorum turn blocked | Never without simultaneous Stop hook update in the same plan |
| Hardcoding model-tier mapping in worker YAML | No config layer needed; ships fast | Cannot be changed without editing quorum.md and reinstalling; no per-project override | Only in prototype; must move to qgsd.json before shipping |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code hook payload | Assuming `input.token_usage` or `input.usage_tokens` exists in Stop/UserPromptSubmit payloads | Verify field presence with `review-mcp-logs.cjs` before reading; design around MCP response `usage` field or response text parsing instead |
| qgsd-stop.js quorum evidence detection | Changing subagent_type string or wrapping in a new Task type without updating `wasSlotWorkerUsed()` | Treat `"qgsd-quorum-slot-worker"` as a hard contract; extend YAML prompt body fields, never the subagent_type |
| config-loader.js shallow merge | Adding nested token config expecting partial project override to work | Use flat config keys or require full block replacement with a `validateConfig()` warning and default backfill |
| quorum.md slot dispatch instructions | Adding adaptive logic that bypasses the `--n N` override path in qgsd-prompt.js | All fan-out sizing MUST flow through the `--n N` token in the prompt text — that is the Stop hook's decision channel |
| hooks/dist/ staging | Editing hooks/ source without syncing to hooks/dist/ | Always: `cp hooks/name.js hooks/dist/name.js && node bin/install.js --claude --global`; verify with diff |
| quorum-scoreboard.json | Adding token fields without handling the `merge-wave` atomic merge path | Any new scoreboard field must be handled by the `merge-wave` subcommand in `update-scoreboard.cjs`; omitting it causes fields to be lost on parallel wave merges |
| VALID_MODELS guard in update-scoreboard.cjs | New model tier slot family names not added to `VALID_MODELS` array | Add new slot family names to `VALID_MODELS` (line 44 of update-scoreboard.cjs) when introducing new model tiers |
| call-quorum-slot.cjs subprocess | Expecting structured JSON back from slot subprocess for token data | Slot output is free-form text; use a parseable sentinel pattern like `<!-- TOKEN_USAGE: { ... } -->` that can be extracted reliably |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Token counting on every hook invocation | PostToolUse hook adds latency per tool call even for non-quorum operations | Gate token accounting behind a quorum-command-detected flag; only run on decision turns where `hasDecisionMarker` or `hasArtifactCommit` would fire | At 10+ tool calls per session — always present |
| Synchronous scoreboard write per slot for token data | Scoreboard atomic rename contention when parallel wave merges coincide with token writes | Token data must flow through `merge-wave` subcommand, not separate `update-scoreboard` calls per slot | During parallel quorum rounds — the v0.11 wave-barrier pattern fires this immediately |
| Token data stored per-round in `rounds[]` array | Scoreboard JSON grows unbounded; `JSON.parse` slows on large files; gitignored but still loaded on every quorum | Cap `rounds[]` depth or store only rolling aggregate; prune entries older than N rounds | After 50+ quorum rounds with per-round token data |
| Complexity scoring PLAN.md before every quorum dispatch | Adds latency to every plan-phase invocation regardless of whether adaptive logic changes anything | Complexity score must be a fast synchronous pass under 50ms; never spawn a sub-agent for scoring | Always if complexity scoring uses async work or spawns a subprocess |

---

## "Looks Done But Isn't" Checklist

- [ ] **Token observability:** Verify token data actually appears in `review-mcp-logs.cjs` output for a real quorum round — not just that the code reads a field that could theoretically exist
- [ ] **Adaptive fan-out:** Confirm `--n N` appears in the prompt text for reduced-fan-out rounds — read `conformance-events.jsonl` to verify `slots_available` matches the intended N
- [ ] **Tiered model config:** Run `loadConfig()` with a partial project override of the new config block and verify no field reverts to `undefined`
- [ ] **Hook install sync:** Run `diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js` after every hook edit — diff must be empty
- [ ] **Stop hook compliance:** Run a full quorum turn after any dispatch change and confirm Stop hook does NOT block — check `conformance-events.jsonl` for `quorum_complete` not `quorum_block`
- [ ] **Scoreboard merge-wave:** Run parallel quorum (2+ workers) with new token fields and confirm no field is dropped in the merged scoreboard JSON
- [ ] **R3.5 compliance:** Verify that adaptive fan-out exclusions are logged in quorum output with explicit reduced-quorum notation per R6.4 — not silently omitted
- [ ] **VALID_MODELS guard:** Confirm new model tier slot names produce correct UNAVAIL counting in `update-scoreboard.cjs` — not silent zeros

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Token payload assumed available but missing | LOW | Read `review-mcp-logs.cjs` debug output to find actual payload shape; shift implementation to response-text parsing with sentinel; no schema changes needed |
| Task envelope breaks Stop hook | MEDIUM | Revert subagent_type to `"qgsd-quorum-slot-worker"` in quorum.md; sync hook to dist and reinstall; run one full quorum turn and confirm `conformance-events.jsonl` shows `quorum_complete` |
| Adaptive fan-out blocks every plan delivery | MEDIUM | Add `--n N` injection to adaptive logic output; sync hook if qgsd-stop.js was changed; test with `conformance-events.jsonl` to confirm `slots_available` matches N |
| Config shallow merge loses tier fields | LOW | Flatten config keys; update `validateConfig()` in config-loader.js; update DEFAULT_CONFIG; add migration note in CHANGELOG |
| Hook source/dist desync (silent non-deployment) | LOW | `cp hooks/name.js hooks/dist/name.js && node bin/install.js --claude --global`; verify with `diff hooks/dist/name.js ~/.claude/hooks/name.js` |
| Scoreboard merge-wave loses token fields | MEDIUM | Add token field handling to `merge-wave` subcommand in update-scoreboard.cjs; re-run a test parallel quorum round; verify merged JSON contains the new fields |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Token observability source (Pitfall 1) | Token observability foundation phase — before any adaptive logic | `review-mcp-logs.cjs` shows token data present for a live quorum round; no `undefined` field reads |
| Task envelope / Stop hook contract (Pitfall 2) | Any phase modifying quorum dispatch — co-deployed with Stop hook update | `conformance-events.jsonl` shows `quorum_complete` not `quorum_block` after dispatch change; diff of installed hook is empty |
| Adaptive fan-out R3 compliance (Pitfall 3) | Adaptive quorum fan-out phase — `--n N` injection is a required deliverable | Prompt text inspection shows `--n N` token; Stop hook does not block reduced-fan-out turns; R6.4 reduced-quorum log present |
| Config shallow merge / tiered model sizing (Pitfall 4) | Tiered model config schema phase — flat keys decided before implementation | `loadConfig()` partial override test passes with no `undefined` fields; `validateConfig()` emits warning on partial override |
| Hook install sync (Pitfall 5) | Every phase modifying a hook file — sync step in every plan | `diff hooks/dist/qgsd-stop.js ~/.claude/hooks/qgsd-stop.js` is empty after plan execution |

---

## Sources

- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — `wasSlotWorkerUsed()` at line 157; ceiling check at line 486; `parseQuorumSizeFlag()` at line 364 — confirms exact subagent_type string contract and `--n N` override path (HIGH confidence — live source)
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — `parseQuorumSizeFlag()` at line 109; `cappedSlots` at line 211; `externalSlotCap` logic — confirms `--n N` is the authoritative fan-out control channel shared by both the prompt injection and stop verification layers (HIGH confidence — live source)
- `/Users/jonathanborduas/code/QGSD/hooks/config-loader.js` — shallow merge at line 259: `{ ...DEFAULT_CONFIG, ...(globalObj || {}), ...(projectObj || {}) }` — confirms the partial override pitfall for nested config objects (HIGH confidence — live source)
- `/Users/jonathanborduas/code/QGSD/bin/update-scoreboard.cjs` — `VALID_MODELS` at line 44; `merge-wave` subcommand structure — confirms token field handling must go through merge-wave for atomic parallel wave safety (HIGH confidence — live source)
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — Key Decisions table: "installer sync (node bin/install.js --claude --global) is canonical mechanism" (Phase v0.13-06 INT-03); "hooks/dist/ new files are gitignored" (Phase v0.9-01); "Shallow merge for config layering" (Phase 2 CONF-02) — confirms all three architectural patterns (HIGH confidence — authoritative project record)
- `/Users/jonathanborduas/code/QGSD/CLAUDE.md` — R3.5 "CONSENSUS requires agreement from all available models"; R6.2 "Minimum valid quorum: Claude + 1 external model"; R6.4 "When reduced quorum is used, Claude MUST document which models were unavailable" — confirms R3 compliance constraints on adaptive fan-out (HIGH confidence — binding operational policy)

---
*Pitfalls research for: QGSD v0.18 Token Efficiency — retrofitting token observability, task envelopes, adaptive fan-out, and tiered model sizing into an existing multi-agent pipeline*
*Researched: 2026-02-27*
