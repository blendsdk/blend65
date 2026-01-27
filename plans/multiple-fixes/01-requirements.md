# Requirements: Skipped Tests Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The Blend65 compiler has 18 skipped tests that document known implementation gaps. This plan addresses 13 of these tests (the 5 remaining are language limitations or advanced features out of current scope).

## Functional Requirements

### Must Have

- [ ] **R1**: Array literals `[1, 2, 3]` must generate correct byte values `!byte $01, $02, $03`
- [ ] **R2**: Local variables in functions must generate proper LDA/STA instructions (not STUB comments)
- [ ] **R3**: Equality comparisons must generate `BNE` for branch-if-not-equal patterns
- [ ] **R4**: Inequality comparisons must generate `BEQ` for branch-if-equal patterns
- [ ] **R5**: Uninitialized arrays must generate `!fill N, $00` directives

### Should Have

- [ ] **R6**: Zero-page allocation for local variables (faster than stack)
- [ ] **R7**: Proper array size calculation for word arrays (`!fill N*2`)
- [ ] **R8**: Source location tracking for generated instructions

### Won't Have (Out of Scope)

- `length()` intrinsic with string literals (type system change)
- Array return types from functions (complex type system change)
- Ternary expressions in function arguments (IL generator complexity)
- Strength reduction optimizer (future optimizer phase)
- Performance consistency tests (inherently flaky)

## Technical Requirements

### IL Generator (Array Initializers)

- Extract numeric values from `ArrayLiteralExpression` AST nodes
- Store values in `ILGlobalVariable.initialValue` as `number[]`
- Handle hex (`$FF`), decimal (`255`), and binary (`0b11111111`) literals

### Code Generator (Local Variables)

- Allocate zero-page addresses for function-local variables
- Track allocations per-function (reset on function entry)
- Generate `LDA` for variable reads, `STA` for writes
- Handle byte, word, and boolean types

### Code Generator (Branch Selection)

- Map comparison types to correct branch instructions:
  - `CMP_EQ` → `BNE` (branch if NOT equal to skip true block)
  - `CMP_NE` → `BEQ` (branch if equal to skip true block)
  - `CMP_LT` → `BCS` (branch if carry set to skip)
  - `CMP_GE` → `BCC` (branch if carry clear to skip)

### Code Generator (Data Directives)

- Generate `!fill N, $00` for uninitialized byte arrays
- Generate `!fill N*2, $00` for uninitialized word arrays
- Generate `!byte val1, val2, ...` for initialized arrays

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Local var allocation | Stack, Zero-page | Zero-page | Simpler, faster on 6502, matches existing @zp pattern |
| Array value extraction | IL phase, Codegen phase | IL phase | Cleaner separation, IL can validate types |
| Branch generation | Pattern table, Switch statement | Switch statement | Simpler, fewer indirections |
| Scope of fixes | All 18, Only fixable 13 | 13 tests | Type system changes require separate planning |

## Acceptance Criteria

1. [ ] All 13 targeted tests are enabled (removed `.skip`)
2. [ ] All 13 targeted tests pass
3. [ ] No regressions in existing 6963 tests
4. [ ] Each fix has at least 3 test cases covering normal and edge cases
5. [ ] Code follows existing patterns in codegen modules
6. [ ] Comments explain the fix approach

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Zero-page overflow with many locals | Low | High | Track ZP usage, warn if exceeding safe range |
| Array initializer affects performance | Low | Low | Values are compile-time constants |
| Branch instruction breaks existing tests | Medium | High | Run full test suite after each change |
| Local variable breaks complex functions | Medium | Medium | Test with nested scopes, multiple locals |

## Dependencies

### Internal Dependencies

- IL Generator must be complete before codegen fixes
- Local variable tracking depends on function scope tracking

### External Dependencies

- None (all fixes are internal to compiler)

## Verification

Each requirement will be verified by:
1. Enabling the corresponding skipped test
2. Running the test to confirm it passes
3. Running full test suite to check for regressions