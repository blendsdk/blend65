# Testing Strategy: Size-Opt Duplicate Label Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- All existing size-opt tests pass unchanged
- New test verifying unique labels across multiple `run()` invocations
- E2E verification via diag_app at all optimization levels

## Test Categories

### Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| Multi-run label uniqueness | Call `run()` 3 times, verify all factored labels are unique | High |
| Section merging | After 3 `run()` calls, verify only ONE `_factored_routines` section | High |
| Counter increments across runs | Verify labels are `.factored_0`, `.factored_1`, `.factored_2` | High |
| Single run still works | Verify existing single-run behavior unchanged | High |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| armenian-charset O1z | Compile at O1z, assemble with ACME | PASS (no duplicate labels) |
| armenian-charset Oz | Compile at Oz, assemble with ACME | PASS (no duplicate labels) |
| armenian-charset O3z | Compile at O3z, assemble with ACME | PASS (no duplicate labels) |
| armenian-charset all levels | Run diag_app | All 10 levels PASS |

## Verification Checklist

- [ ] All existing size-opt tests pass
- [ ] New multi-iteration test passes
- [ ] `./compiler-test` — all tests pass
- [ ] `diag_app examples/armenian-charset/main.blend` — all 10 levels pass
