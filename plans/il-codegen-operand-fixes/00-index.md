# IL Generator ↔ Codegen Operand Mismatch Fixes

> **Feature**: Fix systematic IL operand bugs causing crashes and wrong code generation
> **Status**: Planning Complete
> **Created**: 2025-02-14

## Overview

The IL generator's expression layer (`expressions.ts`) has systematic gaps where binary
operators and compound assignments either crash the codegen or silently produce wrong code.
The root cause is a mismatch between what the IL generator emits (opcodes with empty operands)
and what the codegen expects (opcodes with slot or immediate operands).

Six bugs were identified across three categories:
1. **CRASH**: `%` and `/` with immediate right operands (no `DIV_IMM`/`MOD_IMM` path)
2. **CRASH**: ALL `_BYTE` opcodes from the complex binary path have empty operands
3. **WRONG CODE**: Shift operators (`<<`, `>>`) never emit `SHL_BYTE`/`SHR_BYTE`
4. **WRONG CODE**: Compound assignments (`*=`, `/=`, `%=`, `<<=`, `>>=`) are no-ops

## Document Index

| # | Document | Description |
|---|---|---|
| 00 | [Index](00-index.md) | This document — overview and navigation |
| 01 | [Requirements](01-requirements.md) | Bug descriptions and fix requirements |
| 02 | [Current State](02-current-state.md) | Analysis of broken code paths |
| 03 | [IL Generator Fixes](03-il-generator-fixes.md) | Technical spec for expression fixes |
| 04 | [Compound Assignment Fixes](04-compound-assignment-fixes.md) | Technical spec for compound ops |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Triggering Examples

```js
// CRASH: modulo with literal
let speed: byte = (i % 3) + 1;

// CRASH: divide with literal
let half: byte = total / 2;

// CRASH: complex right operand
let result: byte = a + (b * c);

// WRONG CODE: shift operators
let doubled: byte = x << 1;

// WRONG CODE: compound assignment
x *= 2;
```

### Key Decisions

| Decision | Outcome |
|---|---|
| Add DIV_IMM/MOD_IMM opcodes? | No — use ZP temp pattern matching MUL_IMM codegen |
| How to fix complex binary path? | New `DIV_IMM`/`MOD_IMM` IL opcodes + codegen handlers |
| Shift operator support? | Call existing `builder.shl()`/`builder.shr()` |
| Compound assign fix? | Route through existing binary operation logic |

## Related Files

### IL Generator (changes needed)
- `packages/compiler/src/il/generator/expressions.ts`

### IL Infrastructure (new opcodes)
- `packages/compiler/src/il/enums.ts`
- `packages/compiler/src/il/builder/arithmetic.ts`

### Codegen (new handlers)
- `packages/compiler/src/codegen/generator/arithmetic.ts`

### Tests (new/updated)
- `packages/compiler/src/__tests__/il/generator.test.ts`
- `packages/compiler/src/__tests__/codegen/` (relevant files)
- `packages/compiler/src/__tests__/e2e/pipeline/` (new E2E tests)
