# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please open a [GitHub Security Advisory](https://github.com/nForma-AI/QGSD/security/advisories/new).

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Fix timeline**: Depends on severity, but we aim for:
  - Critical: 24-48 hours
  - High: 1 week
  - Medium/Low: Next release

## Scope

Security issues in the QGSD codebase that could:
- Execute arbitrary code on user machines
- Expose sensitive data (API keys, credentials)
- Compromise the integrity of generated plans/code

## Recognition

We appreciate responsible disclosure and will credit reporters in release notes (unless you prefer to remain anonymous).

## Secret Detection

QGSD uses a 3-tool, 2-layer secret detection architecture:

### Layer 1: Local (Pre-commit)

| Tool | Trigger | Purpose |
|------|---------|---------|
| **Gitleaks** | `git commit` (via Husky + lint-staged) | Scans staged files for secrets before they enter git history |

Configuration: `.gitleaks.toml` (rules + allowlists for test fixtures)

### Layer 2: CI (GitHub Actions)

| Tool | Job | Purpose |
|------|-----|---------|
| **TruffleHog** | `trufflehog` | Full git history scan with `--only-verified` to reduce noise |
| **Gitleaks** | `gitleaks-ci` | Backup scan (defense in depth) |
| **detect-secrets** | `detect-secrets-ci` | Pattern-based scan against tracked `.secrets.baseline` |

Workflow: `.github/workflows/secret-scan.yml` (3 parallel jobs)

### Local Commands

```bash
npm run secrets:gitleaks   # Full repo scan with gitleaks
npm run secrets:scan       # Re-generate detect-secrets baseline
npm run secrets:audit      # Audit detect-secrets baseline interactively
npm run secrets:history    # Full-history audit (gitleaks + trufflehog)
```

### Allowlisted Paths

Test fixtures and planning data are allowlisted to prevent false positives:

- `bin/secrets.test.cjs`, `bin/ccr-secure-config.test.cjs`, `bin/set-secret.test.cjs`
- `.planning/*.jsonl`
- `.formal/` (formal verification fixtures)
- `hooks/generated-stubs/`
