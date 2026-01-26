/**
 * IL Instructions
 *
 * This module defines all IL instruction types including:
 * - ILOpcode enum: All instruction opcodes
 * - ILMetadata interface: Metadata attached to instructions
 * - ILInstruction base class: Abstract base for all instructions
 * - Concrete instruction classes for each opcode category
 *
 * @module il/instructions
 */

import type { ILType } from './types.js';
import type { VirtualRegister, ILValue, ILLabel } from './values.js';
import type { SourceLocation } from '../ast/base.js';

// =============================================================================
// Task 1.4: IL Opcode Enum
// =============================================================================

/**
 * IL Instruction Opcodes
 *
 * Comprehensive enumeration of all IL instruction types.
 * Organized by category for clarity.
 */
export enum ILOpcode {
  // =========================================================================
  // Constants
  // =========================================================================

  /** Load a constant value into a register */
  CONST = 'CONST',

  /** Create an undefined value (for uninitialized variables) */
  UNDEF = 'UNDEF',

  // =========================================================================
  // Memory Operations
  // =========================================================================

  /** Load from a variable into a register */
  LOAD_VAR = 'LOAD_VAR',

  /** Store from a register to a variable */
  STORE_VAR = 'STORE_VAR',

  /** Load an array element into a register */
  LOAD_ARRAY = 'LOAD_ARRAY',

  /** Store a register value to an array element */
  STORE_ARRAY = 'STORE_ARRAY',

  /** Load a struct field into a register */
  LOAD_FIELD = 'LOAD_FIELD',

  /** Store a register value to a struct field */
  STORE_FIELD = 'STORE_FIELD',

  // =========================================================================
  // Arithmetic Operations
  // =========================================================================

  /** Addition: result = left + right */
  ADD = 'ADD',

  /** Subtraction: result = left - right */
  SUB = 'SUB',

  /** Multiplication: result = left * right */
  MUL = 'MUL',

  /** Division: result = left / right */
  DIV = 'DIV',

  /** Modulo: result = left % right */
  MOD = 'MOD',

  /** Unary negation: result = -operand */
  NEG = 'NEG',

  // =========================================================================
  // Bitwise Operations
  // =========================================================================

  /** Bitwise AND: result = left & right */
  AND = 'AND',

  /** Bitwise OR: result = left | right */
  OR = 'OR',

  /** Bitwise XOR: result = left ^ right */
  XOR = 'XOR',

  /** Bitwise NOT: result = ~operand */
  NOT = 'NOT',

  /** Shift left: result = left << right */
  SHL = 'SHL',

  /** Shift right: result = left >> right */
  SHR = 'SHR',

  // =========================================================================
  // Comparison Operations
  // =========================================================================

  /** Equal: result = (left == right) */
  CMP_EQ = 'CMP_EQ',

  /** Not equal: result = (left != right) */
  CMP_NE = 'CMP_NE',

  /** Less than: result = (left < right) */
  CMP_LT = 'CMP_LT',

  /** Less than or equal: result = (left <= right) */
  CMP_LE = 'CMP_LE',

  /** Greater than: result = (left > right) */
  CMP_GT = 'CMP_GT',

  /** Greater than or equal: result = (left >= right) */
  CMP_GE = 'CMP_GE',

  // =========================================================================
  // Logical Operations
  // =========================================================================

  /** Logical AND with short-circuit evaluation */
  LOGICAL_AND = 'LOGICAL_AND',

  /** Logical OR with short-circuit evaluation */
  LOGICAL_OR = 'LOGICAL_OR',

  /** Logical NOT: result = !operand */
  LOGICAL_NOT = 'LOGICAL_NOT',

  // =========================================================================
  // Type Conversion Operations
  // =========================================================================

  /** Zero-extend byte to word */
  ZERO_EXTEND = 'ZERO_EXTEND',

  /** Truncate word to byte */
  TRUNCATE = 'TRUNCATE',

  /** Convert bool to byte (0 or 1) */
  BOOL_TO_BYTE = 'BOOL_TO_BYTE',

  /** Convert byte to bool (0 = false, else true) */
  BYTE_TO_BOOL = 'BYTE_TO_BOOL',

  // =========================================================================
  // Control Flow Operations
  // =========================================================================

  /** Unconditional jump to label */
  JUMP = 'JUMP',

  /** Conditional branch: if (cond) goto then_label else goto else_label */
  BRANCH = 'BRANCH',

  /** Return a value from function */
  RETURN = 'RETURN',

  /** Return void from function */
  RETURN_VOID = 'RETURN_VOID',

  // =========================================================================
  // Function Call Operations
  // =========================================================================

  /** Call function with return value */
  CALL = 'CALL',

  /** Call function without return value (void) */
  CALL_VOID = 'CALL_VOID',

  /** Indirect call via function pointer */
  CALL_INDIRECT = 'CALL_INDIRECT',

  // =========================================================================
  // Intrinsic Operations
  // =========================================================================

  /** Read byte from memory address: result = peek(address) */
  INTRINSIC_PEEK = 'INTRINSIC_PEEK',

  /** Write byte to memory address: poke(address, value) */
  INTRINSIC_POKE = 'INTRINSIC_POKE',

  /** Read word from memory address: result = peekw(address) */
  INTRINSIC_PEEKW = 'INTRINSIC_PEEKW',

  /** Write word to memory address: pokew(address, value) */
  INTRINSIC_POKEW = 'INTRINSIC_POKEW',

  /** Get length of array/string */
  INTRINSIC_LENGTH = 'INTRINSIC_LENGTH',

  /** Get low byte of word: result = lo(value) */
  INTRINSIC_LO = 'INTRINSIC_LO',

  /** Get high byte of word: result = hi(value) */
  INTRINSIC_HI = 'INTRINSIC_HI',

  // =========================================================================
  // SSA Operations
  // =========================================================================

  /** Phi function for SSA: result = phi([v1, block1], [v2, block2], ...) */
  PHI = 'PHI',

  // =========================================================================
  // Hardware Access Operations
  // =========================================================================

  /** Read from hardware register */
  HARDWARE_READ = 'HARDWARE_READ',

  /** Write to hardware register */
  HARDWARE_WRITE = 'HARDWARE_WRITE',

  // =========================================================================
  // @map Struct Access Operations (v2.0)
  // =========================================================================

  /** Load from @map struct field */
  MAP_LOAD_FIELD = 'MAP_LOAD_FIELD',

  /** Store to @map struct field */
  MAP_STORE_FIELD = 'MAP_STORE_FIELD',

  /** Load from @map range (indexed) */
  MAP_LOAD_RANGE = 'MAP_LOAD_RANGE',

  /** Store to @map range (indexed) */
  MAP_STORE_RANGE = 'MAP_STORE_RANGE',

  // =========================================================================
  // Optimization Control Operations (v2.0)
  // =========================================================================

  /** Optimization barrier - prevents instruction reordering */
  OPT_BARRIER = 'OPT_BARRIER',

  /** Volatile read - cannot be eliminated or reordered */
  VOLATILE_READ = 'VOLATILE_READ',

  /** Volatile write - cannot be eliminated or reordered */
  VOLATILE_WRITE = 'VOLATILE_WRITE',

  // =========================================================================
  // CPU Instruction Intrinsics (v2.0)
  // =========================================================================

  /** Set interrupt disable flag */
  CPU_SEI = 'CPU_SEI',

  /** Clear interrupt disable flag */
  CPU_CLI = 'CPU_CLI',

  /** No operation */
  CPU_NOP = 'CPU_NOP',

  /** Break (software interrupt) */
  CPU_BRK = 'CPU_BRK',

  /** Push accumulator to stack */
  CPU_PHA = 'CPU_PHA',

  /** Pull accumulator from stack */
  CPU_PLA = 'CPU_PLA',

  /** Push processor status to stack */
  CPU_PHP = 'CPU_PHP',

  /** Pull processor status from stack */
  CPU_PLP = 'CPU_PLP',

  // =========================================================================
  // Address Operations
  // =========================================================================

  /**
   * Load the address of a symbol (variable or function).
   * Result is a 16-bit word containing the memory address.
   *
   * Operands:
   * - symbolName: string - Name of the symbol
   * - symbolKind: 'variable' | 'function' - Type of symbol
   *
   * Result: word (16-bit address)
   */
  LOAD_ADDRESS = 'LOAD_ADDRESS',
}

// =============================================================================
// Task 1.5: Instruction Base Classes
// =============================================================================

/**
 * Metadata attached to IL instructions.
 *
 * Preserves semantic analysis information and provides hints for optimization
 * and code generation. All fields are optional.
 */
export interface ILMetadata {
  /** Original source location for debugging and error messages */
  location?: SourceLocation;

  /** Addressing mode hint from semantic analysis (e.g., 'ZeroPage', 'Absolute') */
  addressingMode?: string;

  /** Expression complexity score from semantic analysis */
  complexity?: number;

  /** Register pressure estimate */
  registerPressure?: number;

  /** Type coercion information if this instruction involves type conversion */
  coercion?: {
    kind: string;
    sourceType: ILType;
    targetType: ILType;
  };

  /** 6502-specific optimization hints */
  m6502Hints?: {
    /** Preferred hardware register for this value */
    preferredRegister?: 'A' | 'X' | 'Y';
    /** Zero page priority (higher = more important to place in ZP) */
    zeroPagePriority?: number;
  };

  /** For VIC-II raster-critical code that must execute within timing constraints */
  rasterCritical?: boolean;

  /** Estimated cycle count for this instruction */
  estimatedCycles?: number;

  /** Loop nesting depth (0 = not in loop) */
  loopDepth?: number;

  /** Is this instruction loop-invariant (can be hoisted)? */
  isLoopInvariant?: boolean;

  /** Is this a good candidate for inlining? */
  inlineCandidate?: boolean;

  /** Execution frequency hint for optimization */
  executionFrequency?: 'hot' | 'cold' | 'normal';

  /** Original source expression string for debugging */
  sourceExpression?: string;

  /** @map struct information for hardware-mapped variables */
  mapInfo?: {
    /** Name of the @map struct type */
    structName: string;
    /** Field name being accessed */
    fieldName?: string;
    /** Base hardware address */
    baseAddress: number;
    /** Offset of field from base address */
    fieldOffset?: number;
    /** Is this a range access? */
    isRange?: boolean;
    /** Start of range */
    rangeStart?: number;
    /** End of range */
    rangeEnd?: number;
  };

  /** Live range start - instruction ID where value becomes live */
  liveRangeStart?: number;

  /** Live range end - instruction ID where value is last used */
  liveRangeEnd?: number;

  /** Additional custom metadata (extensible) */
  [key: string]: unknown;
}

/**
 * Set of opcodes that have side effects (cannot be eliminated if unused).
 *
 * Used by hasSideEffects() to determine if an instruction can be removed
 * during dead code elimination.
 */
const SIDE_EFFECT_OPCODES = new Set<ILOpcode>([
  ILOpcode.STORE_VAR,
  ILOpcode.STORE_ARRAY,
  ILOpcode.STORE_FIELD,
  ILOpcode.CALL,
  ILOpcode.CALL_VOID,
  ILOpcode.CALL_INDIRECT,
  ILOpcode.INTRINSIC_POKE,
  ILOpcode.INTRINSIC_POKEW,
  ILOpcode.HARDWARE_WRITE,
  ILOpcode.MAP_STORE_FIELD,
  ILOpcode.MAP_STORE_RANGE,
  ILOpcode.VOLATILE_WRITE,
  ILOpcode.OPT_BARRIER,
  ILOpcode.CPU_SEI,
  ILOpcode.CPU_CLI,
  ILOpcode.CPU_BRK,
  ILOpcode.CPU_PHA,
  ILOpcode.CPU_PHP,
  // v2.0.1: Added missing side-effect opcodes to prevent incorrect DCE
  ILOpcode.CPU_NOP, // Used for timing - must not be eliminated
  ILOpcode.CPU_PLA, // Modifies stack pointer - must stay paired with PHA
  ILOpcode.CPU_PLP, // Modifies processor flags and stack - must stay paired with PHP
]);

/**
 * Set of opcodes that are terminators (end a basic block).
 *
 * Used by isTerminator() to determine basic block boundaries.
 */
const TERMINATOR_OPCODES = new Set<ILOpcode>([
  ILOpcode.JUMP,
  ILOpcode.BRANCH,
  ILOpcode.RETURN,
  ILOpcode.RETURN_VOID,
]);

/**
 * Abstract base class for all IL instructions.
 *
 * Every IL instruction has:
 * - A unique ID within its function
 * - An opcode identifying the operation
 * - An optional result register
 * - Metadata from semantic analysis
 *
 * Subclasses implement specific instruction types with their operands.
 */
export abstract class ILInstruction {
  /**
   * Creates a new IL instruction.
   *
   * @param id - Unique instruction ID within the function
   * @param opcode - The operation this instruction performs
   * @param result - Result register (null for void instructions like stores)
   * @param metadata - Metadata from semantic analysis
   */
  constructor(
    public readonly id: number,
    public readonly opcode: ILOpcode,
    public readonly result: VirtualRegister | null,
    public readonly metadata: ILMetadata = {},
  ) {}

  /**
   * Gets all operand values used by this instruction.
   *
   * This includes all registers, constants, and labels that are inputs
   * to this instruction. Used for dataflow analysis.
   *
   * @returns Array of operand values
   */
  abstract getOperands(): ILValue[];

  /**
   * Gets all virtual registers used (read) by this instruction.
   *
   * Does not include the result register (if any).
   * Used for liveness analysis and register allocation.
   *
   * @returns Array of used registers
   */
  abstract getUsedRegisters(): VirtualRegister[];

  /**
   * Checks if this instruction has side effects.
   *
   * Instructions with side effects cannot be eliminated during
   * dead code elimination, even if their result is unused.
   *
   * @returns true if instruction has side effects
   */
  hasSideEffects(): boolean {
    return SIDE_EFFECT_OPCODES.has(this.opcode);
  }

  /**
   * Checks if this instruction is a terminator.
   *
   * Terminator instructions end a basic block and transfer control
   * to another block (or exit the function).
   *
   * @returns true if instruction is a terminator
   */
  isTerminator(): boolean {
    return TERMINATOR_OPCODES.has(this.opcode);
  }

  /**
   * Returns a string representation of this instruction for debugging.
   *
   * Format varies by instruction type but generally follows:
   * "result = OPCODE operands"
   *
   * @returns Human-readable instruction string
   */
  abstract toString(): string;
}

// =============================================================================
// Task 1.6: Arithmetic/Logic Instructions
// =============================================================================

/**
 * Binary instruction - two operands producing one result.
 *
 * Used for arithmetic, bitwise, comparison, and logical operations.
 * Format: result = left OP right
 *
 * @example
 * ```typescript
 * // v2 = ADD v0, v1
 * const add = new ILBinaryInstruction(0, ILOpcode.ADD, v0, v1, v2);
 *
 * // v3 = CMP_LT v0, v1
 * const cmp = new ILBinaryInstruction(1, ILOpcode.CMP_LT, v0, v1, v3);
 * ```
 */
export class ILBinaryInstruction extends ILInstruction {
  /**
   * Creates a binary instruction.
   *
   * @param id - Unique instruction ID
   * @param opcode - Binary operation (ADD, SUB, MUL, CMP_EQ, AND, etc.)
   * @param left - Left operand register
   * @param right - Right operand register
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly left: VirtualRegister,
    public readonly right: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.left, this.right];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.left, this.right];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = ${this.opcode} ${this.left}, ${this.right}`;
  }
}

/**
 * Unary instruction - one operand producing one result.
 *
 * Used for negation, bitwise NOT, and logical NOT.
 * Format: result = OP operand
 *
 * @example
 * ```typescript
 * // v1 = NEG v0
 * const neg = new ILUnaryInstruction(0, ILOpcode.NEG, v0, v1);
 *
 * // v2 = NOT v0
 * const not = new ILUnaryInstruction(1, ILOpcode.NOT, v0, v2);
 * ```
 */
export class ILUnaryInstruction extends ILInstruction {
  /**
   * Creates a unary instruction.
   *
   * @param id - Unique instruction ID
   * @param opcode - Unary operation (NEG, NOT, LOGICAL_NOT)
   * @param operand - Input operand register
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly operand: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.operand];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.operand];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = ${this.opcode} ${this.operand}`;
  }
}

/**
 * Constant load instruction - loads an immediate value into a register.
 *
 * Format: result = CONST value
 *
 * @example
 * ```typescript
 * // v0 = CONST 42
 * const const42 = new ILConstInstruction(0, 42, IL_BYTE, v0);
 *
 * // v1 = CONST 0x1000
 * const constAddr = new ILConstInstruction(1, 0x1000, IL_WORD, v1);
 * ```
 */
export class ILConstInstruction extends ILInstruction {
  /**
   * Creates a constant load instruction.
   *
   * @param id - Unique instruction ID
   * @param value - The constant numeric value
   * @param type - IL type of the constant
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly value: number,
    public readonly type: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CONST, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    // Format hex values nicely
    const valueStr =
      this.value >= 256 ? `$${this.value.toString(16).toUpperCase()}` : this.value.toString();
    return `${this.result} = CONST ${valueStr}`;
  }
}

/**
 * Undefined value instruction - creates an undefined/uninitialized value.
 *
 * Used for uninitialized variables in SSA form.
 * Format: result = UNDEF
 *
 * @example
 * ```typescript
 * // v0 = UNDEF (for uninitialized variable)
 * const undef = new ILUndefInstruction(0, IL_BYTE, v0);
 * ```
 */
export class ILUndefInstruction extends ILInstruction {
  /**
   * Creates an undefined value instruction.
   *
   * @param id - Unique instruction ID
   * @param type - IL type of the undefined value
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly type: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.UNDEF, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = UNDEF`;
  }
}

/**
 * Type conversion instruction - converts a value from one type to another.
 *
 * Used for zero-extend, truncate, and bool conversions.
 * Format: result = OPCODE source
 *
 * @example
 * ```typescript
 * // v1 = ZERO_EXTEND v0 (byte -> word)
 * const extend = new ILConvertInstruction(0, ILOpcode.ZERO_EXTEND, v0, IL_WORD, v1);
 *
 * // v2 = TRUNCATE v1 (word -> byte)
 * const trunc = new ILConvertInstruction(1, ILOpcode.TRUNCATE, v1, IL_BYTE, v2);
 * ```
 */
export class ILConvertInstruction extends ILInstruction {
  /**
   * Creates a type conversion instruction.
   *
   * @param id - Unique instruction ID
   * @param opcode - Conversion operation (ZERO_EXTEND, TRUNCATE, BOOL_TO_BYTE, BYTE_TO_BOOL)
   * @param source - Source register to convert
   * @param targetType - Target IL type
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    opcode: ILOpcode,
    public readonly source: VirtualRegister,
    public readonly targetType: ILType,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.source];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.source];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = ${this.opcode} ${this.source}`;
  }
}

// =============================================================================
// Task 1.7: Control Flow Instructions
// =============================================================================

/**
 * Unconditional jump instruction - transfers control to a target block.
 *
 * This is a terminator instruction that ends the current basic block.
 * Format: JUMP target
 *
 * @example
 * ```typescript
 * // JUMP loop_start
 * const jump = new ILJumpInstruction(0, loopStartLabel);
 * ```
 */
export class ILJumpInstruction extends ILInstruction {
  /**
   * Creates an unconditional jump instruction.
   *
   * @param id - Unique instruction ID
   * @param target - Label to jump to
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly target: ILLabel,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.JUMP, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.target];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /**
   * Gets the target block ID.
   *
   * @returns Block ID this jump targets
   */
  getTargetBlockId(): number {
    return this.target.blockId;
  }

  /** @inheritdoc */
  toString(): string {
    return `JUMP ${this.target.name}`;
  }
}

/**
 * Conditional branch instruction - transfers control based on a condition.
 *
 * This is a terminator instruction that ends the current basic block.
 * Format: BRANCH condition, thenLabel, elseLabel
 *
 * @example
 * ```typescript
 * // BRANCH v0, if_true, if_false
 * const branch = new ILBranchInstruction(0, condReg, thenLabel, elseLabel);
 * ```
 */
export class ILBranchInstruction extends ILInstruction {
  /**
   * Creates a conditional branch instruction.
   *
   * @param id - Unique instruction ID
   * @param condition - Register containing the condition (0 = false, else true)
   * @param thenTarget - Label to jump to if condition is true
   * @param elseTarget - Label to jump to if condition is false
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly condition: VirtualRegister,
    public readonly thenTarget: ILLabel,
    public readonly elseTarget: ILLabel,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.BRANCH, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.condition, this.thenTarget, this.elseTarget];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.condition];
  }

  /**
   * Gets the block ID for the "then" branch.
   *
   * @returns Block ID for true condition
   */
  getThenBlockId(): number {
    return this.thenTarget.blockId;
  }

  /**
   * Gets the block ID for the "else" branch.
   *
   * @returns Block ID for false condition
   */
  getElseBlockId(): number {
    return this.elseTarget.blockId;
  }

  /**
   * Gets all successor block IDs.
   *
   * @returns Array of successor block IDs
   */
  getSuccessorBlockIds(): number[] {
    return [this.thenTarget.blockId, this.elseTarget.blockId];
  }

  /** @inheritdoc */
  toString(): string {
    return `BRANCH ${this.condition}, ${this.thenTarget.name}, ${this.elseTarget.name}`;
  }
}

/**
 * Return instruction - returns a value from a function.
 *
 * This is a terminator instruction that ends the current basic block
 * and exits the function.
 * Format: RETURN value
 *
 * @example
 * ```typescript
 * // RETURN v0
 * const ret = new ILReturnInstruction(0, valueReg);
 * ```
 */
export class ILReturnInstruction extends ILInstruction {
  /**
   * Creates a return instruction with a value.
   *
   * @param id - Unique instruction ID
   * @param value - Register containing the return value
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.RETURN, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `RETURN ${this.value}`;
  }
}

/**
 * Return void instruction - returns from a void function.
 *
 * This is a terminator instruction that ends the current basic block
 * and exits the function without returning a value.
 * Format: RETURN_VOID
 *
 * @example
 * ```typescript
 * // RETURN_VOID
 * const ret = new ILReturnVoidInstruction(0);
 * ```
 */
export class ILReturnVoidInstruction extends ILInstruction {
  /**
   * Creates a return void instruction.
   *
   * @param id - Unique instruction ID
   * @param metadata - Optional metadata
   */
  constructor(id: number, metadata: ILMetadata = {}) {
    super(id, ILOpcode.RETURN_VOID, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return 'RETURN_VOID';
  }
}

// =============================================================================
// Task 1.8: Memory & Call Instructions
// =============================================================================

/**
 * Load variable instruction - loads a variable's value into a register.
 *
 * Format: result = LOAD_VAR varName
 *
 * @example
 * ```typescript
 * // v0 = LOAD_VAR counter
 * const load = new ILLoadVarInstruction(0, 'counter', v0);
 * ```
 */
export class ILLoadVarInstruction extends ILInstruction {
  /**
   * Creates a load variable instruction.
   *
   * @param id - Unique instruction ID
   * @param variableName - Name of the variable to load
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly variableName: string,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.LOAD_VAR, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = LOAD_VAR ${this.variableName}`;
  }
}

/**
 * Store variable instruction - stores a register value into a variable.
 *
 * Format: STORE_VAR varName, value
 *
 * @example
 * ```typescript
 * // STORE_VAR counter, v0
 * const store = new ILStoreVarInstruction(0, 'counter', v0);
 * ```
 */
export class ILStoreVarInstruction extends ILInstruction {
  /**
   * Creates a store variable instruction.
   *
   * @param id - Unique instruction ID
   * @param variableName - Name of the variable to store to
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly variableName: string,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.STORE_VAR, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `STORE_VAR ${this.variableName}, ${this.value}`;
  }
}

/**
 * Load array element instruction - loads an array element into a register.
 *
 * Format: result = LOAD_ARRAY arrayName, index
 *
 * @example
 * ```typescript
 * // v1 = LOAD_ARRAY buffer, v0
 * const load = new ILLoadArrayInstruction(0, 'buffer', v0, v1);
 * ```
 */
export class ILLoadArrayInstruction extends ILInstruction {
  /**
   * Creates a load array element instruction.
   *
   * @param id - Unique instruction ID
   * @param arrayName - Name of the array
   * @param index - Register containing the index
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly arrayName: string,
    public readonly index: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.LOAD_ARRAY, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.index];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.index];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = LOAD_ARRAY ${this.arrayName}, ${this.index}`;
  }
}

/**
 * Store array element instruction - stores a value into an array element.
 *
 * Format: STORE_ARRAY arrayName, index, value
 *
 * @example
 * ```typescript
 * // STORE_ARRAY buffer, v0, v1
 * const store = new ILStoreArrayInstruction(0, 'buffer', v0, v1);
 * ```
 */
export class ILStoreArrayInstruction extends ILInstruction {
  /**
   * Creates a store array element instruction.
   *
   * @param id - Unique instruction ID
   * @param arrayName - Name of the array
   * @param index - Register containing the index
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly arrayName: string,
    public readonly index: VirtualRegister,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.STORE_ARRAY, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.index, this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.index, this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `STORE_ARRAY ${this.arrayName}, ${this.index}, ${this.value}`;
  }
}

/**
 * Function call instruction - calls a function and captures the return value.
 *
 * Format: result = CALL funcName, [arg1, arg2, ...]
 *
 * @example
 * ```typescript
 * // v2 = CALL add, [v0, v1]
 * const call = new ILCallInstruction(0, 'add', [v0, v1], v2);
 * ```
 */
export class ILCallInstruction extends ILInstruction {
  /**
   * Creates a function call instruction.
   *
   * @param id - Unique instruction ID
   * @param functionName - Name of the function to call
   * @param args - Array of registers containing arguments
   * @param result - Result register for return value
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly functionName: string,
    public readonly args: readonly VirtualRegister[],
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CALL, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [...this.args];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [...this.args];
  }

  /** @inheritdoc */
  toString(): string {
    const argsStr = this.args.map((a) => a.toString()).join(', ');
    return `${this.result} = CALL ${this.functionName}, [${argsStr}]`;
  }
}

/**
 * Void function call instruction - calls a function without capturing return value.
 *
 * Format: CALL_VOID funcName, [arg1, arg2, ...]
 *
 * @example
 * ```typescript
 * // CALL_VOID printChar, [v0]
 * const call = new ILCallVoidInstruction(0, 'printChar', [v0]);
 * ```
 */
export class ILCallVoidInstruction extends ILInstruction {
  /**
   * Creates a void function call instruction.
   *
   * @param id - Unique instruction ID
   * @param functionName - Name of the function to call
   * @param args - Array of registers containing arguments
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly functionName: string,
    public readonly args: readonly VirtualRegister[],
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.CALL_VOID, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [...this.args];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [...this.args];
  }

  /** @inheritdoc */
  toString(): string {
    const argsStr = this.args.map((a) => a.toString()).join(', ');
    return `CALL_VOID ${this.functionName}, [${argsStr}]`;
  }
}

/**
 * Phi instruction - SSA phi function for merging values from different paths.
 *
 * A phi instruction is placed at the beginning of a basic block that has
 * multiple predecessors. It selects a value based on which predecessor
 * block was executed before reaching this block.
 *
 * Format: result = PHI [(v1, block1), (v2, block2), ...]
 *
 * @example
 * ```typescript
 * // v2 = PHI [(v0, block0), (v1, block1)]
 * const phi = new ILPhiInstruction(0, [
 *   { value: v0, blockId: 0 },
 *   { value: v1, blockId: 1 },
 * ], v2);
 * ```
 */
export class ILPhiInstruction extends ILInstruction {
  /**
   * Creates a phi instruction.
   *
   * @param id - Unique instruction ID
   * @param sources - Array of value/block pairs
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly sources: readonly { value: VirtualRegister; blockId: number }[],
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.PHI, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return this.sources.map((s) => s.value);
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return this.sources.map((s) => s.value);
  }

  /**
   * Gets the value for a specific predecessor block.
   *
   * @param blockId - Block ID to look up
   * @returns The register for that block, or undefined if not found
   */
  getValueForBlock(blockId: number): VirtualRegister | undefined {
    const source = this.sources.find((s) => s.blockId === blockId);
    return source?.value;
  }

  /**
   * Gets all predecessor block IDs.
   *
   * @returns Array of block IDs that this phi references
   */
  getPredecessorBlockIds(): number[] {
    return this.sources.map((s) => s.blockId);
  }

  /** @inheritdoc */
  toString(): string {
    const sourcesStr = this.sources.map((s) => `(${s.value}, block${s.blockId})`).join(', ');
    return `${this.result} = PHI [${sourcesStr}]`;
  }
}

/**
 * Intrinsic peek instruction - reads a byte from a memory address.
 *
 * Format: result = INTRINSIC_PEEK address
 *
 * @example
 * ```typescript
 * // v1 = INTRINSIC_PEEK v0 (read byte from address in v0)
 * const peek = new ILPeekInstruction(0, v0, v1);
 * ```
 */
export class ILPeekInstruction extends ILInstruction {
  /**
   * Creates a peek instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to read from
   * @param result - Result register for the byte read
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_PEEK, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = INTRINSIC_PEEK ${this.address}`;
  }
}

/**
 * Intrinsic poke instruction - writes a byte to a memory address.
 *
 * Format: INTRINSIC_POKE address, value
 *
 * @example
 * ```typescript
 * // INTRINSIC_POKE v0, v1 (write v1 to address in v0)
 * const poke = new ILPokeInstruction(0, v0, v1);
 * ```
 */
export class ILPokeInstruction extends ILInstruction {
  /**
   * Creates a poke instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to write to
   * @param value - Register containing the byte value to write
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_POKE, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `INTRINSIC_POKE ${this.address}, ${this.value}`;
  }
}

/**
 * Hardware read instruction - reads from a hardware register.
 *
 * Format: result = HARDWARE_READ $address
 *
 * @example
 * ```typescript
 * // v0 = HARDWARE_READ $D020 (read border color)
 * const read = new ILHardwareReadInstruction(0, 0xD020, v0);
 * ```
 */
export class ILHardwareReadInstruction extends ILInstruction {
  /**
   * Creates a hardware read instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Hardware address to read from (constant)
   * @param result - Result register for the value read
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: number,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.HARDWARE_READ, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = HARDWARE_READ $${this.address.toString(16).toUpperCase()}`;
  }
}

/**
 * Hardware write instruction - writes to a hardware register.
 *
 * Format: HARDWARE_WRITE $address, value
 *
 * @example
 * ```typescript
 * // HARDWARE_WRITE $D020, v0 (set border color)
 * const write = new ILHardwareWriteInstruction(0, 0xD020, v0);
 * ```
 */
export class ILHardwareWriteInstruction extends ILInstruction {
  /**
   * Creates a hardware write instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Hardware address to write to (constant)
   * @param value - Register containing the value to write
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: number,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.HARDWARE_WRITE, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `HARDWARE_WRITE $${this.address.toString(16).toUpperCase()}, ${this.value}`;
  }
}

/**
 * Optimization barrier instruction - prevents instruction reordering.
 *
 * This instruction has no effect at runtime but prevents the optimizer
 * from moving instructions across it. Used for timing-critical code.
 *
 * Format: OPT_BARRIER
 */
export class ILOptBarrierInstruction extends ILInstruction {
  /**
   * Creates an optimization barrier instruction.
   *
   * @param id - Unique instruction ID
   * @param metadata - Optional metadata
   */
  constructor(id: number, metadata: ILMetadata = {}) {
    super(id, ILOpcode.OPT_BARRIER, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return 'OPT_BARRIER';
  }
}

// =============================================================================
// Additional Intrinsic Instructions (Phase 5)
// =============================================================================

/**
 * Intrinsic peekw instruction - reads a 16-bit word from a memory address.
 *
 * Format: result = INTRINSIC_PEEKW address
 *
 * Reads two bytes from memory in little-endian order.
 *
 * @example
 * ```typescript
 * // v1 = INTRINSIC_PEEKW v0 (read word from address in v0)
 * const peekw = new ILPeekwInstruction(0, v0, v1);
 * ```
 */
export class ILPeekwInstruction extends ILInstruction {
  /**
   * Creates a peekw instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to read from
   * @param result - Result register for the word read
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_PEEKW, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = INTRINSIC_PEEKW ${this.address}`;
  }
}

/**
 * Intrinsic pokew instruction - writes a 16-bit word to a memory address.
 *
 * Format: INTRINSIC_POKEW address, value
 *
 * Writes two bytes to memory in little-endian order.
 *
 * @example
 * ```typescript
 * // INTRINSIC_POKEW v0, v1 (write word v1 to address in v0)
 * const pokew = new ILPokewInstruction(0, v0, v1);
 * ```
 */
export class ILPokewInstruction extends ILInstruction {
  /**
   * Creates a pokew instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to write to
   * @param value - Register containing the word value to write
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_POKEW, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `INTRINSIC_POKEW ${this.address}, ${this.value}`;
  }
}

/**
 * Intrinsic length instruction - gets the length of an array or string.
 *
 * Format: result = INTRINSIC_LENGTH arrayName
 *
 * @example
 * ```typescript
 * // v0 = INTRINSIC_LENGTH buffer
 * const len = new ILLengthInstruction(0, 'buffer', v0);
 * ```
 */
export class ILLengthInstruction extends ILInstruction {
  /**
   * Creates a length instruction.
   *
   * @param id - Unique instruction ID
   * @param arrayName - Name of the array to get length of
   * @param result - Result register for the length
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly arrayName: string,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_LENGTH, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = INTRINSIC_LENGTH ${this.arrayName}`;
  }
}

/**
 * Intrinsic lo instruction - extracts the low byte of a word.
 *
 * Format: result = INTRINSIC_LO source
 *
 * @example
 * ```typescript
 * // v1 = INTRINSIC_LO v0 (low byte of word in v0)
 * const lo = new ILLoInstruction(0, v0, v1);
 * ```
 */
export class ILLoInstruction extends ILInstruction {
  /**
   * Creates a lo instruction.
   *
   * @param id - Unique instruction ID
   * @param source - Register containing the word
   * @param result - Result register for the low byte
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly source: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_LO, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.source];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.source];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = INTRINSIC_LO ${this.source}`;
  }
}

/**
 * Intrinsic hi instruction - extracts the high byte of a word.
 *
 * Format: result = INTRINSIC_HI source
 *
 * @example
 * ```typescript
 * // v1 = INTRINSIC_HI v0 (high byte of word in v0)
 * const hi = new ILHiInstruction(0, v0, v1);
 * ```
 */
export class ILHiInstruction extends ILInstruction {
  /**
   * Creates a hi instruction.
   *
   * @param id - Unique instruction ID
   * @param source - Register containing the word
   * @param result - Result register for the high byte
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly source: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.INTRINSIC_HI, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.source];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.source];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = INTRINSIC_HI ${this.source}`;
  }
}

/**
 * Volatile read instruction - reads from memory with volatile semantics.
 *
 * Cannot be eliminated or reordered by the optimizer.
 * Used for hardware registers and timing-critical code.
 *
 * Format: result = VOLATILE_READ address
 *
 * @example
 * ```typescript
 * // v1 = VOLATILE_READ v0
 * const vread = new ILVolatileReadInstruction(0, v0, v1);
 * ```
 */
export class ILVolatileReadInstruction extends ILInstruction {
  /**
   * Creates a volatile read instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to read from
   * @param result - Result register for the byte read
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.VOLATILE_READ, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address];
  }

  /**
   * Volatile reads have side effects to prevent elimination.
   */
  override hasSideEffects(): boolean {
    return true;
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = VOLATILE_READ ${this.address}`;
  }
}

/**
 * Volatile write instruction - writes to memory with volatile semantics.
 *
 * Cannot be eliminated or reordered by the optimizer.
 * Used for hardware registers and timing-critical code.
 *
 * Format: VOLATILE_WRITE address, value
 *
 * @example
 * ```typescript
 * // VOLATILE_WRITE v0, v1
 * const vwrite = new ILVolatileWriteInstruction(0, v0, v1);
 * ```
 */
export class ILVolatileWriteInstruction extends ILInstruction {
  /**
   * Creates a volatile write instruction.
   *
   * @param id - Unique instruction ID
   * @param address - Register containing the address to write to
   * @param value - Register containing the value to write
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly address: VirtualRegister,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.VOLATILE_WRITE, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.address, this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `VOLATILE_WRITE ${this.address}, ${this.value}`;
  }
}

// =============================================================================
// CPU Instruction Intrinsics (Phase 5)
// =============================================================================

/**
 * CPU instruction - maps directly to a 6502 instruction.
 *
 * These instructions cannot be eliminated or reordered.
 * Used for interrupt control, timing, and stack operations.
 *
 * Supported opcodes:
 * - CPU_SEI: Set interrupt disable (2 cycles)
 * - CPU_CLI: Clear interrupt disable (2 cycles)
 * - CPU_NOP: No operation (2 cycles)
 * - CPU_BRK: Software interrupt (7 cycles)
 * - CPU_PHA: Push accumulator (3 cycles)
 * - CPU_PLA: Pull accumulator (4 cycles)
 * - CPU_PHP: Push processor status (3 cycles)
 * - CPU_PLP: Pull processor status (4 cycles)
 *
 * @example
 * ```typescript
 * // CPU_SEI (disable interrupts)
 * const sei = new ILCpuInstruction(0, ILOpcode.CPU_SEI);
 *
 * // CPU_PLA (pull accumulator from stack)
 * const pla = new ILCpuInstruction(1, ILOpcode.CPU_PLA, v0);
 * ```
 */
export class ILCpuInstruction extends ILInstruction {
  /**
   * Cycle counts for each CPU instruction.
   */
  protected static readonly CYCLE_COUNTS: Record<string, number> = {
    [ILOpcode.CPU_SEI]: 2,
    [ILOpcode.CPU_CLI]: 2,
    [ILOpcode.CPU_NOP]: 2,
    [ILOpcode.CPU_BRK]: 7,
    [ILOpcode.CPU_PHA]: 3,
    [ILOpcode.CPU_PLA]: 4,
    [ILOpcode.CPU_PHP]: 3,
    [ILOpcode.CPU_PLP]: 4,
  };

  /**
   * Creates a CPU instruction.
   *
   * @param id - Unique instruction ID
   * @param opcode - CPU instruction opcode
   * @param result - Result register (only for PLA)
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    opcode: ILOpcode,
    result: VirtualRegister | null = null,
    metadata: ILMetadata = {},
  ) {
    super(id, opcode, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /**
   * Gets the cycle count for this CPU instruction.
   *
   * @returns Number of 6502 cycles
   */
  getCycleCount(): number {
    return ILCpuInstruction.CYCLE_COUNTS[this.opcode] ?? 2;
  }

  /** @inheritdoc */
  toString(): string {
    if (this.result) {
      return `${this.result} = ${this.opcode}`;
    }
    return this.opcode;
  }
}

// =============================================================================
// @map Struct Access Instructions (Phase 5)
// =============================================================================

/**
 * Load from @map struct field instruction.
 *
 * Format: result = MAP_LOAD_FIELD structName.fieldName
 *
 * Used for accessing fields of memory-mapped hardware structs.
 *
 * @example
 * ```typescript
 * // v0 = MAP_LOAD_FIELD vic.borderColor
 * const load = new ILMapLoadFieldInstruction(0, 'vic', 'borderColor', 0xD020, v0);
 * ```
 */
export class ILMapLoadFieldInstruction extends ILInstruction {
  /**
   * Creates a map load field instruction.
   *
   * @param id - Unique instruction ID
   * @param structName - Name of the @map struct
   * @param fieldName - Name of the field to load
   * @param address - Absolute hardware address of the field
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly structName: string,
    public readonly fieldName: string,
    public readonly address: number,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_LOAD_FIELD, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = MAP_LOAD_FIELD ${this.structName}.${this.fieldName} ($${this.address.toString(16).toUpperCase()})`;
  }
}

/**
 * Store to @map struct field instruction.
 *
 * Format: MAP_STORE_FIELD structName.fieldName, value
 *
 * Used for writing to fields of memory-mapped hardware structs.
 *
 * @example
 * ```typescript
 * // MAP_STORE_FIELD vic.borderColor, v0
 * const store = new ILMapStoreFieldInstruction(0, 'vic', 'borderColor', 0xD020, v0);
 * ```
 */
export class ILMapStoreFieldInstruction extends ILInstruction {
  /**
   * Creates a map store field instruction.
   *
   * @param id - Unique instruction ID
   * @param structName - Name of the @map struct
   * @param fieldName - Name of the field to store to
   * @param address - Absolute hardware address of the field
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly structName: string,
    public readonly fieldName: string,
    public readonly address: number,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_STORE_FIELD, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `MAP_STORE_FIELD ${this.structName}.${this.fieldName} ($${this.address.toString(16).toUpperCase()}), ${this.value}`;
  }
}

/**
 * Load from @map range instruction.
 *
 * Format: result = MAP_LOAD_RANGE structName[index]
 *
 * Used for indexed access to memory-mapped ranges (e.g., sprite positions).
 *
 * @example
 * ```typescript
 * // v1 = MAP_LOAD_RANGE spriteX, v0
 * const load = new ILMapLoadRangeInstruction(0, 'spriteX', 0xD000, 0xD007, v0, v1);
 * ```
 */
export class ILMapLoadRangeInstruction extends ILInstruction {
  /**
   * Creates a map load range instruction.
   *
   * @param id - Unique instruction ID
   * @param rangeName - Name of the @map range
   * @param baseAddress - Base hardware address of the range
   * @param endAddress - End hardware address of the range
   * @param index - Register containing the index
   * @param result - Result register
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly rangeName: string,
    public readonly baseAddress: number,
    public readonly endAddress: number,
    public readonly index: VirtualRegister,
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_LOAD_RANGE, result, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.index];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.index];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = MAP_LOAD_RANGE ${this.rangeName}[${this.index}] ($${this.baseAddress.toString(16).toUpperCase()}-$${this.endAddress.toString(16).toUpperCase()})`;
  }
}

/**
 * Store to @map range instruction.
 *
 * Format: MAP_STORE_RANGE structName[index], value
 *
 * Used for indexed writes to memory-mapped ranges (e.g., sprite positions).
 *
 * @example
 * ```typescript
 * // MAP_STORE_RANGE spriteX, v0, v1
 * const store = new ILMapStoreRangeInstruction(0, 'spriteX', 0xD000, 0xD007, v0, v1);
 * ```
 */
export class ILMapStoreRangeInstruction extends ILInstruction {
  /**
   * Creates a map store range instruction.
   *
   * @param id - Unique instruction ID
   * @param rangeName - Name of the @map range
   * @param baseAddress - Base hardware address of the range
   * @param endAddress - End hardware address of the range
   * @param index - Register containing the index
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  constructor(
    id: number,
    public readonly rangeName: string,
    public readonly baseAddress: number,
    public readonly endAddress: number,
    public readonly index: VirtualRegister,
    public readonly value: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.MAP_STORE_RANGE, null, metadata);
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    return [this.index, this.value];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    return [this.index, this.value];
  }

  /** @inheritdoc */
  toString(): string {
    return `MAP_STORE_RANGE ${this.rangeName}[${this.index}] ($${this.baseAddress.toString(16).toUpperCase()}-$${this.endAddress.toString(16).toUpperCase()}), ${this.value}`;
  }
}

// =============================================================================
// Address-of Operator Instructions
// =============================================================================

/**
 * Load address instruction - loads the memory address of a symbol.
 *
 * This instruction is used to implement the address-of operator (`@`) in Blend.
 * It loads the 16-bit memory address of a variable or function into a register.
 *
 * Format: result = LOAD_ADDRESS "symbolName" (symbolKind)
 *
 * The result is always a 16-bit word containing the memory address.
 *
 * @example
 * ```typescript
 * // For: let addr = @myVar
 * // v0 = LOAD_ADDRESS "myVar" (variable)
 * const loadAddr = new ILLoadAddressInstruction(0, 'myVar', 'variable', v0);
 *
 * // For: let funcAddr = @myFunc
 * // v1 = LOAD_ADDRESS "myFunc" (function)
 * const loadFuncAddr = new ILLoadAddressInstruction(1, 'myFunc', 'function', v1);
 * ```
 */
export class ILLoadAddressInstruction extends ILInstruction {
  /**
   * Creates a LOAD_ADDRESS instruction.
   *
   * @param id - Unique instruction ID within the function
   * @param symbolName - The name of the symbol whose address to load
   * @param symbolKind - Whether this is a 'variable' or 'function'
   * @param result - The register to store the 16-bit address
   * @param metadata - Optional metadata for diagnostics and optimization
   */
  constructor(
    id: number,
    protected readonly symbolName: string,
    protected readonly symbolKind: 'variable' | 'function',
    result: VirtualRegister,
    metadata: ILMetadata = {},
  ) {
    super(id, ILOpcode.LOAD_ADDRESS, result, metadata);
  }

  /**
   * Gets the symbol name whose address is being loaded.
   *
   * @returns The name of the variable or function
   */
  getSymbolName(): string {
    return this.symbolName;
  }

  /**
   * Gets the kind of symbol (variable or function).
   *
   * @returns 'variable' or 'function'
   */
  getSymbolKind(): 'variable' | 'function' {
    return this.symbolKind;
  }

  /** @inheritdoc */
  getOperands(): ILValue[] {
    // No register operands - symbol name is a compile-time constant
    return [];
  }

  /** @inheritdoc */
  getUsedRegisters(): VirtualRegister[] {
    // No registers are read by this instruction
    return [];
  }

  /** @inheritdoc */
  toString(): string {
    return `${this.result} = LOAD_ADDRESS "${this.symbolName}" (${this.symbolKind})`;
  }

  /**
   * Creates a copy of this instruction with a new result register.
   *
   * Used during SSA construction and register allocation.
   *
   * @param result - The new result register
   * @returns A new ILLoadAddressInstruction with the same operands but new result
   */
  withResult(result: VirtualRegister): ILLoadAddressInstruction {
    return new ILLoadAddressInstruction(
      this.id,
      this.symbolName,
      this.symbolKind,
      result,
      this.metadata,
    );
  }
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an instruction is a LoadAddressInstruction.
 *
 * @param instr - The instruction to check
 * @returns true if the instruction is an ILLoadAddressInstruction
 *
 * @example
 * ```typescript
 * if (isLoadAddressInstruction(instr)) {
 *   const symbolName = instr.getSymbolName();
 *   const kind = instr.getSymbolKind();
 * }
 * ```
 */
export function isLoadAddressInstruction(
  instr: ILInstruction,
): instr is ILLoadAddressInstruction {
  return instr.opcode === ILOpcode.LOAD_ADDRESS;
}