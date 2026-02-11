# Testing Strategy

> **Document**: 09-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Test Categories

### Unit Tests — IL Layer
- Word arithmetic opcodes emit correctly from builder
- Address decomposer: constant-only, mixed, complex expressions
- Constant folding: all operator combinations
- Type promotion: byte→word emits PROMOTE_BYTE_WORD

### Unit Tests — Codegen Layer
- Each word arithmetic opcode generates correct 6502 sequence
- Indirect addressing: STORE_ZP_PTR, POKE_INDIRECT, PEEK_INDIRECT
- INC_WORD, DEC_WORD, CMP_WORD sequences

### Integration Tests — Full Pipeline
- `let addr: word = $0400 + offset` → correct IL + ASM
- `poke(SCREEN + i, val)` all 3 tiers produce correct code
- Word loop: `for (i: word = 0 to 1000)` with word counter iterating past 255
- Word comparison: `if (addr > $0400)`
- Mixed expressions: `byte + word`, `word + byte`, `word + word`

### E2E Tests — Complete Compilation
- `sprite-test.blend` compiles at O0-O3 without errors
- Programs using dynamic poke/peek produce correct ASM output
- Multi-module programs with word function params

### Regression Tests
- ALL 8578+ existing tests must pass unchanged
- Byte-only programs generate IDENTICAL code (no regressions)

## Verification

```bash
# After each phase:
./compiler-test

# Targeted during development:
./compiler-test il codegen
./compiler-test e2e pipeline
```
