# Optimization Hints: Beyond God-Level IL Generator

> **Document**: 05-optimization-hints.md
> **Parent**: [Index](00-index.md)

---

## Overview

This document describes the **optimization hints** that make our IL "beyond god-level":
1. **Live Range Annotations** - Track variable liveness for dead store elimination
2. **Cost Model** - Cycle/byte estimates for optimization decisions
3. **Def-Use Chains** - Know what each instruction reads/writes

---

## Live Range Analysis

### What Are Live Ranges?

A variable is **live** at a program point if its value may be used in the future.

```js
function example(): byte {
  let a: byte = 10;    // a is LIVE here (used on line 3)
  let b: byte = 20;    // a and b are LIVE
  return a + b;        // a and b used, then DEAD
}
```

### Why It Matters for 6502

Dead store elimination is crucial for 6502:
- Registers are scarce (A, X, Y only)
- Memory writes are expensive (4+ cycles)
- Removing unnecessary stores = faster code

### Live Range Data Structure

```typescript
/**
 * Live range annotations on each instruction.
 */
interface ILInstruction {
  // ... other fields ...
  
  /** Variables live at entry to this instruction */
  liveIn?: Set<string>;
  
  /** Variables live at exit from this instruction */
  liveOut?: Set<string>;
}
```

### Computing Live Ranges (Backward Dataflow)

```typescript
/**
 * Compute live ranges for all instructions in a function.
 * Uses backward dataflow analysis.
 */
function computeLiveRanges(func: ILFunction): void {
  const instructions = func.instructions;
  
  // Initialize all liveIn/liveOut to empty sets
  for (const instr of instructions) {
    instr.liveIn = new Set();
    instr.liveOut = new Set();
  }
  
  // Iterate until fixed point
  let changed = true;
  while (changed) {
    changed = false;
    
    // Backward iteration
    for (let i = instructions.length - 1; i >= 0; i--) {
      const instr = instructions[i];
      const oldLiveIn = new Set(instr.liveIn);
      
      // liveOut = union of liveIn of all successors
      instr.liveOut = computeSuccessorLiveIn(instructions, i);
      
      // liveIn = (liveOut - defs) ∪ uses
      instr.liveIn = new Set(instr.liveOut);
      
      // Remove defined variables
      for (const def of getDefs(instr)) {
        instr.liveIn.delete(def);
      }
      
      // Add used variables
      for (const use of getUses(instr)) {
        instr.liveIn.add(use);
      }
      
      // Check if changed
      if (!setsEqual(oldLiveIn, instr.liveIn)) {
        changed = true;
      }
    }
  }
}
```

### Using Live Ranges

```typescript
/**
 * Check if a store instruction is dead (value never used).
 */
function isDeadStore(instr: ILInstruction): boolean {
  if (instr.opcode !== ILOpcode.STORE_BYTE && 
      instr.opcode !== ILOpcode.STORE_WORD) {
    return false;
  }
  
  // Get the variable being stored to
  const operand = instr.operands[0];
  if (!isSlotOperand(operand)) {
    return false;
  }
  
  const varName = operand.slot.name;
  
  // If variable is not live after this store, it's dead!
  return !instr.liveOut?.has(varName);
}
```

---

## Def-Use Chains

### What Are Def-Use Chains?

Track which variables are **defined** (written) and **used** (read) by each instruction.

```typescript
interface DefUse {
  /** Variables defined (written) by this instruction */
  defs: string[];
  
  /** Variables used (read) by this instruction */
  uses: string[];
}
```

### Computing Def-Use

```typescript
/**
 * Compute defs and uses for an instruction.
 */
function computeDefUse(instr: ILInstruction): DefUse {
  const defs: string[] = [];
  const uses: string[] = [];
  
  switch (instr.opcode) {
    case ILOpcode.LOAD_BYTE:
    case ILOpcode.LOAD_WORD:
      // Reads from slot
      if (isSlotOperand(instr.operands[0])) {
        uses.push(instr.operands[0].slot.name);
      }
      break;
      
    case ILOpcode.STORE_BYTE:
    case ILOpcode.STORE_WORD:
      // Writes to slot
      if (isSlotOperand(instr.operands[0])) {
        defs.push(instr.operands[0].slot.name);
      }
      break;
      
    case ILOpcode.ADD_BYTE:
    case ILOpcode.SUB_BYTE:
    case ILOpcode.AND_BYTE:
    case ILOpcode.OR_BYTE:
    case ILOpcode.XOR_BYTE:
    case ILOpcode.CMP_BYTE:
      // Reads from slot
      if (isSlotOperand(instr.operands[0])) {
        uses.push(instr.operands[0].slot.name);
      }
      break;
      
    case ILOpcode.INC_BYTE:
    case ILOpcode.DEC_BYTE:
      // Both reads and writes
      if (isSlotOperand(instr.operands[0])) {
        const name = instr.operands[0].slot.name;
        uses.push(name);
        defs.push(name);
      }
      break;
  }
  
  return { defs, uses };
}
```

---

## Cost Model

### Why Cost Matters

The optimizer needs to know:
- Is this transformation worth it?
- Which of two approaches is faster?
- Should we inline this function?

### Cost Data Structure

```typescript
interface InstructionCost {
  /** Estimated 6502 cycles */
  cycles: number;
  
  /** Estimated instruction bytes */
  bytes: number;
  
  /** Number of memory accesses */
  memoryAccesses: number;
}
```

### Cost Table

```typescript
/**
 * Base cycle costs for each opcode.
 * Actual cost depends on addressing mode.
 */
const BASE_COSTS: Record<ILOpcode, InstructionCost> = {
  // Memory loads
  [ILOpcode.LOAD_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },    // LDA zp (3) or LDA abs (4)
  [ILOpcode.STORE_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },   // STA zp (3) or STA abs (4)
  [ILOpcode.LOAD_IMM]: { cycles: 2, bytes: 2, memoryAccesses: 0 },     // LDA #imm
  
  // Arithmetic
  [ILOpcode.ADD_BYTE]: { cycles: 5, bytes: 4, memoryAccesses: 1 },     // CLC + ADC
  [ILOpcode.SUB_BYTE]: { cycles: 5, bytes: 4, memoryAccesses: 1 },     // SEC + SBC
  [ILOpcode.ADD_IMM]: { cycles: 4, bytes: 4, memoryAccesses: 0 },      // CLC + ADC #imm
  [ILOpcode.INC_BYTE]: { cycles: 5, bytes: 2, memoryAccesses: 2 },     // INC addr (read-modify-write)
  
  // Bitwise
  [ILOpcode.AND_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },     // AND addr
  [ILOpcode.OR_BYTE]: { cycles: 3, bytes: 2, memoryAccesses: 1 },      // ORA addr
  [ILOpcode.SHL_BYTE]: { cycles: 2, bytes: 1, memoryAccesses: 0 },     // ASL A (per shift)
  
  // Control flow
  [ILOpcode.JUMP]: { cycles: 3, bytes: 3, memoryAccesses: 0 },         // JMP
  [ILOpcode.JUMP_EQ]: { cycles: 2, bytes: 2, memoryAccesses: 0 },      // BEQ (not taken: 2, taken: 3-4)
  [ILOpcode.CALL]: { cycles: 6, bytes: 3, memoryAccesses: 2 },         // JSR
  [ILOpcode.RETURN]: { cycles: 6, bytes: 1, memoryAccesses: 2 },       // RTS
  
  // Software routines
  [ILOpcode.MUL_BYTE]: { cycles: 100, bytes: 3, memoryAccesses: 10 },  // Software multiply
  [ILOpcode.DIV_BYTE]: { cycles: 150, bytes: 3, memoryAccesses: 10 },  // Software divide
};
```

### Adjusting Cost by Addressing Mode

```typescript
/**
 * Compute actual cost based on operand addressing mode.
 */
function computeInstructionCost(instr: ILInstruction): InstructionCost {
  const base = BASE_COSTS[instr.opcode] || { cycles: 1, bytes: 1, memoryAccesses: 0 };
  
  let cycles = base.cycles;
  let bytes = base.bytes;
  
  // Adjust for addressing mode
  for (const op of instr.operands) {
    if (isSlotOperand(op)) {
      switch (op.addressingHint) {
        case AddressingModeHint.ZeroPage:
          // ZP is fastest - no adjustment
          break;
        case AddressingModeHint.Absolute:
          // Absolute is 1 cycle and 1 byte more
          cycles += 1;
          bytes += 1;
          break;
        case AddressingModeHint.ZeroPageX:
        case AddressingModeHint.ZeroPageY:
          // ZP indexed: +1 cycle
          cycles += 1;
          break;
        case AddressingModeHint.AbsoluteX:
        case AddressingModeHint.AbsoluteY:
          // Absolute indexed: +1-2 cycles, +1 byte
          cycles += 1;
          bytes += 1;
          break;
        case AddressingModeHint.IndirectY:
          // Indirect indexed: +2 cycles
          cycles += 2;
          break;
      }
    }
  }
  
  return { cycles, bytes, memoryAccesses: base.memoryAccesses };
}
```

---

## Optimization Hints

### The Hints Structure

```typescript
interface OptimizationHints {
  /** Is this instruction in a hot loop? */
  isHotPath: boolean;
  
  /** Is this a frequently accessed variable? */
  isFrequentAccess: boolean;
  
  /** Can this be coalesced with adjacent instructions? */
  canCoalesce: boolean;
  
  /** Is this instruction dead (result unused)? */
  isDead: boolean;
}
```

### Computing Hints

```typescript
/**
 * Compute optimization hints for an instruction.
 */
function computeHints(
  instr: ILInstruction,
  loopDepth: number
): OptimizationHints {
  return {
    isHotPath: loopDepth > 0 || hasHotSlotAccess(instr),
    isFrequentAccess: hasFrequentSlotAccess(instr),
    canCoalesce: canCoalesceWithNext(instr),
    isDead: isDeadStore(instr),
  };
}

function hasHotSlotAccess(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op) && op.slot.maxLoopDepth > 0) {
      return true;
    }
  }
  return false;
}

function hasFrequentSlotAccess(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op) && op.slot.accessCount > 20) {
      return true;
    }
  }
  return false;
}
```

---

## Using Hints in Optimizer

### Example: Dead Store Elimination

```typescript
function eliminateDeadStores(func: ILFunction): number {
  let eliminated = 0;
  
  func.instructions = func.instructions.filter(instr => {
    if (instr.hints?.isDead) {
      eliminated++;
      return false; // Remove instruction
    }
    return true;
  });
  
  return eliminated;
}
```

### Example: Hot Path Prioritization

```typescript
function prioritizeHotPaths(func: ILFunction): void {
  // Count hot vs cold instructions
  const hot = func.instructions.filter(i => i.hints?.isHotPath);
  const cold = func.instructions.filter(i => !i.hints?.isHotPath);
  
  console.log(`Hot path: ${hot.length} instructions`);
  console.log(`Cold path: ${cold.length} instructions`);
  
  // Hot paths get more aggressive optimization
  for (const instr of hot) {
    // Try to use ZP addressing where possible
    // Try to reduce memory accesses
    // Consider strength reduction
  }
}
```

---

## Integration Points

### When Hints Are Computed

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. IL Generation                                                 │
│    - Create instructions with operands                          │
│    - Compute def-use immediately                                │
│    - Set initial cost from base table                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Cost Adjustment                                               │
│    - Adjust costs based on addressing mode hints                │
│    - Sum up total estimated cycles                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Live Range Analysis                                           │
│    - Compute liveIn/liveOut for all instructions                │
│    - Run backward dataflow to fixed point                       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Hint Computation                                              │
│    - Determine isHotPath from loop depth + slot access          │
│    - Determine isDead from live range analysis                  │
│    - Set canCoalesce based on pattern matching                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary: What Makes This God-Level

| Feature | Traditional IL | God-Level IL |
|---------|---------------|--------------|
| Def-Use | Not in IL | ✅ On every instruction |
| Live Ranges | Not in IL | ✅ liveIn/liveOut sets |
| Cost Model | None | ✅ Cycles/bytes/memory |
| Hot Path | Unknown | ✅ From SFA slot data |
| Dead Store | Late analysis | ✅ Marked in IL |

**Result:** The optimizer and code generator have ALL the information they need to produce optimal code, without re-analyzing anything.

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [03-il-types.md](03-il-types.md) | Type definitions |
| [04-slot-integration.md](04-slot-integration.md) | Slot context |
| [06-loop-structure.md](06-loop-structure.md) | Loop awareness |