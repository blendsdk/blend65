# Copy Propagation

> **Document**: 07-copy-prop.md
> **Parent**: [Index](00-index.md)

## Overview

Copy Propagation tracks when one variable equals another (`y = x`) and replaces uses of the copy with the original.

## How It Works

```
// Source:
let x: byte = 5;
let y: byte = x;  // y is copy of x
return y;         // can use x instead

// IL Before:
LOAD_IMM 5
STORE_BYTE x
LOAD_BYTE x
STORE_BYTE y
LOAD_BYTE y    ← y equals x
RETURN

// IL After:
LOAD_IMM 5
STORE_BYTE x
LOAD_BYTE x
STORE_BYTE y
LOAD_BYTE x    ← Use original (may enable more opts)
RETURN
```

## Implementation

```typescript
// optimizer/passes/copy-prop.ts

export class CopyPropPass implements OptimizationPass {
  name = 'copy-prop';
  dependencies: string[] = ['constant-prop'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Track copies: target → source (y = x means copies['y'] = 'x')
    const copies = new Map<string, string>();
    const instructions = func.instructions;
    let modified = false;
    let replaced = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // LOAD_BYTE followed by STORE_BYTE: track as copy
      if (instr.opcode === ILOpcode.STORE_BYTE && i > 0) {
        const prev = instructions[i - 1];
        if (prev.opcode === ILOpcode.LOAD_BYTE) {
          const target = this.getSlotName(instr);
          const source = this.getSlotName(prev);
          if (target && source && target !== source) {
            copies.set(target, source);
          }
        } else {
          // Not a copy - invalidate
          const target = this.getSlotName(instr);
          if (target) copies.delete(target);
        }
      }

      // LOAD_BYTE: replace with source if copy exists
      if (instr.opcode === ILOpcode.LOAD_BYTE) {
        const slot = this.getSlotName(instr);
        if (slot && copies.has(slot)) {
          const source = copies.get(slot)!;
          // Find the slot operand for the source
          const sourceOp = this.createSlotOperand(source, instr.operands[0]);
          if (sourceOp) {
            instructions[i] = createInstruction(ILOpcode.LOAD_BYTE, [sourceOp]);
            modified = true;
            replaced++;
          }
        }
      }

      // Invalidation rules (same as constant-prop)
      if (this.invalidatesCopies(instr)) {
        const slot = this.getSlotName(instr);
        // Invalidate anything that copies THIS slot
        for (const [target, source] of copies) {
          if (source === slot) copies.delete(target);
        }
        if (slot) copies.delete(slot);
      }

      if (this.isControlFlow(instr)) {
        copies.clear();
      }
    }

    return { modified, instructionsRemoved: 0, instructionsAdded: replaced };
  }

  // Helper methods similar to constant-prop...
}
```

## Testing Requirements

| Test | Description |
|------|-------------|
| Simple copy | `y=x; use y` → `use x` |
| Copy chain | `y=x; z=y; use z` → `use x` |
| Modified source | `y=x; x=1; use y` → unchanged |
| Modified copy | `y=x; y=1; use y` → unchanged |
| Control flow | Label/jump clears copies |

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/passes/copy-prop.ts` | Implementation |
| `__tests__/optimizer/passes/copy-prop.test.ts` | Tests |