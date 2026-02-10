/**
 * IL Factory Functions
 *
 * Convenience functions for creating IL operands, instructions,
 * functions, and programs. These ensure consistent creation
 * and reduce boilerplate.
 *
 * @module il/factories
 */

import { SourceLocation } from '../ast/base.js';
import { Frame } from '../frame/allocator/frame-calculator.js';
import { SlotLocation } from '../frame/enums.js';
import { FrameSlot } from '../frame/types.js';
import { AddressingModeHint, ILOpcode } from './enums.js';
import { DefUse, ILInstruction, InstructionCost, OptimizationHints } from './instruction.js';
import {
  AddressOperand,
  FunctionOperand,
  ILOperand,
  ImmediateOperand,
  LabelOperand,
  SlotOperand,
} from './operands.js';
import { ILFunction, ILLoop, ILProgram } from './structures.js';

// ============================================================================
// Operand Factory Functions
// ============================================================================

/**
 * Create a slot operand.
 *
 * Auto-computes addressing hint based on slot location if not provided.
 * ZP slots get ZeroPage hint, frame region slots get Absolute hint.
 *
 * @param slot - The frame slot to reference
 * @param addressingHint - Optional override for addressing mode
 * @param indexOffset - Optional array index offset
 * @param indexSlot - Optional dynamic index slot
 * @returns A new SlotOperand
 *
 * @example
 * ```typescript
 * const counterOp = createSlotOperand(counterSlot);
 * const arrayOp = createSlotOperand(arraySlot, undefined, 5);
 * const dynamicOp = createSlotOperand(arraySlot, undefined, undefined, indexSlot);
 * ```
 */
export function createSlotOperand(
  slot: FrameSlot,
  addressingHint?: AddressingModeHint,
  indexOffset?: number,
  indexSlot?: FrameSlot
): SlotOperand {
  // Auto-compute addressing hint based on slot location
  const hint =
    addressingHint ??
    (slot.location === SlotLocation.ZeroPage
      ? AddressingModeHint.ZeroPage
      : AddressingModeHint.Absolute);

  return {
    kind: 'slot',
    slot,
    addressingHint: hint,
    indexOffset,
    indexSlot,
  };
}

/**
 * Create an immediate operand.
 *
 * @param value - The constant value
 * @param isWord - Whether this is a 16-bit value (default: false)
 * @returns A new ImmediateOperand
 *
 * @example
 * ```typescript
 * const byteOp = createImmediateOperand(42);
 * const wordOp = createImmediateOperand(0x1000, true);
 * ```
 */
export function createImmediateOperand(value: number, isWord: boolean = false): ImmediateOperand {
  return {
    kind: 'immediate',
    value,
    isWord,
  };
}

/**
 * Create a label operand.
 *
 * @param name - The label name (unique within function)
 * @returns A new LabelOperand
 *
 * @example
 * ```typescript
 * const startLabel = createLabelOperand('loop_start');
 * const endLabel = createLabelOperand('loop_end');
 * ```
 */
export function createLabelOperand(name: string): LabelOperand {
  return {
    kind: 'label',
    name,
  };
}

/**
 * Create a function operand.
 *
 * @param name - Function name
 * @param isCallback - Whether this is a callback/ISR (default: false)
 * @param coalesceGroup - Callee's coalesce group (default: -1)
 * @returns A new FunctionOperand
 *
 * @example
 * ```typescript
 * const funcOp = createFunctionOperand('updateGame');
 * const callbackOp = createFunctionOperand('handleIrq', true);
 * ```
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
 * Create an address operand.
 *
 * Auto-detects zero page based on address value.
 *
 * @param address - The memory address
 * @param isZeroPage - Override for ZP detection (default: auto)
 * @returns A new AddressOperand
 *
 * @example
 * ```typescript
 * const zpAddr = createAddressOperand(0x02);       // isZeroPage: true
 * const absAddr = createAddressOperand(0xD020);   // isZeroPage: false
 * ```
 */
export function createAddressOperand(address: number, isZeroPage?: boolean): AddressOperand {
  return {
    kind: 'address',
    address,
    isZeroPage: isZeroPage ?? address < 0x100,
  };
}

/**
 * Create an indexed address operand for dynamic peek/poke.
 *
 * Used for the common pattern: poke(CONSTANT_BASE + variable_offset, value)
 * The codegen will use absolute indexed addressing (e.g., STA $3000,X).
 *
 * @param address - The base memory address
 * @param indexRegister - Which 6502 register holds the index ('X' or 'Y')
 * @returns A new AddressOperand with indexRegister set
 *
 * @example
 * ```typescript
 * // poke($3000 + i, value) → STA $3000,X (after TAX)
 * const indexed = createIndexedAddressOperand(0x3000, 'X');
 * ```
 */
export function createIndexedAddressOperand(
  address: number,
  indexRegister: 'X' | 'Y',
): AddressOperand {
  return {
    kind: 'address',
    address,
    // Indexed addressing with base > 0xFF always uses absolute mode
    isZeroPage: address < 0x100,
    indexRegister,
  };
}

// ============================================================================
// Instruction Factory Functions
// ============================================================================

/**
 * Create an IL instruction.
 *
 * @param opcode - The IL opcode
 * @param operands - Operands for this instruction (default: [])
 * @param options - Optional properties (location, comment, cost, etc.)
 * @returns A new ILInstruction
 *
 * @example
 * ```typescript
 * const loadInstr = createInstruction(ILOpcode.LOAD_BYTE, [slotOp]);
 * const jumpInstr = createInstruction(ILOpcode.JUMP, [labelOp], {
 *   comment: 'Jump to loop start',
 * });
 * ```
 */
export function createInstruction(
  opcode: ILOpcode,
  operands: ILOperand[] = [],
  options?: {
    location?: SourceLocation;
    comment?: string;
    cost?: InstructionCost;
    defUse?: DefUse;
    hints?: OptimizationHints;
  }
): ILInstruction {
  return {
    opcode,
    operands,
    location: options?.location,
    comment: options?.comment,
    cost: options?.cost,
    defUse: options?.defUse,
    hints: options?.hints,
  };
}

/**
 * Create an instruction cost.
 *
 * @param cycles - Estimated 6502 cycles
 * @param bytes - Estimated instruction bytes
 * @param memoryAccesses - Number of memory accesses
 * @returns A new InstructionCost
 *
 * @example
 * ```typescript
 * const zpCost = createInstructionCost(3, 2, 1);
 * const absCost = createInstructionCost(4, 3, 1);
 * ```
 */
export function createInstructionCost(
  cycles: number,
  bytes: number,
  memoryAccesses: number
): InstructionCost {
  return {
    cycles,
    bytes,
    memoryAccesses,
  };
}

/**
 * Create def-use information.
 *
 * @param defs - Slot names defined (written)
 * @param uses - Slot names used (read)
 * @returns A new DefUse
 *
 * @example
 * ```typescript
 * // x = y + z
 * const defUse = createDefUse(['x'], ['y', 'z']);
 * ```
 */
export function createDefUse(defs: string[], uses: string[]): DefUse {
  return {
    defs,
    uses,
  };
}

/**
 * Create optimization hints.
 *
 * @param options - Hint values (defaults to safe values)
 * @returns A new OptimizationHints
 *
 * @example
 * ```typescript
 * const hints = createOptimizationHints({ isHotPath: true });
 * ```
 */
export function createOptimizationHints(
  options: Partial<OptimizationHints> = {}
): OptimizationHints {
  return {
    isHotPath: options.isHotPath ?? false,
    isFrequentAccess: options.isFrequentAccess ?? false,
    canCoalesce: options.canCoalesce ?? false,
    isDead: options.isDead ?? false,
  };
}

// ============================================================================
// Structure Factory Functions
// ============================================================================

/**
 * Create an IL loop structure.
 *
 * @param headerLabel - Label at loop header
 * @param exitLabel - Label at loop exit
 * @param depth - Loop nesting depth
 * @param options - Optional counted loop properties
 * @returns A new ILLoop
 *
 * @example
 * ```typescript
 * const simpleLoop = createILLoop('while_0', 'while_0_exit', 1);
 * const countedLoop = createILLoop('for_0', 'for_0_exit', 1, {
 *   isCountedLoop: true,
 *   counterSlot: iSlot,
 *   boundValue: 10,
 * });
 * ```
 */
export function createILLoop(
  headerLabel: string,
  exitLabel: string,
  depth: number,
  options?: {
    isCountedLoop?: boolean;
    counterSlot?: FrameSlot;
    boundValue?: number;
    boundSlot?: FrameSlot;
    estimatedIterations?: number;
  }
): ILLoop {
  return {
    headerLabel,
    exitLabel,
    depth,
    isCountedLoop: options?.isCountedLoop ?? false,
    counterSlot: options?.counterSlot,
    boundValue: options?.boundValue,
    boundSlot: options?.boundSlot,
    estimatedIterations: options?.estimatedIterations,
  };
}

/**
 * Create an IL function.
 *
 * @param name - Function name
 * @param frame - Associated frame from SFA
 * @param options - Optional properties
 * @returns A new ILFunction
 *
 * @example
 * ```typescript
 * const mainFunc = createILFunction('main', mainFrame, { isExported: true });
 * ```
 */
export function createILFunction(
  name: string,
  frame: Frame,
  options?: {
    instructions?: ILInstruction[];
    isExported?: boolean;
    isCallback?: boolean;
    loops?: ILLoop[];
    maxLoopDepth?: number;
  }
): ILFunction {
  return {
    name,
    frame,
    instructions: options?.instructions ?? [],
    isExported: options?.isExported ?? frame.isExported,
    isCallback: options?.isCallback ?? frame.isCallback,
    loops: options?.loops ?? [],
    maxLoopDepth: options?.maxLoopDepth ?? 0,
  };
}

/**
 * Create an IL program.
 *
 * @param moduleName - Module name
 * @param options - Optional properties
 * @returns A new ILProgram
 *
 * @example
 * ```typescript
 * const program = createILProgram('game', {
 *   functions: [mainFunc],
 *   entryPoint: 'main',
 * });
 * ```
 */
export function createILProgram(
  moduleName: string,
  options?: {
    functions?: ILFunction[];
    globalInit?: ILInstruction[];
    entryPoint?: string;
    instructionCount?: number;
    totalEstimatedCycles?: number;
  }
): ILProgram {
  return {
    moduleName,
    functions: options?.functions ?? [],
    globalInit: options?.globalInit ?? [],
    entryPoint: options?.entryPoint ?? 'main',
    instructionCount: options?.instructionCount ?? 0,
    totalEstimatedCycles: options?.totalEstimatedCycles ?? 0,
  };
}