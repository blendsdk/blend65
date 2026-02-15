# Requirements: Assembly-Time Address Expressions

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Enable `@variable / constant` and `@variable >> constant` to emit assembly-time expressions instead of runtime code, when the variable has a known data label.

## Functional Requirements

### Must Have

- [ ] `@variable / N` where N is a literal constant emits `LDA #(label / N)`
- [ ] `@variable >> N` where N is a literal constant emits `LDA #(label >> N)`
- [ ] Works for any variable with a data label (`@data`, `@sprite`, `@charset`, etc.)
- [ ] Works for RAM/ZP variables with known numeric addresses (constant folding)
- [ ] Result type is `byte` (the expression produces a single byte loaded into A)
- [ ] Existing `@variable` (address-of without division) continues to work as before
- [ ] No new keywords, intrinsics, or syntax changes

### Should Have

- [ ] `@variable / N + offset` works (assembly-time base + runtime addition)
- [ ] Optimizer passes (CSE, dead-global-elim) recognize the new IL opcode

### Won't Have (Out of Scope)

- No new `spriteptr()` or similar intrinsics
- No alignment changes to `@sprite`
- No compile-time validation that N matches the variable's alignment
- No support for `@variable * N` (multiplication on address — not meaningful)

## Technical Requirements

### IL Level

- New IL opcode: `LOAD_ADDRESS_EXPR` carrying slot + operator + constant
- Result: byte in A register (not word A:X like LOAD_ADDRESS)
- Must be recognizable by optimizer passes

### Codegen Level

- Translate `LOAD_ADDRESS_EXPR` to `LDA` with Immediate mode
- Use `labelOperand` format: `(label / N)` or `(label >> N)`
- For numeric-address slots, constant-fold to `LDA #value`

### Emitter Level

- `formatOperand()` already handles `labelOperand` for Immediate → works as-is
- The label expression string includes the ACME operator: `(__data_label / 64)`

## Scope Decisions

| Decision | Options | Chosen | Rationale |
|----------|---------|--------|-----------|
| New opcode vs reuse | New opcode / Modify LOAD_ADDRESS | New opcode | Clean separation, byte result vs word |
| Supported operators | / only / / and >> / all | / and >> | Both useful for address calculations |
| Pattern detection | IL generator / Optimizer pass | IL generator | Simpler, catches pattern at source |

## Acceptance Criteria

1. [ ] `@balloonData / 64` compiles to `LDA #(__data_label / 64)`
2. [ ] `@balloonData >> 6` compiles to `LDA #(__data_label >> 6)`
3. [ ] Balloon sprite example shows correct sprite on C64/emulator
4. [ ] All existing tests pass (no regressions)
5. [ ] New tests cover division, shift, various alignments
6. [ ] Optimizer passes handle new opcode without crashes
