# Skipped Tests Fixes - Implementation Plan

> **Feature**: Fix 18 skipped tests across E2E and unit test suites
> **Status**: Planning Complete
> **Created**: 2026-01-27

## Overview

This plan addresses 18 skipped tests in the Blend65 compiler test suite. The skipped tests document known gaps in the compiler implementation, primarily in:

1. **Array initializer code generation** - Array literals like `[1, 2, 3]` generate `$00` instead of actual values
2. **Local variable code generation** - Local variables produce `STUB: Unknown variable` comments
3. **Branch instruction selection** - Always generates `JMP` instead of proper `BNE`/`BEQ`
4. **Data directive generation** - Missing `!fill` directives for uninitialized arrays

Fixing these issues will enable the skipped tests and improve overall compiler quality.

## Document Index

| #   | Document                                           | Description                             |
| --- | -------------------------------------------------- | --------------------------------------- |
| 00  | [Index](00-index.md)                               | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)                 | Feature requirements and scope          |
| 02  | [Current State](02-current-state.md)               | Analysis of current implementation      |
| 03  | [Array Initializers](03-array-initializers.md)     | Fix array literal values in IL          |
| 04  | [Local Variables](04-local-variables.md)           | Fix local variable code generation      |
| 05  | [Branch Selection](05-branch-selection.md)         | Fix BNE/BEQ instruction selection       |
| 06  | [Data Directives](06-data-directives.md)           | Fix !fill directive generation          |
| 07  | [Testing Strategy](07-testing-strategy.md)         | Test verification approach              |
| 99  | [Execution Plan](99-execution-plan.md)             | Phases, sessions, and task checklist    |

## Quick Reference

### Skipped Tests by Category

| Category | Tests | Impact |
|----------|-------|--------|
| Array Initializers | 3-4 | High |
| Local Variables | 3-4 | High |
| Data Directives | 3 | Medium |
| Branch Selection | 2 | Medium |
| Type System (out of scope) | 5 | Low |

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Local variable allocation | Zero-page based (simpler than stack) |
| Array initializer handling | Extract values in IL generator |
| Branch instruction selection | Pattern-based on comparison type |
| Scope of fixes | Categories 1-4 only (13 tests) |

## Related Files

### IL Generator (Array Initializers)
- `packages/compiler/src/il/generator.ts`

### Code Generator (Local Vars, Branches, Data)
- `packages/compiler/src/codegen/instruction-generator.ts`
- `packages/compiler/src/codegen/globals-generator.ts`
- `packages/compiler/src/codegen/base-generator.ts`

### Test Files
- `packages/compiler/src/__tests__/e2e/smoke.test.ts`
- `packages/compiler/src/__tests__/e2e/literals.test.ts`
- `packages/compiler/src/__tests__/e2e/variables.test.ts`
- `packages/compiler/src/__tests__/e2e/control-flow.test.ts`

## Success Criteria

**Plan is successful when:**
1. ✅ All 13 in-scope skipped tests are enabled and passing
2. ✅ No regressions in existing 6963 passing tests
3. ✅ Array literals generate correct byte values
4. ✅ Local variables generate proper LDA/STA instructions
5. ✅ Proper BNE/BEQ selection for comparisons