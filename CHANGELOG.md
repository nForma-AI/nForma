# Changelog

All notable changes to GSD will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [1.4.24] - 2026-01-14

### Added
- Parallel phase execution via `/gsd:execute-phase`
- Parallel-aware planning in `/gsd:plan-phase`
- Changelog and update awareness system

### Changed
- Renamed `execute-phase.md` workflow to `execute-plan.md` for clarity
- Plan frontmatter now includes `wave`, `depends_on`, `files_modified`, `autonomous`

### Removed
- **BREAKING:** ISSUES.md system (replaced by phase-scoped UAT issues and TODOs)

[Unreleased]: https://github.com/glittercowboy/get-shit-done/compare/v1.4.24...HEAD
[1.4.24]: https://github.com/glittercowboy/get-shit-done/releases/tag/v1.4.24
