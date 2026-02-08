# Constant Propagation

> **Document**: 06-constant-prop.md
> **Parent**: [Index](00-index.md)

## Overview

Constant Propagation tracks known constant values through variables and replaces loads with immediate values when the constant is known.

## How It Works

```
// Source:
let x: byte = 5;
let y: byte = x + 1;

// IL Before:
LOAD_IMM 5
STORE_BYTE x
LOAD_BYTE x    ← x is known to be 5
ADD_IMM 1

// IL After:
LOAD_IMM 5
STORE_BYTE x
LOAD_IMM 5     ← Replaced with constant
ADD_IMM 1
```

## Implementation

```typescript
// optimizer/passes/constant-prop.ts

export class ConstantPropPass implements OptimizationPass {
  name = 'constant-prop';
  dependencies: string[] = ['dce', 'constant-fold'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Track known constants: slot name → value
    const constants = new Map<string, number>();
    const instructions = func.instructions;
    let modified = false;
    let replaced = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];

      // LOAD_IMM followed by STORE: remember the constant
      if (instr.opcode === ILOpcode.STORE_BYTE && i > 0) {
        const prev = instructions[i - 1];
        if (prev.opcode === ILOpcode.LOAD_IMM) {
          const slot = this.getSlotName(instr);
          const value = this.getImmediateValue(prev);
          if (slot && value !== null) {
            constants.set(slot, value);
          }
        }
      }
      
      // LOAD_BYTE: replace with LOAD_IMM if constant known
      if (instr.opcode === ILOpcode.LOAD_BYTE) {
        const slot = this.getSlotName(instr);
        if (slot && constants.has(slot)) {
          const value = constants.get(slot)!;
          instructions[i] = createInstruction(
            ILOpcode.LOAD_IMM, 
            [createImmediateOperand(value)]
          );
          modified = true;
          replaced++;
        }
      }

      // Operations that invalidate constants
      if (this.invalidatesConstants(instr)) {
        const slot = this.getSlotName(instr);
        if (slot) constants.delete(slot);
      }

      // Control flow invalidates all
      if (this.isControlFlow(instr)) {
        constants.clear();
      }
    }

    return { modified, instructionsRemoved: 0, instructionsAdded: replaced };
  }

  protected getSlotName(instr: ILInstruction): string | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isSlotOperand(op) ? op.slot.name : null;
  }

  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }

  protected invalidatesConstants(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.STORE_BYTE || 
           instr.opcode === ILOpcode.STORE_WORD ||
           instr.opcode === ILOpcode.INC_BYTE ||
           instr.opcode === ILOpcode.DEC_BYTE;
  }

  protected isControlFlow(instr: ILInstruction): boolean {
    return instr.opcode === ILOpcode.LABEL ||
           instr.opcode.startsWith('JUMP') ||
           instr.opcode === ILOpcode.CALL;
  }
}
```

## Testing Requirements

| Test | Description |
|------|-------------|
| Simple propagation | `x=5; use x` → `use 5` |
| Overwritten constant | `x=5; x=10; use x` → `use 10` |
| Not constant after label | Label clears known values |
| Not constant after branch | Jump clears known values |
| Not constant after call | Call clears known values |
| Multiple variables | Track several constants |

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/passes/constant-prop.ts` | Implementation |
| `__tests__/optimizer/passes/constant-prop.test.ts` | Tests |