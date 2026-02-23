# Testing Strategy: Assembly-Time Address Expressions

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: IL generator pattern detection
- Integration tests: Full pipeline (source → ASM output)
- E2E tests: Balloon sprite compiles and ACME assembles correctly

## Test Categories

### Unit Tests — IL Generator (`__tests__/il/generator-address-expr.test.ts`)

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 1 | `@data var / 64` emits LOAD_ADDRESS_EXPR | Division on @data variable | High |
| 2 | `@sprite var / 64` emits LOAD_ADDRESS_EXPR | Division on @sprite variable | High |
| 3 | `@data var >> 6` emits LOAD_ADDRESS_EXPR (shift) | Right shift variant | High |
| 4 | `@ram var / 256` constant-folds to LOAD_IMM | RAM with known address | High |
| 5 | `@zp var / 64` constant-folds to LOAD_IMM | ZP with known address | Med |
| 6 | Division by 0 falls through to normal codegen | Edge: zero divisor | High |
| 7 | Non-constant divisor falls through | `@var / x` where x is variable | Med |
| 8 | Non-address-of left falls through | `x / 64` normal division | Med |
| 9 | `@data var / const_ident` works with const | `@var / SPRITE_SIZE` where const SPRITE_SIZE=64 | Med |
| 10 | `@data var >> const_ident` works with const | Same for shift | Med |

### E2E Pipeline Tests (`__tests__/e2e/pipeline/address-expr.test.ts`)

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 1 | `@sprite var / 64` produces `LDA #(label / 64)` in ASM | Division in assembly output | High |
| 2 | `@sprite var >> 6` produces `LDA #(label >> 6)` in ASM | Shift in assembly output | High |
| 3 | `@charset var / 1024` produces `LDA #(label / 1024)` | Charset pointer pattern | Med |
| 4 | `@data var / 64 + frameOffset` produces add after expr | Sprite frame arithmetic | High |
| 5 | Multiple `@var / N` in same function | No interference | Med |
| 6 | `@data(align:64) var / 64` same as `@sprite var / 64` | Explicit alignment | Med |
| 7 | Compiles at O0 and O3 without errors | Optimizer compatibility | High |
| 8 | `poke($07F8, @spriteData / 64)` — direct in poke call | Inline usage pattern | High |

### Balloon Sprite Verification

| # | Test | Description | Priority |
|---|------|-------------|----------|
| 1 | Updated balloon-sprite compiles without errors | Basic compilation | High |
| 2 | ACME assembles the output .asm without errors | Assembler acceptance | High |
| 3 | Generated ASM contains `LDA #(__data_.../ 64)` | Correct assembly output | High |
| 4 | No runtime multiplication code generated | No `__mul8` for sprite ptr | Med |

## Test Data

### Fixtures Needed

- Standard `@sprite` array with 63 bytes
- `@charset` array with 8 bytes  
- `@data(align: 64)` explicit alignment array
- `@ram` variable at known address (e.g., $2000)

### Helper Functions

Reuse existing test helpers:
- `compileToIL()` — for IL-level tests
- `compileBlend()` — for E2E pipeline tests  
- `getAssembly()` — for ASM output verification
- `findInstructions()` / `hasOpcode()` — for IL verification

## Verification Checklist

- [ ] All unit tests pass
- [ ] All E2E pipeline tests pass
- [ ] Balloon sprite example compiles
- [ ] ACME assembles balloon sprite .prg
- [ ] No regressions in existing tests (`./compiler-test`)
- [ ] Optimizer passes handle new opcode (O0-O3 all work)
