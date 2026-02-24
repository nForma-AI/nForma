# Quick Task 92 Summary

**Task:** claude-1..6 should use a real claude-code coding agent, but with different backend
**Date:** 2026-02-24
**Status:** Complete

## What Was Done

### Goal
Convert claude-1..6 quorum slots from plain HTTP REST shims to **real Claude Code CLI subprocesses**, each routing to a different alternative LLM provider (AkashML, Together.xyz, Fireworks) via claude-code-router (ccr).

### Approach: claude-code-router (ccr)

The initial plan (direct `ANTHROPIC_BASE_URL` env var injection) was blocked by Claude Code CLI's **client-side model allowlist** — the CLI rejects non-`claude-*` model name strings before making any API call.

The solution: **`@musistudio/claude-code-router` (ccr)** — a local proxy that:
1. Accepts the standard Claude model name from the Claude Code CLI
2. Translates it to the provider-specific model name
3. Forwards the request to the alternative provider endpoint (AkashML / Together.xyz / Fireworks)
4. Translates the response back to Anthropic Messages format

### Files Changed

**`bin/providers.json`** — claude-1..6 updated to subprocess type using ccr:
- `cli`: `/opt/homebrew/bin/ccr`
- `args_template`: `["claude-N", "-p", "{prompt}", "--dangerously-skip-permissions"]`
- `health_check_args`: `["-v"]`
- `env`: `{}` (ccr inherits system env including ANTHROPIC_API_KEY)

**`~/.claude-code-router/config.json`** — rewritten with correct lowercase `providers` array format:
- 3 providers: akashml, together, fireworks
- All using `/v1/chat/completions` OpenAI-format endpoints (no transformer needed — ccr auto-converts)

**`~/.claude-code-router/presets/claude-{1..6}/manifest.json`** — 6 preset manifests created:
- Uppercase `Providers` array (required by ccr's `registerNamespace` function)
- No transformer (ccr auto-converts Anthropic↔OpenAI based on endpoint URL pattern)
- `Router.default` points each preset to its assigned model

### Provider Mapping

| Slot | Model | Provider |
|------|-------|----------|
| claude-1 | deepseek-ai/DeepSeek-V3.2 | AkashML |
| claude-2 | MiniMaxAI/MiniMax-M2.5 | AkashML |
| claude-3 | Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 | Together.xyz |
| claude-4 | accounts/fireworks/models/kimi-k2p5 | Fireworks |
| claude-5 | meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8 | Together.xyz |
| claude-6 | accounts/fireworks/models/glm-5 | Fireworks |

### Key Technical Discoveries

1. **ccr case sensitivity**: Main `config.json` needs lowercase `providers` array; preset `manifest.json` needs uppercase `Providers` array — different code paths read each.
2. **No transformer needed**: ccr auto-detects OpenAI format from `/v1/chat/completions` URL pattern and converts both request and response. The `Anthropic` named transformer breaks tool definitions.
3. **ccr health_check**: Use `["-v"]` (not `["--version"]`) — `-v` is in ccr's command list, `--version` is not.
4. **End-to-end verified**: `ccr claude-1 -p "Reply with just the word CONFIRMED..." --dangerously-skip-permissions` → returned `CONFIRMED`.

## Outcome

All 6 claude-* quorum slots now dispatch to a real Claude Code CLI subprocess (`/opt/homebrew/bin/ccr`) which routes to alternative LLM providers. The quorum system gets full Claude Code reasoning and tool-use capability on non-Anthropic backends.
