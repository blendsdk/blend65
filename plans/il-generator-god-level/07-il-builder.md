# IL Builder: Beyond God-Level IL Generator

> **Document**: 07-il-builder.md
> **Parent**: [Index](00-index.md)

---

## Overview

The **ILBuilder** provides a fluent API for constructing IL instructions. It handles:
- Instruction creation with proper operands
- Label management
- Slot-centric operand wrapping
- Cost and def-use computation

---

## Class Design

```typescript
import { FrameSlot } from '../frame/types.js';
import { SlotLocation } from '../frame/enums.js';
import { SourceLocation } from '../lexer/types.js';
import {
  ILOpcode,
  ILInstruction,
  ILOperand,
  SlotOperand,
  ImmediateOperand,
  LabelOperand,
  FunctionOperand,
  AddressingModeHint,
  createSlotOperand,
  createImmediateOperand,
  createLabelOperand,
  createFunctionOperand,
  computeInstructionCost,
  computeDefUse,
} from './types.js';

/**
 * Builder for constructing IL instructions.
 * 
 * Provides a fluent API for emitting instructions with
 * slot-centric operands and automatic hint computation.
 */
export class ILBuilder {
  /** Accumulated instructions */
  protected instructions: ILInstruction[] = [];
  
  /** Label counter for unique names */
  protected labelCounter: number = 0;
  
  /** Current source location (for debugging) */
  protected currentLocation?: SourceLocation;

  // ═══════════════════════════════════════════════════════════════
  // Label Management
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate a unique label name.
   */
  newLabel(prefix: string = 'L'): string {
    return `${prefix}${this.labelCounter++}`;
  }

  /**
   * Emit a label definition.
   */
  label(name: string): void {
    this.emit(ILOpcode.LABEL, [createLabelOperand(name)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Memory Operations - Slot-Centric
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load byte from slot into accumulator.
   */
  loadSlot(slot: FrameSlot, comment?: string): void {
    const operand = createSlotOperand(slot);
    this.emit(ILOpcode.LOAD_BYTE, [operand], comment);
  }

  /**
   * Load word from slot (16-bit).
   */
  loadSlotWord(slot: FrameSlot, comment?: string): void {
    const operand = createSlotOperand(slot);
    this.emit(ILOpcode.LOAD_WORD, [operand], comment);
  }

  /**
   * Store accumulator to slot.
   */
  storeSlot(slot: FrameSlot, comment?: string): void {
    const operand = createSlotOperand(slot);
    this.emit(ILOpcode.STORE_BYTE, [operand], comment);
  }

  /**
   * Store word to slot (16-bit).
   */
  storeSlotWord(slot: FrameSlot, comment?: string): void {
    const operand = createSlotOperand(slot);
    this.emit(ILOpcode.STORE_WORD, [operand], comment);
  }

  // ═══════════════════════════════════════════════════════════════
  // Memory Operations - Immediate
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load immediate byte value.
   */
  loadImm(value: number): void {
    this.emit(ILOpcode.LOAD_IMM, [createImmediateOperand(value)]);
  }

  /**
   * Load immediate word value (16-bit).
   */
  loadImmWord(value: number): void {
    this.emit(ILOpcode.LOAD_IMM_WORD, [createImmediateOperand(value, true)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Arithmetic Operations
  // ═══════════════════════════════════════════════════════════════

  /**
   * Add byte from slot.
   */
  addSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.ADD_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Subtract byte from slot.
   */
  subSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.SUB_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Add immediate value.
   */
  addImm(value: number): void {
    this.emit(ILOpcode.ADD_IMM, [createImmediateOperand(value)]);
  }

  /**
   * Subtract immediate value.
   */
  subImm(value: number): void {
    this.emit(ILOpcode.SUB_IMM, [createImmediateOperand(value)]);
  }

  /**
   * Increment slot.
   */
  incSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.INC_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Decrement slot.
   */
  decSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.DEC_BYTE, [createSlotOperand(slot)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Bitwise Operations
  // ═══════════════════════════════════════════════════════════════

  /**
   * Bitwise AND with slot.
   */
  andSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.AND_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Bitwise OR with slot.
   */
  orSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.OR_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Bitwise XOR with slot.
   */
  xorSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.XOR_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Bitwise NOT.
   */
  not(): void {
    this.emit(ILOpcode.NOT_BYTE, []);
  }

  /**
   * Shift left by count.
   */
  shl(count: number): void {
    this.emit(ILOpcode.SHL_BYTE, [createImmediateOperand(count)]);
  }

  /**
   * Shift right by count.
   */
  shr(count: number): void {
    this.emit(ILOpcode.SHR_BYTE, [createImmediateOperand(count)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Comparison Operations
  // ═══════════════════════════════════════════════════════════════

  /**
   * Compare with slot.
   */
  cmpSlot(slot: FrameSlot): void {
    this.emit(ILOpcode.CMP_BYTE, [createSlotOperand(slot)]);
  }

  /**
   * Compare with immediate.
   */
  cmpImm(value: number): void {
    this.emit(ILOpcode.CMP_IMM, [createImmediateOperand(value)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Control Flow
  // ═══════════════════════════════════════════════════════════════

  /**
   * Unconditional jump.
   */
  jump(label: string): void {
    this.emit(ILOpcode.JUMP, [createLabelOperand(label)]);
  }

  /**
   * Jump if equal (zero flag set).
   */
  jumpEq(label: string): void {
    this.emit(ILOpcode.JUMP_EQ, [createLabelOperand(label)]);
  }

  /**
   * Jump if not equal.
   */
  jumpNe(label: string): void {
    this.emit(ILOpcode.JUMP_NE, [createLabelOperand(label)]);
  }

  /**
   * Jump if less than.
   */
  jumpLt(label: string): void {
    this.emit(ILOpcode.JUMP_LT, [createLabelOperand(label)]);
  }

  /**
   * Jump if greater than or equal.
   */
  jumpGe(label: string): void {
    this.emit(ILOpcode.JUMP_GE, [createLabelOperand(label)]);
  }

  // ═══════════════════════════════════════════════════════════════
  // Function Operations
  // ═══════════════════════════════════════════════════════════════

  /**
   * Call function.
   */
  call(name: string, isCallback: boolean = false, coalesceGroup: number = -1): void {
    this.emit(ILOpcode.CALL, [createFunctionOperand(name, isCallback, coalesceGroup)]);
  }

  /**
   * Return from function.
   */
  return_(): void {
    this.emit(ILOpcode.RETURN, []);
  }

  // ═══════════════════════════════════════════════════════════════
  // Register Transfers
  // ═══════════════════════════════════════════════════════════════

  transferAX(): void { this.emit(ILOpcode.TRANSFER_AX, []); }
  transferAY(): void { this.emit(ILOpcode.TRANSFER_AY, []); }
  transferXA(): void { this.emit(ILOpcode.TRANSFER_XA, []); }
  transferYA(): void { this.emit(ILOpcode.TRANSFER_YA, []); }

  // ═══════════════════════════════════════════════════════════════
  // Core Emit
  // ═══════════════════════════════════════════════════════════════

  /**
   * Emit a raw instruction with operands.
   */
  emit(opcode: ILOpcode, operands: ILOperand[], comment?: string): void {
    const instr: ILInstruction = {
      opcode,
      operands,
      location: this.currentLocation,
      comment,
    };
    
    // Compute cost
    instr.cost = computeInstructionCost(instr);
    
    // Compute def-use
    instr.defUse = computeDefUse(instr);
    
    this.instructions.push(instr);
  }

  // ═══════════════════════════════════════════════════════════════
  // Accessors
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all built instructions.
   */
  getInstructions(): ILInstruction[] {
    return this.instructions;
  }

  /**
   * Clear instructions for reuse.
   */
  clear(): void {
    this.instructions = [];
    this.labelCounter = 0;
  }

  /**
   * Set current source location.
   */
  setLocation(location: SourceLocation): void {
    this.currentLocation = location;
  }
}
```

---

## Usage Example

```typescript
const builder = new ILBuilder();

// for (i = 0; i < 10; i++)
const loopLabel = builder.newLabel('for');
const endLabel = builder.newLabel('endfor');

builder.loadImm(0);
builder.storeSlot(iSlot, 'i = 0');

builder.label(loopLabel);
builder.loadSlot(iSlot);
builder.cmpImm(10);
builder.jumpGe(endLabel);

// Loop body...
builder.loadSlot(iSlot);
builder.addImm(1);
builder.storeSlot(iSlot, 'i++');

builder.jump(loopLabel);
builder.label(endLabel);
```

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [03-il-types.md](03-il-types.md) | Type definitions |
| [08-il-generator.md](08-il-generator.md) | Uses builder |