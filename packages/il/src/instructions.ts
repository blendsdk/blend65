/**
 * IL Instruction Implementations for Blend65
 * Task 2.2: Define IL Instructions for Blend65
 *
 * This file implements concrete IL instruction creation functions
 * for all Blend65 operations with 6502-specific optimizations.
 */

import type { SourcePosition } from '@blend65/lexer';
import {
  ILInstruction,
  ILInstructionType,
  ILValue,
  ILOperand,
  ILConstant,
  ILVariable,
  ILRegister,
  ILLabel,
  IL6502OptimizationHints,
  createILInstruction,
  isILConstant,
} from './il-types.js';

// ============================================================================
// INSTRUCTION VALIDATION UTILITIES
// ============================================================================

export class ILInstructionError extends Error {
  constructor(
    public instructionType: ILInstructionType,
    message: string,
    public operands?: ILOperand[],
    public sourceLocation?: SourcePosition
  ) {
    super(`IL instruction error (${instructionType}): ${message}`);
    this.name = 'ILInstructionError';
  }
}

function validateOperandCount(
  instructionType: ILInstructionType,
  operands: ILOperand[],
  expectedCount: number
): void {
  if (operands.length !== expectedCount) {
    throw new ILInstructionError(
      instructionType,
      `Expected ${expectedCount} operands, got ${operands.length}`,
      operands
    );
  }
}

function validateOperandCountRange(
  instructionType: ILInstructionType,
  operands: ILOperand[],
  minCount: number,
  maxCount: number
): void {
  if (operands.length < minCount || operands.length > maxCount) {
    throw new ILInstructionError(
      instructionType,
      `Expected ${minCount}-${maxCount} operands, got ${operands.length}`,
      operands
    );
  }
}

// ============================================================================
// INSTRUCTION CREATION CONTEXT
// ============================================================================

export class InstructionCreationContext {
  private nextInstructionId = 1;

  getNextInstructionId(): number {
    return this.nextInstructionId++;
  }

  resetInstructionId(): void {
    this.nextInstructionId = 1;
  }
}

const globalInstructionContext = new InstructionCreationContext();

// ============================================================================
// CORE INSTRUCTION CREATION FUNCTIONS
// ============================================================================

// Memory Operations
export function createLoadImmediate(
  dest: ILValue,
  value: ILConstant,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    preferredRegister: dest.valueType === 'register' ? (dest as ILRegister).register : 'A',
    preferredAddressingMode: 'immediate',
    estimatedCycles: 2,
  };

  return createILInstruction(
    ILInstructionType.LOAD_IMMEDIATE,
    [dest, value],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: hints }
  );
}

export function createLoadMemory(
  dest: ILValue,
  address: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.LOAD_MEMORY,
    [dest, address],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createStoreMemory(
  address: ILValue,
  value: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.STORE_MEMORY,
    [address, value],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createCopy(
  dest: ILValue,
  source: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    estimatedCycles: 3,
    canOptimizeAway: dest === source,
  };

  return createILInstruction(
    ILInstructionType.COPY,
    [dest, source],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: hints }
  );
}

// Arithmetic Operations
export function createAdd(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    preferredRegister: 'A',
    estimatedCycles: 3,
    canOptimizeAway: isILConstant(right) && right.value === 0,
  };

  return createILInstruction(
    ILInstructionType.ADD,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: hints }
  );
}

export function createSub(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    preferredRegister: 'A',
    estimatedCycles: 3,
    canOptimizeAway: isILConstant(right) && right.value === 0,
  };

  return createILInstruction(
    ILInstructionType.SUB,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: hints }
  );
}

export function createMul(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.MUL,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 20 } }
  );
}

export function createDiv(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.DIV,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 30 } }
  );
}

export function createMod(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.MOD,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 30 } }
  );
}

export function createNeg(
  dest: ILValue,
  source: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.NEG,
    [dest, source],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

// Logical Operations
export function createAnd(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.AND,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createOr(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.OR,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createNot(
  dest: ILValue,
  source: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.NOT,
    [dest, source],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

// Bitwise Operations
export function createBitwiseAnd(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BITWISE_AND,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createBitwiseOr(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BITWISE_OR,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createBitwiseXor(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BITWISE_XOR,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

export function createBitwiseNot(
  dest: ILValue,
  source: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BITWISE_NOT,
    [dest, source],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } }
  );
}

// Shift Operations
export function createShiftLeft(
  dest: ILValue,
  source: ILValue,
  amount: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.SHIFT_LEFT,
    [dest, source, amount],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } }
  );
}

export function createShiftRight(
  dest: ILValue,
  source: ILValue,
  amount: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.SHIFT_RIGHT,
    [dest, source, amount],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } }
  );
}

// Comparison Operations
export function createCompareEq(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_EQ,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

export function createCompareNe(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_NE,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

export function createCompareLt(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_LT,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

export function createCompareLe(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_LE,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

export function createCompareGt(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_GT,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

export function createCompareGe(
  dest: ILValue,
  left: ILValue,
  right: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.COMPARE_GE,
    [dest, left, right],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } }
  );
}

// Control Flow Operations
export function createBranch(target: ILLabel, sourceLocation?: SourcePosition): ILInstruction {
  return createILInstruction(
    ILInstructionType.BRANCH,
    [target],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } }
  );
}

export function createBranchIfTrue(
  condition: ILValue,
  target: ILLabel,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BRANCH_IF_TRUE,
    [condition, target],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } }
  );
}

export function createBranchIfFalse(
  condition: ILValue,
  target: ILLabel,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BRANCH_IF_FALSE,
    [condition, target],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } }
  );
}

export function createBranchIfZero(
  value: ILValue,
  target: ILLabel,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BRANCH_IF_ZERO,
    [value, target],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } }
  );
}

export function createBranchIfNotZero(
  value: ILValue,
  target: ILLabel,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.BRANCH_IF_NOT_ZERO,
    [value, target],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } }
  );
}

// Function Operations
export function createCall(
  functionRef: ILValue,
  args: ILValue[] = [],
  sourceLocation?: SourcePosition
): ILInstruction {
  const operands = [functionRef, ...args];
  validateOperandCountRange(ILInstructionType.CALL, operands, 1, 10);
  return createILInstruction(
    ILInstructionType.CALL,
    operands,
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 12 } }
  );
}

export function createReturn(value?: ILValue, sourceLocation?: SourcePosition): ILInstruction {
  const operands = value ? [value] : [];
  return createILInstruction(
    ILInstructionType.RETURN,
    operands,
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 6 } }
  );
}

// Variable Operations
export function createDeclareLocal(
  variable: ILVariable,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.DECLARE_LOCAL,
    [variable],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } }
  );
}

export function createLoadVariable(
  dest: ILValue,
  variable: ILVariable,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    preferredRegister: 'A',
    preferredAddressingMode: variable.storageClass === 'zp' ? 'zero_page' : 'absolute',
    estimatedCycles: 3,
  };
  return createILInstruction(
    ILInstructionType.LOAD_VARIABLE,
    [dest, variable],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: hints }
  );
}

export function createStoreVariable(
  variable: ILVariable,
  value: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  const hints: IL6502OptimizationHints = {
    preferredRegister: 'A',
    preferredAddressingMode: variable.storageClass === 'zp' ? 'zero_page' : 'absolute',
    estimatedCycles: 3,
  };
  return createILInstruction(
    ILInstructionType.STORE_VARIABLE,
    [variable, value],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: hints }
  );
}

// Array Operations
export function createLoadArray(
  dest: ILValue,
  array: ILValue,
  index: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.LOAD_ARRAY,
    [dest, array, index],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } }
  );
}

export function createStoreArray(
  array: ILValue,
  index: ILValue,
  value: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.STORE_ARRAY,
    [array, index, value],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } }
  );
}

export function createArrayAddress(
  dest: ILValue,
  array: ILValue,
  index: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.ARRAY_ADDRESS,
    [dest, array, index],
    globalInstructionContext.getNextInstructionId(),
    { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'X', estimatedCycles: 4 } }
  );
}

// Utility Operations
export function createLabel(name: string, sourceLocation?: SourcePosition): ILInstruction {
  const label: ILLabel = { valueType: 'label', name };
  return createILInstruction(
    ILInstructionType.LABEL,
    [label],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } }
  );
}

export function createNop(sourceLocation?: SourcePosition): ILInstruction {
  return createILInstruction(
    ILInstructionType.NOP,
    [],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } }
  );
}

export function createComment(text: string, sourceLocation?: SourcePosition): ILInstruction {
  const comment: ILConstant = {
    valueType: 'constant',
    type: { kind: 'primitive', name: 'void' },
    value: text,
    representation: 'string',
  };
  return createILInstruction(
    ILInstructionType.COMMENT,
    [comment],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } }
  );
}

// 6502-Specific Operations
export function createPeek(
  dest: ILValue,
  address: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.PEEK,
    [dest, address],
    globalInstructionContext.getNextInstructionId(),
    {
      result: dest,
      sourceLocation,
      sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4, isTimingCritical: true },
    }
  );
}

export function createPoke(
  address: ILValue,
  value: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.POKE,
    [address, value],
    globalInstructionContext.getNextInstructionId(),
    {
      sourceLocation,
      sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4, isTimingCritical: true },
    }
  );
}

export function createPeekw(
  dest: ILValue,
  address: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.PEEKW,
    [dest, address],
    globalInstructionContext.getNextInstructionId(),
    {
      result: dest,
      sourceLocation,
      sixtyTwoHints: { preferredRegister: 'AX', estimatedCycles: 8, isTimingCritical: true },
    }
  );
}

export function createPokew(
  address: ILValue,
  value: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.POKEW,
    [address, value],
    globalInstructionContext.getNextInstructionId(),
    {
      sourceLocation,
      sixtyTwoHints: { preferredRegister: 'AX', estimatedCycles: 8, isTimingCritical: true },
    }
  );
}

export function createSys(
  address: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  return createILInstruction(
    ILInstructionType.SYS,
    [address],
    globalInstructionContext.getNextInstructionId(),
    {
      sourceLocation,
      sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 12, isTimingCritical: true },
    }
  );
}

export function createRegisterOp(
  register: ILRegister,
  operation: ILConstant,
  operand?: ILValue,
  sourceLocation?: SourcePosition
): ILInstruction {
  const operands = operand ? [register, operation, operand] : [register, operation];
  return createILInstruction(
    ILInstructionType.REGISTER_OP,
    operands,
    globalInstructionContext.getNextInstructionId(),
    {
      result: register,
      sourceLocation,
      sixtyTwoHints: { preferredRegister: register.register, estimatedCycles: 2 },
    }
  );
}

export function createSetFlags(flags: ILValue, sourceLocation?: SourcePosition): ILInstruction {
  return createILInstruction(
    ILInstructionType.SET_FLAGS,
    [flags],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 2, isTimingCritical: true } }
  );
}

export function createClearFlags(flags: ILValue, sourceLocation?: SourcePosition): ILInstruction {
  return createILInstruction(
    ILInstructionType.CLEAR_FLAGS,
    [flags],
    globalInstructionContext.getNextInstructionId(),
    { sourceLocation, sixtyTwoHints: { estimatedCycles: 2, isTimingCritical: true } }
  );
}

// ============================================================================
// INSTRUCTION FACTORY AND UTILITIES
// ============================================================================

export const ILInstructionFactory = {
  // Memory operations
  loadImmediate: createLoadImmediate,
  loadMemory: createLoadMemory,
  storeMemory: createStoreMemory,
  copy: createCopy,

  // Arithmetic operations
  add: createAdd,
  sub: createSub,
  mul: createMul,
  div: createDiv,
  mod: createMod,
  neg: createNeg,

  // Logical operations
  and: createAnd,
  or: createOr,
  not: createNot,

  // Bitwise operations
  bitwiseAnd: createBitwiseAnd,
  bitwiseOr: createBitwiseOr,
  bitwiseXor: createBitwiseXor,
  bitwiseNot: createBitwiseNot,

  // Shift operations
  shiftLeft: createShiftLeft,
  shiftRight: createShiftRight,

  // Comparison operations
  compareEq: createCompareEq,
  compareNe: createCompareNe,
  compareLt: createCompareLt,
  compareLe: createCompareLe,
  compareGt: createCompareGt,
  compareGe: createCompareGe,

  // Control flow
  branch: createBranch,
  branchIfTrue: createBranchIfTrue,
  branchIfFalse: createBranchIfFalse,
  branchIfZero: createBranchIfZero,
  branchIfNotZero: createBranchIfNotZero,

  // Function operations
  call: createCall,
  return: createReturn,

  // Variable operations
  declareLocal: createDeclareLocal,
  loadVariable: createLoadVariable,
  storeVariable: createStoreVariable,

  // Array operations
  loadArray: createLoadArray,
  storeArray: createStoreArray,
  arrayAddress: createArrayAddress,

  // Utility operations
  label: createLabel,
  nop: createNop,
  comment: createComment,

  // 6502-specific operations
  peek: createPeek,
  poke: createPoke,
  peekw: createPeekw,
  pokew: createPokew,
  sys: createSys,
  registerOp: createRegisterOp,
  setFlags: createSetFlags,
  clearFlags: createClearFlags,
};

export function createInstructionContext(): InstructionCreationContext {
  return new InstructionCreationContext();
}

export function resetGlobalInstructionContext(): void {
  globalInstructionContext.resetInstructionId();
}

export function validateILInstruction(instruction: ILInstruction): ILInstructionError[] {
  const errors: ILInstructionError[] = [];

  try {
    // Basic validation - check operand counts and types
    switch (instruction.type) {
      case ILInstructionType.LOAD_IMMEDIATE:
      case ILInstructionType.LOAD_MEMORY:
      case ILInstructionType.STORE_MEMORY:
      case ILInstructionType.COPY:
        validateOperandCount(instruction.type, instruction.operands, 2);
        break;

      case ILInstructionType.ADD:
      case ILInstructionType.SUB:
      case ILInstructionType.MUL:
      case ILInstructionType.DIV:
      case ILInstructionType.MOD:
        validateOperandCount(instruction.type, instruction.operands, 3);
        break;

      case ILInstructionType.CALL:
        validateOperandCountRange(instruction.type, instruction.operands, 1, 10);
        break;

      case ILInstructionType.RETURN:
        validateOperandCountRange(instruction.type, instruction.operands, 0, 1);
        break;

      default:
        // Allow other instructions to pass through
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(
      new ILInstructionError(
        instruction.type,
        `Validation error: ${errorMessage}`,
        instruction.operands,
        instruction.sourceLocation
      )
    );
  }

  return errors;
}
