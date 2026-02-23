# Store-Reload & JMP-to-Next Fix: Bugs #2 and #3

> **Document**: 04-store-reload-jmp-fix.md
> **Parent**: [Index](00-index.md)
> **Bugs**: #2 (REDUN), #3 (REDUN)

## Overview

Bug #2 is a redundant store/reload pattern that wastes 4 bytes + 6 cycles per occurrence. Bug #3 is a JMP-to-next-instruction after function inlining that wastes 3 bytes + 3 cycles. Both are code quality issues (High severity).

## Bug #2: Redundant Store/Reload

### The Pattern

```asm
; param spriteAddr (word)
  STA $07        ; store A → $07
  STX $08        ; store X → $08
; load spriteAddr (word)
  LDA $07        ; REDUNDANT: A already has this value
  LDX $08        ; REDUNDANT: X already has this value
```

### Why StoreLoadPass Should Catch This

The existing `StoreLoadPass` in `packages/compiler/src/codegen/asm-il/optimizer/passes/store-load.ts` explicitly handles this pattern. For `LDA $07`:
1. Scan backward: `STX $08` — doesn't modify A, doesn't write to `$07`, not control flow → continue
2. `STA $07` — matching store (same register A, same address `$07`) → **redundant!**

Similarly for `LDX $08`:
1. Scan backward: finds `STX $08` — matching store → **redundant!**

### Investigation Plan

Since the pass SHOULD work, the investigation must determine why it doesn't:

1. **Check if a label exists between store and load** — Labels break backward scanning. The codegen might emit a label (e.g., function entry label) between the store and load instructions.

2. **Check operand format at ASM-IL level** — The `sameOperand()` method requires matching `mode`, `operand`, and `labelOperand`. If the store uses a label operand (e.g., `STA __param_spriteAddr_lo`) while the load uses a numeric operand (e.g., `LDA $07`), they won't match.

3. **Check if JSR breaks the scan** — For the non-inlined case (O0, O1, Os, Oz), the store/reload is inside `getSpriteFrame` function body. No JSR between them. For the inlined case (O2, O3), the pattern is in `main`. No JSR between them either.

4. **Check section boundaries** — If the function code spans multiple ASM-IL sections, the pass processes sections independently and can't see across boundaries.

5. **Debug with a script** — Create a debug script that compiles, runs the ASM-IL optimizer, and dumps the instructions before and after the StoreLoadPass to see exactly what it processes.

### Fix Strategy

Based on investigation findings:
- **If label issue:** Adjust codegen to not emit labels between param store and param load
- **If operand format mismatch:** Normalize operand representation in the pass
- **If section boundary:** Ensure function code is in a single section
- **If deeper issue:** Add a codegen-level fix to skip emitting redundant param loads when the value is already in the register

## Bug #3: JMP-to-Next-Instruction

### The Pattern

```asm
._inline_delay_0_endfor1
; [inlined return → jump to continuation]
  JMP ._inline_delay_0_cont       ; 3 bytes, 3 cycles — WASTED
._inline_delay_0_cont
; load frame
  LDA $06
```

### Current Behavior

In `function-inlining.ts`, `replaceReturnsWithJump()` replaces ALL `RETURN` opcodes with `JUMP` to the continuation label, unconditionally:

```typescript
protected replaceReturnsWithJump(
  instructions: ILInstruction[],
  contLabel: string
): ILInstruction[] {
  return instructions.map((instr) => {
    if (instr.opcode === ILOpcode.RETURN) {
      return {
        opcode: ILOpcode.JUMP,
        operands: [{ kind: 'label' as const, name: contLabel }],
        // ...
      };
    }
    return instr;
  });
}
```

### Why It Only Manifests at O1

- **O1:** Runs `dce` + `constant-fold` — neither removes JMP-to-next
- **O2+:** Runs `il-peephole` which catches and removes JMP-to-next-label patterns

### Fix Strategy (Option A — Preferred)

**Optimize the inliner** to detect when the last instruction before the continuation label is a JUMP to that label, and remove it:

```typescript
protected inlineFunction(_program: ILProgram, candidate: InlineCandidate): boolean {
  // ... existing code ...
  
  // Replace RETURN instructions with JUMP to continuation label
  const processedBody = this.replaceReturnsWithJump(clonedBody, contLabel);
  
  // FIX: If the last instruction is JUMP to contLabel, remove it
  // (it would be a JMP-to-next-instruction — the continuation label follows immediately)
  if (processedBody.length > 0) {
    const lastInstr = processedBody[processedBody.length - 1];
    if (
      lastInstr.opcode === ILOpcode.JUMP &&
      lastInstr.operands.length > 0 &&
      (lastInstr.operands[0] as LabelOperand).name === contLabel
    ) {
      processedBody.pop(); // Remove the redundant JUMP
    }
  }
  
  // Build replacement: [body] + [continuation label]
  const replacement = [...processedBody, contLabelInstr];
  // ...
}
```

This fix is minimal, safe, and applies at all optimization levels. Functions with multiple RETURN points will still emit JUMPs for non-final returns (which are correct — they need to skip remaining code).

## Testing Requirements

### Bug #2
- Debug script to investigate why StoreLoadPass misses the pattern
- Unit test for StoreLoadPass with the exact pattern (STA/STX/LDA/LDX)
- E2E test: compile `spinning-line` and verify no STA/LDA same-address pattern in output

### Bug #3
- Unit test for inliner: verify no JMP-to-next after inlining a function with single RETURN
- Unit test for inliner: verify JMP still emitted for multi-RETURN functions (non-final returns)
- E2E test: compile at O1 and verify no JMP targeting immediately following label
