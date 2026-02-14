# Testing Strategy: IL Generator ↔ Codegen Operand Fixes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- All 6 bug categories covered with dedicated tests
- Each fix verified at IL level (correct opcodes emitted) and E2E level (compiles without crash)
- Zero regression on existing 6500+ tests

## Test Categories

### Unit Tests — IL Generator

New test file: `__tests__/il/generator-binary-operand-fixes.test.ts`

| Test | Description | Priority |
|---|---|---|
| `i % 3` emits MOD_IMM | Verify modulo with literal emits MOD_IMM opcode | High |
| `i / 3` emits DIV_IMM | Verify divide with literal emits DIV_IMM opcode | High |
| `x << 3` emits SHL_BYTE | Verify left shift with literal emits SHL_BYTE | High |
| `x >> 1` emits SHR_BYTE | Verify right shift with literal emits SHR_BYTE | High |
| `a + (b * c)` emits ADD_BYTE with slot | Verify complex right produces proper operand | High |
| `a - (b * c)` emits SUB_BYTE with slot | Verify complex right produces proper operand | High |
| `a * (b + c)` emits MUL_BYTE with slot | Verify complex right produces proper operand | Medium |
| `a / (b + c)` emits DIV_BYTE with slot | Verify complex right produces proper operand | Medium |
| `a % (b + c)` emits MOD_BYTE with slot | Verify complex right produces proper operand | Medium |
| `a & (b \| c)` emits AND_BYTE with slot | Verify complex right produces proper operand | Medium |

### Unit Tests — Codegen

| Test | Description | Priority |
|---|---|---|
| DIV_IMM generates correct 6502 | STA $FE / LDA #val / STA $FF / LDA $FE / JSR __div8 | High |
| MOD_IMM generates correct 6502 | STA $FE / LDA #val / STA $FF / LDA $FE / JSR __mod8 | High |

### Unit Tests — Compound Assignment

| Test | Description | Priority |
|---|---|---|
| `x *= 3` emits MUL_IMM | Literal multiply assign | High |
| `x /= 3` emits DIV_IMM | Literal divide assign | High |
| `x %= 3` emits MOD_IMM | Literal modulo assign | High |
| `x <<= 2` emits SHL_BYTE | Literal shift-left assign | High |
| `x >>= 1` emits SHR_BYTE | Literal shift-right assign | High |

### End-to-End Tests

New test file: `__tests__/e2e/pipeline/binary-operand-fixes.test.ts`

| Scenario | Steps | Expected Result |
|---|---|---|
| Modulo with literal | `let r = i % 3;` | Compiles at O0 and O3 without crash |
| Divide with literal | `let h = total / 2;` | Compiles at O0 and O3 without crash |
| Shift operators | `let d = x << 1; let h = x >> 2;` | Compiles, generates ASL/LSR |
| Complex right operand | `let r = a + (b * c);` | Compiles without crash |
| Compound assignments | `x *= 2; x /= 3; x %= 5;` | Compiles without crash |
| sprite-test.blend | Full example program | Compiles at O0 and O3 |

## Test Data

### Fixtures Needed

No new fixture files needed. Tests use inline Blend source strings.

### Mock Requirements

No mocks needed. All tests use real compiler pipeline (per code.md Rule 25).

## Verification Checklist

- [ ] All existing 6500+ tests pass (baseline before changes)
- [ ] All new unit tests pass
- [ ] All new E2E tests pass
- [ ] No regressions in existing tests after changes
- [ ] `sprite-test.blend` compiles at O0
- [ ] `sprite-test.blend` compiles at O3
- [ ] Test coverage for all 6 bug categories
