# Requirements: CALL_VOID Bug and length() String Support

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

This document specifies the requirements for fixing two related compiler issues:

1. **CALL_VOID Bug**: Ensure the IL generator correctly distinguishes between `CALL` (for functions that return values) and `CALL_VOID` (for void functions).

2. **length() String Support**: Extend the `length()` intrinsic to accept string literals in addition to array variables.

## Functional Requirements

### Must Have

**CALL_VOID Bug Fix**:
- [ ] IL generator must emit `CALL` instruction for functions that return a value
- [ ] IL generator must emit `CALL_VOID` instruction only for void functions
- [ ] Function return type must be correctly determined from symbol table
- [ ] Fix must work for all call contexts (return statements, expressions, ternary branches)

**length() String Support**:
- [ ] `length("hello")` must return 5 (string literal length)
- [ ] `length()` must continue to work with array variables
- [ ] Return type must be `word` (16-bit) to support large arrays/strings

### Should Have

- [ ] Clear error messages when length() is called with unsupported argument types
- [ ] Warning if CALL_VOID is used with a discarded return value (optional enhancement)

### Won't Have (Out of Scope)

- length() with computed strings (runtime string concatenation)
- length() with string variables (only string literals and array variables)
- CALL_INDIRECT support (indirect function calls)

## Technical Requirements

### Correctness

- Must not introduce regressions in existing tests
- All existing CALL and CALL_VOID tests must continue to pass
- All existing length() tests must continue to pass

### Compatibility

- No changes to IL instruction format
- No changes to ASM-IL translation
- No changes to code generation

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| CALL_VOID fix location | Type checker vs IL generator | IL generator | Bug is in IL generation, not type checking |
| length() string handling | New intrinsic vs extend existing | Extend existing | Simpler, consistent behavior |
| String variable support | Now vs Later | Later | Requires type system changes |

## Acceptance Criteria

1. [ ] Skipped test "ternary inside function call argument" passes
2. [ ] Skipped test "should accept length() with string literal" passes
3. [ ] All existing tests pass (no regressions)
4. [ ] Code review confirms correct CALL/CALL_VOID selection logic
5. [ ] Code is documented with JSDoc comments