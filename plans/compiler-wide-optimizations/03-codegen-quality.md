# Codegen Quality: SHR_WORD Improvement (Theme CG)

> **Document**: 03-codegen-quality.md
> **Parent**: [Index](00-index.md)
> **Applies to**: ALL optimization levels (O0-Oz)

## Overview

The `genShrWord()` function in `bitwise.ts` emits a maximally pessimistic 16-bit shift-right sequence: 6 instructions per bit position (PHA/TXA/LSR/TAX/PLA/ROR). For a shift-by-6 (sprite pointer `/64`), this produces **36 instructions, ~70 bytes, ~120 cycles**.

This improvement applies at **ALL optimization levels** because it's code generation quality, not optimization — we're generating better code for the same IL operation.

## Current Implementation

**File**: `packages/compiler/src/codegen/generator/bitwise.ts`

For `SHR_WORD N`, current codegen emits N repetitions of:
```asm
PHA          ; save low byte to stack
TXA          ; high byte → A
LSR          ; shift high byte right (bit 0 → carry)
TAX          ; shifted high → X
PLA          ; restore low byte from stack
ROR          ; shift low byte right (carry → bit 7)
```

## Proposed Improvement

### Strategy by Shift Count

| Shift Count | Current (instructions) | Improved Strategy | Improved (instructions) |
|------------|----------------------|-------------------|------------------------|
| 1 | 6 | PHA/TXA/LSR/TAX/PLA/ROR (same) | 6 |
| 2 | 12 | Use ZP temp instead of stack | 10 |
| 3-7 | 18-42 | TXA then shift remainder from high byte | 3-9 |
| 8 | 48 | Just TXA (high→low, result in A) | 1 |
| 9-15 | 54-90 | TXA + shift A by (N-8) | 2-8 |

### Key Insight for Shift ≥ 8

When shifting a 16-bit value right by ≥8, all bits from the low byte are shifted out entirely. The result low byte comes from the high byte shifted right by (N-8). So `word >> 8` is just `TXA` and `word >> 10` is `TXA / LSR / LSR`.

### Key Insight for Shift 3-7

For shift by 6 specifically (the `/64` sprite pointer case):
```asm
; word >> 6 = (hi << 2) | (lo >> 6)
; But since result is 8-bit (sprite pointer), we only need low byte:
; result_lo = (hi_byte << 2) | (lo_byte >> 6)
TXA          ; high byte → A
ASL          ; shift left 1
ASL          ; shift left 2 — now has bits [5:0] of hi in [7:2]
STA __temp   ; save
; original low byte (was pushed or in temp)
; LSR×6 to get bits [7:6] into [1:0]
; ORA __temp to combine
```

However, this is complex and the **simpler improvement** for general shifts is:

### Recommended Implementation (Pragmatic)

**Phase 1** — Shift count ≥ 8 optimization:
```typescript
if (count >= 8) {
  // High byte becomes low byte
  this.emit('TXA');       // high → A
  this.emit('LDX', '#$00'); // clear high byte
  // Shift remaining (count - 8) positions on byte A
  for (let i = 0; i < count - 8; i++) {
    this.emit('LSR');
  }
} else {
  // Existing N× (PHA/TXA/LSR/TAX/PLA/ROR) for now
  // Phase 2 can optimize counts 2-7
}
```

**Phase 2** (should-have) — Use ZP temp instead of stack for counts 2-7:
```asm
; Store low byte to ZP temp instead of PHA/PLA per shift
STA $FE       ; save low byte once
TXA / LSR / TAX / LDA $FE / ROR / STA $FE  ; per shift (5 instr vs 6)
LDA $FE       ; restore at end
```

## Testing

- All existing SHR_WORD tests must pass unchanged
- Verify shift-by-6 produces correct sprite pointer values
- Verify shift-by-8 produces correct results (edge case: high byte only)
- Verify shift-by-0 is a no-op (identity)
- Test at ALL 6 optimization levels

## Files to Modify

| File | Change |
|------|--------|
| `packages/compiler/src/codegen/generator/bitwise.ts` | Improve `genShrWord()` with count-dependent strategies |
