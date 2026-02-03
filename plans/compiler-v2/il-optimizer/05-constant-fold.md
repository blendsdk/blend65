# Constant Folding

> **Document**: 05-constant-fold.md
> **Parent**: [Index](00-index.md)

## Overview

Constant Folding evaluates arithmetic operations on compile-time known values, replacing `LOAD_IMM a; OP_IMM b` sequences with `LOAD_IMM result`.

## What It Folds

| Pattern | Result |
|---------|--------|
| `LOAD_IMM a; ADD_IMM b` | `LOAD_IMM (a+b) & 0xFF` |
| `LOAD_IMM a; SUB_IMM b` | `LOAD_IMM (a-b) & 0xFF` |
| `LOAD_IMM a; AND_IMM b` | `LOAD_IMM (a&b)` |
| `LOAD_IMM a; OR_IMM b` | `LOAD_IMM (a\|b)` |
| `LOAD_IMM a; XOR_IMM b` | `LOAD_IMM (a^b)` |
| `LOAD_IMM a; SHL_BYTE n` | `LOAD_IMM (a<<n) & 0xFF` |
| `LOAD_IMM a; SHR_BYTE n` | `LOAD_IMM (a>>n)` |

## Implementation

```typescript
// optimizer/passes/constant-fold.ts

export class ConstantFoldPass implements OptimizationPass {
  name = 'constant-fold';
  dependencies: string[] = ['dce'];

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    const instructions = func.instructions;
    const result: ILInstruction[] = [];
    let modified = false;
    let removed = 0;

    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      
      // Check for LOAD_IMM followed by arithmetic IMM
      if (instr.opcode === ILOpcode.LOAD_IMM && i + 1 < instructions.length) {
        const next = instructions[i + 1];
        const folded = this.tryFold(instr, next);
        
        if (folded) {
          result.push(folded);
          i++; // Skip next instruction
          modified = true;
          removed++;
          continue;
        }
      }
      
      result.push(instr);
    }

    func.instructions = result;
    return { modified, instructionsRemoved: removed, instructionsAdded: 0 };
  }

  protected tryFold(load: ILInstruction, op: ILInstruction): ILInstruction | null {
    const a = this.getImmediateValue(load);
    const b = this.getImmediateValue(op);
    if (a === null || b === null) return null;

    let value: number | null = null;

    switch (op.opcode) {
      case ILOpcode.ADD_IMM: value = (a + b) & 0xFF; break;
      case ILOpcode.SUB_IMM: value = (a - b) & 0xFF; break;
      case ILOpcode.AND_IMM: value = a & b; break;
      case ILOpcode.OR_IMM:  value = a | b; break;
      case ILOpcode.XOR_IMM: value = a ^ b; break;
      case ILOpcode.SHL_BYTE: value = (a << b) & 0xFF; break;
      case ILOpcode.SHR_BYTE: value = a >> b; break;
      default: return null;
    }

    return createInstruction(ILOpcode.LOAD_IMM, [createImmediateOperand(value)]);
  }

  protected getImmediateValue(instr: ILInstruction): number | null {
    if (instr.operands.length === 0) return null;
    const op = instr.operands[0];
    return isImmediateOperand(op) ? op.value : null;
  }
}
```

## Examples

```
// Before: let x = 5 + 3
LOAD_IMM 5
ADD_IMM 3

// After:
LOAD_IMM 8
```

```
// Before: let mask = 0xFF & 0x0F
LOAD_IMM 255
AND_IMM 15

// After:
LOAD_IMM 15
```

## Testing Requirements

| Test | Description |
|------|-------------|
| Fold ADD | `5 + 3` → `8` |
| Fold SUB | `10 - 3` → `7` |
| Fold AND | `255 & 15` → `15` |
| Fold OR | `240 \| 15` → `255` |
| Fold XOR | `255 ^ 255` → `0` |
| Fold SHL | `1 << 4` → `16` |
| Fold SHR | `128 >> 2` → `32` |
| Overflow wrap | `250 + 10` → `4` |
| No fold non-IMM | `LOAD_BYTE x; ADD_IMM 1` unchanged |

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/passes/constant-fold.ts` | Implementation |
| `__tests__/optimizer/passes/constant-fold.test.ts` | Tests |