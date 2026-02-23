# Core Codegen Fixes: C1 (Multi-Arg) + C2 (Const Condition)

> **Document**: 03-core-codegen.md
> **Parent**: [Index](00-index.md)
> **Priority**: P0 — These bugs affect ALL optimization levels

## Overview

Two bugs in the IL generator produce wrong code at every optimization level.
They must be fixed first because they affect the baseline O0 output.

## Bug C1: Multi-Argument Function Call Passing

### Current Behavior

`generateCallArguments()` in `expressions.ts` only generates IL for `args[0]`.
The first argument lands in A (byte) or A:X (word), but subsequent arguments
are completely ignored — no IL is emitted to store them to their parameter slots.

### Proposed Fix

**Strategy**: Generate each argument and store it to the corresponding parameter's
frame slot before the CALL. The callee's frame is already available via
`this.frameMap.get(funcName)`.

**6502 Calling Convention (updated)**:
1. For `args[0]`: Generate into A (or A:X for word). This stays in registers —
   the callee prologue stores it.
2. For `args[1..N]`: Generate into A, then emit `STORE_BYTE` to the callee's
   parameter slot. The callee reads from this slot directly (no prologue needed).

**Implementation in `generateCallArguments()`**:

```typescript
protected generateCallArguments(funcName: string, args: Expression[]): void {
  if (args.length === 0) return;

  const targetFrame = this.frameMap.get(funcName);
  // Collect parameter slots in order
  const paramSlots = targetFrame
    ? targetFrame.slots.filter(s => s.kind === SlotKind.Parameter)
    : [];

  // Generate arguments beyond the first BEFORE the first argument.
  // Why reverse order? Because args[1..N] must be stored to param slots
  // before args[0] is generated into A (which the CALL will use).
  for (let i = 1; i < args.length; i++) {
    if (i < paramSlots.length) {
      this.generateExpression(args[i]);
      if (paramSlots[i].size === 2) {
        this.builder.storeSlotWord(paramSlots[i], `arg${i} → ${paramSlots[i].name}`);
      } else {
        this.builder.storeSlot(paramSlots[i], `arg${i} → ${paramSlots[i].name}`);
      }
    }
  }

  // Generate args[0] last — result stays in A (or A:X) for the CALL
  this.generateExpression(args[0]);

  // Existing promotion logic for first param (byte→word if needed)
  // ... (keep existing code unchanged)
}
```

**Key Insight**: Generate `args[1..N]` BEFORE `args[0]` because `args[0]` must
be in A at the moment of the CALL (JSR). If we generated `args[0]` first and
then generated `args[1]`, the second generation would clobber A.

### Expected ASM After Fix (O0)

```asm
; getSpriteFrame(@lineFrames, frame)
; arg1: frame → frameIndex slot
  LDA $06              ; load frame variable
  STA $02              ; store to frameIndex parameter slot
; arg0: @lineFrames → A:X
  LDA #<__data_SpinningLine_lineFrames
  LDX #>__data_SpinningLine_lineFrames
  JSR getSpriteFrame
```

### Testing

- Unit test: 2-arg function call generates STORE for second arg
- Unit test: 3-arg function call generates STORE for args 2 and 3
- Integration test: compile spinning-line at O0, verify `STA $02` before JSR

---

## Bug C2: Constant Identifier Not Resolved in if-Conditions

### Current Behavior

In `generateConditionWithBranch()` (`control-flow.ts`), the right operand
of a comparison is handled:
1. Literal → `cmpImm(value)` ✅
2. Identifier → `tryResolveVariable()` → `cmpSlot(slot)` ❌ (gives `CMP $FFFF` for constants)
3. Complex → fallback ✅

### Proposed Fix

Add a constant identifier check in the identifier branch, **before** the
slot comparison. This mirrors the pattern already used in `generateBinary()`.

```typescript
} else if (isIdentifierExpression(right)) {
  const identRight = right as IdentifierExpression;

  // NEW: Check for constant identifier first (e.g., NUM_FRAMES = 4)
  const constValue = this.tryResolveConstantIdentifier(right);
  if (constValue !== undefined) {
    this.builder.cmpImm(constValue, 'compare with const');
  } else {
    // Existing: mutable variable → slot comparison
    const slot = this.tryResolveVariable(identRight.getName());
    if (slot) {
      this.builder.cmpSlot(slot, 'compare');
    } else {
      // fallback...
    }
  }
}
```

### Expected ASM After Fix (O0)

```asm
; if (frame == NUM_FRAMES)
  CMP #$04             ; ← Correct! Immediate comparison with const value 4
  BNE .else7           ; skip if not equal
```

### Testing

- Unit test: `if (x == CONST)` generates `CMP #value` not `CMP $addr`
- Unit test: `if (x < CONST)` generates `CMP #value` with correct branch
- Integration test: compile spinning-line at O0, verify `CMP #$04`
