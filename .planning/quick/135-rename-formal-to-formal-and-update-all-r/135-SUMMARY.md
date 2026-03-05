---
phase: quick-135
status: complete
outcome: success
commits: []
---

<one_liner>Renamed formal/ to .formal/ and updated all references across the codebase.</one_liner>

<what_was_done>
The formal verification directory was renamed from `formal/` to `.formal/` to follow the convention of dot-prefixed metadata directories (like `.planning/`). All references in scripts, workflows, and configuration files were updated to point to the new path.
</what_was_done>

<what_changed>
- Renamed `formal/` → `.formal/` directory
- Updated all path references across bin/, commands/, hooks/, and workflow files
</what_changed>

<note>Retroactive summary — work was completed but summary file was not created at the time.</note>
