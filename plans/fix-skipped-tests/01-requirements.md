# Requirements: Fix 22 Skipped Tests

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Convert all 22 `it.skip` and `it.todo` tests in the Blend65 compiler test suite to real,
passing tests. This involves writing test bodies for already-working features (20 tests)
and fixing 2 real implementation gaps.

## Functional Requirements

### Must Have

- [ ] All 15 intrinsic `it.todo` tests converted to real tests with assertions
- [ ] All 2 shift operation `it.todo` tests converted to real tests
- [ ] 1 three-variable expression `it.todo` test converted to real test
- [ ] 2 parser break/continue `it.skip` tests unskipped and passing
- [ ] 2 cross-file frame allocation `it.todo` tests converted and passing
- [ ] Zero test regressions — all existing 7836 tests continue passing
- [ ] Remove outdated gap documentation from test comments

### Won't Have (Out of Scope)

- Dynamic address support for peek/poke (only constant addresses are fixed)
- IL generator SHL_BYTE/SHR_BYTE direct emission optimization (complex path works)
- Full import/export resolution across modules

## Acceptance Criteria

1. [ ] All 22 skipped tests converted to real passing tests
2. [ ] Full test suite passes: 7858+ tests, 0 failures, 0 skips
3. [ ] No regressions in existing tests
4. [ ] Test comments updated to remove outdated gap documentation
