# Requirements: Word Arithmetic & Indirect Addressing

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Add complete 16-bit (word) arithmetic support and indirect addressing to the Blend65 compiler, enabling the compiler to correctly handle ALL expressions involving word-typed values and computed memory addresses.

## Functional Requirements

### Must Have

- [ ] **R1**: Word arithmetic IL opcodes (ADD_WORD_IMM, ADD_WORD_BYTE, SUB_WORD_IMM, SUB_WORD_BYTE, CMP_WORD_IMM, CMP_WORD_BYTE)
- [ ] **R2**: Codegen for word arithmetic (16-bit A:X sequences on 6502)
- [ ] **R3**: Type-aware expression generation — `generateBinary()` checks `expr.getTypeInfo()` and uses word ops when result type is word
- [ ] **R4**: Type promotion (byte → word) — zero-extend byte to word before mixed-width ops
- [ ] **R5**: Indirect addressing codegen — `STA ($FB),Y` / `LDA ($FB),Y` using ZP scratch pointer
- [ ] **R6**: Dynamic address support for ALL 4 intrinsics (peek, poke, peekw, pokew)
- [ ] **R7**: 3-tier intrinsic addressing: Tier 1 (absolute) → Tier 2 (indexed) → Tier 3 (indirect)
- [ ] **R8**: Address expression decomposer — walks `+` chains, folds constants, collects variable terms
- [ ] **R9**: Constant folding for ALL arithmetic/bitwise ops between constants (not just `+`)
- [ ] **R10**: Word comparison support — 16-bit CMP for if/while/for conditions
- [ ] **R11**: Word increment/decrement — 16-bit INC for `wordVar++` and compound assignments

### Should Have

- [ ] **R12**: Word function parameters — pass word values via A:X pair
- [ ] **R13**: Word function return values — return word in A:X pair
- [ ] **R14**: Word bitwise operations — AND, OR, XOR, shifts on 16-bit values
- [ ] **R15**: Fix broken `pokew`/`peekw` dynamic address fallback (currently dead code that would crash)

### Won't Have (Out of Scope)

- Word multiplication (16×16→16 is complex; defer to future)
- Word division/modulo (same — needs software routine)
- Signed word arithmetic (spec only defines unsigned)
- `(Indirect,X)` addressing mode (pointer tables — separate feature)
- Word array indexing (needs separate pointer arithmetic feature)

## Technical Requirements

### Performance

- Tier 1/2 intrinsic addressing MUST generate same-or-better code as current implementation
- Word arithmetic MUST use optimal 6502 instruction sequences (no unnecessary operations)
- Constant folding MUST eliminate all compile-time-resolvable expressions

### Compatibility

- ALL existing 8578+ tests MUST continue to pass
- Existing byte-typed expressions MUST generate identical code (no regressions)
- `@address` type alias MUST work identically to `word`

### Architecture

- Word arithmetic codegen MUST follow A:X convention (low byte in A, high byte in X)
- Indirect addressing MUST use ZP scratch $FB/$FC (C64 platform-reserved)
- IL opcodes MUST follow existing naming conventions and patterns

## Scope Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| Word convention | A:X, stack-based, ZP pair | **A:X** | Matches existing LOAD_WORD/STORE_WORD convention |
| Indirect pointer | $FB/$FC, $02/$03, allocate dynamically | **$FB/$FC** | Already reserved by C64 platform as `compiler_scratch` |
| Constant folding scope | Addition only, all arithmetic, all ops | **All arithmetic + bitwise** | Thorough fix, prevents revisiting |
| Intrinsic dynamic addr | Pattern match, general eval, 3-tier | **3-tier** | Best of both: fast paths + general fallback |
| Multiplication | Include 16-bit, defer | **Defer** | 16×16 needs software routine, separate concern |

## Acceptance Criteria

1. [ ] `poke(SCREEN + 250 + i, val)` compiles and produces correct 6502 code
2. [ ] `poke(SCREEN + i + j + k, val)` compiles using indirect addressing
3. [ ] `poke(SCREEN + someFunc(), val)` compiles using indirect addressing
4. [ ] `let addr: word = $0400 + offset` produces correct 16-bit result
5. [ ] `for (i: word = 0 to 1000)` iterates correctly past 255 using word counter
6. [ ] `if (addr > $0400)` compares correctly as 16-bit
7. [ ] All 4 intrinsics (peek, poke, peekw, pokew) handle dynamic addresses
8. [ ] `sprite-test.blend` compiles successfully at all optimization levels
9. [ ] All existing 8578+ tests pass (no regressions)
10. [ ] New tests cover all word arithmetic ops, indirect addressing, and edge cases
