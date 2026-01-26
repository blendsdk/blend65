/**
 * IL Builder - fluent API for constructing IL instructions
 *
 * Provides a convenient interface for emitting IL instructions while
 * managing the current function, block, and instruction context.
 *
 * @module il/builder
 */

import { BasicBlock } from './basic-block.js';
import { ILFunction, type ILParameter } from './function.js';
import { ILModule } from './module.js';
import type { ILType } from './types.js';
import { IL_VOID, IL_BYTE, IL_WORD, IL_BOOL } from './types.js';
import { VirtualRegister, type ILLabel, ILValueFactory } from './values.js';
import {
  ILOpcode,
  type ILMetadata,
  ILBinaryInstruction,
  ILUnaryInstruction,
  ILConstInstruction,
  ILUndefInstruction,
  ILConvertInstruction,
  ILJumpInstruction,
  ILBranchInstruction,
  ILReturnInstruction,
  ILReturnVoidInstruction,
  ILLoadVarInstruction,
  ILStoreVarInstruction,
  ILLoadArrayInstruction,
  ILStoreArrayInstruction,
  ILCallInstruction,
  ILCallVoidInstruction,
  ILPhiInstruction,
  ILPeekInstruction,
  ILPokeInstruction,
  ILHardwareReadInstruction,
  ILHardwareWriteInstruction,
  ILOptBarrierInstruction,
  // Phase 5 additions
  ILPeekwInstruction,
  ILPokewInstruction,
  ILLengthInstruction,
  ILLoInstruction,
  ILHiInstruction,
  ILVolatileReadInstruction,
  ILVolatileWriteInstruction,
  ILCpuInstruction,
  ILMapLoadFieldInstruction,
  ILMapStoreFieldInstruction,
  ILMapLoadRangeInstruction,
  ILMapStoreRangeInstruction,
  // Address-of instruction
  ILLoadAddressInstruction,
} from './instructions.js';

/**
 * Builder for constructing IL functions and instructions.
 *
 * The builder maintains context about the current function and block,
 * automatically managing instruction and register IDs.
 *
 * @example
 * ```typescript
 * const module = new ILModule('test');
 * const builder = new ILBuilder(module);
 *
 * // Create a function
 * builder.beginFunction('add', [
 *   { name: 'a', type: IL_BYTE },
 *   { name: 'b', type: IL_BYTE },
 * ], IL_BYTE);
 *
 * // Emit instructions
 * const a = builder.getParameterRegister(0)!;
 * const b = builder.getParameterRegister(1)!;
 * const result = builder.emitAdd(a, b);
 * builder.emitReturn(result);
 *
 * // Finish the function
 * builder.endFunction();
 * ```
 */
export class ILBuilder {
  /** Current function being built */
  protected currentFunction: ILFunction | null = null;

  /** Current basic block for instruction emission */
  protected currentBlock: BasicBlock | null = null;

  /** Next instruction ID for the current function */
  protected nextInstructionId = 0;

  /** Label factory for the current function */
  protected labelFactory: ILValueFactory | null = null;

  /**
   * Creates a new IL builder.
   *
   * @param module - The module to build functions into
   */
  constructor(protected readonly module: ILModule) {}

  // ===========================================================================
  // Module Access
  // ===========================================================================

  /**
   * Gets the module being built.
   *
   * @returns The module
   */
  getModule(): ILModule {
    return this.module;
  }

  // ===========================================================================
  // Function Management
  // ===========================================================================

  /**
   * Begins building a new function.
   *
   * @param name - Function name
   * @param parameters - Function parameters
   * @param returnType - Return type
   * @returns The new function
   */
  beginFunction(
    name: string,
    parameters: ILParameter[],
    returnType: ILType = IL_VOID,
  ): ILFunction {
    if (this.currentFunction) {
      throw new Error(
        `Cannot begin function '${name}': still building function '${this.currentFunction.name}'`,
      );
    }

    const func = this.module.createFunction(name, parameters, returnType);
    this.currentFunction = func;
    this.currentBlock = func.getEntryBlock();
    this.nextInstructionId = 0;
    this.labelFactory = new ILValueFactory();

    return func;
  }

  /**
   * Ends the current function.
   *
   * @returns The completed function
   */
  endFunction(): ILFunction {
    if (!this.currentFunction) {
      throw new Error('Cannot end function: no function being built');
    }

    const func = this.currentFunction;
    this.currentFunction = null;
    this.currentBlock = null;
    this.nextInstructionId = 0;
    this.labelFactory = null;

    return func;
  }

  /**
   * Enters an existing function for instruction emission.
   *
   * Unlike beginFunction() which creates a new function, this method
   * sets up the builder to emit instructions into an existing function
   * that was created separately (e.g., via module.createFunction() or
   * during a stub creation phase).
   *
   * @param func - The existing function to enter
   * @returns The function being entered
   */
  enterFunction(func: ILFunction): ILFunction {
    if (this.currentFunction) {
      throw new Error(
        `Cannot enter function '${func.name}': still building function '${this.currentFunction.name}'`,
      );
    }

    this.currentFunction = func;
    this.currentBlock = func.getEntryBlock();
    this.nextInstructionId = func.getNextInstructionId();
    this.labelFactory = new ILValueFactory();

    return func;
  }

  /**
   * Exits the current function without returning it.
   *
   * Use this instead of endFunction() when you entered an existing function
   * via enterFunction() and want to clear the builder state.
   */
  exitFunction(): void {
    this.currentFunction = null;
    this.currentBlock = null;
    this.nextInstructionId = 0;
    this.labelFactory = null;
  }

  /**
   * Gets the current function.
   *
   * @returns The current function, or null if none
   */
  getCurrentFunction(): ILFunction | null {
    return this.currentFunction;
  }

  /**
   * Ensures a function is being built.
   *
   * @returns The current function
   * @throws Error if no function is being built
   */
  protected requireFunction(): ILFunction {
    if (!this.currentFunction) {
      throw new Error('No function being built');
    }
    return this.currentFunction;
  }

  // ===========================================================================
  // Block Management
  // ===========================================================================

  /**
   * Creates a new basic block.
   *
   * @param label - Block label
   * @returns The new block
   */
  createBlock(label: string): BasicBlock {
    return this.requireFunction().createBlock(label);
  }

  /**
   * Sets the current block for instruction emission.
   *
   * @param block - The block to set as current
   */
  setCurrentBlock(block: BasicBlock): void {
    this.requireFunction();
    this.currentBlock = block;
  }

  /**
   * Gets the current block.
   *
   * @returns The current block, or null if none
   */
  getCurrentBlock(): BasicBlock | null {
    return this.currentBlock;
  }

  /**
   * Ensures a block is set for instruction emission.
   *
   * @returns The current block
   * @throws Error if no block is set
   */
  protected requireBlock(): BasicBlock {
    if (!this.currentBlock) {
      throw new Error('No current block set');
    }
    return this.currentBlock;
  }

  /**
   * Creates a new block and sets it as current.
   *
   * @param label - Block label
   * @returns The new block
   */
  appendBlock(label: string): BasicBlock {
    const block = this.createBlock(label);
    this.setCurrentBlock(block);
    return block;
  }

  // ===========================================================================
  // Register Management
  // ===========================================================================

  /**
   * Creates a new virtual register.
   *
   * @param type - Register type
   * @param name - Optional register name
   * @returns The new register
   */
  createRegister(type: ILType, name?: string): VirtualRegister {
    return this.requireFunction().createRegister(type, name);
  }

  /**
   * Gets a parameter register by index.
   *
   * @param index - Parameter index
   * @returns The parameter register, or undefined if out of bounds
   */
  getParameterRegister(index: number): VirtualRegister | undefined {
    return this.requireFunction().getParameterRegister(index);
  }

  /**
   * Gets a parameter register by name.
   *
   * @param name - Parameter name
   * @returns The parameter register, or undefined if not found
   */
  getParameterRegisterByName(name: string): VirtualRegister | undefined {
    return this.requireFunction().getParameterRegisterByName(name);
  }

  // ===========================================================================
  // Label Management
  // ===========================================================================

  /**
   * Creates a label for a block.
   *
   * @param block - Block to create label for
   * @returns A label pointing to the block
   */
  createLabel(block: BasicBlock): ILLabel {
    return block.getLabel();
  }

  // ===========================================================================
  // CFG Edge Management
  // ===========================================================================

  /**
   * Links the current block to a target block.
   *
   * @param target - Target block
   */
  linkToBlock(target: BasicBlock): void {
    this.requireBlock().linkTo(target);
  }

  // ===========================================================================
  // Instruction Emission Helpers
  // ===========================================================================

  /**
   * Gets the next instruction ID and increments the counter.
   *
   * @returns The next instruction ID
   */
  protected nextId(): number {
    return this.nextInstructionId++;
  }

  /**
   * Adds an instruction to the current block.
   *
   * @param instruction - The instruction to add
   */
  protected emit<T extends { id: number }>(instruction: T): T {
    this.requireBlock().addInstruction(instruction as unknown as ILBinaryInstruction);
    return instruction;
  }

  // ===========================================================================
  // Constant Instructions
  // ===========================================================================

  /**
   * Emits a constant byte instruction.
   *
   * @param value - Constant value
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitConstByte(value: number, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILConstInstruction(this.nextId(), value, IL_BYTE, result, metadata));
    return result;
  }

  /**
   * Emits a constant word instruction.
   *
   * @param value - Constant value
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitConstWord(value: number, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_WORD);
    this.emit(new ILConstInstruction(this.nextId(), value, IL_WORD, result, metadata));
    return result;
  }

  /**
   * Emits a constant bool instruction.
   *
   * @param value - Boolean value
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitConstBool(value: boolean, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(new ILConstInstruction(this.nextId(), value ? 1 : 0, IL_BOOL, result, metadata));
    return result;
  }

  /**
   * Emits an undefined value instruction.
   *
   * @param type - Type of the undefined value
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitUndef(type: ILType, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(type);
    this.emit(new ILUndefInstruction(this.nextId(), type, result, metadata));
    return result;
  }

  // ===========================================================================
  // Arithmetic Instructions
  // ===========================================================================

  /**
   * Emits an addition instruction.
   *
   * @param left - Left operand
   * @param right - Right operand
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitAdd(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.ADD, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a subtraction instruction.
   *
   * @param left - Left operand
   * @param right - Right operand
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitSub(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.SUB, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a multiplication instruction.
   *
   * @param left - Left operand
   * @param right - Right operand
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitMul(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.MUL, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a division instruction.
   *
   * @param left - Left operand
   * @param right - Right operand
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitDiv(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.DIV, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a modulo instruction.
   *
   * @param left - Left operand
   * @param right - Right operand
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitMod(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.MOD, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a negation instruction.
   *
   * @param operand - Operand to negate
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitNeg(operand: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(operand.type);
    this.emit(new ILUnaryInstruction(this.nextId(), ILOpcode.NEG, operand, result, metadata));
    return result;
  }

  // ===========================================================================
  // Bitwise Instructions
  // ===========================================================================

  /**
   * Emits a bitwise AND instruction.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the bitwise AND result
   */
  emitAnd(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.AND, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a bitwise OR instruction.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the bitwise OR result
   */
  emitOr(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.OR, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a bitwise XOR instruction.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the bitwise XOR result
   */
  emitXor(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.XOR, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a bitwise NOT instruction.
   *
   * @param operand - Operand register to invert
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the bitwise NOT result
   */
  emitNot(operand: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(operand.type);
    this.emit(new ILUnaryInstruction(this.nextId(), ILOpcode.NOT, operand, result, metadata));
    return result;
  }

  /**
   * Emits a shift left instruction.
   *
   * @param left - Value to shift
   * @param right - Number of bits to shift
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the shifted value
   */
  emitShl(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.SHL, left, right, result, metadata));
    return result;
  }

  /**
   * Emits a shift right instruction.
   *
   * @param left - Value to shift
   * @param right - Number of bits to shift
   * @param metadata - Optional instruction metadata
   * @returns The result register containing the shifted value
   */
  emitShr(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(left.type);
    this.emit(new ILBinaryInstruction(this.nextId(), ILOpcode.SHR, left, right, result, metadata));
    return result;
  }

  // ===========================================================================
  // Comparison Instructions
  // ===========================================================================

  /**
   * Emits an equality comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if equal, 0 otherwise)
   */
  emitCmpEq(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_EQ, left, right, result, metadata),
    );
    return result;
  }

  /**
   * Emits an inequality comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if not equal, 0 otherwise)
   */
  emitCmpNe(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_NE, left, right, result, metadata),
    );
    return result;
  }

  /**
   * Emits a less-than comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if left < right, 0 otherwise)
   */
  emitCmpLt(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_LT, left, right, result, metadata),
    );
    return result;
  }

  /**
   * Emits a less-than-or-equal comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if left <= right, 0 otherwise)
   */
  emitCmpLe(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_LE, left, right, result, metadata),
    );
    return result;
  }

  /**
   * Emits a greater-than comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if left > right, 0 otherwise)
   */
  emitCmpGt(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_GT, left, right, result, metadata),
    );
    return result;
  }

  /**
   * Emits a greater-than-or-equal comparison.
   *
   * @param left - Left operand register
   * @param right - Right operand register
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if left >= right, 0 otherwise)
   */
  emitCmpGe(
    left: VirtualRegister,
    right: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILBinaryInstruction(this.nextId(), ILOpcode.CMP_GE, left, right, result, metadata),
    );
    return result;
  }

  // ===========================================================================
  // Logical Instructions
  // ===========================================================================

  /**
   * Emits a logical NOT instruction.
   *
   * @param operand - Operand register to logically invert
   * @param metadata - Optional instruction metadata
   * @returns The result register containing boolean (1 if operand was 0, 0 otherwise)
   */
  emitLogicalNot(operand: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BOOL);
    this.emit(
      new ILUnaryInstruction(this.nextId(), ILOpcode.LOGICAL_NOT, operand, result, metadata),
    );
    return result;
  }

  // ===========================================================================
  // Type Conversion Instructions
  // ===========================================================================

  /**
   * Emits a zero-extend instruction (byte to word).
   *
   * @param source - Source register containing byte value
   * @param metadata - Optional instruction metadata
   * @returns The result register containing zero-extended word value
   */
  emitZeroExtend(source: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_WORD);
    this.emit(
      new ILConvertInstruction(this.nextId(), ILOpcode.ZERO_EXTEND, source, IL_WORD, result, metadata),
    );
    return result;
  }

  /**
   * Emits a truncate instruction (word to byte).
   *
   * @param source - Source register containing word value
   * @param metadata - Optional instruction metadata
   * @returns The result register containing truncated byte value (low byte)
   */
  emitTruncate(source: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(
      new ILConvertInstruction(this.nextId(), ILOpcode.TRUNCATE, source, IL_BYTE, result, metadata),
    );
    return result;
  }

  // ===========================================================================
  // Control Flow Instructions
  // ===========================================================================

  /**
   * Emits an unconditional jump.
   *
   * @param target - Target block
   * @param metadata - Optional metadata
   */
  emitJump(target: BasicBlock, metadata: ILMetadata = {}): void {
    const label = target.getLabel();
    this.emit(new ILJumpInstruction(this.nextId(), label, metadata));
    this.requireBlock().linkTo(target);
  }

  /**
   * Emits a conditional branch.
   *
   * @param condition - Condition register
   * @param thenBlock - Block for true condition
   * @param elseBlock - Block for false condition
   * @param metadata - Optional metadata
   */
  emitBranch(
    condition: VirtualRegister,
    thenBlock: BasicBlock,
    elseBlock: BasicBlock,
    metadata: ILMetadata = {},
  ): void {
    const thenLabel = thenBlock.getLabel();
    const elseLabel = elseBlock.getLabel();
    this.emit(new ILBranchInstruction(this.nextId(), condition, thenLabel, elseLabel, metadata));
    this.requireBlock().linkTo(thenBlock);
    this.requireBlock().linkTo(elseBlock);
  }

  /**
   * Emits a return instruction with a value.
   *
   * @param value - Value to return
   * @param metadata - Optional metadata
   */
  emitReturn(value: VirtualRegister, metadata: ILMetadata = {}): void {
    this.emit(new ILReturnInstruction(this.nextId(), value, metadata));
  }

  /**
   * Emits a void return instruction.
   *
   * @param metadata - Optional metadata
   */
  emitReturnVoid(metadata: ILMetadata = {}): void {
    this.emit(new ILReturnVoidInstruction(this.nextId(), metadata));
  }

  // ===========================================================================
  // Memory Instructions
  // ===========================================================================

  /**
   * Emits a load variable instruction.
   */
  emitLoadVar(
    variableName: string,
    type: ILType,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(type);
    this.emit(new ILLoadVarInstruction(this.nextId(), variableName, result, metadata));
    return result;
  }

  /**
   * Emits a store variable instruction.
   */
  emitStoreVar(
    variableName: string,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILStoreVarInstruction(this.nextId(), variableName, value, metadata));
  }

  /**
   * Emits a load array element instruction.
   */
  emitLoadArray(
    arrayName: string,
    index: VirtualRegister,
    elementType: ILType,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(elementType);
    this.emit(new ILLoadArrayInstruction(this.nextId(), arrayName, index, result, metadata));
    return result;
  }

  /**
   * Emits a store array element instruction.
   */
  emitStoreArray(
    arrayName: string,
    index: VirtualRegister,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILStoreArrayInstruction(this.nextId(), arrayName, index, value, metadata));
  }

  // ===========================================================================
  // Call Instructions
  // ===========================================================================

  /**
   * Emits a function call with return value.
   */
  emitCall(
    functionName: string,
    args: VirtualRegister[],
    returnType: ILType,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(returnType);
    this.emit(new ILCallInstruction(this.nextId(), functionName, args, result, metadata));
    return result;
  }

  /**
   * Emits a void function call.
   */
  emitCallVoid(
    functionName: string,
    args: VirtualRegister[],
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILCallVoidInstruction(this.nextId(), functionName, args, metadata));
  }

  // ===========================================================================
  // SSA Instructions
  // ===========================================================================

  /**
   * Emits a phi instruction.
   */
  emitPhi(
    sources: { value: VirtualRegister; blockId: number }[],
    type: ILType,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(type);
    this.emit(new ILPhiInstruction(this.nextId(), sources, result, metadata));
    return result;
  }

  // ===========================================================================
  // Intrinsic Instructions
  // ===========================================================================

  /**
   * Emits a peek instruction (read byte from address).
   */
  emitPeek(address: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILPeekInstruction(this.nextId(), address, result, metadata));
    return result;
  }

  /**
   * Emits a poke instruction (write byte to address).
   */
  emitPoke(
    address: VirtualRegister,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILPokeInstruction(this.nextId(), address, value, metadata));
  }

  // ===========================================================================
  // Hardware Instructions
  // ===========================================================================

  /**
   * Emits a hardware read instruction.
   */
  emitHardwareRead(address: number, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILHardwareReadInstruction(this.nextId(), address, result, metadata));
    return result;
  }

  /**
   * Emits a hardware write instruction.
   */
  emitHardwareWrite(
    address: number,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILHardwareWriteInstruction(this.nextId(), address, value, metadata));
  }

  // ===========================================================================
  // Optimization Control
  // ===========================================================================

  /**
   * Emits an optimization barrier.
   */
  emitOptBarrier(metadata: ILMetadata = {}): void {
    this.emit(new ILOptBarrierInstruction(this.nextId(), metadata));
  }

  // ===========================================================================
  // Phase 5: Additional Intrinsic Instructions
  // ===========================================================================

  /**
   * Emits a peekw instruction (read 16-bit word from address).
   *
   * @param address - Register containing the address
   * @param metadata - Optional metadata
   * @returns The result register containing the word read
   */
  emitPeekw(address: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_WORD);
    this.emit(new ILPeekwInstruction(this.nextId(), address, result, metadata));
    return result;
  }

  /**
   * Emits a pokew instruction (write 16-bit word to address).
   *
   * @param address - Register containing the address
   * @param value - Register containing the word value to write
   * @param metadata - Optional metadata
   */
  emitPokew(
    address: VirtualRegister,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILPokewInstruction(this.nextId(), address, value, metadata));
  }

  /**
   * Emits a length instruction (get array/string length).
   *
   * @param arrayName - Name of the array
   * @param metadata - Optional metadata
   * @returns The result register containing the length
   */
  emitLength(arrayName: string, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_WORD);
    this.emit(new ILLengthInstruction(this.nextId(), arrayName, result, metadata));
    return result;
  }

  /**
   * Emits a lo instruction (extract low byte of word).
   *
   * @param source - Register containing the word
   * @param metadata - Optional metadata
   * @returns The result register containing the low byte
   */
  emitLo(source: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILLoInstruction(this.nextId(), source, result, metadata));
    return result;
  }

  /**
   * Emits a hi instruction (extract high byte of word).
   *
   * @param source - Register containing the word
   * @param metadata - Optional metadata
   * @returns The result register containing the high byte
   */
  emitHi(source: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILHiInstruction(this.nextId(), source, result, metadata));
    return result;
  }

  /**
   * Emits a volatile read instruction.
   *
   * @param address - Register containing the address
   * @param metadata - Optional metadata
   * @returns The result register containing the byte read
   */
  emitVolatileRead(address: VirtualRegister, metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILVolatileReadInstruction(this.nextId(), address, result, metadata));
    return result;
  }

  /**
   * Emits a volatile write instruction.
   *
   * @param address - Register containing the address
   * @param value - Register containing the value
   * @param metadata - Optional metadata
   */
  emitVolatileWrite(
    address: VirtualRegister,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(new ILVolatileWriteInstruction(this.nextId(), address, value, metadata));
  }

  // ===========================================================================
  // Phase 5: CPU Instruction Intrinsics
  // ===========================================================================

  /**
   * Emits a SEI instruction (set interrupt disable).
   *
   * @param metadata - Optional metadata
   */
  emitSei(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_SEI, null, metadata));
  }

  /**
   * Emits a CLI instruction (clear interrupt disable).
   *
   * @param metadata - Optional metadata
   */
  emitCli(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_CLI, null, metadata));
  }

  /**
   * Emits a NOP instruction (no operation).
   *
   * @param metadata - Optional metadata
   */
  emitNop(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_NOP, null, metadata));
  }

  /**
   * Emits a BRK instruction (software interrupt).
   *
   * @param metadata - Optional metadata
   */
  emitBrk(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_BRK, null, metadata));
  }

  /**
   * Emits a PHA instruction (push accumulator to stack).
   *
   * @param metadata - Optional metadata
   */
  emitPha(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_PHA, null, metadata));
  }

  /**
   * Emits a PLA instruction (pull accumulator from stack).
   *
   * @param metadata - Optional metadata
   * @returns The result register containing the byte pulled
   */
  emitPla(metadata: ILMetadata = {}): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_PLA, result, metadata));
    return result;
  }

  /**
   * Emits a PHP instruction (push processor status to stack).
   *
   * @param metadata - Optional metadata
   */
  emitPhp(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_PHP, null, metadata));
  }

  /**
   * Emits a PLP instruction (pull processor status from stack).
   *
   * @param metadata - Optional metadata
   */
  emitPlp(metadata: ILMetadata = {}): void {
    this.emit(new ILCpuInstruction(this.nextId(), ILOpcode.CPU_PLP, null, metadata));
  }

  // ===========================================================================
  // Phase 5: @map Struct Access Instructions
  // ===========================================================================

  /**
   * Emits a map load field instruction.
   *
   * @param structName - Name of the @map struct
   * @param fieldName - Name of the field to load
   * @param address - Hardware address of the field
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitMapLoadField(
    structName: string,
    fieldName: string,
    address: number,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(
      new ILMapLoadFieldInstruction(this.nextId(), structName, fieldName, address, result, metadata),
    );
    return result;
  }

  /**
   * Emits a map store field instruction.
   *
   * @param structName - Name of the @map struct
   * @param fieldName - Name of the field to store to
   * @param address - Hardware address of the field
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  emitMapStoreField(
    structName: string,
    fieldName: string,
    address: number,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(
      new ILMapStoreFieldInstruction(this.nextId(), structName, fieldName, address, value, metadata),
    );
  }

  /**
   * Emits a map load range instruction.
   *
   * @param rangeName - Name of the @map range
   * @param baseAddress - Base hardware address
   * @param endAddress - End hardware address
   * @param index - Register containing the index
   * @param metadata - Optional metadata
   * @returns The result register
   */
  emitMapLoadRange(
    rangeName: string,
    baseAddress: number,
    endAddress: number,
    index: VirtualRegister,
    metadata: ILMetadata = {},
  ): VirtualRegister {
    const result = this.createRegister(IL_BYTE);
    this.emit(
      new ILMapLoadRangeInstruction(
        this.nextId(),
        rangeName,
        baseAddress,
        endAddress,
        index,
        result,
        metadata,
      ),
    );
    return result;
  }

  /**
   * Emits a map store range instruction.
   *
   * @param rangeName - Name of the @map range
   * @param baseAddress - Base hardware address
   * @param endAddress - End hardware address
   * @param index - Register containing the index
   * @param value - Register containing the value to store
   * @param metadata - Optional metadata
   */
  emitMapStoreRange(
    rangeName: string,
    baseAddress: number,
    endAddress: number,
    index: VirtualRegister,
    value: VirtualRegister,
    metadata: ILMetadata = {},
  ): void {
    this.emit(
      new ILMapStoreRangeInstruction(
        this.nextId(),
        rangeName,
        baseAddress,
        endAddress,
        index,
        value,
        metadata,
      ),
    );
  }

  // ===========================================================================
  // Address-of Operator Instructions
  // ===========================================================================

  /**
   * Emits a LOAD_ADDRESS instruction to get the address of a symbol.
   *
   * This is used to implement the address-of operator (`@`) in Blend.
   * The result is always a 16-bit word containing the memory address of
   * the specified symbol (variable or function).
   *
   * @param symbolName - Name of the variable or function
   * @param symbolKind - Whether it's a 'variable' or 'function'
   * @param metadata - Optional metadata for diagnostics and optimization
   * @returns The register containing the 16-bit address
   *
   * @example
   * ```typescript
   * // For: @myVariable
   * const addrReg = builder.emitLoadAddress('myVariable', 'variable', loc);
   *
   * // For: @myFunction
   * const funcAddrReg = builder.emitLoadAddress('myFunction', 'function', loc);
   * ```
   */
  emitLoadAddress(
    symbolName: string,
    symbolKind: 'variable' | 'function',
    metadata: ILMetadata = {},
  ): VirtualRegister {
    // Addresses are always 16-bit words on 6502
    const result = this.createRegister(IL_WORD);
    this.emit(
      new ILLoadAddressInstruction(this.nextId(), symbolName, symbolKind, result, metadata),
    );
    return result;
  }
}