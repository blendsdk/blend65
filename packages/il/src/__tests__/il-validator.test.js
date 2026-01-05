/**
 * Tests for IL Validation System
 * Task 2.4: Test IL Validation Implementation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ILInstructionType, createILConstant, createILVariable, createILTemporary, createILLabel, createILInstruction, createILProgram, createILModule, createILFunction, } from '../il-types';
import { ILValidator, ILValidationErrorType, createILValidator, validateILProgram, validateILModule, validateILFunction, } from '../il-validator';
describe('ILValidator', () => {
    let validator;
    beforeEach(() => {
        validator = createILValidator();
    });
    describe('Basic Validation', () => {
        it('should create validator instance', () => {
            expect(validator).toBeDefined();
            expect(validator).toBeInstanceOf(ILValidator);
        });
        it('should validate empty program', () => {
            const program = createILProgram('test');
            const result = validator.validateProgram(program);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
    });
    describe('Instruction Validation', () => {
        it('should validate LOAD_IMMEDIATE instruction', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const value = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [dest, value], 1, {
                result: dest,
            });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect invalid LOAD_IMMEDIATE operand count', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [dest], // Missing value operand
            1, { result: dest });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.INVALID_OPERAND_COUNT);
        });
        it('should detect non-constant value in LOAD_IMMEDIATE', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const variable = createILVariable('x', { kind: 'primitive', name: 'byte' });
            const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [dest, variable], // Variable instead of constant
            1, { result: dest });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.INVALID_OPERAND_TYPE);
            expect(result.errors[0].message).toContain('requires constant value');
        });
        it('should validate arithmetic operations', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const left = createILConstant({ kind: 'primitive', name: 'byte' }, 10);
            const right = createILConstant({ kind: 'primitive', name: 'byte' }, 20);
            const instruction = createILInstruction(ILInstructionType.ADD, [dest, left, right], 1, {
                result: dest,
            });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect division by zero', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const left = createILConstant({ kind: 'primitive', name: 'byte' }, 10);
            const right = createILConstant({ kind: 'primitive', name: 'byte' }, 0);
            const instruction = createILInstruction(ILInstructionType.DIV, [dest, left, right], 1, {
                result: dest,
            });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.INVALID_OPERAND_TYPE);
            expect(result.errors[0].message).toContain('Division by zero');
        });
    });
    describe('Control Flow Validation', () => {
        it('should validate branch instructions', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const target = createILLabel('loop');
            // Label instruction
            const labelInstruction = createILInstruction(ILInstructionType.LABEL, [target], 1);
            // Branch instruction
            const branchInstruction = createILInstruction(ILInstructionType.BRANCH, [target], 2);
            func.instructions.push(labelInstruction, branchInstruction);
            func.labels.set('loop', 0);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect undefined branch target', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const target = createILLabel('undefined_label');
            const branchInstruction = createILInstruction(ILInstructionType.BRANCH, [target], 1);
            func.instructions.push(branchInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.INVALID_BRANCH_TARGET);
            expect(result.errors[0].message).toContain('Undefined label');
        });
        it('should validate conditional branches', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const condition = createILConstant({ kind: 'primitive', name: 'boolean' }, true);
            const target = createILLabel('then_block');
            // Label instruction
            const labelInstruction = createILInstruction(ILInstructionType.LABEL, [target], 1);
            // Conditional branch instruction
            const branchInstruction = createILInstruction(ILInstructionType.BRANCH_IF_TRUE, [condition, target], 2);
            func.instructions.push(labelInstruction, branchInstruction);
            func.labels.set('then_block', 0);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect unreachable code', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            // Return instruction
            const returnInstruction = createILInstruction(ILInstructionType.RETURN, [], 1);
            // Unreachable instruction after return
            const unreachableInstruction = createILInstruction(ILInstructionType.NOP, [], 2);
            func.instructions.push(returnInstruction, unreachableInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true); // Unreachable code is a warning, not error
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe(ILValidationErrorType.UNREACHABLE_CODE);
        });
    });
    describe('Variable Validation', () => {
        it('should validate variable declarations and usage', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const variable = createILVariable('x', { kind: 'primitive', name: 'byte' });
            const value = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            // Declare variable
            const declareInstruction = createILInstruction(ILInstructionType.DECLARE_LOCAL, [variable], 1);
            // Store value
            const storeInstruction = createILInstruction(ILInstructionType.STORE_VARIABLE, [variable, value], 2);
            // Load variable
            const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [dest, variable], 3, { result: dest });
            func.instructions.push(declareInstruction, storeInstruction, loadInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect use of undefined variable', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const variable = createILVariable('undefined_var', { kind: 'primitive', name: 'byte' });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            // Load undefined variable
            const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [dest, variable], 1, { result: dest });
            func.instructions.push(loadInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.UNDEFINED_VARIABLE);
        });
        it('should warn about variable used before initialization', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const variable = createILVariable('x', { kind: 'primitive', name: 'byte' });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            // Declare variable
            const declareInstruction = createILInstruction(ILInstructionType.DECLARE_LOCAL, [variable], 1);
            // Load uninitialized variable
            const loadInstruction = createILInstruction(ILInstructionType.LOAD_VARIABLE, [dest, variable], 2, { result: dest });
            func.instructions.push(declareInstruction, loadInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true); // Warning, not error
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe(ILValidationErrorType.VARIABLE_USED_BEFORE_DEFINED);
        });
    });
    describe('Function Validation', () => {
        it('should validate function calls', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const functionRef = createILVariable('printf', { kind: 'primitive', name: 'void' });
            const arg = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const callInstruction = createILInstruction(ILInstructionType.CALL, [functionRef, arg], 1);
            func.instructions.push(callInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should validate return statements', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'byte' }, { line: 1, column: 1, offset: 0 });
            const value = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const returnInstruction = createILInstruction(ILInstructionType.RETURN, [value], 1);
            func.instructions.push(returnInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should detect return value in void function', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const value = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const returnInstruction = createILInstruction(ILInstructionType.RETURN, [value], 1);
            func.instructions.push(returnInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].type).toBe(ILValidationErrorType.INVALID_RETURN_TYPE);
            expect(result.errors[0].message).toContain('Void function cannot return a value');
        });
    });
    describe('6502 Specific Validation', () => {
        it('should validate register operations', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const register = {
                valueType: 'register',
                register: 'A',
                type: { kind: 'primitive', name: 'byte' },
            };
            const operation = createILConstant({ kind: 'primitive', name: 'byte' }, 1);
            const registerOpInstruction = createILInstruction(ILInstructionType.REGISTER_OP, [register, operation], 1, { result: register });
            func.instructions.push(registerOpInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should validate memory operations', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const address = createILConstant({ kind: 'primitive', name: 'word' }, 0xd020);
            const peekInstruction = createILInstruction(ILInstructionType.PEEK, [dest, address], 1, {
                result: dest,
            });
            func.instructions.push(peekInstruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
        it('should warn about invalid register hints', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const dest = createILTemporary(1, { kind: 'primitive', name: 'byte' });
            const value = createILConstant({ kind: 'primitive', name: 'byte' }, 42);
            const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [dest, value], 1, {
                result: dest,
                sixtyTwoHints: {
                    preferredRegister: 'Z', // Invalid register
                    estimatedCycles: 2,
                },
            });
            func.instructions.push(instruction);
            const result = validator.validateFunction(func);
            expect(result.isValid).toBe(true); // Warning, not error
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].type).toBe(ILValidationErrorType.INVALID_REGISTER_USAGE);
        });
    });
    describe('Utility Functions', () => {
        it('should provide convenience validation functions', () => {
            const program = createILProgram('test');
            const module = createILModule(['test']);
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            // Test convenience functions
            const programResult = validateILProgram(program);
            const moduleResult = validateILModule(module);
            const functionResult = validateILFunction(func);
            expect(programResult.isValid).toBe(true);
            expect(moduleResult.isValid).toBe(true);
            expect(functionResult.isValid).toBe(true);
        });
        it('should collect validation statistics', () => {
            const func = createILFunction('test', ['test'], { kind: 'primitive', name: 'void' }, { line: 1, column: 1, offset: 0 });
            const instruction1 = createILInstruction(ILInstructionType.NOP, [], 1);
            const instruction2 = createILInstruction(ILInstructionType.NOP, [], 2);
            const instruction3 = createILInstruction(ILInstructionType.RETURN, [], 3);
            func.instructions.push(instruction1, instruction2, instruction3);
            const result = validator.validateFunction(func);
            expect(result.statistics.totalFunctions).toBe(1);
            expect(result.statistics.totalInstructions).toBe(3);
            expect(result.statistics.instructionsByType.get(ILInstructionType.NOP)).toBe(2);
            expect(result.statistics.instructionsByType.get(ILInstructionType.RETURN)).toBe(1);
        });
    });
});
//# sourceMappingURL=il-validator.test.js.map