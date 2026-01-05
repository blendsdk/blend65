/**
 * IL Instruction Implementations for Blend65
 * Task 2.2: Define IL Instructions for Blend65
 *
 * This file implements concrete IL instruction creation functions
 * for all Blend65 operations with 6502-specific optimizations.
 */
import type { SourcePosition } from '@blend65/lexer';
import { ILInstruction, ILInstructionType, ILValue, ILOperand, ILConstant, ILVariable, ILRegister, ILLabel } from './il-types.js';
export declare class ILInstructionError extends Error {
    instructionType: ILInstructionType;
    operands?: ILOperand[] | undefined;
    sourceLocation?: SourcePosition | undefined;
    constructor(instructionType: ILInstructionType, message: string, operands?: ILOperand[] | undefined, sourceLocation?: SourcePosition | undefined);
}
export declare class InstructionCreationContext {
    private nextInstructionId;
    getNextInstructionId(): number;
    resetInstructionId(): void;
}
export declare function createLoadImmediate(dest: ILValue, value: ILConstant, sourceLocation?: SourcePosition): ILInstruction;
export declare function createLoadMemory(dest: ILValue, address: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createStoreMemory(address: ILValue, value: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCopy(dest: ILValue, source: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createAdd(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createSub(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createMul(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createDiv(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createMod(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createNeg(dest: ILValue, source: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createAnd(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createOr(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createNot(dest: ILValue, source: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBitwiseAnd(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBitwiseOr(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBitwiseXor(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBitwiseNot(dest: ILValue, source: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createShiftLeft(dest: ILValue, source: ILValue, amount: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createShiftRight(dest: ILValue, source: ILValue, amount: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareEq(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareNe(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareLt(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareLe(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareGt(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCompareGe(dest: ILValue, left: ILValue, right: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBranch(target: ILLabel, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBranchIfTrue(condition: ILValue, target: ILLabel, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBranchIfFalse(condition: ILValue, target: ILLabel, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBranchIfZero(value: ILValue, target: ILLabel, sourceLocation?: SourcePosition): ILInstruction;
export declare function createBranchIfNotZero(value: ILValue, target: ILLabel, sourceLocation?: SourcePosition): ILInstruction;
export declare function createCall(functionRef: ILValue, args?: ILValue[], sourceLocation?: SourcePosition): ILInstruction;
export declare function createReturn(value?: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createDeclareLocal(variable: ILVariable, sourceLocation?: SourcePosition): ILInstruction;
export declare function createLoadVariable(dest: ILValue, variable: ILVariable, sourceLocation?: SourcePosition): ILInstruction;
export declare function createStoreVariable(variable: ILVariable, value: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createLoadArray(dest: ILValue, array: ILValue, index: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createStoreArray(array: ILValue, index: ILValue, value: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createArrayAddress(dest: ILValue, array: ILValue, index: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createLabel(name: string, sourceLocation?: SourcePosition): ILInstruction;
export declare function createNop(sourceLocation?: SourcePosition): ILInstruction;
export declare function createComment(text: string, sourceLocation?: SourcePosition): ILInstruction;
export declare function createPeek(dest: ILValue, address: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createPoke(address: ILValue, value: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createRegisterOp(register: ILRegister, operation: ILConstant, operand?: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createSetFlags(flags: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare function createClearFlags(flags: ILValue, sourceLocation?: SourcePosition): ILInstruction;
export declare const ILInstructionFactory: {
    loadImmediate: typeof createLoadImmediate;
    loadMemory: typeof createLoadMemory;
    storeMemory: typeof createStoreMemory;
    copy: typeof createCopy;
    add: typeof createAdd;
    sub: typeof createSub;
    mul: typeof createMul;
    div: typeof createDiv;
    mod: typeof createMod;
    neg: typeof createNeg;
    and: typeof createAnd;
    or: typeof createOr;
    not: typeof createNot;
    bitwiseAnd: typeof createBitwiseAnd;
    bitwiseOr: typeof createBitwiseOr;
    bitwiseXor: typeof createBitwiseXor;
    bitwiseNot: typeof createBitwiseNot;
    shiftLeft: typeof createShiftLeft;
    shiftRight: typeof createShiftRight;
    compareEq: typeof createCompareEq;
    compareNe: typeof createCompareNe;
    compareLt: typeof createCompareLt;
    compareLe: typeof createCompareLe;
    compareGt: typeof createCompareGt;
    compareGe: typeof createCompareGe;
    branch: typeof createBranch;
    branchIfTrue: typeof createBranchIfTrue;
    branchIfFalse: typeof createBranchIfFalse;
    branchIfZero: typeof createBranchIfZero;
    branchIfNotZero: typeof createBranchIfNotZero;
    call: typeof createCall;
    return: typeof createReturn;
    declareLocal: typeof createDeclareLocal;
    loadVariable: typeof createLoadVariable;
    storeVariable: typeof createStoreVariable;
    loadArray: typeof createLoadArray;
    storeArray: typeof createStoreArray;
    arrayAddress: typeof createArrayAddress;
    label: typeof createLabel;
    nop: typeof createNop;
    comment: typeof createComment;
    peek: typeof createPeek;
    poke: typeof createPoke;
    registerOp: typeof createRegisterOp;
    setFlags: typeof createSetFlags;
    clearFlags: typeof createClearFlags;
};
export declare function createInstructionContext(): InstructionCreationContext;
export declare function resetGlobalInstructionContext(): void;
export declare function validateILInstruction(instruction: ILInstruction): ILInstructionError[];
//# sourceMappingURL=instructions.d.ts.map