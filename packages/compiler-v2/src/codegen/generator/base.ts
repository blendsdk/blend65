/**
 * Code Generator Base Class
 *
 * Foundation for the code generator inheritance chain.
 * Provides core utilities, accumulator tracking, and helper methods.
 *
 * **Inheritance Chain:**
 * CodeGeneratorBase → MemoryOps → ArithmeticOps → BitwiseOps
 * → ComparisonOps → ControlFlowOps → FunctionOps → IntrinsicsOps → CodeGenerator
 *
 * @module codegen/generator/base
 */

import { ILInstruction, ILProgram, ILFunction } from '../../il/index.js';
import { SlotOperand, ImmediateOperand, LabelOperand, FunctionOperand, AddressOperand, ILOperand } from '../../il/operands.js';
import { FrameSlot, isZpSlot } from '../../frame/types.js';
import { AsmILBuilder, AsmILProgram } from '../asm-il/index.js';

// ============================================================================
// Accumulator State Tracking
// ============================================================================

/**
 * Tracks what value is currently in the accumulator.
 *
 * Used for simple load elimination: if A already contains
 * the value we need, skip the redundant load.
 */
export interface AccumulatorState {
  /** Whether we know what's in A */
  known: boolean;

  /** If known, the slot address loaded (if from slot) */
  slotAddress?: number;

  /** If known, the immediate value (if from immediate) */
  immediateValue?: number;

  /** If known, is it a word low byte? */
  isWordLow?: boolean;
}

/**
 * Creates an unknown accumulator state.
 */
export function createUnknownAState(): AccumulatorState {
  return { known: false };
}

/**
 * Creates an accumulator state for a slot load.
 */
export function createSlotAState(address: number): AccumulatorState {
  return { known: true, slotAddress: address };
}

/**
 * Creates an accumulator state for an immediate load.
 */
export function createImmediateAState(value: number): AccumulatorState {
  return { known: true, immediateValue: value };
}

// ============================================================================
// Code Generator Base Class
// ============================================================================

/**
 * Base class for the Code Generator.
 *
 * Provides:
 * - ASM-IL builder management
 * - Accumulator state tracking
 * - Operand extraction helpers
 * - Address mode selection
 * - Label management
 *
 * @example
 * ```typescript
 * class MyCodeGen extends CodeGeneratorBase {
 *   generate(program: ILProgram): AsmILProgram {
 *     // Use this.asm, this.aState, etc.
 *   }
 * }
 * ```
 */
export class CodeGeneratorBase {
  // ==========================================================================
  // State
  // ==========================================================================

  /** ASM-IL builder for output */
  protected asm: AsmILBuilder;

  /** Current accumulator state */
  protected aState: AccumulatorState;

  /** Current function being generated */
  protected currentFunction: ILFunction | null = null;

  /** Label counter for unique labels */
  protected labelCounter: number = 0;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Creates a new CodeGeneratorBase.
   *
   * @param moduleName - Name of the module being generated
   */
  constructor(moduleName: string = 'main') {
    this.asm = new AsmILBuilder(moduleName);
    this.aState = createUnknownAState();
  }

  // ==========================================================================
  // Reset
  // ==========================================================================

  /**
   * Resets generator state for a new module.
   *
   * @param moduleName - Name of the new module
   */
  protected reset(moduleName: string): void {
    this.asm = new AsmILBuilder(moduleName);
    this.aState = createUnknownAState();
    this.currentFunction = null;
    this.labelCounter = 0;
  }

  // ==========================================================================
  // Accumulator State Management
  // ==========================================================================

  /**
   * Invalidates the accumulator state.
   *
   * Call this when A is modified by an operation whose
   * result we can't track (e.g., arithmetic, calls).
   */
  protected invalidateA(): void {
    this.aState = createUnknownAState();
  }

  /**
   * Sets accumulator state for slot load.
   *
   * @param address - The slot address that was loaded
   */
  protected setAFromSlot(address: number): void {
    this.aState = createSlotAState(address);
  }

  /**
   * Sets accumulator state for immediate load.
   *
   * @param value - The immediate value loaded
   */
  protected setAFromImmediate(value: number): void {
    this.aState = createImmediateAState(value);
  }

  /**
   * Checks if A already contains a slot value.
   *
   * @param address - Slot address to check
   * @returns true if A already has this slot's value
   */
  protected aHasSlot(address: number): boolean {
    return this.aState.known && this.aState.slotAddress === address;
  }

  /**
   * Checks if A already contains an immediate value.
   *
   * @param value - Immediate value to check
   * @returns true if A already has this value
   */
  protected aHasImmediate(value: number): boolean {
    return this.aState.known && this.aState.immediateValue === value;
  }

  // ==========================================================================
  // Operand Extraction Helpers
  // ==========================================================================

  /**
   * Extracts a slot operand from instruction operands.
   *
   * @param operands - Instruction operands
   * @param index - Operand index (default: 0)
   * @returns The slot operand
   * @throws Error if operand is not a slot
   */
  protected getSlotOperand(operands: ILOperand[], index: number = 0): SlotOperand {
    const op = operands[index];
    if (!op || op.kind !== 'slot') {
      throw new Error(`Expected slot operand at index ${index}, got ${op?.kind}`);
    }
    return op;
  }

  /**
   * Extracts an immediate operand from instruction operands.
   *
   * @param operands - Instruction operands
   * @param index - Operand index (default: 0)
   * @returns The immediate operand
   * @throws Error if operand is not immediate
   */
  protected getImmediateOperand(operands: ILOperand[], index: number = 0): ImmediateOperand {
    const op = operands[index];
    if (!op || op.kind !== 'immediate') {
      throw new Error(`Expected immediate operand at index ${index}, got ${op?.kind}`);
    }
    return op;
  }

  /**
   * Extracts a label operand from instruction operands.
   *
   * @param operands - Instruction operands
   * @param index - Operand index (default: 0)
   * @returns The label operand
   * @throws Error if operand is not a label
   */
  protected getLabelOperand(operands: ILOperand[], index: number = 0): LabelOperand {
    const op = operands[index];
    if (!op || op.kind !== 'label') {
      throw new Error(`Expected label operand at index ${index}, got ${op?.kind}`);
    }
    return op;
  }

  /**
   * Extracts a function operand from instruction operands.
   *
   * @param operands - Instruction operands
   * @param index - Operand index (default: 0)
   * @returns The function operand
   * @throws Error if operand is not a function
   */
  protected getFunctionOperand(operands: ILOperand[], index: number = 0): FunctionOperand {
    const op = operands[index];
    if (!op || op.kind !== 'function') {
      throw new Error(`Expected function operand at index ${index}, got ${op?.kind}`);
    }
    return op;
  }

  /**
   * Extracts an address operand from instruction operands.
   *
   * @param operands - Instruction operands
   * @param index - Operand index (default: 0)
   * @returns The address operand
   * @throws Error if operand is not an address
   */
  protected getAddressOperand(operands: ILOperand[], index: number = 0): AddressOperand {
    const op = operands[index];
    if (!op || op.kind !== 'address') {
      throw new Error(`Expected address operand at index ${index}, got ${op?.kind}`);
    }
    return op;
  }

  // ==========================================================================
  // Address Mode Selection
  // ==========================================================================

  /**
   * Gets the appropriate load addressing mode for a slot.
   *
   * @param slot - The frame slot
   * @returns 'zeroPage' or 'absolute' depending on slot location
   */
  protected getLoadMode(slot: FrameSlot): 'zeroPage' | 'absolute' {
    return isZpSlot(slot) ? 'zeroPage' : 'absolute';
  }

  /**
   * Gets the appropriate store addressing mode for a slot.
   *
   * @param slot - The frame slot
   * @returns 'zeroPage' or 'absolute' depending on slot location
   */
  protected getStoreMode(slot: FrameSlot): 'zeroPage' | 'absolute' {
    return isZpSlot(slot) ? 'zeroPage' : 'absolute';
  }

  /**
   * Gets addressing mode for an address operand.
   *
   * @param addr - The address operand
   * @returns 'zeroPage' or 'absolute'
   */
  protected getAddressMode(addr: AddressOperand): 'zeroPage' | 'absolute' {
    return addr.isZeroPage ? 'zeroPage' : 'absolute';
  }

  // ==========================================================================
  // Label Management
  // ==========================================================================

  /**
   * Generates a unique label name.
   *
   * @param prefix - Label prefix
   * @returns Unique label string
   */
  protected uniqueLabel(prefix: string): string {
    return `${prefix}_${this.labelCounter++}`;
  }

  /**
   * Formats a label for local use (prefixes with .).
   *
   * @param name - Label name
   * @returns Local label string
   */
  protected localLabel(name: string): string {
    return `.${name}`;
  }

  // ==========================================================================
  // Comment Helpers
  // ==========================================================================

  /**
   * Adds a comment if instruction has one.
   *
   * @param instr - The IL instruction
   */
  protected emitComment(instr: ILInstruction): void {
    if (instr.comment) {
      this.asm.comment(instr.comment);
    }
  }

  /**
   * Emits a section header comment.
   *
   * @param text - Header text
   */
  protected emitSectionHeader(text: string): void {
    this.asm.blank();
    this.asm.comment('=' .repeat(60));
    this.asm.comment(text);
    this.asm.comment('=' .repeat(60));
  }

  // ==========================================================================
  // Instruction Dispatch (to be overridden)
  // ==========================================================================

  /**
   * Generates code for a single IL instruction.
   *
   * Override this in subclasses to handle specific opcodes.
   *
   * @param instr - The IL instruction
   */
  protected generateInstruction(instr: ILInstruction): void {
    throw new Error(`Unhandled IL opcode: ${instr.opcode}`);
  }

  // ==========================================================================
  // Public API (to be implemented in final class)
  // ==========================================================================

  /**
   * Generates assembly for an IL program.
   *
   * @param program - The IL program
   * @returns ASM-IL program output
   */
  public generate(_program: ILProgram): AsmILProgram {
    throw new Error('generate() must be implemented in subclass');
  }
}