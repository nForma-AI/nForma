# Decimal Phase Calculation

Calculate the next decimal phase number for urgent insertions.

## Using gsd-tools

```bash
# Get next decimal phase after phase 6
node ~/.claude/qgsd/bin/gsd-tools.cjs phase next-decimal 6
```

Output:
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.1",
  "existing": []
}
```

With existing decimals:
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.3",
  "existing": ["06.1", "06.2"]
}
```

## Extract Values

```bash
DECIMAL_INFO=$(node ~/.claude/qgsd/bin/gsd-tools.cjs phase next-decimal "${AFTER_PHASE}")
DECIMAL_PHASE=$(echo "$DECIMAL_INFO" | jq -r '.next')
BASE_PHASE=$(echo "$DECIMAL_INFO" | jq -r '.base_phase')
```

Or with --raw flag:
```bash
DECIMAL_PHASE=$(node ~/.claude/qgsd/bin/gsd-tools.cjs phase next-decimal "${AFTER_PHASE}" --raw)
# Returns just: 06.1
```

## Examples

| Existing Phases | Next Phase |
|-----------------|------------|
| 06 only | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |
| 06, 06.1, 06.3 (gap) | 06.4 |

## Directory Naming

Decimal phase directories use the full decimal number:

```bash
SLUG=$(node ~/.claude/qgsd/bin/gsd-tools.cjs generate-slug "$DESCRIPTION" --raw)
PHASE_DIR=".planning/phases/${DECIMAL_PHASE}-${SLUG}"
mkdir -p "$PHASE_DIR"
```

Example: `.planning/phases/06.1-fix-critical-auth-bug/`

## Milestone-Scoped Decimal Insertion

For milestone-scoped phases, decimal gap insertion follows the same pattern but uses
the full milestone-scoped phase ID as the base:

Using gsd-tools:

```bash
# Insert gap phase after v0.7-01
node /path/to/gsd-tools.cjs phase insert v0.7-01 "Fix critical config bug"
# Creates: .planning/phases/v0.7-01.1-fix-critical-config-bug/
```

Examples:

| Existing Phases       | Next Inserted Phase |
|-----------------------|---------------------|
| v0.7-01 only          | v0.7-01.1           |
| v0.7-01, v0.7-01.1    | v0.7-01.2           |
| v0.7-02 only          | v0.7-02.1           |

Directory naming: `.planning/phases/v0.7-01.1-fix-critical-config-bug/`
Plan naming: `v0.7-01.1-01-PLAN.md`
