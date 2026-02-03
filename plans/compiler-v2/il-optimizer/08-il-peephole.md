# IL Peephole Optimization

> **Document**: 08-il-peephole.md
> **Parent**: [Index](00-index.md)

## Overview

IL Peephole applies local pattern-based optimizations on instruction sequences. This is the final IL optimization pass before code generation.

## Patterns

### Identity Elimination

| Pattern | Result | Reason |
|---------|--------|--------|
| `ADD_IMM 0` | (remove) | x + 0 = x |
| `SUB_IMM 0` | (remove) | x - 0 = x |
| `OR_IMM 0` | (remove) | x \| 0 = x |
| `AND_IMM $FF` | (remove) | x & 0xFF = x (byte) |
| `XOR_IMM 0` | (remove) | x ^ 0 = x |
| `SHL_BYTE 0` | (remove) | x << 0 = x |
| `SHR_BYTE 0` | (remove) | x >> 0 = x |
| `MUL_BYTE 1` | (remove) | x * 1 = x |
| `DIV_BYTE 1` | (remove) | x / 1 = x |

### Strength Reduction

| Pattern | Result | Reason |
|---------|--------|--------|
| `MUL_BYTE` x (power of 2) | `SHL_BYTE log2(x)` | Shift faster |
| `DIV_BYTE` x (power of 2) | `SHR_BYTE log2(x)` | Shift faster |
| `MUL_BYTE 0` | `LOAD_IMM 0` | x * 0 = 0 |

### Load-Store Elimination

| Pattern | Result | Reason |
|---------|--------|--------|
| `LOAD_BYTE x; STORE_BYTE x` | (remove both) | No-op |
| `LOAD_BYTE x; ...; LOAD_BYTE x` | (remove second) | If x unchanged |

## Implementation

```typescript
// optimizer/passes/il-peephole.ts

export class ILPeepholePass implements OptimizationPass {
  name = 'il-peephole';
  dependencies: string[] = ['copy-prop'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    let modified = false;
    let removed = 0;
    
    // Run multiple pattern passes
    const patterns = [
      this.identityElimination.bind(this),
      this.strengthReduction.bind(this),
      this.loadStoreElimination.bind(this),
    ];

    for (const pattern of patterns) {
      const result = pattern(func);
      if (result.modified) {
        modified = true;
        removed += result.removed;
      }
    }

    return { modified, instructionsRemoved: removed, instructionsAdded: 0 };
  }

  protected identityElimination(func: ILFunction): { modified: boolean; removed: number } {
    const toRemove: number[] = [];
    
    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      
      if (this.isIdentityOp(instr)) {
        toRemove.push(i);
      }
    }

    func.instructions = func.instructions.filter((_, i) => !toRemove.includes(i));
    return { modified: toRemove.length > 0, removed: toRemove.length };
  }

  protected isIdentityOp(instr: ILInstruction): boolean {
    const value = this.getImmediateValue(instr);
    if (value === null) return false;

    switch (instr.opcode) {
      case ILOpcode.ADD_IMM: return value === 0;
      case ILOpcode.SUB_IMM: return value === 0;
      case ILOpcode.OR_IMM: return value === 0;
      case ILOpcode.XOR_IMM: return value === 0;
      case ILOpcode.AND_IMM: return value === 0xFF;
      case ILOpcode.SHL_BYTE: return value === 0;
      case ILOpcode.SHR_BYTE: return value === 0;
      default: return false;
    }
  }

  protected strengthReduction(func: ILFunction): { modified: boolean; removed: number } {
    let modified = false;
    
    for (let i = 0; i < func.instructions.length; i++) {
      const instr = func.instructions[i];
      const replacement = this.tryStrengthReduce(instr);
      
      if (replacement) {
        func.instructions[i] = replacement;
        modified = true;
      }
    }

    return { modified, removed: 0 };
  }

  protected tryStrengthReduce(instr: ILInstruction): ILInstruction | null {
    // MUL by power of 2 → SHL
    if (instr.opcode === ILOpcode.MUL_BYTE) {
      const slot = instr.operands[0];
      // Check if multiplying by power of 2 (requires value tracking)
      // This is a simplified version
    }
    return null;
  }

  protected loadStoreElimination(func: ILFunction): { modified: boolean; removed: number } {
    const toRemove: number[] = [];
    
    for (let i = 0; i < func.instructions.length - 1; i++) {
      const instr = func.instructions[i];
      const next = func.instructions[i + 1];
      
      // LOAD x; STORE x → remove both
      if (instr.opcode === ILOpcode.LOAD_BYTE && 
          next.opcode === ILOpcode.STORE_BYTE) {
        const loadSlot = this.getSlotName(instr);
        const storeSlot = this.getSlotName(next);
        
        if (loadSlot && storeSlot && loadSlot === storeSlot) {
          toRemove.push(i, i + 1);
          i++; // Skip next
        }
      }
    }

    func.instructions = func.instructions.filter((_, i) => !toRemove.includes(i));
    return { modified: toRemove.length > 0, removed: toRemove.length };
  }
}
```

## Testing Requirements

| Test | Description |
|------|-------------|
| Identity ADD 0 | Remove `ADD_IMM 0` |
| Identity AND FF | Remove `AND_IMM 255` |
| Load-store same | Remove `LOAD x; STORE x` |
| No false remove | Don't remove `LOAD x; STORE y` |

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/passes/il-peephole.ts` | Implementation |
| `__tests__/optimizer/passes/il-peephole.test.ts` | Tests |