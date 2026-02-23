# Size-Opt Duplicate Label Fix

> **Feature**: Fix duplicate `.factored_N` labels in size-opt pass during multi-iteration optimization
> **Status**: Planning Complete
> **Created**: 2025-02-18

## Overview

The `SizeOptPass` generates duplicate labels when the ASM-IL optimizer runs multiple iterations (z-levels: O1z, Oz, O3z). This causes ACME assembler to fail with "Symbol already defined" errors.

**Two bugs combine to cause the failure:**

1. **`factorCounter` reset** — The module-level counter resets to 0 on each `run()` call, so iteration 2 creates `.factored_0` again
2. **Separate sections** — Each iteration appends a NEW `_factored_routines` section instead of merging into the existing one

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document |
| 01 | [Requirements](01-requirements.md) | Bug description and fix requirements |
| 02 | [Current State](02-current-state.md) | Analysis of the root cause |
| 03 | [Fix Specification](03-fix-specification.md) | Technical fix details |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases |
| 99 | [Execution Plan](99-execution-plan.md) | Task checklist |

## Quick Reference

### Affected Files

- `packages/compiler/src/codegen/asm-il/optimizer/passes/size-opt.ts` — Main fix

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Counter management | Move to class instance property (not module-level) |
| Section merging | Merge into existing `_factored_routines` section if present |

## Related Files

- `packages/compiler/src/codegen/asm-il/optimizer/passes/size-opt.ts`
- `packages/compiler/src/__tests__/codegen/asm-il/optimizer/passes/size-opt.test.ts`
