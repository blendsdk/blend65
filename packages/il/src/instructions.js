/**
 * IL Instruction Implementations for Blend65
 * Task 2.2: Define IL Instructions for Blend65
 *
 * This file implements concrete IL instruction creation functions
 * for all Blend65 operations with 6502-specific optimizations.
 */
import { ILInstructionType, createILInstruction, isILConstant, } from './il-types.js';
// ============================================================================
// INSTRUCTION VALIDATION UTILITIES
// ============================================================================
export class ILInstructionError extends Error {
    instructionType;
    operands;
    sourceLocation;
    constructor(instructionType, message, operands, sourceLocation) {
        super(`IL instruction error (${instructionType}): ${message}`);
        this.instructionType = instructionType;
        this.operands = operands;
        this.sourceLocation = sourceLocation;
        this.name = 'ILInstructionError';
    }
}
function validateOperandCount(instructionType, operands, expectedCount) {
    if (operands.length !== expectedCount) {
        throw new ILInstructionError(instructionType, `Expected ${expectedCount} operands, got ${operands.length}`, operands);
    }
}
function validateOperandCountRange(instructionType, operands, minCount, maxCount) {
    if (operands.length < minCount || operands.length > maxCount) {
        throw new ILInstructionError(instructionType, `Expected ${minCount}-${maxCount} operands, got ${operands.length}`, operands);
    }
}
// ============================================================================
// INSTRUCTION CREATION CONTEXT
// ============================================================================
export class InstructionCreationContext {
    nextInstructionId = 1;
    getNextInstructionId() {
        return this.nextInstructionId++;
    }
    resetInstructionId() {
        this.nextInstructionId = 1;
    }
}
const globalInstructionContext = new InstructionCreationContext();
// ============================================================================
// CORE INSTRUCTION CREATION FUNCTIONS
// ============================================================================
// Memory Operations
export function createLoadImmediate(dest, value, sourceLocation) {
    const hints = {
        preferredRegister: dest.valueType === 'register' ? dest.register : 'A',
        preferredAddressingMode: 'immediate',
        estimatedCycles: 2,
    };
    return createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [dest, value], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: hints });
}
export function createLoadMemory(dest, address, sourceLocation) {
    return createILInstruction(ILInstructionType.LOAD_MEMORY, [dest, address], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createStoreMemory(address, value, sourceLocation) {
    return createILInstruction(ILInstructionType.STORE_MEMORY, [address, value], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createCopy(dest, source, sourceLocation) {
    const hints = {
        estimatedCycles: 3,
        canOptimizeAway: dest === source,
    };
    return createILInstruction(ILInstructionType.COPY, [dest, source], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: hints });
}
// Arithmetic Operations
export function createAdd(dest, left, right, sourceLocation) {
    const hints = {
        preferredRegister: 'A',
        estimatedCycles: 3,
        canOptimizeAway: isILConstant(right) && right.value === 0,
    };
    return createILInstruction(ILInstructionType.ADD, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: hints });
}
export function createSub(dest, left, right, sourceLocation) {
    const hints = {
        preferredRegister: 'A',
        estimatedCycles: 3,
        canOptimizeAway: isILConstant(right) && right.value === 0,
    };
    return createILInstruction(ILInstructionType.SUB, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: hints });
}
export function createMul(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.MUL, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 20 } });
}
export function createDiv(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.DIV, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 30 } });
}
export function createMod(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.MOD, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 30 } });
}
export function createNeg(dest, source, sourceLocation) {
    return createILInstruction(ILInstructionType.NEG, [dest, source], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
// Logical Operations
export function createAnd(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.AND, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createOr(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.OR, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createNot(dest, source, sourceLocation) {
    return createILInstruction(ILInstructionType.NOT, [dest, source], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
// Bitwise Operations
export function createBitwiseAnd(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.BITWISE_AND, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createBitwiseOr(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.BITWISE_OR, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createBitwiseXor(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.BITWISE_XOR, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
export function createBitwiseNot(dest, source, sourceLocation) {
    return createILInstruction(ILInstructionType.BITWISE_NOT, [dest, source], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 3 } });
}
// Shift Operations
export function createShiftLeft(dest, source, amount, sourceLocation) {
    return createILInstruction(ILInstructionType.SHIFT_LEFT, [dest, source, amount], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } });
}
export function createShiftRight(dest, source, amount, sourceLocation) {
    return createILInstruction(ILInstructionType.SHIFT_RIGHT, [dest, source, amount], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } });
}
// Comparison Operations
export function createCompareEq(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_EQ, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
export function createCompareNe(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_NE, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
export function createCompareLt(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_LT, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
export function createCompareLe(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_LE, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
export function createCompareGt(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_GT, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
export function createCompareGe(dest, left, right, sourceLocation) {
    return createILInstruction(ILInstructionType.COMPARE_GE, [dest, left, right], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4 } });
}
// Control Flow Operations
export function createBranch(target, sourceLocation) {
    return createILInstruction(ILInstructionType.BRANCH, [target], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } });
}
export function createBranchIfTrue(condition, target, sourceLocation) {
    return createILInstruction(ILInstructionType.BRANCH_IF_TRUE, [condition, target], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } });
}
export function createBranchIfFalse(condition, target, sourceLocation) {
    return createILInstruction(ILInstructionType.BRANCH_IF_FALSE, [condition, target], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } });
}
export function createBranchIfZero(value, target, sourceLocation) {
    return createILInstruction(ILInstructionType.BRANCH_IF_ZERO, [value, target], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } });
}
export function createBranchIfNotZero(value, target, sourceLocation) {
    return createILInstruction(ILInstructionType.BRANCH_IF_NOT_ZERO, [value, target], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 3 } });
}
// Function Operations
export function createCall(functionRef, args = [], sourceLocation) {
    const operands = [functionRef, ...args];
    validateOperandCountRange(ILInstructionType.CALL, operands, 1, 10);
    return createILInstruction(ILInstructionType.CALL, operands, globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 12 } });
}
export function createReturn(value, sourceLocation) {
    const operands = value ? [value] : [];
    return createILInstruction(ILInstructionType.RETURN, operands, globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 6 } });
}
// Variable Operations
export function createDeclareLocal(variable, sourceLocation) {
    return createILInstruction(ILInstructionType.DECLARE_LOCAL, [variable], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } });
}
export function createLoadVariable(dest, variable, sourceLocation) {
    const hints = {
        preferredRegister: 'A',
        preferredAddressingMode: variable.storageClass === 'zp' ? 'zero_page' : 'absolute',
        estimatedCycles: 3,
    };
    return createILInstruction(ILInstructionType.LOAD_VARIABLE, [dest, variable], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: hints });
}
export function createStoreVariable(variable, value, sourceLocation) {
    const hints = {
        preferredRegister: 'A',
        preferredAddressingMode: variable.storageClass === 'zp' ? 'zero_page' : 'absolute',
        estimatedCycles: 3,
    };
    return createILInstruction(ILInstructionType.STORE_VARIABLE, [variable, value], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: hints });
}
// Array Operations
export function createLoadArray(dest, array, index, sourceLocation) {
    return createILInstruction(ILInstructionType.LOAD_ARRAY, [dest, array, index], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } });
}
export function createStoreArray(array, index, value, sourceLocation) {
    return createILInstruction(ILInstructionType.STORE_ARRAY, [array, index, value], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 6 } });
}
export function createArrayAddress(dest, array, index, sourceLocation) {
    return createILInstruction(ILInstructionType.ARRAY_ADDRESS, [dest, array, index], globalInstructionContext.getNextInstructionId(), { result: dest, sourceLocation, sixtyTwoHints: { preferredRegister: 'X', estimatedCycles: 4 } });
}
// Utility Operations
export function createLabel(name, sourceLocation) {
    const label = { valueType: 'label', name };
    return createILInstruction(ILInstructionType.LABEL, [label], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } });
}
export function createNop(sourceLocation) {
    return createILInstruction(ILInstructionType.NOP, [], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } });
}
export function createComment(text, sourceLocation) {
    const comment = {
        valueType: 'constant',
        type: { kind: 'primitive', name: 'void' },
        value: text,
        representation: 'string',
    };
    return createILInstruction(ILInstructionType.COMMENT, [comment], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 0 } });
}
// 6502-Specific Operations
export function createPeek(dest, address, sourceLocation) {
    return createILInstruction(ILInstructionType.PEEK, [dest, address], globalInstructionContext.getNextInstructionId(), {
        result: dest,
        sourceLocation,
        sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4, isTimingCritical: true },
    });
}
export function createPoke(address, value, sourceLocation) {
    return createILInstruction(ILInstructionType.POKE, [address, value], globalInstructionContext.getNextInstructionId(), {
        sourceLocation,
        sixtyTwoHints: { preferredRegister: 'A', estimatedCycles: 4, isTimingCritical: true },
    });
}
export function createRegisterOp(register, operation, operand, sourceLocation) {
    const operands = operand ? [register, operation, operand] : [register, operation];
    return createILInstruction(ILInstructionType.REGISTER_OP, operands, globalInstructionContext.getNextInstructionId(), {
        result: register,
        sourceLocation,
        sixtyTwoHints: { preferredRegister: register.register, estimatedCycles: 2 },
    });
}
export function createSetFlags(flags, sourceLocation) {
    return createILInstruction(ILInstructionType.SET_FLAGS, [flags], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 2, isTimingCritical: true } });
}
export function createClearFlags(flags, sourceLocation) {
    return createILInstruction(ILInstructionType.CLEAR_FLAGS, [flags], globalInstructionContext.getNextInstructionId(), { sourceLocation, sixtyTwoHints: { estimatedCycles: 2, isTimingCritical: true } });
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
    registerOp: createRegisterOp,
    setFlags: createSetFlags,
    clearFlags: createClearFlags,
};
export function createInstructionContext() {
    return new InstructionCreationContext();
}
export function resetGlobalInstructionContext() {
    globalInstructionContext.resetInstructionId();
}
export function validateILInstruction(instruction) {
    const errors = [];
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(new ILInstructionError(instruction.type, `Validation error: ${errorMessage}`, instruction.operands, instruction.sourceLocation));
    }
    return errors;
}
//# sourceMappingURL=instructions.js.map