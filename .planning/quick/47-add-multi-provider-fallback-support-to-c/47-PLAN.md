---
phase: quick-47
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/jonathanborduas/code/claude-mcp-server/src/types.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts
  - /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
  - /Users/jonathanborduas/code/claude-mcp-server/README.md
autonomous: true
requirements: [QUICK-47]

must_haves:
  truths:
    - "When primary call throws (CommandExecutionError or spawn error), handler retries each fallback in order"
    - "When primary call succeeds but JSON.parse fails, handler retries each fallback in order"
    - "On successful fallback, response metadata includes usedModel and usedFallbackIndex"
    - "When all attempts fail, handler throws ToolExecutionError listing all error messages"
    - "When no fallbackProviders provided, behaviour is identical to current code"
    - "fallbackProviders accepts up to 5 entries; each entry can override model, routerBaseUrl, or both"
  artifacts:
    - path: "/Users/jonathanborduas/code/claude-mcp-server/src/types.ts"
      provides: "ProviderSchema + fallbackProviders field on ClaudeToolSchema"
      contains: "ProviderSchema"
    - path: "/Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts"
      provides: "attemptCall private method + retry loop in ClaudeToolHandler.execute()"
      contains: "attemptCall"
    - path: "/Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts"
      provides: "fallbackProviders in tool inputSchema JSON"
      contains: "fallbackProviders"
    - path: "/Users/jonathanborduas/code/claude-mcp-server/README.md"
      provides: "fallbackProviders parameter row + example"
      contains: "fallbackProviders"
  key_links:
    - from: "ClaudeToolHandler.execute()"
      to: "attemptCall()"
      via: "primary attempt + fallback loop"
      pattern: "attemptCall.*fallback"
    - from: "ClaudeToolSchema"
      to: "fallbackProviders"
      via: "z.array(ProviderSchema).max(5).optional()"
      pattern: "fallbackProviders"
---

<objective>
Add a `fallbackProviders` parameter to the `claude` MCP tool that enables sequential retry
through alternate providers when the primary call fails (thrown error or JSON parse failure).

Purpose: Let callers configure automatic provider failover without client-side retry logic.
Output: Updated types.ts, handlers.ts, definitions.ts, README.md in the claude-mcp-server repo.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Working directory for all file edits: /Users/jonathanborduas/code/claude-mcp-server/

Key codebase facts discovered during planning:

1. ClaudeToolSchema is in src/types.ts (line 79). Currently ends with routerBaseUrl field.

2. ClaudeToolHandler.execute() in src/tools/handlers.ts:
   - Parses args with ClaudeToolSchema.parse(args)
   - Builds cmdArgs array (two code paths: resume vs new session)
   - Calls executeCommand or executeCommandStreaming with optional envOverride
   - Then tries JSON.parse(result.stdout) — parse failure currently silently falls back to raw stdout
   - Returns ToolResult with metadata: { model, sessionId }

3. executeCommand() in src/utils/command.ts:
   - Rejects (throws CommandExecutionError) only when exit code != 0 AND no stdout/stderr output at all
   - Otherwise resolves (including non-zero exit with any output)
   - So "hard failure" = thrown exception. "Soft failure" = resolved but JSON.parse throws.

4. definitions.ts inputSchema is a plain JSON Schema object (not Zod) — add fallbackProviders as
   an array property with items having optional model + routerBaseUrl string properties.

5. README parameter table is at line 163. `routerBaseUrl` row is the last row (line 173).
   Examples section starts at line 178.

Failure definition for fallback trigger:
  - executeCommand/executeCommandStreaming throws (CommandExecutionError / any error)
  - OR executeCommand resolves but JSON.parse(result.stdout) throws AND result.stdout is non-empty
    (empty stdout is already handled gracefully, no need to trigger fallback for "No output" case)

Design constraint: streaming path (useStreaming = true) complicates fallback because
executeCommandStreaming sends onProgress callbacks mid-flight. For simplicity, fallback attempts
always use the non-streaming executeCommand path (streaming is only for the primary attempt when
progressToken is present). This avoids partial-progress confusion on retried calls.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add ProviderSchema and fallbackProviders to types.ts</name>
  <files>/Users/jonathanborduas/code/claude-mcp-server/src/types.ts</files>
  <action>
Insert the following before the ClaudeToolSchema declaration (around line 79):

```ts
// Schema for a single fallback provider entry
export const ProviderSchema = z.object({
  routerBaseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

export type ProviderEntry = z.infer<typeof ProviderSchema>;
```

Then add `fallbackProviders` as the last field inside ClaudeToolSchema (after `routerBaseUrl`):

```ts
fallbackProviders: z
  .array(ProviderSchema)
  .max(5)
  .optional()
  .describe('Ordered list of fallback providers to try if the primary call fails'),
```

Also update the ClaudeToolArgs type (it's derived via z.infer so it updates automatically — no
manual change needed there). Export ProviderEntry so handlers.ts can import it.

Add ProviderSchema and ProviderEntry to the existing imports block in handlers.ts needs — so also
add them to the export surface. No other changes to types.ts.
  </action>
  <verify>
Run from /Users/jonathanborduas/code/claude-mcp-server/:
  npx tsc --noEmit
Must produce zero errors related to types.ts. The ProviderSchema export must be resolvable.
  </verify>
  <done>
ProviderSchema exported from types.ts; ClaudeToolSchema includes fallbackProviders field; tsc
reports no type errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement attemptCall helper and fallback retry loop in handlers.ts</name>
  <files>/Users/jonathanborduas/code/claude-mcp-server/src/tools/handlers.ts</files>
  <action>
1. Add ProviderEntry to the import from '../types.js':
   ```ts
   import {
     ...,
     type ProviderEntry,
   } from '../types.js';
   ```

2. Extract command execution into a private method on ClaudeToolHandler. Add this method
   AFTER buildEnhancedPrompt (or before execute — either is fine, after is cleaner):

   ```ts
   private async attemptCall(
     cmdArgs: string[],
     routerBaseUrl: string | undefined
   ): Promise<{ result: CommandResult; parsedResponse: string; extractedSessionId?: string }> {
     const envOverride = routerBaseUrl
       ? { ANTHROPIC_BASE_URL: routerBaseUrl }
       : undefined;

     const result = envOverride
       ? await executeCommand('claude', cmdArgs, envOverride)
       : await executeCommand('claude', cmdArgs);

     // Parse JSON output — throw on failure so caller can decide whether to retry
     const parsed = JSON.parse(result.stdout); // intentionally let this throw
     const parsedResponse: string = parsed.result ?? result.stdout;
     const extractedSessionId: string | undefined = parsed.session_id;

     return { result, parsedResponse, extractedSessionId };
   }
   ```

3. Refactor ClaudeToolHandler.execute() to use the new helper.

   BEFORE the `await context.sendProgress('Starting Claude execution...', 0)` line and the
   existing executeCommand call, the logic becomes:

   a. Keep the existing cmdArgs build (both resume and new-session paths) unchanged.
   b. Keep `await context.sendProgress('Starting Claude execution...', 0)`.
   c. Replace the existing execution + JSON.parse block with a retry loop:

   ```ts
   const fallbacks: ProviderEntry[] = fallbackProviders ?? [];
   const attempts = [
     { model: selectedModel, routerBaseUrl },
     ...fallbacks.map((fb) => ({
       model: fb.model ?? selectedModel,
       routerBaseUrl: fb.routerBaseUrl ?? routerBaseUrl,
     })),
   ];

   let parsedResponse: string | undefined;
   let extractedSessionId: string | undefined;
   let usedFallbackIndex: number | undefined; // undefined = primary succeeded
   const errors: string[] = [];

   for (let i = 0; i < attempts.length; i++) {
     const attempt = attempts[i];

     // Patch --model arg for this attempt (index 5 in cmdArgs is the model value)
     // Instead of patching in-place, rebuild: find '--model' flag position and replace
     const patchedArgs = [...cmdArgs];
     const modelIdx = patchedArgs.indexOf('--model');
     if (modelIdx !== -1) {
       patchedArgs[modelIdx + 1] = attempt.model;
     }

     try {
       if (i === 0 && useStreaming) {
         // Primary attempt: use streaming if progressToken present
         const streamEnvOverride = attempt.routerBaseUrl
           ? { ANTHROPIC_BASE_URL: attempt.routerBaseUrl }
           : undefined;
         const streamResult = await executeCommandStreaming('claude', patchedArgs, {
           onProgress: (message) => { context.sendProgress(message); },
           envOverride: streamEnvOverride,
         });
         const parsed = JSON.parse(streamResult.stdout); // let throw to trigger retry
         parsedResponse = parsed.result ?? streamResult.stdout;
         extractedSessionId = parsed.session_id;
       } else {
         const { parsedResponse: pr, extractedSessionId: esi } =
           await this.attemptCall(patchedArgs, attempt.routerBaseUrl);
         parsedResponse = pr;
         extractedSessionId = esi;
       }

       if (i > 0) usedFallbackIndex = i - 1; // 0-indexed into fallbackProviders array
       break; // success
     } catch (err) {
       errors.push(`Attempt ${i} (${attempt.model ?? 'default'}): ${err instanceof Error ? err.message : String(err)}`);
       if (i === attempts.length - 1) {
         // All attempts exhausted
         throw new ToolExecutionError(
           TOOLS.CLAUDE,
           `All ${attempts.length} provider attempt(s) failed:\n${errors.join('\n')}`,
           err
         );
       }
       // else continue to next attempt
     }
   }

   // response is now parsedResponse (guaranteed set because loop throws if all fail)
   const response = parsedResponse ?? ('' as string);
   ```

   d. Remove the old `const result = useStreaming ? ...` and old `let response: string; try { JSON.parse... }` blocks.

   e. Continue with the existing session storage and metadata code unchanged. Update
      the metadata object to include fallback info when used:

   ```ts
   const metadata: Record<string, unknown> = {
     ...(selectedModel && { model: selectedModel }),
     ...(activeSessionId && { sessionId: activeSessionId }),
     ...(usedFallbackIndex !== undefined && { usedFallbackIndex }),
   };
   ```

4. Destructure fallbackProviders from ClaudeToolSchema.parse(args) result at the top of execute():
   ```ts
   const {
     ...,
     routerBaseUrl,
     fallbackProviders,
   }: ClaudeToolArgs = ClaudeToolSchema.parse(args);
   ```
  </action>
  <verify>
Run from /Users/jonathanborduas/code/claude-mcp-server/:
  npx tsc --noEmit
Must produce zero errors. Spot-check: grep for 'attemptCall' in src/tools/handlers.ts — must appear at least twice (definition + call site). Grep for 'fallbackProviders' — must appear in destructuring and in attempts array.
  </verify>
  <done>
ClaudeToolHandler.execute() retries through fallbackProviders on failure; primary path behaves
identically when fallbackProviders is absent; tsc is clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update definitions.ts and README.md</name>
  <files>
    /Users/jonathanborduas/code/claude-mcp-server/src/tools/definitions.ts
    /Users/jonathanborduas/code/claude-mcp-server/README.md
  </files>
  <action>
**definitions.ts**: Add `fallbackProviders` to the `claude` tool's inputSchema properties object,
after the `routerBaseUrl` entry:

```json
fallbackProviders: {
  type: 'array',
  maxItems: 5,
  description:
    'Ordered list of fallback providers to try if the primary call fails. Each entry can override model and/or routerBaseUrl.',
  items: {
    type: 'object',
    properties: {
      routerBaseUrl: {
        type: 'string',
        description: 'Override ANTHROPIC_BASE_URL for this fallback attempt',
      },
      model: {
        type: 'string',
        description: 'Model to use for this fallback attempt',
      },
    },
  },
},
```

**README.md**: Add one row to the `claude` parameter table after the `routerBaseUrl` row (line 173):

```markdown
| `fallbackProviders` | array | Ordered list of fallback providers (max 5). Each entry: `{ model?, routerBaseUrl? }`. Retried sequentially if primary call fails. |
```

Add a new example under the "Route to an alternative model" example in the Examples section:

```markdown
**Fallback to a secondary provider if primary fails:**
```
Use claude with routerBaseUrl "http://localhost:3000" and fallbackProviders [{"routerBaseUrl": "http://localhost:4000", "model": "deepseek/deepseek-coder-v2"}, {"model": "claude-haiku-4-5-20251001"}] to complete this task
```
```
  </action>
  <verify>
Run from /Users/jonathanborduas/code/claude-mcp-server/:
  npx tsc --noEmit
Grep checks:
  grep -n 'fallbackProviders' src/tools/definitions.ts  — must show the new property
  grep -n 'fallbackProviders' README.md                 — must show param row and example
  </verify>
  <done>
definitions.ts exposes fallbackProviders in the JSON schema for MCP tool discovery; README
documents the parameter and provides a usage example. tsc clean.
  </done>
</task>

</tasks>

<verification>
From /Users/jonathanborduas/code/claude-mcp-server/:

1. `npx tsc --noEmit` — zero errors across all modified files
2. `grep -n 'ProviderSchema\|fallbackProviders\|attemptCall' src/types.ts src/tools/handlers.ts src/tools/definitions.ts` — all three symbols present in expected files
3. `grep -n 'fallbackProviders' README.md` — param table row + example both present
4. `npm run build` (if build script exists) — compiles successfully
</verification>

<success_criteria>
- ProviderSchema exported from types.ts with routerBaseUrl and model optional fields
- ClaudeToolSchema includes fallbackProviders: z.array(ProviderSchema).max(5).optional()
- ClaudeToolHandler.execute() retries sequentially on thrown error or JSON.parse failure
- Primary-only calls (no fallbackProviders) have identical behaviour to pre-change code
- On fallback success: usedFallbackIndex appears in response metadata
- On all-fail: ToolExecutionError message lists all attempt error strings
- definitions.ts and README.md document the new parameter
- tsc --noEmit exits 0
</success_criteria>

<output>
After completion, create `.planning/quick/47-add-multi-provider-fallback-support-to-c/47-SUMMARY.md`
</output>
