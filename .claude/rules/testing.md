---
paths:
  - "**/*.test.{js,cjs}"
  - "hooks/dist/**/*.test.js"
---

# Testing Rules

- Test files live alongside source in hooks/dist/ (e.g., nf-stop.test.js)
- Run tests with `npm test` -- uses vitest
- Hook tests must verify fail-open behavior (empty input -> exit 0)
- When editing hooks, always run the corresponding test file to verify
- No known pre-existing test failures
- Test coverage is tracked in .planning/formal/unit-test-coverage.json
