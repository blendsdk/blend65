# Testing Strategy: Word Comparison Codegen Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: All word comparison operators in condition path
- Integration tests: Full pipeline from Blend source to assembly
- E2E tests: ACME assembly validation for word comparisons
- VICE verification: `02-word-arithmetic` test suite passes

## Test Categories

### Unit Tests — IL Generator Condition Path

**File**: `packages/compiler/src/__tests__/il/generator-word-comparisons.test.ts` (extend existing)

New `describe` block: `ILGenerator - Word Comparison in If-Conditions`

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 1 | `if (wordVar == literal)` emits `CMP_WORD_IMM` | Word vs literal equality in if-condition | High |
| 2 | `if (wordVar < literal)` emits `CMP_WORD_IMM` | Word vs literal less-than in if-condition | High |
| 3 | `if (wordVar > literal)` emits `CMP_WORD_IMM` | Word vs literal greater-than in if-condition | High |
| 4 | `if (wordVar != literal)` emits `CMP_WORD_IMM` | Word vs literal not-equal in if-condition | High |
| 5 | `if (wordVar <= literal)` emits `CMP_WORD_IMM` | Word vs literal less-equal in if-condition | High |
| 6 | `if (wordVar >= literal)` emits `CMP_WORD_IMM` | Word vs literal greater-equal in if-condition | High |
| 7 | `if (wordVar == wordVar2)` emits `CMP_WORD_SLOT` | Word vs word variable in if-condition | High |
| 8 | `if (wordVar > wordVar2)` emits `CMP_WORD_SLOT` | Word vs word variable greater-than | High |
| 9 | `if (byteVar == literal)` still emits `CMP_IMM` | Byte comparison regression check | High |
| 10 | `while (wordVar < literal)` emits `CMP_WORD_IMM` | Word comparison in while-condition | Medium |

**Test pattern**: Use `IfStatement` AST nodes instead of `ExpressionStatement` to exercise `generateConditionWithBranch()` rather than the expression path.

### Unit Tests — Dynamic For-Loop Word Path

**File**: Extend `packages/compiler/src/__tests__/il/generator-word-for-loop.test.ts` or new file

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 11 | Word for-loop with dynamic bound uses word comparison | `for (i: word = 0 to wordLimit)` | Medium |
| 12 | Byte for-loop with dynamic bound still uses byte comparison | Regression check | Medium |

### E2E Pipeline Tests

**File**: `packages/compiler/src/__tests__/e2e/pipeline/word-arithmetic.test.ts` (verify existing pass)

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 13 | Existing word comparison e2e tests still pass | `if (addr == $0400)` etc. | High |
| 14 | No ACME errors for word if-conditions | Compilation succeeds through ACME | High |

### VICE Verification

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 15 | `02-word-arithmetic` passes `diag_batch.sh` | All 11 VICE checks pass | High |

## Test Data

### Fixtures Needed

The tests will construct AST nodes directly (as done in existing `generator-word-comparisons.test.ts`), using:
- `IfStatement` with `BinaryExpression` condition containing word-typed operands
- `WhileStatement` with word comparison condition
- Word slots (`createWordSlot()`) and byte slots (`createByteSlot()`)

### Mock Requirements

None — use real `ILGenerator`, `SymbolTable`, `Frame` objects (per code.md Rule 25).

## Verification Checklist

- [ ] All new unit tests pass (`./compiler-test il`)
- [ ] All existing unit tests pass (`./compiler-test il`)
- [ ] E2E word-arithmetic tests pass (`./compiler-test e2e`)
- [ ] Full test suite passes (`./compiler-test`)
- [ ] `diag_batch.sh` shows 02-word-arithmetic passing at all optimization levels
- [ ] No regressions in byte comparison behavior
