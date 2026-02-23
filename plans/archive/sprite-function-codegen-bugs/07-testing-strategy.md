# Testing Strategy: Sprite Function Codegen Bugs

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- Unit tests: Each bug fix has targeted tests proving the fix
- Integration tests: `getSpriteFrame()` compiles to correct IL
- E2E tests: Spinning-line example compiles at O0, O1, O2, O3 and assembles with ACME
- Regression: Full `./compiler-test` passes after all changes

## Test Categories

### Bug #1: Address-of Argument Promotion

| Test | Description | Priority |
|------|-------------|----------|
| `@var arg to word param skips promotion` | `func(@data)` where param is word → no PROMOTE_BYTE_WORD | High |
| `byte arg to word param still promotes` | `func(byteVar)` where param is word → PROMOTE_BYTE_WORD | High |
| `literal arg to word param still promotes` | `func(42)` where param is word → PROMOTE_BYTE_WORD | High |
| `@var arg to byte param unchanged` | `func(@data)` where param is byte → no promotion at all | Medium |
| `isAddressOfExpression helper` | Correctly identifies UnaryExpression with AT operator | Medium |

### Bug #2: Word Division

| Test | Description | Priority |
|------|-------------|----------|
| `word / 64 generates shift-right` | `spriteAddr / 64` → 6× LSR/ROR word pattern | High |
| `word / 32 generates shift-right` | Power-of-2 divisor → correct shift count | Medium |
| `word / 2 generates single shift` | Simplest case | Medium |
| `byte / 64 unchanged` | Byte division still uses __div8 | High |
| `word / 10 uses runtime` | Non-power-of-2 → JSR __div16 | Medium |
| `inferWordWidthFromExpression` | Correctly detects word-sized slots | Medium |
| `DIVIDE case in generateBinaryWordImmediate` | Switch case exists and handles power-of-2 | High |

### Bug #3: For-Loop Byte Overflow

| Test | Description | Priority |
|------|-------------|----------|
| `for byte 0 to 255 valid assembly` | No CMP #256 in output | High |
| `for byte 100 to 255 valid assembly` | Non-zero start with end=255 | High |
| `for byte 0 to 254 unchanged` | Normal case regression | High |
| `for byte 0 to 0 single iteration` | Edge case | Medium |
| `for word 0 to 255 unchanged` | Word loop, no overflow issue | Medium |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| `getSpriteFrame IL generation` | Parser + IL Gen | Full function compiles to correct IL sequence |
| `getSpriteFrame with @sprite arg` | IL Gen + Codegen | `getSpriteFrame(@data, 0)` produces valid assembly |
| `multi-frame sprite data emission` | Data segment | Single `!align` + contiguous data blocks |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Spinning-line O0 | Compile at O0, check assembly | Valid ACME assembly, contains getSpriteFrame label |
| Spinning-line O1 | Compile at O1, check assembly | Valid ACME assembly |
| Spinning-line O2 | Compile at O2, check assembly | Valid ACME assembly |
| Spinning-line O3 | Compile at O3, check assembly | Valid ACME assembly, may inline getSpriteFrame |
| Spinning-line ACME | Compile + assemble with ACME | No assembler errors |

## Test Location

Tests should be added to appropriate existing test files:

| Bug | Test File Location |
|-----|-------------------|
| Bug #1 | `__tests__/il/generator-address-of.test.ts` (extend existing) |
| Bug #2 | `__tests__/il/generator-expressions.test.ts` or new `generator-word-division.test.ts` |
| Bug #3 | `__tests__/il/generator-for-loop.test.ts` or extend existing control-flow tests |
| E2E | `__tests__/e2e/pipeline/` — extend or add spinning-line test |

## Verification Commands

```bash
# After Bug #1 fix
./compiler-test il

# After Bug #2 fix
./compiler-test il

# After Bug #3 fix
./compiler-test il

# After example update — targeted
./compiler-test il e2e

# Final verification — ALL tests
./compiler-test
```

## Verification Checklist

- [ ] All Bug #1 tests pass
- [ ] All Bug #2 tests pass
- [ ] All Bug #3 tests pass
- [ ] getSpriteFrame integration tests pass
- [ ] Spinning-line compiles at O0, O1, O2, O3
- [ ] Spinning-line assembles with ACME at all levels
- [ ] No regressions in full test suite (`./compiler-test`)
- [ ] Generated assembly for getSpriteFrame contains LSR/ROR pattern (not JSR __div)
- [ ] Generated assembly has no CMP #256 anywhere
- [ ] Single `!align 63, 0` in data segment for lineFrames
