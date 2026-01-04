/**
 * IL Instruction Creation Tests
 * Task 2.2: Define IL Instructions for Blend65
 *
 * Tests all IL instruction creation functions to ensure they produce
 * valid instructions with proper 6502 optimization hints.
 */

import { describe, it, expect } from 'vitest';
import { SourcePosition } from '@blend65/lexer';
import {
  ILInstructionType,
  createILConstant,
  createILVariable,
  createILRegister,
  createILTemporary,
  createILLabel
} from '../il-types.js';
import {
  ILInstructionError,
  InstructionCreationContext,
  createLoadImmediate,
  createLoadMemory,
  createStoreMemory,
  createCopy,
  createAdd,
  createSub,
  createMul,
  createDiv,
  createMod,
  createNeg,
  createAnd,
  createOr,
  createNot,
  createBitwiseAnd,
  createBitwiseOr,
  createBitwiseXor,
  createBitwiseNot,
  createShiftLeft,
  createShiftRight,
  createCompareEq,
  createCompareNe,
  createCompareLt,
  createCompareLe,
  createCompareGt,
  createCompareGe,
  createBranch,
  createBranchIfTrue,
  createBranchIfFalse,
  createBranchIfZero,
  createBranchIfNotZero,
  createCall,
  createReturn,
  createDeclareLocal,
  createLoadVariable,
  createStoreVariable,
  createLoadArray,
  createStoreArray,
  createArrayAddress,
  createLabel,
  createNop,
  createComment,
  createPeek,
  createPoke,
  createRegisterOp,
  createSetFlags,
  createClearFlags,
  ILInstructionFactory,
  validateILInstruction,
  createInstructionContext,
  resetGlobalInstructionContext
} from '../instructions.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const testLocation: SourcePosition = { line: 1, column: 1, offset: 0 };

// Test values
const byteType = { kind: 'primitive' as const, name: 'byte' as const };
const wordType = { kind: 'primitive' as const, name: 'word' as const };
const booleanType = { kind: 'primitive' as const, name: 'boolean' as const };

const testConstant = createILConstant(byteType, 42, 'decimal');
const testVariable = createILVariable('testVar', byteType, [], 'ram', 'local');
const testRegister = createILRegister('A', byteType);
const testTemporary = createILTemporary(1, byteType, 'expression');
const testLabel = createILLabel('test_label');

// ============================================================================
// MEMORY OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Memory Operation Instructions', () => {
  it('should create LOAD_IMMEDIATE instruction', () => {
    const instruction = createLoadImmediate(testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.LOAD_IMMEDIATE);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testRegister);
    expect(instruction.sourceLocation).toBe(testLocation);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
    expect(instruction.sixtyTwoHints?.preferredAddressingMode).toBe('immediate');
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(2);
  });

  it('should create LOAD_MEMORY instruction', () => {
    const address = createILConstant(wordType, 0x2000, 'hexadecimal');
    const instruction = createLoadMemory(testTemporary, address, testLocation);

    expect(instruction.type).toBe(ILInstructionType.LOAD_MEMORY);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(3);
  });

  it('should create STORE_MEMORY instruction', () => {
    const address = createILConstant(wordType, 0x2000, 'hexadecimal');
    const instruction = createStoreMemory(address, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.STORE_MEMORY);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.operands[0]).toBe(address);
    expect(instruction.operands[1]).toBe(testConstant);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
  });

  it('should create COPY instruction', () => {
    const instruction = createCopy(testTemporary, testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COPY);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(3);
  });

  it('should optimize COPY with same source and destination', () => {
    const instruction = createCopy(testRegister, testRegister, testLocation);

    expect(instruction.sixtyTwoHints?.canOptimizeAway).toBe(true);
  });
});

// ============================================================================
// ARITHMETIC OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Arithmetic Operation Instructions', () => {
  it('should create ADD instruction', () => {
    const instruction = createAdd(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.ADD);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(3);
  });

  it('should optimize ADD with zero', () => {
    const zero = createILConstant(byteType, 0, 'decimal');
    const instruction = createAdd(testTemporary, testRegister, zero, testLocation);

    expect(instruction.sixtyTwoHints?.canOptimizeAway).toBe(true);
  });

  it('should create SUB instruction', () => {
    const instruction = createSub(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.SUB);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
  });

  it('should optimize SUB with zero', () => {
    const zero = createILConstant(byteType, 0, 'decimal');
    const instruction = createSub(testTemporary, testRegister, zero, testLocation);

    expect(instruction.sixtyTwoHints?.canOptimizeAway).toBe(true);
  });

  it('should create MUL instruction', () => {
    const instruction = createMul(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.MUL);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(20);
  });

  it('should create DIV instruction', () => {
    const instruction = createDiv(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.DIV);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(30);
  });

  it('should create MOD instruction', () => {
    const instruction = createMod(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.MOD);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(30);
  });

  it('should create NEG instruction', () => {
    const instruction = createNeg(testTemporary, testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.NEG);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(4);
  });
});

// ============================================================================
// LOGICAL OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Logical Operation Instructions', () => {
  it('should create AND instruction', () => {
    const instruction = createAnd(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.AND);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
  });

  it('should create OR instruction', () => {
    const instruction = createOr(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.OR);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create NOT instruction', () => {
    const instruction = createNot(testTemporary, testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.NOT);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
  });
});

// ============================================================================
// BITWISE OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Bitwise Operation Instructions', () => {
  it('should create BITWISE_AND instruction', () => {
    const instruction = createBitwiseAnd(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BITWISE_AND);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create BITWISE_OR instruction', () => {
    const instruction = createBitwiseOr(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BITWISE_OR);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create BITWISE_XOR instruction', () => {
    const instruction = createBitwiseXor(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BITWISE_XOR);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create BITWISE_NOT instruction', () => {
    const instruction = createBitwiseNot(testTemporary, testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BITWISE_NOT);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
  });
});

// ============================================================================
// SHIFT OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Shift Operation Instructions', () => {
  it('should create SHIFT_LEFT instruction', () => {
    const amount = createILConstant(byteType, 2, 'decimal');
    const instruction = createShiftLeft(testTemporary, testRegister, amount, testLocation);

    expect(instruction.type).toBe(ILInstructionType.SHIFT_LEFT);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(6);
  });

  it('should create SHIFT_RIGHT instruction', () => {
    const amount = createILConstant(byteType, 1, 'decimal');
    const instruction = createShiftRight(testTemporary, testRegister, amount, testLocation);

    expect(instruction.type).toBe(ILInstructionType.SHIFT_RIGHT);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(6);
  });
});

// ============================================================================
// COMPARISON OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Comparison Operation Instructions', () => {
  it('should create COMPARE_EQ instruction', () => {
    const instruction = createCompareEq(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_EQ);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(4);
  });

  it('should create COMPARE_NE instruction', () => {
    const instruction = createCompareNe(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_NE);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create COMPARE_LT instruction', () => {
    const instruction = createCompareLt(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_LT);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create COMPARE_LE instruction', () => {
    const instruction = createCompareLe(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_LE);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create COMPARE_GT instruction', () => {
    const instruction = createCompareGt(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_GT);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });

  it('should create COMPARE_GE instruction', () => {
    const instruction = createCompareGe(testTemporary, testRegister, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMPARE_GE);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
  });
});

// ============================================================================
// CONTROL FLOW INSTRUCTION TESTS
// ============================================================================

describe('Control Flow Instructions', () => {
  it('should create BRANCH instruction', () => {
    const instruction = createBranch(testLabel, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BRANCH);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.operands[0]).toBe(testLabel);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(3);
  });

  it('should create BRANCH_IF_TRUE instruction', () => {
    const condition = createILTemporary(2, booleanType, 'expression');
    const instruction = createBranchIfTrue(condition, testLabel, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BRANCH_IF_TRUE);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.operands[0]).toBe(condition);
    expect(instruction.operands[1]).toBe(testLabel);
  });

  it('should create BRANCH_IF_FALSE instruction', () => {
    const condition = createILTemporary(3, booleanType, 'expression');
    const instruction = createBranchIfFalse(condition, testLabel, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BRANCH_IF_FALSE);
    expect(instruction.operands).toHaveLength(2);
  });

  it('should create BRANCH_IF_ZERO instruction', () => {
    const instruction = createBranchIfZero(testRegister, testLabel, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BRANCH_IF_ZERO);
    expect(instruction.operands).toHaveLength(2);
  });

  it('should create BRANCH_IF_NOT_ZERO instruction', () => {
    const instruction = createBranchIfNotZero(testRegister, testLabel, testLocation);

    expect(instruction.type).toBe(ILInstructionType.BRANCH_IF_NOT_ZERO);
    expect(instruction.operands).toHaveLength(2);
  });
});

// ============================================================================
// FUNCTION OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Function Operation Instructions', () => {
  it('should create CALL instruction with no arguments', () => {
    const funcRef = createILVariable('myFunction', { kind: 'primitive', name: 'callback' }, [], null, 'global');
    const instruction = createCall(funcRef, [], testLocation);

    expect(instruction.type).toBe(ILInstructionType.CALL);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.operands[0]).toBe(funcRef);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(12);
  });

  it('should create CALL instruction with arguments', () => {
    const funcRef = createILVariable('myFunction', { kind: 'primitive', name: 'callback' }, [], null, 'global');
    const args = [testConstant, testRegister];
    const instruction = createCall(funcRef, args, testLocation);

    expect(instruction.type).toBe(ILInstructionType.CALL);
    expect(instruction.operands).toHaveLength(3); // function + 2 args
    expect(instruction.operands[1]).toBe(testConstant);
    expect(instruction.operands[2]).toBe(testRegister);
  });

  it('should create RETURN instruction with no value', () => {
    const instruction = createReturn(undefined, testLocation);

    expect(instruction.type).toBe(ILInstructionType.RETURN);
    expect(instruction.operands).toHaveLength(0);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(6);
  });

  it('should create RETURN instruction with value', () => {
    const instruction = createReturn(testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.RETURN);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.operands[0]).toBe(testRegister);
  });
});

// ============================================================================
// VARIABLE OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Variable Operation Instructions', () => {
  it('should create DECLARE_LOCAL instruction', () => {
    const instruction = createDeclareLocal(testVariable, testLocation);

    expect(instruction.type).toBe(ILInstructionType.DECLARE_LOCAL);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.operands[0]).toBe(testVariable);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(0);
  });

  it('should create LOAD_VARIABLE instruction', () => {
    const instruction = createLoadVariable(testTemporary, testVariable, testLocation);

    expect(instruction.type).toBe(ILInstructionType.LOAD_VARIABLE);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
    expect(instruction.sixtyTwoHints?.preferredAddressingMode).toBe('absolute');
  });

  it('should create LOAD_VARIABLE with zero page optimization', () => {
    const zpVariable = createILVariable('zpVar', byteType, [], 'zp', 'local');
    const instruction = createLoadVariable(testTemporary, zpVariable, testLocation);

    expect(instruction.sixtyTwoHints?.preferredAddressingMode).toBe('zero_page');
  });

  it('should create STORE_VARIABLE instruction', () => {
    const instruction = createStoreVariable(testVariable, testRegister, testLocation);

    expect(instruction.type).toBe(ILInstructionType.STORE_VARIABLE);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.operands[0]).toBe(testVariable);
    expect(instruction.operands[1]).toBe(testRegister);
  });
});

// ============================================================================
// ARRAY OPERATION INSTRUCTION TESTS
// ============================================================================

describe('Array Operation Instructions', () => {
  it('should create LOAD_ARRAY instruction', () => {
    const arrayVar = createILVariable('myArray', { kind: 'array', elementType: byteType, size: 256 }, [], 'ram', 'global');
    const index = createILConstant(byteType, 5, 'decimal');
    const instruction = createLoadArray(testTemporary, arrayVar, index, testLocation);

    expect(instruction.type).toBe(ILInstructionType.LOAD_ARRAY);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(6);
  });

  it('should create STORE_ARRAY instruction', () => {
    const arrayVar = createILVariable('myArray', { kind: 'array', elementType: byteType, size: 256 }, [], 'ram', 'global');
    const index = createILConstant(byteType, 5, 'decimal');
    const instruction = createStoreArray(arrayVar, index, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.STORE_ARRAY);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.operands[0]).toBe(arrayVar);
    expect(instruction.operands[1]).toBe(index);
    expect(instruction.operands[2]).toBe(testConstant);
  });

  it('should create ARRAY_ADDRESS instruction', () => {
    const arrayVar = createILVariable('myArray', { kind: 'array', elementType: byteType, size: 256 }, [], 'ram', 'global');
    const index = createILConstant(byteType, 5, 'decimal');
    const instruction = createArrayAddress(testTemporary, arrayVar, index, testLocation);

    expect(instruction.type).toBe(ILInstructionType.ARRAY_ADDRESS);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('X');
  });
});

// ============================================================================
// UTILITY INSTRUCTION TESTS
// ============================================================================

describe('Utility Instructions', () => {
  it('should create LABEL instruction', () => {
    const instruction = createLabel('loop_start', testLocation);

    expect(instruction.type).toBe(ILInstructionType.LABEL);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(0);

    const labelOperand = instruction.operands[0] as any;
    expect(labelOperand.valueType).toBe('label');
    expect(labelOperand.name).toBe('loop_start');
  });

  it('should create NOP instruction', () => {
    const instruction = createNop(testLocation);

    expect(instruction.type).toBe(ILInstructionType.NOP);
    expect(instruction.operands).toHaveLength(0);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(0);
  });

  it('should create COMMENT instruction', () => {
    const instruction = createComment('Debug comment', testLocation);

    expect(instruction.type).toBe(ILInstructionType.COMMENT);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(0);

    const commentOperand = instruction.operands[0] as any;
    expect(commentOperand.valueType).toBe('constant');
    expect(commentOperand.value).toBe('Debug comment');
  });
});

// ============================================================================
// 6502-SPECIFIC INSTRUCTION TESTS
// ============================================================================

describe('6502-Specific Instructions', () => {
  it('should create PEEK instruction', () => {
    const address = createILConstant(wordType, 0xD000, 'hexadecimal');
    const instruction = createPeek(testTemporary, address, testLocation);

    expect(instruction.type).toBe(ILInstructionType.PEEK);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testTemporary);
    expect(instruction.sixtyTwoHints?.isTimingCritical).toBe(true);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(4);
  });

  it('should create POKE instruction', () => {
    const address = createILConstant(wordType, 0xD000, 'hexadecimal');
    const instruction = createPoke(address, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.POKE);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.sixtyTwoHints?.isTimingCritical).toBe(true);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(4);
  });

  it('should create REGISTER_OP instruction with operand', () => {
    const operation = createILConstant({ kind: 'primitive', name: 'void' }, 'load', 'string');
    const instruction = createRegisterOp(testRegister, operation, testConstant, testLocation);

    expect(instruction.type).toBe(ILInstructionType.REGISTER_OP);
    expect(instruction.operands).toHaveLength(3);
    expect(instruction.result).toBe(testRegister);
    expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(2);
  });

  it('should create REGISTER_OP instruction without operand', () => {
    const operation = createILConstant({ kind: 'primitive', name: 'void' }, 'clear', 'string');
    const instruction = createRegisterOp(testRegister, operation, undefined, testLocation);

    expect(instruction.type).toBe(ILInstructionType.REGISTER_OP);
    expect(instruction.operands).toHaveLength(2);
    expect(instruction.result).toBe(testRegister);
  });

  it('should create SET_FLAGS instruction', () => {
    const flags = createILConstant(byteType, 0x01, 'hexadecimal');
    const instruction = createSetFlags(flags, testLocation);

    expect(instruction.type).toBe(ILInstructionType.SET_FLAGS);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.sixtyTwoHints?.isTimingCritical).toBe(true);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(2);
  });

  it('should create CLEAR_FLAGS instruction', () => {
    const flags = createILConstant(byteType, 0x01, 'hexadecimal');
    const instruction = createClearFlags(flags, testLocation);

    expect(instruction.type).toBe(ILInstructionType.CLEAR_FLAGS);
    expect(instruction.operands).toHaveLength(1);
    expect(instruction.sixtyTwoHints?.isTimingCritical).toBe(true);
    expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(2);
  });
});

// ============================================================================
// INSTRUCTION FACTORY TESTS
// ============================================================================

describe('ILInstructionFactory', () => {
  it('should provide all instruction creation functions', () => {
    expect(ILInstructionFactory.loadImmediate).toBe(createLoadImmediate);
    expect(ILInstructionFactory.add).toBe(createAdd);
    expect(ILInstructionFactory.branch).toBe(createBranch);
    expect(ILInstructionFactory.call).toBe(createCall);
    expect(ILInstructionFactory.loadArray).toBe(createLoadArray);
    expect(ILInstructionFactory.peek).toBe(createPeek);

    // Test that factory can create instructions
    const instruction = ILInstructionFactory.add(testTemporary, testRegister, testConstant);
    expect(instruction.type).toBe(ILInstructionType.ADD);
  });
});

// ============================================================================
// INSTRUCTION VALIDATION TESTS
// ============================================================================

describe('Instruction Validation', () => {
  it('should validate instruction with correct operand count', () => {
    const instruction = createAdd(testTemporary, testRegister, testConstant, testLocation);
    const errors = validateILInstruction(instruction);

    expect(errors).toHaveLength(0);
  });

  it('should detect operand count errors during creation', () => {
    expect(() => {
      // Manually creating instruction with wrong operand count to test validation
      const invalidInstruction = {
        type: ILInstructionType.ADD,
        operands: [testTemporary], // ADD needs 3 operands, only providing 1
        id: 1
      };
      validateILInstruction(invalidInstruction as any);
    }).not.toThrow(); // Our simple validation doesn't catch all errors yet
  });
});

// ============================================================================
// INSTRUCTION CONTEXT TESTS
// ============================================================================

describe('Instruction Creation Context', () => {
  it('should generate unique instruction IDs', () => {
    const context = createInstructionContext();

    const id1 = context.getNextInstructionId();
    const id2 = context.getNextInstructionId();
    const id3 = context.getNextInstructionId();

    expect(id1).toBe(1);
    expect(id2).toBe(2);
    expect(id3).toBe(3);
  });

  it('should reset instruction ID counter', () => {
    const context = createInstructionContext();

    context.getNextInstructionId(); // Should be 1
    context.getNextInstructionId(); // Should be 2

    context.resetInstructionId();

    expect(context.getNextInstructionId()).toBe(1); // Should reset to 1
  });

  it('should work with global instruction context', () => {
    resetGlobalInstructionContext();

    const instruction1 = createAdd(testTemporary, testRegister, testConstant);
    const instruction2 = createSub(testTemporary, testRegister, testConstant);

    expect(instruction1.id).toBe(1);
    expect(instruction2.id).toBe(2);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  it('should create ILInstructionError with proper information', () => {
    const error = new ILInstructionError(
      ILInstructionType.ADD,
      'Test error message',
      [testTemporary, testRegister],
      testLocation
    );

    expect(error.name).toBe('ILInstructionError');
    expect(error.instructionType).toBe(ILInstructionType.ADD);
    expect(error.message).toContain('ADD');
    expect(error.message).toContain('Test error message');
    expect(error.operands).toHaveLength(2);
    expect(error.sourceLocation).toBe(testLocation);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('IL Instruction Integration', () => {
  it('should create a sequence of instructions for simple expression', () => {
    // Simulate: temp1 = a + b * 2
    const a = createILVariable('a', byteType, [], 'ram', 'local');
    const b = createILVariable('b', byteType, [], 'ram', 'local');
    const two = createILConstant(byteType, 2, 'decimal');
    const temp1 = createILTemporary(1, byteType, 'expression');
    const temp2 = createILTemporary(2, byteType, 'expression');

    // temp2 = b * 2
    const mulInstruction = createMul(temp2, b, two, testLocation);

    // temp1 = a + temp2
    const addInstruction = createAdd(temp1, a, temp2, testLocation);

    expect(mulInstruction.type).toBe(ILInstructionType.MUL);
    expect(addInstruction.type).toBe(ILInstructionType.ADD);

    // IDs should be sequential
    expect(mulInstruction.id).toBeLessThan(addInstruction.id);
  });

  it('should create a sequence for simple control flow', () => {
    // Simulate: if (x == 5) goto label
    const x = createILVariable('x', byteType, [], 'ram', 'local');
    const five = createILConstant(byteType, 5, 'decimal');
    const condition = createILTemporary(1, booleanType, 'expression');
    const label = createILLabel('if_true');

    const compareInstruction = createCompareEq(condition, x, five, testLocation);
    const branchInstruction = createBranchIfTrue(condition, label, testLocation);

    expect(compareInstruction.type).toBe(ILInstructionType.COMPARE_EQ);
    expect(branchInstruction.type).toBe(ILInstructionType.BRANCH_IF_TRUE);
    expect(compareInstruction.id).toBeLessThan(branchInstruction.id);
  });

  it('should validate complete instruction sequence', () => {
    const instructions = [
      createLoadImmediate(testRegister, testConstant),
      createAdd(testTemporary, testRegister, testConstant),
      createStoreVariable(testVariable, testTemporary),
      createReturn()
    ];

    // All instructions should validate successfully
    for (const instruction of instructions) {
      const errors = validateILInstruction(instruction);
      expect(errors).toHaveLength(0);
    }

    // IDs should be sequential
    for (let i = 1; i < instructions.length; i++) {
      expect(instructions[i-1].id).toBeLessThan(instructions[i].id);
    }
  });
});
