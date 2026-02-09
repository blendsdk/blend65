# Testing Strategy: Fix 22 Skipped Tests

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- All 22 skipped tests converted to real passing tests
- Zero regressions in existing 7836+ tests
- Full test suite: 0 failures, 0 skips

## Test Categories

### Write Test Bodies Only (20 tests)

These tests just need `it.todo` → `it` conversion with proper test bodies:

| Category | Count | Verification |
|----------|-------|--------------|
| Intrinsic codegen tests | 4 | `./compiler-test codegen` |
| Intrinsic emit tests | 2 | `./compiler-test codegen` |
| Intrinsic pipeline tests | 9 | `./compiler-test e2e` |
| Shift codegen tests | 2 | `./compiler-test codegen` |
| 3-variable pipeline test | 1 | `./compiler-test e2e` |

### Implementation + Tests (4 tests)

These require source code fixes before tests can pass:

| Category | Count | Fix | Verification |
|----------|-------|-----|--------------|
| Parser break/continue | 2 | Parser module-level handling | `./compiler-test semantic parser` |
| Cross-file frames | 2 | FramePhase multi-module | `./compiler-test e2e` |

## Verification Checklist

- [ ] Phase 1 complete: `./compiler-test codegen e2e` — 15 new intrinsic tests pass
- [ ] Phase 2 complete: `./compiler-test codegen e2e` — 3 new shift/3-var tests pass
- [ ] Phase 3 complete: `./compiler-test semantic parser` — 2 break/continue tests pass
- [ ] Phase 4 complete: `./compiler-test e2e` — 2 multi-module tests pass
- [ ] Final: `./compiler-test` — ALL tests pass, 0 skips, 0 failures

## Regression Testing

After each phase, run `./compiler-test` to verify no regressions.
The existing 7836+ tests are the regression safety net.
