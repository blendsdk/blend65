# E2E CodeGen Testing Plan

> **Feature**: Comprehensive End-to-End Compiler Validation
> **Status**: Planning Complete
> **Created**: 2026-01-26

## Overview

This plan establishes a systematic end-to-end testing framework for the Blend65 compiler. Unlike existing unit tests that validate individual components in isolation, these tests validate the **complete compilation pipeline** by:

1. **Compiling real Blend source code**
2. **Validating generated assembly** against expected patterns
3. **Identifying gaps** between what should work and what actually works
4. **Documenting limitations** as first-class test cases

The goal is to create a **living specification** where each test case documents:
- What feature it tests
- Expected behavior per language specification
- Actual behavior (pass/fail)
- If failing: whether it's a bug or unimplemented feature

## Document Index

| #  | Document | Description |
|----|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Known issues and gaps |
| 03 | [Test Infrastructure](03-test-infrastructure.md) | Test framework design |
| 04 | [Test Categories](04-test-categories.md) | All test categories and cases |
| 07 | [Testing Strategy](07-testing-strategy.md) | Verification approach |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and checklist |

## Quick Reference

### Test Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: SEMANTIC VALIDATION                               │
│  Tests what the compiler accepts/rejects                    │
│  - Type checking                                            │
│  - Intrinsic signatures                                     │
│  - Scope rules                                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: CODE GENERATION                                   │
│  Tests what assembly gets generated                         │
│  - Correct instructions                                     │
│  - Proper memory layout                                     │
│  - Variable storage                                         │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: RUNTIME BEHAVIOR (Future)                         │
│  Tests actual execution                                     │
│  - Memory writes                                            │
│  - Control flow                                             │
│  - Hardware interaction                                     │
└─────────────────────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Test format | Vitest-based, uses real compiler |
| Validation method | Parse ASM output, check patterns |
| Failure handling | Distinguish bugs from unimplemented |
| Scope | Semantic + CodeGen layers (no emulator) |

## Related Files

### Test Files (to be created)
- `packages/compiler/src/__tests__/e2e/` - E2E test directory
- `packages/compiler/src/__tests__/e2e/helpers/` - Test utilities
- `packages/compiler/src/__tests__/e2e/categories/` - Test categories

### Key Compiler Files
- `packages/compiler/src/codegen/` - Code generation layer
- `packages/compiler/src/semantic/` - Semantic analysis
- `packages/compiler/library/common/system.blend` - Intrinsics

## Success Criteria

This plan is successful when:

1. ✅ Test infrastructure compiles Blend → validates ASM
2. ✅ 100+ test cases covering all major features
3. ✅ Each test documents expected vs actual behavior
4. ✅ Gap report generated from failing tests
5. ✅ Clear prioritization of what to fix first