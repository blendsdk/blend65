# Requirements: Address-Of Operator Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The `@` address-of operator must correctly generate the `LOAD_ADDRESS` IL opcode so that the 16-bit memory address of a variable (not its value) is loaded into the A:X register pair. Currently, the balloon-sprite example produces garbled output because the address is never loaded — only a byte value is loaded from the data address.

## Functional Requirements

### Must Have

- [ ] `@variable` in an expression context generates `LOAD_ADDRESS` IL opcode
- [ ] `LOAD_ADDRESS` survives all optimizer passes without corruption
- [ ] Codegen produces `LDA #<label` / `LDX #>label` for @data/@sprite variables
- [ ] Codegen produces `LDA #lo(addr)` / `LDX #hi(addr)` for RAM/ZP variables
- [ ] `hi(@variable)` extracts the high byte correctly via TXA
- [ ] `lo(@variable)` extracts the low byte correctly (already in A)
- [ ] Balloon-sprite example works in C64 emulator (correct sprite displayed)

### Should Have

- [ ] Unit tests for `@` operator in IL generation
- [ ] Unit tests for `LOAD_ADDRESS` in codegen
- [ ] Optimizer passes explicitly handle `LOAD_ADDRESS` (not just passthrough)

### Won't Have (Out of Scope)

- Parser changes (confirmed correct)
- Lexer changes (confirmed correct)
- New language features
- `!align` directive changes (confirmed correct)

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Optimizer handling | Passthrough unknown / Explicit handling | Explicit | Prevents future optimizer bugs; LOAD_ADDRESS modifies A:X like LOAD_IMM_WORD |
| Debug approach | Manual ASM inspection / IL dump script | IL dump script | Precise root cause identification before fixing |

## Acceptance Criteria

1. [ ] `@variable` generates `LOAD_ADDRESS` in IL dump
2. [ ] Generated ASM uses `#<label` / `#>label` immediate addressing
3. [ ] All 8901+ existing tests pass
4. [ ] Balloon-sprite ASM output verified correct
5. [ ] New tests for address-of operator pass
