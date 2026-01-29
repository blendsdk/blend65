# CodeGen Missing Operations: MUL, SHR, PHI, Arrays

> **Document**: 05-codegen-missing-ops.md
> **Parent**: [Index](00-index.md)

## Overview

Implement the missing operations that currently emit `NOP` placeholders:
- PHI node lowering (SSA form → explicit moves)
- MUL (software multiplication)
- SHL/SHR (shift operations)
- LOAD_ARRAY/STORE_ARRAY (indexed memory access)

## PHI Node Lowering

### The Problem

PHI nodes in SSA form select values based on control flow:

```
; v8 = PHI [(v4, block0), (v7, block1)]
; This means: if we came from block0, v8 = v4; if from block1, v8 = v7
```

Currently emits `NOP`, but should generate moves at end of predecessor blocks.

### Solution

**Strategy: Insert moves at end of predecessor blocks**

```typescript
protected generatePhiNode(instr: ILPhiInstruction): void {
  // PHI lowering happens during predecessor block processing
  // At merge point, the variable should already have the right value
  
  // For now, emit comment explaining what should happen
  this.emitComment(`PHI: ${instr.result} merges from predecessors`);
  
  // The actual work happens in generateBasicBlock:
  // 1. At end of each predecessor, store to the merged variable
  // 2. Here at the merge point, load from that variable
}

protected generateBasicBlock(func: ILFunction, block: BasicBlock): void {
  // ... generate instructions ...
  
  // Before terminal instruction, handle PHI moves for successors
  this.handlePhiMovesForSuccessors(block);
}

protected handlePhiMovesForSuccessors(block: BasicBlock): void {
  const terminal = block.getTerminator();
  if (!terminal) return;
  
  for (const successor of this.getSuccessorBlocks(terminal)) {
    for (const phi of successor.getPhiNodes()) {
      // Find the value this block contributes to the PHI
      const contribution = phi.getValueFromPredecessor(block);
      if (contribution) {
        // Store to the PHI's merged variable
        const mergeAddr = this.allocatePhiMergeVariable(phi.result);
        this.loadValueToA(contribution.toString());
        this.emitStaZeroPage(mergeAddr, `PHI: ${phi.result} from ${block.label}`);
      }
    }
  }
}
```

## MUL (Multiplication)

### 8-bit × 8-bit Multiplication

Uses shift-and-add algorithm:

```typescript
protected generateMul(instr: ILBinaryInstruction): void {
  // 8-bit multiply: result = left * right
  // Uses shift-add algorithm
  
  this.emitComment(`${instr.result} = ${instr.left} * ${instr.right}`);
  
  // For constant multiplier, use optimized shifts
  const rightLoc = this.getValueLocation(instr.right.toString());
  if (rightLoc?.location === ValueLocation.IMMEDIATE && this.isPowerOfTwo(rightLoc.value!)) {
    this.generateMulByPowerOfTwo(instr, rightLoc.value!);
    return;
  }
  
  // General case: call multiply subroutine
  // Left operand in A, right operand in X
  this.loadValueToA(instr.left.toString());
  this.loadValueToX(instr.right.toString());
  this.emitJsr('_mul8', 'Call 8-bit multiply');
  // Result in A (low byte), X (high byte if word result)
  
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}

// Generate multiply subroutine (once per module)
protected generateMulSubroutine(): void {
  this.emitLabel('_mul8');
  // A = multiplicand, X = multiplier
  // Result: A = low byte, X = high byte (if 16-bit needed)
  this.asmBuilder.raw(`
        STA _mul_a
        STX _mul_b
        LDA #$00
        STA _mul_result
        LDA _mul_b
.mul_loop:
        BEQ .mul_done
        LSR A
        BCC .mul_skip
        PHA
        LDA _mul_result
        CLC
        ADC _mul_a
        STA _mul_result
        PLA
.mul_skip:
        PHA
        LDA _mul_a
        ASL A
        STA _mul_a
        PLA
        JMP .mul_loop
.mul_done:
        LDA _mul_result
        RTS
  `);
}
```

### Power-of-Two Optimization

```typescript
protected generateMulByPowerOfTwo(instr: ILBinaryInstruction, multiplier: number): void {
  this.loadValueToA(instr.left.toString());
  const shifts = Math.log2(multiplier);
  for (let i = 0; i < shifts; i++) {
    this.emitInstruction('ASL', 'A', `Multiply by 2`, 1);
  }
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}
```

## SHL/SHR (Shift Operations)

```typescript
protected generateShl(instr: ILBinaryInstruction): void {
  this.loadValueToA(instr.left.toString());
  
  const rightLoc = this.getValueLocation(instr.right.toString());
  if (rightLoc?.location === ValueLocation.IMMEDIATE) {
    // Constant shift count - unroll
    for (let i = 0; i < rightLoc.value!; i++) {
      this.emitInstruction('ASL', 'A', 'Shift left', 1);
    }
  } else {
    // Variable shift - use loop or table
    this.emitComment('TODO: Variable shift count');
    // For now, call subroutine
    this.loadValueToX(instr.right.toString());
    this.emitJsr('_shl8', 'Shift left by X');
  }
  
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}

protected generateShr(instr: ILBinaryInstruction): void {
  this.loadValueToA(instr.left.toString());
  
  const rightLoc = this.getValueLocation(instr.right.toString());
  if (rightLoc?.location === ValueLocation.IMMEDIATE) {
    for (let i = 0; i < rightLoc.value!; i++) {
      this.emitInstruction('LSR', 'A', 'Shift right', 1);
    }
  } else {
    this.loadValueToX(instr.right.toString());
    this.emitJsr('_shr8', 'Shift right by X');
  }
  
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}
```

## LOAD_ARRAY / STORE_ARRAY

```typescript
protected generateLoadArray(instr: ILLoadArrayInstruction): void {
  // array[index] - indexed read
  const arrayLabel = this.resolveArrayLabel(instr.array);
  
  // Load index to Y
  this.loadValueToY(instr.index.toString());
  
  // LDA array,Y
  this.emitInstruction('LDA', `${arrayLabel},Y`, `Load ${instr.array}[${instr.index}]`, 3);
  
  this.trackValue(instr.result.toString(), { location: ValueLocation.ACCUMULATOR });
}

protected generateStoreArray(instr: ILStoreArrayInstruction): void {
  // array[index] = value - indexed write
  const arrayLabel = this.resolveArrayLabel(instr.array);
  
  // Load value to A
  this.loadValueToA(instr.value.toString());
  
  // Load index to Y (need to preserve A)
  this.emitInstruction('PHA', undefined, 'Save value', 1);
  this.loadValueToY(instr.index.toString());
  this.emitInstruction('PLA', undefined, 'Restore value', 1);
  
  // STA array,Y
  this.emitInstruction('STA', `${arrayLabel},Y`, `Store to ${instr.array}[${instr.index}]`, 3);
}

protected loadValueToY(ilValue: string): void {
  const loc = this.getValueLocation(ilValue);
  if (!loc) {
    this.emitInstruction('LDY', '#$00', `STUB: ${ilValue}`, 2);
    return;
  }
  
  switch (loc.location) {
    case ValueLocation.IMMEDIATE:
      this.emitInstruction('LDY', `#${this.formatHex(loc.value!)}`, `Load ${ilValue}`, 2);
      break;
    case ValueLocation.ZERO_PAGE:
      this.emitInstruction('LDY', this.formatZeroPage(loc.address!), `Load ${ilValue}`, 2);
      break;
    case ValueLocation.ACCUMULATOR:
      this.emitInstruction('TAY', undefined, `Transfer to Y`, 1);
      break;
  }
}
```

## Testing Requirements

| Operation | Tests Needed |
|-----------|--------------|
| PHI | Merge after if/else, loop header merge |
| MUL | 2×3, 0×5, power-of-2 optimization |
| SHL | Constant shift, variable shift |
| SHR | Constant shift, variable shift |
| LOAD_ARRAY | Constant index, variable index |
| STORE_ARRAY | Constant index, variable index |

## Files to Modify

| File | Changes |
|------|---------|
| `codegen/instruction-generator.ts` | Add all operation handlers |
| `codegen/base-generator.ts` | Add Y register handling, runtime subroutines |