# ASM Optimizer Improvements (Theme H)

> **Document**: 05-asm-optimizer.md
> **Parent**: [Index](00-index.md)
> **Applies to**: O1+ optimization levels

## Overview

The primary ASM-level improvement is investigating and fixing `RegisterPromotePass` so that for-loop memory counters (INC+CMP+JMP) are promoted to register-counted loops (DEX/DEY+BNE). This affects **every for-loop in every Blend program**.

## Theme H: For-Loop Register Promotion

### Current Emitted Pattern (All For-Loops)

```asm
; for (let i: byte = 0 to 255)
  LDA #$00
  STA $05         ; counter in zero-page
.for_start:
  LDA $05         ; load counter
  CMP #$FF        ; compare with end
  BCS .for_end    ; exit if >= end
  ; ... loop body ...
  INC $05         ; increment counter
  JMP .for_start  ; loop back
.for_end:
```

**Cost**: ~13 bytes, ~14 cycles per iteration (LDA+CMP+BCS+INC+JMP overhead)

### Ideal Emitted Pattern

```asm
  LDX #$FF        ; count (or LDY)
.loop:
  ; ... loop body (adapted for X/Y counter) ...
  DEX             ; decrement
  BNE .loop       ; loop if not zero
```

**Cost**: ~3 bytes, ~5 cycles per iteration (DEX+BNE overhead)

### Investigation Tasks

**File**: `packages/compiler/src/codegen/asm-il/optimizer/passes/register-promote.ts`

1. **Read the existing pass** — understand what patterns it looks for
2. **Check if barrier() blocks it** — barrier() in the loop body may make the pass think the loop has side effects
3. **Check count direction** — the pass may expect count-down loops but our for-loops are count-up
4. **Check INC vs DEX** — the pass may look for specific instructions (DEX/DEY) that our loops don't produce
5. **Check if JSR in body blocks it** — the `hasJSR()` method may conservatively refuse to promote

### Possible Fixes

1. **If barrier() blocks it**: Teach the pass that BARRIER comments are not real side effects
2. **If count-up blocks it**: Add count-up to count-down transformation
3. **If INC pattern not recognized**: Extend `findIncDecInstructions()` to match INC+CMP patterns
4. **If too conservative**: Relax conditions while maintaining correctness

### Secondary ASM Patterns

While investigating RegisterPromotePass, also check:

- **Dead label elimination**: After all ASM optimizations, labels with no references should be removed
- **JMP-to-next**: BranchOptPass should catch `JMP .label` followed by `.label:` — verify it works after inlining

## Files to Modify

| File | Changes |
|------|---------|
| `packages/compiler/src/codegen/asm-il/optimizer/passes/register-promote.ts` | Fix/extend to handle Blend for-loop patterns |
| `packages/compiler/src/codegen/asm-il/optimizer/passes/branch-opt.ts` | Verify dead label and JMP-to-next handling |
