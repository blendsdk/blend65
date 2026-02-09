# IL & IL-Optimizer Extreme Testing Implementation Plan

> **Feature**: God-Level Testing Suite for IL Generator and IL Optimizer
> **Status**: Planning Complete
> **Created**: 2026-03-02

## Overview

This plan creates a comprehensive, production-grade testing suite for the IL Generator and IL Optimizer components. The current testing is basic (unit tests + simple e2e), but lacks the depth required for confident production use.

The testing suite will include:
- **Real-world C64 patterns** - Actual game development patterns
- **Stress tests** - Scale limits and performance boundaries
- **Complex combinations** - Multi-feature interactions
- **Edge cases** - Boundary conditions and corner cases
- **Correctness tests** - Verify optimizer doesn't break semantics

This is modeled after the existing semantic testing infrastructure which already has real-world, stress, and edge-case test coverage.

## Document Index

| #   | Document                                         | Description                             |
| --- | ------------------------------------------------ | --------------------------------------- |
| 00  | [Index](00-index.md)                             | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)               | Feature requirements and scope          |
| 02  | [Current State](02-current-state.md)             | Analysis of current test implementation |
| 03  | [IL Real-World Tests](03-il-real-world.md)       | IL Generator real-world C64 patterns    |
| 04  | [IL Stress Tests](04-il-stress.md)               | IL Generator stress tests               |
| 05  | [IL Complex Tests](05-il-complex.md)             | IL Generator complex combinations       |
| 06  | [IL Edge Cases](06-il-edge-cases.md)             | IL Generator edge cases                 |
| 07  | [Optimizer Real-World](07-opt-real-world.md)     | Optimizer real-world scenarios          |
| 08  | [Optimizer Stress](08-opt-stress.md)             | Optimizer stress tests                  |
| 09  | [Optimizer Correctness](09-opt-correctness.md)   | Optimizer correctness verification      |
| 10  | [Optimizer Edge Cases](10-opt-edge-cases.md)     | Optimizer edge cases                    |
| 11  | [Shared Helpers](11-shared-helpers.md)           | Common test utilities                   |
| 99  | [Execution Plan](99-execution-plan.md)           | Phases, sessions, and task checklist    |

## Quick Reference

### Test Categories Summary

| Category | Component | Files | Tests (Est.) |
|----------|-----------|-------|--------------|
| Real-World | IL Generator | 7 | ~100 |
| Stress | IL Generator | 4 | ~60 |
| Complex | IL Generator | 6 | ~90 |
| Edge Cases | IL Generator | 5 | ~75 |
| Real-World | IL Optimizer | 7 | ~100 |
| Stress | IL Optimizer | 4 | ~60 |
| Correctness | IL Optimizer | 6 | ~90 |
| Edge Cases | IL Optimizer | 5 | ~75 |
| **TOTAL** | - | **44** | **~650** |

### Key Decisions

| Decision | Outcome |
| -------- | ------- |
| Test file granularity | 5-10 tests per file (AI context friendly) |
| Helper utilities | Shared `helpers/` folder per category |
| Validation approach | IL opcode verification (no golden files) |
| Plan structure | One master execution plan |

## Related Files

### Test Directories to Create

```
packages/compiler-v2/src/__tests__/
├── il/
│   ├── e2e/
│   │   ├── real-world/     # 7 NEW files
│   │   ├── stress/         # 4 NEW files
│   │   └── complex/        # 6 NEW files
│   ├── edge-cases/         # 5 NEW files
│   └── helpers/            # 1 NEW file (shared utilities)
├── optimizer/
│   ├── e2e/
│   │   ├── real-world/     # 7 NEW files
│   │   ├── stress/         # 4 NEW files
│   │   └── correctness/    # 6 NEW files
│   ├── edge-cases/         # 5 NEW files
│   └── helpers/            # 1 NEW file (shared utilities)
```

### Reference Files

- `packages/compiler-v2/src/__tests__/semantic/e2e/real-world/` - Pattern reference
- `packages/compiler-v2/src/__tests__/il/e2e/functions.test.ts` - Existing IL test pattern
- `packages/compiler-v2/src/__tests__/optimizer/e2e.test.ts` - Existing optimizer test pattern