# Requirements: Word Comparison Codegen Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix the IL generator to emit correct 16-bit comparison opcodes when word-typed operands are used in if/while conditions and dynamic for-loop bounds. Currently, these paths always emit byte-width comparisons regardless of operand type.

## Functional Requirements

### Must Have

- [ ] `if (wordVar == wordLiteral)` emits `CMP_WORD_IMM` (not `CMP_IMM`)
- [ ] `if (wordVar > wordVar2)` emits `CMP_WORD_SLOT` (not `CMP_BYTE`)
- [ ] `if (wordVar != constIdentifier)` emits `CMP_WORD_IMM` when const resolves to >255
- [ ] `while (wordVar < wordLiteral)` emits `CMP_WORD_IMM` (same path as if)
- [ ] `for (i: word = 0 to dynamicWordExpr)` saves/compares full 16-bit counter
- [ ] All 6 comparison operators work with word types: `==`, `!=`, `<`, `<=`, `>`, `>=`
- [ ] No regressions in existing byte comparison behavior
- [ ] ACME assembles word comparison output without errors

### Should Have

- [ ] Mixed type comparisons handled (byte left, word right in conditions)
- [ ] Test coverage for all word comparison operators in condition path

### Won't Have (Out of Scope)

- Ternary condition word-awareness (already works via expression path)
- Expression path changes (already correct via `generateBinaryWord`)
- For-loop constant condition changes (already correct via `generateForConditionConstant`)

## Technical Requirements

### Specification Compliance

Per `docs/language-specification-v2/04-expressions.md`:
- All 6 comparison operators are supported for word types
- Word types are 16-bit unsigned values (0-65535)
- Comparisons produce boolean results

### 6502 Architecture

- CMP instruction only accepts 8-bit immediate operands
- 16-bit comparison requires high byte compare first (CPX), then low byte (CMP)
- Flag semantics: Z flag for equality, C flag for unsigned greater-or-equal

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Fix both bugs together | Fix W1 only vs fix both | Fix both | Same file, same pattern, small incremental effort |
| Approach | Refactor condition path vs add type checks | Add type checks | Minimal change, mirrors existing patterns in same file |

## Acceptance Criteria

1. [ ] `examples/test-suite/02-word-arithmetic` compiles and assembles at all optimization levels
2. [ ] All existing tests pass (`./compiler-test`)
3. [ ] New tests cover word comparisons in condition path
4. [ ] `bug-list.md` updated to mark W1 as fixed
5. [ ] VICE verification passes for test 02 (via `diag_batch.sh`)
