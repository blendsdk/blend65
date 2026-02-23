# Testing Strategy: Address-Of Operator Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

- IL generator: `@variable` produces `LOAD_ADDRESS` opcode
- Codegen: `LOAD_ADDRESS` produces correct ACME `#<label` / `#>label` assembly
- End-to-end: `hi(@data) * 4` computes correct sprite pointer
- Optimizer: `LOAD_ADDRESS` survives all optimization levels
- Regression: All 8901+ existing tests still pass

## Test Categories

### Unit Tests — IL Generator

| Test | Description | Priority |
|------|-------------|----------|
| `@` on @data variable | `@balloonData` generates LOAD_ADDRESS with correct slot | High |
| `@` on @ram variable | `@counter` generates LOAD_ADDRESS with numeric address | High |
| `@` on @zp variable | `@zpVar` generates LOAD_ADDRESS with ZP address | Medium |
| `@` on local variable | `@localVar` generates LOAD_ADDRESS with frame slot | Medium |
| `@` with hi() | `hi(@data)` generates LOAD_ADDRESS + HI | High |
| `@` with lo() | `lo(@data)` generates LOAD_ADDRESS + LO | Medium |

### Unit Tests — Codegen

| Test | Description | Priority |
|------|-------------|----------|
| LOAD_ADDRESS with dataLabel | Produces `LDA #<label` / `LDX #>label` | High |
| LOAD_ADDRESS with numeric addr | Produces `LDA #lo` / `LDX #hi` | High |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Balloon sprite pointer | Compile balloon-sprite, inspect ASM | `LDA #<__data_...` / `LDX #>__data_...` in output |
| hi(@data) * 4 | Full pipeline compile | Correct sprite pointer calculation |
| @variable in expression | `let addr: word = @myData;` | LOAD_ADDRESS → STORE_WORD |

### Optimizer Tests

| Test | Description | Priority |
|------|-------------|----------|
| LOAD_ADDRESS survives O0 | No optimization — LOAD_ADDRESS preserved | High |
| LOAD_ADDRESS survives O3 | Full optimization — LOAD_ADDRESS preserved | High |
| Dead global with @ ref | `@sprite const` referenced only via `@` is NOT eliminated | High |

## Verification Checklist

- [ ] All existing tests pass (`./compiler-test`)
- [ ] New IL generator tests pass
- [ ] New codegen tests pass
- [ ] Balloon-sprite ASM output has `#<label` / `#>label`
- [ ] ACME assembles without errors
- [ ] No regressions in optimizer behavior
