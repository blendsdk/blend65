# Requirements: IL Generator ↔ Codegen Operand Mismatch Fixes

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Fix six systematic bugs in the IL generator's expression layer where binary operators
and compound assignments either crash the codegen or produce silent wrong code due to
operand mismatches between IL emission and codegen consumption.

## Functional Requirements

### Must Have

- [ ] `i % 3` (modulo with literal) compiles without crash
- [ ] `i / 3` (divide with literal) compiles without crash
- [ ] `a + (b * c)` (complex right operand) compiles without crash
- [ ] `x << 3` (left shift with literal) generates correct ASL instructions
- [ ] `x >> 1` (right shift with literal) generates correct LSR instructions
- [ ] `x <<= n` (shift compound assign) generates correct shift code
- [ ] `x *= 2` (multiply compound assign) generates correct multiply code
- [ ] `x /= 3` (divide compound assign) generates correct divide code
- [ ] `x %= 3` (modulo compound assign) generates correct modulo code
- [ ] All 6500+ existing tests continue to pass (zero regression)
- [ ] `sprite-test.blend` example compiles successfully at O0 and O3

### Should Have

- [ ] Shift with variable right operand (`x << n`) handles correctly
- [ ] All binary operators work with all operand combinations (imm, slot, complex)

### Won't Have (Out of Scope)

- Word-width complex binary expressions (documented as "not yet supported")
- New `DIV_IMM`/`MOD_IMM` IL opcodes (use ZP temp + existing `_BYTE` pattern instead)
- Shift with non-constant count > 7 (undefined behavior for 8-bit values)

## Technical Requirements

### Correctness

- All fixes must produce semantically correct 6502 assembly
- ZP temp usage ($FE/$FF) must not conflict with nested expressions
- Shift counts must be clamped or validated (0-7 for byte)

### Compatibility

- All existing tests must pass unchanged
- No changes to IL opcode numbering or semantics of existing opcodes
- New `DIV_IMM`/`MOD_IMM` opcodes follow existing `MUL_IMM` pattern exactly

### Performance

- No performance regression for already-working paths
- New paths should generate optimal 6502 code where possible

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|---|---|---|---|
| Div/mod immediate handling | A: New DIV_IMM/MOD_IMM opcodes, B: ZP temp in IL gen | A: New opcodes | Cleaner architecture, matches MUL_IMM pattern, codegen handles ZP temp internally |
| Complex binary path | A: Use ZP temp slot, B: Rewrite to stack-based codegen | A: ZP temp | Minimal change, reuses existing codegen handlers |
| Shift with variable count | A: Support, B: Defer | A: Support for slot, defer complex | Slot case is straightforward loop of ASL/LSR |

## Acceptance Criteria

1. [ ] All 6500+ existing tests pass (zero regression)
2. [ ] New tests cover all six bug categories
3. [ ] `sprite-test.blend` compiles at O0 and O3
4. [ ] No new compiler warnings or errors
5. [ ] Code follows project coding standards (code.md)
