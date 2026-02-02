# Slot Integration: Beyond God-Level IL Generator

> **Document**: 04-slot-integration.md
> **Parent**: [Index](00-index.md)

---

## Overview

This document describes how **SFA FrameSlots flow through the IL generation process**. This is the key innovation that differentiates Blend65 from all other 6502 compilers.

---

## The Problem with Address-Only IL

Traditional compilers generate IL like this:

```
LOAD_BYTE $0200    ; What is this? ZP? Frame? Who knows!
ADD_BYTE $0201     ; Is this in a hot loop? No idea!
STORE_BYTE $0200   ; Should we use ZP addressing? 🤷
```

The code generator has to figure out:
- Is `$0200` in zero page? (affects instruction selection)
- How often is this variable accessed? (affects optimization priority)
- Is this in a loop? (affects unrolling/optimization decisions)

**This information was computed during semantic analysis but is LOST by the time it reaches codegen.**

---

## The Slot-Centric Solution

With slot-centric IL, we preserve ALL the context:

```typescript
// Instead of:
emit(ILOpcode.LOAD_BYTE, { kind: 'address', address: 0x0200 });

// We emit:
emit(ILOpcode.LOAD_BYTE, {
  kind: 'slot',
  slot: playerXSlot,  // Full FrameSlot with location, accessCount, etc.
  addressingHint: AddressingModeHint.ZeroPage,
});
```

The code generator now knows:
- ✅ `playerXSlot.location === SlotLocation.ZeroPage` → Use `LDA $02` (ZP mode)
- ✅ `playerXSlot.accessCount === 50` → High priority for optimization
- ✅ `playerXSlot.maxLoopDepth === 2` → In a hot loop
- ✅ `playerXSlot.type.kind === TypeKind.Byte` → 1-byte load

---

## Variable Resolution Flow

### Step 1: AST Identifier Node

```typescript
// Source: let x: byte = playerX + 1;
//         ^^^^^^^^^ IdentifierExpr

interface IdentifierExpr {
  name: 'playerX';
  // ...
}
```

### Step 2: Look Up in Frame

```typescript
class ILGenerator {
  /**
   * Resolve a variable name to its FrameSlot.
   */
  protected resolveVariable(name: string): FrameSlot {
    // Get current function's frame
    const frame = this.frameMap.get(this.currentFunction);
    if (!frame) {
      throw new Error(`No frame for function: ${this.currentFunction}`);
    }
    
    // Find the slot by name
    const slot = frame.slots.find(s => s.name === name);
    if (!slot) {
      throw new Error(`Unknown variable: ${name}`);
    }
    
    return slot;
  }
}
```

### Step 3: Create Slot Operand

```typescript
/**
 * Generate IL for identifier expression.
 */
protected generateIdentifier(expr: IdentifierExpr): void {
  const slot = this.resolveVariable(expr.name);
  
  // Create slot operand with addressing hint
  const operand = createSlotOperand(slot);
  
  // Emit load instruction
  if (slot.type.kind === TypeKind.Word) {
    this.builder.emit(ILOpcode.LOAD_WORD, [operand]);
  } else {
    this.builder.emit(ILOpcode.LOAD_BYTE, [operand]);
  }
}
```

### Step 4: IL Instruction Carries Full Context

```typescript
// Resulting IL instruction:
{
  opcode: ILOpcode.LOAD_BYTE,
  operands: [{
    kind: 'slot',
    slot: {
      name: 'playerX',
      kind: SlotKind.Local,
      type: { kind: TypeKind.Byte, size: 1 },
      size: 1,
      location: SlotLocation.ZeroPage,  // ← Codegen uses this!
      address: 0x02,
      accessCount: 50,                   // ← Optimizer uses this!
      maxLoopDepth: 2,                   // ← Hot path hint!
      zpScore: 150,
    },
    addressingHint: AddressingModeHint.ZeroPage,
  }],
  comment: 'load playerX',
}
```

---

## Addressing Mode Selection

### Automatic Hint Computation

```typescript
/**
 * Compute optimal addressing mode for a slot access.
 */
function computeAddressingHint(
  slot: FrameSlot,
  context: AccessContext
): AddressingModeHint {
  // 1. Zero page slots - always prefer ZP mode (faster)
  if (slot.location === SlotLocation.ZeroPage) {
    if (context.hasIndexVariable) {
      // Array access with index: use ZP,X or ZP,Y
      return context.indexRegister === 'X'
        ? AddressingModeHint.ZeroPageX
        : AddressingModeHint.ZeroPageY;
    }
    return AddressingModeHint.ZeroPage;
  }
  
  // 2. Frame region slots
  if (slot.location === SlotLocation.FrameRegion) {
    if (context.hasIndexVariable) {
      return context.indexRegister === 'X'
        ? AddressingModeHint.AbsoluteX
        : AddressingModeHint.AbsoluteY;
    }
    return AddressingModeHint.Absolute;
  }
  
  // 3. Pointer indirection (word type as pointer)
  if (slot.type.kind === TypeKind.Word && context.isPointerDeref) {
    if (slot.location === SlotLocation.ZeroPage) {
      // Indirect indexed: LDA ($nn),Y
      return AddressingModeHint.IndirectY;
    }
    // Absolute indirect not common; use manual approach
    return AddressingModeHint.Absolute;
  }
  
  return AddressingModeHint.Absolute;
}
```

### Code Generator Uses Hints

```typescript
// In CodeGenerator:
function emitLoadByte(instr: ILInstruction): void {
  const operand = instr.operands[0];
  
  if (isSlotOperand(operand)) {
    switch (operand.addressingHint) {
      case AddressingModeHint.ZeroPage:
        emit(`LDA $${operand.slot.address.toString(16).padStart(2, '0')}`);
        break;
      case AddressingModeHint.Absolute:
        emit(`LDA $${operand.slot.address.toString(16).padStart(4, '0')}`);
        break;
      case AddressingModeHint.ZeroPageX:
        emit(`LDA $${operand.slot.address.toString(16).padStart(2, '0')},X`);
        break;
      // ... etc
    }
  }
}
```

---

## Array Access Handling

Arrays require indexed addressing. The slot operand tracks this:

### Static Index (Compile-Time Known)

```typescript
// Source: arr[5]
const operand: SlotOperand = {
  kind: 'slot',
  slot: arrSlot,
  addressingHint: AddressingModeHint.Absolute, // Direct offset
  indexOffset: 5,  // Static offset
};

// Generated: LDA arr+5
```

### Dynamic Index (Runtime Variable)

```typescript
// Source: arr[i]
const operand: SlotOperand = {
  kind: 'slot',
  slot: arrSlot,
  addressingHint: AddressingModeHint.AbsoluteX, // Use X register
  indexSlot: iSlot,  // The index variable
};

// Generated:
// LDX i        ; Load index
// LDA arr,X    ; Indexed load
```

### Pointer Dereferencing

```typescript
// Source: *ptr
const operand: SlotOperand = {
  kind: 'slot',
  slot: ptrSlot,  // Word slot containing pointer
  addressingHint: AddressingModeHint.IndirectY,
};

// Generated:
// LDY #0
// LDA (ptr),Y
```

---

## Register Parameter Integration

When a parameter is passed via register, no memory access is needed:

### Detection

```typescript
/**
 * Check if a slot is register-passed.
 */
function isRegisterSlot(slot: FrameSlot): boolean {
  return slot.location === SlotLocation.Register;
}

/**
 * Get the register name for a register slot.
 */
function getSlotRegister(slot: FrameSlot): string | undefined {
  return slot.register;  // 'A', 'X', or 'Y'
}
```

### IL Generation for Register Params

```typescript
protected generateIdentifier(expr: IdentifierExpr): void {
  const slot = this.resolveVariable(expr.name);
  
  // Check if this is a register parameter
  if (slot.location === SlotLocation.Register) {
    // No LOAD needed - value is already in register!
    if (slot.register !== 'A') {
      // If not in A, transfer to A (result goes to accumulator)
      if (slot.register === 'X') {
        this.builder.emit(ILOpcode.TRANSFER_XA, []);
      } else if (slot.register === 'Y') {
        this.builder.emit(ILOpcode.TRANSFER_YA, []);
      }
    }
    return;
  }
  
  // Normal memory slot - emit load
  this.builder.loadSlot(slot);
}
```

### Function Call with Register Params

```typescript
protected generateCall(expr: CallExpr): void {
  const funcName = expr.callee.name;
  const calleeFrame = this.frameMap.get(funcName);
  
  for (let i = 0; i < expr.arguments.length; i++) {
    const paramSlot = calleeFrame.slots[i];
    
    // Generate argument value
    this.generateExpression(expr.arguments[i]);
    
    if (paramSlot.location === SlotLocation.Register) {
      // Transfer to appropriate register
      if (paramSlot.register === 'X') {
        this.builder.emit(ILOpcode.TRANSFER_AX, []);
      } else if (paramSlot.register === 'Y') {
        this.builder.emit(ILOpcode.TRANSFER_AY, []);
      }
      // 'A' is already in A - no transfer needed
    } else {
      // Store to memory slot
      this.builder.storeSlot(paramSlot);
    }
  }
  
  // Emit call
  this.builder.emit(ILOpcode.CALL, [
    createFunctionOperand(funcName, calleeFrame.isCallback, calleeFrame.coalesceGroup)
  ]);
}
```

---

## Hot Path Detection

The slot's `accessCount` and `maxLoopDepth` inform optimization:

```typescript
/**
 * Check if an instruction accesses a hot variable.
 */
function isHotPathAccess(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op)) {
      // Variable accessed many times or in deep loop
      if (op.slot.accessCount > 10 || op.slot.maxLoopDepth > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Compute optimization hints for an instruction.
 */
function computeOptimizationHints(instr: ILInstruction): OptimizationHints {
  return {
    isHotPath: isHotPathAccess(instr),
    isFrequentAccess: instr.operands.some(
      op => isSlotOperand(op) && op.slot.accessCount > 20
    ),
    canCoalesce: false, // Set by later analysis
    isDead: false,      // Set by liveness analysis
  };
}
```

---

## Summary: Slot Context Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Source Code                                                       │
│   let x: byte = y + 1;                                           │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Semantic Analysis                                                 │
│   - Creates FrameSlot for x                                      │
│   - Tracks accessCount, maxLoopDepth                             │
│   - Computes zpScore                                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Frame Allocator                                                   │
│   - Assigns location (ZP, FrameRegion, Register)                 │
│   - Assigns address                                              │
│   - Returns FrameMap                                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ IL Generator (THIS IS WHERE WE ARE)                              │
│   - Resolves 'y' to ySlot                                        │
│   - Emits LOAD_BYTE with SlotOperand(ySlot)                      │
│   - Emits ADD_IMM with ImmediateOperand(1)                       │
│   - Resolves 'x' to xSlot                                        │
│   - Emits STORE_BYTE with SlotOperand(xSlot)                     │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Code Generator                                                    │
│   - Sees SlotOperand(ySlot) with location=ZeroPage               │
│   - Emits: LDA $02  (ZP addressing - 3 cycles)                   │
│   - Sees ImmediateOperand(1)                                     │
│   - Emits: CLC / ADC #1                                          │
│   - Sees SlotOperand(xSlot) with location=FrameRegion            │
│   - Emits: STA $0200 (Absolute addressing - 4 cycles)            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [03-il-types.md](03-il-types.md) | Type definitions |
| [05-optimization-hints.md](05-optimization-hints.md) | Hint computation |
| [08-il-generator.md](08-il-generator.md) | Generator implementation |