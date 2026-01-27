# Array Return Types Implementation Plan

> **Feature**: Support array types (`byte[5]`, `word[]`) as function return types
> **Status**: Planning Complete
> **Created**: January 27, 2026

## Overview

Currently, the Blend65 parser does not support array types as function return types. When attempting to declare a function like `function getArray(): byte[5]`, the parser fails with cascading errors because it only accepts simple type tokens (byte, word, void, etc.) for return types.

The fix is straightforward: use the existing `parseTypeAnnotation()` method for return type parsing instead of the simple token check. This method already fully supports array types including explicit sizes, inferred sizes, and multidimensional arrays.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [Parser Changes](03-parser-changes.md) | Parser modification specification |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Usage Examples

```js
// Return fixed-size array
function getColors(): byte[3] {
  return [1, 2, 3];
}

// Return inferred-size array (size known at compile time)
function getData(): byte[] {
  return [10, 20, 30, 40, 50];
}

// Return multidimensional array
function getMatrix(): byte[2][3] {
  return [[1, 2, 3], [4, 5, 6]];
}
```

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Implementation approach | Use existing `parseTypeAnnotation()` method |
| Scope | Parser change only; type checker already handles arrays |
| Testing | Add parser tests for array return types |

## Related Files

| File | Purpose |
|------|---------|
| `packages/compiler/src/parser/parser.ts` | Main parser - `parseFunctionDecl()` method |
| `packages/compiler/src/parser/declarations.ts` | Contains `parseTypeAnnotation()` |
| `packages/compiler/src/__tests__/parser/` | Parser tests |