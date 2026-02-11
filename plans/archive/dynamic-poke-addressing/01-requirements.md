# Requirements: Dynamic Poke/Peek Addressing

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The Blend65 compiler needs to support more address expression patterns in `poke()` and `peek()` intrinsics. Currently, the IL generator can only decompose address expressions into two patterns:

1. **Pure constant**: `poke($D020, value)` — resolved at compile time
2. **Constant + variable**: `poke(SCREEN_BASE + i, value)` — uses X-indexed addressing

Two additional patterns are needed:

3. **Compound constants + variable**: `poke(SCREEN_BASE + 250 + i, value)` — requires constant folding
4. **Constant + word variable**: `poke(SCREEN_BASE + offset, value)` where offset is 16-bit — requires indirect addressing

## Functional Requirements

### Must Have

- [ ] Constant folding in `tryResolveConstantAddress()` to evaluate `CONST + CONST`, `CONST - CONST`, `CONST + literal`, etc.
- [ ] Support for `poke(CONST + CONST + byte_var, value)` pattern via absoluteX addressing
- [ ] Support for `peek(CONST + CONST + byte_var)` pattern via absoluteX addressing
- [ ] Same fix for `volatile_read` and `volatile_write` (they share the same code paths)
- [ ] Detection of word-type offsets in `tryDecomposeIndexedAddress()` to prevent silent incorrect code
- [ ] Clear error message when word-type offset is used but indirect addressing isn't available yet
- [ ] The example `examples/sprite-test/sprite-test.blend` compiles successfully at all optimization levels
- [ ] All existing 8578+ tests continue to pass (no regressions)

### Should Have

- [ ] Support for `poke(CONST + word_var, value)` via 6502 indirect indexed `STA ($ptr),Y` addressing
- [ ] Support for `peek(CONST + word_var)` via 6502 indirect indexed `LDA ($ptr),Y` addressing
- [ ] New IL opcode or operand extension for indirect addressing mode
- [ ] Codegen support for emitting indirect indexed instructions from IL POKE/PEEK

### Won't Have (Out of Scope)

- Fully dynamic addresses (both address components are runtime values)
- Indirect indexed with non-zero Y offset (always Y=0 for this use case)
- Changes to `peekw`/`pokew` (16-bit read/write) — they have different addressing needs
- Changes to the language specification (these are compiler implementation fixes)

## Technical Requirements

### Performance

- Constant folding is zero-cost (compile-time evaluation)
- X-indexed addressing: same 4-cycle cost as before
- Indirect indexed addressing: ~10 cycles (store to ZP pointer + LDA/STA indirect)
- No performance regression for existing poke/peek patterns

### Compatibility

- All existing poke/peek patterns must continue to work identically
- No changes to IL opcode values or binary format
- Codegen changes must work with existing ASM IL optimizer passes

### Correctness

- Constant folding must handle 16-bit address arithmetic correctly (no overflow bugs)
- Word-type offset detection must prevent the current silent truncation bug
- Indirect addressing must correctly handle the full 16-bit address range

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Constant folding scope | All operators / Only +,- | Only +,- | Address arithmetic uses only addition and subtraction |
| Word offset strategy | Error message / Indirect addressing | Both (phased) | Error first for safety, then indirect support |
| ZP pointer allocation | Fixed locations / Dynamic allocation | Fixed ($FB/$FC) | Standard C64 convention for temp pointers |
| Operand representation | New IL opcode / Extended operand | Extended operand | Less invasive, reuses existing POKE/PEEK opcodes |

## Acceptance Criteria

1. [ ] `examples/sprite-test/sprite-test.blend` compiles at -O0, -O1, -O2, -O3 without errors
2. [ ] `poke(CONST + CONST + byte_var, value)` generates correct `STA $XXXX,X` assembly
3. [ ] `peek(CONST + CONST + byte_var)` generates correct `LDA $XXXX,X` assembly
4. [ ] `poke(CONST + word_var, value)` generates correct `STA ($ptr),Y` assembly
5. [ ] `peek(CONST + word_var)` generates correct `LDA ($ptr),Y` assembly
6. [ ] All 8578+ existing tests pass (zero regressions)
7. [ ] New tests cover all added patterns
8. [ ] Constant folding handles nested expressions: `CONST1 + CONST2 + CONST3 + var`
