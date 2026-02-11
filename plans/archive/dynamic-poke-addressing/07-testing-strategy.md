# Testing Strategy: Dynamic Poke/Peek Addressing

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: 100% coverage for modified methods
- Integration tests: All new address patterns through IL → codegen pipeline
- E2E tests: sprite-test.blend compiles at all optimization levels

## Test Categories

### Unit Tests — Constant Folding

| Test | Description | Priority |
|------|-------------|----------|
| `tryResolveConstantAddress` with `CONST + literal` | Verify folding of `SCREEN_BASE + 250` | High |
| `tryResolveConstantAddress` with `CONST - literal` | Verify subtraction folding | High |
| `tryResolveConstantAddress` with `CONST + CONST` | Two const identifiers added | High |
| `tryResolveConstantAddress` with nested binary | `CONST + CONST + CONST` (left-associative) | High |
| `tryResolveConstantAddress` with `literal + literal` | `$0400 + 250` | Medium |
| `tryResolveConstantAddress` overflow wrapping | `$FF00 + $200` wraps to valid address | Medium |
| `tryResolveConstantAddress` underflow wrapping | `$0100 - $200` wraps | Medium |
| `tryResolveConstantAddress` with non-const var | Returns `undefined` (no folding) | High |
| `tryResolveConstantAddress` with multiply | Returns `undefined` (unsupported op) | Medium |

### Unit Tests — Indexed Address Decomposition

| Test | Description | Priority |
|------|-------------|----------|
| `tryDecomposeIndexedAddress` with folded base | `(CONST + CONST) + var` decomposes correctly | High |
| `tryDecomposeIndexedAddress` with subtracted base | `(CONST - CONST) + var` decomposes correctly | Medium |
| `tryDecomposeIndexedAddress` preserves byte offset | Byte-type offset returns as-is | High |

### Unit Tests — Word Offset Detection

| Test | Description | Priority |
|------|-------------|----------|
| Word offset detected | `CONST + word_var` correctly identified | High |
| Byte offset not flagged | `CONST + byte_var` uses normal indexed path | High |

### Integration Tests — IL Generation

| Test | Components | Description |
|------|------------|-------------|
| Poke with folded constant base | IL gen + builder | `poke(SCREEN_BASE + 250 + i, val)` generates indexed POKE with folded base |
| Peek with folded constant base | IL gen + builder | `peek(SCREEN_BASE + 500 + i)` generates indexed PEEK with folded base |
| Poke with word offset | IL gen + builder | `poke(SCREEN_BASE + word_var, val)` generates indirect POKE (Phase B) |
| Peek with word offset | IL gen + builder | `peek(SCREEN_BASE + word_var)` generates indirect PEEK (Phase B) |
| volatile_write with folded base | IL gen + builder | Same as poke, different label |
| volatile_read with folded base | IL gen + builder | Same as peek, different label |

### Integration Tests — Codegen

| Test | Components | Description |
|------|------------|-------------|
| Folded base generates correct STA | codegen intrinsics | `STA $04FA,X` for base=$04FA |
| Indirect POKE generates STA (ptr),Y | codegen intrinsics | `STA ($FB),Y` (Phase B) |
| Indirect PEEK generates LDA (ptr),Y | codegen intrinsics | `LDA ($FB),Y` (Phase B) |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| sprite-test.blend at -O0 | Compile with -O0 | Success, no errors |
| sprite-test.blend at -O1 | Compile with -O1 | Success, no errors |
| sprite-test.blend at -O2 | Compile with -O2 | Success, no errors |
| sprite-test.blend at -O3 | Compile with -O3 | Success, no errors |
| Screen clear pattern | `poke(BASE + 250 + i, 32)` through pipeline | Correct folded address in output ASM |
| Word offset pattern | `poke(BASE + word_offset, char)` through pipeline | Correct indirect addressing in output ASM |
| Nested constants | `poke(A + B + C + i, val)` where A, B, C are consts | All folded to single constant |

## Test Data

### Fixtures Needed

- Blend source with compound constant poke patterns (similar to clearScreen)
- Blend source with word-offset poke patterns (similar to drawStars)
- Blend source mixing both patterns in one program

### Mock Requirements

- Use real Lexer, Parser, SemanticAnalyzer (no mocks per code.md Rule 25)
- Use real ILGenerator and Codegen for integration tests
- Use real FrameAllocator for slot resolution

## Verification Checklist

- [ ] All unit tests for constant folding pass
- [ ] All unit tests for word offset detection pass
- [ ] All integration tests for IL generation pass
- [ ] All integration tests for codegen pass
- [ ] All E2E tests for sprite-test.blend pass
- [ ] All 8578+ existing tests pass (no regressions)
- [ ] Test coverage meets goals (100% for modified methods)
- [ ] Tests follow code.md Rules 4-8
