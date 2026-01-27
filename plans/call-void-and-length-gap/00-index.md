# CALL_VOID Bug and length() String Support Implementation Plan

> **Feature**: Fix IL generator CALL/CALL_VOID decision and add string literal support to length()
> **Status**: Planning Complete
> **Created**: 2026-01-27

## Overview

This plan addresses two compiler issues discovered during skipped test investigation:

1. **CALL_VOID Bug**: The IL generator incorrectly emits `CALL_VOID` instead of `CALL` for functions that return a value when the function is called in certain contexts (e.g., as part of a ternary expression argument).

2. **length() String Gap**: The `length()` intrinsic only accepts array variables, but should also accept string literals like `length("hello")`.

Both issues are relatively small in scope and can be implemented in a single session.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [CALL_VOID Fix](03-call-void-fix.md) | Technical specification for CALL_VOID bug |
| 04 | [length() String](04-length-string.md) | Technical specification for length() with strings |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Issue 1: CALL_VOID Bug

**Problem**: When calling a non-void function in certain contexts, the IL generator emits `CALL_VOID` instead of `CALL`.

**Example**:
```js
function identity(x: byte): byte { return x; }
function test(): byte {
  let flag: boolean = true;
  return identity(flag ? 10 : 20);  // Uses CALL_VOID instead of CALL
}
```

### Issue 2: length() String Gap

**Problem**: `length("hello")` fails because `generateLengthIntrinsic` only handles identifiers.

**Example**:
```js
function test(): word {
  return length("hello");  // Currently fails
}
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| CALL_VOID root cause | Symbol lookup not finding function or missing signature |
| length() fix approach | Handle LITERAL_EXPR in generateLengthIntrinsic |
| Session count | 1 session (~30-45 minutes) |

## Related Files

**CALL_VOID Bug**:
- `packages/compiler/src/il/generator/expressions.ts` - `generateCallExpression` method
- `packages/compiler/src/__tests__/il/generator-expressions-ternary.test.ts` - Skipped test

**length() String Support**:
- `packages/compiler/src/il/generator/expressions.ts` - `generateLengthIntrinsic` method
- `packages/compiler/src/__tests__/e2e/type-acceptance.test.ts` - Skipped test