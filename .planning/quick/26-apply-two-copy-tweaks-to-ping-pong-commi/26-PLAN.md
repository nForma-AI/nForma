# Quick Task 26 — Apply two copy tweaks to Ping-Pong Commit Breaker section

## Description
Apply two copy tweaks recommended by LLM review:
1. Add "Loop" to section heading: "Ping-Pong Commit Breaker" → "Ping-Pong Commit Loop Breaker"
2. Strengthen opening sentence: "AI agents loop." → "AI agents get stuck in ping-pong commit loops."

Both changes apply to README.md. Section heading also appears in USER-GUIDE.md.

---

```xml
<tasks>

<task type="auto">
  <name>Rename section heading and update opening sentence</name>
  <files>README.md, docs/USER-GUIDE.md</files>
  <action>
    In README.md:
    - Change "### Ping-Pong Commit Breaker" → "### Ping-Pong Commit Loop Breaker"
    - Change "**The problem no one talks about:** AI agents loop." → "**The problem no one talks about:** AI agents get stuck in ping-pong commit loops."

    In docs/USER-GUIDE.md:
    - Change "### Ping-Pong Commit Breaker" → "### Ping-Pong Commit Loop Breaker"
  </action>
  <verify>grep "Ping-Pong Commit Loop Breaker" README.md docs/USER-GUIDE.md && grep "get stuck in ping-pong commit loops" README.md</verify>
  <done>Both files reflect new heading; README has updated opening sentence</done>
</task>

</tasks>
```
