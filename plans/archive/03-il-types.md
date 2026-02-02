# IL Types: Beyond God-Level IL Generator

> **Document**: 03-il-types.md
> **Parent**: [Index](00-index.md)

---

## Overview

This document defines the core IL type system. Unlike traditional compilers that use raw addresses, our IL uses **slot-centric operands** that carry full SFA context.

---

## IL Opcode Enumeration

```typescript
/**
 * IL Opcode enumeration.
 * 
 * ~30 opcodes designed for accumulator-centric 6502 code generation.
 * Each opcode maps cleanly to 1-3 6502 instructions.
 */
export enum ILOpcode {
  // ══════════════════════════════════════════════════════════════════
  // MEMORY OPERATIONS - Load/Store
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Load byte from slot into accumulator.
   * Operands: [SlotOperand]
   * Effect: A ← [slot.address]
   * 6502: LDA addr (ZP or Absolute based on slot.location)
   */
  LOAD_BYTE = 'LOAD_BYTE',
  
  /**
   * Store accumulator to slot.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← A
   * 6502: STA addr (ZP or Absolute based on slot.location)
   */
  STORE_BYTE = 'STORE_BYTE',
  
  /**
   * Load word from slot (16-bit).
   * Operands: [SlotOperand]
   * Effect: A ← [slot.address], X ← [slot.address+1]
   * 6502: LDA addr / LDX addr+1
   */
  LOAD_WORD = 'LOAD_WORD',
  
  /**
   * Store word to slot (16-bit).
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← A, [slot.address+1] ← X
   * 6502: STA addr / STX addr+1
   */
  STORE_WORD = 'STORE_WORD',
  
  /**
   * Load immediate byte into accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← imm
   * 6502: LDA #imm
   */
  LOAD_IMM = 'LOAD_IMM',
  
  /**
   * Load immediate word (16-bit).
   * Operands: [ImmediateOperand]
   * Effect: A ← lo(imm), X ← hi(imm)
   * 6502: LDA #lo / LDX #hi
   */
  LOAD_IMM_WORD = 'LOAD_IMM_WORD',

  // ══════════════════════════════════════════════════════════════════
  // ARITHMETIC OPERATIONS
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Add byte from slot to accumulator.
   * Operands: [SlotOperand]
   * Effect: A ← A + [slot.address]
   * 6502: CLC / ADC addr
   */
  ADD_BYTE = 'ADD_BYTE',
  
  /**
   * Subtract byte from slot.
   * Operands: [SlotOperand]
   * Effect: A ← A - [slot.address]
   * 6502: SEC / SBC addr
   */
  SUB_BYTE = 'SUB_BYTE',
  
  /**
   * Add immediate to accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← A + imm
   * 6502: CLC / ADC #imm
   */
  ADD_IMM = 'ADD_IMM',
  
  /**
   * Subtract immediate from accumulator.
   * Operands: [ImmediateOperand]
   * Effect: A ← A - imm
   * 6502: SEC / SBC #imm
   */
  SUB_IMM = 'SUB_IMM',
  
  /**
   * Multiply (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A * [slot.address]
   * 6502: JSR __mul8
   */
  MUL_BYTE = 'MUL_BYTE',
  
  /**
   * Divide (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A / [slot.address]
   * 6502: JSR __div8
   */
  DIV_BYTE = 'DIV_BYTE',
  
  /**
   * Modulo (software implementation).
   * Operands: [SlotOperand]
   * Effect: A ← A % [slot.address]
   * 6502: JSR __mod8
   */
  MOD_BYTE = 'MOD_BYTE',
  
  /**
   * Increment slot value.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← [slot.address] + 1
   * 6502: INC addr
   */
  INC_BYTE = 'INC_BYTE',
  
  /**
   * Decrement slot value.
   * Operands: [SlotOperand]
   * Effect: [slot.address] ← [slot.address] - 1
   * 6502: DEC addr
   */
  DEC_BYTE = 'DEC_BYTE',

  // ══════════════════════════════════════════════════════════════════
  // BITWISE OPERATIONS
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Bitwise AND with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A & [slot.address]
   * 6502: AND addr
   */
  AND_BYTE = 'AND_BYTE',
  
  /**
   * Bitwise OR with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A | [slot.address]
   * 6502: ORA addr
   */
  OR_BYTE = 'OR_BYTE',
  
  /**
   * Bitwise XOR with slot.
   * Operands: [SlotOperand]
   * Effect: A ← A ^ [slot.address]
   * 6502: EOR addr
   */
  XOR_BYTE = 'XOR_BYTE',
  
  /**
   * Bitwise AND with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A & imm
   * 6502: AND #imm
   */
  AND_IMM = 'AND_IMM',
  
  /**
   * Bitwise OR with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A | imm
   * 6502: ORA #imm
   */
  OR_IMM = 'OR_IMM',
  
  /**
   * Bitwise XOR with immediate.
   * Operands: [ImmediateOperand]
   * Effect: A ← A ^ imm
   * 6502: EOR #imm
   */
  XOR_IMM = 'XOR_IMM',
  
  /**
   * Bitwise NOT (complement).
   * Operands: none
   * Effect: A ← ~A
   * 6502: EOR #$FF
   */
  NOT_BYTE = 'NOT_BYTE',
  
  /**
   * Arithmetic shift left.
   * Operands: [ImmediateOperand] (count)
   * Effect: A ← A << count
   * 6502: ASL (repeated)
   */
  SHL_BYTE = 'SHL_BYTE',
  
  /**
   * Logical shift right.
   * Operands: [ImmediateOperand] (count)
   * Effect: A ← A >> count
   * 6502: LSR (repeated)
   */
  SHR_BYTE = 'SHR_BYTE',

  // ══════════════════════════════════════════════════════════════════
  // COMPARISON OPERATIONS
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Compare accumulator with slot.
   * Operands: [SlotOperand]
   * Effect: flags ← A cmp [slot.address]
   * 6502: CMP addr
   */
  CMP_BYTE = 'CMP_BYTE',
  
  /**
   * Compare accumulator with immediate.
   * Operands: [ImmediateOperand]
   * Effect: flags ← A cmp imm
   * 6502: CMP #imm
   */
  CMP_IMM = 'CMP_IMM',

  // ══════════════════════════════════════════════════════════════════
  // CONTROL FLOW
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Label definition (pseudo-instruction).
   * Operands: [LabelOperand]
   * Not a real instruction - marks a jump target.
   */
  LABEL = 'LABEL',
  
  /**
   * Unconditional jump.
   * Operands: [LabelOperand]
   * 6502: JMP label
   */
  JUMP = 'JUMP',
  
  /**
   * Jump if equal (zero flag set).
   * Operands: [LabelOperand]
   * 6502: BEQ label
   */
  JUMP_EQ = 'JUMP_EQ',
  
  /**
   * Jump if not equal (zero flag clear).
   * Operands: [LabelOperand]
   * 6502: BNE label
   */
  JUMP_NE = 'JUMP_NE',
  
  /**
   * Jump if less than (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCC label
   */
  JUMP_LT = 'JUMP_LT',
  
  /**
   * Jump if less than or equal (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCC label / BEQ label
   */
  JUMP_LE = 'JUMP_LE',
  
  /**
   * Jump if greater than or equal (unsigned).
   * Operands: [LabelOperand]
   * 6502: BCS label
   */
  JUMP_GE = 'JUMP_GE',
  
  /**
   * Jump if greater than (unsigned).
   * Operands: [LabelOperand]
   * 6502: BEQ skip / BCS label / skip:
   */
  JUMP_GT = 'JUMP_GT',

  // ══════════════════════════════════════════════════════════════════
  // FUNCTION OPERATIONS
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Call function.
   * Operands: [FunctionOperand]
   * 6502: JSR funcname
   */
  CALL = 'CALL',
  
  /**
   * Return from function.
   * Operands: none
   * 6502: RTS
   */
  RETURN = 'RETURN',

  // ══════════════════════════════════════════════════════════════════
  // REGISTER OPERATIONS (for register-passed parameters)
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * Transfer A to X.
   * Operands: none
   * 6502: TAX
   */
  TRANSFER_AX = 'TRANSFER_AX',
  
  /**
   * Transfer A to Y.
   * Operands: none
   * 6502: TAY
   */
  TRANSFER_AY = 'TRANSFER_AY',
  
  /**
   * Transfer X to A.
   * Operands: none
   * 6502: TXA
   */
  TRANSFER_XA = 'TRANSFER_XA',
  
  /**
   * Transfer Y to A.
   * Operands: none
   * 6502: TYA
   */
  TRANSFER_YA = 'TRANSFER_YA',

  // ══════════════════════════════════════════════════════════════════
  // INTRINSICS
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * peek(addr) - Read byte from address.
   * Operands: [AddressOperand]
   * Effect: A ← [addr]
   * 6502: LDA addr (or indirect if dynamic)
   */
  PEEK = 'PEEK',
  
  /**
   * poke(addr, val) - Write byte to address.
   * Operands: [AddressOperand, ImmediateOrSlotOperand]
   * Effect: [addr] ← val
   * 6502: STA addr
   */
  POKE = 'POKE',
  
  /**
   * peekw(addr) - Read word from address.
   * Operands: [AddressOperand]
   * Effect: AX ← [addr]
   */
  PEEKW = 'PEEKW',
  
  /**
   * pokew(addr, val) - Write word to address.
   * Operands: [AddressOperand, ImmediateOrSlotOperand]
   * Effect: [addr] ← val
   */
  POKEW = 'POKEW',
  
  /**
   * hi(word) - Get high byte.
   * Operands: none (operates on AX)
   * Effect: A ← X (high byte)
   */
  HI = 'HI',
  
  /**
   * lo(word) - Get low byte.
   * Operands: none (operates on AX)
   * Effect: A ← A (low byte, already there)
   */
  LO = 'LO',

  // ══════════════════════════════════════════════════════════════════
  // SPECIAL
  // ══════════════════════════════════════════════════════════════════
  
  /**
   * No operation (for alignment/debugging).
   * 6502: NOP
   */
  NOP = 'NOP',
  
  /**
   * Push accumulator to stack.
   * Used for complex expressions.
   * 6502: PHA
   */
  PUSH_A = 'PUSH_A',
  
  /**
   * Pop accumulator from stack.
   * 6502: PLA
   */
  POP_A = 'POP_A',
}
```

---

## Operand Types

### Slot-Centric Operand (The Key Innovation)

```typescript
import { FrameSlot } from '../frame/types.js';
import { SlotLocation } from '../frame/enums.js';

/**
 * Addressing mode hints for code generation.
 * Computed during IL generation based on slot analysis.
 */
export enum AddressingModeHint {
  /** Zero page direct: LDA $nn */
  ZeroPage = 'ZeroPage',
  /** Zero page indexed X: LDA $nn,X */
  ZeroPageX = 'ZeroPageX',
  /** Zero page indexed Y: LDA $nn,Y */
  ZeroPageY = 'ZeroPageY',
  /** Absolute: LDA $nnnn */
  Absolute = 'Absolute',
  /** Absolute indexed X: LDA $nnnn,X */
  AbsoluteX = 'AbsoluteX',
  /** Absolute indexed Y: LDA $nnnn,Y */
  AbsoluteY = 'AbsoluteY',
  /** Indirect: JMP ($nnnn) */
  Indirect = 'Indirect',
  /** Indexed indirect: LDA ($nn,X) */
  IndirectX = 'IndirectX',
  /** Indirect indexed: LDA ($nn),Y */
  IndirectY = 'IndirectY',
}

/**
 * Slot operand - references a FrameSlot with full context.
 * 
 * This is the key innovation: instead of just an address,
 * we carry the complete slot information for optimal code generation.
 */
export interface SlotOperand {
  kind: 'slot';
  
  /** Reference to the frame slot */
  slot: FrameSlot;
  
  /** Pre-computed addressing mode hint */
  addressingHint: AddressingModeHint;
  
  /** Array index offset (for array element access) */
  indexOffset?: number;
  
  /** Index variable slot (for dynamic array access) */
  indexSlot?: FrameSlot;
}

/**
 * Immediate operand - a compile-time constant value.
 */
export interface ImmediateOperand {
  kind: 'immediate';
  
  /** The constant value */
  value: number;
  
  /** Whether this is a 16-bit value */
  isWord: boolean;
}

/**
 * Label operand - a jump target.
 */
export interface LabelOperand {
  kind: 'label';
  
  /** Label name (unique within function) */
  name: string;
}

/**
 * Function operand - a function reference for CALL.
 */
export interface FunctionOperand {
  kind: 'function';
  
  /** Function name */
  name: string;
  
  /** Whether this is a callback/ISR */
  isCallback: boolean;
  
  /** Callee's coalesce group (for optimization hints) */
  coalesceGroup: number;
}

/**
 * Address operand - for peek/poke intrinsics.
 */
export interface AddressOperand {
  kind: 'address';
  
  /** The memory address */
  address: number;
  
  /** Whether address is in zero page */
  isZeroPage: boolean;
}

/**
 * Union type of all operand kinds.
 */
export type ILOperand = 
  | SlotOperand 
  | ImmediateOperand 
  | LabelOperand 
  | FunctionOperand
  | AddressOperand;
```

---

## Instruction Interface

```typescript
import { SourceLocation } from '../lexer/types.js';

/**
 * Cost model for an instruction.
 * Used by optimizer to make informed decisions.
 */
export interface InstructionCost {
  /** Estimated 6502 cycles */
  cycles: number;
  
  /** Estimated instruction bytes */
  bytes: number;
  
  /** Number of memory accesses */
  memoryAccesses: number;
}

/**
 * Def-use information for live range analysis.
 */
export interface DefUse {
  /** Slots defined (written) by this instruction */
  defs: string[];
  
  /** Slots used (read) by this instruction */
  uses: string[];
}

/**
 * Optimization hints for peephole optimizer.
 */
export interface OptimizationHints {
  /** Is this instruction in a hot loop? */
  isHotPath: boolean;
  
  /** Is this a frequently accessed variable? */
  isFrequentAccess: boolean;
  
  /** Can this be coalesced with adjacent instructions? */
  canCoalesce: boolean;
  
  /** Is this instruction dead (result unused)? */
  isDead: boolean;
}

/**
 * A single IL instruction.
 */
export interface ILInstruction {
  /** The opcode */
  opcode: ILOpcode;
  
  /** Operands (0-2 depending on opcode) */
  operands: ILOperand[];
  
  /** Source location for debugging */
  location?: SourceLocation;
  
  /** Comment for IL debugging/output */
  comment?: string;
  
  // ═══════════════════════════════════════════════════════════════
  // Beyond God-Level: Optimization Annotations
  // ═══════════════════════════════════════════════════════════════
  
  /** Cost model (cycles, bytes, memory accesses) */
  cost?: InstructionCost;
  
  /** Def-use information */
  defUse?: DefUse;
  
  /** Variables live at this instruction's entry */
  liveIn?: Set<string>;
  
  /** Variables live at this instruction's exit */
  liveOut?: Set<string>;
  
  /** Optimization hints */
  hints?: OptimizationHints;
}
```

---

## Function and Program Interfaces

```typescript
import { Frame } from '../frame/allocator/frame-calculator.js';

/**
 * Loop information for loop-aware optimizations.
 */
export interface ILLoop {
  /** Label at loop header (start) */
  headerLabel: string;
  
  /** Label at loop exit */
  exitLabel: string;
  
  /** Loop nesting depth (1 = outermost) */
  depth: number;
  
  /** Is this a counted loop (for i = 0 to n)? */
  isCountedLoop: boolean;
  
  /** Loop counter slot (if counted) */
  counterSlot?: FrameSlot;
  
  /** Loop bound (if statically known) */
  boundValue?: number;
  
  /** Loop bound slot (if dynamic) */
  boundSlot?: FrameSlot;
  
  /** Estimated iteration count (for unrolling decisions) */
  estimatedIterations?: number;
}

/**
 * An IL function (sequence of instructions with frame).
 */
export interface ILFunction {
  /** Function name */
  name: string;
  
  /** Associated frame from SFA */
  frame: Frame;
  
  /** Instructions */
  instructions: ILInstruction[];
  
  /** Is this function exported? */
  isExported: boolean;
  
  /** Is this a callback/interrupt handler? */
  isCallback: boolean;
  
  // ═══════════════════════════════════════════════════════════════
  // Beyond God-Level: Loop Structure
  // ═══════════════════════════════════════════════════════════════
  
  /** Loops in this function (for loop-specific optimizations) */
  loops: ILLoop[];
  
  /** Maximum loop nesting depth */
  maxLoopDepth: number;
}

/**
 * Complete IL program (one or more modules).
 */
export interface ILProgram {
  /** Module name */
  moduleName: string;
  
  /** All functions in the module */
  functions: ILFunction[];
  
  /** Global variable initialization code */
  globalInit: ILInstruction[];
  
  /** Entry point function name (usually 'main') */
  entryPoint: string;
  
  /** Total instruction count */
  instructionCount: number;
  
  /** Total estimated cycles (for all functions) */
  totalEstimatedCycles: number;
}
```

---

## Factory Functions

```typescript
/**
 * Create a slot operand.
 */
export function createSlotOperand(
  slot: FrameSlot,
  addressingHint?: AddressingModeHint
): SlotOperand {
  // Auto-compute addressing hint based on slot location
  const hint = addressingHint ?? (
    slot.location === SlotLocation.ZeroPage 
      ? AddressingModeHint.ZeroPage 
      : AddressingModeHint.Absolute
  );
  
  return {
    kind: 'slot',
    slot,
    addressingHint: hint,
  };
}

/**
 * Create an immediate operand.
 */
export function createImmediateOperand(
  value: number,
  isWord: boolean = false
): ImmediateOperand {
  return {
    kind: 'immediate',
    value,
    isWord,
  };
}

/**
 * Create a label operand.
 */
export function createLabelOperand(name: string): LabelOperand {
  return {
    kind: 'label',
    name,
  };
}

/**
 * Create a function operand.
 */
export function createFunctionOperand(
  name: string,
  isCallback: boolean = false,
  coalesceGroup: number = -1
): FunctionOperand {
  return {
    kind: 'function',
    name,
    isCallback,
    coalesceGroup,
  };
}

/**
 * Create an IL instruction.
 */
export function createInstruction(
  opcode: ILOpcode,
  operands: ILOperand[] = [],
  options?: Partial<ILInstruction>
): ILInstruction {
  return {
    opcode,
    operands,
    ...options,
  };
}

/**
 * Create an IL function.
 */
export function createILFunction(
  name: string,
  frame: Frame,
  options?: Partial<ILFunction>
): ILFunction {
  return {
    name,
    frame,
    instructions: [],
    isExported: frame.isExported,
    isCallback: frame.isCallback,
    loops: [],
    maxLoopDepth: 0,
    ...options,
  };
}
```

---

## Type Guards

```typescript
/**
 * Check if operand is a slot reference.
 */
export function isSlotOperand(op: ILOperand): op is SlotOperand {
  return op.kind === 'slot';
}

/**
 * Check if operand is an immediate value.
 */
export function isImmediateOperand(op: ILOperand): op is ImmediateOperand {
  return op.kind === 'immediate';
}

/**
 * Check if operand is a label.
 */
export function isLabelOperand(op: ILOperand): op is LabelOperand {
  return op.kind === 'label';
}

/**
 * Check if operand is a function reference.
 */
export function isFunctionOperand(op: ILOperand): op is FunctionOperand {
  return op.kind === 'function';
}

/**
 * Check if operand is a raw address.
 */
export function isAddressOperand(op: ILOperand): op is AddressOperand {
  return op.kind === 'address';
}

/**
 * Check if instruction accesses zero page.
 */
export function isZeroPageInstruction(instr: ILInstruction): boolean {
  for (const op of instr.operands) {
    if (isSlotOperand(op) && op.slot.location === SlotLocation.ZeroPage) {
      return true;
    }
    if (isAddressOperand(op) && op.isZeroPage) {
      return true;
    }
  }
  return false;
}
```

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [04-slot-integration.md](04-slot-integration.md) | How slots flow through IL |
| [05-optimization-hints.md](05-optimization-hints.md) | Hint computation details |
| [07-il-builder.md](07-il-builder.md) | Building instructions |